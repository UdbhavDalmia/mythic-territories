import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBH4ou269wl4qEWsKqdl9a01ewNnuAbHdk",
  authDomain: "mythic-territories-game.firebaseapp.com",
  projectId: "mythic-territories-game",
  storageBucket: "mythic-territories-game.firebasestorage.app",
  messagingSenderId: "756860123760",
  appId: "1:756860123760:web:f3220ee8a61744a87cd2b5"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});

export const auth = getAuth(app);

// Authenticate anonymously in the background (zero friction, no credentials needed)
let cachedAuthUser = null;
let authPromise = null;

export async function getAuthUser() {
  if (cachedAuthUser) return cachedAuthUser;
  if (auth.currentUser) {
    cachedAuthUser = auth.currentUser;
    return cachedAuthUser;
  }
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const cred = await signInAnonymously(auth);
      cachedAuthUser = cred.user;
      return cachedAuthUser;
    } catch (err) {
      // If Anonymous Auth provider is not enabled yet in console, log informative notice without crashing
      console.info('[Mythic Auth] Anonymous Auth initializing or disabled in console:', err.code || err.message);
      return null;
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

export default app;
