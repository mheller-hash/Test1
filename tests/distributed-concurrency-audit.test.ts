import assert from 'node:assert';

// Simulated Firestore Concurrency & Transaction Engine with Optimistic Concurrency Control (OCC)
class MockFirestoreDatabase {
  private data = new Map<string, any>();
  private version = new Map<string, number>();

  doc(path: string) {
    return {
      path,
      collection: (sub: string) => ({
        doc: (id: string) => this.doc(`${path}/${sub}/${id}`),
      }),
      get: async () => {
        const val = this.data.get(path);
        return {
          exists: val !== undefined,
          data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined),
        };
      },
      set: async (val: any) => {
        this.setRaw(path, val);
      },
      update: async (patch: any) => {
        const existing = this.data.get(path) || {};
        this.setRaw(path, { ...existing, ...patch });
      },
    };
  }

  collection(path: string) {
    return {
      doc: (id: string) => this.doc(`${path}/${id}`),
    };
  }

  async runTransaction<T>(updateFunction: (transaction: MockTransaction) => Promise<T>): Promise<T> {
    const maxRetries = 35;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const tx = new MockTransaction(this.data, this.version);
      try {
        const result = await updateFunction(tx);
        const committed = tx.commit();
        if (committed) {
          return result;
        }
        // OCC conflict retry with jitter
        await new Promise((r) => setTimeout(r, Math.random() * 15 + 5));
      } catch (err) {
        throw err;
      }
    }
    throw new Error('Transaction contention limit exceeded');
  }

  getRaw(path: string) {
    return this.data.get(path);
  }

  setRaw(path: string, val: any) {
    this.data.set(path, JSON.parse(JSON.stringify(val)));
    this.version.set(path, (this.version.get(path) || 0) + 1);
  }
}

class MockTransaction {
  private readVersions = new Map<string, number>();
  private writes = new Map<string, any>();
  private updates = new Map<string, any>();

  constructor(
    private globalData: Map<string, any>,
    private globalVersion: Map<string, number>
  ) {}

  async get(docRef: any) {
    const path = docRef.path;
    const currentVer = this.globalVersion.get(path) || 0;
    this.readVersions.set(path, currentVer);

    const val = this.globalData.get(path);
    return {
      exists: val !== undefined,
      data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined),
    };
  }

  set(docRef: any, data: any) {
    this.writes.set(docRef.path, JSON.parse(JSON.stringify(data)));
  }

  update(docRef: any, data: any) {
    this.updates.set(docRef.path, JSON.parse(JSON.stringify(data)));
  }

  commit(): boolean {
    for (const [path, expectedVer] of this.readVersions.entries()) {
      const actualVer = this.globalVersion.get(path) || 0;
      if (actualVer !== expectedVer) {
        return false;
      }
    }

    for (const [path, data] of this.writes.entries()) {
      this.globalData.set(path, data);
      this.globalVersion.set(path, (this.globalVersion.get(path) || 0) + 1);
    }

    for (const [path, patch] of this.updates.entries()) {
      const current = this.globalData.get(path) || {};
      const updated = { ...current };

      for (const [key, val] of Object.entries(patch)) {
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          if (!updated[parent]) updated[parent] = {};
          if (val === '__DELETE__') {
            delete updated[parent][child];
          } else {
            updated[parent][child] = val;
          }
        } else if (val === '__DELETE__') {
          delete updated[key];
        } else {
          updated[key] = val;
        }
      }

      this.globalData.set(path, updated);
      this.globalVersion.set(path, (this.globalVersion.get(path) || 0) + 1);
    }

    return true;
  }
}

