// src/services/matches.js
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

function normalizeMatch(raw, id) {
  const r = { id, ...raw };
  const dateIso = r.dateIso || r.date_iso || r.fechaCalendario || r.fecha || null;
  const divisionId = r.divisionId || r.divisionalId || r.division || null;
  const localId = r.localId || r.local || r.homeId || r.home || "";
  const visitanteId = r.visitanteId || r.visitante || r.awayId || r.away || "";
  const localName = r.localName || r.local || r.homeName || "";
  const visitanteName = r.visitanteName || r.visitante || r.awayName || "";
  const golesLocal = typeof r.golesLocal === "number" ? r.golesLocal : Number(r.gl ?? 0);
  const golesVisitante = typeof r.golesVisitante === "number" ? r.golesVisitante : Number(r.gv ?? 0);
  const eventos = Array.isArray(r.eventos) ? r.eventos : [];
  const fechaNumero = r.fechaNumero ?? r.round ?? null;
  return {
    ...r,
    divisionId,
    dateIso,
    localId,
    visitanteId,
    localName,
    visitanteName,
    golesLocal,
    golesVisitante,
    eventos,
    fechaNumero,
  };
}

export async function getMatchesByDivision(divisionId = "A", { order = "asc" } = {}) {
  const snap = await getDocs(collection(db, "matches"));
  const all = snap.docs.map(d => normalizeMatch(d.data(), d.id));
  const filtered = all.filter(m => (m.divisionId || "A") === divisionId);
  return filtered.sort((a, b) => String(a.dateIso).localeCompare(String(b.dateIso)) * (order === "desc" ? -1 : 1));
}
