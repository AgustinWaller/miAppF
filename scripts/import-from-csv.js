/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const admin = require("firebase-admin");

const DATA_DIR = path.resolve(__dirname, "../src/data");

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT
  ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT)
  : path.resolve(__dirname, "../serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("No se encontró el serviceAccountKey.json");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

const db = admin.firestore();

async function clearCollection(collectionName) {
  console.log(`>> Borrando colección ${collectionName}...`);
  const batchSize = 300;

  async function deleteBatch() {
    const snapshot = await db.collection(collectionName).limit(batchSize).get();
    if (snapshot.empty) return false;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return true;
  }

  while (await deleteBatch()) {
    // continue
  }
  console.log(`>> Colección ${collectionName} borrada.`);
}

function readCsv(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`No se encontró ${fileName}, se omite.`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8");
  const { data } = Papa.parse(content, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
  });

  return data.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const firstValue = Object.values(row).find((value) => {
      const text = (value ?? "").toString().trim();
      return text.length > 0;
    });
    if (!firstValue) return true;
    return !firstValue.toString().trim().startsWith("#");
  });
}

function toNumber(value) {
  if (!value) return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

async function importTeams() {
  const rows = readCsv("teams.csv");
  console.log(`Importando ${rows.length} equipos...`);
  for (const row of rows) {
    const id = (row.team_id || row.id || "").trim();
    if (!id) continue;
    await db.collection("teams").doc(id).set({
      divisionId: (row.division || "").trim(),
      name: (row.name || "").trim(),
    });
  }
}

async function importPlayers() {
  const rows = readCsv("players.csv");
  console.log(`Importando ${rows.length} jugadores...`);
  for (const row of rows) {
    const id = (row.player_id || row.id || "").trim();
    if (!id) continue;
    await db.collection("players").doc(id).set({
      divisionId: (row.division || "").trim(),
      teamId: (row.team_id || "").trim(),
      name: (row.name || "").trim(),
      teamName: (row.team_name || "").trim(),
      photoUrl: (row.photo_url || "").trim(),
    });
  }
}

async function importNews() {
  const rows = readCsv("news.csv");
  console.log(`Importando ${rows.length} noticias...`);
  for (const row of rows) {
    const id =
      (row.news_id ||
        row.id ||
        `${row.division || "x"}_${row.date_iso}`)?.replace(/\s+/g, "_");

    await db.collection("news").doc(id).set({
      divisionId: (row.division || "").trim(),
      teamId: (row.team_id || row.teamId || "").trim(),
      dateIso: (row.date_iso || "").trim(),
      title: (row.title || "").trim(),
      body: (row.body || "").trim(),
      imageUrl: (row.image_url || "").trim(),
    });
  }
}

async function importMatches() {
  const rows = readCsv("matches.csv");
  console.log(`Importando ${rows.length} partidos...`);
  for (const row of rows) {
    const id = (row.match_id || row.id || "").trim();
    if (!id) continue;

    let events = [];
    try {
      if (row.eventos) events = JSON.parse(row.eventos);
    } catch {
      events = [];
    }

    await db.collection("matches").doc(id).set({
      divisionId: (row.division || "").trim(),
      dateIso: (row.date_iso || "").trim(),
      fechaNumero: toNumber(row.fecha_numero),
      localId: (row.local_id || "").trim(),
      visitanteId: (row.visitante_id || "").trim(),
      golesLocal: toNumber(row.goles_local),
      golesVisitante: toNumber(row.goles_visitante),
      eventos: Array.isArray(events) ? events : [],
    });
  }
}

async function main() {
  await clearCollection("news");
  await clearCollection("matches");
  // === BLOQUE TEMPORAL: limpiar jugadores antes de reimportar ===
  await clearCollection("players");

  await importTeams();
  await importPlayers();
  await importNews();
  await importMatches();

  console.log("Importación completa.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error general", err);
  process.exit(1);
});
