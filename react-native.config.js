module.exports = {
  dependencies: {
    'react-native-nodemediaclient': {
      platforms: {
        android: {
          packageImportPath: 'import cn.nodemedia.react_native_nodemediaclient.RCTNodeMediaClientPackage;',
          packageInstance: 'new RCTNodeMediaClientPackage()',
        },
      },
    },
  },
};
