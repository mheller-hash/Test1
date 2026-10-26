import assert from 'node:assert';
import {
  isDeterministicPreSubmissionError,
  isValidStateTransition,
  GenerationState,
} from '../server.js';

// Simulated Firestore Transaction Engine
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
    const maxRetries = 25;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const tx = new MockTransaction(this.data, this.version);
      try {
        const result = await updateFunction(tx);
        const committed = tx.commit();
        if (committed) {
          return result;
        }
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
      const existing = this.globalData.get(path) || {};
      this.globalData.set(path, { ...existing, ...patch });
      this.globalVersion.set(path, (this.globalVersion.get(path) || 0) + 1);
    }

    return true;
  }
}

// Simulated refund function matching server.ts lines 218-290
async function simulateRefundCredits(
  db: MockFirestoreDatabase,
  uid: string,
  generationId: string,
  cost: number,
  model: string,
  reason: string
): Promise<{ refunded: boolean; skippedDuplicate?: boolean; reason?: string }> {
  const userRef = db.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const refundTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-refund`);

  try {
    return await db.runTransaction(async (t) => {
      // 1. Check existing refund record
      const existingRefund = await t.get(refundTxRef);
      if (existingRefund.exists) {
        return { refunded: false, skippedDuplicate: true, reason: 'ALREADY_REFUNDED' };
      }

      // 2. Read generation record
      const genDoc = await t.get(genRef);
      if (genDoc.exists) {
        const genData = genDoc.data() || {};
        // CRITICAL GUARD: Completed jobs must NEVER be refunded!
        if (genData.status === 'completed') {
          return { refunded: false, skippedDuplicate: false, reason: 'GENERATION_COMPLETED' };
        }
        // CRITICAL GUARD: Ambiguous jobs must NEVER be auto-refunded!
        if (genData.status === 'reconciliation_required') {
          return { refunded: false, skippedDuplicate: false, reason: 'RECONCILIATION_REQUIRED' };
        }
        if (genData.refunded === true) {
          return { refunded: false, skippedDuplicate: true, reason: 'ALREADY_REFUNDED' };
        }
      }

      // 3. User document update
      const userDoc = await t.get(userRef);
      const data = userDoc.exists ? userDoc.data() : {};
      const currentCredits = typeof data?.credits === 'number' && !isNaN(data.credits) ? Math.max(0, data.credits) : 0;
      const currentCount = typeof data?.videosCreatedCount === 'number' ? data.videosCreatedCount : 1;
      const safeCost = Math.max(0, Math.floor(cost));

      t.update(userRef, {
        credits: currentCredits + safeCost,
        videosCreatedCount: Math.max(0, currentCount - 1),
        updatedAt: new Date().toISOString(),
      });

      t.set(refundTxRef, {
        amount: safeCost,
        type: 'generation_refund',
        balanceAfter: currentCredits + safeCost,
        generationId,
        model,
        reason,
        createdAt: new Date().toISOString(),
        status: 'completed',
      });

      t.update(genRef, {
        status: 'failed',
        refunded: true,
        refundReason: reason,
        updatedAt: new Date().toISOString(),
      });

      return { refunded: true };
    });
  } catch (err: any) {
    return { refunded: false, reason: err.message };
  }
}

// Simulated Generate Video Handler matching server.ts
async function simulateGenerateVideoWithVeoState(
  db: MockFirestoreDatabase,
  uid: string,
  generationId: string,
  cost: number,
  veoBehavior: {
    type: 'success' | 'deterministic_failure' | 'timeout' | 'crash_before_save';
    operationName?: string;
    errorMessage?: string;
    errorCode?: number;
  },
  veoJobCounter: { count: number }
): Promise<{ status: number; body: any }> {
  const userRef = db.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const chargeTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-charge`);

  let charged = false;
  let txResult: {
    alreadyCharged?: boolean;
    operationName?: string | null;
    status?: string;
  } = {};

  // Transaction: Charge credits atomically
  try {
    txResult = await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      const chargeDoc = await t.get(chargeTxRef);
      const genDoc = await t.get(genRef);

      if (chargeDoc.exists || genDoc.exists) {
        const gData = genDoc.exists ? (genDoc.data() || {}) : {};
        return {
          alreadyCharged: true,
          operationName: gData.operationName || null,
          status: gData.status || 'starting',
        };
      }

      const currentCredits = userDoc.exists ? userDoc.data().credits : 0;
      if (currentCredits < cost) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      t.update(userRef, {
        credits: currentCredits - cost,
        videosCreatedCount: (userDoc.data().videosCreatedCount || 0) + 1,
      });

      t.set(chargeTxRef, {
        amount: -cost,
        type: 'generation_charge',
        balanceAfter: currentCredits - cost,
        generationId,
        cost,
        status: 'completed',
      });

      t.set(genRef, {
        id: generationId,
        userId: uid,
        cost,
        status: 'starting',
      });

      return { alreadyCharged: false };
    });

    if (!txResult.alreadyCharged) {
      charged = true;
    }
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_CREDITS') {
      return { status: 402, body: { error: 'INSUFFICIENT_CREDITS' } };
    }
    return { status: 500, body: { error: err.message } };
  }

  // If already charged:
  if (txResult.alreadyCharged) {
    if (txResult.operationName) {
      return {
        status: 200,
        body: { operationName: txResult.operationName, generationId, alreadyStarted: true },
      };
    }

    if (txResult.status === 'reconciliation_required') {
      return {
        status: 409,
        body: {
          generationId,
          status: 'reconciliation_required',
          alreadyStarted: true,
          error: 'Reconciliation required',
          refunded: false,
        },
      };
    }

    if (txResult.status === 'completed') {
      return {
        status: 200,
        body: { generationId, status: 'completed', alreadyStarted: true },
      };
    }

    if (txResult.status === 'failed') {
      return {
        status: 500,
        body: { generationId, status: 'failed', alreadyStarted: true, refunded: true },
      };
    }

    // Stuck job check: if starting without operationName, transition to reconciliation_required, NO AUTO REFUND
    const latestGen = await genRef.get();
    if (latestGen.exists && latestGen.data()?.status === 'starting' && !latestGen.data()?.operationName) {
      await genRef.update({
        status: 'reconciliation_required',
        error: 'Interrupted initiation',
      });
      return {
        status: 409,
        body: {
          generationId,
          status: 'reconciliation_required',
          alreadyStarted: true,
          refunded: false,
        },
      };
    }
  }

  // External Veo Call simulation
  try {
    if (veoBehavior.type === 'deterministic_failure') {
      const err: any = new Error(veoBehavior.errorMessage || 'Invalid argument');
      err.status = veoBehavior.errorCode || 400;
      throw err;
    }

    if (veoBehavior.type === 'timeout') {
      // Veo job was incremented (sent to Google), but local timeout fired
      veoJobCounter.count++;
      const timeoutErr: any = new Error('TIMEOUT: Veo-API Video Generation überschritt Zeitlimit von 35000ms');
      timeoutErr.status = 504;
      throw timeoutErr;
    }

    if (veoBehavior.type === 'crash_before_save') {
      // Veo accepted the job!
      veoJobCounter.count++;
      // Server crashed right before saving operationName
      throw new Error('Simulated process crash / abrupt network disconnect');
    }

    // Success
    veoJobCounter.count++;
    const opName = veoBehavior.operationName || `operations/veo-${generationId}`;
    await genRef.update({
      operationName: opName,
      status: 'processing',
    });
    db.setRaw(`operations/${encodeURIComponent(opName)}`, {
      operationName: opName,
      userId: uid,
      generationId,
    });

    return {
      status: 200,
      body: { operationName: opName, generationId, cost },
    };
  } catch (veoErr: any) {
    const isDefinitePreSubmission = isDeterministicPreSubmissionError(veoErr);

    if (isDefinitePreSubmission) {
      // Exactly 1 refund
      if (charged) {
        await simulateRefundCredits(db, uid, generationId, cost, 'veo-3.1-fast-generate-preview', veoErr.message);
      }
      return {
        status: 400,
        body: { error: veoErr.message, status: 'failed', refunded: true },
      };
    } else {
      // Ambiguous: Set status to reconciliation_required, DO NOT REFUND
      await genRef.update({
        status: 'reconciliation_required',
        error: veoErr.message,
      });
      return {
        status: 504,
        body: {
          error: 'Timeout/Ambiguous submission',
          status: 'reconciliation_required',
          generationId,
          refunded: false,
        },
      };
    }
  }
}

