import {
  findEmojiCompletions,
  replaceEmojiShortcodes,
} from '../../../renderer/features/markdown/model/emojiCompletions';

describe('InkNote emoji completions', () => {
  it('finds GitHub-style emoji suggestions after two shortcode characters', () => {
    expect(findEmojiCompletions('ta')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: ':taco:', emoji: '🌮' }),
        expect.objectContaining({ label: ':tada:', emoji: '🎉' }),
      ]),
    );
  });

  it('renders recognized shortcodes while preserving unknown text', () => {
    expect(replaceEmojiShortcodes('Ship :rocket: with :unknown:')).toBe(
      'Ship 🚀 with :unknown:',
    );
  });
});
