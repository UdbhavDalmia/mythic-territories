const firebaseConfig = {
  apiKey: "AIzaSyBH4ou269wl4qEWsKqdl9a01ewNnuAbHdk",
  authDomain: "mythic-territories-game.firebaseapp.com",
  projectId: "mythic-territories-game",
  storageBucket: "mythic-territories-game.firebasestorage.app",
  messagingSenderId: "756860123760",
  appId: "1:756860123760:web:f3220ee8a61744a87cd2b5"
};

let appInstance = null;
let dbInstance = null;
let authInstance = null;
let initPromise = null;

export async function getFirebaseServices() {
  if (dbInstance && authInstance) {
    return { app: appInstance, db: dbInstance, auth: authInstance };
  }
  if (!initPromise) {
    initPromise = (async () => {
      const [{ initializeApp, getApps, getApp }, { initializeFirestore }, { getAuth }] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
        import('firebase/auth')
      ]);
      appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      dbInstance = initializeFirestore(appInstance, { ignoreUndefinedProperties: true });
      authInstance = getAuth(appInstance);
      return { app: appInstance, db: dbInstance, auth: authInstance };
    })();
  }
  return initPromise;
}

export async function getDb() {
  const { db } = await getFirebaseServices();
  return db;
}

export async function getAuth() {
  const { auth } = await getFirebaseServices();
  return auth;
}

// Authenticate anonymously in the background (zero friction, no credentials needed)
let cachedAuthUser = null;
let authPromise = null;

export async function getAuthUser() {
  if (cachedAuthUser) return cachedAuthUser;
  const auth = await getAuth();
  if (auth.currentUser) {
    cachedAuthUser = auth.currentUser;
    return cachedAuthUser;
  }
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const { signInAnonymously } = await import('firebase/auth');
      const cred = await signInAnonymously(auth);
      cachedAuthUser = cred.user;
      return cachedAuthUser;
    } catch (err) {
      console.info('[Mythic Auth] Anonymous Auth initializing or disabled in console:', err.code || err.message);
      return null;
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

export default getFirebaseServices;
