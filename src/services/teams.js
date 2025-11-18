import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

function normalizeTeam(raw, id) {
  const r = { id, ...raw };
  return {
    ...r,
    divisionId: r.divisionId || r.divisionalId || r.division || "A",
    name: r.name || r.nombre || "",
    shortName: r.shortName || r.sigla || "",
    logoUrl: r.logoUrl || r.logoURL || r.logo || "",
  };
}

/** Equipos por división (A/B), ordenados por nombre. */
export async function getTeamsByDivision(divisionId = "A") {
  const snap = await getDocs(collection(db, "teams"));
  const all = snap.docs.map(d => normalizeTeam(d.data(), d.id));
  return all
    .filter(t => (t.divisionId || "A") === divisionId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
