import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

function normalizeNews(raw, id) {
  const r = { id, ...raw };
  return {
    ...r,
    divisionId: r.divisionId || r.divisionalId || r.division || "A",
    teamId: r.teamId || r.team_id || r.team || "",
    dateIso: r.dateIso || r.date_iso || r.fecha || null,
    title: r.title || r.titulo || "",
    body: r.body || r.descripcion || "",
    imageUrl: r.image_url || r.imageURL || r.imageUrl || r.image || "",
  };
}

/** Noticias por división (A/B), ordenadas por fecha (últimas primero). */
export async function getNewsByDivision(divisionId = "A") {
  const snap = await getDocs(collection(db, "news"));
  const all = snap.docs.map(d => normalizeNews(d.data(), d.id));
  return all
    .filter(n => (n.divisionId || "A") === divisionId)
    .sort((a, b) => String(b.dateIso).localeCompare(String(a.dateIso)));
}
