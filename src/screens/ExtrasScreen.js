import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { collection, doc, getDocs, limit, orderBy, query, where } from "firebase/firestore";

import { APP_COLORS } from "../theme/colors";
import { db } from "../services/firebase";
import { getMatchesByDivision } from "../services/matches";
import { getPlayersByDivision } from "../services/players";
import { getTeamsByDivision } from "../services/teams";
import { getOpenVotacionesByDivision } from "../services/votacion";

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ExtrasScreen() {
  const [division, setDivision] = useState("A");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [scorers, setScorers] = useState([]);
  const [openVoteRanking, setOpenVoteRanking] = useState([]);
  const [voteRanking, setVoteRanking] = useState([]);
  const [vpRanking, setVpRanking] = useState([]);
  const [recentVotes, setRecentVotes] = useState([]);
  const [teamGoalsLeader, setTeamGoalsLeader] = useState(null);
  const [teamConcededLeader, setTeamConcededLeader] = useState(null);
  const [playerMostVotes, setPlayerMostVotes] = useState(null);
  const [playerYearLeader, setPlayerYearLeader] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [matchesList, playersList, teamsList, voteDocsSnap, openVoteDocs] = await Promise.all([
        getMatchesByDivision(division),
        getPlayersByDivision(division),
        getTeamsByDivision(division),
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

      const playersMap = new Map(playersList.map((player) => [player.id, player]));
      const teamsMap = new Map(teamsList.map((team) => [team.id, team]));

      // --- Equipos con más goles a favor y en contra ---
      const teamStats = new Map();
      const ensureTeam = (teamId) => {
        if (!teamId) return null;
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, { gf: 0, gc: 0 });
        }
        return teamStats.get(teamId);
      };

      matchesList.forEach((match) => {
        const localId = match.localId || match.local;
        const visitanteId = match.visitanteId || match.visitante;
        const localStats = ensureTeam(localId);
        const visitaStats = ensureTeam(visitanteId);
        const golesLocal = Number(match.golesLocal || 0);
        const golesVisitante = Number(match.golesVisitante || 0);
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
                nombre: teamsMap.get(attackLeader[0])?.name || teamsMap.get(attackLeader[0])?.nombre || attackLeader[0],
                goles: attackLeader[1].gf,
              }
            : null
        );
        setTeamConcededLeader(
          concededLeader && concededLeader[1].gc > 0
            ? {
                id: concededLeader[0],
                nombre: teamsMap.get(concededLeader[0])?.name || teamsMap.get(concededLeader[0])?.nombre || concededLeader[0],
                goles: concededLeader[1].gc,
              }
            : null
        );
      } else {
        setTeamGoalsLeader(null);
        setTeamConcededLeader(null);
      }

      // --- Ranking de goleadores (top 5) ---
      const scorerTotals = {};
      matchesList.forEach((match) => {
        (match.eventos || []).forEach((event) => {
          if (event?.tipo === "gol" && event.jugadorId) {
            scorerTotals[event.jugadorId] = (scorerTotals[event.jugadorId] || 0) + 1;
          }
        });
      });
      const scorerRanking = Object.entries(scorerTotals)
        .map(([playerId, goals]) => {
          const player = playersMap.get(playerId);
          return {
            id: playerId,
            nombre: player?.name || playerId,
            equipo: player?.teamName || player?.equipo || "",
            goles: goals,
          };
        })
        .sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);
      setScorers(scorerRanking);

      // --- Votaciones ---
      const voteDocsMap = new Map();
      voteDocsSnap.docs.forEach((docSnap) => voteDocsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      openVoteDocs.forEach((voteDoc) => voteDocsMap.set(voteDoc.id, voteDoc));
      const voteDocs = Array.from(voteDocsMap.values());

      const closedVotes = voteDocs.filter((vote) => vote.abierto !== true);
      const voteTotals = {};
      const vpTotals = {};
      let openVoteRankingLocal = [];
      const recentSummaries = [];

      await Promise.all(
        voteDocs.map(async (voteDoc) => {
          const votesSnap = await getDocs(collection(doc(db, "votacion", voteDoc.id), "votes"));
          const voteCount = votesSnap.docs.reduce((acc, vote) => {
            const data = vote.data() || {};
            if (!data.jugadorId) return acc;
            acc[data.jugadorId] = (acc[data.jugadorId] || 0) + 1;
            return acc;
          }, {});

          // Totales para jugador más votado
          Object.entries(voteCount).forEach(([playerId, votos]) => {
            voteTotals[playerId] = (voteTotals[playerId] || 0) + votos;
          });

          if (voteDoc.abierto === true) {
            // Ranking actual de la votación abierta
            openVoteRankingLocal = Object.entries(voteCount)
              .map(([playerId, votos]) => {
                const player = playersMap.get(playerId);
                return {
                  id: playerId,
                  nombre: player?.name || playerId,
                  equipo: player?.teamName || player?.equipo || "",
                  votos,
                };
              })
              .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
              .slice(0, 5);
          } else if (Object.keys(voteCount).length) {
            // Jugador del año (VP) y resumen de votaciones cerradas
            const maxVotes = Math.max(...Object.values(voteCount));
            const winners = Object.entries(voteCount)
              .filter(([, votos]) => votos === maxVotes)
              .map(([playerId, votos]) => {
                vpTotals[playerId] = (vpTotals[playerId] || 0) + 1;
                const player = playersMap.get(playerId);
                return {
                  id: playerId,
                  nombre: player?.name || playerId,
                  equipo: player?.teamName || player?.equipo || "",
                  votos,
                };
              });
            recentSummaries.push({
              id: voteDoc.id,
              fecha: formatDate(voteDoc.cierra || voteDoc.abre),
              winners,
            });
          }
        })
      );

      recentSummaries.sort((a, b) => {
        const da = parseDate(a.fecha)?.getTime() ?? 0;
        const db = parseDate(b.fecha)?.getTime() ?? 0;
        return db - da;
      });
      setRecentVotes(recentSummaries.slice(0, 5));
      setOpenVoteRanking(openVoteRankingLocal);

      const voteRankingTop5 = Object.entries(voteTotals)
        .map(([playerId, votos]) => {
          const player = playersMap.get(playerId);
          return {
            id: playerId,
            nombre: player?.name || playerId,
            equipo: player?.teamName || player?.equipo || "",
            votos,
          };
        })
        .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      const vpRankingTop5 = Object.entries(vpTotals)
        .map(([playerId, victorias]) => {
          const player = playersMap.get(playerId);
          return {
            id: playerId,
            nombre: player?.name || playerId,
            equipo: player?.teamName || player?.equipo || "",
            victorias,
          };
        })
        .sort((a, b) => b.victorias - a.victorias || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      setVoteRanking(voteRankingTop5);
      setVpRanking(vpRankingTop5);
      setPlayerMostVotes(voteRankingTop5[0] || null);
      setPlayerYearLeader(vpRankingTop5[0] || null);
    } catch (err) {
      console.error("Extras load error", err);
      setError("Error al cargar");
      setScorers([]);
      setOpenVoteRanking([]);
      setVoteRanking([]);
      setVpRanking([]);
      setRecentVotes([]);
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
        value: playerMostVotes
          ? `${playerMostVotes.nombre}${playerMostVotes.equipo ? ` (${playerMostVotes.equipo})` : ""} - ${playerMostVotes.votos} votos`
          : "Sin datos",
      },
      {
        label: "Jugador del año (VP)",
        value: playerYearLeader
          ? `${playerYearLeader.nombre}${playerYearLeader.equipo ? ` (${playerYearLeader.equipo})` : ""} - ${playerYearLeader.victorias} VP`
          : "Sin datos",
      },
    ],
    [teamGoalsLeader, teamConcededLeader, playerMostVotes, playerYearLeader]
  );

  return (
    <View style={styles.container}>
      <View style={styles.divisionRow}>
        {["A", "B"].map((div) => (
          <TouchableOpacity
            key={div}
            style={[styles.divButton, division === div && styles.divButtonActive]}
            onPress={() => setDivision(div)}
          >
            <Text style={[styles.divText, division === div && styles.divTextActive]}>{div}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={load} style={styles.reload}>
          <Text style={styles.reloadTxt}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" color={APP_COLORS.campo} />
      ) : error ? (
        <Text style={styles.error} onPress={load}>
          {error}. Toca para reintentar.
        </Text>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.nombre}</Text>
                  {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                </View>
                <Text style={styles.rowValue}>{item.goles} goles</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Sin goles registrados.</Text>
          )}

          <Text style={styles.sectionTitle}>Últimos ganadores (Jugador de la fecha)</Text>
          {recentVotes.length ? (
            recentVotes.map((vote) => (
              <View key={`vote-${vote.id}`} style={styles.voteCard}>
                <Text style={styles.voteDate}>{vote.fecha || vote.id}</Text>
                {vote.winners.map((winner) => (
                  <Text key={`${vote.id}-${winner.id}`} style={styles.voteWinner}>
                    {winner.nombre}
                    {winner.equipo ? ` (${winner.equipo})` : ""} — {winner.votos} votos
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
  container: { flex: 1, backgroundColor: APP_COLORS.fondo, padding: 16 },
  divisionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  divButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
    backgroundColor: APP_COLORS.blanco,
  },
  divButtonActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  reload: { marginLeft: "auto" },
  reloadTxt: { color: APP_COLORS.campo, fontWeight: "700" },
  error: { textAlign: "center", color: APP_COLORS.texto },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: APP_COLORS.texto, marginTop: 16, marginBottom: 8 },
  summaryCard: { backgroundColor: APP_COLORS.blanco, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: APP_COLORS.cielo, marginBottom: 8 },
  summaryLabel: { fontWeight: "700", color: APP_COLORS.texto },
  summaryValue: { color: APP_COLORS.texto, marginTop: 4 },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: APP_COLORS.blanco, borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: APP_COLORS.cielo },
  rank: { width: 28, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo },
  rowName: { fontWeight: "700", color: APP_COLORS.texto },
  rowSub: { color: APP_COLORS.texto },
  rowValue: { fontWeight: "700", color: APP_COLORS.campo },
  empty: { color: APP_COLORS.texto, textAlign: "center", marginVertical: 12 },
  voteCard: { backgroundColor: APP_COLORS.blanco, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: APP_COLORS.cielo, marginBottom: 8 },
  voteDate: { fontWeight: "700", color: APP_COLORS.campo, marginBottom: 4 },
  voteWinner: { color: APP_COLORS.texto },
});

