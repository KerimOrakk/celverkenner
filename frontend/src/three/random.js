// Seeded random numbers. The same cell always gets the same layout, so a
// student who reloads the page (or compares screens with a classmate) sees
// exactly the same model.

import * as THREE from 'three';

export function hashString(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32 – tiny, fast and good enough for placing organelles. */
export function createRng(seed) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** Uniform in [min, max). */
    range: (min, max) => min + (max - min) * next(),
    /** Uniform in [-extent, +extent). */
    spread: (extent) => (next() * 2 - 1) * extent,
    pick: (list) => list[Math.floor(next() * list.length)],
    /** Uniformly distributed unit vector. */
    unitVector(target = new THREE.Vector3()) {
      const u = next() * 2 - 1;
      const phi = next() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return target.set(s * Math.cos(phi), u, s * Math.sin(phi));
    },
  };
}
