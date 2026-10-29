# InkNote

InkNote is a local-first Markdown note-taking desktop app with Vim-inspired
navigation.

## Requirements

- Node.js 24 or newer
- npm 10 or newer

## Development

```bash
npm ci
npm start
```

## Quality checks

Run the same primary checks that protect `main`:

```bash
npm run verify
```

To generate the LCOV report consumed by SonarQube Cloud:

```bash
npm run test:coverage
```

Other useful commands:

- `npm run lint:fix` fixes lint issues where possible.
- `npm run package` builds a local distributable without publishing it.
- `npm run preview` runs the production bundle locally.

## Continuous integration and releases

Pull requests to `main` run linting, TypeScript checks, Jest coverage, an
Electron/Vite build, SonarQube Cloud analysis when `SONAR_TOKEN` is available,
CodeQL, and dependency review. Dependabot opens weekly update pull requests for
npm packages and GitHub Actions.

Desktop releases are created only when a semantic-version tag is pushed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow packages macOS, Windows, and Linux artifacts and publishes
them as unsigned downloads on GitHub Releases. They are distributed as manual
updates; macOS Gatekeeper and Windows SmartScreen can show the standard warning
for an independent, unsigned application.

## Repository setup

Before making SonarQube Cloud a required check, add `SONAR_TOKEN` as a GitHub
Actions repository secret and disable SonarQube Cloud automatic analysis for
this project. Then configure a ruleset for `main` that requires the CI, CodeQL,
Dependency Review, and SonarQube Quality Gate checks; block force pushes and
branch deletion.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and
[SECURITY.md](SECURITY.md) for responsible vulnerability reporting.

## License

MIT. See [LICENSE](LICENSE).
