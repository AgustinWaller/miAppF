import league from "../data/league.json";

const EMPTY_DIVISION = { equipos: [], jugadores: [], partidos: [], votaciones: {} };

const ensureDivision = (divisionKey) => {
  return league?.divisiones?.[divisionKey] || league?.divisiones?.A || EMPTY_DIVISION;
};

const buildGoalMap = (division) => {
  const tally = {};
  (division.jugadores || []).forEach((player) => {
    tally[player.id] = { goles: 0, jugador: player };
  });
  (division.partidos || []).forEach((match) => {
    (match.eventos || []).forEach((evt) => {
      if (evt.tipo === "gol" && tally[evt.jugadorId]) {
        tally[evt.jugadorId].goles += 1;
      }
    });
  });
  return tally;
};

export const getDivisionData = (divisionKey) => {
  return league?.divisiones?.[divisionKey];
};

export const getUltimaFechaNumero = (divisionKey) => {
  const division = ensureDivision(divisionKey);
  const partidos = Array.isArray(division.partidos) ? division.partidos : [];
  return partidos.reduce((max, match) => Math.max(max, match.fechaNumero || 0), 0);
};

export const calcularTabla = (divisionKey) => {
  const division = ensureDivision(divisionKey);
  const equipos = Array.isArray(division.equipos) ? division.equipos.map((team) => ({ ...team })) : [];
  const tabla = {};

  equipos.forEach((team) => {
    tabla[team.id] = {
      equipoId: team.id,
      nombre: team.nombre,
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

  (division.partidos || []).forEach((match) => {
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

  return Object.values(tabla)
    .sort((a, b) =>
      b.PTS - a.PTS ||
      b.DG - a.DG ||
      b.GF - a.GF ||
      a.nombre.localeCompare(b.nombre)
    );
};

export const calcularGoleadores = (divisionKey) => {
  const division = ensureDivision(divisionKey);
  const goalMap = buildGoalMap(division);

  return Object.values(goalMap)
    .map((entry) => {
      const player = entry.jugador;
      const team = division.equipos.find((t) => t.id === player.equipoId);
      return {
        jugadorId: player.id,
        goles: entry.goles,
        nombre: player.nombre,
        foto: player.foto,
        equipo: team?.nombre || "",
      };
    })
    .sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre))
    .slice(0, 10);
};

export const jugadoresPorEquipo = (divisionKey, equipoId) => {
  const division = ensureDivision(divisionKey);
  const goalMap = buildGoalMap(division);
  return (division.jugadores || [])
    .filter((jugador) => jugador.equipoId === equipoId)
    .map((player) => ({ ...player, goles: goalMap[player.id]?.goles || 0 }));
};

export const partidosPorFecha = (divisionKey, fechaNumero) => {
  const division = ensureDivision(divisionKey);
  return (division.partidos || []).filter((match) => match.fechaNumero === fechaNumero);
};

export const nombreEquipo = (divisionKey, equipoId) => {
  const division = ensureDivision(divisionKey);
  return division.equipos.find((team) => team.id === equipoId)?.nombre || "";
};

export const nombreJugador = (divisionKey, jugadorId) => {
  const division = ensureDivision(divisionKey);
  return division.jugadores.find((player) => player.id === jugadorId)?.nombre || "";
};

export const getJugador = (divisionKey, jugadorId) => {
  const division = ensureDivision(divisionKey);
  return division.jugadores.find((player) => player.id === jugadorId) || null;
};

export const calcularGanadoresVotaciones = (divisionKey) => {
  const division = ensureDivision(divisionKey);
  const acumulado = {};

  Object.values(division.votaciones || {}).forEach((votacion) => {
    const conteo = {};
    (votacion.votos || []).forEach((voto) => {
      conteo[voto.jugadorId] = (conteo[voto.jugadorId] || 0) + 1;
    });
    const max = Math.max(0, ...Object.values(conteo));
    if (max === 0) return;
    Object.entries(conteo).forEach(([jugadorId, votos]) => {
      if (votos === max) {
        acumulado[jugadorId] = (acumulado[jugadorId] || 0) + 1;
      }
    });
  });

  return acumulado;
};
