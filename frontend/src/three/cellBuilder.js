// Turns the API data for one cell into a Three.js model.
//
//   const model = buildCell(cell, organelleDefinitions, { clipPlanes, mode });
//   scene.add(model.root);
//
// model.entries  Map(organelleId -> { id, name, color, kind, materials, instances })
// model.pickables   meshes the raycaster may hit (userData.organelleId is set)
// model.colliders   bounding spheres, used to keep the camera out of organelles

import * as THREE from 'three';
import { createRng } from './random.js';
import { createContainer, relaxLayout, sampleFreePosition } from './layout.js';
import { CUT, cellShellGeometry, orientObject } from './geometryUtils.js';
import {
  ORGANELLE_FACTORIES,
  VACUOLE_RADII,
  createMicrovillusGeometry,
  createRibosomeGeometry,
} from './organelles.js';

const SHELL_IDS = new Set(['celmembraan', 'celwand']);
const FIXED_IDS = new Set(['celnucleus', 'nucleolus', 'vacuole']);
const UP = new THREE.Vector3(0, 1, 0);

export function isShell(organelleId) {
  return SHELL_IDS.has(organelleId);
}

export function buildCell(cell, organelleDefinitions, { clipPlanes = [], mode = 'viewer' } = {}) {
  const rng = createRng(`cel:${cell.id}`);
  const inside = mode === 'intracellular';
  const definitions = new Map(organelleDefinitions.map((d) => [d.id, d]));
  const placements = new Map(cell.organelles.map((p) => [p.organelle_id, p]));
  const definitionOf = (id) => definitions.get(id) ?? { id, name: id, color: '#B0BEC5' };

  const membraneScale = placements.get('celmembraan')?.scale ?? 1;
  const container = createContainer(cell.shape, membraneScale);

  const root = new THREE.Group();
  root.name = `cel-${cell.id}`;
  const entries = new Map();
  const pickables = [];
  const colliders = [];
  const geometries = new Set();
  const materials = new Set();

  function register(id, kind) {
    const definition = definitionOf(id);
    const entry = {
      id,
      name: definition.name,
      color: definition.color,
      kind,
      materials: [],
      instances: [],
    };
    entries.set(id, entry);
    return entry;
  }

  function track(entry, object, instanceIndex) {
    object.traverse((node) => {
      if (!node.isMesh) return;
      node.userData.organelleId = entry.id;
      node.userData.instanceIndex = instanceIndex;
      pickables.push(node);
      geometries.add(node.geometry);
      [].concat(node.material).forEach((material) => {
        materials.add(material);
        if (!entry.materials.includes(material)) entry.materials.push(material);
      });
    });
  }

  // -- 1. Hull: cell wall and membrane ---------------------------------------
  const shellMaterial = (color, opacity) =>
    new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.28,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: clipPlanes,
      clipIntersection: true,
    });

  let hullRadius = container.boundingRadius;
  for (const id of ['celwand', 'celmembraan']) {
    const placement = placements.get(id);
    if (!placement) continue;
    const scale = placement.scale ?? 1;
    const isWall = id === 'celwand';
    const color = isWall ? definitionOf(id).color : cell.shape.membrane_color ?? definitionOf(id).color;
    // Under a cell wall the membrane can be fainter: the wall already tints everything.
    const hasWall = placements.has('celwand');
    const opacity = isWall ? (inside ? 0.6 : 0.3) : inside ? 0.5 : hasWall ? 0.16 : 0.24;

    const mesh = new THREE.Mesh(cellShellGeometry(cell.shape, scale), shellMaterial(color, opacity));
    mesh.renderOrder = isWall ? 11 : 10;
    root.add(mesh);

    const entry = register(id, 'shell');
    // A box reaches out to its (rounded) corners, an ellipsoid only to its longest axis.
    const radius =
      cell.shape.kind === 'box' ? Math.hypot(...cell.shape.radii) * scale * 0.88 : Math.max(...cell.shape.radii) * scale;
    hullRadius = Math.max(hullRadius, radius);
    entry.instances.push({ position: new THREE.Vector3(), radius, object: mesh });
    track(entry, mesh, 0);
  }

  // -- 2. Microvilli on the flattened top of the gut cell ---------------------
  const microvilliPlacement = placements.get('microvilli');
  if (microvilliPlacement) {
    const baseY = microvilliPlacement.positions[0]?.[1] ?? container.top;
    const k = Math.sqrt(Math.max(1 - (baseY / container.radii.y) ** 2, 0));
    const discX = container.radii.x * k - 0.03;
    const discZ = container.radii.z * k - 0.03;
    const spacing = 0.058;
    const height = 0.2;

    const spots = [];
    for (let row = -Math.ceil(discZ / spacing); row * spacing * 0.866 <= discZ; row += 1) {
      for (let col = -Math.ceil(discX / spacing) - 1; col * spacing <= discX; col += 1) {
        const x = (col + (row % 2 ? 0.5 : 0)) * spacing + rng.spread(0.006);
        const z = row * spacing * 0.866 + rng.spread(0.006);
        if ((x / discX) ** 2 + (z / discZ) ** 2 <= 1) spots.push([x, z]);
      }
    }

    const entry = register('microvilli', 'instanced');
    const material = new THREE.MeshPhysicalMaterial({
      color: entry.color,
      roughness: 0.35,
      clearcoat: 0.5,
      clippingPlanes: clipPlanes,
      clipIntersection: true,
    });
    const mesh = new THREE.InstancedMesh(createMicrovillusGeometry(height), material, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, baseY - 0.004, z);
      dummy.rotation.set(rng.spread(0.09), rng.range(0, Math.PI * 2), rng.spread(0.09));
      dummy.scale.set(1, rng.range(0.82, 1.12), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
    entry.count = spots.length;
    entry.instances.push({
      position: new THREE.Vector3(0, baseY + height / 2, 0),
      radius: Math.max(discX, discZ) * 0.75,
      object: mesh,
      preferredDirection: new THREE.Vector3(0.55, 0.7, 0.55).normalize(),
    });
    track(entry, mesh, 0);
  }

  // -- 3. Things that never move: nucleus, nucleolus, vacuole ------------------
  const obstacles = [];
  const nucleusPlacement = placements.get('celnucleus');
  if (nucleusPlacement?.positions[0]) {
    const r = nucleusPlacement.scale ?? 0.35;
    obstacles.push({
      id: 'celnucleus',
      center: new THREE.Vector3(...nucleusPlacement.positions[0]),
      radii: new THREE.Vector3(r, r, r),
    });
  }
  const vacuolePlacement = placements.get('vacuole');
  if (vacuolePlacement?.positions[0]) {
    obstacles.push({
      id: 'vacuole',
      center: new THREE.Vector3(...vacuolePlacement.positions[0]),
      radii: VACUOLE_RADII.clone().multiplyScalar(vacuolePlacement.scale ?? 1),
    });
  }
  const nucleusCenter = obstacles.find((o) => o.id === 'celnucleus')?.center ?? new THREE.Vector3();

  // -- 4. Solid organelles: start on the lesson positions, then de-overlap ------
  const factories = new Map();
  const movable = [];
  const fixedItems = [];
  const solidPlacements = cell.organelles.filter(
    (p) => !SHELL_IDS.has(p.organelle_id) && p.organelle_id !== 'microvilli' && p.organelle_id !== 'ribosomen',
  );

  for (const placement of solidPlacements) {
    const id = placement.organelle_id;
    const create = ORGANELLE_FACTORIES[id] ?? ORGANELLE_FACTORIES.generic;
    const organelleFactory = create({
      color: definitionOf(id).color,
      scale: placement.scale ?? undefined,
      ribosomeColor: definitionOf('ribosomen').color,
      rng,
    });
    factories.set(id, organelleFactory);
    register(id, 'solid');

    placement.positions.forEach((xyz, index) => {
      const anchor = new THREE.Vector3(...xyz);
      const item = {
        id,
        index,
        anchor,
        position: anchor.clone(),
        radius: organelleFactory.radius,
        factory: organelleFactory,
      };
      if (id === 'centriolen') item.group = 'centrosoom'; // the pair may touch
      (FIXED_IDS.has(id) ? fixedItems : movable).push(item);
    });
  }

  relaxLayout(movable, obstacles, container, rng);

  // -- 5. Extra, randomly placed copies (mitochondria, chloroplasts, ...) --------
  const placed = [...movable];
  for (const placement of solidPlacements) {
    const spec = placement.random;
    if (!spec || FIXED_IDS.has(placement.organelle_id)) continue;
    const organelleFactory = factories.get(placement.organelle_id);
    for (let i = 0; i < spec.count; i += 1) {
      const position = sampleFreePosition(rng, spec.range, organelleFactory.radius, container, obstacles, placed);
      if (!position) break; // cell is full
      placed.push({
        id: placement.organelle_id,
        index: placement.positions.length + i,
        anchor: position.clone(),
        position,
        radius: organelleFactory.radius,
        factory: organelleFactory,
      });
    }
  }

  // -- 6. Instantiate and orient ---------------------------------------------
  const radial = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const opening = new THREE.Vector3();

  function addInstance(item) {
    const entry = entries.get(item.id);
    const object = item.factory.create();
    object.position.copy(item.position);

    radial.copy(item.position);
    if (radial.lengthSq() < 1e-6) radial.copy(CUT.bisector);
    radial.normalize();

    switch (item.id) {
      case 'celnucleus':
      case 'nucleolus':
      case 'vacuole':
        break; // the nucleus keeps its opening towards +x/+z, same as the membrane
      case 'mitochondrien':
        // Long axis along the membrane, opening towards the outside of the cell.
        axis.crossVectors(radial, rng.unitVector(opening));
        if (axis.lengthSq() < 1e-6) axis.crossVectors(radial, UP);
        orientObject(object, axis, radial);
        break;
      case 'chloroplasten':
        // Flat side towards the wall, like solar panels catching light.
        axis.copy(radial).addScaledVector(rng.unitVector(opening), 0.45);
        orientObject(object, axis, rng.unitVector(opening));
        break;
      case 'golgi':
      case 'ruw_er':
        // Curved side hugs the nucleus.
        axis.subVectors(item.position, nucleusCenter);
        if (axis.lengthSq() < 1e-6) axis.copy(radial);
        orientObject(object, axis, rng.unitVector(opening));
        break;
      case 'centriolen':
        // A centrosome is two centrioles at right angles to each other.
        orientObject(object, item.index % 2 ? new THREE.Vector3(1, 0, 0) : UP, CUT.bisector);
        break;
      default:
        orientObject(object, rng.unitVector(axis), rng.unitVector(opening));
    }

    root.add(object);
    // Some shapes (the curved Golgi stack, the ER sheets) are not centred on
    // their own origin, so the camera aims at the middle of what you actually see.
    object.updateWorldMatrix(true, true);
    const focus = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    const instanceIndex = entry.instances.length;
    entry.instances.push({
      position: item.position.clone(),
      focus,
      anchor: item.anchor.clone(),
      radius: item.radius,
      object,
    });
    track(entry, object, instanceIndex);
    colliders.push({
      id: item.id,
      position: item.position.clone(),
      radius: item.id === 'vacuole' ? VACUOLE_RADII.x : item.radius,
      nestedIn: item.id === 'nucleolus' ? 'celnucleus' : null,
    });
  }

  [...fixedItems, ...placed].forEach(addInstance);

  // -- 7. Free ribosomes --------------------------------------------------------
  const ribosomePlacement = placements.get('ribosomen');
  if (ribosomePlacement) {
    const entry = register('ribosomen', 'instanced');
    const spots = ribosomePlacement.positions.map((xyz) => new THREE.Vector3(...xyz));
    const spec = ribosomePlacement.random;
    for (let i = 0; spec && i < spec.count; i += 1) {
      const spot = sampleFreePosition(rng, spec.range, 0.016, container, obstacles, placed, 200);
      if (spot) spots.push(spot);
    }

    const material = new THREE.MeshStandardMaterial({ color: entry.color, roughness: 0.5 });
    const mesh = new THREE.InstancedMesh(createRibosomeGeometry(), material, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach((spot, i) => {
      dummy.position.copy(spot);
      dummy.rotation.set(rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      entry.instances.push({ position: spot, radius: 0.02, object: mesh, instanceId: i });
    });
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
    entry.count = spots.length;
    track(entry, mesh, 0);
  }

  entries.forEach((entry) => {
    if (entry.count == null) entry.count = entry.instances.length;
  });

  return {
    root,
    entries,
    pickables,
    colliders,
    container,
    boundingRadius: hullRadius,
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
