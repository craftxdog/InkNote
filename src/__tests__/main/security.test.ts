import {
  isAllowedExternalUrl,
  secureRendererPreferences,
} from '../../main/security';

describe('main-process security policy', () => {
  it('permits only safe external URL protocols', () => {
    expect(isAllowedExternalUrl('https://inknote.app/guides/local-first')).toBe(
      true,
    );
    expect(
      isAllowedExternalUrl('mailto:support@inknote.app?subject=Help'),
    ).toBe(true);

    expect(isAllowedExternalUrl('http://inknote.app')).toBe(false);
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedExternalUrl('data:text/html,unsafe')).toBe(false);
    expect(isAllowedExternalUrl('https://user:secret@inknote.app')).toBe(false);
    expect(isAllowedExternalUrl('mailto:')).toBe(false);
    expect(isAllowedExternalUrl('not a URL')).toBe(false);
  });

  it('keeps renderer privileges explicitly restricted', () => {
    expect(secureRendererPreferences).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    });
    expect(Object.isFrozen(secureRendererPreferences)).toBe(true);
  });
});
