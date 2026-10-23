export type WorkspaceViewMode = 'editor' | 'split' | 'preview';

/**
 * A deliberately small, durable appearance preference. Keeping the value in
 * the workspace domain makes it available to every panel through CSS tokens
 * without coupling editor or preview state to a specific theme implementation.
 */
export type WorkspaceTheme = 'light' | 'dark';
