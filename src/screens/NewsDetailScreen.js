import React from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { APP_COLORS } from "../theme/colors";

function resolveDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
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

export default function NewsDetailScreen({ route }) {
  const news = route?.params?.news || {};
  const title = news.title || news.titulo || "Noticia";
  const date = news.date_iso || resolveDate(news.dateIso);
  const body = news.body || news.descripcion || "";
  const teamName = news.teamName || news.team || "";
  const imageUrl = news.image_url || news.imageURL || news.imageUrl || "";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {date ? <Text style={styles.date}>{date}</Text> : null}
      {teamName ? <Text style={styles.teamChip}>{teamName}</Text> : null}
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : null}
      <Text style={styles.body}>{body || "Sin contenido disponible."}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.fondo },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: APP_COLORS.texto, marginBottom: 8 },
  date: { color: APP_COLORS.campo, marginBottom: 6, fontWeight: "600" },
  teamChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: APP_COLORS.cielo,
    color: APP_COLORS.texto,
    fontWeight: "700",
    marginBottom: 10,
  },
  image: { width: "100%", height: 220, borderRadius: 14, marginBottom: 12, backgroundColor: APP_COLORS.cielo },
  body: { fontSize: 16, lineHeight: 24, color: APP_COLORS.texto },
});
