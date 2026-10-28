type Rgb = Readonly<{
  red: number;
  green: number;
  blue: number;
}>;

const isNodeShape = (element: Element): element is SVGElement =>
  element instanceof SVGElement &&
  element.matches('rect, path, circle, ellipse, polygon');

const isNodeLabel = (element: Element): element is SVGTextElement =>
  element instanceof SVGElement && element.classList.contains('pele-label');

const clampChannel = (value: number): number =>
  Math.min(255, Math.max(0, Math.round(value)));

const parseChannel = (value: string): number | null => {
  const trimmed = value.trim();

  if (trimmed.endsWith('%')) {
    const percentage = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(percentage)
      ? clampChannel((percentage / 100) * 255)
      : null;
  }

  const channel = Number.parseFloat(trimmed);
  return Number.isFinite(channel) ? clampChannel(channel) : null;
};

const parseCssColor = (value: string): Rgb | null => {
  const color = value.trim();
  const hexadecimal = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(color);

  if (hexadecimal !== null) {
    const digits = hexadecimal[1];
    const shorthand = digits.length === 3 || digits.length === 4;
    const red = Number.parseInt(
      shorthand ? digits[0].repeat(2) : digits.slice(0, 2),
      16,
    );
    const green = Number.parseInt(
      shorthand ? digits[1].repeat(2) : digits.slice(2, 4),
      16,
    );
    const blue = Number.parseInt(
      shorthand ? digits[2].repeat(2) : digits.slice(4, 6),
      16,
    );

    return { red, green, blue };
  }

  const rgb = /^rgba?\((.+)\)$/i.exec(color);

  if (rgb === null) {
    return null;
  }

  const channels = rgb[1].replaceAll(',', ' ').split(/[ /]+/).filter(Boolean);

  if (channels.length < 3) {
    return null;
  }

  const [red, green, blue] = channels.slice(0, 3).map(parseChannel);

  return red === null || green === null || blue === null
    ? null
    : { red, green, blue };
};

const linearize = (channel: number): number => {
  const normalized = channel / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = ({ red, green, blue }: Rgb): number =>
  0.2126 * linearize(red) +
  0.7152 * linearize(green) +
  0.0722 * linearize(blue);

/**
 * Select a neutral foreground with the strongest WCAG contrast against a
 * rendered fill. This is intentionally independent of every workspace theme:
 * it protects Mermaid `style`/`classDef` fills supplied by the note author.
 */
export const foregroundForFill = (
  fill: string,
): '#000000' | '#ffffff' | null => {
  const color = parseCssColor(fill);

  if (color === null) {
    return null;
  }

  const luminance = relativeLuminance(color);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);

  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
};

/**
 * Mermaid turns a source-level `style Node fill:…` into an inline fill on the
 * node shape. Pele's inherited theme text is then not necessarily legible on
 * that author-provided surface. Apply an automatic foreground only in this
 * narrow case; an explicit Mermaid `color:` remains untouched.
 */
export const applyExplicitNodeTextContrast = (container: HTMLElement): void => {
  for (const node of container.querySelectorAll<SVGGElement>('.pele-node')) {
    const children = [...node.children];
    const shape = children.find(isNodeShape);
    const label = children.find(isNodeLabel);

    if (
      shape === undefined ||
      label === undefined ||
      shape.style.fill.length === 0
    ) {
      continue;
    }

    // Pele encodes Mermaid's explicit `color:` as an inline fill on the label.
    if (label.style.fill.length > 0) {
      continue;
    }

    const foreground = foregroundForFill(shape.style.fill);

    if (foreground !== null && label.style.fill !== foreground) {
      label.style.fill = foreground;
    }
  }
};
