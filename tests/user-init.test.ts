import assert from 'node:assert';

// Concurrency & Transaction Simulator for Firestore Admin SDK
// Models Firestore's serialized transaction isolation / optimistic concurrency control
class MockFirestoreDatabase {
  private data = new Map<string, any>();
  private version = new Map<string, number>();

  doc(path: string) {
    return {
      path,
      collection: (sub: string) => ({
        doc: (id: string) => this.doc(`${path}/${sub}/${id}`),
      }),
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
        // Conflict occurred -> retry with jitter
        await new Promise((r) => setTimeout(r, Math.random() * 20 + 5));
      } catch (err) {
        throw err;
      }
    }
    throw new Error('Transaction failed: exceeded maximum retries due to contention');
  }

  getRaw(path: string) {
    return this.data.get(path);
  }

  setRaw(path: string, val: any) {
    this.data.set(path, val);
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
        return false; // Conflict!
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
      const merged = { ...existing, ...patch };
      this.globalData.set(path, merged);
      this.globalVersion.set(path, (this.globalVersion.get(path) || 0) + 1);
    }

    return true;
  }
}

// Transactional User Init Implementation logic under test (matching server.ts)
async function simulateEnsureUserDoc(
  db: MockFirestoreDatabase,
  uid: string,
  email?: string,
  displayName?: string
) {
  const userRef = db.collection('users').doc(uid);

  return await db.runTransaction(async (t) => {
    const userSnap = await t.get(userRef);

    // If user profile already exists -> return immediately unchanged. Never alter or overwrite existing credits!
    if (userSnap.exists) {
      return userSnap.data();
    }

    // New user profile: initialize with 0 credits, standard profile fields, and no signup bonus
    const initialUserData = {
      displayName: displayName || email?.split('@')[0] || 'Creator',
      email: email || '',
      credits: 0,
      plan: 'creator',
      videosCreatedCount: 0,
      estimatedViews: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    t.set(userRef, initialUserData);
    return initialUserData;
  });
}

// Test Runner
async function runAllTests() {
  console.log('=== RUNNING TESTS A - E (USER-INIT & 0 STARTER CREDITS) ===\n');

  // TEST A: Neuer Nutzer registriert sich und /api/user-init läuft. Erwartung: credits = 0.
  {
    console.log('TEST A: Neuer Nutzer registriert sich...');
    const db = new MockFirestoreDatabase();
    const uid = 'new-user-test-a';

    const result = await simulateEnsureUserDoc(db, uid, 'user_a@example.com', 'User A');
    const userDoc = db.getRaw(`users/${uid}`);

    assert.strictEqual(userDoc.credits, 0, 'User doc must have 0 credits');
    assert.strictEqual(result.credits, 0, 'Returned user must have 0 credits');
    assert.strictEqual(userDoc.signupBonusGranted, undefined, 'signupBonusGranted must NOT exist');
    const ledgerDoc = db.getRaw(`users/${uid}/creditTransactions/signup_bonus`);
    assert.strictEqual(ledgerDoc, undefined, 'No signup bonus ledger entry must exist');
    console.log('  -> PASS: User initialized with credits = 0, no bonus, no ledger entry.');
  }

  // TEST B: Derselbe neue Nutzer ruft /api/user-init mehrfach auf. Erwartung: weiterhin credits = 0.
  {
    console.log('\nTEST B: Derselbe neue Nutzer ruft /api/user-init 3x sequentiell auf...');
    const db = new MockFirestoreDatabase();
    const uid = 'new-user-test-b';

    await simulateEnsureUserDoc(db, uid, 'user_b@example.com', 'User B');
    await simulateEnsureUserDoc(db, uid, 'user_b@example.com', 'User B');
    const result3 = await simulateEnsureUserDoc(db, uid, 'user_b@example.com', 'User B');
    const userDoc = db.getRaw(`users/${uid}`);

    assert.strictEqual(userDoc.credits, 0, 'User doc credits must remain 0');
    assert.strictEqual(result3.credits, 0, 'Result credits must remain 0');
    console.log('  -> PASS: Multiple calls remain strictly idempotent at credits = 0.');
  }

  // TEST C: 5 parallele /api/user-init Requests. Erwartung: weiterhin credits = 0, keine Credit-Transaktion.
  {
    console.log('\nTEST C: 5 parallele /api/user-init Requests...');
    const db = new MockFirestoreDatabase();
    const uid = 'concurrent-user-test-c';

    const promises = Array.from({ length: 5 }, () =>
      simulateEnsureUserDoc(db, uid, 'user_c@example.com', 'User C')
    );
    const results = await Promise.all(promises);
    const userDoc = db.getRaw(`users/${uid}`);

    assert.strictEqual(userDoc.credits, 0, 'User credits must be 0');
    results.forEach((r, idx) => {
      assert.strictEqual(r.credits, 0, `Caller ${idx + 1} must see 0 credits`);
    });
    const ledgerDoc = db.getRaw(`users/${uid}/creditTransactions/signup_bonus`);
    assert.strictEqual(ledgerDoc, undefined, 'No ledger entry created');
    console.log('  -> PASS: 5 concurrent requests all resolved safely with credits = 0 and 0 transactions.');
  }

  // TEST D: Bestehender Nutzer hat credits = 40. Nach /api/user-init: Erwartung: weiterhin exakt 40.
  {
    console.log('\nTEST D: Bestehender Nutzer mit credits = 40 ruft user-init auf...');
    const db = new MockFirestoreDatabase();
    const uid = 'existing-user-test-d';

    db.setRaw(`users/${uid}`, {
      displayName: 'Existing 40 Credits User',
      email: 'user_d@example.com',
      credits: 40,
      plan: 'creator',
      videosCreatedCount: 5,
    });

    const result = await simulateEnsureUserDoc(db, uid, 'user_d@example.com', 'Existing 40 Credits User');
    const userDoc = db.getRaw(`users/${uid}`);

    assert.strictEqual(userDoc.credits, 40, 'Credits must remain exactly 40');
    assert.strictEqual(result.credits, 40, 'Returned credits must be exactly 40');
    console.log('  -> PASS: Existing user credits (40) were completely preserved.');
  }

  // TEST E: Bestehender Legacy-Nutzer besitzt einen alten signup_bonus- oder tx-welcome-bonus-Eintrag.
  // Erwartung: vorhandener Creditstand bleibt unverändert. Es wird kein neuer Bonus vergeben.
  {
    console.log('\nTEST E: Bestehender Legacy-Nutzer mit altem signup_bonus Ledger-Eintrag...');
    const db = new MockFirestoreDatabase();
    const uid = 'legacy-user-test-e';

    db.setRaw(`users/${uid}`, {
      displayName: 'Legacy User',
      email: 'user_e@example.com',
      credits: 80,
      plan: 'creator',
      videosCreatedCount: 2,
    });
    db.setRaw(`users/${uid}/creditTransactions/signup_bonus`, {
      amount: 120,
      type: 'signup_bonus',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    db.setRaw(`users/${uid}/creditTransactions/tx-welcome-bonus`, {
      amount: 120,
      type: 'signup_bonus',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await simulateEnsureUserDoc(db, uid, 'user_e@example.com', 'Legacy User');
    const userDoc = db.getRaw(`users/${uid}`);

    assert.strictEqual(userDoc.credits, 80, 'Credits must remain 80');
    assert.strictEqual(result.credits, 80, 'Result credits must remain 80');
    console.log('  -> PASS: Legacy user with historical bonus records preserved credits = 80.');
  }

  console.log('\n=== ALL TESTS A - E PASSED SUCCESSFULLY ===');
}

runAllTests().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
