const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl', { antialias: false });

if (!gl) {
  alert('WebGL not supported');
}

let contextLost = false;
let animFrameId = 0;
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  contextLost = true;
  cancelAnimationFrame(animFrameId);
});
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  initWebGL();
  animFrameId = requestAnimationFrame(render);
});

function checkIsMobile() {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrowViewport = window.innerWidth < 1024;
  return isNarrowViewport || isTouchDevice;
}
let isMobile = checkIsMobile();

function checkIsLargeViewport() {
  return window.innerWidth >= 2560;
}
let isLargeViewport = checkIsLargeViewport();
function getLargeViewportScale() {
  if (!isLargeViewport) return 1.0;
  return Math.min(window.innerWidth / 1920, 2.0);
}

function updateMobileClass() {
  if (isMobile) {
    document.body.classList.add('is-mobile');
    document.body.classList.remove('is-desktop');
  } else {
    document.body.classList.add('is-desktop');
    document.body.classList.remove('is-mobile');
  }
}

function updateHintAnimation() {
  const mouseHint = document.getElementById('mouseHint');
  if (mouseHint && typeof mouseHint.load === 'function') {
    const animationSrc = isMobile ? 'touch-animation.json' : 'mouse-animation.json';
    if (mouseHint.getAttribute('src') !== animationSrc) {
      mouseHint.load(animationSrc);
    }
  }
}

let dpr = window.devicePixelRatio || 1;
let canvasWidth = 0;
let canvasHeight = 0;

const is404Page = window.location.pathname.includes('404');
const isIndexPage = document.title === 'Homepage' && !window.location.pathname.includes('coming-soon');
const isLandingPage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html') || is404Page;

let textEl = null;
let textCenterX = 0;
let textCenterY = 0;

function updateTextCenter() {
  if (!textEl) textEl = document.querySelector('.content-wrapper');
  const rect = textEl ? textEl.getBoundingClientRect() : null;
  const scrollOffsetY = isMobile ? window.scrollY : 0;
  textCenterX = rect ? (rect.left + rect.width / 2) * dpr : canvasWidth / 2;
  textCenterY = rect ? ((rect.top + scrollOffsetY) + rect.height / 2) * dpr : canvasHeight / 2;
}

function getDocHeight() {
  return Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
}

function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  canvasWidth = window.innerWidth * dpr;
  if (isMobile) {
    const docH = getDocHeight();
    canvasHeight = docH * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = docH + 'px';
  } else {
    canvasHeight = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  if (gl && !contextLost) gl.viewport(0, 0, canvasWidth, canvasHeight);
  updateTextCenter();
}

let prevTextCenterX = 0;
let prevTextCenterY = 0;

function repositionShapesOnResize() {
  const dx = textCenterX - prevTextCenterX;
  const dy = textCenterY - prevTextCenterY;

  if (dx !== 0 || dy !== 0) {
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      shape.x += dx;
      shape.baseY += dy;
      shape.y = shape.baseY;
    }
  }

  prevTextCenterX = textCenterX;
  prevTextCenterY = textCenterY;
}

let resizeTimer = 0;
function onResize() {
  cancelAnimationFrame(resizeTimer);
  resizeTimer = requestAnimationFrame(() => {
    isMobile = checkIsMobile();
    isLargeViewport = checkIsLargeViewport();
    updateMobileClass();
    updateHintAnimation();
    resizeCanvas();
    repositionShapesOnResize();
    if (typeof updateZones === 'function') updateZones();
  });
}
window.addEventListener('resize', onResize);

let lastDocHeight = 0;
function checkDocHeightChange() {
  if (!isMobile) return;
  const currentDocH = getDocHeight();
  if (currentDocH !== lastDocHeight) {
    lastDocHeight = currentDocH;
    canvasHeight = currentDocH * dpr;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.height = currentDocH + 'px';
    if (gl && !contextLost) gl.viewport(0, 0, canvasWidth, canvasHeight);
  }
}
setInterval(checkDocHeightChange, 500);

resizeCanvas();
prevTextCenterX = textCenterX;
prevTextCenterY = textCenterY;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateMobileClass();
    updateHintAnimation();
    resizeCanvas();
  });
} else {
  updateMobileClass();
  updateHintAnimation();
}

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

function createShader(glCtx, type, source) {
  const shader = glCtx.createShader(type);
  glCtx.shaderSource(shader, source);
  glCtx.compileShader(shader);
  if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
    console.error(glCtx.getShaderInfoLog(shader));
    glCtx.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(glCtx, vertexShader, fragmentShader) {
  const prog = glCtx.createProgram();
  glCtx.attachShader(prog, vertexShader);
  glCtx.attachShader(prog, fragmentShader);
  glCtx.linkProgram(prog);
  if (!glCtx.getProgramParameter(prog, glCtx.LINK_STATUS)) {
    console.error(glCtx.getProgramInfoLog(prog));
    glCtx.deleteProgram(prog);
    return null;
  }
  return prog;
}

let program, positionLocation, uvLocation, resolutionLocation, translationLocation,
    scaleLocation, rotationLocation, sizeLocation, colorLocation, color2Location,
    shapeTypeLocation, cornerRadiusLocation, quadBuffer;

const quadVertices = new Float32Array([
  -0.5, -0.5,  -0.5, -0.5,
   0.5, -0.5,   0.5, -0.5,
  -0.5,  0.5,  -0.5,  0.5,
  -0.5,  0.5,  -0.5,  0.5,
   0.5, -0.5,   0.5, -0.5,
   0.5,  0.5,   0.5,  0.5
]);

function initWebGL() {
  if (!gl) return;
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vs || !fs) return;
  program = createProgram(gl, vs, fs);
  if (!program) return;

  positionLocation = gl.getAttribLocation(program, 'a_position');
  uvLocation = gl.getAttribLocation(program, 'a_uv');
  resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  translationLocation = gl.getUniformLocation(program, 'u_translation');
  scaleLocation = gl.getUniformLocation(program, 'u_scale');
  rotationLocation = gl.getUniformLocation(program, 'u_rotation');
  sizeLocation = gl.getUniformLocation(program, 'u_size');
  colorLocation = gl.getUniformLocation(program, 'u_color');
  color2Location = gl.getUniformLocation(program, 'u_color2');
  shapeTypeLocation = gl.getUniformLocation(program, 'u_shapeType');
  cornerRadiusLocation = gl.getUniformLocation(program, 'u_cornerRadius');

  quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
}
initWebGL();

