const path = require('node:path');

const rootManifest = require(path.join(__dirname, '..', 'package.json'));
const releaseManifest = require(
  path.join(__dirname, '..', 'release', 'app', 'package.json'),
);

const fieldsThatMustMatch = [
  'name',
  'version',
  'description',
  'homepage',
  'license',
];

const mismatches = fieldsThatMustMatch.flatMap((field) =>
  rootManifest[field] === releaseManifest[field]
    ? []
    : [
        `${field} differs (root: ${JSON.stringify(rootManifest[field])}, release: ${JSON.stringify(releaseManifest[field])})`,
      ],
);

if (
  JSON.stringify(rootManifest.author) !== JSON.stringify(releaseManifest.author)
) {
  mismatches.push('author differs between root and release manifests');
}

for (const [dependency, version] of Object.entries(
  releaseManifest.dependencies ?? {},
)) {
  if (rootManifest.dependencies?.[dependency] !== version) {
    mismatches.push(
      `release dependency ${dependency}@${version} must match the root runtime dependency`,
    );
  }
}

if (releaseManifest.main !== './dist/main/main.js') {
  mismatches.push('release main must point to ./dist/main/main.js');
}

const macBuild = rootManifest.build?.mac;

if (macBuild?.identity !== null) {
  mismatches.push(
    'unsigned macOS releases must set build.mac.identity to null explicitly',
  );
}

if (macBuild?.hardenedRuntime !== false) {
  mismatches.push(
    'unsigned macOS releases must disable build.mac.hardenedRuntime',
  );
}

for (const field of ['type', 'entitlements', 'entitlementsInherit']) {
  if (field in (macBuild ?? {})) {
    mismatches.push(
      `unsigned macOS releases must not configure build.mac.${field}`,
    );
  }
}

if (mismatches.length > 0) {
  console.error('Release manifest validation failed:');

  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }

  process.exitCode = 1;
}
