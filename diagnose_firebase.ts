
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, 'src/firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const auth = getAuth();
const db = getFirestore();

async function diagnose() {
  console.log('--- DIAGNOSE START ---');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Firestore Database ID:', firebaseConfig.firestoreDatabaseId || '(default)');

  // 1. Check Auth Users
  try {
    const listUsersResult = await auth.listUsers(1000);
    console.log('Auth Users Count:', listUsersResult.users.length);
    if (listUsersResult.users.length > 0) {
       console.log('First User UID (example):', listUsersResult.users[0].uid);
    }
  } catch (err: any) {
    console.error('Auth listUsers Error:', err.message);
    if (err.code) console.error('Error Code:', err.code);
  }

  // 2. Check Firestore Users
  try {
    const usersSnap = await db.collection('users').get();
    console.log('Firestore Users Document Count:', usersSnap.size);
  } catch (err: any) {
    console.error('Firestore get Error:', err.message);
  }

  // 3. Check Admin Claims for specific user
  const adminEmail = 'veyro.ai01@gmail.com';
  try {
    const userRecord = await auth.getUserByEmail(adminEmail);
    console.log(`User ${adminEmail} found. UID:`, userRecord.uid);
    console.log(`Custom Claims for ${adminEmail}:`, JSON.stringify(userRecord.customClaims || {}));
  } catch (err: any) {
    console.error(`Error checking user ${adminEmail}:`, err.message);
  }

  console.log('--- DIAGNOSE END ---');
}

diagnose();
