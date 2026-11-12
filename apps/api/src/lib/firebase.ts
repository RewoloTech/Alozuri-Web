import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateToken } from './authentication.js';
function firebase() {
  return (
    getApps()[0] ??
    initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT })
  );
}
export const authDirectory = () => getAuth(firebase());
export const database = () => getFirestore(firebase());
export const verifyToken = (token: string) =>
  authenticateToken(token, getAuth(firebase()), process.env.ADMIN_OWNER_UID);
