import Constants from "expo-constants";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const extraFirebase = Constants?.expoConfig?.extra?.firebase ?? {};

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || extraFirebase.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || extraFirebase.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || extraFirebase.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || extraFirebase.storageBucket,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || extraFirebase.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || extraFirebase.appId,
};

if (!firebaseConfig.projectId) {
  console.warn(
    "[firebase] Configuración incompleta. Define EXPO_PUBLIC_FIREBASE_* o configúralas en app.config.js."
  );
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
