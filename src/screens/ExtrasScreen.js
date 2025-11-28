// src/screens/ExtrasScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

import { APP_COLORS } from "../theme/colors";
import { db } from "../services/firebase";
import { getMatchesByDivision } from "../services/matches";
import { getPlayersByDivision } from "../services/players";
import { getTeamsByDivision } from "../services/teams";
import { getOpenVotacionesByDivision } from "../services/votacion";
import { safeImage, FALLBACK_PLAYER, FALLBACK_TEAM } from "../utils/images";

/**
 * ExtrasScreen
 *
 * - Lee partidos, jugadores, equipos y votaciones desde Firestore.
 * - Top 5 equipos más votados: usa colección "teamFavorites" (documentos por teamId con campo count).
 * - Top 5 votación actual: votación con abierto === true (por division).
 * - Top 5 votos acumulados: suma de todos los votos en todas las fechas.
 * - Jugador del año: por cada fecha cerrada se suma 1 punto al/los ganador(es).
 * - Goleadores: conteo de eventos de tipo "gol" en matches.
 * - Equipo más goleador / más goleado: suma gf/gc por equipo desde matches.
 *
 * Nota: asumimos que las colecciones se llaman tal como las mostraste:
 *   - "votacion" -> documentos por fecha -> subcolección "votes"
 *   - "teamFavorites" -> documentos por teamId, con campo count y subcol "votes"
 */

function parseDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value?.toDate) {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  return null;
}
function formatDate(value) {
  const d = parseDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ExtrasScreen() {
  const [division, setDivision] = useState("A");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Rankings y datos
  const [scorers, setScorers] = useState([]); // top goleadores
  const [openVoteRanking, setOpenVoteRanking] = useState([]); // votación abierta (top 5)
  const [voteRanking, setVoteRanking] = useState([]); // votos acumulados (top 5)
  const [vpRanking, setVpRanking] = useState([]); // jugador del año (top)
  const [recentVotes, setRecentVotes] = useState([]); // últimos ganadores resumen
  const [teamGoalsLeader, setTeamGoalsLeader] = useState(null);
  const [teamConcededLeader, setTeamConcededLeader] = useState(null);
  const [playerMostVotes, setPlayerMostVotes] = useState(null);
  const [playerYearLeader, setPlayerYearLeader] = useState(null);
  const [teamRanking, setTeamRanking] = useState([]); // TOP 5 equipos más votados (global)

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // traemos datos base
      const [
        matchesList,
        playersList,
        teamsListForDiv, // equipos de la división (para mapear equipos de jugadores)
        voteDocsSnap,
        openVoteDocs,
      ] = await Promise.all([
        getMatchesByDivision(division),
        getPlayersByDivision(division),
        getTeamsByDivision(division),
        // votaciones (limit 20 ordenadas por cierra desc)
        getDocs(
          query(
            collection(db, "votacion"),
            where("divisionId", "==", division),
            orderBy("cierra", "desc"),
            limit(20)
          )
        ),
        getOpenVotacionesByDivision(division),
      ]);

      // playersMap (por id)
      const playersMap = new Map(playersList.map((p) => [p.id, p]));
      // teamsMap por id (necesario para nombres/logos)
      // NOTA: getTeamsByDivision trae solo equipos de la división: para logos de jugadores está bien.
      const teamsMap = new Map(teamsListForDiv.map((t) => [t.id, t]));

      //
      // 1) EQUIPOS MÁS GOLEADORES / GOLEADOS
      //
      const teamStats = new Map();
      const ensureTeam = (teamId) => {
        if (!teamId) return null;
        if (!teamStats.has(teamId)) teamStats.set(teamId, { gf: 0, gc: 0 });
        return teamStats.get(teamId);
      };

      matchesList.forEach((match) => {
        const localId = match.localId || match.local || "";
        const visitanteId = match.visitanteId || match.visitante || "";
        const golesLocal = Number(match.golesLocal ?? match.goles_local ?? 0);
        const golesVisitante = Number(match.golesVisitante ?? match.goles_visitante ?? 0);

        const localStats = ensureTeam(localId);
        const visitaStats = ensureTeam(visitanteId);
        if (localStats) {
          localStats.gf += golesLocal;
          localStats.gc += golesVisitante;
        }
        if (visitaStats) {
          visitaStats.gf += golesVisitante;
          visitaStats.gc += golesLocal;
        }
      });

      if (teamStats.size) {
        const statsArray = Array.from(teamStats.entries());
        const attackLeader = statsArray.sort((a, b) => b[1].gf - a[1].gf)[0];
        const concededLeader = statsArray.sort((a, b) => b[1].gc - a[1].gc)[0];
        setTeamGoalsLeader(
          attackLeader && attackLeader[1].gf > 0
            ? {
                id: attackLeader[0],
                nombre:
                  (teamsMap.get(attackLeader[0])?.name ||
                    teamsMap.get(attackLeader[0])?.nombre ||
                    attackLeader[0]) ?? attackLeader[0],
                goles: attackLeader[1].gf,
              }
            : null
        );
        setTeamConcededLeader(
          concededLeader && concededLeader[1].gc > 0
            ? {
                id: concededLeader[0],
                nombre:
                  (teamsMap.get(concededLeader[0])?.name ||
                    teamsMap.get(concededLeader[0])?.nombre ||
                    concededLeader[0]) ?? concededLeader[0],
                goles: concededLeader[1].gc,
              }
            : null
        );
      } else {
        setTeamGoalsLeader(null);
        setTeamConcededLeader(null);
      }

      //
      // 2) GOLEADORES (top 5)
      //
      const scorerTotals = {};
      matchesList.forEach((match) => {
        const eventos = match.eventos || match.evento || [];
        eventos.forEach((ev) => {
          const tipo = String(ev?.tipo || ev?.type || "").toLowerCase();
          const isGol = tipo.includes("gol") || tipo === "gol" || tipo.startsWith("gol");
          const jugadorId = ev.jugadorId || ev.jugador || ev.playerId || ev.player || "";
          if (isGol && jugadorId) scorerTotals[jugadorId] = (scorerTotals[jugadorId] || 0) + 1;
        });
      });

      const scorerRanking = Object.entries(scorerTotals)
        .map(([playerId, goals]) => {
          const p = playersMap.get(playerId) || {};
          const teamId = p.teamId || p.team || p.equipo || "";
          const team = teamsMap.get(teamId) || {};
          return {
            id: playerId,
            nombre: p.name || p.nombre || playerId,
            equipo: p.teamName || p.team || team?.name || "",
            goles: goals,
            photo: safeImage(p.photoUrl || p.photoURL || p.photo || "", FALLBACK_PLAYER),
            teamLogo: safeImage(team?.logoUrl || team?.logoURL || "", FALLBACK_TEAM),
          };
        })
        .sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      setScorers(scorerRanking);

      //
      // 3) VOTACIONES: abierta (top actual), acumulado (total por jugador), jugador del año (VP)
      //
      const voteDocsMap = new Map();
      // voteDocsSnap es QuerySnapshot de las últimas 20 por cierra desc (solo de esa division)
      voteDocsSnap.docs.forEach((d) => voteDocsMap.set(d.id, { id: d.id, ...d.data() }));
      // openVoteDocs viene del helper getOpenVotacionesByDivision (si existe en tu proyecto)
      openVoteDocs.forEach((d) => voteDocsMap.set(d.id, d));
      const voteDocs = Array.from(voteDocsMap.values());

      const voteTotals = {}; // acumulado por jugador (sum of all votes)
      const vpTotalsLocal = {}; // jugador del año: sum de victorias por fecha cerrada
      let openVoteRankingLocal = [];
      const recentSummaries = [];

      await Promise.all(
        voteDocs.map(async (voteDoc) => {
          // votes subcollection
          const votesSnap = await getDocs(collection(doc(db, "votacion", voteDoc.id), "votes"));
          const voteCount = votesSnap.docs.reduce((acc, vdoc) => {
            const d = vdoc.data() || {};
            // votos por jugadorId (varios nombres según tus datos)
            const pid = d.jugadorId || d.jugador || d.playerId || d.player || "";
            if (!pid) return acc;
            acc[pid] = (acc[pid] || 0) + 1;
            return acc;
          }, {});

          // sumar al acumulado global
          Object.entries(voteCount).forEach(([pid, c]) => {
            voteTotals[pid] = (voteTotals[pid] || 0) + c;
          });

          // si la votación está abierta -> ranking actual
          if (voteDoc.abierto === true) {
            openVoteRankingLocal = Object.entries(voteCount)
              .map(([pid, c]) => {
                const p = playersMap.get(pid);
                return {
                  id: pid,
                  nombre: p?.name || p?.nombre || pid,
                  equipo: p?.teamName || p?.equipo || "",
                  votos: c,
                };
              })
              .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
              .slice(0, 5);
          }

          // si la votación está cerrada -> determinamos ganadores para VP y resumen
          if (voteDoc.abierto !== true && Object.keys(voteCount).length) {
            const maxVotes = Math.max(...Object.values(voteCount));
            const winners = Object.entries(voteCount)
              .filter(([, c]) => c === maxVotes)
              .map(([pid, c]) => {
                vpTotalsLocal[pid] = (vpTotalsLocal[pid] || 0) + 1; // +1 punto por victoria en esa fecha (empates cuentan para todos)
                const p = playersMap.get(pid);
                return {
                  id: pid,
                  nombre: p?.name || p?.nombre || pid,
                  equipo: p?.teamName || p?.equipo || "",
                  votos: c,
                };
              });

            recentSummaries.push({
              id: voteDoc.id,
              fecha: formatDate(voteDoc.cierra || voteDoc.abre || voteDoc.createdAt),
              winners,
            });
          }
        })
      );

      // ordenar y setear abiertos / acumulados / vp
      setOpenVoteRanking(openVoteRankingLocal);

      const voteRankingTop5 = Object.entries(voteTotals || {})
        .map(([pid, votos]) => {
          const p = playersMap.get(pid) || {};
          return {
            id: pid,
            nombre: p?.name || p?.nombre || pid,
            equipo: p?.teamName || p?.equipo || "",
            votos,
          };
        })
        .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      const vpRankingTop5 = Object.entries(vpTotalsLocal || {})
        .map(([pid, pts]) => {
          const p = playersMap.get(pid) || {};
          return {
            id: pid,
            nombre: p?.name || p?.nombre || pid,
            equipo: p?.teamName || p?.equipo || "",
            victorias: pts,
          };
        })
        .sort((a, b) => b.victorias - a.victorias || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      recentSummaries.sort((a, b) => {
        const da = parseDate(a.fecha)?.getTime() ?? 0;
        const db = parseDate(b.fecha)?.getTime() ?? 0;
        return db - da;
      });

      setVoteRanking(voteRankingTop5);
      setVpRanking(vpRankingTop5);
      setRecentVotes(recentSummaries.slice(0, 5));
      setPlayerMostVotes(voteRankingTop5[0] || null);
      setPlayerYearLeader(vpRankingTop5[0] || null);

      //
      // 4) RANKING DE EQUIPOS MÁS VOTADOS (GLOBAL)
      //
      // Leemos todos los documentos de teamFavorites (no filtramos por division para ranking global)
      const teamFavSnap = await getDocs(collection(db, "teamFavorites"));
      const teamFavList = teamFavSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Para obtener nombre/logo de cada equipo buscamos en la colección teams (todo)
      const teamsAllSnap = await getDocs(collection(db, "teams"));
      const allTeams = teamsAllSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const allTeamsMap = new Map(allTeams.map((t) => [t.id, t]));

    const rankingTeams = teamFavList
      .map((fav) => {
        // SIEMPRE usar fav.teamId como ID REAL DEL EQUIPO
        const teamId = fav.teamId;

        const teamDoc = allTeamsMap.get(teamId) || {};

      return {
        id: teamId,
        nombre: teamDoc.name || teamDoc.nombre || "Equipo sin nombre",
        logo: safeImage(teamDoc.logoUrl || teamDoc.logoURL || teamDoc.logo || "", FALLBACK_TEAM),
        votos: Number(fav.count || 0),
    };
   })
    .filter((t) => t.votos > 0)
    .sort((a, b) => b.votos - a.votos)
    .slice(0, 5);


      setTeamRanking(rankingTeams);
    } catch (err) {
      console.error("Extras load error:", err);
      setError("Error al cargar");
      // limpiar
      setScorers([]);
      setOpenVoteRanking([]);
      setVoteRanking([]);
      setVpRanking([]);
      setRecentVotes([]);
      setTeamRanking([]);
      setTeamGoalsLeader(null);
      setTeamConcededLeader(null);
      setPlayerMostVotes(null);
      setPlayerYearLeader(null);
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => {
    load();
  }, [load]);

  // resumen superior (texto con varios items)
  const summaryItems = useMemo(
    () => [
      {
        label: "Equipo más goleador",
        value: teamGoalsLeader ? `${teamGoalsLeader.nombre} (${teamGoalsLeader.goles} goles)` : "Sin datos",
      },
      {
        label: "Equipo más goleado",
        value: teamConcededLeader ? `${teamConcededLeader.nombre} (${teamConcededLeader.goles} goles en contra)` : "Sin datos",
      },
      {
        label: "Jugador con más votos acumulados",
        value: playerMostVotes ? `${playerMostVotes.nombre}${playerMostVotes.equipo ? ` (${playerMostVotes.equipo})` : ""} - ${playerMostVotes.votos} votos` : "Sin datos",
      },
      {
        label: "Jugador del año (VP)",
        value: playerYearLeader ? `${playerYearLeader.nombre}${playerYearLeader.equipo ? ` (${playerYearLeader.equipo})` : ""} - ${playerYearLeader.victorias} VP` : "Sin datos",
      },
    ],
    [teamGoalsLeader, teamConcededLeader, playerMostVotes, playerYearLeader]
  );

  return (
    <View style={styles.container}>
      <View style={styles.divisionRow}>
        {["A", "B"].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.divButton, division === d && styles.divButtonActive]}
            onPress={() => setDivision(d)}
          >
            <Text style={[styles.divText, division === d && styles.divTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={load} style={styles.reload}>
          <Text style={styles.reloadTxt}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" color={APP_COLORS.campo} />
      ) : error ? (
        <Text style={styles.error} onPress={load}>{error}. Toca para reintentar.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          {summaryItems.map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Top 5 Jugador de la fecha (votación actual)</Text>
          {openVoteRanking.length ? (
            openVoteRanking.map((item, index) => (
              <View key={`open-${item.id}`} style={styles.listRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.nombre}</Text>
                  {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                </View>
                <Text style={styles.rowValue}>{item.votos} votos</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No hay votación abierta.</Text>
          )}

          <Text style={styles.sectionTitle}>Top 5 Jugador más votado (acumulado)</Text>
          {voteRanking.length ? (
            voteRanking.map((item, index) => (
              <View key={`votes-${item.id}`} style={styles.listRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.nombre}</Text>
                  {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                </View>
                <Text style={styles.rowValue}>{item.votos} votos</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Sin votos registrados.</Text>
          )}

          <Text style={styles.sectionTitle}>Top 5 Jugador del año (VP)</Text>
          {vpRanking.length ? (
            vpRanking.map((item, index) => (
              <View key={`vp-${item.id}`} style={styles.listRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.nombre}</Text>
                  {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                </View>
                <Text style={styles.rowValue}>{item.victorias} VP</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Sin ganadores todavía.</Text>
          )}

          <Text style={styles.sectionTitle}>Top 5 Goleadores</Text>
          {scorers.length ? (
            scorers.map((item, index) => (
              <View key={`scorer-${item.id}`} style={styles.listRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Image source={item.photo} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{item.nombre}</Text>
                    {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.rowValue}>{item.goles} goles</Text>
                  {item.teamLogo && <Image source={item.teamLogo} style={{ width: 24, height: 24, marginTop: 6 }} />}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Sin goles registrados.</Text>
          )}

          <Text style={styles.sectionTitle}>Top 5 Equipos más votados</Text>
          {teamRanking.length ? (
            teamRanking.map((t, i) => (
              <View key={t.id} style={styles.listRow}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={{ flexDirection: "row", flex: 1, alignItems: "center" }}>
                  <Image source={t.logo} style={styles.teamLogo} />
                  <Text style={styles.rowName}>{t.nombre}</Text>
                </View>
                <Text style={styles.rowValue}>{t.votos} votos</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Aún no hay votos registrados.</Text>
          )}

          <Text style={styles.sectionTitle}>Últimos ganadores (Jugador de la fecha)</Text>
          {recentVotes.length ? (
            recentVotes.map((vote) => (
              <View key={`vote-${vote.id}`} style={styles.voteCard}>
                <Text style={styles.voteDate}>{vote.fecha || vote.id}</Text>
                {vote.winners.map((w) => (
                  <Text key={`${vote.id}-${w.id}`} style={styles.voteWinner}>
                    {w.nombre}
                    {w.equipo ? ` (${w.equipo})` : ""} — {w.votos} votos
                  </Text>
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Aún no hay votaciones cerradas.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.fondo || "#fff", padding: 16 },
  divisionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  divButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: APP_COLORS.campo || "#2f7d32",
    backgroundColor: APP_COLORS.blanco || "#fff",
    marginRight: 8,
  },
  divButtonActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto || "#333", fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco || "#fff" },
  reload: { marginLeft: "auto" },
  reloadTxt: { color: APP_COLORS.campo || "#2f7d32", fontWeight: "700" },
  error: { textAlign: "center", color: APP_COLORS.texto || "#333" },

  sectionTitle: { fontSize: 16, fontWeight: "800", color: APP_COLORS.texto || "#333", marginTop: 16, marginBottom: 8 },
  summaryCard: { backgroundColor: APP_COLORS.blanco || "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: APP_COLORS.cielo || "#C8E6C9", marginBottom: 8 },
  summaryLabel: { fontWeight: "700", color: APP_COLORS.texto || "#333" },
  summaryValue: { color: APP_COLORS.texto || "#333", marginTop: 4 },

  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: APP_COLORS.blanco || "#fff", borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: APP_COLORS.cielo || "#C8E6C9" },
  rank: { width: 28, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo || "#2f7d32" },
  rowName: { fontWeight: "700", color: APP_COLORS.texto || "#333" },
  rowSub: { color: APP_COLORS.texto || "#333" },
  rowValue: { fontWeight: "700", color: APP_COLORS.campo || "#2f7d32" },

  teamLogo: { width: 32, height: 32, marginRight: 8, borderRadius: 16 },

  empty: { color: APP_COLORS.texto || "#333", textAlign: "center", marginVertical: 12 },

  voteCard: { backgroundColor: APP_COLORS.blanco || "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: APP_COLORS.cielo || "#C8E6C9", marginBottom: 8 },
  voteDate: { fontWeight: "700", color: APP_COLORS.campo || "#2f7d32", marginBottom: 4 },
  voteWinner: { color: APP_COLORS.texto || "#333" },
});
