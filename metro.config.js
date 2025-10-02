// Metro configuration
// - Prefer @react-native/metro-config (RN 0.73+)
// - Fallback to expo/metro-config (Expo SDK)

let getDefaultConfig;
try {
  ({ getDefaultConfig } = require('@react-native/metro-config'));
} catch (e) {
  ({ getDefaultConfig } = require('expo/metro-config'));
}

const config = getDefaultConfig(__dirname);

// Ensure CSV files can be bundled as static assets
config.resolver.assetExts = [...config.resolver.assetExts, 'csv'];

module.exports = config;
