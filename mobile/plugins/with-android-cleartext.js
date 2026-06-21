const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withPlugins,
} = require('expo/config-plugins');

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">109.110.188.181</domain>
  </domain-config>
</network-security-config>
`;

function applyManifestConfig(config) {
  return withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);

    app.$ = app.$ || {};
    app.$['android:usesCleartextTraffic'] = 'true';
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';

    return mod;
  });
}

function writeNetworkSecurityFile(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const targetDir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      const targetFile = path.join(targetDir, 'network_security_config.xml');

      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.writeFile(targetFile, NETWORK_SECURITY_XML, 'utf8');

      return mod;
    },
  ]);
}

module.exports = function withAndroidCleartext(config) {
  return withPlugins(config, [applyManifestConfig, writeNetworkSecurityFile]);
};
