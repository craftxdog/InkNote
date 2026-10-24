/**
 * A rendered preview may change its own scroll position while React replaces
 * Markdown HTML. That is layout fallout, not an intentional reader scroll,
 * so it must not become the next editor-to-preview synchronization source.
 */
export const createPreviewScrollRenderGuard = () => {
  let isRendering = false;

  return {
    beginRender(): void {
      isRendering = true;
    },
    completeRender(): void {
      isRendering = false;
    },
    shouldReportScroll(): boolean {
      return !isRendering;
    },
  };
};
