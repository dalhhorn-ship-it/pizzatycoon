import { describe, expect, test } from 'vitest';
import { KEY_SCOPE, LOCATION_KEYS } from '../src/sim/state';
import { newGame, withStarterKit } from '../src/sim/game';

describe('state layout', () => {
  test('every per restaurant field is in LOCATION_KEYS and nothing else is', () => {
    const location = Object.entries(KEY_SCOPE).filter(([, v]) => v === 'location').map(([k]) => k).sort();
    expect([...LOCATION_KEYS].sort()).toEqual(location);
  });

  test('a new game has no field the layout does not know, and no transient field', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    for (const k of Object.keys(s)) {
      expect(KEY_SCOPE, `unclassified GameState field ${k}`).toHaveProperty(k);
      expect(KEY_SCOPE[k as keyof typeof KEY_SCOPE]).not.toBe('transient');
    }
  });
});
