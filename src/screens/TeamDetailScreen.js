import React, { useMemo } from "react";
import { View, Text, FlatList, StyleSheet, Image } from "react-native";
import { getDivisionData, jugadoresPorEquipo } from "../utils/storage";
import { APP_COLORS } from "../theme/colors";
import { getClubLogo, getPlayerPhoto } from "../assets/images";

export default function TeamDetailScreen({ route }) {
  const division = route?.params?.division ?? "A";
  const teamId = route?.params?.teamId;
  const divData = getDivisionData(division) || { equipos: [] };
  const team = divData.equipos.find((t) => t.id === teamId);

  const plantilla = useMemo(() => jugadoresPorEquipo(division, teamId), [division, teamId]);
  const teamLogo = getClubLogo(teamId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={teamLogo} style={styles.teamLogo} />
        <Text style={styles.title}>{team?.nombre ?? "Equipo"}</Text>
      </View>

      <Text style={styles.subtitle}>Plantel</Text>
      <FlatList
        data={plantilla}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const photo = getPlayerPhoto(item.id);
          return (
            <View style={styles.playerRow}>
              <Image source={photo} style={styles.avatar} />
              <Text style={styles.playerName}>{item.nombre}</Text>
              <Text style={styles.goals}>{item.goles ?? 0} goles</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No hay jugadores cargados.</Text>}
      />

      {team?.news?.length ? (
        <>
          <Text style={styles.subtitle}>Noticias</Text>
          {team.news.map((n, index) => (
            <Text key={`${team.id}-news-${index}`} style={styles.newsItem}>- {n}</Text>
          ))}
        </>
      ) : (
        <Text style={styles.noNews}>No hay noticias disponibles.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  header: { alignItems: "center", marginBottom: 16 },
  teamLogo: { width: 96, height: 96, resizeMode: "contain", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: APP_COLORS.texto },
  subtitle: { fontSize: 16, marginTop: 16, fontWeight: "700", color: APP_COLORS.texto },
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
  newsItem: { fontSize: 14, marginVertical: 2, color: APP_COLORS.texto },
  noNews: { fontSize: 14, fontStyle: "italic", color: "#666", marginTop: 8 },
  empty: { fontSize: 14, fontStyle: "italic", color: "#666", marginTop: 8 },
});
