const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'ReactCommon',
  'react',
  'nativemodule',
  'core',
  'platform',
  'ios',
  'ReactCommon',
  'RCTTurboModule.mm',
);

const source = fs.readFileSync(target, 'utf8');
const requiredMarkers = [
  'if (@available(iOS 26.0, *))',
  'caughtSyncException',
  'caughtVoidException',
];

const missing = requiredMarkers.filter((marker) => !source.includes(marker));

if (missing.length > 0) {
  console.error('React Native iOS 26 TurboModule patch is missing:', missing.join(', '));
  console.error('Run npm install and make sure patch-package applies patches/react-native+0.81.5.patch.');
  process.exit(1);
}
