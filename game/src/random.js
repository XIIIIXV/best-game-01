// A small seeded random number generator (mulberry32) with the helpers the world uses. The
// same seed gives the same game, which is what makes the screenshot scenes repeatable and the
// play fair: nothing in a run reads Math.random or the clock except the opening seed.
export function createRandom(seed) {
  let a = seed | 0;
  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    /** A float in [0, 1). */
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + (max - min) * next();
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of `items`, uniformly. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** An angle in radians, uniform around the circle. */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}
