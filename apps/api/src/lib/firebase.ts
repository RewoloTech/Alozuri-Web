import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
function firebase() {
  return (
    getApps()[0] ??
    initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT })
  );
}
export const database = () => getFirestore(firebase());
export const verifyToken = async (token: string) => {
  const decoded = await getAuth(firebase()).verifyIdToken(token, true);
  return {
    uid: decoded.uid,
    verified: decoded.email_verified === true,
    admin: decoded.admin === true,
  };
};
