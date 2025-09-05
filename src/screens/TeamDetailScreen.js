import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";

export default function TeamDetailScreen({ route }) {
  const { team } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{team.name}</Text>
      <Text style={styles.subtitle}>Plantilla:</Text>
      <FlatList
        data={team.players}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.playerRow}>
            <Text style={styles.playerName}>{item.name}</Text>
            <Text style={styles.goals}>{item.goals} ⚽</Text>
          </View>
        )}
      />
      <Text style={styles.subtitle}>Noticias:</Text>
      {team.news && team.news.length > 0 ? (
        team.news.map((n, index) => (
          <Text key={index} style={styles.newsItem}>• {n}</Text>
        ))
      ) : (
        <Text style={styles.noNews}>No hay noticias disponibles.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  subtitle: { fontSize: 16, marginTop: 10, fontWeight: "600" },
  playerRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  playerName: { fontSize: 14 },
  goals: { fontSize: 14, fontWeight: "bold" },
  newsItem: { fontSize: 14, marginVertical: 2 },
  noNews: { fontSize: 14, fontStyle: "italic", color: "#666" }
});