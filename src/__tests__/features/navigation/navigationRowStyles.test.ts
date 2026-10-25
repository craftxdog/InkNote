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
  it('reveals Detail only while the notebook row is hovered', () => {
    expect(navigationStyles).toMatch(
      /\.navigation-row--has-action \.navigation-row__primary\s*\{[\s\S]*?padding-right: 12px;/,
    );
    expect(navigationStyles).toMatch(
      /\.navigation-row:hover \.navigation-row__primary\s*\{\s*padding-right: 96px;/,
    );
    expect(navigationStyles).toMatch(
      /\.navigation-row:hover \.navigation-row__count\s*\{\s*visibility: hidden;/,
    );
    expect(navigationStyles).not.toContain(
      '.navigation-row__primary:focus-visible + .navigation-row__action',
    );
    expect(navigationStyles).not.toContain(
      '.navigation-row__action:focus-visible {\n  opacity: 1;',
    );
  });
});
