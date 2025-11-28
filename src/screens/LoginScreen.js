import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      if (registerMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>
          {registerMode ? "Registrarse" : "Ingresar"}
        </Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setRegisterMode(!registerMode)}>
        <Text style={styles.toggle}>
          {registerMode ? "¿Ya tenés cuenta? Iniciar sesión" : "¿No tenés cuenta? Crear una"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a3d0a",
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
  error: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
});
