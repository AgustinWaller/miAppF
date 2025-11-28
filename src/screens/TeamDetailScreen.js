import React, { useMemo } from "react";
import { View, Text, FlatList, StyleSheet, Image, ActivityIndicator } from "react-native";
import { useDivisionData } from "../hooks/useDivisionData";
import { jugadoresPorEquipoFromData } from "../utils/storage";
import { APP_COLORS } from "../theme/colors";
import { getClubLogo, getPlayerPhoto } from "../assets/images";
import { safeImage, FALLBACK_TEAM, FALLBACK_PLAYER } from "../utils/images";

export default function TeamDetailScreen({ route }) {
  const division = route?.params?.division ?? "A";
  const teamParam = route?.params?.team;
  const teamId = route?.params?.teamId || teamParam?.id;

  const { data, loading, error, refresh } = useDivisionData(division);

  const team = useMemo(() => {
    if (!data) return teamParam || null;
    return (data.equipos || []).find((t) => t.id === teamId) || teamParam || null;
  }, [data, teamId, teamParam]);

  const plantilla = useMemo(() => {
    if (!data) return [];
    return jugadoresPorEquipoFromData(data, teamId).map((player) => ({
      ...player,
      nombre: player.name || player.nombre,
    }));
  }, [data, teamId]);

  // preferimos la URL desde el documento; si no existe, fallback o getClubLogo
  const teamLogoUri = team?.logoUrl || team?.logoURL || getClubLogo(teamId) || "";
  const teamLogo = safeImage(teamLogoUri, FALLBACK_TEAM);


  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }] }>
        <ActivityIndicator size="large" color={APP_COLORS.campo} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }] }>
        <Text style={styles.empty} onPress={refresh}>
          Error al cargar. Toca para reintentar.
        </Text>
      </View>
    );
  }

  return (
  <View style={styles.container}>

    {/* ENCABEZADO DEL EQUIPO */}
    <View style={styles.header}>
      <Image
        source={
          teamLogoUri
            ? { uri: teamLogoUri }
            : require("../../assets/no_team.png")
        }
        style={styles.teamLogo}
        resizeMode="contain"
      />

      <Text style={styles.title}>
        {team?.name || team?.nombre || "Equipo"}
      </Text>
    </View>

    {/* LISTA DE JUGADORES */}
    <Text style={styles.subtitle}>Plantel</Text>

    <FlatList
      data={plantilla}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const photo =
          item?.photoUrl || item?.photoURL
            ? { uri: item.photoUrl || item.photoURL }
            : require("../../assets/no_player.png");

        return (
          <View style={styles.playerRow}>
            <Image
              source={photo}
              style={styles.avatar}
              resizeMode="cover"
            />

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
  empty: { fontSize: 14, fontStyle: "italic", color: "#666", marginTop: 8, textAlign: "center" },
});