// Handler mirroring server.ts generate-video logic exactly
async function simulateGenerateVideo(
  db: MockFirestoreDatabase,
  uid: string,
  generationId: string,
  cost: number,
  veoCallCounter: { count: number }
): Promise<{ status: number; body: any }> {
  const userRef = db.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const chargeTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-charge`);

  // Idempotency pre-check
  const existingGen = await genRef.get();
  if (existingGen.exists) {
    const gData = existingGen.data() || {};
    if (gData.operationName) {
      return {
        status: 200,
        body: { operationName: gData.operationName, generationId, alreadyStarted: true },
      };
    }
  }

  try {
    const txResult = await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      const chargeDoc = await t.get(chargeTxRef);
      const genDoc = await t.get(genRef);

      // Strict Financial Idempotency
      if (chargeDoc.exists || genDoc.exists) {
        const gData = genDoc.exists ? (genDoc.data() || {}) : {};
        return {
          alreadyCharged: true,
          operationName: gData.operationName || null,
          status: gData.status || 'starting',
        };
      }

      const data = userDoc.exists ? (userDoc.data() || {}) : {};
      const currentCredits = typeof data.credits === 'number' ? data.credits : 0;
      const currentCount = typeof data.videosCreatedCount === 'number' ? data.videosCreatedCount : 0;

      if (currentCredits < cost) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      // Distributed Rate Limiting Check
      const now = Date.now();
      const recentTimestamps: number[] = Array.isArray(data.recentGenerationTimestamps)
        ? data.recentGenerationTimestamps.filter((ts: number) => typeof ts === 'number' && now - ts < 60000)
        : [];

      if (recentTimestamps.length >= 10) {
        const oldest = recentTimestamps[0];
        const retryAfterSec = Math.max(1, Math.ceil((oldest + 60000 - now) / 1000));
        const rateErr: any = new Error('RATE_LIMIT_EXCEEDED');
        rateErr.retryAfterSec = retryAfterSec;
        throw rateErr;
      }

      // Distributed Concurrency Check
      const rawActiveGenerations: Record<string, any> = (data.activeGenerations && typeof data.activeGenerations === 'object')
        ? data.activeGenerations
        : {};

      const activeGenerations: Record<string, any> = {};
      for (const [gId, val] of Object.entries(rawActiveGenerations)) {
        if (gId === generationId) continue;

        const status = (typeof val === 'object' && val?.status) ? val.status : 'processing';
        const startedAt = (typeof val === 'object' && typeof val?.startedAt === 'number')
          ? val.startedAt
          : (typeof val === 'number' ? val : now);

        if (status === 'completed' || status === 'failed' || status === 'refunded') {
          continue;
        }

        // Critical Rule: processing, submitted, reconciliation_required NEVER lose their slot due to TTL!
        if (status === 'starting' && now - startedAt > 10 * 60 * 1000) {
          continue;
        }

        activeGenerations[gId] = { startedAt, status };
      }

      if (Object.keys(activeGenerations).length >= 2) {
        const concErr: any = new Error('CONCURRENCY_LIMIT_EXCEEDED');
        concErr.retryAfterSec = 15;
        throw concErr;
      }

      activeGenerations[generationId] = { startedAt: now, status: 'starting' };
      recentTimestamps.push(now);
      const boundedTimestamps = recentTimestamps.slice(-20);

      t.update(userRef, {
        credits: currentCredits - cost,
        videosCreatedCount: currentCount + 1,
        activeGenerations,
        recentGenerationTimestamps: boundedTimestamps,
        updatedAt: new Date().toISOString(),
      });

      t.set(chargeTxRef, {
        amount: -cost,
        type: 'generation_charge',
        balanceAfter: currentCredits - cost,
        generationId,
        cost,
        createdAt: new Date().toISOString(),
        status: 'completed',
      });

      t.set(genRef, {
        id: generationId,
        userId: uid,
        cost,
        status: 'starting',
        createdAt: new Date().toISOString(),
      });

      return { alreadyCharged: false };
    });

    if (txResult.alreadyCharged) {
      if (txResult.status === 'reconciliation_required') {
        return {
          status: 409,
          body: { error: 'reconciliation_required', generationId, alreadyStarted: true },
        };
      }
      return {
        status: 200,
        body: { operationName: txResult.operationName, generationId, alreadyStarted: true },
      };
    }

    veoCallCounter.count++;
    const opName = `operations/veo-${generationId}`;

    await genRef.update({
      operationName: opName,
      status: 'processing',
    });

    const uDoc = await userRef.get();
    const uData = uDoc.data() || {};
    if (uData.activeGenerations && uData.activeGenerations[generationId]) {
      uData.activeGenerations[generationId].status = 'processing';
      uData.activeGenerations[generationId].operationName = opName;
      await userRef.set(uData);
    }

    return {
      status: 200,
      body: { operationName: opName, generationId },
    };
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_CREDITS') {
      return { status: 402, body: { error: 'INSUFFICIENT_CREDITS' } };
    }
    if (err.message === 'RATE_LIMIT_EXCEEDED') {
      return { status: 429, body: { error: 'RATE_LIMIT_EXCEEDED', retryAfter: err.retryAfterSec } };
    }
    if (err.message === 'CONCURRENCY_LIMIT_EXCEEDED') {
      return { status: 429, body: { error: 'CONCURRENCY_LIMIT_EXCEEDED', retryAfter: err.retryAfterSec } };
    }
    return { status: 500, body: { error: err.message } };
  }
}

// Atomic Completion Function mirroring server.ts exactly
async function simulateCompleteGenerationAtomically(
  db: MockFirestoreDatabase,
  uid: string,
  generationId: string
): Promise<{ completed: boolean; alreadyCompleted?: boolean }> {
  const userRef = db.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);

  return await db.runTransaction(async (t) => {
    const genDoc = await t.get(genRef);
    const userDoc = await t.get(userRef);

    if (!genDoc.exists) {
      return { completed: false };
    }

    const gData = genDoc.data() || {};
    if (gData.status === 'completed') {
      const uData = userDoc.exists ? (userDoc.data() || {}) : {};
      if (uData.activeGenerations && uData.activeGenerations[generationId]) {
        t.update(userRef, {
          [`activeGenerations.${generationId}`]: '__DELETE__',
        });
      }
      return { completed: true, alreadyCompleted: true };
    }

    t.update(genRef, {
      status: 'completed',
    });

    if (userDoc.exists) {
      t.update(userRef, {
        [`activeGenerations.${generationId}`]: '__DELETE__',
      });
    }

    return { completed: true };
  });
}

// Atomic Refund Function mirroring server.ts exactly
async function simulateRefundCredits(
  db: MockFirestoreDatabase,
  uid: string,
  generationId: string,
  cost: number,
  reason: string
): Promise<{ refunded: boolean; skippedDuplicate?: boolean }> {
  const userRef = db.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const refundTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-refund`);

  return await db.runTransaction(async (t) => {
    const existingRefund = await t.get(refundTxRef);
    if (existingRefund.exists) {
      return { refunded: false, skippedDuplicate: true };
    }

    const genDoc = await t.get(genRef);
    if (genDoc.exists && genDoc.data()?.status === 'completed') {
      return { refunded: false };
    }

    const userDoc = await t.get(userRef);
    const data = userDoc.exists ? userDoc.data() : {};
    const currentCredits = data?.credits || 0;

    t.update(userRef, {
      credits: currentCredits + cost,
      [`activeGenerations.${generationId}`]: '__DELETE__',
    });

    t.set(refundTxRef, {
      amount: cost,
      type: 'generation_refund',
      generationId,
      reason,
      status: 'completed',
    });

    t.update(genRef, {
      status: 'failed',
      refunded: true,
      refundReason: reason,
    });

    return { refunded: true };
  });
}

