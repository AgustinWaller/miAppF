import "dotenv/config";

export default ({ config }) => {
  return {
    expo: {
      ...config.expo,
      name: "Futbol App",
      slug: "myappf",
      version: "1.0.0",
      orientation: "portrait",
      sdkVersion: "52.0.0",
      platforms: ["ios", "android", "web"],
      android: {
        package: "com.agustinwaller.myappf",
      },
      assetBundlePatterns: ["**/*"],
      plugins: ["expo-font", "expo-asset"],
      extra: {
        eas: {
          projectId: "e1a47852-17e1-4bc0-8113-8dbe71971d38",
        },
        firebase: {
          apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
          authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
          projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
          storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
          messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
          appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
        },
      },
    },
  };
};
