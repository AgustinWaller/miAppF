import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { collection, doc, getDocs, limit, orderBy, query, where } from "firebase/firestore";

import { APP_COLORS } from "../theme/colors";
import { getNewsByDivision } from "../services/news";
import { getMatchesByDivision } from "../services/matches";
import { getPlayersByDivision } from "../services/players";
import { getTeamsByDivision } from "../services/teams";
import { getTeamFavorites } from "../services/teamFavorites";
import { getOpenVotacionesByDivision } from "../services/votacion";
import { loadFavoriteTeams } from "../utils/favoritesStorage";
import { db } from "../services/firebase";

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

function computeNextMatch(matches, teamsMap) {
  if (!matches.length) return null;
  const now = Date.now();
  const sorted = [...matches].sort((a, b) => {
    const da = parseDate(a.dateIso)?.getTime() ?? 0;
    const db = parseDate(b.dateIso)?.getTime() ?? 0;
    return da - db;
  });
  const upcoming = sorted.find((m) => (parseDate(m.dateIso)?.getTime() ?? 0) >= now);
  const target = upcoming || sorted[sorted.length - 1];
  if (!target) return null;
  return {
    ...target,
    localName: teamsMap.get(target.localId)?.name || target.localName || target.localId,
    visitanteName: teamsMap.get(target.visitanteId)?.name || target.visitanteName || target.visitanteId,
  };
}

function computeTopScorer(matches, playersMap) {
  const tally = {};
  matches.forEach((match) => {
    (match.eventos || []).forEach((ev) => {
      if (ev?.tipo === "gol" && ev?.jugadorId) {
        tally[ev.jugadorId] = (tally[ev.jugadorId] || 0) + 1;
      }
    });
  });
  const entries = Object.entries(tally);
  if (!entries.length) return null;
  const [playerId, goals] = entries.sort((a, b) => b[1] - a[1])[0];
  const player = playersMap.get(playerId);
  return {
    id: playerId,
    nombre: player?.name || playerId,
    equipo: player?.teamName || player?.equipo || "",
    goles: goals,
  };
}

