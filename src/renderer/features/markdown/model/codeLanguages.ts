import { cpp } from '@codemirror/lang-cpp';
import { go } from '@codemirror/lang-go';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from '@codemirror/language';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { shell } from '@codemirror/legacy-modes/mode/shell';

export type CodeLanguageId =
  | 'cpp'
  | 'go'
  | 'java'
  | 'javascript'
  | 'json'
  | 'php'
  | 'python'
  | 'ruby'
  | 'rust'
  | 'shell'
  | 'typescript';

export type CodeLanguage = Readonly<{
  id: CodeLanguageId;
  description: LanguageDescription;
  support: LanguageSupport;
}>;

type CodeLanguageDefinition = Readonly<{
  id: CodeLanguageId;
  name: string;
  aliases: readonly string[];
  extensions: readonly string[];
  support: LanguageSupport;
}>;

type StreamLanguageDefinition = Parameters<typeof StreamLanguage.define>[0];

/**
 * `legacy-modes` exposes its stream parsers through its own declaration file.
 * They execute against the same deduplicated `@codemirror/streamparser`
 * runtime as `StreamLanguage`, but TypeScript treats the private StringStream
 * member from those declarations as nominally distinct. Keep that boundary in
 * one narrow adapter instead of weakening the registry's public types.
 */
const legacyModeSupport = (mode: unknown): LanguageSupport =>
  new LanguageSupport(StreamLanguage.define(mode as StreamLanguageDefinition));

const rubySupport = legacyModeSupport(ruby);
const shellSupport = legacyModeSupport(shell);

const codeLanguageDefinitions: readonly CodeLanguageDefinition[] = [
  {
    id: 'typescript',
    name: 'TypeScript',
    aliases: ['ts', 'tsx', 'typescript'],
    extensions: ['ts', 'tsx'],
    support: javascript({ typescript: true, jsx: true }),
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    aliases: ['javascript', 'js', 'jsx', 'mjs', 'cjs'],
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    support: javascript({ jsx: true }),
  },
  {
    id: 'json',
    name: 'JSON',
    aliases: ['json'],
    extensions: ['json'],
    support: json(),
  },
  {
    id: 'python',
    name: 'Python',
    aliases: ['py', 'python'],
    extensions: ['py'],
    support: python(),
  },
  {
    id: 'cpp',
    name: 'C++',
    aliases: ['c', 'c++', 'cc', 'cpp', 'cxx'],
    extensions: ['c', 'cc', 'cpp', 'cxx', 'h', 'hpp'],
    support: cpp(),
  },
  {
    id: 'php',
    name: 'PHP',
    aliases: ['php'],
    extensions: ['php'],
    support: php(),
  },
  {
    id: 'rust',
    name: 'Rust',
    aliases: ['rs', 'rust'],
    extensions: ['rs'],
    support: rust(),
  },
  {
    id: 'go',
    name: 'Go',
    aliases: ['go', 'golang'],
    extensions: ['go'],
    support: go(),
  },
  {
    id: 'java',
    name: 'Java',
    aliases: ['java'],
    extensions: ['java'],
    support: java(),
  },
  {
    id: 'ruby',
    name: 'Ruby',
    aliases: ['rb', 'ruby'],
    extensions: ['rb'],
    support: rubySupport,
  },
  {
    id: 'shell',
    name: 'Shell',
    aliases: ['bash', 'shell', 'sh', 'zsh'],
    extensions: ['bash', 'sh', 'zsh'],
    support: shellSupport,
  },
];

export const codeLanguages: readonly CodeLanguage[] =
  codeLanguageDefinitions.map((definition) =>
    Object.freeze({
      id: definition.id,
      support: definition.support,
      description: LanguageDescription.of({
        name: definition.name,
        alias: definition.aliases,
        extensions: definition.extensions,
        support: definition.support,
      }),
    }),
  );

const languageByAlias = new Map<string, CodeLanguage>(
  codeLanguages.flatMap((language) => [
    [language.description.name.toLocaleLowerCase(), language],
    ...language.description.alias.map((alias) => [alias, language] as const),
  ]),
);

const languageNameFromFence = (fenceInfo: string): string | null => {
  const [languageName] = fenceInfo.trim().split(/\s+/, 1);

  return languageName === undefined || languageName.length === 0
    ? null
    : languageName.toLocaleLowerCase();
};

/**
 * Maps the first token of a fenced-code info string to the CodeMirror grammar
 * used by both the Markdown editor and rendered preview. Fence metadata such
 * as filename and title deliberately does not affect language matching.
 */
export const codeLanguageForFence = (
  fenceInfo: string,
): CodeLanguage | null => {
  const languageName = languageNameFromFence(fenceInfo);

  return languageName === null
    ? null
    : (languageByAlias.get(languageName) ?? null);
};

export const codeLanguageDescriptionForFence = (
  fenceInfo: string,
): LanguageDescription | null =>
  codeLanguageForFence(fenceInfo)?.description ?? null;

export const codeLanguageIdForFence = (
  fenceInfo: string,
): CodeLanguageId | null => codeLanguageForFence(fenceInfo)?.id ?? null;
