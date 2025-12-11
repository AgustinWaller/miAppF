import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { APP_COLORS } from "../theme/colors";
import { safeImage, FALLBACK_TEAM, FALLBACK_PLAYER } from "../utils/images";
import { getTeamsByDivision } from "../services/teams";
import { getPlayersByDivision } from "../services/players";
import { getMatchesByDivision } from "../services/matches";
import { getNewsByDivision } from "../services/news";
import { TEAMS_MAP } from "../data/teamsMap";

const normalizeKey = (value) => {
  const raw = String(value || "");
  if (typeof raw.normalize === "function") {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  return raw.toLowerCase();
};

const formatDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
        parsed.getDate()
      ).padStart(2, "0")}`;
    }
    return value;
  }
  try {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate()
    ).padStart(2, "0")}`;
  } catch {
    return "";
  }
};

const resolveTeamName = (teamId, lookup) => {
  const normalized = normalizeKey(teamId);
  const doc = lookup.get(normalized);
  if (doc) {
    return (
      doc.name ||
      doc.nombre ||
      doc.teamName ||
      doc.shortName ||
      doc.id ||
      teamId ||
      "Equipo"
    );
  }
  return TEAMS_MAP[normalized] || TEAMS_MAP[teamId] || teamId || "Equipo";
};

