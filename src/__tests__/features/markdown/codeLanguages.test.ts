import {
  codeLanguageForFence,
  codeLanguageIdForFence,
} from '../../../renderer/features/markdown/model/codeLanguages';

describe('code language registry', () => {
  it.each([
    ['js', 'javascript'],
    ['javascript', 'javascript'],
    ['ts', 'typescript'],
    ['tsx', 'typescript'],
    ['typescript filename="note.ts"', 'typescript'],
    ['py', 'python'],
    ['python', 'python'],
    ['c++', 'cpp'],
    ['cpp', 'cpp'],
    ['php', 'php'],
    ['rust', 'rust'],
    ['go', 'go'],
    ['java', 'java'],
    ['ruby', 'ruby'],
    ['sh', 'shell'],
    ['bash', 'shell'],
    ['json', 'json'],
  ])('recognizes %s as %s', (fenceInfo, expectedLanguageId) => {
    expect(codeLanguageIdForFence(fenceInfo)).toBe(expectedLanguageId);
    expect(codeLanguageForFence(fenceInfo)).not.toBeNull();
  });

  it('does not claim fences owned by other preview presenters', () => {
    expect(codeLanguageForFence('mermaid')).toBeNull();
    expect(codeLanguageForFence('unknown-language')).toBeNull();
  });
});
