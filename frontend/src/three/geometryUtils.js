// Helpers for building organelles from plain Three.js primitives.
// No external model files are loaded anywhere: every shape starts as a
// Sphere/Cylinder/Box/Torus geometry and is cut, bent or merged here.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _v = new THREE.Vector3();

/**
 * Every "cut-away" organelle has the same local quadrant removed (x > 0, z > 0),
 * so the viewer can look inside. These are the matching angle ranges.
 */
export const CUT = {
  // SphereGeometry: x = -cos(phi), z = sin(phi)  ->  removed quadrant is phi in (PI/2, PI)
  spherePhiStart: Math.PI,
  spherePhiLength: Math.PI * 1.5,
  // CylinderGeometry: x = sin(theta), z = cos(theta)  ->  removed quadrant is theta in (0, PI/2)
  cylinderThetaStart: Math.PI / 2,
  cylinderThetaLength: Math.PI * 1.5,
  // Direction that points out of the opening, halfway between +x and +z.
  bisector: new THREE.Vector3(1, 0, 1).normalize(),
};

/** Merge parts that share one material into a single geometry (one draw call). */
export function merge(geometries) {
  const prepared = geometries.map((geometry) => {
    const g = geometry.index ? geometry : mergeVertices(geometry);
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(prepared, false);
  prepared.forEach((g) => g.dispose());
  if (!merged) throw new Error('merge(): geometries are not compatible');
  return merged;
}

/** Move every vertex through `fn(vertex)`; fn mutates the vector it receives. */
export function deform(geometry, fn) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    _v.fromBufferAttribute(position, i);
    fn(_v, i);
    position.setXYZ(i, _v.x, _v.y, _v.z);
  }
  position.needsUpdate = true;
  return geometry;
}

/**
 * Recompute smooth normals for a closed, deformed shape. Sphere geometries have
 * a seam of duplicated vertices; welding them first avoids a visible crease.
 */
export function smoothClosed(geometry) {
  geometry.deleteAttribute('normal');
  if (geometry.attributes.uv) geometry.deleteAttribute('uv');
  const welded = mergeVertices(geometry, 1e-4);
  welded.computeVertexNormals();
  geometry.dispose();
  return welded;
}

/** Sphere with the standard quadrant removed. */
export function cutSphere(radius, widthSegments = 32, heightSegments = 20) {
  return new THREE.SphereGeometry(
    radius,
    widthSegments,
    heightSegments,
    CUT.spherePhiStart,
    CUT.spherePhiLength,
  );
}

/** Capsule shell along the Y axis (cylinder + two half spheres), quadrant removed. */
export function cutCapsuleShell(radius, cylinderLength, segments = 24) {
  const body = new THREE.CylinderGeometry(
    radius,
    radius,
    cylinderLength,
    segments,
    1,
    true,
    CUT.cylinderThetaStart,
    CUT.cylinderThetaLength,
  );
  const top = new THREE.SphereGeometry(
    radius,
    segments,
    12,
    CUT.spherePhiStart,
    CUT.spherePhiLength,
    0,
    Math.PI / 2,
  ).translate(0, cylinderLength / 2, 0);
  const bottom = new THREE.SphereGeometry(
    radius,
    segments,
    12,
    CUT.spherePhiStart,
    CUT.spherePhiLength,
    Math.PI / 2,
    Math.PI / 2,
  ).translate(0, -cylinderLength / 2, 0);
  return merge([body, top, bottom]);
}

/** Box whose edges and corners are rounded with the given radius. */
export function roundedBoxGeometry(hx, hy, hz, radius, segments = 28) {
  const geometry = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2, segments, segments, segments);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const inner = new THREE.Vector3();
  const limit = new THREE.Vector3(hx - radius, hy - radius, hz - radius);
  const n = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    _v.fromBufferAttribute(position, i);
    inner.copy(_v).clamp(limit.clone().negate(), limit);
    n.subVectors(_v, inner);
    if (n.lengthSq() < 1e-10) {
      n.fromBufferAttribute(normal, i);
    } else {
      n.normalize();
    }
    _v.copy(inner).addScaledVector(n, radius);
    position.setXYZ(i, _v.x, _v.y, _v.z);
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  position.needsUpdate = true;
  normal.needsUpdate = true;
  geometry.deleteAttribute('uv');
  return geometry;
}

/** Corner radius used for box-shaped cells, relative to the smallest half size. */
export function boxCornerRadius(radii, scale = 1) {
  return Math.min(radii.x, radii.y, radii.z) * scale * 0.34;
}

/**
 * Outer hull of a cell: an ellipsoid (optionally flattened at the top and/or
 * bottom, like a gut cell) or a rounded box (plant cell).
 */
export function cellShellGeometry(shape, scale = 1) {
  const radii = new THREE.Vector3(...shape.radii).multiplyScalar(scale);

  if (shape.kind === 'box') {
    return roundedBoxGeometry(radii.x, radii.y, radii.z, boxCornerRadius(radii));
  }

  const geometry = new THREE.SphereGeometry(1, 96, 64);
  geometry.scale(radii.x, radii.y, radii.z); // also fixes the normals
  const top = shape.flat_top == null ? Infinity : shape.flat_top * scale;
  const bottom = shape.flat_bottom == null ? -Infinity : shape.flat_bottom * scale;

  if (Number.isFinite(top) || Number.isFinite(bottom)) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i);
      if (y > top) {
        position.setY(i, top);
        normal.setXYZ(i, 0, 1, 0);
      } else if (y < bottom) {
        position.setY(i, bottom);
        normal.setXYZ(i, 0, -1, 0);
      }
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
  }
  geometry.deleteAttribute('uv');
  return geometry;
}

const _basisLocal = new THREE.Matrix4();
const _basisWorld = new THREE.Matrix4();
const _w1 = new THREE.Vector3();
const _w2 = new THREE.Vector3();
const _w3 = new THREE.Vector3();

// Local frame of a cut-away organelle: e1 = opening, e2 = +Y axis, e3 = e1 x e2.
{
  const e1 = CUT.bisector.clone();
  const e2 = new THREE.Vector3(0, 1, 0);
  const e3 = new THREE.Vector3().crossVectors(e1, e2);
  _basisLocal.makeBasis(e1, e2, e3).transpose(); // inverse of an orthonormal basis
}

/**
 * Rotate `object` so its local +Y axis points along `yDirection` and its
 * cut-away opening faces (as far as possible) `openingDirection`.
 */
export function orientObject(object, yDirection, openingDirection) {
  _w2.copy(yDirection).normalize();
  _w1.copy(openingDirection).addScaledVector(_w2, -openingDirection.dot(_w2));
  if (_w1.lengthSq() < 1e-8) {
    // openingDirection is parallel to the axis: pick any perpendicular.
    _w1.set(1, 0, 0).addScaledVector(_w2, -_w2.x);
    if (_w1.lengthSq() < 1e-8) _w1.set(0, 0, 1).addScaledVector(_w2, -_w2.z);
  }
  _w1.normalize();
  _w3.crossVectors(_w1, _w2);
  _basisWorld.makeBasis(_w1, _w2, _w3).multiply(_basisLocal);
  object.quaternion.setFromRotationMatrix(_basisWorld);
  return object;
}

/** Evenly spread points on a unit sphere (Fibonacci lattice). */
export function fibonacciSphere(count) {
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * golden;
    points.push(new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r));
  }
  return points;
}
