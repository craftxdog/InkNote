const { build } = require('../../package.json');

exports.default = async function notarizeMacos(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const requireNotarization = process.env.REQUIRE_NOTARIZATION === 'true';

  if (!(
    'APPLE_ID' in process.env &&
    'APPLE_ID_PASS' in process.env &&
    'APPLE_TEAM_ID' in process.env
  )) {
    const message =
      'APPLE_ID, APPLE_ID_PASS, and APPLE_TEAM_ID must be set to notarize macOS releases.';

    if (requireNotarization) {
      throw new Error(message);
    }

    console.warn(`Skipping notarization. ${message}`);
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  const { notarize } = await import('@electron/notarize');
  await notarize({
    tool: 'notarytool',
    appBundleId: build.appId,
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASS,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
