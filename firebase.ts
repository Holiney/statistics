import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDmEP8AhvxIAlRnvbDJQCSs7NDnMtB3psc",
  authDomain: "work-stats-88ddb.firebaseapp.com",
  projectId: "work-stats-88ddb",
  storageBucket: "work-stats-88ddb.firebasestorage.app",
  messagingSenderId: "462860980662",
  appId: "1:462860980662:web:52539d9fd09ac60208f117",
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
