import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Beim Öffnen der Webapp soll kein Nutzer angemeldet sein:
// inMemory-Persistenz verwenden & vorhandene Cache-Sessions sofort abmelden
setPersistence(auth, inMemoryPersistence).catch((err) => {
  console.warn('Firebase inMemoryPersistence note:', err);
});
signOut(auth).catch((err) => {
  console.warn('Initial signOut note:', err);
});
