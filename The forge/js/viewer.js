// ============ THE FORGE — 3D viewer ============
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let renderer, scene, camera, controls, model = null;
let explodeT = 0, spin = false, mode = "solid";
let basePositions = new Map();

export function initViewer(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1014);
  scene.fog = new THREE.Fog(0x0e1014, 1600, 4200);

  camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
  camera.position.set(190, 210, 260);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 20, 0);

  // lighting — soft studio
  scene.add(new THREE.HemisphereLight(0x9fb2cc, 0x262524, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 4.2);
  key.position.set(220, 340, 180);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff8a3a, 0.7);
  rim.position.set(-260, 120, -220);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9db8ff, 1.3);
  fill.position.set(-120, 200, 260);
  scene.add(fill);

  // ground
  const grid = new THREE.GridHelper(1200, 60, 0x2a2f38, 0x1a1e25);
  grid.position.y = -0.2;
  scene.add(grid);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(600, 64),
    new THREE.MeshStandardMaterial({ color: 0x121419, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  scene.add(ground);

  // visual selection: click a component to inspect it
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener("pointerdown", e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; // drag = orbit
    if (!model || !pickCb) return;
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObject(model, true);
    const hit = hits.find(h => h.object.isMesh);
    highlight(hit?.object || null);
    pickCb(hit ? { name: hit.object.userData.partName || "part", object: hit.object, point: hit.point } : null);
  });

  const loop = () => {
    requestAnimationFrame(loop);
    resize();
    if (spin && model) model.rotation.y += 0.004;
    controls.update();
    renderer.render(scene, camera);
  };
  loop();
}

let pickCb = null, highlighted = null;
export function onPick(cb) { pickCb = cb; }
function highlight(mesh) {
  if (highlighted?.material?.emissive) highlighted.material.emissive.setHex(highlighted.userData._emis || 0);
  highlighted = null;
  if (mesh?.material?.emissive) {
    mesh.userData._emis = mesh.material.emissive.getHex();
    mesh.material.emissive.setHex(0xff7a1a);
    mesh.material.emissiveIntensity = 0.25;
    highlighted = mesh;
  }
}

function resize() {
  const c = renderer.domElement;
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.floor(w * renderer.getPixelRatio()) || c.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

/* ---------------------------------------------------------------
   Tap-reachable equivalents for every OrbitControls gesture.

   OrbitControls out of the box is orbit = drag, zoom = wheel or PINCH, pan =
   right-drag or TWO-FINGER drag. That makes inspecting the generated model —
   the whole point of this app — impossible with one finger, a switch, a dwell
   pointer or a keyboard. The mouse gestures still work; they just stop being
   the only way.
   --------------------------------------------------------------- */

/* Orbit in fixed steps. Discrete beats analogue here: repeatable, reachable
   from any input, and costs no sustained precision. */
export function orbitStep(yawDeg, pitchDeg) {
  if (!controls) return;
  const off = camera.position.clone().sub(controls.target);
  const sph = new THREE.Spherical().setFromVector3(off);
  sph.theta -= (yawDeg || 0) * Math.PI / 180;
  sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - (pitchDeg || 0) * Math.PI / 180));
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
  camera.lookAt(controls.target);
  controls.update();
}

/* Replaces wheel and pinch. */
export function zoomStep(factor) {
  if (!controls) return;
  const off = camera.position.clone().sub(controls.target);
  const len = Math.max(20, Math.min(3000, off.length() * (factor || 1)));
  camera.position.copy(controls.target).add(off.setLength(len));
  controls.update();
}

/* Replaces right-drag and two-finger drag. */
export function panStep(dx, dy) {
  if (!controls) return;
  const dist = camera.position.distanceTo(controls.target);
  const step = dist * 0.08;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
  const move = right.multiplyScalar(dx * step).add(up.multiplyScalar(dy * step));
  camera.position.add(move);
  controls.target.add(move);
  controls.update();
}

/* Named views — one tap lands exactly on a standard orientation, which is
   more precise than anyone can drag to anyway. */
