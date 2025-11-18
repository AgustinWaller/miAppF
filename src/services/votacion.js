import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/** Votaciones abiertas de una división, ordenadas por fecha de cierre */
export async function getOpenVotacionesByDivision(divisionId = "A") {
  try {
    // Evitar índices compuestos: traemos por división o todo y filtramos
    const base = query(collection(db, "votacion"), where("divisionId", "==", divisionId));
    const snap = await getDocs(base);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return docs.filter(v => v.abierto === true).sort((a, b) => String(a.cierra || "").localeCompare(String(b.cierra || "")));
  } catch (e) {
    console.error("getOpenVotacionesByDivision error:", e);
    return [];
  }
}

/** Listener (RT) a la votación abierta (si existe) en una división. Devuelve unsubscribe. */
export function listenOpenVotacionByDivision(divisionId = "A", cb) {
  const q = query(collection(db, "votacion"), where("divisionId", "==", divisionId));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const open = docs.filter(v => v.abierto === true).sort((a,b) => String(a.cierra || "").localeCompare(String(b.cierra || "")));
    cb(open[0] || null);
  }, (err) => {
    console.error("listenOpenVotacionByDivision error:", err);
    cb(null);
  });
}

/** Listener (RT) de los votos de una votación. Devuelve unsubscribe. */
export function listenVotesForVotacion(votacionId, cb) {
  if (!votacionId) return () => {};
  const votesCol = collection(db, "votacion", String(votacionId), "votes");
  return onSnapshot(votesCol, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error("listenVotesForVotacion error:", err);
    cb([]);
  });
}
