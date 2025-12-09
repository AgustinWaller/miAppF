import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { captureRef } from "react-native-view-shot";
import { APP_COLORS } from "../theme/colors";
import { auth } from "../services/firebase";
import { listenProfile } from "../services/profile";
import { listenMatchComments, addMatchComment } from "../services/comments";
import { safeImage, FALLBACK_PLAYER, FALLBACK_TEAM } from "../utils/images";
import { getTeamsByDivision } from "../services/teams";

const normalizeKey = (value) => {
  const raw = String(value || "");
  if (typeof raw.normalize === "function") {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  return raw.toLowerCase();
};

export default function ScoreScreen({ route }) {
  const division = route?.params?.division ?? "A";
  const match = route?.params?.match;
  const jugadores = route?.params?.jugadores || [];

  const [user, setUser] = useState(() => auth.currentUser);
  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [teamDocs, setTeamDocs] = useState([]);
  const shareCardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  const appName = Constants.expoConfig?.name || "MiAppF";
  const shareLink = Constants.expoConfig?.extra?.shareLink || "https://miappf.com";

  const playerMap = useMemo(() => {
    return new Map(
      jugadores.map((player) => [player.id, player.name || player.nombre || player.displayName])
    );
  }, [jugadores]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      return;
    }
    return listenProfile(user.uid, (doc) => setProfile(doc));
  }, [user?.uid]);

  useEffect(() => {
    if (!match?.id) return;
    return listenMatchComments(match.id, (rows) => setComments(rows));
  }, [match?.id]);

  useEffect(() => {
    let mounted = true;
    getTeamsByDivision(division)
      .then((docs) => mounted && setTeamDocs(docs || []))
      .catch(() => mounted && setTeamDocs([]));
    return () => {
      mounted = false;
    };
  }, [division]);

  if (!match) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No se recibieron datos del partido.</Text>
      </View>
    );
  }

  const teamsLookup = useMemo(() => {
    const map = new Map();
    teamDocs.forEach((teamDoc) => {
      map.set(teamDoc.id, teamDoc);
      map.set(normalizeKey(teamDoc.id), teamDoc);
    });
    return map;
  }, [teamDocs]);

  const resolveTeamDoc = (id, name) => {
    return (
      teamsLookup.get(id) ||
      teamsLookup.get(normalizeKey(id)) ||
      teamsLookup.get(name) ||
      teamsLookup.get(normalizeKey(name)) ||
      null
    );
  };

  const localDoc = resolveTeamDoc(match.localId, match.local);
  const visitanteDoc = resolveTeamDoc(match.visitanteId, match.visitante);
  const local = localDoc?.name || localDoc?.nombre || match.localName || match.local || "";
  const visitante =
    visitanteDoc?.name || visitanteDoc?.nombre || match.visitanteName || match.visitante || "";

  const localLogo = safeImage(
    localDoc?.logoUrl || localDoc?.logoURL || localDoc?.logo || "",
    { uri: FALLBACK_TEAM }
  );
  const visitanteLogo = safeImage(
    visitanteDoc?.logoUrl || visitanteDoc?.logoURL || visitanteDoc?.logo || "",
    { uri: FALLBACK_TEAM }
  );
  const localKeywords = useMemo(
    () =>
      [match.localName, match.local, match.localId, localDoc?.name, localDoc?.shortName]
        .map((value) => normalizeKey(value))
        .filter(Boolean),
    [match.localName, match.local, match.localId, localDoc]
  );
  const visitanteKeywords = useMemo(
    () =>
      [
        match.visitanteName,
        match.visitante,
        match.visitanteId,
        visitanteDoc?.name,
        visitanteDoc?.shortName,
      ]
        .map((value) => normalizeKey(value))
        .filter(Boolean),
    [match.visitanteName, match.visitante, match.visitanteId, visitanteDoc]
  );

  const cleanGoalText = (text = "") => {
    let output = String(text || "").replace(/\*/g, "").trim();
    if (!output) return "";
    const separators = [" - ", " â€“ ", " â€” ", "-", ":", "|"];
    separators.forEach((sep) => {
      if (output.includes(sep)) {
        output = output.split(sep).pop().trim();
      }
    });
    output = output.replace(/^gol(es)?\s+de\s+/i, "").replace(/^gol(es)?\s+/i, "");
    return output.trim();
  };

  const getNombreJugador = (event) => {
    if (!event) return "";
    const candidateIds = [
      event.jugadorId,
      event.jugador,
      event.playerId,
      event.player,
      event.idJugador,
    ];
    for (const candidate of candidateIds) {
      if (candidate == null) continue;
      if (playerMap.has(candidate)) return playerMap.get(candidate);
      const asString = String(candidate);
      if (playerMap.has(asString)) return playerMap.get(asString);
    }
    const textCandidates = [
      event.jugadorNombre,
      event.nombre,
      event.description,
      event.descripcion,
      event.detalle,
      event.texto,
      candidateIds.find((c) => c != null) || "",
    ];
    const fallback = textCandidates.find((value) => value && String(value).trim().length);
    const cleaned = cleanGoalText(fallback || "");
    return cleaned || "Gol";
  };
  const commentAvatar = safeImage(profile?.photoUrl || user?.photoURL || "", {
    uri: FALLBACK_PLAYER,
  });

  const formatCommentDate = (value) => {
    if (!value) return "";
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  };

  const handleSend = async () => {
    const body = commentText.trim();
    if (!body) return;
    if (!match?.id || !user?.uid) {
      Alert.alert("Sesion requerida", "Inicia sesion nuevamente para comentar.");
      return;
    }
    setSending(true);
    try {
      const displayName = profile?.displayName || user.displayName || user.email || "Hincha";
      await addMatchComment({
        matchId: match.id,
        text: body,
        userId: user.uid,
        displayName,
        email: user.email || "",
        photoUrl: profile?.photoUrl || user.photoURL || "",
        division,
      });
      setCommentText("");
    } catch (err) {
      Alert.alert("Error", err?.message || "No se pudo enviar el comentario.");
    } finally {
      setSending(false);
    }
  };

  const headerComponent = (
    <>
      <View style={styles.scoreWrapper}>
        <View ref={shareCardRef} collapsable={false}>
          <LinearGradient
            colors={["#042C63", "#0B4FA7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.scoreCard}
          >
            <Text style={styles.scoreLeague}>{appName}</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreTeamLeft}>
                <Image source={localLogo} style={styles.scoreLogo} />
                <Text style={styles.scoreTeamName} numberOfLines={1}>
                  {local}
                </Text>
              </View>
              <View style={styles.scoreNumbers}>
                <Text style={styles.scoreNumber}>{match.golesLocal ?? "-"}</Text>
                <Text style={styles.scoreDash}>-</Text>
                <Text style={styles.scoreNumber}>{match.golesVisitante ?? "-"}</Text>
              </View>
              <View style={styles.scoreTeamRight}>
                <Text style={[styles.scoreTeamName, { textAlign: "right" }]} numberOfLines={1}>
                  {visitante}
                </Text>
                <Image source={visitanteLogo} style={styles.scoreLogo} />
              </View>
            </View>
            {match.fechaCalendario ? (
              <Text style={styles.scoreDate}>{match.fechaCalendario}</Text>
            ) : null}
          </LinearGradient>
        </View>
        <TouchableOpacity
          style={styles.shareResultButton}
          onPress={handleShareScore}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="share-social-outline" color="#fff" size={18} />
              <Text style={styles.shareResultText}>Compartir resultado</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <LinearGradient
        colors={["#0B2748", "#155E30"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.eventsBanner}
      >
        <Text style={styles.eventsBannerTeam}>{local}</Text>
        <View style={styles.eventsBannerDivider} />
        <Text style={styles.eventsBannerTeam}>{visitante}</Text>
      </LinearGradient>
      <Text style={[styles.subtitle, { marginTop: 8 }]}>Eventos</Text>
    </>
  );

  const footerComponent = (
    <View style={styles.commentsSection}>
      <Text style={styles.subtitle}>Comentarios</Text>
      {comments.length ? (
        comments.map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <Image
              source={safeImage(comment.photoUrl, { uri: FALLBACK_PLAYER })}
              style={styles.commentAvatar}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{comment.displayName || "Hincha"}</Text>
                {comment.email ? <Text style={styles.commentEmail}>{comment.email}</Text> : null}
              </View>
              <Text style={styles.commentDate}>{formatCommentDate(comment.createdAt)}</Text>
              <Text style={styles.commentBody}>{comment.body}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Todavia no hay comentarios. Se el primero!</Text>
      )}

      <View style={styles.commentComposer}>
        <Image source={commentAvatar} style={styles.commentComposerAvatar} />
        <TextInput
          style={styles.commentInput}
          placeholder="Escribe tu mensaje..."
          placeholderTextColor="#9db09d"
          multiline
          numberOfLines={3}
          value={commentText}
          onChangeText={setCommentText}
        />
      </View>
      <TouchableOpacity
        style={[
          styles.commentButton,
          (!commentText.trim() || sending) && styles.commentButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!commentText.trim() || sending}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.commentButtonText}>Enviar comentario</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.commentLegal}>
        Mostramos tu nombre y email para identificar cada comentario.
      </Text>
    </View>
  );

  async function handleShareScore() {
    if (!shareCardRef.current) return;
    try {
      setSharing(true);
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 0.92,
        result: "tmpfile",
      });
      const message = `${appName} - ${local} ${match.golesLocal ?? "-"} - ${
        match.golesVisitante ?? "-"
      } ${visitante}\n${shareLink}`;
      await Share.share({
        title: `${local} vs ${visitante}`,
        message,
        url: uri,
      });
    } catch (err) {
      Alert.alert("Error", "No pudimos compartir el resultado.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View style={styles.container}>
        <FlatList
          data={match.eventos || []}
          keyExtractor={(_, index) => `${match.id}-ev-${index}`}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={headerComponent}
          ListFooterComponent={footerComponent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const type = String(item.tipo || "");
            const isGoal = type.toLowerCase().includes("gol");

            let teamKey = normalizeKey(item.teamId || item.team || item.equipo || "");
            if (!teamKey && type) {
              const lower = type.toLowerCase();
              if (localKeywords.some((token) => token && lower.includes(token))) {
                teamKey = "local";
              } else if (visitanteKeywords.some((token) => token && lower.includes(token))) {
                teamKey = "visitante";
              }
            }

            let teamSide = null;
            if (teamKey) {
              if (localKeywords.includes(teamKey)) teamSide = "local";
              else if (visitanteKeywords.includes(teamKey)) teamSide = "visitante";
            }
            if (!teamSide) {
              if (item.golLocal === true) teamSide = "local";
              else if (item.golVisitante === true) teamSide = "visitante";
            }
            if (!teamSide) {
              const hintText = [
                type,
                item.descripcion,
                item.description,
                item.detalle,
                item.texto,
                item.text,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              if (hintText) {
                if (localKeywords.some((token) => token && hintText.includes(token))) {
                  teamSide = "local";
                } else if (visitanteKeywords.some((token) => token && hintText.includes(token))) {
                  teamSide = "visitante";
                }
              }
            }

            const minute = item.minuto || item.minute || item.time || "";
            const playerLabel = getNombreJugador(item);

            if (isGoal && (teamSide === "local" || teamSide === "visitante")) {
              const isLocalEvent = teamSide === "local";
              const gradientColors = isLocalEvent
                ? ["#0B4FA7", "#042C63"]
                : ["#042C63", "#0B4FA7"];
              return (
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: isLocalEvent ? 0 : 1, y: 0 }}
                  end={{ x: isLocalEvent ? 1 : 0, y: 0 }}
                  style={[
                    styles.goalRow,
                    isLocalEvent ? styles.goalRowLeft : styles.goalRowRight,
                  ]}
                >
                  {isLocalEvent ? (
                    <>
                      <Ionicons name="football" size={20} color="#fff" style={styles.goalIconLeft} />
                      <View style={styles.goalInfo}>
                        <Text style={styles.goalPlayer}>{playerLabel}</Text>
                        {minute ? <Text style={styles.goalMinute}>{minute}'</Text> : null}
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.goalInfo, styles.goalInfoRight]}>
                        <Text style={[styles.goalPlayer, styles.goalPlayerRight]}>
                          {playerLabel}
                        </Text>
                        {minute ? <Text style={styles.goalMinute}>{minute}'</Text> : null}
                      </View>
                      <Ionicons name="football" size={20} color="#fff" style={styles.goalIconRight} />
                    </>
                  )}
                </LinearGradient>
              );
            }

            return (
              <View style={styles.eventRow}>
                <Text style={styles.eventType}>{item.tipo}</Text>
                <Text style={styles.eventInfo}>{playerLabel}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No hay eventos para este partido.</Text>}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 8, color: APP_COLORS.texto, textAlign: "center" },
  scoreWrapper: { marginBottom: 16 },
  scoreCard: {
    borderRadius: 24,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  scoreLeague: { textAlign: "center", color: "#fff", fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scoreTeamLeft: { width: "32%", alignItems: "flex-start" },
  scoreTeamRight: { width: "32%", alignItems: "flex-end" },
  scoreTeamName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  scoreLogo: { width: 54, height: 54, borderRadius: 27, marginBottom: 6, backgroundColor: "#1b376b" },
  scoreNumbers: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(4,44,99,0.3)",
  },
  scoreNumber: { fontSize: 32, fontWeight: "800", color: "#fff" },
  scoreDash: { marginHorizontal: 8, fontSize: 22, fontWeight: "700", color: "#fff" },
  scoreDate: { textAlign: "center", color: "#d8e6ff", marginTop: 8, fontWeight: "600" },
  shareResultButton: {
    marginTop: 12,
    backgroundColor: APP_COLORS.campo,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    columnGap: 8,
  },
  shareResultText: { color: "#fff", fontWeight: "700" },
  eventsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  eventsBannerTeam: { color: "#fff", fontWeight: "700", fontSize: 14, flex: 1, textAlign: "center" },
  eventsBannerDivider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.5)" },
  subtitle: { fontSize: 16, fontWeight: "700", marginBottom: 8, marginTop: 12, color: APP_COLORS.texto },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderColor: "#C8E6C9",
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 12,
    marginBottom: 8,
  },
  eventType: { fontWeight: "700", color: APP_COLORS.campo },
  eventInfo: { color: APP_COLORS.texto },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 12,
    width: "90%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
    gap: 6,
  },
  goalRowLeft: { alignSelf: "flex-start", marginRight: "auto", justifyContent: "flex-start" },
  goalRowRight: { alignSelf: "flex-end", marginLeft: "auto", justifyContent: "flex-end" },
  goalIconLeft: { marginRight: 12 },
  goalIconRight: { marginLeft: 12 },
  goalInfo: { flexDirection: "column", maxWidth: 220 },
  goalInfoRight: { alignItems: "flex-end" },
  goalPlayer: { color: "#fff", fontWeight: "700", fontSize: 15 },
  goalPlayerRight: { textAlign: "right" },
  goalMinute: { color: "#d8e6ff", fontSize: 12 },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 12 },
  commentsSection: {
    marginTop: 24,
    padding: 12,
    borderRadius: 16,
    backgroundColor: APP_COLORS.blanco,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo,
    gap: 12,
  },
  commentCard: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#e0f2f1",
  },
  commentAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: APP_COLORS.cielo },
  commentHeader: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  commentAuthor: { fontWeight: "700", color: APP_COLORS.texto },
  commentEmail: { color: "#607d8b", fontSize: 12 },
  commentDate: { color: "#607d8b", fontSize: 12, marginBottom: 2 },
  commentBody: { color: APP_COLORS.texto },
  commentComposer: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  commentComposerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: APP_COLORS.cielo },
  commentInput: {
    flex: 1,
    minHeight: 60,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
    color: APP_COLORS.texto,
    backgroundColor: "#fff",
  },
  commentButton: {
    backgroundColor: APP_COLORS.campo,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  commentButtonDisabled: { opacity: 0.6 },
  commentButtonText: { color: "#fff", fontWeight: "700" },
  commentLegal: { fontSize: 12, color: "#607d8b", textAlign: "center" },
});




