import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";

const divisionCache = {};

export const loadDivisionData = async (divisionKey, { force = false } = {}) => {
  if (!divisionKey) throw new Error("divisionKey requerido");
  if (divisionCache[divisionKey] && !force) {
    return divisionCache[divisionKey];
  }

  const teamsQuery = query(
    collection(db, "teams"),
    where("divisionId", "==", divisionKey),
    orderBy("name")
  );
  const playersQuery = query(
    collection(db, "players"),
    where("divisionId", "==", divisionKey)
  );
  const matchesQuery = query(
    collection(db, "matches"),
    where("divisionId", "==", divisionKey),
    orderBy("fechaNumero"),
    orderBy("dateIso")
  );
  const newsQuery = query(
    collection(db, "news"),
    where("divisionId", "==", divisionKey),
    orderBy("dateIso", "desc")
  );
  const votacionesQuery = query(
    collection(db, "votaciones"),
    where("divisionId", "==", divisionKey),
    orderBy("abre", "desc")
  );

  const [teamsSnap, playersSnap, matchesSnap, newsSnap, votacionesSnap] = await Promise.all([
    getDocs(teamsQuery),
    getDocs(playersQuery),
    getDocs(matchesQuery),
    getDocs(newsQuery),
    getDocs(votacionesQuery),
  ]);

  const equipos = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const jugadores = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const partidos = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const noticias = newsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const votaciones = {};
  await Promise.all(
    votacionesSnap.docs.map(async (docSnap) => {
      const votesCol = collection(doc(db, "votaciones", docSnap.id), "votes");
      const votesSnap = await getDocs(votesCol);
      votaciones[docSnap.id] = {
        id: docSnap.id,
        ...docSnap.data(),
        votos: votesSnap.docs.map((vote) => ({ id: vote.id, ...vote.data() })),
      };
    })
  );

  const divisionData = { equipos, jugadores, partidos, noticias, votaciones };
  divisionCache[divisionKey] = divisionData;
  return divisionData;
};

export const clearDivisionCache = (divisionKey) => {
  if (divisionKey) {
    delete divisionCache[divisionKey];
  } else {
    Object.keys(divisionCache).forEach((key) => delete divisionCache[key]);
  }
};

export const getUltimaFechaNumeroFromData = (divisionData) => {
  const partidos = Array.isArray(divisionData?.partidos) ? divisionData.partidos : [];
  return partidos.reduce((max, match) => Math.max(max, match.fechaNumero || 0), 0);
};

export const calcularTablaFromData = (divisionData) => {
  const equipos = Array.isArray(divisionData?.equipos) ? divisionData.equipos : [];
  const partidos = Array.isArray(divisionData?.partidos) ? divisionData.partidos : [];

  const tabla = {};

  equipos.forEach((team) => {
    tabla[team.id] = {
      equipoId: team.id,
      nombre: team.name || team.nombre,
      PJ: 0,
      G: 0,
      E: 0,
      P: 0,
      GF: 0,
      GC: 0,
      DG: 0,
      PTS: 0,
    };
  });

  partidos.forEach((match) => {
    const local = tabla[match.localId];
    const visitante = tabla[match.visitanteId];
    if (!local || !visitante) return;

    local.PJ += 1;
    visitante.PJ += 1;

    local.GF += match.golesLocal;
    local.GC += match.golesVisitante;
    visitante.GF += match.golesVisitante;
    visitante.GC += match.golesLocal;

    if (match.golesLocal > match.golesVisitante) {
      local.G += 1;
      visitante.P += 1;
      local.PTS += 3;
    } else if (match.golesLocal < match.golesVisitante) {
      visitante.G += 1;
      local.P += 1;
      visitante.PTS += 3;
    } else {
      local.E += 1;
      visitante.E += 1;
      local.PTS += 1;
      visitante.PTS += 1;
    }
  });

  Object.values(tabla).forEach((entry) => {
    entry.DG = entry.GF - entry.GC;
  });

  return Object.values(tabla).sort((a, b) =>
    b.PTS - a.PTS ||
    b.DG - a.DG ||
    b.GF - a.GF ||
    a.nombre.localeCompare(b.nombre)
  );
};

