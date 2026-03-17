import * as THREE from "three";
import { getBody, getMouseBall } from "./getBodies.js";
import RAPIER from 'rapier';
import { UltraHDRLoader } from 'jsm/loaders/UltraHDRLoader.js';
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import getLayer from "./getLayer.js";
const w = window.innerWidth;
const h = window.innerHeight;
const isMobile = w <= 768;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 5;
if (isMobile) {
  camera.position.y = 0.5;
}
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
renderer.setSize(w, h);
if (isMobile) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
}
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const canvas = renderer.domElement;
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.zIndex = '0';
canvas.style.opacity = '0';
canvas.style.transition = 'opacity 1s ease-in';
document.body.appendChild(canvas);

const ctrls = new OrbitControls(camera, renderer.domElement);
ctrls.enableDamping = true;
ctrls.enableZoom = false;
ctrls.enablePan = false;
if (isMobile) {
  ctrls.enableRotate = false;
}

const hdrPromise = new Promise((resolve) => {
  const hdrLoader = new UltraHDRLoader();
  hdrLoader.load('envs/san_giuseppe_bridge_2k.jpg', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
    scene.environmentIntensity = 3.0;
    resolve();
  }, undefined, (err) => {
    console.warn('HDR load failed, using fallback environment', err);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const fallbackRT = pmremGenerator.fromScene(new THREE.Scene());
    scene.environment = fallbackRT.texture;
    scene.environmentIntensity = 2.0;
    pmremGenerator.dispose();
    resolve();
  });
});

const [_] = await Promise.all([hdrPromise, RAPIER.init()]);
const gravity = { x: 0.0, y: 0, z: 0.0 };
const world = new RAPIER.World(gravity);

const numBodies = isMobile ? 30 : 54;
const bodies = [];
for (let i = 0; i < numBodies; i++) {
  const body = getBody(RAPIER, world);
  bodies.push(body);
  scene.add(body.mesh);
}

requestAnimationFrame(() => { canvas.style.opacity = '1'; });

const mouseBall = getMouseBall(RAPIER, world);
scene.add(mouseBall.mesh);

const hemiLight = new THREE.HemisphereLight(0x00bbff, 0xaa00ff);
hemiLight.intensity = 0.5;
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);


const raycaster = new THREE.Raycaster();
const pointerPos = new THREE.Vector2(0, 0);
const mousePos = new THREE.Vector3(0, 0, 0);

const mousePlaneGeo = new THREE.PlaneGeometry(48, 48, 48, 48);
const mousePlaneMat = new THREE.MeshBasicMaterial({
  wireframe: true,
  color: 0x00ff00,
  transparent: true,
  opacity: 0.0
});
const mousePlane = new THREE.Mesh(mousePlaneGeo, mousePlaneMat);
mousePlane.position.set(0, 0, 0.2);
scene.add(mousePlane);

window.addEventListener('mousemove', (evt) => {
  pointerPos.set(
    (evt.clientX / window.innerWidth) * 2 - 1,
    -(evt.clientY / window.innerHeight) * 2 + 1
  );
});

let isTouching = false;
const offScreenPos = new THREE.Vector2(9, 9);

canvas.addEventListener('touchstart', (evt) => {
  isTouching = true;
  evt.preventDefault();
  const touch = evt.touches[0];
  pointerPos.set(
    (touch.clientX / window.innerWidth) * 2 - 1,
    -(touch.clientY / window.innerHeight) * 2 + 1
  );
}, { passive: false });

canvas.addEventListener('touchmove', (evt) => {
  if (!isTouching) return;
  evt.preventDefault();
  const touch = evt.touches[0];
  pointerPos.set(
    (touch.clientX / window.innerWidth) * 2 - 1,
    -(touch.clientY / window.innerHeight) * 2 + 1
  );
}, { passive: false });

canvas.addEventListener('touchend', () => {
  isTouching = false;
  pointerPos.copy(offScreenPos);
}, { passive: true });

canvas.addEventListener('touchcancel', () => {
  isTouching = false;
  pointerPos.copy(offScreenPos);
}, { passive: true });

const gyroForce = { x: 0, y: 0 };
if (isMobile) {
  const gyroStrength = 0.008;
  const damping = 0.9;
  function handleMotion(evt) {
    const rate = evt.rotationRate;
    if (!rate) return;
    const alpha = rate.alpha || 0;
    const beta = rate.beta || 0;
    const gamma = rate.gamma || 0;
    gyroForce.x = gyroForce.x * damping + (gamma * gyroStrength);
    gyroForce.y = gyroForce.y * damping + (-beta * gyroStrength);
  }
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    document.addEventListener('touchstart', function requestMotion() {
      DeviceMotionEvent.requestPermission().then(state => {
        if (state === 'granted') {
          window.addEventListener('devicemotion', handleMotion, true);
        }
      }).catch(() => {});
      document.removeEventListener('touchstart', requestMotion);
    }, { once: true });
  } else {
    window.addEventListener('devicemotion', handleMotion, true);
  }
}

let cameraDirection = new THREE.Vector3();
function handleRaycast() {
  camera.getWorldDirection(cameraDirection);
  cameraDirection.multiplyScalar(-1);
  mousePlane.lookAt(cameraDirection);

  raycaster.setFromCamera(pointerPos, camera);
  const intersects = raycaster.intersectObjects(
    [mousePlane],
    false
  );
  if (intersects.length > 0) {
    mousePos.copy(intersects[0].point);
  }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  world.step();
  handleRaycast();
  mouseBall.update(mousePos);
  ctrls.update();
  bodies.forEach(b => b.update(dt, gyroForce));
  renderer.render(scene, camera);
}

animate();

function handleWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);

window.isShapeAtScreenPoint = function() { return false; };
