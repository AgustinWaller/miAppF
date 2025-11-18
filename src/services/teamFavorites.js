import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";

const COUNTERS_COLLECTION = "teamFavorites";

export async function setTeamFavorite({ teamId, userId, divisionId, favorite }) {
  if (!teamId || !userId) return;
  const voteDoc = doc(db, COUNTERS_COLLECTION, teamId, "votes", userId);
  const counterDoc = doc(db, COUNTERS_COLLECTION, teamId);
  const existing = await getDoc(voteDoc);

  if (favorite) {
    if (existing.exists()) return;
    await setDoc(voteDoc, { userId, teamId, divisionId, createdAt: serverTimestamp() });
    await setDoc(
      counterDoc,
      { count: increment(1), divisionId, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } else {
    if (!existing.exists()) return;
    await deleteDoc(voteDoc);
    await setDoc(
      counterDoc,
      { count: increment(-1), divisionId, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

export async function getTeamFavorites() {
  const snap = await getDocs(collection(db, COUNTERS_COLLECTION));
  return snap.docs
    .map((d) => {
      const data = d.data() || {};
      return {
        teamId: d.id,
        divisionId: data.divisionId || "",
        count: Math.max(Number(data.count || 0), 0),
      };
    })
    .sort((a, b) => b.count - a.count);
}

