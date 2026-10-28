import { createPreviewScrollRenderGuard } from '../../../renderer/features/markdown/model/previewScrollRenderGuard';

describe('preview scroll render guard', () => {
  it('ignores preview scroll events caused by replacing rendered Markdown', () => {
    const guard = createPreviewScrollRenderGuard();

    expect(guard.shouldReportScroll()).toBe(true);

    guard.beginRender();
    expect(guard.shouldReportScroll()).toBe(false);
  });

  it('keeps layout scrolls muted after rendering until the reader scrolls the preview', () => {
    const guard = createPreviewScrollRenderGuard();

    guard.beginRender();
    expect(guard.shouldReportScroll()).toBe(false);

    guard.beginReaderScroll();

    expect(guard.shouldReportScroll()).toBe(true);
  });
});