const shapes = [];
const fragments = [];
const MAX_SHAPES = 15;

const shadowColor = [0.0, 0.0, 0.0, 0.25];
const shadowColorTemp = [0.0, 0.0, 0.0, 0.25];
const colorTemp = [0, 0, 0, 1];
const color2Temp = [0, 0, 0, 1];

const colors = [
  { start: [0.95, 0.64, 0.27, 1.0], end: [0.88, 0.47, 0.00, 1.0] },
  { start: [0.79, 0.27, 0.95, 1.0], end: [0.65, 0.22, 0.78, 1.0] },
  { start: [0.95, 0.27, 0.28, 1.0], end: [0.75, 0.08, 0.09, 1.0] },
  { start: [0.27, 0.95, 0.71, 1.0], end: [0.05, 0.74, 0.50, 1.0] },
  { start: [0.27, 0.62, 0.95, 1.0], end: [0.10, 0.47, 0.83, 1.0] },
  { start: [0.95, 0.27, 0.61, 1.0], end: [0.83, 0.09, 0.46, 1.0] },
  { start: [0.35, 0.95, 0.27, 1.0], end: [0.20, 0.82, 0.12, 1.0] },
  { start: [0.18, 0.42, 0.88, 1.0], end: [0.09, 0.33, 0.80, 1.0] },
  { start: [0.95, 0.93, 0.27, 1.0], end: [0.79, 0.76, 0.07, 1.0] },
  { start: [0.27, 0.91, 0.95, 1.0], end: [0.22, 0.80, 0.85, 1.0] },
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

function countActiveShapes() {
  let count = 0;
  for (let i = 0; i < shapes.length; i++) {
    if (!shapes[i].popping) count++;
  }
  return count;
}

function findOldestActiveShape() {
  for (let i = 0; i < shapes.length; i++) {
    if (!shapes[i].popping) return shapes[i];
  }
  return null;
}

function createFragments(shape) {
  const numFragments = 6 + Math.floor(Math.random() * 4);

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
      color: [shape.color[0], shape.color[1], shape.color[2], shape.color[3]],
      color2: [shape.color2[0], shape.color2[1], shape.color2[2], shape.color2[3]],
      shapeType: shape.shapeType,
      opacity: 1,
      life: 1,
      decay: 0.02 + Math.random() * 0.01,
      gravity: 0.1 * dpr
    });
  }
}

function isShapeAtScreenPoint(clientX, clientY) {
  const scrollOffsetY = isMobile ? window.scrollY : 0;
  const sx = clientX * dpr;
  const sy = (clientY + scrollOffsetY) * dpr;
  return getClickedShape(sx, sy) !== null;
}

function getClickedShape(clickX, clickY) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (shape.popping) continue;

    const dx = clickX - shape.x;
    const dy = clickY - shape.y;
    const distSq = dx * dx + dy * dy;
    const hitRadius = shape.size * shape.scale * 0.45;

    if (distSq < hitRadius * hitRadius) {
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

  const basePush = isMobile ? 3.0 : 4.5;
  const strength = (basePush + Math.random() * 0.5) * dpr;

  shape.vx += Math.cos(pushAngle) * strength;
  shape.vy += Math.sin(pushAngle) * strength;

  const maxSpeed = isMobile ? 2.5 * dpr : 3.5 * dpr;
  const speed = Math.sqrt(shape.vx * shape.vx + shape.vy * shape.vy);
  if (speed > maxSpeed) {
    const ratio = maxSpeed / speed;
    shape.vx *= ratio;
    shape.vy *= ratio;
  }

  shape.rotationSpeed += (Math.random() - 0.5) * 0.003;
  shape.ignoreGravity = true;
  shape.ignoreGravityUntil = performance.now() + 2000;
  shape.driftSpeedMultiplier = 1.0;
}

function handleInteraction(clientX, clientY, event) {
  const scrollOffsetY = isMobile ? window.scrollY : 0;
  const interactX = clientX * dpr;
  const interactY = (clientY + scrollOffsetY) * dpr;

  const clickedShape = getClickedShape(interactX, interactY);
  if (clickedShape) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    pushShape(clickedShape, interactX, interactY);
    return true;
  }
  return false;
}

const aboutOverlayRef = document.getElementById('aboutModalOverlay');
const projectOverlayRef = document.getElementById('projectModalOverlay');

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchHandledAsTap = false;
const TAP_MOVE_THRESHOLD = 15;
const TAP_TIME_THRESHOLD = 300;

function handleTapOrClick(clientX, clientY, event) {
  if ((aboutOverlayRef && aboutOverlayRef.classList.contains('visible')) ||
      (projectOverlayRef && projectOverlayRef.classList.contains('visible'))) {
    return;
  }

  if (handleInteraction(clientX, clientY, event)) {
    return;
  }

  if (event && event.target && event.target.closest('a, button, .project-link, header')) {
    return;
  }

  const scrollOffsetY = isMobile ? window.scrollY : 0;
  const clickX = clientX * dpr;
  const clickY = (clientY + scrollOffsetY) * dpr;

  if (countActiveShapes() >= MAX_SHAPES) {
    const oldest = findOldestActiveShape();
    if (oldest) {
      oldest.popping = true;
      oldest.popStart = performance.now();
    }
  }

  createShapeAt(clickX, clickY);
}

document.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = performance.now();
  touchHandledAsTap = false;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (touchHandledAsTap) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const elapsed = performance.now() - touchStartTime;

  if (dist < TAP_MOVE_THRESHOLD && elapsed < TAP_TIME_THRESHOLD) {
    touchHandledAsTap = true;

    if (e.target && e.target.closest('a, button, .project-link, header, .project-preview, .about-modal, .project-modal')) {
      return;
    }

    const scrollOffsetY = window.scrollY;
    const interactX = touch.clientX * dpr;
    const interactY = (touch.clientY + scrollOffsetY) * dpr;
    const clickedShape = getClickedShape(interactX, interactY);

    if (clickedShape) {
      e.preventDefault();
      pushShape(clickedShape, interactX, interactY);
      return;
    }

    handleTapOrClick(touch.clientX, touch.clientY, e);
  }
}, { passive: false });

