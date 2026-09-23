// Where things go inside the cell.
//
// The API delivers the positions from the lesson material. Several of those
// positions sit closer together than the organelles are wide (the Golgi
// position, for example, lies inside the nucleus). Rendering them as-is would
// give organelles that stick through each other, so the positions are used as
// anchors: every organelle starts on its anchor and is only nudged as far as
// needed to stop overlapping. Set RESOLVE_OVERLAPS to false to see the raw
// positions.

import * as THREE from 'three';
import { boxCornerRadius, discHalfThickness } from './geometryUtils.js';

export const RESOLVE_OVERLAPS = true;

const GAP = 0.012;
const _q = new THREE.Vector3();
const _d = new THREE.Vector3();
const _inner = new THREE.Vector3();

/** The inside of the cell membrane, as something you can test points against. */
export function createContainer(shape, scale = 1) {
  const radii = new THREE.Vector3(...shape.radii).multiplyScalar(scale);
  const top = shape.flat_top == null ? Infinity : shape.flat_top * scale;
  const bottom = shape.flat_bottom == null ? -Infinity : shape.flat_bottom * scale;
  const isBox = shape.kind === 'box';
  const isDisc = shape.kind === 'disc';
  const corner = isBox ? boxCornerRadius(radii) : 0;
  const limit = new THREE.Vector3(radii.x - corner, radii.y - corner, radii.z - corner);
  const negLimit = limit.clone().negate();

  function contains(point, radius = 0, margin = 0.03) {
    const m = radius + margin;
    if (point.y > top - m || point.y < bottom + m) return false;
    if (isBox) {
      _inner.copy(point).clamp(negLimit, limit);
      return _inner.distanceTo(point) <= Math.max(corner - m, 0);
    }
    const ex = radii.x - m;
    const ey = radii.y - m;
    const ez = radii.z - m;
    if (ex <= 0 || ey <= 0 || ez <= 0) return false;
    if (isDisc) {
      const rho = Math.sqrt((point.x / ex) ** 2 + (point.z / ez) ** 2);
      return rho <= 1 && Math.abs(point.y) <= discHalfThickness(rho) * radii.y - m;
    }
    return (point.x / ex) ** 2 + (point.y / ey) ** 2 + (point.z / ez) ** 2 <= 1;
  }

  /** Pull `point` back inside (mutates and returns it). */
  function clamp(point, radius = 0, margin = 0.03) {
    const m = radius + margin;
    if (isBox) {
      _inner.copy(point).clamp(negLimit, limit);
      _d.subVectors(point, _inner);
      const allowed = Math.max(corner - m, 0);
      if (_d.length() > allowed) point.copy(_inner).addScaledVector(_d.normalize(), allowed);
    } else if (isDisc) {
      const ex = Math.max(radii.x - m, 0.01);
      const ez = Math.max(radii.z - m, 0.01);
      const rho = Math.sqrt((point.x / ex) ** 2 + (point.z / ez) ** 2);
      if (rho > 1) {
        point.x /= rho;
        point.z /= rho;
      }
      const limit = Math.max(discHalfThickness(Math.min(rho, 1)) * radii.y - m, 0.005);
      point.y = Math.min(Math.max(point.y, -limit), limit);
    } else {
      const ex = Math.max(radii.x - m, 0.01);
      const ey = Math.max(radii.y - m, 0.01);
      const ez = Math.max(radii.z - m, 0.01);
      const k = Math.sqrt((point.x / ex) ** 2 + (point.y / ey) ** 2 + (point.z / ez) ** 2);
      if (k > 1) point.divideScalar(k);
    }
    if (Number.isFinite(top)) point.y = Math.min(point.y, top - m);
    if (Number.isFinite(bottom)) point.y = Math.max(point.y, bottom + m);
    return point;
  }

  return {
    kind: shape.kind,
    radii,
    top,
    bottom,
    boundingRadius: Math.max(radii.x, radii.y, radii.z),
    contains,
    clamp,
  };
}

/**
 * How far outside an ellipsoid obstacle a sphere sits. Negative = overlapping.
 * Works in the obstacle's "unit sphere" space; exact for spheres, a close
 * approximation for stretched shapes such as the vacuole.
 */
function obstacleClearance(point, radius, obstacle) {
  _q.subVectors(point, obstacle.center).divide(obstacle.radii);
  const length = _q.length();
  if (length < 1e-6) return { length, needed: 2, surfaceRadius: obstacle.radii.x };
  // Radius of the obstacle in the direction of the sphere.
  const surfaceRadius = _d.copy(_q).divideScalar(length).multiply(obstacle.radii).length();
  return { length, needed: 1 + (radius + GAP) / surfaceRadius, surfaceRadius };
}

function pushOutOfObstacle(item, obstacle, rng) {
  const { length, needed } = obstacleClearance(item.position, item.radius, obstacle);
  if (length >= needed) return false;
  if (length < 1e-6) rng.unitVector(_q);
  else _q.subVectors(item.position, obstacle.center).divide(obstacle.radii).divideScalar(length);
  item.position.copy(_q.multiplyScalar(needed).multiply(obstacle.radii).add(obstacle.center));
  return true;
}

/**
 * Nudge `items` apart until nothing overlaps.
 * items:     [{ position: Vector3 (mutated), anchor: Vector3, radius, group? }]
 * obstacles: [{ center: Vector3, radii: Vector3 }] – never move (nucleus, vacuole)
 * Items with the same `group` are allowed to touch (the two centrioles belong together).
 */
export function relaxLayout(items, obstacles, container, rng, iterations = 120) {
  if (!RESOLVE_OVERLAPS) return items;

  for (let step = 0; step < iterations; step += 1) {
    const settling = step > iterations - 25;

    // A weak spring keeps every organelle as close to its lesson position as possible.
    if (!settling) items.forEach((item) => item.position.lerp(item.anchor, 0.06));

    items.forEach((item) => obstacles.forEach((obstacle) => pushOutOfObstacle(item, obstacle, rng)));

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        if (a.group && a.group === b.group) continue;
        _d.subVectors(b.position, a.position);
        let distance = _d.length();
        const needed = a.radius + b.radius + GAP;
        if (distance >= needed) continue;
        if (distance < 1e-6) {
          rng.unitVector(_d);
          distance = 1;
        }
        _d.multiplyScalar((needed - distance) / distance / 2);
        b.position.add(_d);
        a.position.sub(_d);
      }
    }

    items.forEach((item) => container.clamp(item.position, item.radius));
  }
  return items;
}

/** Is a sphere at `point` free of the obstacles and of everything placed so far? */
export function isFree(point, radius, obstacles, placed) {
  for (const obstacle of obstacles) {
    const { length, needed } = obstacleClearance(point, radius, obstacle);
    if (length < needed) return false;
  }
  for (const other of placed) {
    const min = radius + other.radius + GAP;
    if (point.distanceToSquared(other.position) < min * min) return false;
  }
  return true;
}

/** Random free spot inside ±range (rejection sampling). Returns null when the cell is full. */
export function sampleFreePosition(rng, range, radius, container, obstacles, placed, tries = 400) {
  const point = new THREE.Vector3();
  for (let i = 0; i < tries; i += 1) {
    point.set(rng.spread(range), rng.spread(range), rng.spread(range));
    if (container.contains(point, radius) && isFree(point, radius, obstacles, placed)) return point;
  }
  return null;
}
