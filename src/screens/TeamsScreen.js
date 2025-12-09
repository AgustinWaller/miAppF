
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import { safeImage, FALLBACK_TEAM } from "../utils/images";

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
    const logoSource = safeImage(
      item.logoUrl || item.logoURL || item.logo || "",
      { uri: FALLBACK_TEAM }
    );

    return (
      <LinearGradient
        colors={["#042C63", "#0B4FA7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.teamCard}
      >
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
            <Image source={logoSource} style={styles.cardLogo} />
            <View>
              <Text style={styles.teamName}>{nombre}</Text>
              <Text style={styles.teamDivision}>Division {item.divisionId || division}</Text>
            </View>
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
      </LinearGradient>
    );
  };


  return (
    <View style={styles.container}>
      <Text style={styles.debug}>
        Division {division} | Equipos: {rows.length}
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
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  divisionSwitch: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  divButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(4,44,99,0.15)",
  },
  activeDivButton: { backgroundColor: APP_COLORS.campo, borderColor: APP_COLORS.campo },
  divText: { fontWeight: "700", color: "#e0ecff" },
  activeDivText: { color: "#fff" },
  reload: { marginLeft: "auto" },
  reloadTxt: { color: "#d1ffea", fontWeight: "700" },
  teamCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#02173b",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamButton: { flex: 1, marginRight: 12 },
  teamInfo: { flexDirection: "row", alignItems: "center", gap: 14 },
  cardLogo: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.2)" },
  teamName: { fontSize: 16, fontWeight: "700", color: "#fff" },
  teamDivision: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  favoriteRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  favoriteIcon: { fontSize: 14, color: "#E0F7FA", fontWeight: "700" },
  favoriteIconActive: { color: "#ffbaba" },
  favoriteCount: { fontSize: 14, color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 24, color: APP_COLORS.texto },
  debug: { color: "#c8e6c9", marginBottom: 4, fontWeight: "600" },
});



