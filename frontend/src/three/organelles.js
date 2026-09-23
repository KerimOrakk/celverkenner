// Every organelle, modelled in code from Three.js primitives.
//
// A factory is created once per organelle type and owns the shared geometries
// and materials. `create()` then stamps out as many instances as the cell needs.
//
//   const factory = ORGANELLE_FACTORIES.mitochondrien({ color, scale, rng });
//   const mesh = factory.create();
//
// factory.radius is the bounding radius used for layout, camera framing and glow.
//
// Shapes that are interesting on the inside (nucleus, mitochondrion,
// chloroplast) have the same local quadrant cut away – see CUT in geometryUtils.

import * as THREE from 'three';
import {
  CUT,
  cutCapsuleShell,
  cutSphere,
  deform,
  fibonacciSphere,
  merge,
  smoothClosed,
} from './geometryUtils.js';

const shade = (hex, amount) => {
  const color = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color('#ffffff') : new THREE.Color('#000000');
  return color.lerp(target, Math.abs(amount));
};

const standard = (color, options = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02, ...options });

const glossy = (color, options = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
    ...options,
  });

/** Small helper so every factory returns the same shape. */
function factory({ radius, parts }) {
  return {
    radius,
    materials: parts.map((part) => part.material),
    geometries: parts.map((part) => part.geometry),
    create() {
      const group = new THREE.Group();
      parts.forEach((part) => {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        if (part.renderOrder) mesh.renderOrder = part.renderOrder;
        group.add(mesh);
      });
      return group;
    },
  };
}

