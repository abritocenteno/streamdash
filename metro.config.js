const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "react-dom": require.resolve("./react-dom-shim.js"),
};

// Exclude platform-specific esbuild packages that aren't installed on this OS
config.watchFolders = (config.watchFolders ?? []).filter(
  (f) => !f.includes("@esbuild")
);
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /node_modules\/@esbuild\/.*/,
];

module.exports = config;
