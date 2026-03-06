import * as THREE from "three";
import { RoundedBoxGeometry } from "jsm/geometries/RoundedBoxGeometry.js";
const isMobile = window.innerWidth <= 768;
const sceneMiddle = new THREE.Vector3(0, isMobile ? 0.5 : 0, 0);
const colorPallete = [0x0067b1, 0x4e99ce, 0x9bcbeb, 0x55d7e2, 0xffffff, 0x9ca9b2, 0x4e6676, 0xf69230, 0xf5d81f];

function createPlusGeometry() {
  const shape = new THREE.Shape();
  const t = 0.15;
  const a = 0.5;
  shape.moveTo(-t, -a);
  shape.lineTo(t, -a);
  shape.lineTo(t, -t);
  shape.lineTo(a, -t);
  shape.lineTo(a, t);
  shape.lineTo(t, t);
  shape.lineTo(t, a);
  shape.lineTo(-t, a);
  shape.lineTo(-t, t);
  shape.lineTo(-a, t);
  shape.lineTo(-a, -t);
  shape.lineTo(-t, -t);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
}

const geometries = isMobile ? [
  new THREE.SphereGeometry(0.65, 16, 16),
  new RoundedBoxGeometry(1.0, 1.0, 1.0, 2, 0.1),
  new THREE.TorusGeometry(0.65, 0.3, 12, 32),
  new THREE.TorusKnotGeometry(0.65, 0.25, 48, 12),
  new THREE.TetrahedronGeometry(1.0, 0),
  createPlusGeometry(),
] : [
  new THREE.SphereGeometry(0.65, 32, 32),
  new RoundedBoxGeometry(1.0, 1.0, 1.0, 2, 0.1),
  new THREE.TorusGeometry(0.65, 0.3, 16, 64),
  new THREE.TorusKnotGeometry(0.65, 0.25, 128, 32),
  new THREE.TetrahedronGeometry(1.0, 0),
  createPlusGeometry(),
];
function getGeometry(size) {
  const randomGeo = geometries[Math.floor(Math.random() * geometries.length)];
  const geo = randomGeo.clone();
  geo.scale(size, size, size);
  return geo;
}
    
function getBody(RAPIER, world) {
  const size = isMobile ? 0.7 : 0.62;
  const range = isMobile ? 6 : 12;
  const density = size * 1.0;
  let x = Math.random() * range - range * 0.5;
  let y = Math.random() * range - range * 0.5 + (isMobile ? 2 : 3);
  let z = Math.random() * range - range * 0.5;
  
  let color = colorPallete[Math.floor(Math.random() * colorPallete.length)];
  const geometry = getGeometry(size);
  const prob = Math.random();
  const options = prob < 0.33 ? {
    color,
    metalness: 1,
    roughness: 0.1,
  } : prob < 0.66 ? {
    roughness: 0.1,
    transmission: 1.0,
    transparent: true,
    thickness: 3.0,
  } : {
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    metalness: 0.0,
    roughness: 0.5,
  };
  const material = new THREE.MeshPhysicalMaterial(options);
  const mesh = new THREE.Mesh(geometry, material);

  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setAngularDamping(2.0)
    .setLinearDamping(0.5);
  let rigid = world.createRigidBody(rigidBodyDesc);
  let points = geometry.attributes.position.array;
  let colliderDesc = RAPIER.ColliderDesc.convexHull(points).setDensity(density);
  world.createCollider(colliderDesc, rigid);

  function update(dt, gyro) {
    rigid.resetForces(true);
    let { x, y, z } = rigid.translation();
    let pos = new THREE.Vector3(x, y, z);
    let dist = pos.distanceTo(sceneMiddle);
    let dir = pos.clone().sub(sceneMiddle).normalize();
    let q = rigid.rotation();
    let rote = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    mesh.rotation.setFromQuaternion(rote);
    const gatherRadius = isMobile ? 2.0 : 3.0;
    const strength = dist > gatherRadius ? 0.5 : 0.5 * (dist / gatherRadius);
    rigid.addForce(dir.multiplyScalar(-strength), true);
    if (gyro && (gyro.x !== 0 || gyro.y !== 0)) {
      rigid.addForce({ x: gyro.x, y: gyro.y, z: 0 }, true);
    }
    mesh.position.set(x, y, z);
  }
  return { mesh, rigid, update };
}

function getMouseBall(RAPIER, world) {
  const mouseSize = 0.25;
  const geometry = new THREE.IcosahedronGeometry(mouseSize, 8);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
  });
  const mouseMesh = new THREE.Mesh(geometry, material);
  let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0)
  let mouseRigid = world.createRigidBody(bodyDesc);
  let dynamicCollider = RAPIER.ColliderDesc.ball(mouseSize * 3.0);
  world.createCollider(dynamicCollider, mouseRigid);
  function update(mousePos) {
    mouseRigid.setTranslation({ x: mousePos.x, y: mousePos.y, z: mousePos.z });
    let { x, y, z } = mouseRigid.translation();
    mouseMesh.position.set(x, y, z);
  }
  return { mesh: mouseMesh, update };
}

export { getBody, getMouseBall };
