import { navigationDestinations, tagDestinations } from './navigation.data';

import type {
  NavigationWorkspaceDefinition,
  NavigationWorkspaceId,
} from '../model/navigation.types';

/**
 * Datos temporales del Workspace View.
 *
 * IMPORTANTE:
 * estos counts NO son estado de aplicación definitivo.
 *
 * Más adelante serán reemplazados por información
 * obtenida desde Repository / SQLite / API.
 */
export const navigationWorkspaces = {
  inbox: {
    id: 'inbox',

    rootSelection: navigationDestinations.inbox,

    breadcrumbs: [navigationDestinations.inbox],

    children: [],

    allNotesCount: 85,

    statuses: [
      {
        destination: navigationDestinations.active,
        count: 0,
      },
      {
        destination: navigationDestinations.onHold,
        count: 1,
      },
      {
        destination: navigationDestinations.completed,
        count: 12,
      },
      {
        destination: navigationDestinations.dropped,
        count: 3,
      },
    ],

    tags: [
      {
        destination: tagDestinations.personal,
        count: 18,
      },
      {
        destination: tagDestinations.research,
        count: 9,
      },
      {
        destination: tagDestinations.work,
        count: 24,
      },
    ],
  },

  work: {
    id: 'work',

    rootSelection: navigationDestinations.work,

    breadcrumbs: [navigationDestinations.work],

    children: [navigationDestinations.projects],

    allNotesCount: 576,

    statuses: [
      {
        destination: navigationDestinations.active,
        count: 3,
      },
      {
        destination: navigationDestinations.onHold,
        count: 0,
      },
      {
        destination: navigationDestinations.completed,
        count: 118,
      },
      {
        destination: navigationDestinations.dropped,
        count: 14,
      },
    ],

    tags: [
      {
        destination: tagDestinations.bug,
        count: 58,
      },
      {
        destination: tagDestinations.research,
        count: 37,
      },
      {
        destination: tagDestinations.work,
        count: 214,
      },
    ],
  },

  projects: {
    id: 'projects',

    rootSelection: navigationDestinations.projects,

    breadcrumbs: [navigationDestinations.work, navigationDestinations.projects],

    children: [],

    allNotesCount: 128,

    statuses: [
      {
        destination: navigationDestinations.active,
        count: 1,
      },
      {
        destination: navigationDestinations.onHold,
        count: 0,
      },
      {
        destination: navigationDestinations.completed,
        count: 32,
      },
      {
        destination: navigationDestinations.dropped,
        count: 4,
      },
    ],

    tags: [
      {
        destination: tagDestinations.bug,
        count: 21,
      },
      {
        destination: tagDestinations.research,
        count: 18,
      },
      {
        destination: tagDestinations.work,
        count: 96,
      },
    ],
  },
} satisfies Record<NavigationWorkspaceId, NavigationWorkspaceDefinition>;
