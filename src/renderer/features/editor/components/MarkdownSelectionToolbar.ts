import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';

import {
  applyMarkdownFormat,
  type MarkdownFormatId,
} from '../model/markdownAuthoring';

import { dispatchMarkdownTransformation } from './markdownTransformationDispatch';

type ToolbarAction = Readonly<{
  id: MarkdownFormatId;
  label: string;
  symbol: string;
}>;

const toolbarActions: readonly ToolbarAction[] = [
  { id: 'heading-1', label: 'Heading 1', symbol: '#' },
  { id: 'bold', label: 'Bold', symbol: 'B' },
  { id: 'italic', label: 'Italic', symbol: 'I' },
  { id: 'strikethrough', label: 'Strikethrough', symbol: 'S' },
  { id: 'link', label: 'Link', symbol: '↗' },
  { id: 'inline-code', label: 'Inline code', symbol: '</>' },
  { id: 'bullet-list', label: 'Bulleted list', symbol: '•' },
  { id: 'numbered-list', label: 'Numbered list', symbol: '1.' },
  { id: 'task-list', label: 'Task list', symbol: '☑' },
  { id: 'blockquote', label: 'Blockquote', symbol: '❝' },
];

class MarkdownSelectionToolbar {
  readonly dom: HTMLDivElement;

  constructor(private readonly view: EditorView) {
    this.dom = document.createElement('div');
    this.dom.className = 'inknote-selection-toolbar';
    this.dom.setAttribute('role', 'toolbar');
    this.dom.setAttribute('aria-label', 'Format selected Markdown');
    this.dom.hidden = true;

    for (const action of toolbarActions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inknote-selection-toolbar__button';
      button.textContent = action.symbol;
      button.setAttribute('aria-label', action.label);
      button.title = action.label;
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => this.formatSelection(action.id));
      this.dom.append(button);
    }

    view.dom.append(this.dom);
    this.updatePosition();
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged ||
      update.geometryChanged
    ) {
      this.updatePosition();
    }
  }

  destroy(): void {
    this.dom.remove();
  }

  private formatSelection(action: MarkdownFormatId): void {
    const selection = this.view.state.selection.main;

    if (selection.empty) {
      return;
    }

    dispatchMarkdownTransformation(
      this.view,
      applyMarkdownFormat(this.view.state.doc.toString(), selection, action),
    );
    this.view.focus();
  }

  private updatePosition(): void {
    const selection = this.view.state.selection.main;

    if (selection.empty) {
      this.dom.hidden = true;
      return;
    }

    const start = this.view.coordsAtPos(selection.from);
    const end = this.view.coordsAtPos(selection.to);

    if (start === null || end === null) {
      this.dom.hidden = true;
      return;
    }

    this.dom.hidden = false;
    const editorBounds = this.view.dom.getBoundingClientRect();
    const horizontalCenter = (start.left + end.right) / 2 - editorBounds.left;
    const maxLeft = Math.max(8, editorBounds.width - this.dom.offsetWidth - 8);
    const left = Math.min(
      Math.max(8, horizontalCenter - this.dom.offsetWidth / 2),
      maxLeft,
    );
    const aboveSelection = Math.min(start.top, end.top) - editorBounds.top;
    const top = Math.max(8, aboveSelection - this.dom.offsetHeight - 8);

    this.dom.style.left = `${left}px`;
    this.dom.style.top = `${top}px`;
  }
}

export const markdownSelectionToolbar = ViewPlugin.fromClass(
  MarkdownSelectionToolbar,
);
