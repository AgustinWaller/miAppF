import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { onAuthStateChanged, updateProfile as updateAuthProfile } from "firebase/auth";

import { APP_COLORS } from "../theme/colors";
import { auth } from "../services/firebase";
import { listenProfile, saveProfile, uploadProfilePhoto } from "../services/profile";
import { safeImage, FALLBACK_PLAYER } from "../utils/images";

export default function ProfileScreen() {
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [hasEditedName, setHasEditedName] = useState(false);
  const [remotePhoto, setRemotePhoto] = useState("");
  const [localPhoto, setLocalPhoto] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setCurrentUser(usr);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setProfile(null);
      return;
    }
    const unsubscribe = listenProfile(currentUser.uid, (doc) => {
      setProfile(doc);
    });
    return unsubscribe;
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) {
      setDisplayName("");
      setRemotePhoto("");
      setLocalPhoto("");
      return;
    }
    const baseName = profile?.displayName ?? currentUser.displayName ?? "";
    if (!hasEditedName) setDisplayName(baseName);
    setRemotePhoto(profile?.photoUrl ?? currentUser.photoURL ?? "");
  }, [profile, currentUser, hasEditedName]);

  const photoPreview = useMemo(
    () => localPhoto || remotePhoto || "",
    [localPhoto, remotePhoto]
  );

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para elegir una imagen.");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (!result.canceled && result.assets?.length) {
        setLocalPhoto(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert("Error", err?.message || "No pudimos abrir la galeria.");
    }
  };

  const clearPhoto = () => {
    setLocalPhoto("");
    setRemotePhoto("");
  };

  const handleSave = async () => {
    if (!currentUser?.uid) {
      Alert.alert("Sesión requerida", "Inicia sesión para actualizar tu perfil.");
      return;
    }
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert("Nombre requerido", "Ingresa un nombre para mostrar.");
      return;
    }
    setSaving(true);
    try {
      let finalPhoto = remotePhoto;
      if (localPhoto) {
        finalPhoto = await uploadProfilePhoto(currentUser.uid, localPhoto);
        setLocalPhoto("");
      }
      await saveProfile(currentUser.uid, {
        displayName: trimmedName,
        photoUrl: finalPhoto || "",
        email: currentUser.email || "",
      });
      await updateAuthProfile(currentUser, {
        displayName: trimmedName,
        photoURL: finalPhoto || null,
      }).catch(() => {});
      setHasEditedName(false);
      Alert.alert("Perfil actualizado", "Guardamos tus datos correctamente.");
    } catch (err) {
      Alert.alert("Error", err?.message || "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.empty}>Necesitas iniciar sesión para editar tu perfil.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mi perfil</Text>
      <View style={styles.photoCard}>
        <Image
          source={safeImage(photoPreview, { uri: FALLBACK_PLAYER })}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
            <Text style={styles.photoButtonText}>{photoPreview ? "Cambiar foto" : "Elegir foto"}</Text>
          </TouchableOpacity>
          {photoPreview ? (
            <TouchableOpacity onPress={clearPhoto}>
              <Text style={styles.clearPhoto}>Quitar foto</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.photoHint}>Tu foto aparece junto a tus comentarios y votos.</Text>
        </View>
      </View>

      <Text style={styles.label}>Nombre para mostrar</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={(text) => {
          setHasEditedName(true);
          setDisplayName(text);
        }}
        placeholder="Ej: Juan P."
        placeholderTextColor="#8fa08f"
      />
      <Text style={styles.hint}>Este nombre será visible en comentarios y rankings.</Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.readonly}>{currentUser.email}</Text>

      <TouchableOpacity
        style={[styles.saveButton, (!displayName.trim() || saving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!displayName.trim() || saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Guardar cambios</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: APP_COLORS.fondo,
    padding: 20,
  },
  centerContent: { justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: APP_COLORS.texto,
    marginBottom: 16,
  },
  photoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: APP_COLORS.blanco,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo,
    marginBottom: 20,
    gap: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: APP_COLORS.cielo,
  },
  photoButton: {
    backgroundColor: APP_COLORS.campo,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  photoButtonText: { color: "#fff", fontWeight: "700" },
  clearPhoto: {
    color: APP_COLORS.acento,
    marginTop: 4,
    textDecorationLine: "underline",
  },
  photoHint: { color: APP_COLORS.texto, marginTop: 8, fontSize: 12 },
  label: {
    fontWeight: "700",
    color: APP_COLORS.texto,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: APP_COLORS.texto,
  },
  hint: { color: "#607d8b", fontSize: 12, marginTop: 4 },
  readonly: {
    backgroundColor: "#dcedc8",
    padding: 12,
    borderRadius: 10,
    color: APP_COLORS.texto,
    fontWeight: "600",
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: APP_COLORS.campo,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  empty: { color: APP_COLORS.texto, fontSize: 16, textAlign: "center" },
});
