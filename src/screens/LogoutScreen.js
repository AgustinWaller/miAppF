import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";

export default function LogoutScreen({ navigation }) {
  useEffect(() => {
    const run = async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.log("Error al cerrar sesión:", e);
      }
    };
    run();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a3d0a" }}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}
