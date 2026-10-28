import { readFileSync } from 'node:fs';
import path from 'node:path';

const navigationStyles = readFileSync(
  path.join(
    process.cwd(),
    'src/renderer/features/navigation/styles/navigation.css',
  ),
  'utf8',
);

describe('notebook row Detail affordance', () => {
  it('uses Inkdrop-like compact dimensions for Detail without hiding row counts', () => {
    expect(navigationStyles).toMatch(
      /--navigation-row-detail-inline-size:\s*48px;/,
    );
    expect(navigationStyles).toMatch(
      /\.navigation-row--has-action \.navigation-row__primary\s*\{[\s\S]*?padding-right: calc\(12px \+ var\(--navigation-row-detail-inline-size\)\);/,
    );
    expect(navigationStyles).toMatch(
      /\.navigation-row__action\s*\{[\s\S]*?box-sizing: border-box;[\s\S]*?width: var\(--navigation-row-detail-inline-size\);[\s\S]*?height: 24px;[\s\S]*?padding: 0 4px 0 6px;[\s\S]*?font-size: 11px;/,
    );
    expect(navigationStyles).toMatch(
      /\.navigation-row__action-arrow\s*\{[\s\S]*?font-size: 15px;/,
    );
    expect(navigationStyles).not.toContain(
      '.navigation-row:hover .navigation-row__primary',
    );
    expect(navigationStyles).not.toContain(
      '.navigation-row:hover .navigation-row__count',
    );
  });
});