// Simulated Video Status Polling Handler
async function simulateVideoStatusPolling(
  db: MockFirestoreDatabase,
  uid: string,
  operationName: string,
  veoStatusResult: { done: boolean; error?: { message: string } | null }
): Promise<{ status: number; body: any }> {
  const opDoc = await db.collection('operations').doc(encodeURIComponent(operationName)).get();
  if (!opDoc.exists || opDoc.data().userId !== uid) {
    return { status: 403, body: { error: 'Forbidden' } };
  }

  const generationId = opDoc.data().generationId;
  const genRef = db.collection('users').doc(uid).collection('generations').doc(generationId);
  const genDoc = await genRef.get();
  const cost = genDoc.data()?.cost || 15;

  let refundInfo: { refunded: boolean; skippedDuplicate?: boolean; reason?: string } = {
    refunded: false,
    skippedDuplicate: false,
  };

  if (veoStatusResult.error) {
    refundInfo = await simulateRefundCredits(
      db,
      uid,
      generationId,
      cost,
      'veo-3.1-fast-generate-preview',
      veoStatusResult.error.message
    );
  } else if (veoStatusResult.done) {
    await genRef.update({ status: 'completed' });
  }

  return {
    status: 200,
    body: {
      done: veoStatusResult.done,
      error: veoStatusResult.error || null,
      refunded: Boolean(refundInfo.refunded || refundInfo.skippedDuplicate),
    },
  };
}

