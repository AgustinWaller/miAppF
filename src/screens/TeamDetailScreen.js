import React, { useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { getDivisionData, jugadoresPorEquipo } from "../utils/storage";
import { APP_COLORS } from "../theme/colors";

export default function TeamDetailScreen({ route, navigation }) {
  const division = route?.params?.division ?? "A";
  const teamId = route?.params?.teamId;
  const divData = getDivisionData(division) || { equipos: [] };
  const team = divData.equipos.find((t) => t.id === teamId);
  const [tab, setTab] = useState("jugadores");

  const plantilla = useMemo(() => jugadoresPorEquipo(division, teamId), [division, teamId]);

  const goHome = () => navigation.navigate("Noticias", { division });

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={goHome}>
          <Text style={styles.actionText}>Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.openDrawer()}>
          <Text style={styles.actionText}>Menu</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{team?.nombre ?? "Equipo"}</Text>

      <View style={styles.tabs}>
        {[
          { key: "jugadores", label: "Jugadores" },
          { key: "noticias", label: "Noticias" },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.tabBtn, tab === item.key && styles.tabBtnActive]}
            onPress={() => setTab(item.key)}
          >
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "jugadores" ? (
        <FlatList
          data={plantilla}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.playerRow}>
              <Text style={styles.playerName}>{item.nombre}</Text>
              <Text style={styles.goals}>{item.goles ?? 0} goles</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay jugadores cargados.</Text>}
        />
      ) : (
        <>
          {team?.news?.length ? (
            team.news.map((n, index) => (
              <Text key={`${team.id}-news-${index}`} style={styles.newsItem}>- {n}</Text>
            ))
          ) : (
            <Text style={styles.empty}>No hay noticias disponibles.</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16, color: APP_COLORS.texto, textAlign: "center" },
  tabs: { flexDirection: "row", gap: 12, marginBottom: 16, justifyContent: "center" },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  tabBtnActive: { backgroundColor: APP_COLORS.campo },
  tabText: { color: APP_COLORS.texto, fontWeight: "700" },
  tabTextActive: { color: APP_COLORS.blanco },
  playerRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: APP_COLORS.blanco, marginBottom: 8, borderWidth: 1, borderColor: "#C8E6C9" },
  playerName: { fontSize: 14, color: APP_COLORS.texto, fontWeight: "600" },
  goals: { fontSize: 14, fontWeight: "700", color: APP_COLORS.campo },
  newsItem: { fontSize: 14, marginVertical: 4, color: APP_COLORS.texto },
  empty: { fontSize: 14, fontStyle: "italic", color: "#666", textAlign: "center", marginTop: 20 },
});
