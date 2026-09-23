// The 3D stage: renderer, camera, controls, picking, glow and animations.
// React only talks to this class through a handful of methods, so all
// per-frame work stays outside React's render cycle.
//
//   const stage = new CellScene(containerElement, { mode, onSelect });
//   stage.loadCell(cell, organelleDefinitions);
//   stage.select('mitochondrien');
//   stage.dispose();

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildCell, isShell } from './cellBuilder.js';

const BACKGROUND = '#0F0F1A';
const HIGHLIGHT = new THREE.Color('#00E5FF');
const WEDGE_VIEW = new THREE.Vector3(1, 0.42, 1).normalize(); // looks into the opened quadrant

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

// 26 directions around a point, used to find an unobstructed camera angle.
const PROBE_DIRECTIONS = [];
for (let x = -1; x <= 1; x += 1) {
  for (let y = -1; y <= 1; y += 1) {
    for (let z = -1; z <= 1; z += 1) {
      if (x || y || z) PROBE_DIRECTIONS.push(new THREE.Vector3(x, y * 0.7, z).normalize());
    }
  }
}

/** Soft round dot, used for the glow halos and the floating dust. */
function softDotTexture(coreAlpha, midAlpha) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(255,255,255,${coreAlpha})`);
  gradient.addColorStop(0.4, `rgba(255,255,255,${midAlpha})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const MODES = {
  // Looking at the cell from outside; membrane opens to reveal the inside.
  viewer: { fov: 42, minDistance: 0.22, maxDistance: 9, rotateSpeed: 0.9, zoomFactor: 4.2, minZoom: 0.34 },
  // Standing inside the cytoplasm.
  intracellular: { fov: 68, minDistance: 0.06, maxDistance: 1.1, rotateSpeed: 0.45, zoomFactor: 3.0, minZoom: 0.2 },
  // Small, non-interactive preview on the home page.
  preview: { fov: 38, minDistance: 1, maxDistance: 9, rotateSpeed: 1.4, zoomFactor: 4.2, minZoom: 0.34 },
};

export class CellScene {
  constructor(container, { mode = 'viewer', onSelect = () => {}, onReady = () => {} } = {}) {
    this.container = container;
    this.mode = MODES[mode] ? mode : 'viewer';
    this.settings = MODES[this.mode];
    this.onSelect = onSelect;
    this.onReady = onReady;
    this.interactive = this.mode !== 'preview';

    this.model = null;
    this.selectedId = null;
    this.hoveredId = null;
    this.autoRotate = true;
    this.openTarget = 0;
    this.openProgress = 0;
    this.introTime = 0;
    this.tween = null;
    this.elapsed = 0;
    this.pointer = { x: 0, y: 0, downX: 0, downY: 0, downAt: 0, dirty: false, inside: false };
    this.size = { width: 1, height: 1 };
    this.showNames = true; // the quiz hides the hover tooltip: the name is the answer
    this.inset = { right: 0, bottom: 0 }; // canvas area covered by UI, in CSS pixels
    this.insetTarget = { right: 0, bottom: 0 };
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.className = 'cell-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND);
    if (this.mode === 'intracellular') this.scene.fog = new THREE.FogExp2('#101c2b', 0.42);

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.01, 60);
    this.camera.position.set(3, 1.4, 3);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.8;
    this.controls.minDistance = this.settings.minDistance;
    this.controls.maxDistance = this.settings.maxDistance;
    this.controls.autoRotateSpeed = this.settings.rotateSpeed;
    if (!this.interactive) {
      this.controls.enableZoom = false;
      this.controls.enableRotate = false;
    }

