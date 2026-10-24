import type { NotebookIconName } from '../../../../shared/documents/document.types';

export type NoteStatus = 'active' | 'on-hold' | 'completed' | 'dropped';

export type NavigationView =
  | {
      type: 'all-notes';
    }
  | {
      type: 'templates';
    }
  | {
      type: 'inbox';
    }
  | {
      type: 'notebook';
      notebookId: string;
      /** A collapsed notebook also includes notes from nested notebooks. */
      includeDescendants?: boolean;
    }
  | {
      type: 'project';
      projectId: string;
    }
  | {
      type: 'status';
      status: NoteStatus;
      /** When present, status results stay within a focused notebook. */
      notebookId?: string;
    }
  | {
      type: 'tag';
      /** Multiple tag IDs narrow the note list by intersection. */
      tagIds?: readonly string[];
      /** @deprecated kept while local navigation selections upgrade to tagIds. */
      tagId?: string;
      /** When present, tag results stay within a focused notebook. */
      notebookId?: string;
    }
  | {
      type: 'trash';
    };

export type NavigationIcon =
  | {
      type: 'all-notes';
    }
  | {
      type: 'templates';
    }
  | {
      type: 'inbox';
    }
  | {
      type: 'notebook';
      notebookIcon?: NotebookIconName;
    }
  | {
      type: 'project';
    }
  | {
      type: 'status';
      status: NoteStatus;
    }
  | {
      type: 'tag';
      color: string;
    }
  | {
      type: 'trash';
    };

export type NavigationSelection = {
  id: string;
  label: string;
  view: NavigationView;
  icon: NavigationIcon;
};

/* =========================================================
   Expandable sidebar sections
========================================================= */

export type NavigationSectionId = 'work' | 'status' | 'tags';

export type NavigationSectionsState = Record<NavigationSectionId, boolean>;

/* =========================================================
   Focused workspace navigation
========================================================= */

export type NavigationWorkspaceId = 'inbox' | 'work' | 'projects';

export type NavigationScope =
  | {
      type: 'library';
    }
  | {
      type: 'workspace';
      workspaceId: NavigationWorkspaceId;
    };

/* =========================================================
   Workspace metadata
========================================================= */

export type NavigationWorkspaceStatusCount = {
  destination: NavigationSelection;
  count: number;
};

export type NavigationWorkspaceTagCount = {
  destination: NavigationSelection;
  count: number;
};

export type NavigationWorkspaceDefinition = {
  id: NavigationWorkspaceId;

  rootSelection: NavigationSelection;

  breadcrumbs: NavigationSelection[];

  children: NavigationSelection[];

  allNotesCount: number;

  statuses: NavigationWorkspaceStatusCount[];

  tags: NavigationWorkspaceTagCount[];
};
