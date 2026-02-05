const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl', { antialias: false });

if (!gl) {
  alert('WebGL not supported');
}

// Mobile detection - checks screen width (narrow viewport) or touch capability
function checkIsMobile() {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrowViewport = window.innerWidth < 1024;
  return isNarrowViewport || isTouchDevice;
}
let isMobile = checkIsMobile();

// Apply mobile class to body for CSS-based hiding
function updateMobileClass() {
  if (isMobile) {
    document.body.classList.add('is-mobile');
    document.body.classList.remove('is-desktop');
  } else {
    document.body.classList.add('is-desktop');
    document.body.classList.remove('is-mobile');
  }
}

// Set the appropriate hint animation based on device type
function updateHintAnimation() {
  const mouseHint = document.getElementById('mouseHint');
  if (mouseHint) {
    const animationSrc = isMobile ? 'touch-animation.json' : 'mouse-animation.json';
    if (mouseHint.getAttribute('src') !== animationSrc) {
      mouseHint.load(animationSrc);
    }
  }
}

// Update mobile detection on resize
window.addEventListener('resize', () => {
  isMobile = checkIsMobile();
  updateMobileClass();
  updateHintAnimation();
});

// Initial mobile class and hint animation update when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateMobileClass();
    updateHintAnimation();
  });
} else {
  updateMobileClass();
  updateHintAnimation();
}

// Cache frequently used values
let dpr = window.devicePixelRatio || 1;
let canvasWidth = 0;
let canvasHeight = 0;

// Detect if we're on landing page (index.html) or profile page
const isLandingPage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');

// Cache text element reference
let textEl = null;
let textCenterX = 0;
let textCenterY = 0;

function updateTextCenter() {
  if (!textEl) textEl = document.querySelector('.content-wrapper');
  const rect = textEl ? textEl.getBoundingClientRect() : null;
  textCenterX = rect ? (rect.left + rect.width / 2) * dpr : canvasWidth / 2;
  textCenterY = rect ? (rect.top + rect.height / 2) * dpr : canvasHeight / 2;
}

function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  canvasWidth = window.innerWidth * dpr;
  canvasHeight = window.innerHeight * dpr;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  gl.viewport(0, 0, canvasWidth, canvasHeight);
  updateTextCenter();
}

let prevTextCenterX = 0;
let prevTextCenterY = 0;

function repositionShapesOnResize() {
  const dx = textCenterX - prevTextCenterX;
  const dy = textCenterY - prevTextCenterY;
  
  if (dx !== 0 || dy !== 0) {
    for (const shape of shapes) {
      shape.x += dx;
      shape.baseY += dy;
      shape.y = shape.baseY;
    }
  }
  
  prevTextCenterX = textCenterX;
  prevTextCenterY = textCenterY;
}

window.addEventListener('resize', () => {
  resizeCanvas();
  repositionShapesOnResize();
  if (typeof updateZones === 'function') updateZones();
});
resizeCanvas();
prevTextCenterX = textCenterX;
prevTextCenterY = textCenterY;

