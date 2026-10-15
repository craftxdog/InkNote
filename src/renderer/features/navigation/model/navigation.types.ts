export type NavigationItemId =
  | 'all-notes'
  | 'note-templates'
  | 'inbox'
  | 'work'
  | 'projects'
  | 'status-active'
  | 'status-on-hold'
  | 'status-completed'
  | 'status-dropped'
  | 'tag-work'
  | 'tag-personal'
  | 'tag-bug'
  | 'tag-research'
  | 'trash';

export type NavigationSectionId = 'work' | 'status' | 'tags';

export type StatusType = 'active' | 'on-hold' | 'completed' | 'dropped';

export type StatusNavigationItem = {
  id: NavigationItemId;
  label: string;
  status: StatusType;
  count: number;
};

export type TagNavigationItem = {
  id: NavigationItemId;
  label: string;
  color: string;
  count: number;
};
