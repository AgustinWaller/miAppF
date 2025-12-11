import {
  collection,
  collectionGroup,
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
  // 1) Leer contadores existentes
  const countersSnap = await getDocs(collection(db, COUNTERS_COLLECTION));
  const countersMap = new Map(
    countersSnap.docs.map((d) => [
      d.id,
      {
        teamId: d.id,
        divisionId: (d.data() || {}).divisionId || "",
        count: Math.max(Number((d.data() || {}).count || 0), 0),
      },
    ])
  );

  // 2) Recontar desde la subcoleccion votes (agarra votos aunque no exista el doc padre)
  const votesSnap = await getDocs(collectionGroup(db, "votes"));
  const recomputed = new Map();
  votesSnap.forEach((voteDoc) => {
    const data = voteDoc.data() || {};
    const teamId = data.teamId || data.team_id || "";
    if (!teamId) return;
    recomputed.set(teamId, (recomputed.get(teamId) || 0) + 1);
  });

  // 3) Mezclar resultados y persistir el contador real
  const results = [];
  for (const [teamId, votesCount] of recomputed.entries()) {
    const entry = countersMap.get(teamId) || { teamId, divisionId: "", count: 0 };
    const newCount = votesCount;
    results.push({ ...entry, count: newCount });
    try {
      await setDoc(
        doc(db, COUNTERS_COLLECTION, teamId),
        { count: newCount, divisionId: entry.divisionId, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {
      // ignore write errors
    }
  }

  // 4) Si algún contador existía pero no tiene votos, mantenerlo en la lista
  countersMap.forEach((entry, teamId) => {
    if (recomputed.has(teamId)) return;
    results.push(entry);
  });

  return results.sort((a, b) => b.count - a.count);
}
