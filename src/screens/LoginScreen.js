import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  ImageBackground,
} from "react-native";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REMEMBERED_EMAIL_KEY = "app.rememberedEmail";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(REMEMBERED_EMAIL_KEY)
      .then((saved) => {
        if (saved && mounted) {
          setEmail(saved);
          setRememberMe(true);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      if (registerMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      if (rememberMe && email) {
        await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/FondoLogin.jpeg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{registerMode ? "Crear cuenta" : "Iniciar sesión"}</Text>

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          <TextInput
            placeholder="Email"
            placeholderTextColor="#ccc"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Contraseña"
            placeholderTextColor="#ccc"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

          <View style={styles.rememberRow}>
            <Text style={styles.rememberText}>Recordar cuenta</Text>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              thumbColor={rememberMe ? "#1b5e20" : "#ccc"}
              trackColor={{ false: "rgba(255,255,255,0.3)", true: "#a5d6a7" }}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {registerMode ? "Registrarse" : "Ingresar"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setRegisterMode(!registerMode)}>
            <Text style={styles.toggle}>
              {registerMode
                ? "¿Ya tenés cuenta? Iniciar sesión"
                : "¿No tenés cuenta? Crear una"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10,61,10,0.7)",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
  },
  title: {
    fontSize: 28,
    color: "white",
    textAlign: "center",
    marginBottom: 30,
    fontWeight: "bold",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "white",
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#1b5e20",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
  },
  toggle: {
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
    textDecorationLine: "underline",
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    marginTop: 4,
  },
  rememberText: {
    color: "#fff",
    fontWeight: "600",
  },
  error: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
});
