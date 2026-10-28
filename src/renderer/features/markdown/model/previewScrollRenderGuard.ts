/**
 * A rendered preview can change its own scroll position while React replaces
 * Markdown HTML or an embedded renderer finishes its layout. That is layout
 * fallout, not an intentional reader scroll, so it must not become the next
 * editor-to-preview synchronization source. The preview is eligible to lead
 * again only after the reader explicitly interacts with it.
 */
export const createPreviewScrollRenderGuard = () => {
  let isRenderOwned = false;

  return {
    beginRender(): void {
      isRenderOwned = true;
    },
    beginReaderScroll(): void {
      isRenderOwned = false;
    },
    shouldReportScroll(): boolean {
      return !isRenderOwned;
    },
  };
};
