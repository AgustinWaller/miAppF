import React, { useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import league from "../data/league.json";
import { getDivisionData, getUltimaFechaNumero, partidosPorFecha, nombreEquipo } from "../utils/leagueUtils";

export default function MatchesScreen({ division }) {
  const ultimaFecha = getUltimaFechaNumero(division);
  const [fechaSel, setFechaSel] = useState(ultimaFecha);
  const [comentario, setComentario] = useState(""); // texto nuevo
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  const partidos = useMemo(() => partidosPorFecha(division, fechaSel), [division, fechaSel]);
  const divData = getDivisionData(division);

  const agregarComentario = (matchId) => {
    if (!comentario.trim()) return;
    if (comentario.length > 500) {
      Alert.alert("Máximo 500 caracteres");
      return;
    }
    // Demo: mutamos en memoria (en app real, guardarías en backend/AsyncStorage)
    const match = divData.partidos.find(p => p.id === matchId);
    match.comentarios = match.comentarios || [];
    match.comentarios.push({
      usuario: "demoUser",
      texto: comentario.trim(),
      timestamp: new Date().toISOString()
    });
    setComentario("");
    setSelectedMatchId(null);
    Alert.alert("Comentario agregado");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Partidos — Divisional {division}</Text>

      <View style={styles.filtro}>
        <Text style={{ marginRight:8 }}>Fecha:</Text>
        {[...new Set(divData.partidos.map(p => p.fechaNumero))].sort((a,b)=>a-b).map(n => (
          <TouchableOpacity key={n} onPress={() => setFechaSel(n)} style={[styles.btnFecha, fechaSel===n && styles.btnFechaActiva]}>
            <Text style={{ color: fechaSel===n ? "#fff" : "#000" }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={partidos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const local = nombreEquipo(division, item.localId);
          const visi = nombreEquipo(division, item.visitanteId);
          return (
            <View style={styles.matchCard}>
              <Text style={styles.matchLine}>
                {local} {item.golesLocal} - {item.golesVisitante} {visi}
              </Text>
              <Text style={styles.dateLine}>Jugado el {item.fechaCalendario}</Text>

              <Text style={styles.commentsTitle}>Comentarios</Text>
              {(item.comentarios || []).map((c, idx) => (
                <Text key={idx} style={styles.commentItem}>• {c.usuario}: {c.texto}</Text>
              ))}

              {selectedMatchId === item.id ? (
                <View style={{ marginTop:8 }}>
                  <TextInput
                    value={comentario}
                    onChangeText={setComentario}
                    placeholder="Escribe tu comentario (máx 500)"
                    style={styles.input}
                    multiline
                    maxLength={500}
                  />
                  <View style={{ flexDirection:"row", gap:8, marginTop:6 }}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => agregarComentario(item.id)}>
                      <Text style={styles.btnText}>Agregar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => { setComentario(""); setSelectedMatchId(null); }}>
                      <Text>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={[styles.btnPrimary, { marginTop:8 }]} onPress={() => setSelectedMatchId(item.id)}>
                  <Text style={styles.btnText}>Comentar</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:16 },
  title:{ fontSize:20, fontWeight:"bold", marginBottom:12 },
  filtro:{ flexDirection:"row", alignItems:"center", flexWrap:"wrap", gap:6, marginBottom:12 },
  btnFecha:{ borderWidth:1, borderRadius:8, paddingHorizontal:10, paddingVertical:6 },
  btnFechaActiva:{ backgroundColor:"#1e1e1e", borderColor:"#1e1e1e" },
  matchCard:{ borderWidth:1, borderRadius:12, padding:12, marginBottom:12 },
  matchLine:{ fontSize:16, fontWeight:"600" },
  dateLine:{ color:"#666", marginTop:2 },
  commentsTitle:{ marginTop:8, fontWeight:"700" },
  commentItem:{ marginTop:2 },
  input:{ borderWidth:1, borderRadius:10, padding:10, minHeight:60, textAlignVertical:"top" },
  btnPrimary:{ backgroundColor:"#1e1e1e", padding:10, borderRadius:10 },
  btnSecondary:{ borderWidth:1, borderRadius:10, padding:10 },
  btnText:{ color:"#fff", fontWeight:"600", textAlign:"center" }
});