const vertexShaderSource = `
  precision mediump float;
  attribute vec2 a_position;
  attribute vec2 a_uv;
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform float u_scale;
  uniform float u_rotation;
  uniform float u_size;
  
  varying vec2 v_uv;
  
  void main() {
    float cosR = cos(u_rotation);
    float sinR = sin(u_rotation);
    vec2 rotatedPos = vec2(
      a_position.x * cosR - a_position.y * sinR,
      a_position.x * sinR + a_position.y * cosR
    );
    vec2 position = (rotatedPos * u_scale * u_size) + u_translation;
    vec2 zeroToOne = position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_uv = a_uv;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_color;
  uniform vec4 u_color2;
  uniform float u_shapeType;
  uniform float u_cornerRadius;
  uniform float u_size;
  
  varying vec2 v_uv;
  
  #define PI 3.14159265359
  
  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  
  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }
  
  float sdRoundedTriangle(vec2 p, float r, float rnd) {
    const float k = sqrt(3.0);
    p.y = -p.y;
    p.x = abs(p.x) - r;
    p.y = p.y + r / k + rnd / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    float d = -length(p) * sign(p.y);
    return d - rnd;
  }
  
  float sdStar(vec2 p, float r, float n, float m) {
    float an = PI / n;
    float en = PI / m;
    vec2 acs = vec2(cos(an), sin(an));
    vec2 ecs = vec2(cos(en), sin(en));
    float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
    p = length(p) * vec2(cos(bn), abs(sin(bn)));
    p -= r * acs;
    p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
    return length(p) * sign(p.x);
  }
  
  float sdDiamond(vec2 p, vec2 b) {
    p = abs(p);
    float h = clamp((-2.0 * dot(p, b) + dot(b, b)) / dot(b, b), -1.0, 1.0);
    float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
    return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
  }
  
  float sdPolygon(vec2 p, float r, float n) {
    float an = PI / n;
    vec2 acs = vec2(cos(an), sin(an));
    float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
    p = length(p) * vec2(cos(bn), abs(sin(bn)));
    p -= r * acs;
    p.y += clamp(-p.y, 0.0, r * acs.y);
    return length(p) * sign(p.x);
  }
  
  float sdPlus(vec2 p, vec2 b, float r) {
    p = abs(p);
    if (p.y > p.x) p = p.yx;
    vec2 q = p - b;
    float k = max(q.y, q.x);
    vec2 w = k > 0.0 ? q : vec2(b.y - p.x, -k);
    return sign(k) * length(max(w, 0.0)) - r;
  }
  
  void main() {
    vec2 uv = v_uv;
    float dist;
    float radius = u_cornerRadius / u_size;
    int shape = int(u_shapeType);
    
    if (shape == 0) {
      dist = sdRoundedBox(uv, vec2(0.42, 0.30), radius);
    } else if (shape == 1) {
      dist = sdRoundedBox(uv, vec2(0.35, 0.35), radius);
    } else if (shape == 2) {
      dist = sdCircle(uv, 0.40);
    } else if (shape == 3) {
      dist = sdRoundedTriangle(uv, 0.30, radius);
    } else if (shape == 4) {
      dist = sdStar(uv, 0.28, 5.0, 2.5) - radius;
    } else if (shape == 5) {
      dist = sdPolygon(uv, 0.38, 7.0) - 0.02;
    } else if (shape == 6) {
      dist = sdStar(uv, 0.38, 12.0, 1.8) - radius;
    } else {
      dist = sdPlus(uv, vec2(0.38, 0.08), radius);
    }
    
    float alpha = 1.0 - smoothstep(0.0, 0.002, dist);
    if (alpha < 0.01) discard;
    
    float gradientT = uv.y + 0.5;
    gradientT = clamp(gradientT, 0.0, 1.0);
    vec3 gradientColor = mix(u_color2.rgb, u_color.rgb, gradientT);
    
    gl_FragColor = vec4(gradientColor, u_color.a * alpha);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);


const positionLocation = gl.getAttribLocation(program, 'a_position');
const uvLocation = gl.getAttribLocation(program, 'a_uv');
const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
const translationLocation = gl.getUniformLocation(program, 'u_translation');
const scaleLocation = gl.getUniformLocation(program, 'u_scale');
const rotationLocation = gl.getUniformLocation(program, 'u_rotation');
const sizeLocation = gl.getUniformLocation(program, 'u_size');
const colorLocation = gl.getUniformLocation(program, 'u_color');
const color2Location = gl.getUniformLocation(program, 'u_color2');
const shapeTypeLocation = gl.getUniformLocation(program, 'u_shapeType');
const cornerRadiusLocation = gl.getUniformLocation(program, 'u_cornerRadius');

const quadBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
const quadVertices = new Float32Array([
  -0.5, -0.5,  -0.5, -0.5,
   0.5, -0.5,   0.5, -0.5,
  -0.5,  0.5,  -0.5,  0.5,
  -0.5,  0.5,  -0.5,  0.5,
   0.5, -0.5,   0.5, -0.5,
   0.5,  0.5,   0.5,  0.5
]);
gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

const shapes = [];
const fragments = [];
const MAX_SHAPES = 8;

const shadowColor = [0.0, 0.0, 0.0, 0.25];
const shadowColorTemp = [0.0, 0.0, 0.0, 0.25];
const colorTemp = [0, 0, 0, 1];

const colors = [
  { start: [0.95, 0.64, 0.27, 1.0], end: [0.88, 0.47, 0.00, 1.0] },  // orange: #F2A246 to #E17800
  { start: [0.79, 0.27, 0.95, 1.0], end: [0.65, 0.22, 0.78, 1.0] },  // purple: #CA46F2 to #A537C6
  { start: [0.95, 0.27, 0.28, 1.0], end: [0.75, 0.08, 0.09, 1.0] },  // red: #F24647 to #BF1516
  { start: [0.27, 0.95, 0.71, 1.0], end: [0.05, 0.74, 0.50, 1.0] },  // green: #46F2B6 to #0CBD80
  { start: [0.27, 0.62, 0.95, 1.0], end: [0.10, 0.47, 0.83, 1.0] },  // blue: #469FF2 to #1979D3
  { start: [0.95, 0.27, 0.61, 1.0], end: [0.83, 0.09, 0.46, 1.0] },  // pink: #F2469C to #D31775
  { start: [0.35, 0.95, 0.27, 1.0], end: [0.20, 0.82, 0.12, 1.0] },  // green: #5AF246 to #33D11E
  { start: [0.18, 0.42, 0.88, 1.0], end: [0.09, 0.33, 0.80, 1.0] },  // dark blue: #2F6CE1 to #1855CC
  { start: [0.95, 0.93, 0.27, 1.0], end: [0.79, 0.76, 0.07, 1.0] },  // yellow: #F2EC46 to #C9C211
  { start: [0.27, 0.91, 0.95, 1.0], end: [0.22, 0.80, 0.85, 1.0] },  // teal: #46E7F2 to #38CDD8
];

let lastColorIndex = -1;
let lastShapeIndex = -1;

function getNextColor() {
  lastColorIndex = (lastColorIndex + 1) % colors.length;
  return colors[lastColorIndex];
}

function getNextShapeType() {
  lastShapeIndex = (lastShapeIndex + 1) % 8;
  return lastShapeIndex;
}

function createFragments(shape) {
  const numFragments = 6 + Math.floor(Math.random() * 4);
  const dpr = window.devicePixelRatio || 1;
  
  for (let i = 0; i < numFragments; i++) {
    const angle = (i / numFragments) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = (1 + Math.random() * 1.5) * dpr;
    const fragmentSize = shape.size * (0.15 + Math.random() * 0.2);
    
    fragments.push({
      x: shape.x + (Math.random() - 0.5) * shape.size * 0.3,
      y: shape.y + (Math.random() - 0.5) * shape.size * 0.3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: fragmentSize,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.08,
      color: [...shape.color],
      color2: [...shape.color2],
      shapeType: shape.shapeType,
      opacity: 1,
      life: 1,
      decay: 0.02 + Math.random() * 0.01,
      gravity: 0.1 * dpr
    });
  }
}

function getClickedShape(clickX, clickY) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (shape.popping) continue;
    
    const dx = clickX - shape.x;
    const dy = clickY - shape.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = shape.size * shape.scale * 0.45;
    
    if (dist < hitRadius) {
      return shape;
    }
  }
  return null;
}

function pushShape(shape, fromX, fromY) {
  const dx = shape.x - fromX;
  const dy = shape.y - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  
  const randomAngle = (Math.random() - 0.5) * Math.PI * 0.5;
  const baseAngle = Math.atan2(dy, dx);
  const pushAngle = baseAngle + randomAngle;
  
  const basePush = isMobile ? 2.0 : 0.8;
  const pushStrength = (basePush + Math.random() * 0.5) * dpr;
  
  shape.vx += Math.cos(pushAngle) * pushStrength;
  shape.vy += Math.sin(pushAngle) * pushStrength;
  
  const maxSpeed = isMobile ? 1.0 * dpr : 0.42 * dpr;
  const speed = Math.sqrt(shape.vx * shape.vx + shape.vy * shape.vy);
  if (speed > maxSpeed) {
    shape.vx = (shape.vx / speed) * maxSpeed;
    shape.vy = (shape.vy / speed) * maxSpeed;
  }
  
  shape.rotationSpeed += (Math.random() - 0.5) * 0.003;
  shape.ignoreGravity = true;
}

document.addEventListener('click', (e) => {
  const dpr = window.devicePixelRatio || 1;
  const clickX = e.clientX * dpr;
  const clickY = e.clientY * dpr;
  
  const clickedShape = getClickedShape(clickX, clickY);
  if (clickedShape) {
    e.preventDefault();
    e.stopPropagation();
    pushShape(clickedShape, clickX, clickY);
    return;
  }
  
  if (e.target.closest('a, button, .project-link, header')) {
    return;
  }
  
  const activeShapes = shapes.filter(s => !s.popping).length;
  
  if (activeShapes >= MAX_SHAPES) {
    const oldest = shapes.find(s => !s.popping);
    if (oldest) {
      oldest.popping = true;
      oldest.popStart = performance.now();
    }
  }
  
  createShapeAt(clickX, clickY);
});

function createShapeAt(x, y, isAutoSpawned = false) {
  const dpr = window.devicePixelRatio || 1;
  
  // Hide mouse hint with quick fade when creating a shape
  const mouseHint = document.getElementById('mouseHint');
  if (mouseHint && !isAutoSpawned) {
    mouseHint.style.transition = 'opacity 0.15s ease-out';
    mouseHint.style.opacity = '0';
  }
  
  let angle, speed;
  if (isLandingPage) {
    if (isAutoSpawned) {
      // Auto-spawned shapes stay in place
      angle = 0;
      speed = 0;
    } else {
      // Click-created shapes drift in random direction
      angle = Math.random() * Math.PI * 2;
      speed = (0.5 + Math.random() * 0.5) * dpr;
    }
  } else {
    // On profile page, shapes drift upward
    angle = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 1.6;
    speed = (0.1 + Math.random() * 0.14) * dpr;
  }
  
  const shapeType = getNextShapeType();
  const color = getNextColor();
  const rotation = Math.random() * Math.PI * 2;
  const rotationSpeed = (Math.random() - 0.5) * 0.003;
  
  const baseSize = isMobile ? (72 + Math.random() * 24) : (120 + Math.random() * 40);
  const size = baseSize * dpr;
  
  const wavePhase = Math.random() * Math.PI * 2;
  const waveSpeed = 0.01 + Math.random() * 0.01;
  const waveAmplitude = (1.5 + Math.random() * 2) * dpr;
  
  const surfaceDistance = (80 + Math.random() * 60) * dpr;

  shapes.push({
    x,
    y,
    baseY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    shapeType,
    color: color.start,
    color2: color.end,
    rotation,
    rotationSpeed,
    scale: 0,
    size,
    wavePhase,
    waveSpeed,
    waveAmplitude,
    time: 0,
    spawnTime: performance.now(),
    spawnDuration: 600,
    spawnOpacity: 1,
    shadowScale: 0,
    hasBeenClicked: false,
    isAutoSpawned: isAutoSpawned,
    ignoreGravity: false
  });
}

// Quickly spawn initial shapes on page load around the text
function spawnInitialShapes() {
  const dpr = window.devicePixelRatio || 1;
  
  // Get the text element position
  const textEl = document.querySelector('.content-wrapper');
  const rect = textEl ? textEl.getBoundingClientRect() : null;
  const textCenterX = rect ? (rect.left + rect.width / 2) * dpr : canvas.width / 2;
  const textCenterY = rect ? (rect.top + rect.height / 2) * dpr : canvas.height / 2;
  
  // Positions within 720x400 inner zone but outside 400x96 clear zone
  // Zone center is offset 64px up from text center to match CSS translateY(-64px)
  const gravityOffsetY = 64;
  const positions = [
    { x: -300, y: -60 },   // far left upper
    { x: -160, y: -100 },  // upper left
    { x: 0, y: -120 },     // upper center
    { x: 160, y: -100 },   // upper right
    { x: 300, y: -60 },    // far right upper
    { x: -300, y: 60 },    // far left lower
    { x: -160, y: 100 },   // lower left
    { x: 0, y: 120 },      // lower center
    { x: 160, y: 100 },    // lower right
  ];
  
  const initialCount = isLandingPage ? 9 : 6;
  
  // Create array of indices and shuffle them for random spawn order
  const indices = Array.from({ length: initialCount }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  let cumulativeDelay = 0;
  for (let i = 0; i < initialCount; i++) {
    const delay = cumulativeDelay;
    cumulativeDelay += 200 + Math.random() * 900;
    setTimeout(() => {
      const pos = positions[indices[i]];
      const x = textCenterX + pos.x * dpr;
      const y = (textCenterY - gravityOffsetY * dpr) + pos.y * dpr;
      createShapeAt(x, y, true);
    }, delay);
  }
}

// Spawn initial shapes with delay to let text animation complete
setTimeout(spawnInitialShapes, 1300);

// Auto-spawn shapes when fewer than 5 are active
setInterval(() => {
  if (!isLandingPage) return;
  
  const activeShapes = shapes.filter(s => !s.popping).length;
  if (activeShapes < 5) {
    const dpr = window.devicePixelRatio || 1;
    const textEl = document.querySelector('.content-wrapper');
    const rect = textEl ? textEl.getBoundingClientRect() : null;
    const textCenterX = rect ? (rect.left + rect.width / 2) * dpr : canvas.width / 2;
    const textCenterY = rect ? (rect.top + rect.height / 2) * dpr : canvas.height / 2;
    
    const minDistance = 100 * dpr;
    const maxDistance = 200 * dpr;
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    const x = textCenterX + Math.cos(angle) * distance;
    const y = textCenterY + Math.sin(angle) * distance;
    createShapeAt(x, y, true);
  }
}, 2000);

function isOutOfBounds(shape) {
  const margin = 150 * dpr;
  return (
    shape.x < -margin ||
    shape.x > canvasWidth + margin ||
    shape.y < -margin ||
    shape.y > canvasHeight + margin
  );
}

function handleCollisions() {
  const len = shapes.length;
  for (let i = 0; i < len; i++) {
    const a = shapes[i];
    const radiusA = a.size * a.scale * 0.45;
    for (let j = i + 1; j < len; j++) {
      const b = shapes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      const radiusB = b.size * b.scale * 0.45;
      const minDist = radiusA + radiusB;
      
      if (distSq < minDist * minDist && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const pushStrength = overlap * 0.6;
        
        a.x -= nx * pushStrength;
        a.baseY -= ny * pushStrength;
        b.x += nx * pushStrength;
        b.baseY += ny * pushStrength;
        
        a.vx -= nx * 0.005;
        a.vy -= ny * 0.005;
        b.vx += nx * 0.005;
        b.vy += ny * 0.005;
        
        // If either shape ignores gravity, both should after collision
        if (a.ignoreGravity || b.ignoreGravity) {
          a.ignoreGravity = true;
          b.ignoreGravity = true;
        }
      }
    }
  }
}

// Pre-calculated corner radius
let cornerRadius = 12.0;

function drawShape(shape, offsetX, offsetY, color, color2) {
  gl.uniform2f(translationLocation, shape.x + offsetX, shape.y + offsetY);
  gl.uniform1f(scaleLocation, shape.scale);
  gl.uniform1f(rotationLocation, shape.rotation);
  gl.uniform1f(sizeLocation, shape.size);
  gl.uniform4fv(colorLocation, color);
  gl.uniform4fv(color2Location, color2 || color);
  gl.uniform1f(shapeTypeLocation, shape.shapeType);
  gl.uniform1f(cornerRadiusLocation, cornerRadius);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// Rectangular zone dimensions (half-widths and half-heights for easier math)
let clearZoneHalfW = 200;
let clearZoneHalfH = 48;
let innerZoneHalfW = 360;
let innerZoneHalfH = 200;
let outwardDriftSpeed = 0.175;
let inwardDriftSpeed = 0.05;
let pushStrengthDrift = 0.15;

function updateZones() {
  clearZoneHalfW = 200 * dpr;
  clearZoneHalfH = 48 * dpr;
  innerZoneHalfW = 360 * dpr;
  innerZoneHalfH = 200 * dpr;
  cornerRadius = 12.0 * dpr;
  const driftMultiplier = isMobile ? 2.5 : 1.0;
  outwardDriftSpeed = 0.175 * dpr * 0.02 * driftMultiplier;
  inwardDriftSpeed = 0.05 * dpr * 0.02 * driftMultiplier;
  pushStrengthDrift = 0.15 * dpr * 0.05 * driftMultiplier;
}
updateZones();
window.addEventListener('resize', updateZones);

function isInClearZone(dx, dy) {
  return Math.abs(dx) < clearZoneHalfW && Math.abs(dy) < clearZoneHalfH;
}

function isInInnerZone(dx, dy) {
  return Math.abs(dx) < innerZoneHalfW && Math.abs(dy) < innerZoneHalfH;
}

function render() {
  try {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(program);
  gl.uniform2f(resolutionLocation, canvasWidth, canvasHeight);
  
  // Setup vertex attributes once per frame
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

  handleCollisions();
  
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];

    // On landing page, apply drift behavior
    // Gravity zones are offset 64px up from text center to match CSS translateY
    const gravityOffsetY = 64 * dpr;
    if (isLandingPage && !shape.popping) {
      const dx = shape.x - textCenterX;
      const dy = shape.baseY - (textCenterY - gravityOffsetY);
      const inClear = isInClearZone(dx, dy);
      const inInner = isInInnerZone(dx, dy);
      
      // Account for shape size in clear zone check
      const shapeRadius = shape.size * shape.scale * 0.5;
      const wavePadding = shape.waveAmplitude + 8 * dpr;
      const effectiveRadiusX = shapeRadius;
      const effectiveRadiusY = shapeRadius + wavePadding;
      const inClearExpanded = Math.abs(dx) < (clearZoneHalfW + effectiveRadiusX) && Math.abs(dy) < (clearZoneHalfH + effectiveRadiusY);
      
      if (inClear || inClearExpanded) {
        // Inside or near clear zone: ALWAYS drift outward (ignores ignoreGravity)
        const angle = Math.atan2(dy, dx);
        const pushForce = inClear ? pushStrengthDrift * 2 : pushStrengthDrift;
        shape.vx += Math.cos(angle) * pushForce;
        shape.vy += Math.sin(angle) * pushForce;
      } else if (inInner && !shape.ignoreGravity) {
        // Inside inner zone but outside clear: drift toward text but stop at clear zone boundary
        // Use expanded clear zone boundary that accounts for shape size
        const distToClearX = Math.abs(dx) - (clearZoneHalfW + effectiveRadiusX);
        const distToClearY = Math.abs(dy) - (clearZoneHalfH + effectiveRadiusY);
        
        // Only drift inward if not too close to expanded clear zone boundary
        if (distToClearX > 30 * dpr || distToClearY > 30 * dpr) {
          const angle = Math.atan2(-dy, -dx);
          shape.vx += Math.cos(angle) * inwardDriftSpeed;
          shape.vy += Math.sin(angle) * inwardDriftSpeed;
        } else {
          // Near boundary: reduce velocity to settle
          shape.vx *= 0.92;
          shape.vy *= 0.92;
        }
      } else if (!shape.ignoreGravity) {
        // Outside inner zone: drift outward toward viewport edge
        const angle = Math.atan2(dy, dx);
        shape.vx += Math.cos(angle) * outwardDriftSpeed;
        shape.vy += Math.sin(angle) * outwardDriftSpeed;
      }
      
      // Apply friction to smooth movement
      shape.vx *= 0.98;
      shape.vy *= 0.98;
    }

    shape.x += shape.vx;
    shape.baseY += shape.vy;
    
    // Hard boundary enforcement: prevent shapes from entering clear zone
    // Account for shape radius and wave amplitude to keep entire shape outside
    if (isLandingPage && !shape.popping) {
      const gravityOffsetY = 64 * dpr;
      const dx = shape.x - textCenterX;
      const dy = shape.baseY - (textCenterY - gravityOffsetY);
      
      // Shape's visual radius including wave amplitude padding
      const shapeRadius = shape.size * shape.scale * 0.5;
      const wavePadding = shape.waveAmplitude + 8 * dpr; // extra padding for Y-axis drift wobble
      const effectiveRadiusX = shapeRadius;
      const effectiveRadiusY = shapeRadius + wavePadding;
      
      // Expanded clear zone that accounts for shape size
      const expandedClearW = clearZoneHalfW + effectiveRadiusX;
      const expandedClearH = clearZoneHalfH + effectiveRadiusY;
      
      // Check if shape (including its radius) is inside clear zone
      if (Math.abs(dx) < expandedClearW && Math.abs(dy) < expandedClearH) {
        // Gently drift shape out of clear zone instead of snapping
        const overlapX = expandedClearW - Math.abs(dx);
        const overlapY = expandedClearH - Math.abs(dy);
        
        // Apply gentle drift velocity toward nearest edge (reduced speed)
        const clearZoneDriftSpeed = outwardDriftSpeed * 0.5;
        if (overlapX < overlapY) {
          // Drift horizontally
          shape.vx += (dx >= 0 ? clearZoneDriftSpeed : -clearZoneDriftSpeed);
        } else {
          // Drift vertically
          shape.vy += (dy >= 0 ? clearZoneDriftSpeed : -clearZoneDriftSpeed);
        }
        // Dampen velocity to prevent acceleration buildup
        shape.vx *= 0.98;
        shape.vy *= 0.98;
      }
    }
    
    shape.time += shape.waveSpeed;
    // Add Y-axis drift wobble as visual offset
    const yDriftWobble = Math.sin(shape.time * 0.8 + shape.wavePhase) * 4 * dpr;
    shape.y = shape.baseY + Math.sin(shape.time + shape.wavePhase) * shape.waveAmplitude + yDriftWobble;
    shape.rotation += shape.rotationSpeed;

    if (shape.popping) {
      const popDuration = 500;
      const elapsed = performance.now() - shape.popStart;
      const t = Math.min(elapsed / popDuration, 1);
      
      // Exact reverse of spawn animation
      if (t < 0.4) {
        // Phase 1: scale from 1.0 to 1.1 (reverse of settle phase)
        const phase1 = t / 0.4;
        const ease1 = phase1 < 0.5 ? 2 * phase1 * phase1 : 1 - Math.pow(-2 * phase1 + 2, 2) / 2;
        shape.scale = 1 + ease1 * 0.1;
        shape.popOpacity = 1;
        shape.shadowScale = 1 + ease1 * 0.1;
      } else {
        // Phase 2: scale from 1.1 to 0, fade out
        const phase2 = (t - 0.4) / 0.6;
        const ease2 = phase2 < 0.5 ? 2 * phase2 * phase2 : 1 - Math.pow(-2 * phase2 + 2, 2) / 2;
        shape.scale = 1.1 - ease2 * 1.1;
        shape.popOpacity = 1 - ease2;
        shape.shadowScale = 1.1 - ease2 * 1.1;
      }
      
      if (t >= 1) {
        shapes.splice(i, 1);
        continue;
      }
    } else if (shape.spawnTime) {
      const elapsed = performance.now() - shape.spawnTime;
      const t = Math.min(elapsed / shape.spawnDuration, 1);
      
      if (t < 0.6) {
        const phase1 = t / 0.6;
        const ease1 = phase1 < 0.5 ? 2 * phase1 * phase1 : 1 - Math.pow(-2 * phase1 + 2, 2) / 2;
        shape.scale = 0.5 + ease1 * 0.6;
        shape.spawnOpacity = 1;
        shape.shadowScale = ease1 * 1.1;
      } else {
        const phase2 = (t - 0.6) / 0.4;
        const ease2 = phase2 < 0.5 ? 2 * phase2 * phase2 : 1 - Math.pow(-2 * phase2 + 2, 2) / 2;
        shape.scale = 1.1 - ease2 * 0.1;
        shape.spawnOpacity = 1;
        shape.shadowScale = 1.1 - ease2 * 0.1;
      }
      
      if (t >= 1) {
        shape.spawnTime = null;
        shape.scale = 1;
        shape.spawnOpacity = 1;
        shape.shadowScale = 1;
      }
    }

    if (isOutOfBounds(shape)) {
      shapes.splice(i, 1);
      continue;
    }

    const popOpacity = shape.popOpacity !== undefined ? shape.popOpacity : 1;
    const spawnOpacity = shape.spawnOpacity !== undefined ? shape.spawnOpacity : 1;
    const opacity = popOpacity * spawnOpacity;
    const shadowScale = shape.shadowScale !== undefined ? shape.shadowScale : 1;
    
    // Y-axis wobble
    const wobble = Math.sin(shape.time * 1.5 + shape.wavePhase * 2) * 1.5 * dpr;
    
    // Draw shadow
    if (shadowScale > 0) {
      const dist = Math.sqrt(shape.x * shape.x + shape.y * shape.y);
      const shadowDistance = 10 * dpr * shadowScale;
      const shadowOffsetX = dist > 0 ? (shape.x / dist) * shadowDistance : 0;
      const shadowOffsetY = dist > 0 ? (shape.y / dist) * shadowDistance : shadowDistance;
      shadowColorTemp[3] = shadowColor[3] * opacity * shadowScale;
      drawShape(shape, shadowOffsetX, shadowOffsetY + wobble, shadowColorTemp);
    }
    
    // Draw main shape
    colorTemp[0] = shape.color[0];
    colorTemp[1] = shape.color[1];
    colorTemp[2] = shape.color[2];
    colorTemp[3] = shape.color[3] * opacity;
    const color2Temp = [shape.color2[0], shape.color2[1], shape.color2[2], shape.color2[3] * opacity];
    drawShape(shape, 0, wobble, colorTemp, color2Temp);
  }

  // Update and render fragments
  const fragLen = fragments.length;
  for (let i = fragLen - 1; i >= 0; i--) {
    const frag = fragments[i];
    
    frag.x += frag.vx;
    frag.y += frag.vy;
    frag.vy += frag.gravity;
    frag.vx *= 0.98;
    frag.vy *= 0.98;
    frag.rotation += frag.rotationSpeed;
    frag.life -= frag.decay;
    
    if (frag.life <= 0) {
      fragments.splice(i, 1);
      continue;
    }
    
    colorTemp[0] = frag.color[0];
    colorTemp[1] = frag.color[1];
    colorTemp[2] = frag.color[2];
    colorTemp[3] = frag.color[3] * frag.life;
    const fragColor2Temp = [frag.color2[0], frag.color2[1], frag.color2[2], frag.color2[3] * frag.life];
    frag.scale = 1;
    drawShape(frag, 0, 0, colorTemp, fragColor2Temp);
  }

  gl.disable(gl.BLEND);

  requestAnimationFrame(render);
  } catch (e) {
    console.error('Render error:', e);
  }
}

render();
console.log('WebGL Shape Animation ready - click anywhere to create shapes!');

// Wiggly underline for project links
const underlineColors = [
  '#F24647', '#46F2B6', '#2F6CE1', '#F2EC46', '#F246D5',
  '#F29C46', '#91F246', '#46E9F2', '#6E46F2'
];
let colorIndex = 0;

function createWigglyPath() {
  const segments = 12;
  let d = 'M 0 6';
  for (let i = 1; i <= segments; i++) {
    const x = (i / segments) * 100;
    const y = 6 + (Math.sin(i * 1.8) * 3) + (Math.random() - 0.5) * 2;
    d += ` L ${x} ${y}`;
  }
  return d;
}

document.querySelectorAll('.project-link').forEach(link => {
  const underline = document.createElement('span');
  underline.className = 'wiggly-underline';
  underline.innerHTML = `<svg viewBox="0 0 100 12" preserveAspectRatio="none"><path d="${createWigglyPath()}" stroke="${underlineColors[colorIndex]}"/></svg>`;
  link.appendChild(underline);
  
  link.addEventListener('mouseenter', () => {
    const path = underline.querySelector('path');
    path.setAttribute('d', createWigglyPath());
    path.setAttribute('stroke', underlineColors[colorIndex]);
    colorIndex = (colorIndex + 1) % underlineColors.length;
  });
});
