import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { TEAMS_MAP } from "../data/teamsMap";
import { TEAM_LOGOS } from "../data/teamLogos";
import { getClubLogo } from "../assets/images";

const trimValue = (value) => String(value ?? "").trim();
const normalizeLogoField = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  const text = String(value).trim();
  return text || null;
};

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

const resolveLogoUrl = (raw, id, name) => {
  const logoFromData =
    [
      raw.logoURL,
      raw.logoUrl,
      raw.logo_uri,
      raw.logoURI,
      raw.logo_url,
      raw.logo,
      raw.escudo,
      raw.escudoUrl,
      raw.escudoURL,
      raw.escudo_uri,
      raw.badge,
      raw.badgeUrl,
      raw.badgeURL,
      raw.imageUrl,
      raw.imageURL,
    ]
      .map(normalizeLogoField)
      .find(Boolean) || null;

  const normalizedId = normalizeKey(id);
  const normalizedName = normalizeKey(name);
  const compactId = normalizedId.replace(/[\s_-]+/g, "");
  const compactName = normalizedName.replace(/[\s_-]+/g, "");

  const localLogo =
    getClubLogo(normalizedId) ||
    getClubLogo(compactId) ||
    getClubLogo(id) ||
    getClubLogo(compactName);
  if (localLogo) return localLogo;

  if (logoFromData) return logoFromData;

  const mapped =
    TEAM_LOGOS[normalizedId] ||
    TEAM_LOGOS[normalizedName] ||
    TEAM_LOGOS[id] ||
    TEAM_LOGOS[trimValue(id)] ||
    null;

  if (mapped) return mapped;

  return null;
};

function normalizeTeam(raw, id) {
  const r = { id, ...raw };
  const name = fallbackTeamName(
    id,
    r.name ||
      r.nombre ||
      r.teamName ||
      r.Nombre ||
      r.nombreEquipo ||
      ""
  );

  return {
    id,
    divisionId:
      r.divisionId ||
      r.divisionalId ||
      r.division ||
      "A",

    name,

    shortName:
      r.shortName ||
      r.sigla ||
      r.name ||
      "",

    logoUrl: resolveLogoUrl(r, id, name),
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
