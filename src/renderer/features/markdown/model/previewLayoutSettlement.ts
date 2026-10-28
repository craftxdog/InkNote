/**
 * SVG-based preview widgets can emit several DOM mutations while one diagram
 * settles. Publish a layout revision only after that burst completes so the
 * synchronized preview anchor is evaluated from final geometry.
 */
export const PREVIEW_LAYOUT_SETTLE_DELAY_MS = 100;

export type PreviewLayoutSettler = Readonly<{
  schedule(): void;
  cancel(): void;
}>;

export const createPreviewLayoutSettler = (
  onSettled: () => void,
): PreviewLayoutSettler => {
  let timer: ReturnType<typeof globalThis.setTimeout> | null = null;

  const cancel = (): void => {
    if (timer === null) {
      return;
    }

    globalThis.clearTimeout(timer);
    timer = null;
  };

  const schedule = (): void => {
    cancel();
    timer = globalThis.setTimeout(() => {
      timer = null;
      onSettled();
    }, PREVIEW_LAYOUT_SETTLE_DELAY_MS);
  };

  return Object.freeze({ schedule, cancel });
};