export default function HomeScreen({ route, navigation }) {
  const initialDivision = route?.params?.division ?? "A";
  const [division, setDivision] = useState(initialDivision);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [news, setNews] = useState([]);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [favoriteRanking, setFavoriteRanking] = useState([]);
  const [favoriteTeamIds, setFavoriteTeamIds] = useState([]);
  const [openVote, setOpenVote] = useState(null);
  const [playerMostVotes, setPlayerMostVotes] = useState(null);
  const [playerYearLeader, setPlayerYearLeader] = useState(null);
  const [teamGoalsLeader, setTeamGoalsLeader] = useState(null);
  const [teamConcededLeader, setTeamConcededLeader] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [newsList, matchList, playerList, teamList, favoriteList, openVotes, voteDocsSnap] = await Promise.all([
        getNewsByDivision(division),
        getMatchesByDivision(division),
        getPlayersByDivision(division),
        getTeamsByDivision(division),
        getTeamFavorites(),
        getOpenVotacionesByDivision(division),
        getDocs(
          query(
            collection(db, "votacion"),
            where("divisionId", "==", division),
            orderBy("cierra", "desc"),
            limit(10)
          )
        ),
      ]);

      setNews(newsList);
      setMatches(matchList);
      setPlayers(playerList);
      setTeams(teamList);
      setFavoriteRanking(favoriteList.filter((f) => !f.divisionId || f.divisionId === division));
      setOpenVote(openVotes?.[0] || null);

      // Equipos con más goles a favor/en contra
      const teamsMapTemp = new Map(teamList.map((team) => [team.id, team]));
      const teamStats = new Map();
      const ensureTeam = (teamId) => {
        if (!teamId) return null;
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, { gf: 0, gc: 0 });
        }
        return teamStats.get(teamId);
      };
      matchList.forEach((match) => {
        const localId = match.localId || match.local;
        const visitanteId = match.visitanteId || match.visitante;
        const localStats = ensureTeam(localId);
        const visitaStats = ensureTeam(visitanteId);
        const gl = Number(match.golesLocal || 0);
        const gv = Number(match.golesVisitante || 0);
        if (localStats) {
          localStats.gf += gl;
          localStats.gc += gv;
        }
        if (visitaStats) {
          visitaStats.gf += gv;
          visitaStats.gc += gl;
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
                nombre: teamsMapTemp.get(attackLeader[0])?.name || attackLeader[0],
                goles: attackLeader[1].gf,
              }
            : null
        );
        setTeamConcededLeader(
          concededLeader && concededLeader[1].gc > 0
            ? {
                id: concededLeader[0],
                nombre: teamsMapTemp.get(concededLeader[0])?.name || concededLeader[0],
                goles: concededLeader[1].gc,
              }
            : null
        );
      } else {
        setTeamGoalsLeader(null);
        setTeamConcededLeader(null);
      }

      // Votaciones: totales y VP
      const voteDocs = voteDocsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const closedVotes = voteDocs.filter((v) => v.abierto !== true);
      const voteTotals = {};
      const vpTotals = {};

      await Promise.all(
        closedVotes.map(async (voteDoc) => {
          const votesSnap = await getDocs(collection(doc(db, "votacion", voteDoc.id), "votes"));
          const voteCount = votesSnap.docs.reduce((acc, vote) => {
            const data = vote.data() || {};
            if (!data.jugadorId) return acc;
            acc[data.jugadorId] = (acc[data.jugadorId] || 0) + 1;
            return acc;
          }, {});
          const maxVotes = Math.max(...Object.values(voteCount), 0);
          Object.entries(voteCount).forEach(([playerId, votos]) => {
            voteTotals[playerId] = (voteTotals[playerId] || 0) + votos;
            if (votos === maxVotes && maxVotes > 0) {
              vpTotals[playerId] = (vpTotals[playerId] || 0) + 1;
            }
          });
        })
      );

      const playersMap = new Map(playerList.map((player) => [player.id, player]));
      const voteRanking = Object.entries(voteTotals)
        .map(([playerId, votos]) => {
          const player = playersMap.get(playerId);
          return {
            id: playerId,
            nombre: player?.name || playerId,
            equipo: player?.teamName || player?.equipo || "",
            votos,
          };
        })
        .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre));

      const vpRanking = Object.entries(vpTotals)
        .map(([playerId, victorias]) => {
          const player = playersMap.get(playerId);
          return {
            id: playerId,
            nombre: player?.name || playerId,
            equipo: player?.teamName || player?.equipo || "",
            victorias,
          };
        })
        .sort((a, b) => b.victorias - a.victorias || a.nombre.localeCompare(b.nombre));

      setPlayerMostVotes(voteRanking[0] || null);
      setPlayerYearLeader(vpRanking[0] || null);
    } catch (err) {
      console.error("Home load error", err);
      setError("Error al cargar");
      setNews([]);
      setMatches([]);
      setPlayers([]);
      setTeams([]);
      setFavoriteRanking([]);
      setOpenVote(null);
      setPlayerMostVotes(null);
      setPlayerYearLeader(null);
      setTeamGoalsLeader(null);
      setTeamConcededLeader(null);
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadFavoriteTeams().then(setFavoriteTeamIds).catch(() => setFavoriteTeamIds([]));
  }, []);

  useEffect(() => {
    navigation.setParams({ division });
  }, [division, navigation]);

  const goTo = (screen) => {
    navigation.navigate(screen, { division });
  };

  const teamsMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const playersMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const ultimaFecha = useMemo(() => {
    if (!matches.length) return 0;
    return matches.reduce((max, match) => {
      const value = Number(match.fechaNumero || 0);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);
  }, [matches]);

  const latestNews = news[0] || null;
  const nextMatch = useMemo(() => computeNextMatch(matches, teamsMap), [matches, teamsMap]);
  const topScorer = useMemo(() => computeTopScorer(matches, playersMap), [matches, playersMap]);

  const topFavorite = useMemo(() => {
    const list = favoriteRanking
      .filter((item) => item.divisionId === division || !item.divisionId)
      .sort((a, b) => b.count - a.count);
    if (!list.length || list[0].count <= 0) return null;
    const team = teamsMap.get(list[0].teamId);
    return { name: team?.name || list[0].teamId, count: list[0].count };
  }, [favoriteRanking, teamsMap, division]);

  const myFavoriteTeam = useMemo(() => {
    if (!favoriteTeamIds.length) return null;
    const teamId = favoriteTeamIds[0];
    const team = teamsMap.get(teamId);
    return { id: teamId, name: team?.name || teamId, divisionId: team?.divisionId || division };
  }, [favoriteTeamIds, teamsMap, division]);

  const voteInfo = useMemo(() => {
    if (!openVote) return null;
    const closeDate = parseDate(openVote.cierra);
    if (!closeDate) return { label: "Votación abierta", detail: "Sin fecha de cierre" };
    const diffMs = closeDate.getTime() - Date.now();
    if (diffMs <= 0) return { label: "Votación cerrando", detail: "Cierra en instantes" };
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const detail = hours > 0 ? `${hours}h ${minutes}m restantes` : `${minutes} minutos restantes`;
    return { label: "Votación abierta", detail };
  }, [openVote]);

  const summaryCards = [
    {
      title: "Última noticia",
      content: latestNews ? `${latestNews.title || latestNews.titulo || ""}\n${formatDate(latestNews.dateIso)}` : "Sin noticias",
      onPress: () => goTo("Noticias"),
    },
    {
      title: "Próximo partido",
      content: nextMatch
        ? `${nextMatch.localName} vs ${nextMatch.visitanteName}\n${formatDate(nextMatch.dateIso)}`
        : "Sin partidos programados",
      onPress: () => goTo("Partidos"),
    },
    {
      title: "Máximo goleador",
      content: topScorer
        ? `${topScorer.nombre}${topScorer.equipo ? ` (${topScorer.equipo})` : ""}\n${topScorer.goles} goles`
        : "Sin goles registrados",
      onPress: () => goTo("Goleadores (goles)"),
    },
    {
      title: "Equipo más favorito",
      content: topFavorite ? `${topFavorite.name}\n${topFavorite.count} favoritos` : "Nada marcado aún",
      onPress: () => goTo("Equipos"),
    },
    {
      title: "Equipo más goleador",
      content: teamGoalsLeader ? `${teamGoalsLeader.nombre}\n${teamGoalsLeader.goles} goles` : "Sin goles registrados",
      onPress: () => goTo("Partidos"),
    },
    {
      title: "Equipo más goleado",
      content: teamConcededLeader
        ? `${teamConcededLeader.nombre}\n${teamConcededLeader.goles} goles en contra`
        : "Sin datos todavía",
      onPress: () => goTo("Partidos"),
    },
    {
      title: "Jugador de la fecha",
      content: voteInfo ? `${voteInfo.label}\n${voteInfo.detail}` : "No hay votación abierta",
      onPress: () => goTo("Jugador de la fecha"),
    },
    {
      title: "Jugador con más votos",
      content: playerMostVotes
        ? `${playerMostVotes.nombre}${playerMostVotes.equipo ? ` (${playerMostVotes.equipo})` : ""}\n${playerMostVotes.votos} votos`
        : "Sin historial todavía",
      onPress: () => goTo("Jugador del año"),
    },
    {
      title: "Jugador del año (VP)",
      content: playerYearLeader
        ? `${playerYearLeader.nombre}${playerYearLeader.equipo ? ` (${playerYearLeader.equipo})` : ""}\n${playerYearLeader.victorias} VP`
        : "Sin ganadores todavía",
      onPress: () => goTo("Jugador del año"),
    },
    myFavoriteTeam
      ? {
          title: "Mi equipo favorito",
          content: `${myFavoriteTeam.name}\nToca para ver detalles`,
          onPress: () => navigation.navigate("TeamDetail", {
            division: myFavoriteTeam.divisionId,
            teamId: myFavoriteTeam.id,
          }),
        }
      : {
          title: "Selecciona tu favorito",
          content: "Marca un equipo en la sección Equipos",
          onPress: () => goTo("Equipos"),
        },
  ];

  const links = [
    { screen: "Partidos", label: "Partidos" },
    { screen: "Tabla de posiciones", label: "Tabla de posiciones" },
    { screen: "Goleadores (goles)", label: "Goleadores (goles)" },
    { screen: "Jugador del año", label: "Jugador del año" },
    { screen: "Jugador de la fecha", label: "Jugador de la fecha" },
    { screen: "Equipos", label: "Equipos" },
    { screen: "Extras", label: "Extras" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Noticias", { division })}>
          <Text style={styles.actionText}>Noticias</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.openDrawer()}>
          <Text style={styles.actionText}>Menú</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Liga Local - División {division}</Text>

      <View style={styles.row}>
        {["A", "B"].map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.divBtn, division === key && styles.active]}
            onPress={() => setDivision(key)}
          >
            <Text style={[styles.divText, division === key && styles.divTextActive]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.campo} style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={styles.info} onPress={load}>
          Error al cargar datos. Toca para reintentar.
        </Text>
      ) : (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.info}>Última fecha disputada: {ultimaFecha}</Text>
        </View>
      )}

      {!loading && !error ? (
        <View style={styles.summary}>
          {summaryCards.map((card) => (
            <TouchableOpacity key={card.title} style={styles.card} onPress={card.onPress}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardBody}>{card.content}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.links}>
        {links.map((item) => (
          <TouchableOpacity key={item.screen} style={styles.linkBtn} onPress={() => goTo(item.screen)}>
            <Text style={styles.linkText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: APP_COLORS.fondo },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: APP_COLORS.texto },
  row: { flexDirection: "row", justifyContent: "center", marginBottom: 16, gap: 12 },
  divBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
    backgroundColor: APP_COLORS.blanco,
  },
  active: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "bold" },
  divTextActive: { color: APP_COLORS.blanco },
  info: { textAlign: "center", marginVertical: 10, color: APP_COLORS.texto },
  summary: { marginBottom: 20, gap: 12 },
  card: { backgroundColor: APP_COLORS.blanco, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: APP_COLORS.cielo },
  cardTitle: { fontWeight: "700", fontSize: 16, color: APP_COLORS.texto, marginBottom: 4 },
  cardBody: { color: APP_COLORS.texto },
  links: { marginTop: 12, gap: 12 },
  linkBtn: { backgroundColor: APP_COLORS.campo, padding: 14, borderRadius: 12 },
  linkText: { color: APP_COLORS.blanco, textAlign: "center", fontWeight: "600" },
});