document.addEventListener('click', (e) => {
  if (touchHandledAsTap) {
    touchHandledAsTap = false;
    return;
  }
  handleTapOrClick(e.clientX, e.clientY, e);
});

function createShapeAt(x, y, isAutoSpawned = false) {
  const mouseHint = document.getElementById('mouseHint');
  if (mouseHint && !isAutoSpawned) {
    mouseHint.style.transition = 'opacity 0.15s ease-out';
    mouseHint.style.opacity = '0';
    window._userShapeCount = (window._userShapeCount || 0) + 1;
    if (window._userShapeCount >= 2) {
      window._shapeCreatedByUser = true;
    }
  }

  let angle, speed;
  if (is404Page) {
    angle = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    speed = (0.3 + Math.random() * 0.2) * dpr;
  } else if (isLandingPage) {
    if (isAutoSpawned) {
      angle = 0;
      speed = 0;
    } else {
      angle = Math.random() * Math.PI * 2;
      speed = (0.5 + Math.random() * 0.5) * dpr;
    }
  } else {
    angle = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 1.6;
    speed = (0.1 + Math.random() * 0.14) * dpr;
  }

  const shapeType = getNextShapeType();
  const color = getNextColor();
  const rotation = Math.random() * Math.PI * 2;
  const rotationSpeed = (Math.random() - 0.5) * 0.003;

  const lvScale = getLargeViewportScale();
  const baseSize = isMobile ? (72 + Math.random() * 24) : (120 + Math.random() * 40) * lvScale;
  const size = baseSize * dpr;

  const wavePhase = Math.random() * Math.PI * 2;
  const waveSpeed = 0.01 + Math.random() * 0.01;
  const waveAmplitude = (1.5 + Math.random() * 2) * dpr;

  let pullTargetX = x;
  let pullTargetY = y;
  if (!isAutoSpawned && isLandingPage && !is404Page) {
    const el = document.querySelector('.content-wrapper');
    const rect = el ? el.getBoundingClientRect() : null;
    const tcx = rect ? (rect.left + rect.width / 2) * dpr : canvasWidth / 2;
    const tcy = rect ? (rect.top + rect.height / 2) * dpr : canvasHeight / 2;
    const gravOff = 64 * dpr;
    const distScale = isMobile ? 0.5 : 1.0;
    const minDist = 100 * dpr * distScale;
    const maxDist = 200 * dpr * distScale;
    const rAngle = Math.random() * Math.PI * 2;
    const rDist = minDist + Math.random() * (maxDist - minDist);
    pullTargetX = tcx + Math.cos(rAngle) * rDist;
    pullTargetY = (tcy - gravOff) + Math.sin(rAngle) * rDist;
  }

  let initVx = Math.cos(angle) * speed;
  let initVy = Math.sin(angle) * speed;
  if (!isAutoSpawned && isLandingPage && !is404Page) {
    updateUIAvoidRects();
    const shapeR = size * 0.5;
    for (let ri = 0; ri < uiAvoidRects.length; ri++) {
      const r = uiAvoidRects[ri];
      if (x + shapeR > r.left && x - shapeR < r.right && y + shapeR > r.top && y - shapeR < r.bottom) {
        const dx = pullTargetX - x;
        const dy = pullTargetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const kickSpeed = 8.0 * dpr;
        initVx = (dx / dist) * kickSpeed;
        initVy = (dy / dist) * kickSpeed;
        break;
      }
    }
  }

  shapes.push({
    x,
    y,
    baseY: y,
    spawnX: pullTargetX,
    spawnBaseY: pullTargetY,
    vx: initVx,
    vy: initVy,
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
    ignoreGravity: false,
    driftSpeedMultiplier: 1.0
  });
}

function createStatic404Shapes() {
  const centerX = canvasWidth / 2;

  if (canvasWidth === 0 || canvasHeight === 0) {
    setTimeout(createStatic404Shapes, 100);
    return;
  }

  const el = document.querySelector('.content-wrapper');
  const rect = el ? el.getBoundingClientRect() : null;
  const textBottomY = rect ? (rect.bottom + 100) * dpr : canvasHeight / 2 + 200 * dpr;

  const positionScale = isMobile ? 0.6 : 1.0;
  const baseSize = isMobile ? 70 : 110;

  const positions = [
    { x: -160, y: 60, rot: -0.15, size: 1.1 },
    { x: -50, y: 30, rot: 0, size: 1.0 },
    { x: -100, y: 120, rot: 0.25, size: 0.85 },
    { x: 10, y: 140, rot: 0.1, size: 1.0 },
    { x: 90, y: 100, rot: 0.08, size: 1.05 },
    { x: 50, y: 40, rot: 0.35, size: 0.9 },
    { x: 160, y: 60, rot: 0, size: 0.95 },
    { x: 200, y: 110, rot: 0.15, size: 0.9 },
    { x: 250, y: 50, rot: -0.1, size: 0.85 },
  ];

  const shuffledIndices = Array.from({ length: positions.length }, (_, i) => i);
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
  }

  const delays = [];
  let cumulativeDelay = 0;
  for (let i = 0; i < positions.length; i++) {
    delays.push(cumulativeDelay);
    cumulativeDelay += 400 + Math.random() * 600;
  }

  const startOffset = 40 * dpr;
  const animDuration = 600;
  const now = performance.now();

  for (let i = 0; i < positions.length; i++) {
    const posIndex = shuffledIndices[i];
    const pos = positions[posIndex];
    const shapeType = posIndex % 8;
    const color = colors[posIndex % colors.length];

    const size = baseSize * pos.size * dpr;
    const yOffset = pos.y * positionScale * dpr;
    const finalY = textBottomY + yOffset;

    const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    const speed = (0.25 + Math.random() * 0.15) * dpr;

    shapes.push({
      x: centerX + pos.x * positionScale * dpr,
      y: finalY - startOffset,
      baseY: finalY,
      targetY: finalY,
      startY: finalY - startOffset,
      vx: Math.cos(angle) * speed * 0.3,
      vy: Math.sin(angle) * speed,
      shapeType,
      color: color.start,
      color2: color.end,
      rotation: pos.rot + (Math.random() - 0.5) * 0.2,
      rotationSpeed: (Math.random() - 0.5) * 0.002,
      scale: 1,
      size,
      wavePhase: Math.random() * Math.PI * 2,
      waveSpeed: 0.01 + Math.random() * 0.01,
      waveAmplitude: (1.5 + Math.random() * 2) * dpr,
      time: 0,
      spawnTime: now + delays[i],
      spawnDuration: animDuration,
      spawnOpacity: 0,
      shadowScale: 0,
      hasBeenClicked: false,
      isAutoSpawned: true,
      ignoreGravity: true,
      driftSpeedMultiplier: 1.0,
      isStatic: false,
      is404Animating: true
    });
  }
}

