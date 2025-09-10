// Metro configuration
// - Prefer @react-native/metro-config (RN 0.73+ recommended)
// - Fallback to expo/metro-config if not available

let getDefaultConfig;
let mergeConfig;

try {
  ({ getDefaultConfig, mergeConfig } = require('@react-native/metro-config'));
} catch (e) {
  ({ getDefaultConfig, mergeConfig } = require('expo/metro-config'));
}

const defaultConfig = getDefaultConfig(__dirname);

// Customize here if needed
const config = {
  // transformer: {},
  // resolver: {},
};

module.exports = mergeConfig(defaultConfig, config);