    // The membrane (and wall, and microvilli) are clipped where BOTH planes
    // clip, i.e. in the quadrant x > a and z > a. Animating `a` from far
    // outside the cell to 0 makes the cell open up.
    this.clipPlanes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), 100),
    ];

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);

    this.#addLights();
    this.#addDust();
    this.#createGlowSprites();
    this.#createRouteGroup();
    if (this.interactive) this.#createTooltip();

    this.#bindEvents();
    this.resize();
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  // ---------------------------------------------------------------- public API

  loadCell(cell, organelleDefinitions) {
    this.#unloadModel();
    this.model = buildCell(cell, organelleDefinitions, { clipPlanes: this.clipPlanes, mode: this.mode });
    this.modelRoot.add(this.model.root);

    this.model.entries.forEach((entry) => {
      entry.materials.forEach((material) => {
        material.userData.baseEmissive = material.emissive.clone();
        material.userData.baseEmissiveIntensity = material.emissiveIntensity;
        material.userData.baseOpacity = material.opacity;
      });
    });

    this.closedOffset = this.model.boundingRadius * 1.25 + 0.3;
    this.openProgress = 0;
    this.openTarget = 0;
    this.#applyClip();

    this.selectedId = null;
    this.hoveredId = null;
    this.introTime = 0;
    this.modelRoot.scale.setScalar(this.reducedMotion ? 1 : 0.001);

    const home = this.#homePose();
    this.camera.position.copy(home.position);
    this.controls.target.copy(home.target);
    this.controls.update();
    this.onReady(this.model);
  }

  /** Select an organelle type. `instance` optionally picks which copy to fly to. */
  select(organelleId, { instanceIndex = null, fly = true } = {}) {
    if (!this.model) return;
    const entry = organelleId ? this.model.entries.get(organelleId) : null;
    if (!entry) {
      this.clearSelection();
      return;
    }
    this.#setHighlight(this.selectedId, 0);
    this.#resetHover();
    this.selectedId = entry.id;

    const instance = this.#chooseInstance(entry, instanceIndex);
    this.#placeGlow(entry, instance);
    if (fly) this.#flyTo(this.#focusPose(entry, instance));
  }

  clearSelection({ fly = true } = {}) {
    if (!this.selectedId) return;
    this.#setHighlight(this.selectedId, 0);
    this.#resetHover();
    this.selectedId = null;
    this.#hideGlow();
    if (fly) this.#flyTo(this.#homePose());
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
  }

  /** Show or hide the organelle name that follows the pointer. */
  setShowNames(enabled) {
    this.showNames = enabled;
    if (!enabled) this.tooltip?.classList.remove('is-visible');
  }

  /** Open or close the membrane (viewer mode only). */
  setOpen(open) {
    this.openTarget = open && this.mode !== 'intracellular' ? 1 : 0;
  }

  /**
   * Draw the path of a process: a glowing line from organelle to organelle
   * (ids in order). The last segment is the active one: it gets the moving
   * packets and the arrowhead; earlier segments stay as faint lines.
   */
  setRoute(organelleIds = []) {
    this.routeGroup.clear();
    this.routeCurves = [];
    this.routePackets = [];
    if (!this.model || organelleIds.length < 2) return;

    const points = [];
    organelleIds.forEach((id, index) => {
      const point = this.#routePoint(id, points[index - 1] ?? null, organelleIds[index + 1] ?? null);
      if (point) points.push(point);
    });
    if (points.length < 2) return;

    const centre = new THREE.Vector3();
    for (let i = 1; i < points.length; i += 1) {
      const from = points[i - 1];
      const to = points[i];
      // Arc away from the centre so the line does not cut through the organelles in between.
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const outward = mid.clone().sub(centre);
      if (outward.lengthSq() < 1e-4) outward.set(0, 1, 0);
      const bulge = Math.min(0.35, from.distanceTo(to) * 0.45);
      const control = mid.addScaledVector(outward.normalize(), bulge);
      const curve = new THREE.QuadraticBezierCurve3(from, control, to);
      const active = i === points.length - 1;
      this.routeCurves.push(curve);

      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 32, active ? 0.009 : 0.006, 8, false),
        new THREE.MeshBasicMaterial({
          color: HIGHLIGHT,
          transparent: true,
          opacity: active ? 0.75 : 0.28,
          depthWrite: false,
        }),
      );
      tube.renderOrder = 20;
      this.routeGroup.add(tube);

      if (!active) continue;

      // Arrowhead at the end, pointing along the curve.
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.03, 0.07, 12),
        new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      cone.position.copy(curve.getPointAt(0.985));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(0.985).normalize());
      cone.renderOrder = 21;
      this.routeGroup.add(cone);

      // Packets that travel along the active segment.
      for (let k = 0; k < 5; k += 1) {
        const packet = new THREE.Sprite(this.glowMaterial.clone());
        packet.material.opacity = 0.95;
        packet.scale.setScalar(0.09);
        packet.renderOrder = 22;
        packet.userData.offset = k / 5;
        this.routeGroup.add(packet);
        this.routePackets.push(packet);
      }
    }
  }

  resetCamera() {
    this.#flyTo(this.#homePose());
  }

  /**
   * Tell the stage which part of the canvas is covered by UI (the explanation
   * panel). The picture is shifted so the focused organelle stays centred in
   * the part that is still visible.
   */
  setViewInsets({ right = 0, bottom = 0 } = {}) {
    this.insetTarget = { right, bottom };
    if (this.reducedMotion) {
      this.inset = { right, bottom };
      this.#applyViewOffset();
    }
  }

  resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.size = { width, height };
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // On narrow (portrait) screens, widen the view so the cell still fits.
    this.camera.fov = this.settings.fov * (this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 0.9 : 1);
    this.camera.updateProjectionMatrix();
    this.#applyViewOffset();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlers.down);
    canvas.removeEventListener('pointerup', this.handlers.up);
    canvas.removeEventListener('pointermove', this.handlers.move);
    canvas.removeEventListener('pointerleave', this.handlers.leave);
    this.controls.dispose();
    this.#unloadModel();
    this.scene.traverse((node) => {
      node.geometry?.dispose();
      [].concat(node.material ?? []).forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // browsers only allow a handful of live WebGL contexts
    canvas.remove();
    this.tooltip?.remove();
  }

  #applyViewOffset() {
    const { width, height } = this.size;
    const { right, bottom } = this.inset;
    if (right < 0.5 && bottom < 0.5) {
      if (this.camera.view?.enabled) this.camera.clearViewOffset();
      return;
    }
    this.camera.setViewOffset(width, height, right / 2, bottom / 2, width, height);
  }

  // ------------------------------------------------------------------- set-up

  #addLights() {
    this.scene.add(new THREE.HemisphereLight('#dfe9ff', '#1a1430', 1.15));

    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(3, 4, 5);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight('#9fd8ff', 0.7);
    fill.position.set(-4, -1, -3);
    this.scene.add(fill);

    // Headlamp: travels with the camera, so whatever you fly to is lit.
    // decay 0: the same brightness at every distance, so close-ups are not bleached.
    this.headlamp = new THREE.PointLight('#ffffff', this.mode === 'intracellular' ? 1.1 : 0.7, 0, 0);
    this.camera.add(this.headlamp);
    this.scene.add(this.camera);
  }

  #addDust() {
    const count = this.mode === 'intracellular' ? 700 : 420;
    const positions = new Float32Array(count * 3);
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1;
      const phi = random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const radius = this.mode === 'intracellular' ? 0.15 + random() * 0.95 : 3.5 + random() * 9;
      positions.set([s * Math.cos(phi) * radius, u * radius, s * Math.sin(phi) * radius], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: softDotTexture(1, 0.5), // round specks instead of square points
      color: this.mode === 'intracellular' ? '#9fe8ff' : '#7f8fb5',
      size: this.mode === 'intracellular' ? 0.012 : 0.05,
      transparent: true,
      opacity: this.mode === 'intracellular' ? 0.5 : 0.6,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geometry, material);
    this.scene.add(this.dust);
  }

  #createRouteGroup() {
    this.routeGroup = new THREE.Group();
    this.routeCurves = [];
    this.routePackets = [];
    this.modelRoot.add(this.routeGroup);
  }

  /**
   * Where a route touches an organelle. Solid organelles: the copy the camera
   * would fly to. Shells (membrane, wall): a point on the surface, in the
   * direction of the neighbouring step so the line stays short.
   */
  #routePoint(organelleId, previous, nextId) {
    const entry = this.model.entries.get(organelleId);
    if (!entry) return null;
    if (entry.kind !== 'shell') {
      const instance = this.#chooseInstance(entry, null);
      return (instance.focus ?? instance.position).clone();
    }
    const radii = this.model.container.radii;
    let direction = previous?.clone();
    if (!direction || direction.lengthSq() < 1e-4) {
      const next = nextId ? this.model.entries.get(nextId) : null;
      const anchor = next && next.kind !== 'shell' ? this.#chooseInstance(next, null).position.clone() : null;
      direction = anchor && anchor.lengthSq() > 1e-4 ? anchor : WEDGE_VIEW.clone();
    }
    direction.normalize();
    // Scale the direction until it hits the (inscribed) ellipsoid of the cell.
    const k = 1 / Math.sqrt((direction.x / radii.x) ** 2 + (direction.y / radii.y) ** 2 + (direction.z / radii.z) ** 2);
    const point = direction.multiplyScalar(k * 0.97);
    // Stay under a flattened top (the gut cell): the membrane is not there.
    if (this.model.container.top != null && Number.isFinite(this.model.container.top)) {
      point.y = Math.min(point.y, this.model.container.top - 0.02);
    }
    return point;
  }

  #createGlowSprites() {
    const texture = softDotTexture(0.6, 0.24);
    this.glowMaterial = new THREE.SpriteMaterial({
      map: texture,
      color: HIGHLIGHT,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      fog: false,
    });
    this.glowSprites = [];
    this.glowGroup = new THREE.Group();
    this.modelRoot.add(this.glowGroup);
  }

  #createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'cell-tooltip';
    this.tooltip.setAttribute('role', 'status');
    this.container.appendChild(this.tooltip);
  }

  #bindEvents() {
    const canvas = this.renderer.domElement;
    this.handlers = {
      down: (event) => {
        this.pointer.downX = event.clientX;
        this.pointer.downY = event.clientY;
        this.pointer.downAt = performance.now();
      },
      up: (event) => {
        if (!this.interactive || this.tween) return;
        const moved = Math.hypot(event.clientX - this.pointer.downX, event.clientY - this.pointer.downY);
        if (moved > 6 || performance.now() - this.pointer.downAt > 500) return; // that was a drag
        const hit = this.#pick(event.clientX, event.clientY);
        if (hit) {
          this.select(hit.organelleId, { instanceIndex: hit.instanceIndex });
          this.onSelect(hit.organelleId);
        } else if (this.selectedId) {
          this.clearSelection();
          this.onSelect(null);
        }
      },
      move: (event) => {
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
        this.pointer.dirty = true;
        this.pointer.inside = true;
      },
      leave: () => {
        this.pointer.inside = false;
        this.pointer.dirty = true;
      },
    };
    canvas.addEventListener('pointerdown', this.handlers.down);
    canvas.addEventListener('pointerup', this.handlers.up);
    if (this.interactive) {
      canvas.addEventListener('pointermove', this.handlers.move);
      canvas.addEventListener('pointerleave', this.handlers.leave);
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  #unloadModel() {
    if (!this.model) return;
    this.#hideGlow();
    this.setRoute([]);
    this.modelRoot.remove(this.model.root);
    this.model.dispose();
    this.model = null;
    this.tween = null;
  }

  // ------------------------------------------------------------------ picking

  #pick(clientX, clientY) {
    if (!this.model) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.model.pickables, false);
    if (!hits.length) return null;

    // The membrane surrounds everything, so it would win every click.
    // Prefer whatever lies inside; fall back to the hull itself.
    const inner = hits.find((hit) => !isShell(hit.object.userData.organelleId));
    const hit = inner ?? hits[0];
    const { organelleId, instanceIndex } = hit.object.userData;
    return {
      organelleId,
      instanceIndex: hit.object.isInstancedMesh && hit.instanceId != null ? hit.instanceId : instanceIndex,
    };
  }

  /** Forget what the pointer was on; the next frame looks again (the scene is about to move). */
  #resetHover() {
    if (this.hoveredId && this.hoveredId !== this.selectedId) this.#setHighlight(this.hoveredId, 0);
    this.hoveredId = null;
    this.pointer.dirty = true;
    if (!this.tooltip) return;
    this.tooltip.classList.remove('is-visible');
    this.renderer.domElement.style.cursor = 'grab';
  }

  #updateHover() {
    if (!this.pointer.dirty || !this.interactive) return;
    this.pointer.dirty = false;
    const hit = this.pointer.inside && !this.tween ? this.#pick(this.pointer.x, this.pointer.y) : null;
    const id = hit?.organelleId ?? null;

    if (id !== this.hoveredId) {
      if (this.hoveredId && this.hoveredId !== this.selectedId) this.#setHighlight(this.hoveredId, 0);
      this.hoveredId = id;
      if (id && id !== this.selectedId) this.#setHighlight(id, 1);
      this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      this.tooltip.textContent = id && this.showNames ? this.model.entries.get(id).name : '';
      this.tooltip.classList.toggle('is-visible', Boolean(id) && this.showNames);
    }
    if (id) {
      const rect = this.container.getBoundingClientRect();
      this.tooltip.style.transform = `translate(${this.pointer.x - rect.left + 14}px, ${this.pointer.y - rect.top + 14}px)`;
    }
  }

  // --------------------------------------------------------------------- glow

  /** level 0 = off, 1 = hover, 2 = selected (pulses in #tick). */
  #setHighlight(organelleId, level, pulse = 0) {
    const entry = organelleId ? this.model?.entries.get(organelleId) : null;
    if (!entry) return;
    const shell = entry.kind === 'shell';
    entry.materials.forEach((material) => {
      const { baseEmissive, baseEmissiveIntensity, baseOpacity } = material.userData;
      if (level === 0) {
        material.emissive.copy(baseEmissive);
        material.emissiveIntensity = baseEmissiveIntensity;
        material.opacity = baseOpacity;
        return;
      }
      // The organelle lights up in its own colour, nudged towards the highlight
      // colour. Pure cyan would turn warm colours (orange, pink) into white.
      material.emissive.copy(material.color).lerp(HIGHLIGHT, shell ? 1 : 0.3);
      material.emissiveIntensity = level === 1 ? 0.18 : 0.24 + 0.28 * pulse;
      // See-through things (membrane, wall, vacuole) also become a little more solid.
      if (shell || baseOpacity < 0.6) material.opacity = Math.min(baseOpacity + (level === 1 ? 0.08 : 0.16), 0.9);
    });
  }

  #placeGlow(entry, focusInstance) {
    this.#hideGlow();
    if (entry.kind === 'shell') return; // a halo around the whole cell would just be a blob
    const targets = entry.kind === 'instanced' ? [focusInstance] : entry.instances.slice(0, 32);
    targets.forEach((instance, i) => {
      let sprite = this.glowSprites[i];
      if (!sprite) {
        sprite = new THREE.Sprite(this.glowMaterial);
        sprite.renderOrder = 4;
        this.glowSprites.push(sprite);
        this.glowGroup.add(sprite);
      }
      sprite.visible = true;
      sprite.position.copy(instance.focus ?? instance.position);
      sprite.scale.setScalar(instance.radius * 4.6);
    });
  }

  #hideGlow() {
    this.glowSprites.forEach((sprite) => {
      sprite.visible = false;
    });
  }

  // ------------------------------------------------------------------- camera

  #homePose() {
    const radius = this.model?.boundingRadius ?? 1.2;
    if (this.mode === 'intracellular') {
      const start = this.#freeSpot(new THREE.Vector3(0.12, -0.12, 0.62));
      const nucleus = this.model?.entries.get('celnucleus')?.instances[0]?.position;
      return { position: start, target: nucleus ? nucleus.clone() : new THREE.Vector3() };
    }
    const portrait = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 0.5 : 1;
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(this.settings.fov / 2))) * 1.02 * portrait;
    return {
      position: new THREE.Vector3(0.78, 0.5, 1).normalize().multiplyScalar(distance),
      target: new THREE.Vector3(0, 0, 0),
    };
  }

  /** Nearest point to `wanted` that is inside the cell and outside every organelle. */
  #freeSpot(wanted) {
    const point = wanted.clone();
    if (!this.model) return point;
    for (let i = 0; i < 6; i += 1) {
      for (const collider of this.model.colliders) {
        const min = collider.radius + 0.07;
        const offset = point.clone().sub(collider.position);
        const distance = offset.length();
        if (distance < min) point.copy(collider.position).addScaledVector(offset.normalize(), min);
      }
      this.model.container.clamp(point, 0.08);
    }
    return point;
  }

  #chooseInstance(entry, instanceIndex) {
    if (instanceIndex != null && entry.instances[instanceIndex]) return entry.instances[instanceIndex];
    if (entry.instances.length === 1) return entry.instances[0];
    if (this.mode === 'intracellular') {
      // Whichever copy is nearest: shortest flight.
      return entry.instances.reduce((best, instance) =>
        instance.position.distanceToSquared(this.camera.position) <
        best.position.distanceToSquared(this.camera.position)
          ? instance
          : best,
      );
    }
    // From outside: the copy that sits deepest in the opened quadrant is easiest to see.
    return entry.instances.reduce((best, instance) =>
      instance.position.x + instance.position.z > best.position.x + best.position.z ? instance : best,
    );
  }

  /** Camera position + target that frames one organelle with a clear line of sight. */
  #focusPose(entry, instance) {
    if (entry.kind === 'shell') return this.#homePose();

    const target = (instance.focus ?? instance.position).clone();
    const { zoomFactor, minZoom } = this.settings;
    // Portrait screens are narrow: step back a little so the organelle is not cropped.
    const portrait = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 0.5 : 1;
    const distance =
      THREE.MathUtils.clamp(instance.radius * zoomFactor, minZoom, this.mode === 'intracellular' ? 0.85 : 3) * portrait;
    const inside = this.mode === 'intracellular';

    // Preferred viewing direction.
    const preferred = new THREE.Vector3();
    if (instance.preferredDirection) preferred.copy(instance.preferredDirection);
    else if (entry.id === 'celnucleus' || entry.id === 'nucleolus' || target.length() < 0.25) preferred.copy(WEDGE_VIEW);
    else if (inside) preferred.copy(target).negate().normalize().lerp(WEDGE_VIEW, 0.25).normalize();
    else preferred.copy(target).normalize().lerp(WEDGE_VIEW, 0.35).normalize();

    let best = null;
    const candidate = new THREE.Vector3();
    for (const direction of [preferred, ...PROBE_DIRECTIONS]) {
      candidate.copy(target).addScaledVector(direction, distance);
      let score = direction.dot(preferred);
      if (inside && !this.model.container.contains(candidate, 0.05, 0.02)) score -= 50;
      for (const collider of this.model.colliders) {
        if (collider.id === entry.id && collider.position.distanceToSquared(instance.position) < 1e-6) continue;
        if (collider.id === 'celnucleus' && entry.id === 'nucleolus') continue;
        const gap = candidate.distanceTo(collider.position) - collider.radius;
        if (gap < 0.04) score -= 20; // camera inside something
        else if (segmentHitsSphere(candidate, target, collider.position, collider.radius * 0.85)) {
          score -= collider.id === 'vacuole' ? 0.3 : 1.2; // something blocks the view
        } else if (gap < distance) {
          // Something big hangs in (or right next to) the middle of the picture.
          const toCollider = collider.position.clone().sub(candidate);
          const centreDistance = toCollider.length();
          const offAxis = Math.acos(THREE.MathUtils.clamp(toCollider.dot(direction) / -centreDistance, -1, 1));
          const angularRadius = Math.asin(Math.min(collider.radius / centreDistance, 1));
          if (offAxis - angularRadius < 0.4) score -= 1.5 * angularRadius * (1 - gap / distance);
        }
      }
      if (!best || score > best.score) best = { score, position: candidate.clone() };
    }
    return { position: best.position, target };
  }

  #flyTo(pose, duration = 1.25) {
    if (this.reducedMotion) duration = 0.001;
    this.tween = {
      time: 0,
      duration,
      fromPosition: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPosition: pose.position.clone(),
      toTarget: pose.target.clone(),
    };
    this.controls.enabled = false;
  }

  #updateTween(delta) {
    const tween = this.tween;
    if (!tween) return;
    tween.time += delta;
    const t = easeInOutCubic(Math.min(tween.time / tween.duration, 1));
    this.camera.position.lerpVectors(tween.fromPosition, tween.toPosition, t);
    this.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, t);
    if (tween.time >= tween.duration) {
      this.tween = null;
      this.controls.enabled = true;
      this.pointer.dirty = true; // the view stopped moving: check again what is under the pointer
    }
  }

  // ---------------------------------------------------------------- animation

  #applyClip() {
    const offset = THREE.MathUtils.lerp(this.closedOffset ?? 100, 0.02, easeInOutCubic(this.openProgress));
    this.clipPlanes[0].constant = offset;
    this.clipPlanes[1].constant = offset;
  }

  #tick() {
    // Real elapsed time, so flights take 1.25 s on a slow computer too (it just shows fewer frames).
    // Capped at half a second: after a hidden tab we jump ahead instead of catching up for minutes.
    const delta = Math.min(this.clock.getDelta(), 0.5);
    this.elapsed += delta;

    if (this.model) {
      // 1. The cell grows in ...
      if (this.introTime < 1) {
        this.introTime = Math.min(this.introTime + delta / 0.9, 1);
        this.modelRoot.scale.setScalar(this.reducedMotion ? 1 : Math.max(easeOutCubic(this.introTime), 0.001));
      }
      // 2. ... and then the membrane opens (or closes again on request).
      if (this.introTime >= 1 && this.openProgress !== this.openTarget) {
        const step = delta / (this.reducedMotion ? 0.01 : 1.8);
        this.openProgress =
          this.openProgress < this.openTarget
            ? Math.min(this.openProgress + step, this.openTarget)
            : Math.max(this.openProgress - step, this.openTarget);
        this.#applyClip();
      }
      if (this.selectedId) this.#setHighlight(this.selectedId, 2, 0.5 + 0.5 * Math.sin(this.elapsed * 3.4));
      this.glowMaterial.opacity = 0.6 + 0.25 * Math.sin(this.elapsed * 3.4);
    }

    // Slide the picture aside together with the explanation panel.
    const insetGap =
      Math.abs(this.insetTarget.right - this.inset.right) + Math.abs(this.insetTarget.bottom - this.inset.bottom);
    if (insetGap > 0.01) {
      const k = insetGap < 0.5 ? 1 : 1 - Math.exp(-delta * 9);
      this.inset.right += (this.insetTarget.right - this.inset.right) * k;
      this.inset.bottom += (this.insetTarget.bottom - this.inset.bottom) * k;
      this.#applyViewOffset();
    }

    this.#updateTween(delta);
    this.#updateHover();

    // Rotation pauses while an organelle is selected, so it stays in view.
    this.controls.autoRotate = this.autoRotate && !this.tween && !this.selectedId && !this.reducedMotion;
    this.controls.update(delta);

    if (this.mode === 'intracellular' && this.model && !this.tween) {
      // Keep the visitor inside the cell and out of the organelles.
      const safe = this.#freeSpot(this.camera.position);
      this.camera.position.lerp(safe, 0.35);
    }
    if (this.dust) this.dust.rotation.y += delta * 0.01;

    if (this.routePackets.length > 0) {
      const curve = this.routeCurves[this.routeCurves.length - 1];
      this.routePackets.forEach((packet) => {
        const t = (this.elapsed * 0.28 + packet.userData.offset) % 1;
        packet.position.copy(curve.getPointAt(t));
        packet.material.opacity = 0.35 + 0.6 * Math.sin(Math.PI * t); // fade in and out at the ends
      });
    }

    this.renderer.render(this.scene, this.camera);
  }
}

/** Does the segment a-b pass through the sphere? */
function segmentHitsSphere(a, b, center, radius) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(center.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceToSquared(center) < radius * radius;
}
