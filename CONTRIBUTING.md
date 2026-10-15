# Contributing to InkNote

Thank you for contributing to InkNote.

## Prerequisites

- Node.js 24 or newer
- npm 10 or newer

## Local setup

```bash
npm ci
npm start
```

## Quality checks

Run the full local quality gate before opening a pull request:

```bash
npm run verify
```

For coverage data used by SonarQube Cloud, run:

```bash
npm run test:coverage
```

## Pull requests

- Create a focused branch from `main`.
- Keep each pull request scoped to one concern.
- Describe the change and how you validated it.
- Do not commit secrets, local environment files, or generated build output.
- Ensure all required GitHub checks pass before merging.
