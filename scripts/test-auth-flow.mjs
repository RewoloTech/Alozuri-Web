import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, sendEmailVerification, applyActionCode, sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset, signOut, signInWithEmailAndPassword, getIdTokenResult, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099', 'Run only through the local Auth emulator.');
const app=initializeApp({apiKey:'demo-api-key',projectId:'demo-voyaspan',authDomain:'demo-voyaspan.firebaseapp.com'});
const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const codes=async()=>{const r=await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-voyaspan/oobCodes');return (await r.json()).oobCodes||[];};
try {
 const email='email-flow@example.test';const {user}=await createUserWithEmailAndPassword(auth,email,'OriginalPassword123!');
 assert.equal(user.emailVerified,false);assert.equal((await getIdTokenResult(user,true)).claims.email_verified,false);
 await sendEmailVerification(user,{url:'http://localhost:3000/verify-email'});
 const verify=(await codes()).find(c=>c.email===email&&c.requestType==='VERIFY_EMAIL');assert.ok(verify);
 await applyActionCode(auth,verify.oobCode);await user.reload();assert.equal((await getIdTokenResult(user,true)).claims.email_verified,true);
 await sendPasswordResetEmail(auth,email,{url:'http://localhost:3000/login'});
 const reset=(await codes()).find(c=>c.email===email&&c.requestType==='PASSWORD_RESET');assert.ok(reset);
 assert.equal(await verifyPasswordResetCode(auth,reset.oobCode),email);
 await confirmPasswordReset(auth,reset.oobCode,'ReplacementPassword123!');await signOut(auth);
 await assert.rejects(signInWithEmailAndPassword(auth,email,'OriginalPassword123!'));
 const signedIn=await signInWithEmailAndPassword(auth,email,'ReplacementPassword123!');assert.equal(signedIn.user.emailVerified,true);
 await assert.rejects(confirmPasswordReset(auth,reset.oobCode,'AnotherPassword123!'));
 await signOut(auth);
 const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const googleToken=encode({alg:'none',typ:'JWT'})+'.'+encode({sub:'google-test-user',email:'google-flow@example.test',email_verified:true,iss:'https://accounts.google.com',aud:'demo-client',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})+'.';
 const google=await signInWithCredential(auth,GoogleAuthProvider.credential(googleToken));assert.equal(google.user.emailVerified,true);assert.equal((await getIdTokenResult(google.user,true)).claims.email_verified,true);
 console.log('Auth emulator passed: signup unverified; verification email/code; verified ID token; reset email/code; replacement password; rejected old password and reused reset code; Google sign-in verified without an extra email.');
}finally{await signOut(auth);await deleteApp(app);}