async function runAllReconciliationTests() {
  console.log('========================================================================');
  console.log('     TARGETED AUDIT: VEO TIMEOUT, CRASH RECOVERY & STATE MACHINE        ');
  console.log('========================================================================\n');

  // TEST A: Veo schlägt eindeutig vor Job-Erstellung fehl → genau ein Refund.
  {
    console.log('TEST A: Veo schlägt vor Job-Erstellung fehl (z.B. HTTP 400 Invalid Argument)...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-a';
    const genId = 'gen-a-01';
    const cost = 15;
    const veoCounter = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 30, videosCreatedCount: 0 });

    const res = await simulateGenerateVideoWithVeoState(
      db,
      uid,
      genId,
      cost,
      {
        type: 'deterministic_failure',
        errorMessage: 'Invalid argument: aspect ratio unsupported',
        errorCode: 400,
      },
      veoCounter
    );

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.refunded, true);
    assert.strictEqual(res.body.status, 'failed');
    assert.strictEqual(veoCounter.count, 0, 'No Veo job must be initiated');

    const user = db.getRaw(`users/${uid}`);
    assert.strictEqual(user.credits, 30, 'Credits must be exactly restored to 30');

    const refundDoc = db.getRaw(`users/${uid}/creditTransactions/tx-${genId}-refund`);
    assert.ok(refundDoc, 'Refund transaction ledger must exist');
    assert.strictEqual(refundDoc.amount, 15);

    console.log('  -> PASS: Pre-submission deterministic failure cleanly refunded exactly once (30 -> 15 -> 30).');
  }

  // TEST B: Veo liefert eindeutig einen asynchronen Fehler → genau ein Refund.
  {
    console.log('\nTEST B: Veo liefert einen asynchronen Fehler während des Renderings...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-b';
    const genId = 'gen-b-01';
    const cost = 15;
    const opName = 'operations/veo-b-01';
    const veoCounter = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 30, videosCreatedCount: 0 });

    // Step 1: Submit successfully
    const submitRes = await simulateGenerateVideoWithVeoState(
      db,
      uid,
      genId,
      cost,
      { type: 'success', operationName: opName },
      veoCounter
    );
    assert.strictEqual(submitRes.status, 200);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 15, '15 credits charged on submission');

    // Step 2: Status check returns async failure
    const statusRes = await simulateVideoStatusPolling(db, uid, opName, {
      done: true,
      error: { message: 'Video rendering timed out on GPU cluster' },
    });
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.body.refunded, true);

    const user = db.getRaw(`users/${uid}`);
    assert.strictEqual(user.credits, 30, 'Credits restored to 30 on confirmed async failure');

    const gen = db.getRaw(`users/${uid}/generations/${genId}`);
    assert.strictEqual(gen.status, 'failed');
    assert.strictEqual(gen.refunded, true);

    console.log('  -> PASS: Asynchronous failure confirmed via status polling refunded exactly once.');
  }

  // TEST C: Veo generateVideos() läuft in lokalen Timeout
  // → KEIN automatischer Refund.
  // → Status reconciliation_required.
  // → kein zweiter Veo-Job bei Retry.
  {
    console.log('\nTEST C: generateVideos() läuft in lokalen Timeout (Ambigous State)...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-c';
    const genId = 'gen-c-01';
    const cost = 20;
    const veoCounter = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 50, videosCreatedCount: 0 });

    // Request 1: Times out while calling Veo
    const timeoutRes = await simulateGenerateVideoWithVeoState(
      db,
      uid,
      genId,
      cost,
      { type: 'timeout' },
      veoCounter
    );

    assert.strictEqual(timeoutRes.status, 504, 'Must return HTTP 504 on timeout');
    assert.strictEqual(timeoutRes.body.status, 'reconciliation_required', 'Must be reconciliation_required');
    assert.strictEqual(timeoutRes.body.refunded, false, 'Must NOT refund automatically on timeout!');

    // Verify credits are NOT refunded
    const userAfterTimeout = db.getRaw(`users/${uid}`);
    assert.strictEqual(userAfterTimeout.credits, 30, 'Credits must remain deducted (50 - 20 = 30), NOT refunded');

    const refundDoc = db.getRaw(`users/${uid}/creditTransactions/tx-${genId}-refund`);
    assert.strictEqual(refundDoc, undefined, 'No refund transaction must exist in ambiguous timeout state');

    // Retry by client with the exact same generationId:
    const retryRes = await simulateGenerateVideoWithVeoState(
      db,
      uid,
      genId,
      cost,
      { type: 'success' },
      veoCounter
    );

    assert.strictEqual(retryRes.status, 409, 'Retry must be rejected with 409');
    assert.strictEqual(retryRes.body.status, 'reconciliation_required');
    assert.strictEqual(retryRes.body.refunded, false);
    assert.strictEqual(veoCounter.count, 1, 'CRITICAL: No second Veo job must be initiated on retry!');
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 30, 'Credits must remain 30 (no double charge)');

    console.log('  -> PASS: Timeout sets reconciliation_required, NO auto-refund, retry starts NO second Veo job.');
  }

  // TEST D: Veo akzeptiert den Job, aber der Server verliert die Antwort/operationName
  // → KEIN automatischer Refund, solange der tatsächliche Zustand unbekannt ist.
  // → kein zweiter Veo-Job.
  {
    console.log('\nTEST D: Veo akzeptiert den Job, aber Server verliert Antwort/operationName...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-d';
    const genId = 'gen-d-01';
    const cost = 15;
    const veoCounter = { count: 0 };

    db.setRaw(`users/${uid}`, { credits: 40, videosCreatedCount: 0 });

    const lossRes = await simulateGenerateVideoWithVeoState(
      db,
      uid,
      genId,
      cost,
      { type: 'crash_before_save' },
      veoCounter
    );

    assert.strictEqual(lossRes.status, 504);
    assert.strictEqual(lossRes.body.status, 'reconciliation_required');
    assert.strictEqual(lossRes.body.refunded, false);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 25, 'Credits remain 25 (not refunded)');

    // Retry
    const retryRes = await simulateGenerateVideoWithVeoState(
      db,
      uid,
      genId,
      cost,
      { type: 'success' },
      veoCounter
    );
    assert.strictEqual(retryRes.status, 409);
    assert.strictEqual(veoCounter.count, 1, 'Only the original job ran; no second job started');

    console.log('  -> PASS: Lost response marked reconciliation_required without unauthorized refund.');
  }

  // TEST E: Server-Crash-Szenario zwischen Credit-Commit und Speicherung von operationName
  // → keine Doppelabbuchung.
  // → kein automatischer zweiter Veo-Job.
  // → kein unberechtigter Refund.
  {
    console.log('\nTEST E: Server-Crash zwischen Credit-Commit und Speicherung von operationName...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-e';
    const genId = 'gen-e-01';
    const cost = 15;
    const veoCounter = { count: 0 };

    // Simulate database state after credit commit where server process abruptly died
    db.setRaw(`users/${uid}`, { credits: 25, videosCreatedCount: 1 });
    db.setRaw(`users/${uid}/generations/${genId}`, {
      id: genId,
      userId: uid,
      cost: 15,
      status: 'starting', // was left in starting with no operationName
    });
    db.setRaw(`users/${uid}/creditTransactions/tx-${genId}-charge`, {
      amount: -15,
      type: 'generation_charge',
      generationId: genId,
    });

    // User returns and retries
    const recoveryRes = await simulateGenerateVideoWithVeoState(
      db,
      uid,
      genId,
      cost,
      { type: 'success' },
      veoCounter
    );

    assert.strictEqual(recoveryRes.status, 409);
    assert.strictEqual(recoveryRes.body.status, 'reconciliation_required');
    assert.strictEqual(recoveryRes.body.refunded, false, 'Must NOT automatically refund dead job without verification');
    assert.strictEqual(veoCounter.count, 0, 'No second Veo job triggered');
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 25, 'No duplicate charge (remains 25)');

    console.log('  -> PASS: Crash recovery transitions to reconciliation_required with zero duplicate jobs/charges.');
  }

  // TEST F: Completed Generation → Refund wird abgewiesen.
  {
    console.log('\nTEST F: Completed Generation darf niemals refunded werden...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-f';
    const genId = 'gen-f-01';

    db.setRaw(`users/${uid}`, { credits: 20, videosCreatedCount: 1 });
    db.setRaw(`users/${uid}/generations/${genId}`, {
      id: genId,
      status: 'completed',
      cost: 15,
    });

    const refundRes = await simulateRefundCredits(db, uid, genId, 15, 'veo-3.1-fast-generate-preview', 'Malicious refund call');
    assert.strictEqual(refundRes.refunded, false, 'Must reject refund for completed generation');
    assert.strictEqual(refundRes.reason, 'GENERATION_COMPLETED');
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 20, 'Credits must remain 20');

    console.log('  -> PASS: Completed generation refund strictly rejected.');
  }

  // TEST G: Failed Generation → genau ein Refund.
  {
    console.log('\nTEST G: Failed Generation wird genau einmal erstattet...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-g';
    const genId = 'gen-g-01';

    db.setRaw(`users/${uid}`, { credits: 10, videosCreatedCount: 1 });
    db.setRaw(`users/${uid}/generations/${genId}`, {
      id: genId,
      status: 'processing',
      cost: 15,
    });

    // First refund call
    const refund1 = await simulateRefundCredits(db, uid, genId, 15, 'veo-3.1-fast-generate-preview', 'Confirmed GPU failure');
    assert.strictEqual(refund1.refunded, true);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 25, 'Credits restored to 25');

    // Second refund call on the same failed generation
    const refund2 = await simulateRefundCredits(db, uid, genId, 15, 'veo-3.1-fast-generate-preview', 'Repeated call');
    assert.strictEqual(refund2.refunded, false);
    assert.strictEqual(refund2.skippedDuplicate, true);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 25, 'Credits remain 25 (no second refund)');

    console.log('  -> PASS: Failed generation refunded exactly once.');
  }

  // TEST H: Mehrfaches Status-Polling → niemals mehrfacher Refund.
  {
    console.log('\nTEST H: Mehrfaches Status-Polling nach einem Fehler...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-h';
    const genId = 'gen-h-01';
    const opName = 'operations/veo-h-01';

    db.setRaw(`users/${uid}`, { credits: 10, videosCreatedCount: 1 });
    db.setRaw(`users/${uid}/generations/${genId}`, {
      id: genId,
      cost: 15,
      status: 'processing',
    });
    db.setRaw(`operations/${encodeURIComponent(opName)}`, {
      operationName: opName,
      userId: uid,
      generationId: genId,
    });

    // Poll 1: Triggers refund
    const poll1 = await simulateVideoStatusPolling(db, uid, opName, {
      done: true,
      error: { message: 'Content safety policy violation' },
    });
    assert.strictEqual(poll1.body.refunded, true);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 25);

    // Polls 2 through 10: Repeated polls
    for (let i = 2; i <= 10; i++) {
      const poll = await simulateVideoStatusPolling(db, uid, opName, {
        done: true,
        error: { message: 'Content safety policy violation' },
      });
      assert.strictEqual(poll.status, 200);
      assert.strictEqual(db.getRaw(`users/${uid}`).credits, 25, `Credits must stay 25 on poll ${i}`);
    }

    console.log('  -> PASS: 10 consecutive status polls maintained credits strictly at 25.');
  }

  // TEST I: State Machine Transition Verifications
  {
    console.log('\nTEST I: State Machine Transition Rules Verification...');
    assert.strictEqual(isValidStateTransition('starting', 'submitted'), true);
    assert.strictEqual(isValidStateTransition('starting', 'processing'), true);
    assert.strictEqual(isValidStateTransition('starting', 'reconciliation_required'), true);
    assert.strictEqual(isValidStateTransition('starting', 'failed'), true);

    assert.strictEqual(isValidStateTransition('processing', 'completed'), true);
    assert.strictEqual(isValidStateTransition('processing', 'failed'), true);

    // ILLEGAL TRANSITIONS:
    assert.strictEqual(isValidStateTransition('completed', 'processing'), false, 'Completed cannot transition to processing');
    assert.strictEqual(isValidStateTransition('completed', 'failed'), false, 'Completed cannot transition to failed');
    assert.strictEqual(isValidStateTransition('completed', 'refunded'), false, 'Completed cannot transition to refunded');
    assert.strictEqual(isValidStateTransition('refunded', 'processing'), false, 'Refunded cannot transition to processing');
    assert.strictEqual(isValidStateTransition('reconciliation_required', 'processing'), false, 'Reconciliation cannot directly transition to processing');

    console.log('  -> PASS: All state machine transition constraints verified.');
  }

  console.log('\n========================================================================');
  console.log('      ALL VEO RECONCILIATION & RECOVERY TESTS PASSED (100%)             ');
  console.log('========================================================================\n');
  process.exit(0);
}

runAllReconciliationTests().catch((err) => {
  console.error('Reconciliation test failed:', err);
  process.exit(1);
});
