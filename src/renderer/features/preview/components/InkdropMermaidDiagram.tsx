import type { Mounted, MountOptions, Zoom, ZoomOptions } from 'pele';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { loadPele } from '../peleLoader';
import { applyExplicitNodeTextContrast } from '../mermaidContrast';

const DEFAULT_THEME_SWAP_DELAY_MS = 400;
const FIT_EPSILON = 0.999;
const ZOOM_STEP = 1.4;
const inlineZoomOptions: ZoomOptions = { controls: false };

/**
 * Inkdrop's Mermaid plugin renders through Pele rather than Mermaid's global
 * renderer. Keep the same parser restrictions so note links work while other
 * URL schemes are rejected by the renderer.
 * Source: https://github.com/inkdropapp/mermaid/blob/master/packages/mermaid/src/render-options.ts
 */
const inkdropRenderOptions = {
  linkSchemes: ['http', 'https', 'mailto', 'tel', 'inknote'],
  autoDirection: false,
} satisfies MountOptions;

type InkdropMermaidDiagramProps = Readonly<{
  code: string;
  title?: string;
  panZoom?: boolean;
  themeRevision?: string;
}>;

const toError = (value: unknown): Error =>
  value instanceof Error
    ? value
    : new Error('Unable to render Mermaid diagram.');

const useInkdropMermaidRendering = (
  code: string,
  themeRevision: string | undefined,
  panZoom: boolean,
) => {
  const [error, setError] = useState<Error | null>(null);
  const [peleMount, setPeleMount] = useState<
    (typeof import('pele'))['mount'] | null
  >(null);
  const [zoomable, setZoomable] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef<Mounted | null>(null);
  const renderedRevisionRef = useRef(themeRevision);

  const synchronizeExplicitNodeContrast = useCallback(() => {
    const container = containerRef.current;

    if (container !== null) {
      applyExplicitNodeTextContrast(container);
    }
  }, []);

  const onRender = useCallback(() => {
    const zoom = mountedRef.current?.zoom;

    synchronizeExplicitNodeContrast();
    setZoomable(zoom !== undefined && zoom.fit < FIT_EPSILON);
    setError(null);
  }, [synchronizeExplicitNodeContrast]);

  const options = useMemo<MountOptions>(
    () => ({
      ...inkdropRenderOptions,
      zoom: panZoom ? inlineZoomOptions : false,
      onRender,
      onError: (renderError) => setError(toError(renderError)),
    }),
    [onRender, panZoom],
  );

  useEffect(() => {
    let isDisposed = false;

    void loadPele()
      .then(({ mount: resolvedMount }) => {
        if (!isDisposed) {
          setPeleMount(() => resolvedMount);
        }

        return undefined;
      })
      .catch((loadError) => {
        if (!isDisposed) {
          setError(toError(loadError));
        }

        return undefined;
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (container === null) {
      return undefined;
    }

    // A theme refresh can replace Pele's SVG after React has committed. Watch
    // only this diagram's host so custom Mermaid fills gain their legible
    // foreground once the complete SVG exists, not on an arbitrary timeout.
    const observer = new MutationObserver(synchronizeExplicitNodeContrast);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    synchronizeExplicitNodeContrast();

    return () => observer.disconnect();
  }, [peleMount, synchronizeExplicitNodeContrast]);

  useEffect(() => {
    const container = containerRef.current;

    if (container === null || peleMount === null) {
      return;
    }

    if (code.length === 0) {
      mountedRef.current?.destroy();
      mountedRef.current = null;
      container.replaceChildren();
      return;
    }

    try {
      if (mountedRef.current !== null) {
        mountedRef.current.update(code, options);
      } else {
        mountedRef.current = peleMount(container, code, options);
      }

      // Pele mounts synchronously today, but defer one frame so a future
      // renderer version that fills its SVG asynchronously is covered too.
      const frame = window.requestAnimationFrame(
        synchronizeExplicitNodeContrast,
      );

      return () => window.cancelAnimationFrame(frame);
    } catch (renderError) {
      window.setTimeout(() => setError(toError(renderError)), 0);
    }

    return undefined;
  }, [code, options, peleMount, synchronizeExplicitNodeContrast]);

  useEffect(
    () => () => {
      mountedRef.current?.destroy();
      mountedRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (renderedRevisionRef.current === themeRevision) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      renderedRevisionRef.current = themeRevision;
      mountedRef.current?.refresh();
    }, DEFAULT_THEME_SWAP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [themeRevision]);

  const getZoom = useCallback(
    (): Zoom | undefined => mountedRef.current?.zoom,
    [],
  );

  return { containerRef, error, getZoom, zoomable };
};

type MermaidToolbarProps = Readonly<{
  getZoom: () => Zoom | undefined;
}>;

const MermaidToolbar = ({ getZoom }: MermaidToolbarProps) => (
  <div
    className="mermaid-toolbar"
    role="toolbar"
    aria-label="Mermaid diagram controls"
  >
    <div className="mermaid-toolbar-controls">
      <button
        type="button"
        aria-label="Zoom in Mermaid diagram"
        title="Zoom in"
        onClick={() => getZoom()?.zoomBy(ZOOM_STEP)}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Reset Mermaid diagram zoom"
        title="Reset zoom"
        onClick={() => getZoom()?.reset()}
      >
        100%
      </button>
      <button
        type="button"
        aria-label="Zoom out Mermaid diagram"
        title="Zoom out"
        onClick={() => getZoom()?.zoomBy(1 / ZOOM_STEP)}
      >
        −
      </button>
    </div>
  </div>
);

/**
 * Inkdrop-compatible Mermaid host adapter. It delegates syntax, SVG creation,
 * pan/zoom and theme refreshes to Pele, the renderer used by Inkdrop's current
 * Mermaid plugin. Theme colours stay CSS variables instead of being serialized
 * as JavaScript-selected values for individual themes.
 */
export const InkdropMermaidDiagram = ({
  code,
  title,
  panZoom = true,
  themeRevision,
}: InkdropMermaidDiagramProps) => {
  const { containerRef, error, getZoom, zoomable } = useInkdropMermaidRendering(
    code,
    themeRevision,
    panZoom,
  );

  return (
    <section
      className="mermaid-diagram"
      aria-label={title ?? 'Mermaid diagram'}
      data-mermaid-state={error === null ? 'ready' : 'error'}
    >
      <div className="mermaid-diagram-content">
        <div className="mermaid-dot-grid" ref={containerRef} />
      </div>
      {error === null ? null : (
        <p className="mermaid-diagram-error" role="alert">
          Unable to render Mermaid diagram.
        </p>
      )}
      {panZoom && zoomable ? <MermaidToolbar getZoom={getZoom} /> : null}
    </section>
  );
};
