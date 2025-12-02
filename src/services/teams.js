import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { TEAMS_MAP } from "../data/teamsMap";

const normalizeKey = (value) => {
  const raw = String(value || "");
  if (typeof raw.normalize === "function") {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  return raw.toLowerCase();
};

const fallbackTeamName = (teamId, currentName = "") => {
  const normalized = normalizeKey(teamId);
  if (currentName && currentName.trim()) return currentName.trim();
  return (
    TEAMS_MAP[normalized] ||
    TEAMS_MAP[teamId] ||
    teamId ||
    "Equipo"
  );
};

function normalizeTeam(raw, id) {
  const r = { id, ...raw };

  return {
    id,
    divisionId:
      r.divisionId ||
      r.divisionalId ||
      r.division ||
      "A",

    name: fallbackTeamName(
      id,
      r.name ||
        r.nombre ||
        r.teamName ||
        r.Nombre ||
        r.nombreEquipo ||
        ""
    ),

    shortName:
      r.shortName ||
      r.sigla ||
      r.name ||
      "",

    logoUrl:
      r.logoURL ||
      r.logoUrl ||
      r.logo ||
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/2000px-No_image_available.svg.png",
  };
}


/** Equipos por división (A/B), ordenados por nombre. */


export async function getTeamsByDivision(divisionId = "A") {
  const q = query(
    collection(db, "teams"),
    where("divisionId", "==", divisionId)
  );

  const snap = await getDocs(q);

  const teams = snap.docs.map(d => normalizeTeam(d.data(), d.id));

  return teams.sort((a, b) => a.name.localeCompare(b.name));
}
