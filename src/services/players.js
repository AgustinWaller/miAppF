import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

function normalizePlayer(raw, id) {
  const r = { id, ...raw };
  return {
    ...r,
    divisionId: r.divisionId || r.divisionalId || r.division || "A",
    name: r.name || r.nombre || r.displayName || "",
    teamId: r.teamId || r.equipoId || "",
    teamName: r.teamName || r.equipo || "",
    photoUrl: r.photoUrl || r.photoURL || r.foto || r.imageUrl || "",
  };
}

/** Trae jugadores por división con shape normalizado */
export async function getPlayersByDivision(divisionId = "A", { order = "asc" } = {}) {
  const snap = await getDocs(collection(db, "players"));
  const all = snap.docs.map(d => normalizePlayer(d.data(), d.id));
  const filtered = all.filter(p => (p.divisionId || "A") === divisionId);
  return filtered.sort((a, b) => a.name.localeCompare(b.name) * (order === "desc" ? -1 : 1));
}
