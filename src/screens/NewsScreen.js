import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Switch,
} from "react-native";
import { getNewsByDivision } from "../services/news";
import { APP_COLORS } from "../theme/colors";
import { TEAMS_MAP } from "../data/teamsMap";
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_OPTIONS,
  NOTIFICATION_SAMPLE_DATA,
} from "../utils/notificationPrefs";
import { sendNotificationByType } from "../utils/notifications";

function formatDate(value) {
  try {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (value?.toDate) {
      const d = value.toDate();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(value);
  } catch {
    return "";
  }
}

const normalizeKey = (value) => {
  const raw = String(value || "");
  if (typeof raw.normalize === "function") {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  return raw.toLowerCase();
};

const DIVISIONS = ["A", "B"];

export default function NewsScreen({ route, navigation }) {
  const initialTeamFilter = route?.params?.teamFilter ?? "";
  const [rows, setRows] = useState([]);
  const [teamFilter, setTeamFilter] = useState(initialTeamFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prefsVisible, setPrefsVisible] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadNotificationPrefs()
      .then((prefs) => {
        if (mounted && prefs) setNotificationPrefs(prefs);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setPrefsLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (route?.params?.teamFilter !== undefined) {
      setTeamFilter(route.params.teamFilter || "");
    }
  }, [route?.params?.teamFilter]);

  const toggleNotificationPref = useCallback((key, value) => {
    setNotificationPrefs((prev) => {
      const next = { ...prev, [key]: value };
      saveNotificationPrefs(next);
      return next;
    });
  }, []);

  const handleTestNotification = useCallback((key) => {
    const sample = NOTIFICATION_SAMPLE_DATA[key] || {};
    sendNotificationByType(key, sample, { force: true });
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const perDivision = await Promise.all(
        DIVISIONS.map(async (divKey) => {
          const data = await getNewsByDivision(divKey);
          return data.map((item) => ({
            ...item,
            divisionId: item.divisionId || divKey,
          }));
        })
      );
      const merged = perDivision
        .flat()
        .sort((a, b) =>
          String(b.dateIso || b.date_iso || "").localeCompare(String(a.dateIso || a.date_iso || ""))
        );
      setRows(merged);
    } catch (e) {
      console.error("News load error:", e);
      setError("Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(
    () =>
      rows.map((item) => {
        const teamId = item.teamId || item.team_id || "";
        const normalized = normalizeKey(teamId);
        const friendlyName =
          item.teamName ||
          item.team ||
          TEAMS_MAP[normalized] ||
          TEAMS_MAP[teamId] ||
          "";
        return {
          ...item,
          teamId,
          teamName: friendlyName,
          title: item.title || item.titulo,
          body: item.body || item.descripcion,
          date_iso: item.date_iso || formatDate(item.dateIso),
          image_url: item.image_url || item.imageURL || item.imageUrl || "",
        };
      }),
    [rows]
  );

  const normalizedTeamFilter = normalizeKey(teamFilter);

  const filteredItems = useMemo(() => {
    if (!normalizedTeamFilter) return items;
    return items.filter((item) => {
      const newsTeam = normalizeKey(item.teamId);
      if (newsTeam && newsTeam === normalizedTeamFilter) return true;
      const text = `${item.title || ""} ${item.body || ""}`.toLowerCase();
      return normalizedTeamFilter && text.includes(normalizedTeamFilter);
    });
  }, [items, normalizedTeamFilter]);

  const filterName = useMemo(() => {
    if (!normalizedTeamFilter) return "";
    return TEAMS_MAP[normalizedTeamFilter] || teamFilter;
  }, [normalizedTeamFilter, teamFilter]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Noticias</Text>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => setPrefsVisible(true)}
          accessibilityLabel="Preferencias de notificaciones"
        >
          <Text style={styles.notificationIcon}>🔔</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.debug}>Noticias totales: {filteredItems.length}</Text>

      {normalizedTeamFilter ? (
        <View style={styles.filterBanner}>
          <Text style={styles.filterText}>
            Filtrando por: {filterName || teamFilter || "Equipo"}
          </Text>
          <TouchableOpacity onPress={() => setTeamFilter("")}>
            <Text style={styles.clearFilter}>Quitar filtro</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.campo} style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={load}>
          Error al cargar. Toca para reintentar.
        </Text>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("NewsDetail", { news: item })}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.date}>{item.date_iso}</Text>
              {item.teamName ? <Text style={styles.teamChip}>{item.teamName}</Text> : null}
              {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} /> : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {normalizedTeamFilter ? "No hay noticias para este equipo." : "No hay noticias para mostrar."}
            </Text>
          }
          onRefresh={load}
          refreshing={loading}
        />
      )}

      <Modal
        visible={prefsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPrefsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Notificaciones</Text>
            <FlatList
              data={NOTIFICATION_OPTIONS}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <View style={styles.prefRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prefLabel}>{item.label}</Text>
                    {item.description ? <Text style={styles.prefDescription}>{item.description}</Text> : null}
                  </View>
                  <Switch
                    value={Boolean(notificationPrefs[item.key])}
                    onValueChange={(value) => toggleNotificationPref(item.key, value)}
                    disabled={!prefsLoaded}
                  />
                  <TouchableOpacity
                    style={styles.testButton}
                    onPress={() => handleTestNotification(item.key)}
                    disabled={!prefsLoaded}
                  >
                    <Text style={styles.testButtonText}>Probar</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            <TouchableOpacity style={styles.closePrefsBtn} onPress={() => setPrefsVisible(false)}>
              <Text style={styles.closePrefsText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  screenTitle: { fontSize: 22, fontWeight: "700", color: APP_COLORS.texto },
  notificationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
    backgroundColor: APP_COLORS.blanco,
  },
  notificationIcon: { fontSize: 18, color: APP_COLORS.campo },
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo,
    marginBottom: 12,
  },
  filterText: { color: APP_COLORS.texto, fontWeight: "600" },
  clearFilter: { color: APP_COLORS.campo, fontWeight: "700" },
  list: { flex: 1 },
  card: {
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo,
  },
  title: { fontSize: 18, fontWeight: "700", color: APP_COLORS.texto, marginBottom: 4 },
  date: { color: APP_COLORS.campo, marginBottom: 8, fontWeight: "600" },
  teamChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: APP_COLORS.cielo,
    color: APP_COLORS.texto,
    fontWeight: "700",
    marginBottom: 8,
  },
  image: { width: "100%", height: 180, borderRadius: 12, marginBottom: 8, backgroundColor: APP_COLORS.cielo },
  body: { fontSize: 14, color: APP_COLORS.texto },
  empty: { textAlign: "center", marginTop: 40, color: APP_COLORS.texto },
  debug: { color: "#777", marginBottom: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: APP_COLORS.texto, marginBottom: 12 },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    gap: 10,
  },
  prefLabel: { fontSize: 16, fontWeight: "600", color: APP_COLORS.texto },
  prefDescription: { fontSize: 12, color: "#555" },
  testButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
  },
  testButtonText: { fontSize: 12, color: APP_COLORS.campo, fontWeight: "600" },
  closePrefsBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: APP_COLORS.campo,
  },
  closePrefsText: { textAlign: "center", color: APP_COLORS.blanco, fontWeight: "700" },
});
