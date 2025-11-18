import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { getNewsByDivision } from "../services/news";
import { APP_COLORS } from "../theme/colors";

function formatDate(x) {
  try {
    if (!x) return "";
    if (typeof x === "string") return x;
    if (x?.toDate) {
      const d = x.toDate();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(x);
  } catch { return ""; }
}

export default function NewsScreen({ route, navigation }) {
  const routeDivision = route?.params?.division ?? "A";
  const [division, setDivision] = useState(routeDivision);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { if (routeDivision !== division) setDivision(routeDivision); }, [routeDivision]);
  useEffect(() => { navigation?.setParams?.({ division }); }, [division, navigation]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getNewsByDivision(division);
      console.log(`[news] div=${division} items=${data.length}`);
      setRows(data);
    } catch (e) {
      console.error("News load error:", e);
      setError("Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => rows.map(item => ({
    ...item,
    title: item.title || item.titulo,
    body: item.body || item.descripcion,
    date_iso: item.date_iso || formatDate(item.dateIso),
    image_url: item.image_url || item.imageURL || item.imageUrl || "",
  })), [rows]);

  const changeDivision = (value) => {
    setDivision(value);
    navigation?.navigate?.("Noticias", { division: value });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.debug}>División {division} • Noticias: {items.length}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Noticias", { division })}>
          <Text style={styles.actionText}>Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.openDrawer()}>
          <Text style={styles.actionText}>Menu</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divRow}>
        {["A", "B"].map((d) => (
          <TouchableOpacity key={d} style={[styles.divBtn, division === d && styles.divBtnActive]} onPress={() => changeDivision(d)}>
            <Text style={[styles.divText, division === d && styles.divTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.campo} style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={load}>Error al cargar. Toca para reintentar.</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.date}>{item.date_iso}</Text>
              {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} /> : null}
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay noticias para esta división.</Text>}
          onRefresh={load}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  divRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  divBtn: { borderWidth: 1, borderColor: APP_COLORS.campo, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  list: { flex: 1 },
  card: { backgroundColor: APP_COLORS.blanco, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: APP_COLORS.cielo },
  title: { fontSize: 18, fontWeight: "700", color: APP_COLORS.texto, marginBottom: 4 },
  date: { color: APP_COLORS.campo, marginBottom: 8, fontWeight: "600" },
  image: { width: "100%", height: 180, borderRadius: 12, marginBottom: 8, backgroundColor: APP_COLORS.cielo },
  body: { fontSize: 14, color: APP_COLORS.texto },
  empty: { textAlign: "center", marginTop: 40, color: APP_COLORS.texto },
  debug: { color: '#777', marginBottom: 4 },
});
