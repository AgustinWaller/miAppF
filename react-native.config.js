/**
 * Explicit React Native CLI config to help autolinking discover Android package name.
 */
module.exports = {
  project: {
    android: {
      sourceDir: './android',
      appName: 'app',
      packageName: 'com.agustinwaller.myappf',
    },
  },
};
