const fs = require('fs');
const path = require('path');

const checks = [
  {
    file: path.join(__dirname, '..', 'node_modules', 'react-native', 'ReactCommon', 'react', 'nativemodule', 'core', 'platform', 'ios', 'ReactCommon', 'RCTTurboModule.mm'),
    markers: [
      'if (@available(iOS 26.0, *))',
      'caughtSyncException',
      'caughtVoidException',
    ],
    label: 'RCTTurboModule.mm (TurboModule @catch fix)',
  },
  {
    file: path.join(__dirname, '..', 'node_modules', 'react-native', 'React', 'Base', 'RCTAssert.m'),
    markers: [
      'On iOS 26+, @throw propagates via objc_exception_rethrow',
    ],
    label: 'RCTAssert.m (RCTFatal / RCTFatalException crash fix)',
  },
  {
    file: path.join(__dirname, '..', 'node_modules', 'react-native', 'React', 'CxxModule', 'RCTNativeModule.mm'),
    markers: [
      'caughtOldArchException',
    ],
    label: 'RCTNativeModule.mm (old-arch @catch fix)',
  },
];

let allOk = true;
for (const { file, markers, label } of checks) {
  const source = fs.readFileSync(file, 'utf8');
  const missing = markers.filter((m) => !source.includes(m));
  if (missing.length > 0) {
    console.error(`[PATCH MISSING] ${label}`);
    console.error('  Missing markers:', missing.join(', '));
    allOk = false;
  }
}

if (!allOk) {
  console.error('\nRun npm install to re-apply patches/react-native+0.81.5.patch');
  process.exit(1);
}

console.log('✔ All iOS 26 patches verified.');