function spawnInitialShapes() {
  if (is404Page) {
    createStatic404Shapes();
    return;
  }

  const el = document.querySelector('.content-wrapper');
  const rect = el ? el.getBoundingClientRect() : null;
  const tcx = rect ? (rect.left + rect.width / 2) * dpr : canvas.width / 2;
  const tcy = (rect ? (rect.top + rect.height / 2) * dpr : canvas.height * 0.45) - canvas.height * 0.05;

  if (isIndexPage) {
    const initialCount = Math.min(isMobile ? 10 : (isLargeViewport ? Math.round(15 * getLargeViewportScale()) : 15), MAX_SHAPES);

    const indices = Array.from({ length: initialCount }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const centerX = canvas.width / 2;
    const centerY = isMobile ? canvas.height * 0.20 : canvas.height * 0.35;
    const spreadX = isMobile ? 173 : 346;
    const spreadY = isMobile ? 115 : 216;

    const staggerDelay = 300;
    const spawnNow = performance.now();
    for (let i = 0; i < initialCount; i++) {
      const x = centerX + (Math.random() - 0.5) * spreadX * dpr;
      const y = centerY + (Math.random() - 0.5) * spreadY * dpr;
      createShapeAt(x, y, true);
      const s = shapes[shapes.length - 1];
      s.scale = 0;
      s.spawnOpacity = 0;
      s.shadowScale = 0;
      s.spawnTime = spawnNow + i * staggerDelay;
      s.spawnDuration = 840;
    }
    return;
  }

  const gravityOffsetY = 64;
  const lvScale = getLargeViewportScale();
  const positionScale = isMobile ? 0.65 : 1.44 * lvScale;
  const positions = [
    { x: -240 * positionScale, y: -40 * positionScale },
    { x: -132 * positionScale, y: -70 * positionScale },
    { x: 0, y: -80 * positionScale },
    { x: 132 * positionScale, y: -70 * positionScale },
    { x: 240 * positionScale, y: -40 * positionScale },
    { x: -240 * positionScale, y: 40 * positionScale },
    { x: -132 * positionScale, y: 70 * positionScale },
    { x: 0, y: 80 * positionScale },
    { x: 132 * positionScale, y: 70 * positionScale },
    { x: 240 * positionScale, y: 40 * positionScale },
    { x: -186 * positionScale, y: -55 * positionScale },
    { x: 186 * positionScale, y: -55 * positionScale },
    { x: -186 * positionScale, y: 55 * positionScale },
    { x: 186 * positionScale, y: 55 * positionScale },
    { x: 0, y: 0 },
  ];

  const initialCount = Math.min(isLandingPage ? (isLargeViewport ? Math.round(15 * getLargeViewportScale()) : 15) : 8, MAX_SHAPES);

  const indices = Array.from({ length: initialCount }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const staggerDelay2 = 300;
  const spawnNow2 = performance.now();
  for (let i = 0; i < initialCount; i++) {
    const pos = positions[indices[i]];
    const x = tcx + pos.x * dpr;
    const y = (tcy - gravityOffsetY * dpr) + pos.y * dpr;
    createShapeAt(x, y, true);
    const s = shapes[shapes.length - 1];
    s.scale = 0;
    s.spawnOpacity = 0;
    s.shadowScale = 0;
    s.spawnTime = spawnNow2 + i * staggerDelay2;
    s.spawnDuration = 840;
  }
}

spawnInitialShapes();

setInterval(() => {
  if (!isLandingPage || is404Page) return;

  const activeShapes = countActiveShapes();
  const minShapes = MAX_SHAPES;
  if (activeShapes < minShapes) {
    if (isIndexPage) {
      const cx = canvas.width / 2;
      const cy = isMobile ? canvas.height * 0.35 : canvas.height / 2;
      const sx = isMobile ? 100 : 200;
      const sy = isMobile ? 80 : 150;
      const x = cx + (Math.random() - 0.5) * sx * dpr;
      const y = cy + (Math.random() - 0.5) * sy * dpr;
      createShapeAt(x, y, true);
    } else {
      const el = document.querySelector('.content-wrapper');
      const rect = el ? el.getBoundingClientRect() : null;
      const tcx = rect ? (rect.left + rect.width / 2) * dpr : canvas.width / 2;
      const tcy = rect ? (rect.top + rect.height / 2) * dpr : canvas.height / 2;

      const distanceScale = isMobile ? 0.5 : 1.0;
      const minDistance = 100 * dpr * distanceScale;
      const maxDistance = 200 * dpr * distanceScale;
      const angle = Math.random() * Math.PI * 2;
      const distance = minDistance + Math.random() * (maxDistance - minDistance);
      const x = tcx + Math.cos(angle) * distance;
      const y = tcy + Math.sin(angle) * distance;
      createShapeAt(x, y, true);
    }
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
        const push = overlap * 0.6;

        a.x -= nx * push;
        a.baseY -= ny * push;
        b.x += nx * push;
        b.baseY += ny * push;

        a.vx -= nx * 0.005;
        a.vy -= ny * 0.005;
        b.vx += nx * 0.005;
        b.vy += ny * 0.005;

      }
    }
  }
}

let cornerRadius = 12.0;

function drawShape(shape, offsetX, offsetY, color, c2) {
  gl.uniform2f(translationLocation, shape.x + offsetX, shape.y + offsetY);
  gl.uniform1f(scaleLocation, shape.scale);
  gl.uniform1f(rotationLocation, shape.rotation);
  gl.uniform1f(sizeLocation, shape.size);
  gl.uniform4fv(colorLocation, color);
  gl.uniform4fv(color2Location, c2 || color);
  gl.uniform1f(shapeTypeLocation, shape.shapeType);
  gl.uniform1f(cornerRadiusLocation, cornerRadius);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

let clearZoneHalfW = 200;
let clearZoneHalfH = 48;
let innerZoneHalfW = 360;
let innerZoneHalfH = 200;
let outwardDriftSpeed = 0.012643750;
let inwardDriftSpeed = 0.00361250;
let pushStrengthDrift = 0.010837500;

let uiAvoidRects = [];
let uiAvoidRectsLastUpdate = -1000;

function updateUIAvoidRects() {
  const now = performance.now();
  if (now - uiAvoidRectsLastUpdate < 500) return;
  uiAvoidRectsLastUpdate = now;
  uiAvoidRects = [];
  const selectors = ['.header_landing', '.about-me-btn', '.tagline-container', '.projects', '.mobile-landing-footer'];
  const padding = 30 * dpr;
  selectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    uiAvoidRects.push({
      left: rect.left * dpr - padding,
      top: rect.top * dpr - padding,
      right: rect.right * dpr + padding,
      bottom: rect.bottom * dpr + padding,
      cx: (rect.left + rect.width / 2) * dpr,
      cy: (rect.top + rect.height / 2) * dpr
    });
  });
}

