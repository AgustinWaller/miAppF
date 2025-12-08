
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { getTeamsByDivision } from "../services/teams";
import {
  loadFavoriteTeams,
  addFavoriteTeam,
  removeFavoriteTeam,
} from "../utils/favoritesStorage";
import {
  getTeamFavorites,
  setTeamFavorite,
} from "../services/teamFavorites";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { TEAMS_MAP } from "../data/teamsMap";
import { APP_COLORS } from "../theme/colors";

const normalizeKey = (value) => {
  const raw = String(value || "");
  if (typeof raw.normalize === "function") {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  return raw.toLowerCase();
};

const TEAM_NAME_LOOKUP = Object.entries(TEAMS_MAP).reduce((acc, [key, value]) => {
  acc[normalizeKey(key)] = value;
  return acc;
}, {});

const findTeamName = (name) => {
  if (!name) return "";
  return TEAM_NAME_LOOKUP[normalizeKey(name)] || "";
};

const resolveTeamName = (team) => {
  if (!team) return "Equipo";

  const candidates = [
    team.name,
    team.nombre,
    team.Nombre,
    team.teamName,
    team.nombreEquipo,
    team.shortName,
    team.sigla,
    team.id,
  ].map((value) => (typeof value === "string" ? value.trim() : ""));

  for (const candidate of candidates) {
    if (!candidate) continue;
    const mapped = findTeamName(candidate);
    if (mapped) return mapped;
  }

  const firstNonEmpty = candidates.find((value) => !!value);
  if (firstNonEmpty) return firstNonEmpty;

  return findTeamName(team.id) || team.id || "Equipo";
};

export default function TeamsScreen({ navigation }) {
  const [division, setDivision] = useState("A");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [favoriteCounts, setFavoriteCounts] = useState(new Map());
  const [userId, setUserId] = useState(null);

  const refreshCounts = useCallback(async () => {
    try {
      const counts = await getTeamFavorites();
      setFavoriteCounts(
        new Map(counts.map((item) => [item.teamId, item.count]))
      );
    } catch (e) {
      console.error("getTeamFavorites error", e);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getTeamsByDivision(division);
      await refreshCounts();

      console.log(`[teams] div=${division} items=${data.length}`);
      setRows(data);
    } catch (e) {
      console.error("Teams load error:", e);
      setError("Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [division, refreshCounts]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadFavoriteTeams()
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUserId(usr?.uid || null);
    });
    return unsubscribe;
  }, []);

  const toggleFavorite = useCallback(
    async (team) => {
      try {
        if (!userId) {
          Alert.alert("Sesión requerida", "Inicia sesión para elegir tu equipo favorito.");
          return;
        }
        const isFavorite = favorites.includes(team.id);
        
        if (!isFavorite && favorites.length > 0 && !favorites.includes(team.id)) {
          Alert.alert(
            "Voto único",
            "Solo podés votar un equipo. Eliminá tu voto actual para elegir otro."
          );
          return;
        }

        if (isFavorite) {
          const updated = await removeFavoriteTeam(team.id);
          setFavorites(updated);

          await setTeamFavorite({
            teamId: team.id,
            userId,
            divisionId: division,
            favorite: false,
          });
        } else {
          const updated = await addFavoriteTeam(team.id);
          setFavorites(updated);

          await setTeamFavorite({
            teamId: team.id,
            userId,
            divisionId: division,
            favorite: true,
          });
        }

        await refreshCounts();
      } catch (e) {
        console.error("toggleFavorite error", e);
      }
    },
    [favorites, division, refreshCounts, userId]
  );

const renderTeam = ({ item }) => {
  const nombre = resolveTeamName(item);

  const count = favoriteCounts.get(item.id) || 0;
  const isFavorite = favorites.includes(item.id);

  return (
    <View style={styles.teamRow}>
      <TouchableOpacity
        style={styles.teamButton}
        onPress={() =>
          navigation.navigate("TeamDetail", {
            division,
            teamId: item.id,
          })
        }
      >
        <View style={styles.teamInfo}>
          <Text style={styles.teamName}>{nombre}</Text>
          <Text style={styles.teamDivision}>División {item.divisionId || division}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.favoriteRow}>
        <TouchableOpacity onPress={() => toggleFavorite(item)}>
          <Text
            style={[
              styles.favoriteIcon,
              isFavorite && styles.favoriteIconActive,
            ]}
          >
            {isFavorite ? "Favorito" : "Elegir"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.favoriteCount}>{count}</Text>
      </View>
    </View>
  );
};


  return (
    <View style={styles.container}>
      <Text style={styles.debug}>
        División {division} • Equipos: {rows.length}
      </Text>

      {/* Selector A / B */}
      <View style={styles.divisionSwitch}>
        {["A", "B"].map((div) => (
          <TouchableOpacity
            key={div}
            style={[
              styles.divButton,
              division === div && styles.activeDivButton,
            ]}
            onPress={() => setDivision(div)}
          >
            <Text
              style={[
                styles.divText,
                division === div && styles.activeDivText,
              ]}
            >
              {div}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={load} style={styles.reload}>
          <Text style={styles.reloadTxt}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      {/* Loader / Lista */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={load}>
          Error al cargar. Toca para reintentar.
        </Text>
      ) : (
        <FlatList
          data={rows}
          renderItem={renderTeam}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No hay equipos.</Text>
          }
          refreshing={loading}
          onRefresh={load}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  divisionSwitch: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  divButton: {
    padding: 10,
    backgroundColor: "#eee",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2f7d32",
  },
  activeDivButton: { backgroundColor: "#2f7d32" },
  divText: { fontWeight: "bold", color: "#2f7d32" },
  activeDivText: { color: "#fff" },
  reload: { marginLeft: "auto" },
  reloadTxt: { color: "#2f7d32", fontWeight: "700" },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d0e8d6",
    backgroundColor: "rgba(13, 71, 29, 0.05)",
    shadowColor: "#0b5024",
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  teamButton: { flex: 1 },
  teamInfo: { flexDirection: "column" },
  teamName: { fontSize: 16, fontWeight: "700", color: APP_COLORS.texto },
  teamDivision: { color: "#5d8f63", fontSize: 12, marginTop: 2 },
  favoriteRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  favoriteIcon: { fontSize: 14, color: "#2f7d32", fontWeight: "700" },
  favoriteIconActive: { color: "#e53935" },
  favoriteCount: { fontSize: 14, color: "#333" },
  empty: { textAlign: "center", marginTop: 24, color: "#333" },
  debug: { color: "#777", marginBottom: 4 },
});

