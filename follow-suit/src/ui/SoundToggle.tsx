import { setMuted, useMuted } from './audio';

/** The mute toggle. The note glyph is crossed out while sound is off. */
export function SoundToggle() {
  const muted = useMuted();
  return (
    <button
      type="button"
      className={`icon-btn sound-btn${muted ? ' muted' : ''}`}
      aria-label={muted ? 'Sound off' : 'Sound on'}
      aria-pressed={!muted}
      data-testid="sound-toggle"
      onClick={() => setMuted(!muted)}
    >
      <span aria-hidden="true">{'♪︎'}</span>
    </button>
  );
}
