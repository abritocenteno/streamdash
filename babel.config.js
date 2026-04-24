module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // worklets-core must come before reanimated so VisionCamera frame
      // processor "worklet" directives are compiled for the worklets-core
      // runtime rather than Reanimated's runtime.
      'react-native-worklets-core/plugin',
      'react-native-reanimated/plugin',
    ],
  };
};
