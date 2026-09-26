// Local following (balance.md 4.3): new restaurants have to earn their loyal base.
import { describe, expect, test } from 'vitest';
import { T } from '../src/data/tunables';
import { followingDemand, followingTarget, nextFollowing } from '../src/sim/day';
import { followingAfterMove, newGame } from '../src/sim/game';
import { deserialise, serialise } from '../src/save/saveFile';

describe('local following', () => {
  test('a new restaurant starts with almost no following', () => {
    expect(newGame(1, 'canal', 'hole').following).toBe(T.following.start);
    expect(followingDemand(T.following.start)).toBeLessThan(0.35);
    expect(followingDemand(1)).toBe(1);
  });

  test('satisfaction sets where the following heads', () => {
    expect(followingTarget(30)).toBe(0);
    expect(followingTarget(50)).toBeGreaterThan(0.4);
    expect(followingTarget(50)).toBeLessThan(0.7);
    expect(followingTarget(80)).toBe(1);
  });

  test('word of mouth needs guests, and grows toward the target', () => {
    const busy = nextFollowing(0.2, 70, 40, 0).after;
    const quiet = nextFollowing(0.2, 70, 3, 0).after;
    expect(busy).toBeGreaterThan(quiet);
    expect(quiet).toBeGreaterThan(0.2);
  });

  test('unhappy guests and guests who gave up waiting shrink it', () => {
    expect(nextFollowing(0.8, 40, 40, 0).after).toBeLessThan(0.8);
    expect(nextFollowing(0.8, 80, 30, 30).after).toBeLessThan(0.8);
  });

  test('regulars follow you down the street, not across town', () => {
    expect(followingAfterMove(0.9, true)).toBeCloseTo(0.9 * T.following.keepSameDistrict, 10);
    expect(followingAfterMove(0.9, false)).toBe(T.following.start);
  });

  test('saves from before the following load as established restaurants', () => {
    const s = newGame(1, 'canal', 'hole') as unknown as Record<string, unknown>;
    delete s.following;
    const loaded = deserialise(serialise(s as never, 0)).state;
    expect(loaded.following).toBe(T.following.established);
  });
});
