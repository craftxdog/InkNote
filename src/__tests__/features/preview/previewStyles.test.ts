import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const previewStyles = readFileSync(
  resolve(process.cwd(), 'src/renderer/features/preview/styles/preview.css'),
  'utf8',
);

describe('preview content styles', () => {
  it('uses Inkdrop-style word wrapping without changing code block overflow', () => {
    expect(previewStyles).toMatch(
      /\.markdown-preview\s*\{[\s\S]*?word-wrap:\s*break-word;/,
    );
    expect(previewStyles).toMatch(
      /\.markdown-preview pre\s*\{[\s\S]*?word-wrap:\s*normal;/,
    );
    expect(previewStyles).toMatch(
      /\.markdown-preview pre code\s*\{[\s\S]*?word-break:\s*normal;[\s\S]*?white-space:\s*pre;/,
    );
  });
});