function isInsideUIRect(x, y, radius) {
  for (let i = 0; i < uiAvoidRects.length; i++) {
    const r = uiAvoidRects[i];
    if (x + radius > r.left && x - radius < r.right && y + radius > r.top && y - radius < r.bottom) {
      return true;
    }
  }
  return false;
}

function pushOutOfUIRects(shape) {
  const shapeR = shape.size * shape.scale * 0.5;
  const proximityZone = 80 * dpr;
  const proximityForce = 4.0 * dpr;
  shape._overText = false;
  for (let ri = 0; ri < uiAvoidRects.length; ri++) {
    const r = uiAvoidRects[ri];
    const expandedLeft = r.left - proximityZone;
    const expandedRight = r.right + proximityZone;
    const expandedTop = r.top - proximityZone;
    const expandedBottom = r.bottom + proximityZone;
    if (shape.x + shapeR > r.left && shape.x - shapeR < r.right && shape.baseY + shapeR > r.top && shape.baseY - shapeR < r.bottom) {
      shape._overText = true;
      const overlapL = (shape.x + shapeR) - r.left;
      const overlapR = r.right - (shape.x - shapeR);
      const overlapT = (shape.baseY + shapeR) - r.top;
      const overlapB = r.bottom - (shape.baseY - shapeR);
      const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);
      const teleportGap = 15 * dpr;
      if (minOverlap === overlapL) {
        shape.x = r.left - shapeR - teleportGap;
      } else if (minOverlap === overlapR) {
        shape.x = r.right + shapeR + teleportGap;
      } else if (minOverlap === overlapT) {
        shape.baseY = r.top - shapeR - teleportGap;
      } else {
        shape.baseY = r.bottom + shapeR + teleportGap;
      }
      if (shape.spawnX !== undefined) {
        const dx = shape.spawnX - shape.x;
        const dy = shape.spawnBaseY - shape.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 6.0 * dpr;
        shape.vx = (dx / dist) * speed;
        shape.vy = (dy / dist) * speed;
      }
    } else if (shape.x + shapeR > expandedLeft && shape.x - shapeR < expandedRight && shape.baseY + shapeR > expandedTop && shape.baseY - shapeR < expandedBottom) {
      const cx = (r.left + r.right) * 0.5;
      const cy = (r.top + r.bottom) * 0.5;
      const dx = shape.x - cx;
      const dy = shape.baseY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      shape.vx += (dx / dist) * proximityForce;
      shape.vy += (dy / dist) * proximityForce;
      shape._overText = true;
    }
  }
}

