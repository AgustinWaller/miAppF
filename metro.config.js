// Metro configuration
// - Prefer @react-native/metro-config (RN 0.73+)
// - Fallback to expo/metro-config (Expo SDK)

let getDefaultConfig;
try {
  ({ getDefaultConfig } = require('@react-native/metro-config'));
} catch (e) {
  ({ getDefaultConfig } = require('expo/metro-config'));
}

// For our use case we don't need mergeConfig; return default config directly.
const config = getDefaultConfig(__dirname);
module.exports = config;
