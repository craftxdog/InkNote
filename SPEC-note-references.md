# Spec: Note references

## Objective

Let a writer create reliable links to other InkNote notes and follow them without leaving the workspace. Links remain normal Markdown and use an immutable note ID, so renaming a note never breaks a reference.

## Tech stack

React 19, CodeMirror 6, GFM Markdown pipeline, TypeScript 7, existing document workspace state.

## Commands

- Focused tests: `npm run test:ci -- --runTestsByPath <path>`
- Full tests: `npm run test:ci`
- Types: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`

## Project structure

- `src/renderer/features/references/` parses and formats portable note references.
- `src/renderer/features/editor/` provides an editor completion that inserts a Markdown link.
- `src/renderer/features/preview/` upgrades internal links into accessible reference cards.
- `src/renderer/pages/WorkspacePage.tsx` owns opening the target document.
- `src/__tests__/features/references/` tests parsing, completion output and preview navigation.

## Contract

- Stored syntax is `[Visible title](inknote://note/<note-id>)`, matching standard Markdown link semantics.
- Typing `[[` opens a note completion list; choosing a note inserts the stored syntax, not a non-portable wiki link.
- The preview recognizes only the exact `inknote://note/<note-id>` scheme as internal. Other links continue through the existing external-link policy.
- An internal reference renders as a card with the current note title and an explicit `Open note` action. A missing or archived target renders a non-navigable unavailable state.

## Code style

```ts
export type NoteReference = Readonly<{
  documentId: NoteId;
  label: string;
}>;
```

Parsing is pure and does not mutate Markdown. DOM event handling only delegates already parsed internal URLs to a typed `onOpenReference` callback.

## Testing strategy

- Unit tests cover valid, malformed and external reference URLs.
- Component tests cover completion insertion, card rendering and target opening.
- Existing preview security tests continue to prove external links are not navigated in place.

## Boundaries

- Always: preserve ordinary Markdown compatibility and use a stable document ID.
- Ask first: create a graph/backlinks database or add a new persistent schema.
- Never: resolve references by note title alone or turn arbitrary URLs into renderer navigation.

## Success criteria

- A writer can use keyboard completion to insert a note reference.
- The preview displays the reference as a card and opens its target note.
- Renaming the referenced note updates card text without changing the stored URL.
- Invalid, missing and archived targets are safely represented.

## Sources

- https://docs.inkdrop.app/reference/share-notes-on-the-web
- https://docs.inkdrop.app/reference/write-notes
