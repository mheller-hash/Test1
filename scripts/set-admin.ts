import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../src/firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('Error: firebase-applet-config.json not found at', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    projectId: config.projectId,
  });
}

const auth = getAuth();

async function setAdminClaim(targetUid?: string) {
  const uid = targetUid || process.argv[2] || 'WNCq0kNNYbeCLNAGS0TXPsMqfP02';
  if (!uid) {
    console.error('Usage: npx tsx scripts/set-admin.ts <FIREBASE_UID>');
    process.exit(1);
  }

  console.log(`Granting custom claim { admin: true } to UID: ${uid}...`);

  try {
    const user = await auth.getUser(uid);
    console.log(`Found user: ${user.email || 'No email'} (${user.uid})`);

    const existingClaims = user.customClaims || {};
    await auth.setCustomUserClaims(uid, {
      ...existingClaims,
      admin: true,
    });

    console.log(`SUCCESS: Custom claim { admin: true } successfully set for user ${user.email || uid}.`);
    console.log('User must re-authenticate or refresh their Firebase ID token to receive the claim.');
  } catch (error: any) {
    console.error(`ERROR setting custom claim for UID ${uid}:`, error.message || error);
    process.exit(1);
  }
}

setAdminClaim();
