import {
  PREVIEW_LAYOUT_SETTLE_DELAY_MS,
  createPreviewLayoutSettler,
} from '../../../renderer/features/markdown/model/previewLayoutSettlement';

describe('createPreviewLayoutSettler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces a Mermaid layout burst into one settled update', () => {
    const onSettled = jest.fn();
    const settler = createPreviewLayoutSettler(onSettled);

    settler.schedule();
    settler.schedule();
    settler.schedule();

    jest.advanceTimersByTime(PREVIEW_LAYOUT_SETTLE_DELAY_MS - 1);
    expect(onSettled).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onSettled).toHaveBeenCalledTimes(1);

    settler.schedule();
    settler.cancel();
    jest.advanceTimersByTime(PREVIEW_LAYOUT_SETTLE_DELAY_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