export const calcularGoleadoresFromData = (divisionData) => {
  const jugadores = Array.isArray(divisionData?.jugadores) ? divisionData.jugadores : [];
  const partidos = Array.isArray(divisionData?.partidos) ? divisionData.partidos : [];

  const golesPorJugador = {};
  jugadores.forEach((jugador) => {
    golesPorJugador[jugador.id] = { jugadorId: jugador.id, goles: 0 };
  });

  partidos.forEach((match) => {
    (match.eventos || []).forEach((evento) => {
      if (evento.tipo === "gol" && golesPorJugador[evento.jugadorId]) {
        golesPorJugador[evento.jugadorId].goles += 1;
      }
    });
  });

  return Object.values(golesPorJugador)
    .map((entry) => {
      const jugador = jugadores.find((j) => j.id === entry.jugadorId);
      if (!jugador) return null;
      const team = (divisionData?.equipos || []).find((t) => t.id === jugador.teamId || t.id === jugador.equipoId);
      return {
        ...entry,
        nombre: jugador.name || jugador.nombre,
        foto: jugador.photoUrl || jugador.foto,
        equipo: team?.name || team?.nombre || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre));
};

export const jugadoresPorEquipoFromData = (divisionData, equipoId) => {
  const jugadores = Array.isArray(divisionData?.jugadores) ? divisionData.jugadores : [];
  return jugadores.filter((jugador) => (jugador.teamId || jugador.equipoId) === equipoId);
};

export const partidosPorFechaFromData = (divisionData, fechaNumero) => {
  return (divisionData?.partidos || []).filter((partido) => partido.fechaNumero === fechaNumero);
};

export const nombreEquipoFromData = (divisionData, equipoId) => {
  const team = (divisionData?.equipos || []).find((e) => e.id === equipoId);
  return team?.name || team?.nombre || "";
};

export const submitVote = async ({ divisionId, votacionId, jugadorId, usuarioId }) => {
  if (!divisionId || !votacionId || !jugadorId) {
    throw new Error("Datos incompletos para registrar el voto");
  }
  const votesCol = collection(doc(db, "votaciones", votacionId), "votes");
  await addDoc(votesCol, {
    jugadorId,
    usuarioId: usuarioId || "anon",
    createdAt: serverTimestamp(),
  });
  await loadDivisionData(divisionId, { force: true });
};

// Helpers asincrónicos compatibles con el código existente
export const getDivisionData = async (divisionKey, options) => loadDivisionData(divisionKey, options);
export const getUltimaFechaNumero = async (divisionKey) => {
  const data = await loadDivisionData(divisionKey);
  return getUltimaFechaNumeroFromData(data);
};
export const calcularTabla = async (divisionKey) => {
  const data = await loadDivisionData(divisionKey);
  return calcularTablaFromData(data);
};
export const calcularGoleadores = async (divisionKey) => {
  const data = await loadDivisionData(divisionKey);
  return calcularGoleadoresFromData(data);
};
export const jugadoresPorEquipo = async (divisionKey, equipoId) => {
  const data = await loadDivisionData(divisionKey);
  return jugadoresPorEquipoFromData(data, equipoId);
};
export const partidosPorFecha = async (divisionKey, fechaNumero) => {
  const data = await loadDivisionData(divisionKey);
  return partidosPorFechaFromData(data, fechaNumero);
};
export const nombreEquipo = async (divisionKey, equipoId) => {
  const data = await loadDivisionData(divisionKey);
  return nombreEquipoFromData(data, equipoId);
};
export const getJugadorFromData = (divisionData, jugadorId) => {
  return (divisionData?.jugadores || []).find((j) => j.id === jugadorId) || null;
};

export const calcularGanadoresVotacionesFromData = (divisionData) => {
  const votaciones = divisionData?.votaciones || {};
  const acumulado = {};
  Object.values(votaciones).forEach((votacion) => {
    const votos = votacion.votos || [];
    if (!votos.length) return;
    const conteo = votos.reduce((acc, voto) => {
      const key = voto.jugadorId;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const max = Math.max(...Object.values(conteo));
    Object.entries(conteo).forEach(([jugadorId, cantidad]) => {
      if (cantidad === max) {
        acumulado[jugadorId] = (acumulado[jugadorId] || 0) + 1;
      }
    });
  });
  return acumulado;
};
