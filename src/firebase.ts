import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

console.log('Firebase: Initializing app...');
const app = initializeApp(firebaseConfig);
console.log('Firebase: App initialized');
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