function updateZones() {
  const lvScale = getLargeViewportScale();
  if (isMobile) {
    clearZoneHalfW = 100 * dpr;
    clearZoneHalfH = 32 * dpr;
    innerZoneHalfW = 160 * dpr;
    innerZoneHalfH = 100 * dpr;
  } else {
    clearZoneHalfW = 200 * dpr * lvScale;
    clearZoneHalfH = 48 * dpr * lvScale;
    innerZoneHalfW = 360 * dpr * lvScale;
    innerZoneHalfH = 200 * dpr * lvScale;
  }
  cornerRadius = 12.0 * dpr;
  const driftMultiplier = isMobile ? 1.2 : 1.0;
  outwardDriftSpeed = 0.012643750 * dpr * 0.02 * driftMultiplier;
  inwardDriftSpeed = 0.00361250 * dpr * 0.02 * driftMultiplier;
  pushStrengthDrift = 0.010837500 * dpr * 0.02 * driftMultiplier;
}
updateZones();

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function render() {
  if (contextLost || !program) {
    return;
  }
  try {
  const now = performance.now();

  updateUIAvoidRects();

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(program);
  gl.uniform2f(resolutionLocation, canvasWidth, canvasHeight);

  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

  handleCollisions();

  const gravityOffsetY = 64 * dpr;
  let writeIdx = 0;

  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];

    if (shape.ignoreGravity && shape.ignoreGravityUntil && now >= shape.ignoreGravityUntil) {
      shape.ignoreGravity = false;
      shape.driftSpeedMultiplier = Math.max(1.0, (shape.driftSpeedMultiplier || 1.0) * 0.5);
    }

    if (shape.isStatic) {
    } else if (isIndexPage && !shape.popping) {
      const driftMultiplier = shape.driftSpeedMultiplier || 1.0;
      const autoSpawnedMobileMultiplier = (isMobile && shape.isAutoSpawned) ? 0.3 : 1.0;

      if (shape.spawnX !== undefined) {
        const shapeR = shape.size * shape.scale * 0.5;
        if (isInsideUIRect(shape.spawnX, shape.spawnBaseY, shapeR)) {
          for (let attempt = 0; attempt < 10; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 80 * dpr + Math.random() * 120 * dpr;
            const nx = shape.spawnX + Math.cos(angle) * dist;
            const ny = shape.spawnBaseY + Math.sin(angle) * dist;
            if (!isInsideUIRect(nx, ny, shapeR) && nx > shapeR && nx < canvasWidth - shapeR && ny > shapeR && ny < canvasHeight - shapeR) {
              shape.spawnX = nx;
              shape.spawnBaseY = ny;
              break;
            }
          }
        }
        if (!isInsideUIRect(shape.spawnX, shape.spawnBaseY, shapeR)) {
          const pullDx = shape.spawnX - shape.x;
          const pullDy = shape.spawnBaseY - shape.baseY;
          const pullDist = Math.sqrt(pullDx * pullDx + pullDy * pullDy) || 1;
          const normalizedDist = pullDist / (50 * dpr);
          const pullStrength = 0.005 * dpr * autoSpawnedMobileMultiplier;
          shape.vx += (pullDx / pullDist) * pullStrength * Math.min(normalizedDist, 2.0);
          shape.vy += (pullDy / pullDist) * pullStrength * Math.min(normalizedDist, 2.0);
        }
      }

      if (!shape._overText) {
        shape.vx *= 0.97;
        shape.vy *= 0.97;
      }
    } else if (isLandingPage && !shape.popping) {
      const dx = shape.x - textCenterX;
      const dy = shape.baseY - (textCenterY - gravityOffsetY);
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const inClear = absDx < clearZoneHalfW && absDy < clearZoneHalfH;
      const inInner = absDx < innerZoneHalfW && absDy < innerZoneHalfH;

      const shapeRadius = shape.size * shape.scale * 0.5;
      const wavePadding = shape.waveAmplitude + 8 * dpr;
      const effectiveRadiusX = shapeRadius;
      const effectiveRadiusY = shapeRadius + wavePadding;
      const inClearExpanded = absDx < (clearZoneHalfW + effectiveRadiusX) && absDy < (clearZoneHalfH + effectiveRadiusY);

      const autoSpawnedMobileMultiplier = (isMobile && shape.isAutoSpawned) ? 0.3 : 1.0;
      const driftMultiplier = shape.driftSpeedMultiplier || 1.0;

      if (!shape._overText) {
        if (inClear || inClearExpanded) {
          const angle = Math.atan2(dy, dx);
          const pushForce = (inClear ? pushStrengthDrift * 4 : pushStrengthDrift * 2) * autoSpawnedMobileMultiplier * driftMultiplier;
          shape.vx += Math.cos(angle) * pushForce;
          shape.vy += Math.sin(angle) * pushForce;
        }

        if (shape.spawnX !== undefined) {
          const shapeR = shape.size * shape.scale * 0.5;
          if (isInsideUIRect(shape.spawnX, shape.spawnBaseY, shapeR)) {
            for (let attempt = 0; attempt < 10; attempt++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = 80 * dpr + Math.random() * 120 * dpr;
              const nx = shape.spawnX + Math.cos(angle) * dist;
              const ny = shape.spawnBaseY + Math.sin(angle) * dist;
              if (!isInsideUIRect(nx, ny, shapeR) && nx > shapeR && nx < canvasWidth - shapeR && ny > shapeR && ny < canvasHeight - shapeR) {
                shape.spawnX = nx;
                shape.spawnBaseY = ny;
                break;
              }
            }
          }
          if (!isInsideUIRect(shape.spawnX, shape.spawnBaseY, shapeR)) {
            const pullDx = shape.spawnX - shape.x;
            const pullDy = shape.spawnBaseY - shape.baseY;
            const pullDist = Math.sqrt(pullDx * pullDx + pullDy * pullDy) || 1;
            const normalizedDist = pullDist / (50 * dpr);
            const pullStrength = 0.005 * dpr * autoSpawnedMobileMultiplier;
            shape.vx += (pullDx / pullDist) * pullStrength * Math.min(normalizedDist, 2.0);
            shape.vy += (pullDy / pullDist) * pullStrength * Math.min(normalizedDist, 2.0);
          }
        }

        shape.vx *= 0.97;
        shape.vy *= 0.97;
      }
    }

    const overTextBoost = shape._overText ? 5.0 : 1.0;
    shape.x += shape.vx * overTextBoost;
    shape.baseY += shape.vy * overTextBoost;

    if (isLandingPage && !is404Page && !isIndexPage && !shape.popping && !shape.isStatic) {
      pushOutOfUIRects(shape);
    }

    if (is404Page && !shape.popping) {
      const shapePadding = shape.size * 0.6 + shape.waveAmplitude + 60 * dpr;
      const bottomBoundary = canvas.height - shapePadding;
      if (shape.baseY < bottomBoundary) {
        const drift = 0.25 * dpr;
        shape.baseY += drift;
        if (shape.targetY !== undefined) shape.targetY += drift;
        if (shape.baseY > bottomBoundary) {
          shape.baseY = bottomBoundary;
          if (shape.targetY !== undefined) shape.targetY = bottomBoundary;
        }
      }
    }

    if (isLandingPage && !is404Page && !isIndexPage && !shape.popping && !shape.isStatic) {
      pushOutOfUIRects(shape);
    }

    if (isLandingPage && !is404Page && !isIndexPage && !shape.popping && !shape.isStatic) {
      const shapePadding = shape.size * shape.scale * 0.5 + shape.waveAmplitude;
      if (shape.x < shapePadding) { shape.x = shapePadding; shape.vx *= -0.3; }
      if (shape.x > canvasWidth - shapePadding) { shape.x = canvasWidth - shapePadding; shape.vx *= -0.3; }
      if (shape.baseY < shapePadding) { shape.baseY = shapePadding; shape.vy *= -0.3; }
      if (shape.baseY > canvasHeight - shapePadding) { shape.baseY = canvasHeight - shapePadding; shape.vy *= -0.3; }
    }

    shape.time += shape.waveSpeed;
    if (shape.isStatic) {
      shape.y = shape.baseY;
    } else {
      const yDriftWobble = Math.sin(shape.time * 0.8 + shape.wavePhase) * 4 * dpr;
      shape.y = shape.baseY + Math.sin(shape.time + shape.wavePhase) * shape.waveAmplitude + yDriftWobble;
    }
    shape.rotation += shape.rotationSpeed;

    if (shape.popping) {
      const popDuration = 500;
      const elapsed = now - shape.popStart;
      const t = Math.min(elapsed / popDuration, 1);

      if (t < 0.4) {
        const ease1 = easeInOutQuad(t / 0.4);
        shape.scale = 1 + ease1 * 0.1;
        shape.popOpacity = 1;
        shape.shadowScale = 1 + ease1 * 0.1;
      } else {
        const ease2 = easeInOutQuad((t - 0.4) / 0.6);
        shape.scale = 1.1 - ease2 * 1.1;
        shape.popOpacity = 1 - ease2;
        shape.shadowScale = 1.1 - ease2 * 1.1;
      }

      if (t >= 1) {
        continue;
      }
    } else if (shape.spawnTime) {
      const elapsed = now - shape.spawnTime;

      if (shape.is404Animating) {
        if (elapsed < 0) {
          shape.scale = 0;
          shape.spawnOpacity = 0;
          shape.shadowScale = 0;
          shape.y = shape.startY;
        } else {
          const t = Math.min(elapsed / shape.spawnDuration, 1);

          if (t < 0.6) {
            const ease1 = easeInOutQuad(t / 0.6);
            shape.scale = 0.5 + ease1 * 0.6;
            shape.spawnOpacity = 1;
            shape.shadowScale = ease1 * 1.1;
          } else {
            const ease2 = easeInOutQuad((t - 0.6) / 0.4);
            shape.scale = 1.1 - ease2 * 0.1;
            shape.spawnOpacity = 1;
            shape.shadowScale = 1.1 - ease2 * 0.1;
          }

          const easeOut = 1 - Math.pow(1 - t, 3);
          shape.y = shape.startY + (shape.targetY - shape.startY) * easeOut;
          shape.baseY = shape.y;

          if (t >= 1) {
            shape.spawnTime = null;
            shape.scale = 1;
            shape.spawnOpacity = 1;
            shape.shadowScale = 1;
            shape.y = shape.targetY;
            shape.baseY = shape.targetY;
            shape.is404Animating = false;
          }
        }
      } else {
        if (elapsed < 0) {
          shape.scale = 0;
          shape.spawnOpacity = 0;
          shape.shadowScale = 0;
        } else {
          const t = Math.min(elapsed / shape.spawnDuration, 1);
          const easeOut = 1 - Math.pow(1 - t, 3);

          if (t < 0.7) {
            const sub = t / 0.7;
            const ease1 = 1 - Math.pow(1 - sub, 3);
            shape.scale = ease1 * 1.05;
            shape.spawnOpacity = Math.min(sub * 2, 1);
            shape.shadowScale = ease1 * 1.05;
          } else {
            const sub = (t - 0.7) / 0.3;
            const ease2 = easeInOutQuad(sub);
            shape.scale = 1.05 - ease2 * 0.05;
            shape.spawnOpacity = 1;
            shape.shadowScale = 1.05 - ease2 * 0.05;
          }

          if (t >= 1) {
            shape.spawnTime = null;
            shape.scale = 1;
            shape.spawnOpacity = 1;
            shape.shadowScale = 1;
          }
        }
      }
    }

    if (isOutOfBounds(shape)) {
      continue;
    }

    shapes[writeIdx++] = shape;

    const popOpacity = shape.popOpacity !== undefined ? shape.popOpacity : 1;
    const spawnOpacity = shape.spawnOpacity !== undefined ? shape.spawnOpacity : 1;
    const opacity = popOpacity * spawnOpacity;
    const shadowScale = shape.shadowScale !== undefined ? shape.shadowScale : 1;

    const wobble = Math.sin(shape.time * 1.5 + shape.wavePhase * 2) * 1.5 * dpr;

    if (shadowScale > 0) {
      const dist = Math.sqrt(shape.x * shape.x + shape.y * shape.y);
      const shadowDistance = 10 * dpr * shadowScale;
      const shadowOffsetX = dist > 0 ? (shape.x / dist) * shadowDistance : 0;
      const shadowOffsetY = dist > 0 ? (shape.y / dist) * shadowDistance : shadowDistance;
      shadowColorTemp[3] = shadowColor[3] * opacity * shadowScale;
      drawShape(shape, shadowOffsetX, shadowOffsetY + wobble, shadowColorTemp);
    }

    colorTemp[0] = shape.color[0];
    colorTemp[1] = shape.color[1];
    colorTemp[2] = shape.color[2];
    colorTemp[3] = shape.color[3] * opacity;
    color2Temp[0] = shape.color2[0];
    color2Temp[1] = shape.color2[1];
    color2Temp[2] = shape.color2[2];
    color2Temp[3] = shape.color2[3] * opacity;
    drawShape(shape, 0, wobble, colorTemp, color2Temp);
  }
  shapes.length = writeIdx;

  let fragWriteIdx = 0;
  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i];

    frag.x += frag.vx;
    frag.y += frag.vy;
    frag.vy += frag.gravity;
    frag.vx *= 0.98;
    frag.vy *= 0.98;
    frag.rotation += frag.rotationSpeed;
    frag.life -= frag.decay;

    if (frag.life <= 0) {
      continue;
    }

    fragments[fragWriteIdx++] = frag;

    colorTemp[0] = frag.color[0];
    colorTemp[1] = frag.color[1];
    colorTemp[2] = frag.color[2];
    colorTemp[3] = frag.color[3] * frag.life;
    color2Temp[0] = frag.color2[0];
    color2Temp[1] = frag.color2[1];
    color2Temp[2] = frag.color2[2];
    color2Temp[3] = frag.color2[3] * frag.life;
    frag.scale = 1;
    drawShape(frag, 0, 0, colorTemp, color2Temp);
  }
  fragments.length = fragWriteIdx;

  gl.disable(gl.BLEND);

  animFrameId = requestAnimationFrame(render);
  } catch (e) {
    console.error('Render error:', e);
    animFrameId = requestAnimationFrame(render);
  }
}

