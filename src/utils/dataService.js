import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { parseCSV } from './csv';

let cache = null;

export async function loadData() {
  if (cache) return cache;
  const [news, teams, players, matches] = await Promise.all([
    loadCsvAsset(require('../data/news.csv')),
    loadCsvAsset(require('../data/teams.csv')),
    loadCsvAsset(require('../data/players.csv')),
    loadCsvAsset(require('../data/matches.csv')),
  ]);

  // Normalize
  const byDiv = { A: {}, B: {} };
  ['A', 'B'].forEach(d => {
    byDiv[d].news = news.filter(r => r.division === d);
    byDiv[d].teams = teams.filter(r => r.division === d).map(t => ({ id: t.team_id, nombre: t.name }));
    byDiv[d].players = players.filter(r => r.division === d).map(p => ({ id: p.player_id, equipoId: p.team_id, nombre: p.name, foto: p.photo_url || '' }));
    byDiv[d].matches = matches.filter(r => r.division === d).map(m => ({
      id: m.match_id,
      fechaNumero: Number(m.fecha_numero || 0),
      fechaCalendario: m.date_iso || '',
      localId: m.local_id,
      visitanteId: m.visitante_id,
      golesLocal: Number(m.goles_local || 0),
      golesVisitante: Number(m.goles_visitante || 0),
      eventos: safeJson(m.eventos) || [],
    }));
  });

  cache = byDiv;
  return cache;
}

export async function getDivision(d) {
  const data = await loadData();
  const key = d === 'B' ? 'B' : 'A';
  return data[key];
}

export async function getNews(d) {
  const div = await getDivision(d);
  return div.news;
}

function safeJson(s) {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

async function loadCsvAsset(moduleRef) {
  const asset = Asset.fromModule(moduleRef);
  if (!asset.localUri) await asset.downloadAsync();
  const text = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.UTF8 });
  return parseCSV(text, { delimiter: ';', headers: true });
}

