export const organizationCommandIds = Object.freeze({
  createNote: 'note:new',
});

export type OrganizationCommand =
  (typeof organizationCommandIds)[keyof typeof organizationCommandIds];

const organizationCommands = Object.freeze(
  Object.values(organizationCommandIds),
) as readonly OrganizationCommand[];

export const isOrganizationCommand = (
  value: unknown,
): value is OrganizationCommand =>
  typeof value === 'string' &&
  organizationCommands.includes(value as OrganizationCommand);
