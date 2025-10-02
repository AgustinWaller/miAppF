import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { calcularTabla } from "../utils/storage";

export default function StandingsScreen({ division }) {
  const tabla = calcularTabla(division);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tabla â€” Divisional {division}</Text>
      {(!Array.isArray(tabla) || tabla.length===0) && (
        <Text style={{marginVertical:8}}>No hay datos para esta división.</Text>
      )}
      <FlatList
        data={tabla}
        keyExtractor={(item) => item.equipoId}
        renderItem={({ item }) => (
          <View style={styles.row}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:16 },
  title:{ fontSize:20, fontWeight:"bold", marginBottom:12 },
  headerRow:{ flexDirection:"row", borderBottomWidth:1, paddingBottom:6, marginBottom:6 },
  row:{ flexDirection:"row", paddingVertical:8, borderBottomWidth:0.5 },
  cell:{ width:40, textAlign:"center" },
  header:{ fontWeight:"bold" },
  equipo:{ flex:1, textAlign:"left" },
  pts:{ fontWeight:"bold" }
});

