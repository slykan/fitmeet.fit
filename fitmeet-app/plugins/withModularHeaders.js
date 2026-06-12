const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      const patch = [
        "  pod 'GoogleUtilities', :modular_headers => true",
        "  pod 'RecaptchaInterop', :modular_headers => true",
      ].join('\n') + '\n';

      if (!contents.includes("pod 'GoogleUtilities', :modular_headers => true")) {
        // Insert before the closing `end` of the main target block
        contents = contents.replace(/(target '[^']+' do[\s\S]*?)(^end)/m, `$1${patch}$2`);
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
};
