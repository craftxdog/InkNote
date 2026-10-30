const { execFileSync } = require('node:child_process');
const path = require('node:path');

function removeMacAppSignature(appPath, execute = execFileSync) {
  execute('codesign', ['--remove-signature', appPath], { stdio: 'pipe' });
}

function afterPack(context, execute = execFileSync) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  removeMacAppSignature(appPath, execute);
}

module.exports = {
  afterPack,
  removeMacAppSignature,
};
