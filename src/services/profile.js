import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "./firebase";

const COLLECTION = "profiles";

const profileDoc = (uid) => doc(db, COLLECTION, uid);

export async function fetchProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(profileDoc(uid));
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

export function listenProfile(uid, cb) {
  if (!uid) return () => {};
  return onSnapshot(
    profileDoc(uid),
    (snap) => cb(snap.exists() ? { id: uid, ...snap.data() } : null),
    () => cb(null)
  );
}

export async function saveProfile(uid, payload) {
  if (!uid) throw new Error("UID requerido");
  await setDoc(
    profileDoc(uid),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function uploadProfilePhoto(uid, localUri) {
  if (!uid || !localUri) return null;
  const storageRef = ref(storage, `profiles/${uid}.jpg`);
  try {
    console.log("upload start", uid, localUri);
    const response = await fetch(localUri);
    const blob = await response.blob();
    console.log("upload blob", { size: blob.size, type: blob.type });
    await uploadBytes(storageRef, blob, {
      contentType: blob.type || "image/jpeg",
    });
    return getDownloadURL(storageRef);
  } catch (err) {
    console.log(
      "storage error",
      err?.code,
      err?.message,
      err?.customData?.serverResponse || ""
    );
    throw err;
  }
}