const VIEWS = {
  front: [0, 0], back: [180, 0], left: [-90, 0], right: [90, 0],
  top: [0, 89], iso: [35, 25]
};
export function setView(name) {
  if (!controls || !VIEWS[name]) return;
  const [yaw, pitch] = VIEWS[name];
  const dist = camera.position.distanceTo(controls.target);
  const sph = new THREE.Spherical(dist, (90 - pitch) * Math.PI / 180, yaw * Math.PI / 180);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
  camera.lookAt(controls.target);
  controls.update();
}
export function viewNames() { return Object.keys(VIEWS); }

/* Diagnostics: lets a test assert the camera actually moved, rather than only
   that a button exists. */
export function cameraState() {
  if (!camera || !controls) return null;
  const p = camera.position, t = controls.target;
  return {
    pos: [Math.round(p.x), Math.round(p.y), Math.round(p.z)],
    target: [Math.round(t.x), Math.round(t.y), Math.round(t.z)],
    dist: Math.round(p.distanceTo(t))
  };
}

export function setModel(group, { fit = true } = {}) {
  if (model) { scene.remove(model); disposeDeep(model); }
  model = group;
  model.rotation.y = 0;
  scene.add(model);
  basePositions = new Map();
  model.traverse(o => {
    if (o.userData.explode) basePositions.set(o, o.position.clone());
  });
  applyExplode(explodeT);
  applyMode(mode);
  if (fit) fitCamera();
}

export function getModel() { return model; }

function fitCamera() {
  if (!model) return;
  const bb = new THREE.Box3();
  const tmp = new THREE.Box3();
  let found = false;
  model.updateWorldMatrix(true, true);
  model.traverse(o => {
    if (o.userData.excludeFromFit) return;
    if (o.isMesh && !ancestorExcluded(o)) {
      tmp.setFromObject(o);
      bb.union(tmp); found = true;
    }
  });
  if (!found) bb.setFromObject(model);
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.18;
  controls.target.copy(center);
  const dir = new THREE.Vector3(0.62, 0.58, 0.78).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.near = Math.max(0.5, dist / 100);
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
}

function ancestorExcluded(o) {
  for (let p = o; p; p = p.parent) if (p.userData.excludeFromFit) return true;
  return false;
}

export function setExplode(t) { explodeT = t; applyExplode(t); }
function applyExplode(t) {
  if (!model) return;
  for (const [obj, base] of basePositions) {
    const e = obj.userData.explode;
    obj.position.set(base.x + e.x * t, base.y + e.y * t, base.z + e.z * t);
  }
}

export function setSpin(on) { spin = on; }
export function isSpin() { return spin; }

export function setMode(m) { mode = m; applyMode(m); }
function applyMode(m) {
  if (!model) return;
  model.traverse(o => {
    if (!o.isMesh) return;
    const mat = o.material;
    if (!mat) return;
    if (!o.userData._solid) o.userData._solid = { opacity: mat.opacity ?? 1, transparent: !!mat.transparent, wireframe: !!mat.wireframe };
    if (m === "solid") {
      mat.wireframe = false; mat.transparent = o.userData._solid.transparent; mat.opacity = o.userData._solid.opacity;
    } else if (m === "xray") {
      mat.wireframe = false; mat.transparent = true; mat.opacity = 0.32; mat.depthWrite = false;
    } else if (m === "wire") {
      mat.wireframe = true; mat.transparent = false; mat.opacity = 1;
    }
    if (m !== "xray") mat.depthWrite = true;
    mat.needsUpdate = true;
  });
}

/** Render current view to a PNG dataURL (for overview render card). */
export function snapshot(w = 1280, h = 720) {
  if (!renderer || !model) return null;
  const oldW = renderer.domElement.width, oldH = renderer.domElement.height;
  const oldAspect = camera.aspect;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  renderer.setSize(oldW, oldH, false);
  camera.aspect = oldAspect; camera.updateProjectionMatrix();
  return url;
}

function disposeDeep(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
    }
  });
}
