import {
  validateThemeDescriptor,
  validateThemeInstallDirectory,
  validateThemeManifest,
} from '../../../shared/themes/theme.types';

describe('theme package contract', () => {
  it('accepts the documented Inkdrop manifest shape', () => {
    expect(
      validateThemeManifest({
        name: '@inkdrop/motif-dark',
        version: '1.0.0',
        theme: true,
        themeAppearance: 'dark',
        styleSheets: ['styles/palette.css', 'styles/ui.css'],
      }),
    ).toEqual({
      name: '@inkdrop/motif-dark',
      version: '1.0.0',
      theme: true,
      themeAppearance: 'dark',
      styleSheets: ['styles/palette.css', 'styles/ui.css'],
    });
  });

  it.each([
    { name: 'theme', theme: false, themeAppearance: 'dark', styleSheets: [] },
    { name: 'theme', theme: true, themeAppearance: 'system', styleSheets: [] },
    {
      name: 'theme',
      theme: true,
      themeAppearance: 'dark',
      styleSheets: ['../outside.css'],
    },
    {
      name: 'theme',
      theme: true,
      themeAppearance: 'dark',
      styleSheets: ['styles/theme.js'],
    },
  ])('rejects an unsafe or non-theme manifest %#', (candidate) => {
    expect(() => validateThemeManifest(candidate)).toThrow();
  });

  it('validates renderer-safe descriptors and install directories', () => {
    expect(
      validateThemeDescriptor({
        id: 'external:motif-dark',
        kind: 'external',
        name: 'motif-dark',
        version: null,
        themeAppearance: 'dark',
        styleSheets: ['styles/ui.css'],
      }),
    ).toEqual(expect.objectContaining({ id: 'external:motif-dark' }));
    expect(validateThemeInstallDirectory('/private/theme')).toBe(
      '/private/theme',
    );
  });
});
