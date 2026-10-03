// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArcadeLinks } from './ArcadeLinks';
import { IN_ARCADE, openGameSwitch } from './arcade';

type ArcadeWindow = Window & { GameSwitch?: { open(): void } };

afterEach(() => {
  cleanup();
  delete (window as ArcadeWindow).GameSwitch;
  vi.doUnmock('./arcade');
  vi.resetModules();
});

describe('arcade controls', () => {
  it('stay out of a build that is not the arcade copy', () => {
    expect(IN_ARCADE).toBe(false);
    const { container } = render(<ArcadeLinks />);
    expect(container.innerHTML).toBe('');
  });

  it('show Switch game and an Arcade link in the arcade copy', async () => {
    const open = vi.fn();
    vi.doMock('./arcade', () => ({ IN_ARCADE: true, openGameSwitch: open }));
    const { ArcadeLinks: InArcade } = await import('./ArcadeLinks');
    render(<InArcade />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch game' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Arcade' }).getAttribute('href')).toBe('/');
  });

  it('open the game switcher that switch.js puts on the page', () => {
    const open = vi.fn();
    (window as ArcadeWindow).GameSwitch = { open };
    openGameSwitch();
    expect(open).toHaveBeenCalledTimes(1);
  });
});
