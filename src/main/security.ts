/**
 * Main-window privileges are written down instead of relying on Electron
 * defaults. New window types must opt into any capability deliberately.
 */
export const secureRendererPreferences = Object.freeze({
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInSubFrames: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: false,
});

const allowedExternalProtocols = new Set(['https:', 'mailto:']);

/**
 * Only URLs that the operating system can safely hand to the user's default
 * browser or mail client are eligible for shell.openExternal().
 */
export const isAllowedExternalUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    if (!allowedExternalProtocols.has(url.protocol)) {
      return false;
    }

    if (url.protocol === 'https:') {
      return (
        url.hostname.length > 0 &&
        url.username.length === 0 &&
        url.password.length === 0
      );
    }

    return url.pathname.length > 0;
  } catch {
    return false;
  }
};