animFrameId = requestAnimationFrame(render);

const underlineColors = [
  '#F24647', '#46F2B6', '#2F6CE1', '#F2EC46', '#F246D5',
  '#F29C46', '#91F246', '#46E9F2', '#6E46F2'
];
let colorIndex = 0;

function createWigglyPath(segments) {
  segments = segments || 28;
  const step = 100 / segments;
  const amplitude = 3.5;
  const randomness = 0.8;
  let d = `M0,6 Q${step / 2},${6 - amplitude + (Math.random() - 0.5) * randomness} ${step},6`;
  for (let i = 2; i <= segments; i++) {
    const x = i * step;
    const yOffset = (Math.random() - 0.5) * randomness;
    d += ` T${x},${6 + yOffset}`;
  }
  return d;
}

function getSegmentsForLink(link) {
  const width = link.offsetWidth;
  return Math.max(8, Math.round(width / 18));
}

document.querySelectorAll('.project-link').forEach(link => {
  const segments = getSegmentsForLink(link);
  const underline = document.createElement('span');
  underline.className = 'wiggly-underline';
  underline.innerHTML = `<svg viewBox="0 0 100 12" preserveAspectRatio="none"><path d="${createWigglyPath(segments)}" stroke="${underlineColors[colorIndex]}" vector-effect="non-scaling-stroke"/></svg>`;
  link.appendChild(underline);

  link.addEventListener('mouseenter', () => {
    const segs = getSegmentsForLink(link);
    const path = underline.querySelector('path');
    path.setAttribute('d', createWigglyPath(segs));
    path.setAttribute('stroke', underlineColors[colorIndex]);
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    colorIndex = (colorIndex + 1) % underlineColors.length;
  });
});

