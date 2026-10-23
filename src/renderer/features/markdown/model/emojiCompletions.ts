export type EmojiCompletion = Readonly<{
  label: `:${string}:`;
  emoji: string;
  description: string;
}>;

/**
 * A compact, writing-oriented emoji catalogue. It is shared by CodeMirror and
 * the Markdown renderer so a shortcode has the same meaning everywhere.
 */
export const emojiCompletions = [
  { label: ':bulb:', emoji: '💡', description: 'idea' },
  { label: ':calendar:', emoji: '📅', description: 'calendar' },
  { label: ':checkered_flag:', emoji: '🏁', description: 'milestone' },
  { label: ':coffee:', emoji: '☕', description: 'coffee' },
  { label: ':fire:', emoji: '🔥', description: 'important' },
  { label: ':heart:', emoji: '❤️', description: 'favorite' },
  { label: ':memo:', emoji: '📝', description: 'note' },
  { label: ':rocket:', emoji: '🚀', description: 'project' },
  { label: ':smile:', emoji: '😄', description: 'smile' },
  { label: ':sparkles:', emoji: '✨', description: 'highlight' },
  { label: ':star:', emoji: '⭐', description: 'star' },
  {
    label: ':table_tennis_paddle_and_ball:',
    emoji: '🏓',
    description: 'table tennis',
  },
  { label: ':taco:', emoji: '🌮', description: 'taco' },
  { label: ':tada:', emoji: '🎉', description: 'celebration' },
  { label: ':takeout_box:', emoji: '🥡', description: 'takeout' },
  { label: ':tamale:', emoji: '🫔', description: 'tamale' },
  { label: ':tanabata_tree:', emoji: '🎋', description: 'tanabata tree' },
  { label: ':tangerine:', emoji: '🍊', description: 'tangerine' },
  { label: ':taurus:', emoji: '♉', description: 'taurus' },
  { label: ':taxi:', emoji: '🚕', description: 'taxi' },
  { label: ':tea:', emoji: '🍵', description: 'tea' },
  { label: ':tram:', emoji: '🚊', description: 'tram' },
  { label: ':warning:', emoji: '⚠️', description: 'warning' },
  {
    label: ':white_check_mark:',
    emoji: '✅',
    description: 'completed',
  },
] as const satisfies readonly EmojiCompletion[];

const emojiByShortcode = new Map<string, string>(
  emojiCompletions.map((completion) => [completion.label, completion.emoji]),
);

const emojiShortcodePattern = /:([a-z0-9_+-]+):/gi;

export const findEmojiCompletions = (
  query: string,
): readonly EmojiCompletion[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  return emojiCompletions.filter((completion) =>
    completion.label.slice(1, -1).startsWith(normalizedQuery),
  );
};

export const replaceEmojiShortcodes = (value: string): string =>
  value.replace(emojiShortcodePattern, (shortcode) => {
    const emoji = emojiByShortcode.get(shortcode.toLocaleLowerCase());

    return emoji ?? shortcode;
  });
