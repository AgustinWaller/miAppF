import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Alert } from "react-native";
import league from "../data/league.json";
import { getDivisionData, jugadoresPorEquipo } from "../utils/storage";

const DEMO_USER_ID = "demoUser"; // en producción: usar login + backend o AsyncStorage

export default function BestPlayerScreen({ division }) {
  const divData = getDivisionData(division);

  // Detectamos la última votación abierta (si hay)
  const [keyVotacion, setKeyVotacion] = useState(() => {
    const keys = Object.keys(divData.votaciones || {});
    return keys.length ? keys[0] : null;
  });

  const votacion = keyVotacion ? divData.votaciones[keyVotacion] : null;

  // Equipos para seleccionar plantilla
  const [equipoSel, setEquipoSel] = useState(divData.equipos[0]?.id);

  // Jugadores del equipo
  const plantilla = useMemo(() => jugadoresPorEquipo(division, equipoSel), [division, equipoSel]);

  // Conteo en vivo
  const conteo = useMemo(() => {
    if (!votacion) return [];
    const tally = {};
    (votacion.votos || []).forEach(v => {
      tally[v.jugadorId] = (tally[v.jugadorId] || 0) + 1;
    });
    // enriquecer con datos de jugador
    return Object.entries(tally).map(([jugadorId, votos]) => {
      const j = divData.jugadores.find(x => x.id === jugadorId);
      const team = divData.equipos.find(t => t.id === j.equipoId);
      return { jugadorId, votos, nombre: j.nombre, foto: j.foto, equipo: team?.nombre || "" };
    }).sort((a,b) => b.votos - a.votos).slice(0,5);
  }, [votacion, divData]);

  const yaVoto = useMemo(() => {
    if (!votacion) return false;
    return (votacion.votos || []).some(v => v.usuarioId === DEMO_USER_ID);
  }, [votacion]);

  const estaAbierta = useMemo(() => {
    if (!votacion) return false;
    const ahora = new Date();
    return votacion.abierto && ahora >= new Date(votacion.abre) && ahora <= new Date(votacion.cierra);
  }, [votacion]);

  const votar = (jugadorId) => {
    if (!votacion) return;
    if (!estaAbierta) { Alert.alert("La votación no está abierta."); return; }
    if (yaVoto) { Alert.alert("Solo podés votar una vez por fecha."); return; }
    votacion.votos.push({ usuarioId: DEMO_USER_ID, jugadorId });
    Alert.alert("¡Voto registrado!");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Jugador de la fecha — Divisional {division}</Text>
      {!votacion && <Text style={{ color:"#a00" }}>No hay votación configurada en el JSON.</Text>}

      {votacion && (
        <>
          <Text style={styles.periodo}>
            {estaAbierta ? "Votación abierta" : "Votación cerrada"} ·
            Abre: {new Date(votacion.abre).toLocaleString()} ·
            Cierra: {new Date(votacion.cierra).toLocaleString()}
          </Text>

          {/* Selector simple de equipo */}
          <View style={styles.teamRow}>
            {divData.equipos.map(e => (
              <TouchableOpacity
                key={e.id}
                style={[styles.teamBtn, equipoSel===e.id && styles.teamBtnActive]}
                onPress={() => setEquipoSel(e.id)}
              >
                <Text style={{ color: equipoSel===e.id ? "#fff" : "#000" }}>{e.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.subtitle}>Plantilla</Text>
          <FlatList
            data={plantilla}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.playerRow}>
                <Image source={{ uri: item.foto }} style={styles.avatar} />
                <View style={{ flex:1 }}>
                  <Text style={styles.name}>{item.nombre}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.voteBtn, (!estaAbierta || yaVoto) && { opacity:0.5 }]}
                  onPress={() => votar(item.id)}
                  disabled={!estaAbierta || yaVoto}
                >
                  <Text style={styles.voteText}>{yaVoto ? "Votaste" : "Votar"}</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <Text style={styles.subtitle}>Top 5 de la fecha (en vivo)</Text>
          {conteo.length === 0 ? (
            <Text>No hay votos aún.</Text>
          ) : (
            <FlatList
              data={conteo}
              keyExtractor={(i) => i.jugadorId}
              renderItem={({ item, index }) => (
                <View style={styles.playerRow}>
                  <Text style={styles.pos}>{index+1}</Text>
                  <Image source={{ uri: item.foto }} style={styles.avatar} />
                  <View style={{ flex:1 }}>
                    <Text style={styles.name}>{item.nombre}</Text>
                    <Text style={styles.team}>{item.equipo}</Text>
                  </View>
                  <Text style={styles.votes}>{item.votos}</Text>
                </View>
              )}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:16 },
  title:{ fontSize:20, fontWeight:"bold", marginBottom:8 },
  periodo:{ color:"#555", marginBottom:8 },
  subtitle:{ marginTop:12, fontWeight:"700", marginBottom:6 },
  teamRow:{ flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:8 },
  teamBtn:{ borderWidth:1, borderRadius:10, paddingHorizontal:10, paddingVertical:6 },
  teamBtnActive:{ backgroundColor:"#1e1e1e", borderColor:"#1e1e1e" },
  playerRow:{ flexDirection:"row", alignItems:"center", paddingVertical:8, borderBottomWidth:0.5 },
  avatar:{ width:40, height:40, borderRadius:20, marginRight:10 },
  name:{ fontWeight:"600" },
  team:{ color:"#666", fontSize:12 },
  voteBtn:{ backgroundColor:"#1e1e1e", paddingHorizontal:12, paddingVertical:8, borderRadius:10 },
  voteText:{ color:"#fff", fontWeight:"700" },
  pos:{ width:24, textAlign:"center", fontWeight:"700" },
  votes:{ width:36, textAlign:"center", fontWeight:"700" }
});
