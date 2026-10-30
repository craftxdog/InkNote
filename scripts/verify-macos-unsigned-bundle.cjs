const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const unsignedSignatureMessage = /code object is not signed at all/i;

function runCodesign(args) {
  const result = spawnSync('codesign', args, {
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`.trim(),
  };
}

function assertUnsignedMacApp(appPath) {
  if (!existsSync(appPath)) {
    throw new Error(`Missing packaged macOS app: ${appPath}`);
  }

  const codeResourcesPath = path.join(
    appPath,
    'Contents',
    '_CodeSignature',
    'CodeResources',
  );

  if (existsSync(codeResourcesPath)) {
    throw new Error(
      `Expected an unsigned app without ${codeResourcesPath}, but a resource signature exists.`,
    );
  }

  const verification = runCodesign([
    '--verify',
    '--deep',
    '--strict',
    '--verbose=4',
    appPath,
  ]);

  if (
    verification.status === 0 ||
    !unsignedSignatureMessage.test(verification.output)
  ) {
    throw new Error(
      `Expected ${appPath} to be consistently unsigned. codesign verification output:\n${verification.output}`,
    );
  }

  const display = runCodesign(['--display', '--verbose=4', appPath]);

  if (display.status === 0 || !unsignedSignatureMessage.test(display.output)) {
    throw new Error(
      `Expected ${appPath} to have no remaining signature. codesign display output:\n${display.output}`,
    );
  }
}

function main(appPaths) {
  if (appPaths.length === 0) {
    throw new Error('Pass at least one packaged .app path to validate.');
  }

  for (const appPath of appPaths) {
    assertUnsignedMacApp(appPath);
    console.log(`Verified unsigned macOS bundle: ${appPath}`);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  assertUnsignedMacApp,
  main,
  runCodesign,
};