// ---------------------------------------------------------------------------
// Celnucleus – solid ball with a quarter removed, so the nucleolus shows.
// ---------------------------------------------------------------------------
function createNucleusFactory({ color, scale }) {
  const R = scale ?? 0.35;

  const envelope = cutSphere(R, 48, 32);

  // The two flat faces of the cut, plus a darker rim that reads as the
  // double nuclear envelope.
  const faceZ = new THREE.CircleGeometry(R * 0.995, 40, -Math.PI / 2, Math.PI); // z = 0, x >= 0
  const faceX = new THREE.CircleGeometry(R * 0.995, 40, Math.PI / 2, Math.PI).rotateY(Math.PI / 2); // x = 0, z >= 0
  const rimZ = new THREE.RingGeometry(R * 0.9, R, 40, 1, -Math.PI / 2, Math.PI).translate(0, 0, 0.0015);
  const rimX = new THREE.RingGeometry(R * 0.9, R, 40, 1, Math.PI / 2, Math.PI)
    .rotateY(Math.PI / 2)
    .translate(0.0015, 0, 0);

  // Nuclear pores on the part of the envelope that is still there.
  const pores = fibonacciSphere(90)
    .filter((p) => !(p.x > -0.08 && p.z > -0.08))
    .map((p) => {
      const pore = new THREE.SphereGeometry(R * 0.04, 8, 6).scale(1, 0.35, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p);
      return pore.applyQuaternion(q).translate(p.x * R, p.y * R, p.z * R);
    });

  return factory({
    radius: R,
    parts: [
      { geometry: envelope, material: standard(color, { roughness: 0.5 }) },
      {
        geometry: merge([faceZ, faceX]),
        material: standard(shade(color, 0.45), { roughness: 0.75, side: THREE.DoubleSide }),
      },
      {
        geometry: merge([rimZ, rimX, ...pores]),
        material: standard(shade(color, -0.4), { roughness: 0.6, side: THREE.DoubleSide }),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Nucleolus – dense, slightly lumpy ball in the middle of the nucleus.
// ---------------------------------------------------------------------------
function createNucleolusFactory({ color, scale }) {
  const R = scale ?? 0.15;
  const geometry = smoothClosed(
    deform(new THREE.SphereGeometry(R, 40, 28), (v) => {
      const bump = Math.sin(v.x * 70) * Math.sin(v.y * 64) * Math.sin(v.z * 76);
      v.multiplyScalar(1 + 0.05 * bump);
    }),
  );
  return factory({
    radius: R,
    parts: [{ geometry, material: standard(color, { roughness: 0.85 }) }],
  });
}

// ---------------------------------------------------------------------------
// Mitochondrion – capsule, cut open to show the folded inner membrane.
// ---------------------------------------------------------------------------
function createMitochondrionFactory({ color }) {
  const radius = 0.05;
  const cylinderLength = 0.12;
  const half = cylinderLength / 2;

  const outer = cutCapsuleShell(radius, cylinderLength, 24);

  // Cristae: a stack of thin plates, alternately shifted left and right.
  const cristae = [];
  const plates = 9;
  for (let i = 0; i < plates; i += 1) {
    const t = i / (plates - 1);
    const y = THREE.MathUtils.lerp(-half - radius * 0.45, half + radius * 0.45, t);
    const overshoot = Math.max(0, Math.abs(y) - half);
    const plateRadius = Math.sqrt(Math.max(radius ** 2 - overshoot ** 2, 1e-6)) * 0.84;
    cristae.push(
      new THREE.CylinderGeometry(plateRadius, plateRadius, 0.009, 20).translate(
        (i % 2 ? 1 : -1) * radius * 0.12,
        y,
        0,
      ),
    );
  }
  // Thin core so the plates read as one continuous folded membrane.
  cristae.push(new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, cylinderLength + radius, 10));

  return factory({
    radius: half + radius,
    parts: [
      { geometry: outer, material: standard(color, { roughness: 0.45, side: THREE.DoubleSide }) },
      { geometry: merge(cristae), material: standard(shade(color, 0.55), { roughness: 0.7 }) },
    ],
  });
}

// ---------------------------------------------------------------------------
// Chloroplast – green lens with a slice removed; grana stacks inside.
// ---------------------------------------------------------------------------
function createChloroplastFactory({ color }) {
  const rx = 0.13;
  const ry = 0.052;
  const rz = 0.085;

  const outer = cutSphere(1, 36, 20).scale(rx, ry, rz);

  const grana = [];
  const lamellae = [];
  const stacks = [
    [0.05, 0.028], [0.0, 0.0], [-0.055, 0.012], [0.035, -0.035],
    [-0.025, -0.042], [0.085, -0.004], [-0.015, 0.045], [-0.085, -0.02],
  ];
  stacks.forEach(([x, z], index) => {
    const room = ry * Math.sqrt(Math.max(1 - (x / rx) ** 2 - (z / rz) ** 2, 0)) * 0.8;
    const discs = Math.max(2, Math.floor(room / 0.0085) * 2);
    for (let d = 0; d < discs; d += 1) {
      const y = (d - (discs - 1) / 2) * 0.0085;
      grana.push(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 14).translate(x, y, z));
    }
    const [nx, nz] = stacks[(index + 1) % stacks.length];
    const length = Math.hypot(nx - x, nz - z);
    lamellae.push(
      new THREE.BoxGeometry(length, 0.0025, 0.012)
        .rotateY(-Math.atan2(nz - z, nx - x))
        .translate((x + nx) / 2, 0, (z + nz) / 2),
    );
  });

  return factory({
    radius: rx,
    parts: [
      { geometry: outer, material: glossy(color, { side: THREE.DoubleSide, roughness: 0.4 }) },
      { geometry: merge(grana), material: standard(shade(color, -0.45), { roughness: 0.6 }) },
      { geometry: merge(lamellae), material: standard(shade(color, 0.35), { roughness: 0.6 }) },
    ],
  });
}

// ---------------------------------------------------------------------------
// Golgi – stack of curved, flattened sacs with vesicles budding off.
// ---------------------------------------------------------------------------
function createGolgiFactory({ color, rng }) {
  const sacs = [];
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const width = THREE.MathUtils.lerp(0.135, 0.08, t);
    const depth = THREE.MathUtils.lerp(0.075, 0.05, t);
    const y = (i - (count - 1) / 2) * 0.026;
    const sac = new THREE.SphereGeometry(1, 28, 14).scale(width, 0.0085, depth);
    deform(sac, (v) => {
      const edge = (v.x / width) ** 2;
      v.y += 2.6 * v.x * v.x + y; // bend into a shallow bowl
      v.y += 0.004 * edge * Math.sin(v.z * 90); // swollen, slightly wavy rims
    });
    sacs.push(smoothClosed(sac));
  }

  const vesicles = [];
  for (let i = 0; i < 9; i += 1) {
    const side = i % 2 ? 1 : -1;
    const r = rng.range(0.009, 0.017);
    vesicles.push(
      new THREE.SphereGeometry(r, 12, 10).translate(
        side * rng.range(0.115, 0.16),
        rng.range(-0.02, 0.1),
        rng.spread(0.06),
      ),
    );
  }

  return factory({
    radius: 0.155,
    parts: [
      { geometry: merge(sacs), material: glossy(color, { roughness: 0.4 }) },
      { geometry: merge(vesicles), material: glossy(shade(color, 0.3), { roughness: 0.3 }) },
    ],
  });
}

// ---------------------------------------------------------------------------
// Ruw ER – wavy sheets wrapped around the nucleus, studded with ribosomes.
// ---------------------------------------------------------------------------
function createRoughErFactory({ color, rng, ribosomeColor }) {
  const sheets = [];
  const dots = [];
  const count = 4;
  const sheetY = (x, z, layer) =>
    layer * 0.034 - 1.5 * (x * x + 0.6 * z * z) + 0.006 * Math.sin(x * 46 + layer) * Math.cos(z * 38);

  for (let layer = 0; layer < count; layer += 1) {
    const width = 0.15 - layer * 0.012;
    const depth = 0.11 - layer * 0.01;
    const sheet = new THREE.SphereGeometry(1, 36, 14).scale(width, 0.0075, depth);
    deform(sheet, (v) => {
      v.y += sheetY(v.x, v.z, layer);
    });
    sheets.push(smoothClosed(sheet));

    for (let i = 0; i < 46; i += 1) {
      const angle = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * 0.9;
      const x = Math.cos(angle) * r * width;
      const z = Math.sin(angle) * r * depth;
      const thickness = 0.0075 * Math.sqrt(Math.max(1 - r * r, 0)) + 0.003;
      const side = rng.next() > 0.5 ? 1 : -1;
      dots.push(new THREE.SphereGeometry(0.0052, 6, 5).translate(x, sheetY(x, z, layer) + side * thickness, z));
    }
  }

  // Centre the stack on its own origin.
  const offset = -((count - 1) * 0.034) / 2 + 0.012;
  const sheetGeometry = merge(sheets).translate(0, offset, 0);
  const dotGeometry = merge(dots).translate(0, offset, 0);

  return factory({
    radius: 0.16,
    parts: [
      { geometry: sheetGeometry, material: standard(color, { roughness: 0.5 }) },
      { geometry: dotGeometry, material: standard(ribosomeColor ?? '#FFF176', { roughness: 0.6 }) },
    ],
  });
}

// ---------------------------------------------------------------------------
// Glad ER – network of smooth tubes (torus arcs), no ribosomes.
// ---------------------------------------------------------------------------
function createSmoothErFactory({ color, rng }) {
  const tubes = [];
  const euler = new THREE.Euler();
  for (let i = 0; i < 11; i += 1) {
    const ringRadius = rng.range(0.04, 0.085);
    const arc = rng.range(Math.PI * 0.9, Math.PI * 1.9);
    const tube = new THREE.TorusGeometry(ringRadius, 0.0105, 10, 36, arc);
    euler.set(rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2));
    tube.applyQuaternion(new THREE.Quaternion().setFromEuler(euler));
    tube.translate(rng.spread(0.055), rng.spread(0.045), rng.spread(0.055));
    tubes.push(tube);
  }
  // Round knots where tubes meet keep the network from looking like loose rings.
  for (let i = 0; i < 6; i += 1) {
    tubes.push(
      new THREE.SphereGeometry(0.017, 12, 10).translate(rng.spread(0.07), rng.spread(0.05), rng.spread(0.07)),
    );
  }
  return factory({
    radius: 0.14,
    parts: [{ geometry: merge(tubes), material: glossy(color, { roughness: 0.35 }) }],
  });
}

// ---------------------------------------------------------------------------
// Lysosoom – small vesicle with enzyme granules just under the surface.
// ---------------------------------------------------------------------------
function createLysosomeFactory({ color }) {
  const R = 0.055;
  const granules = fibonacciSphere(14).map((p, i) =>
    new THREE.SphereGeometry(R * (0.2 + (i % 3) * 0.05), 10, 8).translate(p.x * R * 0.86, p.y * R * 0.86, p.z * R * 0.86),
  );
  return factory({
    radius: R * 1.1,
    parts: [
      { geometry: new THREE.SphereGeometry(R, 28, 20), material: glossy(color, { roughness: 0.25 }) },
      { geometry: merge(granules), material: standard(shade(color, -0.35), { roughness: 0.6 }) },
    ],
  });
}

// ---------------------------------------------------------------------------
// Centriool – nine triplets of microtubules arranged in a cylinder.
// ---------------------------------------------------------------------------
function createCentrioleFactory({ color }) {
  const length = 0.09;
  const ring = 0.021;
  const tubules = [];
  for (let k = 0; k < 9; k += 1) {
    const angle = (k / 9) * Math.PI * 2;
    const tilt = angle + 0.95; // triplets sit at an angle, like turbine blades
    for (let j = -1; j <= 1; j += 1) {
      tubules.push(
        new THREE.CylinderGeometry(0.0042, 0.0042, length, 8).translate(
          Math.cos(angle) * ring + Math.cos(tilt) * j * 0.0078,
          0,
          Math.sin(angle) * ring + Math.sin(tilt) * j * 0.0078,
        ),
      );
    }
  }
  return factory({
    radius: 0.04,
    parts: [{ geometry: merge(tubules), material: standard(color, { roughness: 0.4, metalness: 0.1 }) }],
  });
}

// ---------------------------------------------------------------------------
// Vacuole – large, watery and see-through.
// ---------------------------------------------------------------------------
export const VACUOLE_RADII = new THREE.Vector3(0.26, 0.5, 0.4);

function createVacuoleFactory({ color, scale }) {
  const radii = VACUOLE_RADII.clone().multiplyScalar(scale ?? 1);
  const geometry = new THREE.SphereGeometry(1, 48, 32).scale(radii.x, radii.y, radii.z);
  return factory({
    radius: Math.max(radii.x, radii.y, radii.z),
    parts: [
      {
        geometry,
        renderOrder: 5,
        material: glossy(color, {
          transparent: true,
          opacity: 0.42,
          roughness: 0.08,
          clearcoat: 1,
          depthWrite: false,
        }),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Fallback, so new data in the API never crashes the viewer.
// ---------------------------------------------------------------------------
function createGenericFactory({ color, scale }) {
  const R = scale ?? 0.08;
  return factory({
    radius: R,
    parts: [{ geometry: new THREE.SphereGeometry(R, 24, 16), material: standard(color) }],
  });
}

// ---------------------------------------------------------------------------
// Instanced geometry: there are hundreds of these, so they share one draw call.
// ---------------------------------------------------------------------------

/** One ribosome = a large and a small subunit. */
export function createRibosomeGeometry() {
  return merge([
    new THREE.SphereGeometry(0.0115, 10, 8),
    new THREE.SphereGeometry(0.0085, 10, 8).translate(0, 0.011, 0.002),
  ]);
}

/** One microvillus = a finger of membrane, base at y = 0. */
/** One pilus: a thin rod along +Y with its base at the origin. */
export function createPilusGeometry(height = 0.2) {
  return new THREE.CylinderGeometry(0.0035, 0.006, height, 6).translate(0, height / 2, 0);
}

export function createMicrovillusGeometry(height = 0.2) {
  const radius = 0.0145;
  return merge([
    new THREE.CylinderGeometry(radius * 0.9, radius * 1.1, height, 10, 1, true).translate(0, height / 2, 0),
    new THREE.SphereGeometry(radius * 0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, height, 0),
  ]);
}

// ---------------------------------------------------------------------------
// Bacterie: nucleoïde (a tangle of DNA), plasmiden (small rings), flagel (a
// stiff helix driven by a motor in the membrane).
// ---------------------------------------------------------------------------
function createNucleoidFactory({ color, scale }) {
  const R = scale ?? 0.3;
  return factory({
    radius: R,
    parts: [
      {
        geometry: new THREE.TorusKnotGeometry(R * 0.58, R * 0.075, 220, 12, 3, 5),
        material: glossy(color, { roughness: 0.4 }),
      },
    ],
  });
}

function createPlasmidFactory({ color }) {
  const R = 0.055;
  return factory({
    radius: R * 1.25,
    parts: [{ geometry: new THREE.TorusGeometry(R, R * 0.22, 10, 48), material: glossy(color, { roughness: 0.35 }) }],
  });
}

function createFlagellumFactory({ color }) {
  // A helix along local +Y: the object is then oriented outward from the cell.
  const length = 1.25;
  const turns = 4;
  const points = [];
  for (let i = 0; i <= 120; i += 1) {
    const t = i / 120;
    const r = 0.075 * Math.min(1, t * 6); // starts straight at the motor, then coils
    const a = t * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * r, t * length, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const hook = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 10).translate(0, -0.03, 0);
  const motor = merge([
    new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20).translate(0, -0.075, 0),
    new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20).translate(0, -0.045, 0),
  ]);
  return factory({
    radius: 0.45,
    parts: [
      { geometry: new THREE.TubeGeometry(curve, 240, 0.02, 10, false), material: glossy(color, { roughness: 0.4 }) },
      { geometry: hook, material: standard(shade(color, -0.3)) },
      { geometry: motor, material: standard(shade(color, -0.45), { roughness: 0.6 }) },
    ],
  });
}

export const ORGANELLE_FACTORIES = {
  nucleoide: createNucleoidFactory,
  plasmiden: createPlasmidFactory,
  flagel: createFlagellumFactory,
  celnucleus: createNucleusFactory,
  nucleolus: createNucleolusFactory,
  mitochondrien: createMitochondrionFactory,
  chloroplasten: createChloroplastFactory,
  golgi: createGolgiFactory,
  ruw_er: createRoughErFactory,
  glad_er: createSmoothErFactory,
  lysosomen: createLysosomeFactory,
  centriolen: createCentrioleFactory,
  vacuole: createVacuoleFactory,
  generic: createGenericFactory,
};

export { CUT };