(function() {
  const track = document.getElementById('jiraCarouselTrack');
  const controls = document.getElementById('jiraCarouselControls');
  if (!track || !controls) return;

  const dots = controls.querySelectorAll('.jira-carousel-dot');
  const slides = track.querySelectorAll('.jira-carousel-slide');
  let currentSlide = 0;
  let autoplayTimer = null;

  var isBouncing = false;

  function bounceEdge(direction) {
    if (isBouncing) return;
    isBouncing = true;
    var offset = direction === 'start' ? 3 : -8;
    var base = currentSlide * 100;
    track.style.transition = 'transform 0.15s ease-out';
    track.style.transform = 'translateX(calc(-' + base + '% + ' + offset + 'px))';
    setTimeout(function() {
      track.style.transition = 'transform 0.25s ease-in';
      track.style.transform = 'translateX(-' + base + '%)';
      setTimeout(function() {
        track.style.transition = 'transform 0.4s ease';
        isBouncing = false;
      }, 250);
    }, 150);
  }

  function goToSlide(index) {
    if (index < 0) {
      bounceEdge('start');
      return;
    }
    if (index >= slides.length) {
      bounceEdge('end');
      return;
    }
    currentSlide = index;
    track.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
    dots.forEach(function(dot, i) {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  dots.forEach(function(dot) {
    dot.addEventListener('click', function() {
      var slideIndex = parseInt(this.getAttribute('data-slide'), 10);
      goToSlide(slideIndex);
      resetAutoplay();
    });
  });

  var startX = 0;
  var isDragging = false;
  var dragOffset = 0;
  var trackWidth = 0;

  function getTrackWidth() {
    return track.parentElement ? track.parentElement.offsetWidth : track.offsetWidth;
  }

  function setDragTransform(pxOffset) {
    var baseOffset = currentSlide * 100;
    track.style.transition = 'none';
    track.style.transform = 'translateX(calc(-' + baseOffset + '% + ' + pxOffset + 'px))';
  }

  function snapToNearest() {
    trackWidth = getTrackWidth();
    var dragPercent = (dragOffset / trackWidth) * 100;
    var targetSlide = currentSlide - Math.round(dragPercent / 100);
    targetSlide = Math.max(0, Math.min(targetSlide, slides.length - 1));
    dragOffset = 0;
    track.style.transition = 'transform 0.35s ease';
    goToSlide(targetSlide);
  }

  track.addEventListener('mousedown', function(e) {
    if (isBouncing) return;
    startX = e.clientX;
    isDragging = true;
    dragOffset = 0;
    track.style.transition = 'none';
    track.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    dragOffset = e.clientX - startX;
    var maxDrag = 30;
    if (currentSlide === 0 && dragOffset > 0) {
      dragOffset = maxDrag * (1 - 1 / (1 + dragOffset / maxDrag));
    }
    if (currentSlide === slides.length - 1 && dragOffset < 0) {
      dragOffset = -maxDrag * (1 - 1 / (1 + Math.abs(dragOffset) / maxDrag));
    }
    setDragTransform(dragOffset);
  });

  document.addEventListener('mouseup', function() {
    if (!isDragging) return;
    isDragging = false;
    track.style.cursor = '';
    snapToNearest();
  });

  track.addEventListener('touchstart', function(e) {
    if (isBouncing) return;
    startX = e.touches[0].clientX;
    isDragging = true;
    dragOffset = 0;
    track.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    dragOffset = e.touches[0].clientX - startX;
    var maxDrag = 30;
    if (currentSlide === 0 && dragOffset > 0) {
      dragOffset = maxDrag * (1 - 1 / (1 + dragOffset / maxDrag));
    }
    if (currentSlide === slides.length - 1 && dragOffset < 0) {
      dragOffset = -maxDrag * (1 - 1 / (1 + Math.abs(dragOffset) / maxDrag));
    }
    setDragTransform(dragOffset);
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (!isDragging) return;
    isDragging = false;
    snapToNearest();
  });

  var wrapper = track.closest('.jira-carousel-wrapper');
  if (wrapper) {
    wrapper.addEventListener('mouseenter', function() {
      wrapper.focus({ preventScroll: true });
    });

    wrapper.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSlide(currentSlide - 1);
        resetAutoplay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToSlide(currentSlide + 1);
        resetAutoplay();
      }
    });
  }

  function startAutoplay() {
  }

  function resetAutoplay() {
  }
})();
