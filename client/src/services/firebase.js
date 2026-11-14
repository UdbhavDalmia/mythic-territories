import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

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
export default app;
