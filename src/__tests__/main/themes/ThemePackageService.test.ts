/** @jest-environment node */

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ThemePackageService } from '../../../main/themes/ThemePackageService';

describe('ThemePackageService', () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'inknote-theme-'),
    );
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  const createThemePackage = async (
    name: string,
    css = '@layer theme.ui { :root { --page-background: #101010; } }',
  ): Promise<string> => {
    const directory = path.join(temporaryDirectory, name.replace('/', '-'));
    await mkdir(path.join(directory, 'styles'), { recursive: true });
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({
        name,
        version: '1.2.3',
        theme: true,
        themeAppearance: 'dark',
        styleSheets: ['styles/ui.css'],
        scripts: { postinstall: 'this must never run' },
      }),
    );
    await writeFile(path.join(directory, 'styles', 'ui.css'), css);

    return directory;
  };

  const createService = () =>
    new ThemePackageService({
      dataDirectory: path.join(temporaryDirectory, 'user-data'),
      platform: 'darwin',
    });

  it('imports an Inkdrop theme manifest without executing its package scripts', async () => {
    const sourceDirectory = await createThemePackage('@inkdrop/motif-dark');
    const service = createService();

    await expect(service.install(sourceDirectory)).resolves.toEqual({
      id: 'external:@inkdrop/motif-dark',
      kind: 'external',
      name: '@inkdrop/motif-dark',
      version: '1.2.3',
      themeAppearance: 'dark',
      styleSheets: ['styles/ui.css'],
    });

    await expect(service.list()).resolves.toEqual([
      {
        id: 'external:@inkdrop/motif-dark',
        kind: 'external',
        name: '@inkdrop/motif-dark',
        version: '1.2.3',
        themeAppearance: 'dark',
        styleSheets: ['styles/ui.css'],
      },
    ]);
    await expect(service.load('external:@inkdrop/motif-dark')).resolves.toEqual(
      expect.objectContaining({
        theme: expect.objectContaining({ name: '@inkdrop/motif-dark' }),
        css: expect.stringContaining('--page-background: #101010'),
      }),
    );
  });

  it('accepts Inkdrop packages that declare stylesheet basenames from styles/', async () => {
    const sourceDirectory = await createThemePackage('solarized-dark');
    await writeFile(
      path.join(sourceDirectory, 'package.json'),
      JSON.stringify({
        name: 'solarized-dark',
        version: '2.2.1',
        theme: true,
        themeAppearance: 'dark',
        styleSheets: ['ui.css'],
      }),
    );

    const service = createService();
    await service.install(sourceDirectory);

    await expect(service.load('external:solarized-dark')).resolves.toEqual(
      expect.objectContaining({
        css: expect.stringContaining('--page-background: #101010'),
      }),
    );
  });

  it('preserves the declared palette, UI, syntax, and preview layer order', async () => {
    const sourceDirectory = await createThemePackage('complete-theme');
    const stylesDirectory = path.join(sourceDirectory, 'styles');
    await writeFile(
      path.join(sourceDirectory, 'package.json'),
      JSON.stringify({
        name: 'complete-theme',
        theme: true,
        themeAppearance: 'dark',
        styleSheets: [
          'styles/palette.css',
          'styles/ui.css',
          'styles/syntax.css',
          'styles/preview.css',
        ],
      }),
    );
    await writeFile(
      path.join(stylesDirectory, 'palette.css'),
      '@layer theme { :root { --complete-accent: #8b5cf6; } }',
    );
    await writeFile(
      path.join(stylesDirectory, 'ui.css'),
      '@layer theme.ui { :root { --primary-color: var(--complete-accent); } }',
    );
    await writeFile(
      path.join(stylesDirectory, 'syntax.css'),
      '@layer theme.syntax { :root { --syntax-keyword-color: var(--complete-accent); } }',
    );
    await writeFile(
      path.join(stylesDirectory, 'preview.css'),
      '@layer theme.preview { :root { --mde-preview-link-color: var(--complete-accent); } }',
    );

    const service = createService();
    await service.install(sourceDirectory);
    const { css } = await service.load('external:complete-theme');

    expect(css).toMatch(
      /@layer theme \{[\s\S]*@layer theme\.ui[\s\S]*@layer theme\.syntax[\s\S]*@layer theme\.preview/,
    );
  });

  it('refuses stylesheets that escape their package through a symlink', async () => {
    const sourceDirectory = await createThemePackage('unsafe-theme');
    const outsideFile = path.join(temporaryDirectory, 'outside.css');
    await writeFile(
      outsideFile,
      '@layer theme.ui { :root { --page-background: red; } }',
    );
    await rm(path.join(sourceDirectory, 'styles', 'ui.css'));
    await symlink(outsideFile, path.join(sourceDirectory, 'styles', 'ui.css'));

    await expect(createService().install(sourceDirectory)).rejects.toThrow(
      'inside the selected theme directory',
    );
  });

  it('requires documented cascade layers and blocks network-capable CSS imports', async () => {
    const sourceDirectory = await createThemePackage(
      'invalid-theme',
      '@import url(https://example.test/theme.css); :root { --page-background: red; }',
    );

    await expect(createService().install(sourceDirectory)).rejects.toThrow(
      'may not load additional resources',
    );
  });

  it('allows embedded image data used by Inkdrop syntax themes', async () => {
    const sourceDirectory = await createThemePackage(
      'embedded-image-theme',
      '@layer theme.syntax { :root { --editor-highlight-tab-background-image: url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>\'); } }',
    );

    await expect(createService().install(sourceDirectory)).resolves.toEqual(
      expect.objectContaining({ id: 'external:embedded-image-theme' }),
    );
  });

  it('continues to block CSS URLs that can load an external resource', async () => {
    const sourceDirectory = await createThemePackage(
      'external-resource-theme',
      "@layer theme.ui { :root { --background-image: url('https://example.test/theme.svg'); } }",
    );

    await expect(createService().install(sourceDirectory)).rejects.toThrow(
      'may not load additional resources',
    );
  });

  it('persists the acrylic preference and reports its platform support', async () => {
    const service = createService();

    await expect(service.getAppearance()).resolves.toEqual({
      acrylicEnabled: false,
      acrylicSupported: true,
      platform: 'darwin',
    });
    await expect(service.setAcrylicEnabled(true)).resolves.toEqual({
      acrylicEnabled: true,
      acrylicSupported: true,
      platform: 'darwin',
    });
    await expect(
      readFile(
        path.join(
          temporaryDirectory,
          'user-data',
          'inknote-theme-settings.json',
        ),
        'utf8',
      ),
    ).resolves.toContain('"acrylicEnabled": true');
  });

  it('allows removal only for a package that InkNote installed itself', async () => {
    const sourceDirectory = await createThemePackage('removable-theme');
    const service = createService();
    const installed = await service.install(sourceDirectory);

    await expect(service.remove(installed.id)).resolves.toBeUndefined();
    await expect(service.list()).resolves.toEqual([]);
    await expect(service.remove('external:not-installed')).rejects.toThrow(
      'not installed by InkNote',
    );
  });
});
