const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

module.exports = (async () => {
  await require('./spk-design.cjs')(__dirname);
  return withUniwindConfig(getDefaultConfig(__dirname), { cssEntryFile: './global.css', dtsFile: './uniwind-types.d.ts' });
})();
