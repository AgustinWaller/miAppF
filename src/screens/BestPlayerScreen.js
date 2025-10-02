import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Alert } from "react-native";
import {
  getDivisionData,
  jugadoresPorEquipo,
  calcularGanadoresVotaciones,
  getJugador,
} from "../utils/storage";
import { APP_COLORS } from "../theme/colors";

const DEMO_USER_ID = "demoUser";

export default function BestPlayerScreen({ route, navigation }) {
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

  const divData = useMemo(() => getDivisionData(division) || { votaciones: {}, equipos: [], jugadores: [] }, [division]);

  const votacionesKeys = useMemo(() => {
    return Object.keys(divData.votaciones || {}).sort((a, b) => (b > a ? 1 : -1));
  }, [divData]);

  const [keyVotacion, setKeyVotacion] = useState(() => votacionesKeys[0] || null);

  useEffect(() => {
    setKeyVotacion(votacionesKeys[0] || null);
  }, [votacionesKeys]);

  const votacion = keyVotacion ? divData.votaciones[keyVotacion] : null;
  const [equipoSel, setEquipoSel] = useState(divData.equipos[0]?.id);

  useEffect(() => {
    setEquipoSel(divData.equipos[0]?.id);
  }, [divData]);

  const plantilla = useMemo(() => jugadoresPorEquipo(division, equipoSel), [division, equipoSel]);

  const topFecha = useMemo(() => {
    if (!votacion) return [];
    const tally = {};
    (votacion.votos || []).forEach((v) => {
      tally[v.jugadorId] = (tally[v.jugadorId] || 0) + 1;
    });
    return Object.entries(tally)
      .map(([jugadorId, votos]) => {
        const jugador = getJugador(division, jugadorId);
        if (!jugador) return null;
        const team = divData.equipos.find((t) => t.id === jugador.equipoId);
        return {
          jugadorId,
          votos,
          nombre: jugador.nombre,
          foto: jugador.foto,
          equipo: team?.nombre || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
      .slice(0, 5);
  }, [votacion, divData, division]);

  const rankingAnual = useMemo(() => {
    const mapa = calcularGanadoresVotaciones(division);
    return Object.entries(mapa)
      .map(([jugadorId, puntos]) => {
        const jugador = getJugador(division, jugadorId);
        if (!jugador) return null;
        const team = divData.equipos.find((t) => t.id === jugador.equipoId);
        return {
          jugadorId,
          puntos,
          nombre: jugador.nombre,
          equipo: team?.nombre || "",
          foto: jugador.foto,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
      .slice(0, 5);
  }, [division, divData]);

  const yaVoto = useMemo(() => {
    if (!votacion) return false;
    return (votacion.votos || []).some((v) => v.usuarioId === DEMO_USER_ID);
  }, [votacion]);

  const estaAbierta = useMemo(() => {
    if (!votacion) return false;
    const ahora = new Date();
    const abre = new Date(votacion.abre);
    const cierra = new Date(votacion.cierra);
    const day = ahora.getDay();
    const esEntreLunesYSabado = day >= 1 && day <= 6;
    return votacion.abierto && esEntreLunesYSabado && ahora >= abre && ahora <= cierra;
  }, [votacion]);

  const votar = (jugadorId) => {
    if (!votacion) return;
    if (!estaAbierta) {
      Alert.alert("La votacion no esta abierta en este momento.");
      return;
    }
    if (yaVoto) {
      Alert.alert("Solo podes votar una vez por fecha.");
      return;
    }
    votacion.votos.push({ usuarioId: DEMO_USER_ID, jugadorId });
    Alert.alert("Voto registrado");
  };

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

      <Text style={styles.title}>Jugador de la fecha - Division {division}</Text>

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

      {votacionesKeys.length > 1 ? (
        <View style={styles.votacionesRow}>
          {votacionesKeys.map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => setKeyVotacion(key)}
              style={[styles.votacionBtn, keyVotacion === key && styles.votacionBtnActiva]}
            >
              <Text style={[styles.votacionText, keyVotacion === key && styles.votacionTextActiva]}>
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!votacion && <Text style={styles.warning}>No hay votacion configurada.</Text>}

      {votacion && (
        <>
          <Text style={styles.periodo}>
            {estaAbierta ? "Votacion abierta" : "Votacion cerrada"} -
            Abre: {new Date(votacion.abre).toLocaleString()} -
            Cierra: {new Date(votacion.cierra).toLocaleString()} -
            Ventana: lunes a sabado
          </Text>

          <View style={styles.teamRow}>
            {divData.equipos.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.teamBtn, equipoSel === e.id && styles.teamBtnActive]}
                onPress={() => setEquipoSel(e.id)}
              >
                <Text style={[styles.teamText, equipoSel === e.id && styles.teamTextActive]}>{e.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.subtitle}>Plantel</Text>
          <FlatList
            data={plantilla}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item }) => (
              <View style={styles.playerRow}>
                <Image source={{ uri: item.foto }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.nombre}</Text>
                  <Text style={styles.teamSmall}>Goles en el torneo: {item.goles}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.voteBtn, (!estaAbierta || yaVoto) && { opacity: 0.5 }]}
                  onPress={() => votar(item.id)}
                  disabled={!estaAbierta || yaVoto}
                >
                  <Text style={styles.voteText}>{yaVoto ? "Votaste" : "Votar"}</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No hay jugadores para este equipo.</Text>}
          />

          <Text style={styles.subtitle}>Top 5 de la fecha</Text>
          {topFecha.length === 0 ? (
            <Text style={styles.empty}>No hay votos aun.</Text>
          ) : (
            <FlatList
              data={topFecha}
              keyExtractor={(item) => item.jugadorId}
              renderItem={({ item, index }) => (
                <View style={styles.playerRow}>
                  <Text style={styles.pos}>{index + 1}</Text>
                  <Image source={{ uri: item.foto }} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.nombre}</Text>
                    <Text style={styles.team}>{item.equipo}</Text>
                  </View>
                  <Text style={styles.votes}>{item.votos}</Text>
                </View>
              )}
            />
          )}

          <Text style={styles.subtitle}>Top 5 del anio</Text>
          {rankingAnual.length === 0 ? (
            <Text style={styles.empty}>Todavia no hay ganadores registrados.</Text>
          ) : (
            <FlatList
              data={rankingAnual}
              keyExtractor={(item) => item.jugadorId}
              renderItem={({ item, index }) => (
                <View style={styles.playerRow}>
                  <Text style={styles.pos}>{index + 1}</Text>
                  <Image source={{ uri: item.foto }} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.nombre}</Text>
                    <Text style={styles.team}>{item.equipo}</Text>
                  </View>
                  <Text style={styles.votes}>{item.puntos}</Text>
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
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 8, color: APP_COLORS.texto, textAlign: "center" },
  periodo: { color: APP_COLORS.texto, marginBottom: 8, textAlign: "center" },
  subtitle: { marginTop: 12, fontWeight: "700", marginBottom: 6, color: APP_COLORS.texto },
  divRow: { flexDirection: "row", gap: 12, marginBottom: 12, justifyContent: "center" },
  divBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  votacionesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 12 },
  votacionBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderColor: APP_COLORS.cielo, backgroundColor: APP_COLORS.blanco },
  votacionBtnActiva: { backgroundColor: APP_COLORS.campo, borderColor: APP_COLORS.campo },
  votacionText: { color: APP_COLORS.texto, fontWeight: "700" },
  votacionTextActiva: { color: APP_COLORS.blanco },
  teamRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8, justifyContent: "center" },
  teamBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  teamBtnActive: { backgroundColor: APP_COLORS.campo },
  teamText: { color: APP_COLORS.texto, fontWeight: "700" },
  teamTextActive: { color: APP_COLORS.blanco },
  playerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5, borderColor: "#C8E6C9", backgroundColor: APP_COLORS.blanco, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: APP_COLORS.cielo },
  name: { fontWeight: "600", color: APP_COLORS.texto },
  team: { color: "#666", fontSize: 12 },
  teamSmall: { color: "#666", fontSize: 12 },
  voteBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  voteText: { color: APP_COLORS.blanco, fontWeight: "700" },
  pos: { width: 24, textAlign: "center", fontWeight: "700", color: APP_COLORS.campo },
  votes: { width: 36, textAlign: "center", fontWeight: "700", color: APP_COLORS.campo },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 8 },
  warning: { color: "#B71C1C", textAlign: "center", marginTop: 12 },
});
