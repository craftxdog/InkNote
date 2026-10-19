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
    }
  | {
      type: 'project';
      projectId: string;
    }
  | {
      type: 'status';
      status: NoteStatus;
    }
  | {
      type: 'tag';
      tagId: string;
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
