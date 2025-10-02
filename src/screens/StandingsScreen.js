import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { calcularTabla } from "../utils/storage";
import { APP_COLORS } from "../theme/colors";

export default function StandingsScreen({ route, navigation }) {
  const routeDivision = route?.params?.division ?? "A";
  const [division, setDivision] = useState(routeDivision);

  useEffect(() => {
    if (routeDivision !== division) {
      setDivision(routeDivision);
    }
  }, [routeDivision]);

  useEffect(() => {
    navigation?.setParams?.({ division });
  }, [division, navigation]);

  const tabla = useMemo(() => calcularTabla(division), [division]);

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

      <Text style={styles.title}>Tabla - Division {division}</Text>

      <View style={styles.divRow}>
        {(["A", "B"]).map((key) => (
          <TouchableOpacity
            key={key}
            onPress={() => setDivision(key)}
            style={[styles.divBtn, division === key && styles.divBtnActive]}
          >
            <Text style={[styles.divText, division === key && styles.divTextActive]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {(!Array.isArray(tabla) || tabla.length === 0) ? (
        <Text style={styles.empty}>No hay datos para esta division.</Text>
      ) : (
        <>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.equipo, styles.header]}>Equipo</Text>
            <Text style={[styles.cell, styles.header]}>PJ</Text>
            <Text style={[styles.cell, styles.header]}>G</Text>
            <Text style={[styles.cell, styles.header]}>E</Text>
            <Text style={[styles.cell, styles.header]}>P</Text>
            <Text style={[styles.cell, styles.header]}>GF</Text>
            <Text style={[styles.cell, styles.header]}>GC</Text>
            <Text style={[styles.cell, styles.header]}>DG</Text>
            <Text style={[styles.cell, styles.header, styles.pts]}>PTS</Text>
          </View>
          <FlatList
            data={tabla}
            keyExtractor={(item) => item.equipoId}
            renderItem={({ item, index }) => (
              <View style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                <Text style={[styles.cell, styles.equipo]}>{item.nombre}</Text>
                <Text style={styles.cell}>{item.PJ}</Text>
                <Text style={styles.cell}>{item.G}</Text>
                <Text style={styles.cell}>{item.E}</Text>
                <Text style={styles.cell}>{item.P}</Text>
                <Text style={styles.cell}>{item.GF}</Text>
                <Text style={styles.cell}>{item.GC}</Text>
                <Text style={styles.cell}>{item.DG}</Text>
                <Text style={[styles.cell, styles.pts]}>{item.PTS}</Text>
              </View>
            )}
          />
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
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 12, color: APP_COLORS.texto, textAlign: "center" },
  divRow: { flexDirection: "row", gap: 12, marginBottom: 12, justifyContent: "center" },
  divBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  headerRow: { borderBottomWidth: 1, borderBottomColor: APP_COLORS.campo, paddingBottom: 6, marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 0.5, borderColor: "#C8E6C9" },
  rowEven: { backgroundColor: "#E8F5E9" },
  rowOdd: { backgroundColor: APP_COLORS.blanco },
  cell: { width: 40, textAlign: "center", color: APP_COLORS.texto, fontWeight: "600" },
  header: { fontWeight: "800" },
  equipo: { flex: 1, textAlign: "left" },
  pts: { fontWeight: "800", color: APP_COLORS.campo },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 20 },
});
