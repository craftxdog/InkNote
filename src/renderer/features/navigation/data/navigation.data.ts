import type {
  NavigationSelection,
  NoteStatus,
} from '../model/navigation.types';

/**
 * Destinos principales de Navigation.
 *
 * Estos objetos representan el contexto de navegación,
 * no los datos reales de las notas.
 */
export const navigationDestinations = {
  allNotes: {
    id: 'all-notes',
    label: 'All Notes',

    view: {
      type: 'all-notes',
    },

    icon: {
      type: 'all-notes',
    },
  },

  templates: {
    id: 'note-templates',
    label: 'Note Templates',

    view: {
      type: 'templates',
    },

    icon: {
      type: 'templates',
    },
  },

  inbox: {
    id: 'inbox',
    label: 'Inbox',

    view: {
      type: 'inbox',
    },

    icon: {
      type: 'inbox',
    },
  },

  work: {
    id: 'work',
    label: 'Work',

    view: {
      type: 'notebook',
      notebookId: 'work',
    },

    icon: {
      type: 'notebook',
    },
  },

  projects: {
    id: 'projects',
    label: 'Projects',

    view: {
      type: 'project',
      projectId: 'projects',
    },

    icon: {
      type: 'project',
    },
  },

  active: {
    id: 'status-active',
    label: 'Active',

    view: {
      type: 'status',
      status: 'active',
    },

    icon: {
      type: 'status',
      status: 'active',
    },
  },

  onHold: {
    id: 'status-on-hold',
    label: 'On Hold',

    view: {
      type: 'status',
      status: 'on-hold',
    },

    icon: {
      type: 'status',
      status: 'on-hold',
    },
  },

  completed: {
    id: 'status-completed',
    label: 'Completed',

    view: {
      type: 'status',
      status: 'completed',
    },

    icon: {
      type: 'status',
      status: 'completed',
    },
  },

  dropped: {
    id: 'status-dropped',
    label: 'Dropped',

    view: {
      type: 'status',
      status: 'dropped',
    },

    icon: {
      type: 'status',
      status: 'dropped',
    },
  },

  trash: {
    id: 'trash',
    label: 'Trash',

    view: {
      type: 'trash',
    },

    icon: {
      type: 'trash',
    },
  },
} satisfies Record<string, NavigationSelection>;

/**
 * Tags disponibles temporalmente.
 *
 * Más adelante estos registros vendrán del backend/local DB.
 */
export const tagDestinations = {
  work: {
    id: 'tag-work',
    label: 'work',

    view: {
      type: 'tag',
      tagId: 'work',
    },

    icon: {
      type: 'tag',
      color: '#58a6ff',
    },
  },

  personal: {
    id: 'tag-personal',
    label: 'personal',

    view: {
      type: 'tag',
      tagId: 'personal',
    },

    icon: {
      type: 'tag',
      color: '#45d483',
    },
  },

  bug: {
    id: 'tag-bug',
    label: 'bug',

    view: {
      type: 'tag',
      tagId: 'bug',
    },

    icon: {
      type: 'tag',
      color: '#ff6868',
    },
  },

  research: {
    id: 'tag-research',
    label: 'research',

    view: {
      type: 'tag',
      tagId: 'research',
    },

    icon: {
      type: 'tag',
      color: '#9670ff',
    },
  },
} satisfies Record<string, NavigationSelection>;

/**
 * Conteos temporales.
 *
 * No forman parte de NavigationSelection porque estos valores
 * son dinámicos y más adelante vendrán de persistencia/API.
 */
export const navigationCounts = {
  allNotes: 3040,

  active: 3,
  onHold: 1,
  completed: 186,
  dropped: 24,

  work: 412,
  personal: 88,
  bug: 137,
  research: 64,
} as const;

type StatusNavigationItem = {
  destination: NavigationSelection;

  status: NoteStatus;

  count: number;
};

export const statusItems = [
  {
    destination: navigationDestinations.active,

    status: 'active',

    count: navigationCounts.active,
  },

  {
    destination: navigationDestinations.onHold,

    status: 'on-hold',

    count: navigationCounts.onHold,
  },

  {
    destination: navigationDestinations.completed,

    status: 'completed',

    count: navigationCounts.completed,
  },

  {
    destination: navigationDestinations.dropped,

    status: 'dropped',

    count: navigationCounts.dropped,
  },
] satisfies StatusNavigationItem[];

type TagNavigationItem = {
  destination: NavigationSelection;

  color: string;

  count: number;
};

export const tagItems = [
  {
    destination: tagDestinations.work,

    color: '#58a6ff',

    count: navigationCounts.work,
  },

  {
    destination: tagDestinations.personal,

    color: '#45d483',

    count: navigationCounts.personal,
  },

  {
    destination: tagDestinations.bug,

    color: '#ff6868',

    count: navigationCounts.bug,
  },

  {
    destination: tagDestinations.research,

    color: '#9670ff',

    count: navigationCounts.research,
  },
] satisfies TagNavigationItem[];
