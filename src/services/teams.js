import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

function normalizeTeam(raw, id) {
  const r = { id, ...raw };

  return {
    id,
    divisionId:
      r.divisionId ||
      r.divisionalId ||
      r.division ||
      "A",

    name:
      r.name ||
      r.nombre ||
      r.teamName ||
      "Sin nombre",


    shortName:
      r.shortName ||
      r.sigla ||
      r.name ||
      "",

    // Usa en este orden:
    // 1. logoURL (lo que agregaste en Firestore)
    // 2. logoUrl
    // 3. logo
    // 4. imagen por defecto para evitar que rompa el render
    logoUrl:
      r.logoURL ||
      r.logoUrl ||
      r.logo ||
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/2000px-No_image_available.svg.png"
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
