// Shim for @clerk/clerk-react which imports react-dom for web portals.
// In React Native, createPortal is never called at runtime — this silences
// the Metro "cannot resolve react-dom" error during bundling.
module.exports = {
  createPortal: (children) => children,
};
