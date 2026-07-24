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

  const loop = () => {
    requestAnimationFrame(loop);
    resize();
    if (spin && model) model.rotation.y += 0.004;
    controls.update();
    renderer.render(scene, camera);
  };
  loop();
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
