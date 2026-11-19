/**
 * Mock Firebase and Firestore helpers for testing lazy loading and multiplayer synchronization
 */

export function createMockFirestore() {
  const store = new Map();

  const doc = (path) => ({
    id: path.split('/').pop(),
    path,
    get: async () => ({
      exists: () => store.has(path),
      data: () => store.get(path) || null,
      id: path.split('/').pop()
    }),
    set: async (data, opts = {}) => {
      if (opts.merge && store.has(path)) {
        store.set(path, { ...store.get(path), ...data });
      } else {
        store.set(path, { ...data });
      }
    },
    update: async (data) => {
      const existing = store.get(path) || {};
      store.set(path, { ...existing, ...data });
    },
    delete: async () => {
      store.delete(path);
    }
  });

  return {
    _store: store,
    doc,
    collection: (colPath) => ({
      path: colPath,
      doc: (id) => doc(`${colPath}/${id}`),
      where: () => ({
        get: async () => ({ docs: [], empty: true })
      })
    }),
    runTransaction: async (updateFn) => {
      const transaction = {
        get: async (docRef) => docRef.get(),
        set: (docRef, data, opts) => docRef.set(data, opts),
        update: (docRef, data) => docRef.update(data),
        delete: (docRef) => docRef.delete()
      };
      return await updateFn(transaction);
    }
  };
}

export function createMockAuth(initialUser = { uid: 'mock-test-uid-12345', isAnonymous: true }) {
  let currentUser = initialUser;
  return {
    currentUser,
    signInAnonymously: async () => {
      currentUser = { uid: 'anon-' + Math.random().toString(36).slice(2, 9), isAnonymous: true };
      return { user: currentUser };
    },
    onAuthStateChanged: (cb) => {
      cb(currentUser);
      return () => {};
    }
  };
}

let loadCount = 0;
export function trackFirebaseModuleLoads() {
  return {
    getLoadCount: () => loadCount,
    recordLoad: () => { loadCount++; },
    reset: () => { loadCount = 0; }
  };
}
