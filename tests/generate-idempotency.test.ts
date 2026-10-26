import assert from 'node:assert';

// Simulated Firestore Transaction Engine for Concurrency & Optimistic Concurrency Control
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
        // Optimistic concurrency collision -> retry with jitter
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
    // Check conflicts on all read documents
    for (const [path, expectedVer] of this.readVersions.entries()) {
      const actualVer = this.globalVersion.get(path) || 0;
      if (actualVer !== expectedVer) {
        return false;
      }
    }

    // Apply sets
    for (const [path, data] of this.writes.entries()) {
      this.globalData.set(path, data);
      this.globalVersion.set(path, (this.globalVersion.get(path) || 0) + 1);
    }

    // Apply updates
    for (const [path, patch] of this.updates.entries()) {
      const existing = this.globalData.get(path) || {};
      this.globalData.set(path, { ...existing, ...patch });
      this.globalVersion.set(path, (this.globalVersion.get(path) || 0) + 1);
    }

    return true;
  }
}

// Simulated Generate Video Handler matching server.ts exactly
async function simulateGenerateVideoHandler(
  db: MockFirestoreDatabase,
  uid: string,
  generationId: string,
  cost: number,
  veoCallCounter: { count: number }
): Promise<{ status: number; body: any }> {
  const userRef = db.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const chargeTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-charge`);

  // Step 3: Fast pre-check
  try {
    const existingGen = await genRef.get();
    if (existingGen.exists) {
      const gData = existingGen.data() || {};
      if (gData.operationName) {
        return {
          status: 200,
          body: {
            operationName: gData.operationName,
            generationId,
            alreadyStarted: true,
          },
        };
      }
    }
  } catch (e) {
    // continue
  }

  // Step 4: Atomic Firestore Transaction
  let charged = false;
  let txResult: {
    alreadyCharged?: boolean;
    operationName?: string | null;
    status?: string;
  } = {};

  try {
    txResult = await db.runTransaction(async (t) => {
      // Transactional Reads
      const userDoc = await t.get(userRef);
      const chargeDoc = await t.get(chargeTxRef);
      const genDoc = await t.get(genRef);

      // Strict Transactional Idempotency Check:
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

      // Distributed Rate Limiting & Concurrency Checks
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

        // Terminal states are never active
        if (status === 'completed' || status === 'failed' || status === 'refunded') {
          continue;
        }

        // Processing, submitted, and reconciliation_required NEVER lose their slot due to any 15-minute TTL
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

      return {
        alreadyCharged: false,
      };
    });

    if (!txResult.alreadyCharged) {
      charged = true;
    }
  } catch (txErr: any) {
    if (txErr.message === 'INSUFFICIENT_CREDITS') {
      return { status: 402, body: { error: 'INSUFFICIENT_CREDITS' } };
    }
    if (txErr.message === 'RATE_LIMIT_EXCEEDED') {
      return { status: 429, body: { error: 'RATE_LIMIT_EXCEEDED', retryAfter: txErr.retryAfterSec || 30 } };
    }
    if (txErr.message === 'CONCURRENCY_LIMIT_EXCEEDED') {
      return { status: 429, body: { error: 'CONCURRENCY_LIMIT_EXCEEDED', retryAfter: txErr.retryAfterSec || 15 } };
    }
    return { status: 500, body: { error: txErr.message } };
  }

  // Step 4b: If already charged by concurrent request -> DO NOT start second Veo job
  if (txResult.alreadyCharged) {
    if (txResult.operationName) {
      return {
        status: 200,
        body: {
          operationName: txResult.operationName,
          generationId,
          alreadyStarted: true,
        },
      };
    }

    // Wait briefly for concurrent request to complete Veo call
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const latestGen = await genRef.get();
      if (latestGen.exists) {
        const lData = latestGen.data() || {};
        if (lData.operationName) {
          return {
            status: 200,
            body: {
              operationName: lData.operationName,
              generationId,
              alreadyStarted: true,
            },
          };
        }
        if (lData.status === 'failed') {
          return {
            status: 500,
            body: {
              error: lData.refundReason || 'Video-Generierung fehlgeschlagen.',
              refunded: Boolean(lData.refunded),
              generationId,
            },
          };
        }
      }
    }

    return {
      status: 200,
      body: {
        operationName: null,
        status: txResult.status || 'starting',
        generationId,
        alreadyStarted: true,
      },
    };
  }

  // Step 5: External Veo Video Generation API call
  veoCallCounter.count++;
  await new Promise((r) => setTimeout(r, 50));
  const opName = `projects/oneclipai/operations/veo-${generationId}`;

  // Record operationName
  await genRef.update({
    operationName: opName,
    status: 'processing',
    updatedAt: new Date().toISOString(),
  });

  return {
    status: 200,
    body: {
      operationName: opName,
      generationId,
      cost,
    },
  };
}

async function runTestSuite() {
  console.log('=== TEST SUITE: /api/generate-video STRICT IDEMPOTENCY & CONCURRENCY ===\n');

  // TEST A: 2 parallele Requests mit identischer generationId
  {
    console.log('TEST A: 2 parallele Requests mit identischer generationId...');
    const db = new MockFirestoreDatabase();
    const uid = 'concurrent-user-01';
    const generationId = 'gen-double-click-001';
    const cost = 15;
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 50, videosCreatedCount: 0 });

    const [res1, res2] = await Promise.all([
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
    ]);

    assert.strictEqual(res1.status, 200, 'Request 1 must succeed (200)');
    assert.strictEqual(res2.status, 200, 'Request 2 must succeed (200)');

    const finalUser = db.getRaw(`users/${uid}`);
    assert.strictEqual(finalUser.credits, 35, 'User credits must be exactly 35 (deducted once), NOT 20');
    assert.strictEqual(finalUser.videosCreatedCount, 1, 'Video count must be incremented by exactly 1');
    assert.strictEqual(veoCalls.count, 1, 'Exactly ONE Veo generation job must be triggered');

    const chargeDoc = db.getRaw(`users/${uid}/creditTransactions/tx-${generationId}-charge`);
    assert.ok(chargeDoc, 'Charge ledger record must exist');
    assert.strictEqual(chargeDoc.amount, -15);
    assert.strictEqual(chargeDoc.balanceAfter, 35);

    const hasAlreadyStarted = res1.body.alreadyStarted || res2.body.alreadyStarted;
    assert.strictEqual(hasAlreadyStarted, true, 'At least one request must be flagged with alreadyStarted');

    console.log('  -> PASS: Exactly 1 charge deducted (50 -> 35), exactly 1 Veo job started.');
  }

  // TEST B: 5 parallele Requests mit identischer generationId
  {
    console.log('\nTEST B: 5 parallele Requests mit identischer generationId (Burst Test)...');
    const db = new MockFirestoreDatabase();
    const uid = 'burst-user-02';
    const generationId = 'gen-burst-002';
    const cost = 20;
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 100, videosCreatedCount: 0 });

    const results = await Promise.all([
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
    ]);

    results.forEach((r, idx) => {
      assert.strictEqual(r.status, 200, `Request ${idx + 1} must return 200 OK`);
    });

    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 80, 'Credits must be exactly 80 (not 0)');
    assert.strictEqual(veoCalls.count, 1, 'Only 1 Veo call even across 5 parallel requests');

    console.log('  -> PASS: 5 concurrent requests safely merged into 1 charge (100 -> 80) and 1 Veo job.');
  }

  // TEST C: 10 parallele Requests mit identischer generationId
  {
    console.log('\nTEST C: 10 parallele Requests mit identischer generationId (Stress Concurrency Test)...');
    const db = new MockFirestoreDatabase();
    const uid = 'stress-user-03';
    const generationId = 'gen-stress-010';
    const cost = 10;
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 100, videosCreatedCount: 0 });

    const promises = Array.from({ length: 10 }, () =>
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls)
    );
    const results = await Promise.all(promises);

    results.forEach((r, idx) => {
      assert.strictEqual(r.status, 200, `Request ${idx + 1} must return 200 OK`);
    });

    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 90, 'Credits must be exactly 90 (deducted once, not 0)');
    assert.strictEqual(veoCalls.count, 1, 'Exactly 1 Veo call triggered across 10 concurrent requests');

    console.log('  -> PASS: 10 parallel requests merged into 1 charge (100 -> 90) and 1 Veo job.');
  }

  // TEST D: erneuter Request nach abgeschlossener Generation
  {
    console.log('\nTEST D: Erneuter Request nach abgeschlossener Generation (Completed Job)...');
    const db = new MockFirestoreDatabase();
    const uid = 'completed-user-04';
    const generationId = 'gen-completed-004';
    const cost = 15;
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 30, videosCreatedCount: 0 });

    // Initial run
    const firstRes = await simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls);
    assert.strictEqual(firstRes.status, 200);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 15);
    assert.strictEqual(veoCalls.count, 1);

    // Mark generation as completed in Firestore
    db.setRaw(`users/${uid}/generations/${generationId}`, {
      id: generationId,
      status: 'completed',
      operationName: `projects/oneclipai/operations/veo-${generationId}`,
      cost: 15,
    });

    // Replay request after completed
    const replayRes = await simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls);
    assert.strictEqual(replayRes.status, 200);
    assert.strictEqual(replayRes.body.alreadyStarted, true);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 15, 'Credits must remain 15, never deducted again');
    assert.strictEqual(veoCalls.count, 1, 'No second Veo job triggered');

    console.log('  -> PASS: Replay after completed generation safely returned without duplicate charge or Veo call.');
  }

  // TEST E: erneuter Request nachdem die Generation fehlgeschlagen ist
  {
    console.log('\nTEST E: Erneuter Request nachdem die Generation fehlgeschlagen ist (Failed Job)...');
    const db = new MockFirestoreDatabase();
    const uid = 'failed-user-05';
    const generationId = 'gen-failed-005';
    const cost = 20;
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 40, videosCreatedCount: 0 });

    // Seed a failed generation and charge ledger
    db.setRaw(`users/${uid}/generations/${generationId}`, {
      id: generationId,
      status: 'failed',
      refunded: true,
      refundReason: 'Veo safety policy violation',
      cost: 20,
    });
    db.setRaw(`users/${uid}/creditTransactions/tx-${generationId}-charge`, {
      amount: -20,
      generationId,
    });

    // Replay request with this failed generationId
    const replayRes = await simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls);
    assert.strictEqual(replayRes.status, 500, 'Replay on failed generation must return error');
    assert.strictEqual(replayRes.body.refunded, true);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 40, 'Credits must remain 40 (no second charge)');
    assert.strictEqual(veoCalls.count, 0, 'No Veo job started');

    console.log('  -> PASS: Replay after failed generation returns failure info and does not recharge.');
  }

  // TEST F: Transaction Retry OCC Verification
  {
    console.log('\nTEST F: Firestore Transaction Retries do NOT duplicate credit deductions...');
    const db = new MockFirestoreDatabase();
    const uid = 'occ-user-06';
    const generationId = 'gen-occ-006';
    const cost = 10;
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 50, videosCreatedCount: 0 });

    // Run 5 requests that forcefully collide on the same document versions
    await Promise.all([
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
      simulateGenerateVideoHandler(db, uid, generationId, cost, veoCalls),
    ]);

    const user = db.getRaw(`users/${uid}`);
    assert.strictEqual(user.credits, 40, 'Despite multiple OCC conflict retries, credits deducted exactly once');
    assert.strictEqual(veoCalls.count, 1, 'Only 1 Veo call across all retries');

    console.log('  -> PASS: Transaction OCC retries never multiply deductions.');
  }

  // TEST G: Distributed Concurrency across Cloud Run instances (Max 2 concurrent active generations)
  {
    console.log('\nTEST G: Distributed Concurrency Guard (3rd parallel active generation rejected with 429)...');
    const db = new MockFirestoreDatabase();
    const uid = 'concur-dist-07';
    const cost = 10;
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 100, videosCreatedCount: 0, activeGenerations: {} });

    // 2 generations start concurrently (e.g. from Instance A and Instance B)
    const res1 = await simulateGenerateVideoHandler(db, uid, 'gen-slot-A', cost, veoCalls);
    const res2 = await simulateGenerateVideoHandler(db, uid, 'gen-slot-B', cost, veoCalls);

    assert.strictEqual(res1.status, 200, 'First slot accepted');
    assert.strictEqual(res2.status, 200, 'Second slot accepted');
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 80, 'Two slots charged');

    // 3rd generation attempts to start while slots A and B are active (e.g. on Instance C)
    const res3 = await simulateGenerateVideoHandler(db, uid, 'gen-slot-C', cost, veoCalls);
    assert.strictEqual(res3.status, 429, 'Third concurrent generation rejected with HTTP 429');
    assert.strictEqual(res3.body.error, 'CONCURRENCY_LIMIT_EXCEEDED');
    assert.strictEqual(res3.body.retryAfter, 15);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 80, 'No credits deducted for rejected 3rd attempt');

    console.log('  -> PASS: Distributed concurrency strictly enforces max 2 active generations across instances.');
  }

  // TEST H: Distributed Rate Limiting (11 requests in 60s -> 10 succeed, 11th rejected with 429)
  {
    console.log('\nTEST H: Distributed Rate Limiting (11th generation within 60s rejected with 429)...');
    const db = new MockFirestoreDatabase();
    const uid = 'rate-dist-08';
    const cost = 5;
    const veoCalls = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 200, videosCreatedCount: 0, activeGenerations: {}, recentGenerationTimestamps: [] });

    // Execute 10 requests, each simulating completion to free concurrency slot
    for (let i = 1; i <= 10; i++) {
      const genId = `gen-seq-${i}`;
      const res = await simulateGenerateVideoHandler(db, uid, genId, cost, veoCalls);
      assert.strictEqual(res.status, 200, `Request ${i} must succeed`);

      // Mark generation completed to free active slot
      const user = db.getRaw(`users/${uid}`);
      delete user.activeGenerations[genId];
      db.setRaw(`users/${uid}`, user);
    }

    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 150, '10 generations charged 50 credits');

    // 11th request within window must be rate limited!
    const res11 = await simulateGenerateVideoHandler(db, uid, 'gen-seq-11', cost, veoCalls);
    assert.strictEqual(res11.status, 429, '11th request in window rejected with HTTP 429');
    assert.strictEqual(res11.body.error, 'RATE_LIMIT_EXCEEDED');
    assert.ok(res11.body.retryAfter >= 1, 'Retry-After provided');
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 150, 'No credits deducted for rate-limited request');

    console.log('  -> PASS: Distributed rate limiter blocks 11th request with HTTP 429 and Retry-After.');
  }

  // TEST I: Idempotent Replay does NOT trigger Rate Limit or Concurrency Rejection
  {
    console.log('\nTEST I: Idempotent replay of existing generationId ignores rate limit and concurrency caps...');
    const db = new MockFirestoreDatabase();
    const uid = 'idempotent-replay-09';
    const cost = 10;
    const veoCalls = { count: 0 };

    // Fill user with maxed active generations and maxed rate limit timestamps
    const now = Date.now();
    db.setRaw(`users/${uid}`, {
      credits: 50,
      videosCreatedCount: 10,
      activeGenerations: { 'gen-busy-1': now, 'gen-busy-2': now },
      recentGenerationTimestamps: Array(10).fill(now),
    });

    // Seed existing completed generation
    db.setRaw(`users/${uid}/generations/gen-existing-done`, {
      id: 'gen-existing-done',
      operationName: 'projects/oneclipai/operations/done-op-123',
      status: 'completed',
      cost: 10,
    });
    db.setRaw(`users/${uid}/creditTransactions/tx-gen-existing-done-charge`, {
      cost: 10,
      status: 'completed',
    });

    // Calling simulateGenerateVideoHandler with this already started/charged generationId:
    const replayRes = await simulateGenerateVideoHandler(db, uid, 'gen-existing-done', cost, veoCalls);
    assert.strictEqual(replayRes.status, 200, 'Idempotent replay succeeds despite full rate limit/slots');
    assert.strictEqual(replayRes.body.alreadyStarted, true);
    assert.strictEqual(replayRes.body.operationName, 'projects/oneclipai/operations/done-op-123');
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 50, 'No extra charge');

    console.log('  -> PASS: Idempotent replay succeeds cleanly without false rate-limit or concurrency rejection.');
  }

  console.log('\n=== ALL TESTS A - I PASSED SUCCESSFULLY ===');
}

runTestSuite().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
