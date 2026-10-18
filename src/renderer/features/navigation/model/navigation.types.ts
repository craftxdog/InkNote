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

export type NavigationSectionId = 'work' | 'status' | 'tags';