export default function TeamDetailScreen({ route }) {
  const division = route?.params?.division ?? "A";
  const teamParam = route?.params?.team;
  const teamId = route?.params?.teamId || teamParam?.id;
  const navigation = useNavigation();
  const normalizedTeamIdParam = normalizeKey(teamId || teamParam?.id || "");

  const [team, setTeam] = useState(teamParam || null);
  const [players, setPlayers] = useState([]);
  const [divisionPlayers, setDivisionPlayers] = useState([]);
  const [teamMatches, setTeamMatches] = useState([]);
  const [teamNews, setTeamNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!teamId && !teamParam) {
        setError("Equipo no identificado");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const [teamsList, playersList, matchesList, newsList] = await Promise.all([
          getTeamsByDivision(division),
          getPlayersByDivision(division),
          getMatchesByDivision(division),
          getNewsByDivision(division),
        ]);

        setDivisionPlayers(playersList);

        if (!isMounted) return;

        const normalizedId = normalizedTeamIdParam;
        const teamsLookup = new Map(teamsList.map((t) => [normalizeKey(t.id), t]));
        const foundTeam = teamsLookup.get(normalizedId) || teamParam || null;
        setTeam(foundTeam);

        const playersMap = new Map(playersList.map((p) => [String(p.id), p]));
        const goalTotals = {};

        matchesList.forEach((match) => {
          (match.eventos || []).forEach((event) => {
            const type = String(event.tipo || event.type || "").toLowerCase();
            if (!type.includes("gol")) return;
            const pid = String(
              event.jugadorId ||
                event.playerId ||
                event.player ||
                event.jugador ||
                ""
            );
            if (!pid) return;
            const player = playersMap.get(pid);
            if (!player) return;
            if (normalizeKey(player.teamId) !== normalizedId) return;
            goalTotals[pid] = (goalTotals[pid] || 0) + 1;
          });
        });

        const squad = playersList
          .filter((p) => normalizeKey(p.teamId) === normalizedId)
          .map((p) => {
            const playerIdKey = String(p.id || "");
            const goals = goalTotals[playerIdKey] || 0;
            return {
              ...p,
              golesTotal: goals,
            };
          });
        setPlayers(squad);

        const matchesForTeam = matchesList
          .filter(
            (match) =>
              normalizeKey(match.localId) === normalizedId ||
              normalizeKey(match.visitanteId) === normalizedId
          )
          .map((match) => {
            const localDisplay = resolveTeamName(match.localId, teamsLookup);
            const visitanteDisplay = resolveTeamName(match.visitanteId, teamsLookup);
            const fechaLabel = match.fechaNumero
              ? `Fecha ${match.fechaNumero}`
              : formatDate(match.dateIso);
            return {
              ...match,
              isLocal: normalizeKey(match.localId) === normalizedId,
              localDisplay,
              visitanteDisplay,
              fechaLabel,
            };
          })
          .sort((a, b) => String(a.dateIso).localeCompare(String(b.dateIso)));
        setTeamMatches(matchesForTeam);

        const teamKeys = [
          normalizedId,
          normalizeKey(foundTeam?.id),
          normalizeKey(foundTeam?.name),
          normalizeKey(foundTeam?.shortName),
        ].filter(Boolean);

        const newsForTeam = newsList
          .filter((news) => {
            const newsTeam = normalizeKey(news.teamId);
            if (newsTeam && teamKeys.includes(newsTeam)) return true;
            const text = `${news.title || ""} ${news.body || ""}`.toLowerCase();
            return teamKeys.some((key) => key && text.includes(key));
          })
          .sort((a, b) => String(b.dateIso || "").localeCompare(String(a.dateIso || "")));
        setTeamNews(newsForTeam);
      } catch (err) {
        console.error("TeamDetail load error:", err);
        if (isMounted) setError("Error al cargar datos del equipo");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [division, teamId, teamParam]);

  const teamLogo = safeImage(
    team?.logoUrl || team?.logoURL || team?.logo || "",
    FALLBACK_TEAM
  );

  const topScorers = useMemo(() => {
    if (!players.length) return [];
    return [...players]
      .map((p) => ({
        ...p,
        golesTotal: Number(p.golesTotal ?? p.goles ?? p.goals ?? 0),
      }))
      .sort(
        (a, b) =>
          b.golesTotal - a.golesTotal ||
          (a.name || a.nombre || "").localeCompare(b.name || b.nombre || "")
      )
      .slice(0, 5);
  }, [players]);

  const orderedPlayers = useMemo(() => {
    if (!players.length) return [];
    return [...players].sort((a, b) =>
      (a.name || a.nombre || "").localeCompare(b.name || b.nombre || "")
    );
  }, [players]);


  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={APP_COLORS.campo} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.empty}>{error}</Text>
      </View>
    );
  }

  const listHeader = (
    <View>
      <View style={styles.header}>
        <Image source={teamLogo} style={styles.teamLogo} resizeMode="contain" />
        <Text style={styles.title}>{team?.name || team?.nombre || "Equipo"}</Text>
      </View>

      <Text style={styles.subtitle}>Top 5 goleadores</Text>
      {topScorers.length ? (
        topScorers.map((player, index) => (
          <View key={player.id} style={styles.scorerRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.scorerName}>{player.name || player.nombre || "Sin nombre"}</Text>
            <Text style={styles.scorerGoals}>
              {player.golesTotal} gol{player.golesTotal === 1 ? "" : "es"}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Aun no hay goles cargados.</Text>
      )}

      <Text style={styles.subtitle}>Noticias del equipo</Text>
      {teamNews.length ? (
        teamNews.map((news) => {
          const imageUrl = news.image_url || news.imageUrl || news.imageURL || "";
          return (
            <TouchableOpacity
              key={news.id}
              style={styles.newsCard}
              onPress={() => navigation.navigate("NewsDetail", { news })}
            >
              <Text style={styles.newsTitle}>{news.title}</Text>
              <Text style={styles.newsDate}>{formatDate(news.dateIso || news.date_iso)}</Text>
              {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.newsImage} /> : null}
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.empty}>No hay noticias disponibles.</Text>
      )}
      <Text style={styles.subtitle}>Plantel</Text>
    </View>
  );

  const listFooter = (
    <View style={{ marginTop: 20 }}>
      <Text style={[styles.subtitle, { marginTop: 20 }]}>Partidos disputados</Text>
      {teamMatches.length ? (
        teamMatches.map((match) => (
          <TouchableOpacity
            key={match.id}
            style={styles.matchRow}
            onPress={() =>
              navigation.navigate("ScoreDetail", {
                division,
                match,
                jugadores: divisionPlayers,
              })
            }
          >
            <Text style={styles.matchLabel}>{match.fechaLabel}</Text>
            <Text style={styles.matchText}>
              {match.localDisplay} {match.golesLocal ?? "-"} - {match.golesVisitante ?? "-"}{" "}
              {match.visitanteDisplay}
            </Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.empty}>Este equipo todavía no disputa partidos.</Text>
      )}
    </View>
  );

  const renderPlayer = ({ item }) => {
    const photo = safeImage(item?.photoUrl || item?.photoURL || "", { uri: FALLBACK_PLAYER });
    const playerName = item.name || item.nombre || "Sin nombre";
    const goals = Number(item.golesTotal ?? item.goles ?? 0);
    return (
      <View style={styles.playerRow}>
        <Image source={photo} style={styles.avatar} resizeMode="cover" />
        <Text style={styles.playerName}>{playerName}</Text>
        <Text style={styles.goals}>
          {goals} gol{goals === 1 ? "" : "es"}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orderedPlayers}
        keyExtractor={(item) => item.id}
        renderItem={renderPlayer}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={<Text style={styles.empty}>No hay jugadores cargados.</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  header: { alignItems: "center", marginBottom: 16 },
  teamLogo: { width: 96, height: 96, resizeMode: "contain", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: APP_COLORS.texto },
  subtitle: { fontSize: 16, marginTop: 16, fontWeight: "700", color: APP_COLORS.texto },
  scorerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: APP_COLORS.blanco,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    marginTop: 8,
  },
  rank: { width: 24, fontWeight: "700", color: APP_COLORS.campo },
  scorerName: { flex: 1, fontWeight: "600", color: APP_COLORS.texto },
  scorerGoals: { fontWeight: "700", color: APP_COLORS.campo },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: APP_COLORS.blanco,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: APP_COLORS.cielo },
  playerName: { flex: 1, fontSize: 14, color: APP_COLORS.texto, fontWeight: "600" },
  goals: { fontSize: 14, fontWeight: "700", color: APP_COLORS.campo },
  newsCard: {
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    padding: 12,
    marginTop: 8,
  },
  newsTitle: { fontWeight: "700", color: APP_COLORS.texto, marginBottom: 4 },
  newsDate: { color: APP_COLORS.campo, fontWeight: "600", marginBottom: 4 },
  newsImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: APP_COLORS.cielo,
  },
  newsButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
  },
  newsButtonText: { color: APP_COLORS.campo, fontWeight: "700" },
  noNews: { fontSize: 14, fontStyle: "italic", color: "#666", marginTop: 8 },
  empty: { fontSize: 14, fontStyle: "italic", color: "#666", marginTop: 8, textAlign: "center" },
  matchRow: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: APP_COLORS.blanco,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  matchLabel: { fontWeight: "700", color: APP_COLORS.campo, marginBottom: 4 },
  matchText: { color: APP_COLORS.texto, fontWeight: "600" },
});
