export const mermaidMountSelector =
  '.inknote-mermaid-mount[data-mermaid="true"]';

const normalizedMermaidCodeFor = (mount: HTMLElement): string =>
  mount.querySelector('code')?.textContent?.trim() ?? '';

/**
 * Mermaid source is kept out of the rendered host once React owns it. A small
 * deterministic fingerprint lets the Markdown DOM reconciler recognise the
 * same diagram in the next sanitized HTML result without serializing a note's
 * source into an attribute.
 */
export const mermaidMountKeyForCode = (code: string): string => {
  let hash = 2_166_136_261;

  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return `${code.length.toString(36)}-${(hash >>> 0).toString(36)}`;
};

export const mermaidMountKeyFor = (mount: HTMLElement): string | null => {
  const rememberedKey = mount.dataset.mermaidSourceKey;

  if (rememberedKey !== undefined) {
    return rememberedKey;
  }

  const code = normalizedMermaidCodeFor(mount);

  return code.length === 0 ? null : mermaidMountKeyForCode(code);
};

export const mermaidSourceFor = (
  mount: HTMLElement,
): Readonly<{ code: string; title?: string }> | null => {
  const code = normalizedMermaidCodeFor(mount);

  return code.length === 0
    ? null
    : {
        code,
        ...(mount.dataset.codeTitle === undefined
          ? {}
          : { title: mount.dataset.codeTitle }),
      };
};

export const rememberMermaidSource = (
  mount: HTMLElement,
  code: string,
): void => {
  mount.dataset.mermaidSourceKey = mermaidMountKeyForCode(code);
};

const copyMountAttributes = (
  target: HTMLElement,
  source: HTMLElement,
): void => {
  const sourceKey = target.dataset.mermaidSourceKey;

  for (const attribute of [...target.attributes]) {
    if (attribute.name !== 'data-mermaid-source-key') {
      target.removeAttribute(attribute.name);
    }
  }

  for (const attribute of [...source.attributes]) {
    target.setAttribute(attribute.name, attribute.value);
  }

  if (sourceKey !== undefined) {
    target.dataset.mermaidSourceKey = sourceKey;
  }
};

/**
 * Replaces the sanitized Markdown markup while retaining mounted Mermaid host
 * elements whose fenced source is unchanged. Keeping the exact host node also
 * keeps its React/Pele instance, SVG, pan/zoom state, and already-rendered
 * pixels intact while a nearby paragraph or heading changes.
 */
export const reconcilePreviewMarkup = (
  preview: HTMLElement,
  nextHtml: string,
): void => {
  const template = document.createElement('template');
  template.innerHTML = nextHtml;

  const previousMountsByKey = new Map<string, HTMLElement[]>();

  for (const mount of preview.querySelectorAll<HTMLElement>(
    mermaidMountSelector,
  )) {
    const key = mermaidMountKeyFor(mount);

    if (key === null) {
      continue;
    }

    const mounts = previousMountsByKey.get(key) ?? [];
    mounts.push(mount);
    previousMountsByKey.set(key, mounts);
  }

  for (const nextMount of template.content.querySelectorAll<HTMLElement>(
    mermaidMountSelector,
  )) {
    const key = mermaidMountKeyFor(nextMount);
    const previousMount =
      key === null ? undefined : previousMountsByKey.get(key)?.shift();

    if (previousMount === undefined) {
      continue;
    }

    copyMountAttributes(previousMount, nextMount);
    nextMount.replaceWith(previousMount);
  }

  preview.replaceChildren(...template.content.childNodes);
};