// -------------------------------------------------------------
// REGRESSION TEST SUITE (CASES A - I)
// -------------------------------------------------------------

async function runAuditRegressionTests() {
  console.log('================================================================');
  console.log('  DISTRIBUTED FIRESTORE CONCURRENCY & RATE LIMIT AUDIT TESTS   ');
  console.log('================================================================');

  // TEST A: Processing Job older than 15 minutes -> Slot MUST NOT be released!
  {
    console.log('\nTEST A: Processing job older than 15 minutes keeps its concurrency slot...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-ttl-a';
    const veoCalls = { count: 0 };
    const twentyMinutesAgo = Date.now() - 20 * 60 * 1000;

    db.setRaw(`users/${uid}`, {
      credits: 100,
      videosCreatedCount: 2,
      activeGenerations: {
        'gen-old-processing-1': { startedAt: twentyMinutesAgo, status: 'processing' },
        'gen-old-processing-2': { startedAt: twentyMinutesAgo, status: 'processing' },
      },
    });

    // 3rd generation must be BLOCKED with HTTP 429 because slots 1 and 2 are still in 'processing'!
    const res = await simulateGenerateVideo(db, uid, 'gen-new-attempt-3', 15, veoCalls);
    assert.strictEqual(res.status, 429, '3rd job must be rejected with 429');
    assert.strictEqual(res.body.error, 'CONCURRENCY_LIMIT_EXCEEDED');
    assert.strictEqual(veoCalls.count, 0, 'No Veo job started');
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 100, 'Zero credits deducted');
    console.log('  -> PASS: Processing jobs older than 15m strictly keep their slot; no extra Veo job allowed.');
  }

  // TEST B: Reconciliation_required older than 15 minutes -> Slot MUST NOT be released!
  {
    console.log('\nTEST B: reconciliation_required older than 15 minutes keeps its concurrency slot...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-rec-b';
    const veoCalls = { count: 0 };
    const twentyMinutesAgo = Date.now() - 20 * 60 * 1000;

    db.setRaw(`users/${uid}`, {
      credits: 100,
      videosCreatedCount: 2,
      activeGenerations: {
        'gen-rec-1': { startedAt: twentyMinutesAgo, status: 'reconciliation_required' },
        'gen-rec-2': { startedAt: twentyMinutesAgo, status: 'reconciliation_required' },
      },
    });
    db.setRaw(`users/${uid}/generations/gen-rec-1`, {
      id: 'gen-rec-1',
      status: 'reconciliation_required',
    });
    db.setRaw(`users/${uid}/creditTransactions/tx-gen-rec-1-charge`, {
      cost: 15,
      status: 'completed',
    });

    // Replay of reconciliation_required job returns 409 and does NOT start second Veo job
    const replayRes = await simulateGenerateVideo(db, uid, 'gen-rec-1', 15, veoCalls);
    assert.strictEqual(replayRes.status, 409, 'Replay of reconciliation_required returns 409');
    assert.strictEqual(veoCalls.count, 0, 'Veo job not repeated');

    // New generation attempt also blocked with 429 because both slots are held
    const newRes = await simulateGenerateVideo(db, uid, 'gen-new-attempt-b', 15, veoCalls);
    assert.strictEqual(newRes.status, 429, 'New job blocked while slots held by reconciliation_required');
    assert.strictEqual(newRes.body.error, 'CONCURRENCY_LIMIT_EXCEEDED');
    console.log('  -> PASS: reconciliation_required safely locks concurrency slot; retries and 3rd jobs blocked.');
  }

  // TEST C: Completed Job -> Slot correctly freed
  {
    console.log('\nTEST C: Completed job correctly frees concurrency slot...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-complete-c';
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, {
      credits: 100,
      videosCreatedCount: 2,
      activeGenerations: {
        'gen-run-1': { startedAt: Date.now(), status: 'processing' },
        'gen-run-2': { startedAt: Date.now(), status: 'processing' },
      },
    });
    db.setRaw(`users/${uid}/generations/gen-run-1`, { id: 'gen-run-1', status: 'processing' });

    // Mark gen-run-1 completed
    const compRes = await simulateCompleteGenerationAtomically(db, uid, 'gen-run-1');
    assert.strictEqual(compRes.completed, true);

    const userAfter = db.getRaw(`users/${uid}`);
    assert.strictEqual(userAfter.activeGenerations['gen-run-1'], undefined, 'Slot gen-run-1 must be deleted');
    assert.ok(userAfter.activeGenerations['gen-run-2'], 'Slot gen-run-2 must remain active');

    // Now a new generation can take the freed slot!
    const res = await simulateGenerateVideo(db, uid, 'gen-new-3', 15, veoCalls);
    assert.strictEqual(res.status, 200, 'New generation successfully acquired freed slot');
    assert.strictEqual(veoCalls.count, 1);
    console.log('  -> PASS: Completed job cleanly frees slot in users/{uid} and permits next job.');
  }

  // TEST D: Definitively Failed / Refunded Job -> Slot correctly freed
  {
    console.log('\nTEST D: Definitively failed/refunded job correctly frees concurrency slot...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-failed-d';
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, {
      credits: 85,
      videosCreatedCount: 2,
      activeGenerations: {
        'gen-fail-1': { startedAt: Date.now(), status: 'processing' },
        'gen-fail-2': { startedAt: Date.now(), status: 'processing' },
      },
    });
    db.setRaw(`users/${uid}/generations/gen-fail-1`, { id: 'gen-fail-1', status: 'processing' });

    // Refund and fail gen-fail-1
    const refRes = await simulateRefundCredits(db, uid, 'gen-fail-1', 15, 'Veo safety trigger');
    assert.strictEqual(refRes.refunded, true);

    const userAfter = db.getRaw(`users/${uid}`);
    assert.strictEqual(userAfter.credits, 100, 'Credits restored 85 -> 100');
    assert.strictEqual(userAfter.activeGenerations['gen-fail-1'], undefined, 'Slot gen-fail-1 deleted');

    // Slot can be taken by new generation
    const res = await simulateGenerateVideo(db, uid, 'gen-new-4', 15, veoCalls);
    assert.strictEqual(res.status, 200);
    console.log('  -> PASS: Failed and refunded job frees concurrency slot and restores credits.');
  }

  // TEST E: Race Condition: Concurrent Complete + New Generate Request
  {
    console.log('\nTEST E: Concurrent completion and new generate request...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-race-e';
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, {
      credits: 100,
      videosCreatedCount: 2,
      activeGenerations: {
        'gen-finishing': { startedAt: Date.now(), status: 'processing' },
        'gen-other': { startedAt: Date.now(), status: 'processing' },
      },
    });
    db.setRaw(`users/${uid}/generations/gen-finishing`, { id: 'gen-finishing', status: 'processing' });

    // Concurrently trigger completion of finishing job AND new generation request
    const [compRes, genRes] = await Promise.all([
      simulateCompleteGenerationAtomically(db, uid, 'gen-finishing'),
      simulateGenerateVideo(db, uid, 'gen-brand-new', 15, veoCalls),
    ]);

    assert.strictEqual(compRes.completed, true);
    // Because completion runs concurrently, either genRes succeeded or was OCC-retried and succeeded
    assert.strictEqual(genRes.status, 200, 'New generate request resolves cleanly under concurrency');

    const user = db.getRaw(`users/${uid}`);
    const activeKeys = Object.keys(user.activeGenerations || {});
    assert.strictEqual(activeKeys.length, 2, 'Exactly 2 active slots remain (gen-other and gen-brand-new)');
    assert.strictEqual(activeKeys.includes('gen-finishing'), false);
    assert.strictEqual(activeKeys.includes('gen-brand-new'), true);
    console.log('  -> PASS: Concurrency race between completion and new generation resolved consistently.');
  }

  // TEST F: Multiple Parallel Status Polls -> Slot release is strictly idempotent
  {
    console.log('\nTEST F: Multiple parallel status polls maintain idempotent slot release...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-parallel-poll-f';

    db.setRaw(`users/${uid}`, {
      credits: 100,
      activeGenerations: {
        'gen-parallel-done': { startedAt: Date.now(), status: 'processing' },
      },
    });
    db.setRaw(`users/${uid}/generations/gen-parallel-done`, { id: 'gen-parallel-done', status: 'processing' });

    // 10 concurrent status polls
    const results = await Promise.all([
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
      simulateCompleteGenerationAtomically(db, uid, 'gen-parallel-done'),
    ]);

    const successes = results.filter((r) => r.completed);
    assert.strictEqual(successes.length, 10, 'All 10 poll attempts resolved successfully');

    const user = db.getRaw(`users/${uid}`);
    assert.strictEqual(user.activeGenerations['gen-parallel-done'], undefined, 'Slot deleted exactly once');
    console.log('  -> PASS: 10 parallel completion polls resolved idempotently without document corruption.');
  }

  // TEST G: 100+ Rate-Limit Events -> Data structures strictly bounded
  {
    console.log('\nTEST G: 100+ rate limit events keep Firestore document size strictly bounded...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-bounded-g';
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, {
      credits: 1000,
      videosCreatedCount: 0,
      activeGenerations: {},
      recentGenerationTimestamps: [],
    });

    // Execute 2 generations to fill slots
    await simulateGenerateVideo(db, uid, 'gen-bound-1', 10, veoCalls);
    await simulateGenerateVideo(db, uid, 'gen-bound-2', 10, veoCalls);

    // Now fire 100 rapid requests (all will be blocked by concurrency or rate limit)
    for (let i = 0; i < 100; i++) {
      await simulateGenerateVideo(db, uid, `gen-bound-rejected-${i}`, 10, veoCalls);
    }

    const user = db.getRaw(`users/${uid}`);
    const activeCount = Object.keys(user.activeGenerations || {}).length;
    const timestampsCount = (user.recentGenerationTimestamps || []).length;

    assert.ok(activeCount <= 2, `activeGenerations count (${activeCount}) must be <= 2`);
    assert.ok(timestampsCount <= 20, `recentGenerationTimestamps count (${timestampsCount}) must be <= 20`);
    console.log(`  -> PASS: activeGenerations (${activeCount}) and timestamps (${timestampsCount}) remain strictly bounded.`);
  }

  // TEST H: Idempotent Replay consumes NO extra slot and NO extra rate-limit quota
  {
    console.log('\nTEST H: Idempotent replay consumes zero extra slots and zero rate limit quota...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-replay-h';
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, {
      credits: 100,
      videosCreatedCount: 0,
      activeGenerations: {},
      recentGenerationTimestamps: [],
    });

    // 1st call for gen-idem-1
    const res1 = await simulateGenerateVideo(db, uid, 'gen-idem-1', 15, veoCalls);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(veoCalls.count, 1);

    const userAfter1 = db.getRaw(`users/${uid}`);
    const tsCount1 = userAfter1.recentGenerationTimestamps.length;
    const slotsCount1 = Object.keys(userAfter1.activeGenerations).length;

    // 5 repeated calls for SAME gen-idem-1
    for (let i = 0; i < 5; i++) {
      const replayRes = await simulateGenerateVideo(db, uid, 'gen-idem-1', 15, veoCalls);
      assert.strictEqual(replayRes.status, 200);
      assert.strictEqual(replayRes.body.alreadyStarted, true);
    }

    assert.strictEqual(veoCalls.count, 1, 'Still only 1 Veo job triggered');
    const userAfterReplays = db.getRaw(`users/${uid}`);
    assert.strictEqual(userAfterReplays.recentGenerationTimestamps.length, tsCount1, 'Zero extra rate-limit timestamps');
    assert.strictEqual(Object.keys(userAfterReplays.activeGenerations).length, slotsCount1, 'Zero extra concurrency slots');
    console.log('  -> PASS: 5 idempotent replays consumed 0 extra rate-limit timestamps and 0 extra slots.');
  }

  // TEST I: Two Simulated Cloud Run Instances -> Global Limit strictly enforced
  {
    console.log('\nTEST I: Two simulated Cloud Run instances enforce global limit of 2 active jobs...');
    const sharedDb = new MockFirestoreDatabase();
    const uid = 'user-multi-instance-i';
    const cost = 10;
    const veoCalls = { count: 0 };

    sharedDb.setRaw(`users/${uid}`, {
      credits: 100,
      videosCreatedCount: 0,
      activeGenerations: {},
      recentGenerationTimestamps: [],
    });

    // Instance 1 receives Request 1
    const resInst1 = await simulateGenerateVideo(sharedDb, uid, 'gen-from-instance-1', cost, veoCalls);
    assert.strictEqual(resInst1.status, 200, 'Instance 1 accepted job 1');

    // Instance 2 receives Request 2
    const resInst2 = await simulateGenerateVideo(sharedDb, uid, 'gen-from-instance-2', cost, veoCalls);
    assert.strictEqual(resInst2.status, 200, 'Instance 2 accepted job 2');

    // Instance 1 receives Request 3 -> MUST BE BLOCKED BY FIRESTORE
    const resInst1_third = await simulateGenerateVideo(sharedDb, uid, 'gen-from-instance-1-extra', cost, veoCalls);
    assert.strictEqual(resInst1_third.status, 429, 'Instance 1 rejects 3rd job via Firestore limit');
    assert.strictEqual(resInst1_third.body.error, 'CONCURRENCY_LIMIT_EXCEEDED');

    // Instance 2 receives Request 4 -> ALSO MUST BE BLOCKED BY FIRESTORE
    const resInst2_fourth = await simulateGenerateVideo(sharedDb, uid, 'gen-from-instance-2-extra', cost, veoCalls);
    assert.strictEqual(resInst2_fourth.status, 429, 'Instance 2 rejects 4th job via Firestore limit');
    assert.strictEqual(resInst2_fourth.body.error, 'CONCURRENCY_LIMIT_EXCEEDED');

    assert.strictEqual(veoCalls.count, 2, 'Exactly 2 Veo jobs started globally across all instances');
    assert.strictEqual(sharedDb.getRaw(`users/${uid}`).credits, 80, 'Exactly 20 credits deducted');
    console.log('  -> PASS: Multiple Cloud Run instances share Firestore lock; 3rd and 4th requests rejected.');
  }

  console.log('\n================================================================');
  console.log('   ALL AUDIT REGRESSION TESTS A - I PASSED SUCCESSFULLY (100%)  ');
  console.log('================================================================\n');
}

runAuditRegressionTests().catch((err) => {
  console.error('Audit regression tests failed:', err);
  process.exit(1);
});
