import React from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Share } from "react-native";
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
  const snippet = body.length > 280 ? `${body.slice(0, 280)}...` : body;
  const meta = [date, teamName].filter(Boolean).join(" • ");
  const sharePayload = [title, meta, snippet].filter(Boolean).join("\n");

  const handleShare = () => {
    Share.share({
      title,
      message: sharePayload,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.detailHeader}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity style={styles.detailShare} onPress={handleShare}>
          <Text style={styles.detailShareText}>Compartir</Text>
        </TouchableOpacity>
      </View>
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
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  detailShare: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
    backgroundColor: APP_COLORS.blanco,
  },
  detailShareText: { color: APP_COLORS.campo, fontWeight: "700" },
  title: { flex: 1, fontSize: 22, fontWeight: "700", color: APP_COLORS.texto },
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
