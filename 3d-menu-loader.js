import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


let isMenuActive = true;
let animationFrameId = null;
let isLaunching = false;
let launchSpeed = 0;
let startPivotRef = null;

function init3DMenu() {
  console.log("...");
  const container = document.getElementById('modelContainer');
  if (!container) {
    console.error('modelContainer element not found in DOM');
    return;
  }

  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #C9A04A;
        font-family: 'Orbitron', sans-serif;
        font-size: 20px;
        text-align: center;
        z-index: 100;
        text-shadow: 0 0 10px #C9A04A;
        pointer-events: none;
    `;
  loadingDiv.innerHTML = 'INITIALIZING SYSTEM...<br><span style="font-size: 14px;">0%</span>';
  container.appendChild(loadingDiv);
  container.style.position = 'relative';

  // --- Scene Setup ---
  const scene = new THREE.Scene();

  // Create a pivot group to handle the spinning independently of the model's orientation
  const startPivot = new THREE.Group();
  scene.add(startPivot);
  startPivotRef = startPivot; // Store reference for launch animation

  // Camera
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.set(0, 0, 7);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // --- Lighting ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const blueLight = new THREE.PointLight(0xC9A04A, 3, 20);
  blueLight.position.set(-2, 2, 2);
  scene.add(blueLight);

  // --- Model Loading ---
  const loader = new GLTFLoader();

  console.log("Attempting to load: img/3D.glb");

  loader.load(
    'img/3D.glb',
    (gltf) => {
      console.log("Model loaded successfully!");
      const model = gltf.scene;
      loadingDiv.remove();

      // Auto-Scaling
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      if (maxDim > 0) {
        const scale = 3.8 / maxDim;
        model.scale.set(scale, scale, scale);
      }

      // Re-centering
      const newBox = new THREE.Box3().setFromObject(model);
      const center = newBox.getCenter(new THREE.Vector3());
      model.position.sub(center);

      // ORIENTATION CORRECTION
      model.rotation.x = -Math.PI / 2;
      model.rotation.z = Math.PI;

      // Add the oriented model to the pivot group
      startPivot.add(model);
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        const span = loadingDiv.querySelector('span');
        if (span) span.textContent = percent + '%';
      }
    },
    (error) => {
      console.error('Error loading model:', error);
      loadingDiv.innerHTML = 'ERROR<br><span style="font-size:12px; color:red">Check Console (F12)</span>';

      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
      const cube = new THREE.Mesh(geometry, material);
      startPivot.add(cube);
    }
  );

  // --- Animation Loop ---
  function animate() {
    if (!isMenuActive && !isLaunching) {
      animationFrameId = null;
      return;
    }

    animationFrameId = requestAnimationFrame(animate);

    if (isLaunching) {
      // LAUNCH MODE: Fly upward at accelerating speed
      launchSpeed += 0.015; // Acceleration
      startPivot.position.y += launchSpeed;

      // Straighten the ship during launch (reduce banking)
      startPivot.rotation.y *= 0.95;
      startPivot.rotation.z *= 0.95;

      // Check if ship is out of view (Y > 15 is well off screen)
      if (startPivot.position.y > 15) {
        console.log("Ship has left the screen!");
        isLaunching = false;
        isMenuActive = false;

        // Trigger callback if set
        if (window._onLaunchComplete) {
          window._onLaunchComplete();
        }
        return;
      }
    } else {
      // NORMAL MODE: Oscillate (Roll/Bank) Left and Right
      startPivot.rotation.y = Math.sin(Date.now() * 0.0015) * (Math.PI / 6);
      // Gentle float with UPWARD offset (0.5)
      startPivot.position.y = 0.5 + (Math.sin(Date.now() * 0.001) * 0.1);
    }

    renderer.render(scene, camera);
  }

  window._menu3DAnimate = animate;
  animate();

  // --- Resize Handler ---
  window.addEventListener('resize', () => {
    if (!container || (!isMenuActive && !isLaunching)) return;
    const newAspect = container.clientWidth / container.clientHeight;
    camera.aspect = newAspect;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

// === GLOBAL PAUSE/RESUME FUNCTIONS ===

window.pauseMenu3D = function () {
  isMenuActive = false;
  console.log("3D Menu rendering PAUSED");

  const mainTitle = document.querySelector('.main-title');
  const bgTiles = document.querySelectorAll('.bg-tile');

  if (mainTitle) {
    mainTitle.style.animationPlayState = 'paused';
  }
  bgTiles.forEach(tile => {
    tile.style.animationPlayState = 'paused';
  });
};

window.resumeMenu3D = function () {
  isMenuActive = true;
  isLaunching = false;
  launchSpeed = 0;

  // Reset ship position
  if (startPivotRef) {
    startPivotRef.position.y = 0.5;
    startPivotRef.rotation.y = 0;
  }

  console.log("3D Menu rendering RESUMED");

  const mainTitle = document.querySelector('.main-title');
  const bgTiles = document.querySelectorAll('.bg-tile');

  if (mainTitle) {
    mainTitle.style.animationPlayState = 'running';
  }
  bgTiles.forEach(tile => {
    tile.style.animationPlayState = 'running';
  });

  if (animationFrameId === null && window._menu3DAnimate) {
    window._menu3DAnimate();
  }
};

// === LAUNCH SHIP ANIMATION ===
// Call this to make the ship fly off screen, then execute callback
window.launchShip = function (onComplete) {
  console.log("LAUNCHING SHIP!");
  isLaunching = true;
  launchSpeed = 0.05; // Initial speed
  window._onLaunchComplete = onComplete;

  // Ensure animation loop is running
  if (animationFrameId === null && window._menu3DAnimate) {
    window._menu3DAnimate();
  }
};

// Start
init3DMenu();
