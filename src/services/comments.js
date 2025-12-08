import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const ROOT = "matchComments";

export function listenMatchComments(matchId, cb) {
  if (!matchId) return () => {};
  const q = query(
    collection(db, ROOT, String(matchId), "messages"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      cb(rows);
    },
    () => cb([])
  );
}

export async function addMatchComment({
  matchId,
  text,
  userId,
  displayName,
  email,
  photoUrl,
  division,
}) {
  if (!matchId || !text || !userId) {
    throw new Error("Faltan datos para comentar.");
  }
  const ref = collection(db, ROOT, String(matchId), "messages");
  await addDoc(ref, {
    body: text,
    userId,
    displayName,
    email,
    photoUrl: photoUrl || "",
    divisionId: division || "",
    createdAt: serverTimestamp(),
  });
}
