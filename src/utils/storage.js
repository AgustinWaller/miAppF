import league from "../data/league.json";



// Devuelve objeto de la división seleccionada

export const getDivisionData = (divisionKey) => league?.divisiones?.[divisionKey];



// Última fecha disputada (por número mayor presente en partidos)

export const getUltimaFechaNumero = (divisionKey) => {
  const div = getDivisionData(divisionKey) || getDivisionData('A') || { partidos: [] };
  const partidos = Array.isArray(div.partidos) ? div.partidos : [];
  return partidos.reduce((max, p) => Math.max(max, p.fechaNumero || 0), 0);
};



// Tabla de posiciones

export const calcularTabla = (divisionKey) => {

  const div = getDivisionData(divisionKey) || getDivisionData('A') || { equipos: [], partidos: [] };

  const equipos = div.equipos.map(e => ({ ...e }));

  const tabla = {};

  equipos.forEach(e => {

    tabla[e.id] = {

      equipoId: e.id,

      nombre: e.nombre,

      PJ: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0, DG: 0, PTS: 0

    };

  });



  (div.partidos || []).forEach(p => {

    const local = tabla[p.localId];

    const visi = tabla[p.visitanteId];

    if (!local || !visi) return;



    local.PJ += 1; visi.PJ += 1;

    local.GF += p.golesLocal; local.GC += p.golesVisitante;

    visi.GF += p.golesVisitante; visi.GC += p.golesLocal;



    if (p.golesLocal > p.golesVisitante) {

      local.G += 1; visi.P += 1;

      local.PTS += 3;

    } else if (p.golesLocal < p.golesVisitante) {

      visi.G += 1; local.P += 1;

      visi.PTS += 3;

    } else {

      local.E += 1; visi.E += 1;

      local.PTS += 1; visi.PTS += 1;

    }

  });



  Object.values(tabla).forEach(t => t.DG = t.GF - t.GC);



  return Object.values(tabla).sort((a, b) =>

    b.PTS - a.PTS ||

    b.DG - a.DG ||

    b.GF - a.GF ||

    a.nombre.localeCompare(b.nombre)

  );

};



// Goleadores acumulados por eventos "gol"

export const calcularGoleadores = (divisionKey) => {

  const div = getDivisionData(divisionKey) || getDivisionData('A') || { jugadores: [], partidos: [], equipos: [] };

  const golesPorJugador = {};

  (div.jugadores || []).forEach(j => (golesPorJugador[j.id] = { jugadorId: j.id, goles: 0 }));



  (div.partidos || []).forEach(p => {

    p.eventos.forEach(ev => {

      if (ev.tipo === "gol" && golesPorJugador[ev.jugadorId]) {

        golesPorJugador[ev.jugadorId].goles += 1;

      }

    });

  });



  // enriquecer con nombre/equipo/foto

  const complete = Object.values(golesPorJugador).map(g => {

    const j = div.jugadores.find(x => x.id === g.jugadorId);

    const team = div.equipos.find(t => t.id === j.equipoId);

    return { ...g, nombre: j.nombre, foto: j.foto, equipo: team?.nombre || "" };

  });



  return complete.sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre));

};



// Obtener jugadores por equipo

export const jugadoresPorEquipo = (divisionKey, equipoId) => {

  const div = getDivisionData(divisionKey) || getDivisionData('A') || { jugadores: [] };

  return (div.jugadores || []).filter(j => j.equipoId === equipoId);

};



// Partidos filtrados por fechaNumero

export const partidosPorFecha = (divisionKey, fechaNumero) => {

  const div = getDivisionData(divisionKey) || getDivisionData('A') || { partidos: [] };

  return (div.partidos || []).filter(p => p.fechaNumero === fechaNumero);

};



// Texto de equipo por id

export const nombreEquipo = (divisionKey, equipoId) => {

  const div = getDivisionData(divisionKey) || getDivisionData('A') || { equipos: [] };

  return div.equipos.find(e => e.id === equipoId)?.nombre || "";

};
