import assert from 'node:assert';

// Simulated Firestore Database & Transaction Engine
// Accurately models transactional isolation, atomic reads/writes, and rollback behavior
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
    const maxRetries = 15;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const tx = new MockTransaction(this.data, this.version);
      try {
        const result = await updateFunction(tx);
        const committed = tx.commit();
        if (committed) {
          return result;
        }
        await new Promise((r) => setTimeout(r, 10));
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

// Simulated refundCredits function matching server.ts
async function simulateRefundCredits(
  db: MockFirestoreDatabase,
  uid: string,
  generationId: string,
  cost: number,
  model: string,
  reason: string
): Promise<{ refunded: boolean; skippedDuplicate?: boolean }> {
  const userRef = db.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const refundTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-refund`);

  try {
    return await db.runTransaction(async (t) => {
      const existingRefund = await t.get(refundTxRef);
      if (existingRefund.exists) {
        return { refunded: false, skippedDuplicate: true };
      }

      const userDoc = await t.get(userRef);
      const data = userDoc.exists ? userDoc.data() : {};
      const currentCredits = typeof data?.credits === 'number' ? data.credits : 0;
      const currentCount = typeof data?.videosCreatedCount === 'number' ? data.videosCreatedCount : 1;

      t.update(userRef, {
        credits: currentCredits + cost,
        videosCreatedCount: Math.max(0, currentCount - 1),
        updatedAt: new Date().toISOString(),
      });

      t.set(refundTxRef, {
        amount: cost,
        type: 'generation_refund',
        balanceAfter: currentCredits + cost,
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
  } catch (err) {
    return { refunded: false };
  }
}

// Simulated /api/video-status handler matching server.ts
async function simulateVideoStatusHandler(
  db: MockFirestoreDatabase,
  authenticatedUid: string,
  operationName: string,
  mockVeoResult: { done: boolean; error?: { message: string } | null; metadata?: any }
): Promise<{ status: number; body: any }> {
  if (!operationName) {
    return { status: 400, body: { error: 'Missing operationName in request' } };
  }

  // Ownership Verification
  const opDocRef = db.collection('operations').doc(encodeURIComponent(operationName));
  const opDoc = await opDocRef.get();

  let generationId: string | null = null;

  if (opDoc.exists) {
    const opData = opDoc.data();
    if (opData?.userId !== authenticatedUid) {
      return { status: 403, body: { error: 'Forbidden: You do not have permission to check this operation.' } };
    }
    generationId = opData?.generationId || null;
  } else {
    // Fallback in user generations
    const userGenRef = db.collection('users').doc(authenticatedUid).collection('generations').doc(operationName);
    const userGen = await userGenRef.get();
    if (!userGen.exists) {
      return { status: 403, body: { error: 'Forbidden: You do not have permission to check this operation.' } };
    }
    generationId = userGen.data()?.id || operationName;
  }

  // Evaluate Veo Result
  const hasError = Boolean(mockVeoResult.error);
  let refundInfo: { refunded: boolean; skippedDuplicate?: boolean } = { refunded: false };

  if (hasError && generationId) {
    const genRef = db.collection('users').doc(authenticatedUid).collection('generations').doc(generationId);
    const genSnap = await genRef.get();
    const genData = genSnap.exists ? genSnap.data() : null;
    const cost = typeof genData?.cost === 'number' ? genData.cost : 15;
    const model = genData?.modelUsed || 'veo-3.1-fast-generate-preview';
    const reason = mockVeoResult.error?.message || 'Veo video rendering failed';

    refundInfo = await simulateRefundCredits(db, authenticatedUid, generationId, cost, model, reason);
  } else if (mockVeoResult.done && !hasError && generationId) {
    const genRef = db.collection('users').doc(authenticatedUid).collection('generations').doc(generationId);
    await genRef.update({
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    status: 200,
    body: {
      done: Boolean(mockVeoResult.done),
      error: mockVeoResult.error || null,
      metadata: mockVeoResult.metadata || null,
      refunded: Boolean(refundInfo.refunded || refundInfo.skippedDuplicate),
    },
  };
}

// Test Runner
async function runAllTests() {
  console.log('=== TEST SUITE: /api/video-status AUTOMATIC ASYNC REFUND ===\n');

  // TEST A: Veo-Generation schlägt später fehl → Credits werden einmal erstattet
  {
    console.log('TEST A: Veo-Operation schlägt während des Renderings fehl...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-a';
    const genId = 'gen-test-a-123';
    const opName = 'projects/oneclipai/operations/veo-op-991';

    // Seed initial user with 25 credits (after paying 15 for generation)
    db.setRaw(`users/${uid}`, {
      email: 'a@example.com',
      credits: 25,
      videosCreatedCount: 1,
    });
    db.setRaw(`users/${uid}/generations/${genId}`, {
      id: genId,
      userId: uid,
      cost: 15,
      status: 'processing',
      modelUsed: 'veo-3.1-fast-generate-preview',
    });
    db.setRaw(`operations/${encodeURIComponent(opName)}`, {
      operationName: opName,
      userId: uid,
      generationId: genId,
    });

    // Simulate Veo returning an asynchronous rendering error
    const res = await simulateVideoStatusHandler(db, uid, opName, {
      done: true,
      error: { message: 'Safety check triggered on video generation' },
    });

    assert.strictEqual(res.status, 200, 'Status endpoint must return 200 OK');
    assert.strictEqual(res.body.done, true, 'Operation must be marked done');
    assert.strictEqual(res.body.refunded, true, 'Response must indicate refunded: true');

    const updatedUser = db.getRaw(`users/${uid}`);
    assert.strictEqual(updatedUser.credits, 40, 'User credits must be restored from 25 to 40 (+15)');
    assert.strictEqual(updatedUser.videosCreatedCount, 0, 'Video count must be decremented');

    const refundLedger = db.getRaw(`users/${uid}/creditTransactions/tx-${genId}-refund`);
    assert.ok(refundLedger, 'Refund ledger entry must exist');
    assert.strictEqual(refundLedger.amount, 15, 'Refund amount must be 15');
    assert.strictEqual(refundLedger.type, 'generation_refund');

    const updatedGen = db.getRaw(`users/${uid}/generations/${genId}`);
    assert.strictEqual(updatedGen.status, 'failed');
    assert.strictEqual(updatedGen.refunded, true);

    console.log('  -> PASS: Credits correctly restored from 25 to 40 and ledger created.');
  }

  // TEST B: Status wird mehrfach nach dem Fehler abgefragt → keine mehrfachen Refunds
  {
    console.log('\nTEST B: 10 weitere Status-Abfragen nach dem Fehler (Idempotenz)...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-b';
    const genId = 'gen-test-b-456';
    const opName = 'projects/oneclipai/operations/veo-op-992';

    db.setRaw(`users/${uid}`, { credits: 20, videosCreatedCount: 1 });
    db.setRaw(`users/${uid}/generations/${genId}`, {
      id: genId,
      userId: uid,
      cost: 10,
      status: 'processing',
    });
    db.setRaw(`operations/${encodeURIComponent(opName)}`, {
      operationName: opName,
      userId: uid,
      generationId: genId,
    });

    // 1st Call: Error triggers refund
    const firstRes = await simulateVideoStatusHandler(db, uid, opName, {
      done: true,
      error: { message: 'Quota exceeded' },
    });
    assert.strictEqual(firstRes.body.refunded, true);
    assert.strictEqual(db.getRaw(`users/${uid}`).credits, 30, 'Credits must be 30 after 1st refund');

    // 10 subsequent status polls
    for (let i = 1; i <= 10; i++) {
      const subRes = await simulateVideoStatusHandler(db, uid, opName, {
        done: true,
        error: { message: 'Quota exceeded' },
      });
      assert.strictEqual(subRes.status, 200);
      assert.strictEqual(db.getRaw(`users/${uid}`).credits, 30, `Credits must stay strictly 30 on call #${i + 1}`);
    }

    console.log('  -> PASS: 10 repeated polls preserved credits = 30 without any duplicate refund.');
  }

  // TEST C: Erfolgreiche Generation → kein Refund
  {
    console.log('\nTEST C: Erfolgreiche Veo-Operation (done: true, error: null)...');
    const db = new MockFirestoreDatabase();
    const uid = 'user-test-c';
    const genId = 'gen-test-c-789';
    const opName = 'projects/oneclipai/operations/veo-op-993';

    db.setRaw(`users/${uid}`, { credits: 15, videosCreatedCount: 1 });
    db.setRaw(`users/${uid}/generations/${genId}`, {
      id: genId,
      userId: uid,
      cost: 15,
      status: 'processing',
    });
    db.setRaw(`operations/${encodeURIComponent(opName)}`, {
      operationName: opName,
      userId: uid,
      generationId: genId,
    });

    const successRes = await simulateVideoStatusHandler(db, uid, opName, {
      done: true,
      error: null,
      metadata: { progress: '100%' },
    });

    assert.strictEqual(successRes.status, 200);
    assert.strictEqual(successRes.body.done, true);
    assert.strictEqual(successRes.body.refunded, false, 'Refund must be false on success');

    const userDoc = db.getRaw(`users/${uid}`);
    assert.strictEqual(userDoc.credits, 15, 'Credits must remain 15 (no refund)');

    const refundDoc = db.getRaw(`users/${uid}/creditTransactions/tx-${genId}-refund`);
    assert.strictEqual(refundDoc, undefined, 'No refund transaction must exist');

    const genDoc = db.getRaw(`users/${uid}/generations/${genId}`);
    assert.strictEqual(genDoc.status, 'completed', 'Generation status must be updated to completed');

    console.log('  -> PASS: Successful generation completed with no refund and credits intact.');
  }

  // TEST D: User A versucht Status/Refund von User B auszulösen → blockiert
  {
    console.log('\nTEST D: User A versucht Operation von User B abzufragen...');
    const db = new MockFirestoreDatabase();
    const userA = 'user-attacker-a';
    const userB = 'user-victim-b';
    const genIdB = 'gen-victim-b-111';
    const opNameB = 'projects/oneclipai/operations/veo-op-victim';

    db.setRaw(`users/${userA}`, { credits: 5 });
    db.setRaw(`users/${userB}`, { credits: 10 });

    db.setRaw(`users/${userB}/generations/${genIdB}`, {
      id: genIdB,
      userId: userB,
      cost: 10,
      status: 'processing',
    });
    db.setRaw(`operations/${encodeURIComponent(opNameB)}`, {
      operationName: opNameB,
      userId: userB,
      generationId: genIdB,
    });

    // User A calls status for User B's operation
    const attackRes = await simulateVideoStatusHandler(db, userA, opNameB, {
      done: true,
      error: { message: 'Forced error attempt' },
    });

    assert.strictEqual(attackRes.status, 403, 'Must return 403 Forbidden');
    assert.ok(attackRes.body.error.includes('Forbidden'), 'Error must specify Forbidden');

    // Verify neither user credits were altered
    assert.strictEqual(db.getRaw(`users/${userA}`).credits, 5, "Attacker credits must remain 5");
    assert.strictEqual(db.getRaw(`users/${userB}`).credits, 10, "Victim credits must remain 10");

    const refundDoc = db.getRaw(`users/${userB}/creditTransactions/tx-${genIdB}-refund`);
    assert.strictEqual(refundDoc, undefined, 'No refund must be triggered by unauthorized user');

    console.log('  -> PASS: Unauthorized cross-user status poll strictly rejected with HTTP 403.');
  }

  console.log('\n=== ALL TESTS A - D PASSED SUCCESSFULLY ===');
}

runAllTests().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
