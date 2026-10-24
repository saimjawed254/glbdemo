import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { EnvironmentManager } from './environment.js';
import { DualCameraController } from './controls.js';
import { MiniMap } from './minimap.js';
import { AlignmentManager } from './alignment.js';
import { initAudio, toggleAudio, playUiClick } from './audio.js';
import { TextureGenerator } from './textures.js';

// Pre-generate Ultra-Photorealistic PBR Textures & Tactile Maps
const walnutWoodTex = TextureGenerator.createWalnutWood();
const walnutWoodBump = TextureGenerator.createWoodBump();
const geometricRugTex = TextureGenerator.createGeometricRug();
const geometricRugBump = TextureGenerator.createRugBump();
const leatherTex = TextureGenerator.createLeather();
const leatherBump = TextureGenerator.createLeatherBump();
const linenFabricTex = TextureGenerator.createLinenFabric();
const linenFabricBump = TextureGenerator.createFabricBump();

// ============================================================================
// 1. Core WebGL Setup & Zero-Frame-Drop Engine
// ============================================================================
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Balanced ultra-sharpness without 4K GPU throttling
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02; // Calibrated photorealistic HDR/XDR exposure
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
// Camera near plane 0.15m maximizes 24-bit depth precision and prevents near-clipping
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.15, 450);

// Root Groups
const buildingGroup = new THREE.Group();
const penthouseGroup = new THREE.Group();
scene.add(buildingGroup);
scene.add(penthouseGroup);

// Post-Processing Composer (Lightweight)
const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
const composerRenderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth * pixelRatio,
  window.innerHeight * pixelRatio,
  {
    type: THREE.HalfFloatType,
    samples: 0 // Zero MSAA on post target for smooth 60fps
  }
);
const composer = new EffectComposer(renderer, composerRenderTarget);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.15,  // Subtle architectural luxury bloom
  0.35,  // Radius
  0.92   // High threshold: Only direct sun glints and light fixtures glow
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Environment Manager (IBL, Sun, Sky, Moods)
const envManager = new EnvironmentManager(scene, renderer);

// ============================================================================
// 2. MiniMap HUD Engine
// ============================================================================
let miniMap = null;
miniMap = new MiniMap('minimap-canvas', (targetX, targetZ, roomName) => {
  if (cameraController) {
    if (cameraController.mode !== 'walkthrough') {
      setUIMode('walkthrough');
    }
    cameraController.teleportTo(targetX, targetZ, roomName);
    playUiClick();
  }
});
miniMap.resizeCanvas();

// ============================================================================
// 3. Dual-Camera Controller (Exterior Orbit & Walkthrough FPS)
// ============================================================================
const cameraController = new DualCameraController(camera, canvas, (x, z, lookX, lookZ) => {
  if (miniMap) {
    miniMap.updatePlayer(x, z, lookX, lookZ);
  }
});

// ============================================================================
// 4. Fine-Alignment & Calibration Tool
// ============================================================================
const alignmentManager = new AlignmentManager(
  penthouseGroup,
  buildingGroup,
  cameraController,
  envManager
);

// ============================================================================
// 5. High-Fidelity Asset Loader with Luxury Progress Screen
// ============================================================================
const loaderScreen = document.getElementById('loader-screen');
const loaderFill = document.getElementById('loader-bar-fill');
const loaderStatus = document.getElementById('loader-status');
const loaderPercent = document.getElementById('loader-percent');

// Initialize Web-Optimized GPU Loaders (KTX2 & Meshopt)
const ktx2Loader = new KTX2Loader()
  .setTranscoderPath('/basis/')
  .detectSupport(renderer);

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
gltfLoader.setKTX2Loader(ktx2Loader);

// Tracking for Zero Z-Fighting and Roof Mesh
const buildingOverlapMeshes = [];
const roofMeshes = [];
let penthouseCeilingMesh = null;
let perimeterGroup = null;

// Track load weights: building (~24MB), penthouse (~23MB)
let buildingProgress = 0;
let penthouseProgress = 0;

function updateLoaderUI() {
  // Equal weighting: building = 50%, penthouse = 50%
  const totalPercent = Math.min(Math.round(buildingProgress * 0.5 + penthouseProgress * 0.5), 100);
  if (loaderFill) loaderFill.style.width = `${totalPercent}%`;
  if (loaderPercent) loaderPercent.textContent = `${totalPercent}%`;
}

function optimizeMaterialsAndMeshes(object, isPenthouse = false) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false; // Default off: Only key furniture items cast shadows (eliminates 400+ shadow draw calls!)
      child.receiveShadow = true;
      child.frustumCulled = true;

      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach((mat) => {
          mat.dithering = true;
          const name = (mat.name || '').toLowerCase();

          // ================================================================
          // A. EXTERIOR BUILDING MODEL TUNING (isPenthouse === false)
          // Restores the iconic Mediterranean Navy Blue & Modern Sky-White
          // ================================================================
          if (!isPenthouse) {
            mat.side = THREE.FrontSide;
            mat.depthWrite = true;

            // Deep Mediterranean Architectural Navy Blue facade
            if (name.includes('exwall paint room(1)') || name.includes('blue')) {
              mat.color.setHex(0x0f1d32); // Deep rich navy blue
              mat.roughness = 0.40;
              mat.metalness = 0.04;
              mat.envMapIntensity = 1.0;
              return;
            }

            // Crisp Sky-Tinted White architectural facade
            if (name.includes('exwall paint room') || name.includes('exwall')) {
              mat.color.setHex(0xc8d8e6); // Modern crisp sky-white
              mat.roughness = 0.40;
              mat.metalness = 0.04;
              mat.envMapIntensity = 1.0;
              return;
            }

            // Deep Black exterior window framing and architectural trims
            if (name.includes('black_exterior') || name.includes('ral-9005') || name.includes('deep black')) {
              mat.color.setHex(0x111114);
              mat.roughness = 0.30;
              mat.metalness = 0.85;
              mat.envMapIntensity = 1.4;
              return;
            }

            // Exterior glass
            if (name.includes('glass') || name.includes('glas') || name.includes('vidro')) {
              mat.transparent = true;
              mat.opacity = 0.40;
              mat.color.setHex(0xd0e8ff);
              mat.roughness = 0.05;
              mat.metalness = 0.85;
              mat.envMapIntensity = 2.0;
              mat.depthWrite = false;
              mat.side = THREE.DoubleSide;
              return;
            }

            // Concrete aggregate & stone
            if (name.includes('concrete') || name.includes('screed') || name.includes('concreto')) {
              mat.roughness = 0.65;
              mat.metalness = 0.05;
              mat.envMapIntensity = 0.7;
              return;
            }

            // Keep all other exterior building materials as designed
            return;
          }

          // ================================================================
          // B. PENTHOUSE INTERIOR MODEL TUNING (isPenthouse === true)
          // Ultra-Photorealistic Luxury Architectural Finish
          // ================================================================

          // 1. Hide duplicate CAD structural wall core
          if (name.includes('default wall') || name.includes('default_wall')) {
            child.visible = false;
            mat.visible = false;
            return;
          }

          // 2. Interior Walls: Tactile Luxury Venetian Drywall Plaster
          // Natural photographic texture + micro-relief normal + satin eggshell sheen (NOT flat, NO moire)
          if (name.includes('plaster') || name.includes('wall') || name.includes('paint') || name.includes('branco')) {
            child.castShadow = false; // Eliminates shadow acne moire
            child.receiveShadow = true; // Soft natural shadow falloff from fixtures & windows

            // Preserve natural diffuse plaster map if present
            if (mat.map) {
              mat.color.setHex(0xfbf8f3); // Subtle warm luxury tint
            } else {
              mat.color.setHex(0xf5f1ea); // Warm Venetian cream drywall
            }

            // Calibrate micro-normal map: subtle tactile plaster texture without high-frequency moire
            if (mat.normalMap) {
              mat.normalScale.set(0.08, 0.08); // Tactile micro-grain without distance moire
            }

            // Satin eggshell sheen: catches soft ambient highlights from fixtures & windows (NOT flat!)
            mat.roughness = 0.52;
            mat.metalness = 0.0;
            mat.envMapIntensity = 0.60;
            mat.side = THREE.FrontSide;
            mat.depthWrite = true;
            mat.needsUpdate = true;
            return;
          }

          // 3. Chandeliers, Pendants & Sconces: Radiant Self-Illumination Glow
          if (name.includes('ilumina') || name.includes('pendente') || name.includes('luz') || name.includes('lamp') || name.includes('light fixture')) {
            child.castShadow = false;
            mat.color.setHex(0xfffaee);
            mat.emissive.setHex(0xffe8c8); // Warm luxury chandelier glow
            mat.emissiveIntensity = 2.4;
            mat.roughness = 0.20;
            mat.metalness = 0.10;
            mat.needsUpdate = true;
            return;
          }

          // 4. Doors: Rich Dark Espresso Walnut & Dark Metal Hardware (Matching reference)
          if (name.includes('door')) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (name.includes('handle')) {
              mat.color.setHex(0x1a1a1a);
              mat.roughness = 0.20;
              mat.metalness = 0.90;
              mat.envMapIntensity = 1.8;
            } else {
              // Frame, panel, architrave: Deep dark espresso walnut wood with satin sheen
              mat.color.setHex(0x281d16);
              mat.roughness = 0.35;
              mat.metalness = 0.04;
              mat.envMapIntensity = 1.1;
            }
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
            return;
          }

          // 5. Windows: Crisp Modern White Sash & Clear Architectural Glazing
          if (name.includes('window frame') || name.includes('window_frame') || (name.includes('frame') && !name.includes('light') && !name.includes('door'))) {
            child.castShadow = true;
            child.receiveShadow = true;
            mat.color.setHex(0xf4f4f4); // Crisp modern white window sash
            mat.roughness = 0.26;
            mat.metalness = 0.05;
            mat.envMapIntensity = 1.2;
            mat.side = THREE.FrontSide;
            return;
          }

          if (name.includes('glass') || name.includes('glas') || name.includes('vidro') || name.includes('cristal')) {
            mat.transparent = true;
            mat.opacity = 0.28;
            mat.color.setHex(0xffffff);
            mat.roughness = 0.02;
            mat.metalness = 0.15;
            mat.envMapIntensity = 2.4;
            mat.depthWrite = false;
            mat.side = THREE.DoubleSide;
            return;
          }

          // 6. Luxury Dining Table & Wooden Furniture: Grained Walnut Wood & Specular Relief
          if (name.includes('dinig') || name.includes('dining table') || (name.includes('madeira') && !name.includes('floor') && !name.includes('cabide') && !name.includes('vaso')) || name.includes('melamina wengue') || name.includes('mdf alabama')) {
            child.castShadow = true;
            child.receiveShadow = true;
            mat.map = walnutWoodTex;
            mat.bumpMap = walnutWoodBump;
            mat.bumpScale = 0.035; // Physical wood pore and grain relief
            mat.color.setHex(0xffffff); // Crisp wood grain reproduction
            mat.roughness = 0.28; // Polished luxury oiled walnut sheen
            mat.metalness = 0.04;
            mat.envMapIntensity = 1.35;
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
            return;
          }

          // 7. Area Rug: Scandinavian Geometric Modern Plush Wool / Fur Weave
          // (Matching reference high-pile geometric rug under the dining table)
          if (name.includes('carpet') || name.includes('tapete') || name.includes('rug')) {
            child.castShadow = false;
            child.receiveShadow = true;
            mat.map = geometricRugTex;
            mat.bumpMap = geometricRugBump;
            mat.bumpScale = 0.12; // Deep tactile high-pile plush wool/fur texture
            mat.color.setHex(0xffffff);
            mat.roughness = 0.94; // Matte luxury wool finish
            mat.metalness = 0.0;
            mat.envMapIntensity = 0.35;
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
            return;
          }

          // 8. Dining Chairs & Bespoke Sofa: Italian Pebbled Top-Grain Leather
          if (name.includes('leather') || name.includes('couro')) {
            child.castShadow = true;
            child.receiveShadow = true;
            mat.map = leatherTex;
            mat.bumpMap = leatherBump;
            mat.bumpScale = 0.05; // Pebbled leather grain relief
            mat.color.setHex(0xffffff);
            mat.roughness = 0.34; // Supple semi-gloss leather reflection
            mat.metalness = 0.05;
            mat.envMapIntensity = 1.25;
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
            return;
          }

          // 9. Sofa Cushions & Upholstery: Textured Woven Bouclé / Linen Fabric
          if (((name.includes('tela') && !name.includes('quadro')) || name.includes('cloth') || name.includes('lino') || name.includes('tecido') || name.includes('fabric')) && !name.includes('leather')) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (!mat.map) {
              mat.map = linenFabricTex;
            }
            mat.bumpMap = linenFabricBump;
            mat.bumpScale = 0.06; // Fine woven textile bump
            mat.roughness = 0.76;
            mat.metalness = 0.0;
            mat.envMapIntensity = 0.45;
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
            return;
          }

          // 10. Ceramic & Porcelain Vases on Table: Artisan Glaze & Specular Reflections
          if (name.includes('vaso') || name.includes('porcelain') || name.includes('ceramica') || name.includes('cerâmica')) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (!mat.map) {
              mat.color.setHex(0xfbfaf7); // Artisan off-white porcelain
            }
            mat.roughness = 0.14; // Glossy glazed ceramic
            mat.metalness = 0.05;
            mat.envMapIntensity = 1.80; // High specular reflections
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
            return;
          }

          // 11. Art Gallery Paintings on the Walls: Fine Canvas Sheen
          if (name.includes('quadro') || (name.includes('tela') && name.includes('quadro')) || name.includes('canvas')) {
            child.castShadow = false;
            child.receiveShadow = true;
            mat.roughness = 0.35;
            mat.metalness = 0.04;
            mat.envMapIntensity = 0.9;
            mat.side = THREE.FrontSide;
            return;
          }

          // 12. Wood Parquet Flooring: Warm Honey Oak with Satin Reflections
          if (name.includes('floor') || name.includes('parquet') || name.includes('oak')) {
            child.castShadow = false;
            child.receiveShadow = true;
            mat.roughness = 0.24; // Satin floor finish with soft window reflections
            mat.metalness = 0.04;
            mat.envMapIntensity = 1.25;
            mat.side = THREE.FrontSide;
            return;
          }

          // 13. Polished Marble & Stone
          if (name.includes('marble') || name.includes('marmol') || name.includes('granite') || name.includes('stone') || name.includes('tile')) {
            child.castShadow = false;
            child.receiveShadow = true;
            mat.roughness = 0.16;
            mat.metalness = 0.08;
            mat.envMapIntensity = 1.3;
            mat.side = THREE.FrontSide;
            return;
          }

          // 14. Polished Architectural Metals (Gold, Chrome, Brass, Steel)
          if (name.includes('metal') || name.includes('gold') || name.includes('chrome') || name.includes('brass') || name.includes('steel')) {
            child.castShadow = true;
            child.receiveShadow = true;
            mat.roughness = 0.22;
            mat.metalness = 0.88;
            mat.envMapIntensity = 1.6;
            return;
          }

          // Fallback PBR settings
          mat.depthWrite = true;
          mat.side = THREE.FrontSide;
          if (mat.roughness !== undefined && mat.roughness < 0.15) {
            mat.roughness = 0.30;
          }
          if (mat.envMapIntensity !== undefined) {
            mat.envMapIntensity = 0.85;
          }
        });
      }
    }
  });
}

// Load Models Asynchronously
async function loadModels() {
  try {
    loaderStatus.textContent = 'Streaming Building Architecture (24 MB)...';

    // 1. Load Apartment Model (Building)
    const buildingGltf = await new Promise((resolve, reject) => {
      gltfLoader.load(
        '/Apartment%20model.glb',
        (gltf) => {
          buildingProgress = 100;
          updateLoaderUI();
          resolve(gltf);
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            buildingProgress = (xhr.loaded / xhr.total) * 100;
            updateLoaderUI();
          }
        },
        reject
      );
    });

    // Identify overlapping level 11 meshes of the apartment building using world coordinates
    buildingGltf.scene.updateMatrixWorld(true);
    buildingGltf.scene.traverse((child) => {
      if (child.isMesh) {
        const mat = child.material;
        const matName = mat ? (Array.isArray(mat) ? mat.map(m=>m.name).join(' ') : mat.name) : '';
        const worldBox = new THREE.Box3().setFromObject(child);
        // All building meshes at level 11 (floors/walls/roof) that would Z-fight with penthouse
        if (worldBox.max.y > 28.5) {
          buildingOverlapMeshes.push(child);
        }
        if (matName.toLowerCase().includes('roof') || worldBox.max.y > 33.2) {
          roofMeshes.push(child);
        }
      }
    });

    optimizeMaterialsAndMeshes(buildingGltf.scene, false);
    buildingGroup.add(buildingGltf.scene);

    loaderStatus.textContent = 'Streaming Web-Optimized Penthouse (47 MB KTX2)...';

    // 2. Load Web-Optimized Penthouse Model (KTX2 + Meshopt)
    const penthouseGltf = await new Promise((resolve, reject) => {
      gltfLoader.load(
        '/penthouse_web.glb',
        (gltf) => {
          penthouseProgress = 100;
          updateLoaderUI();
          resolve(gltf);
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            penthouseProgress = (xhr.loaded / xhr.total) * 100;
            updateLoaderUI();
          }
        },
        reject
      );
    });

    optimizeMaterialsAndMeshes(penthouseGltf.scene, true);
    penthouseGroup.add(penthouseGltf.scene);

    // Compute bounding box of penthouse interior
    penthouseGltf.scene.updateMatrixWorld(true);
    const pBox = new THREE.Box3().setFromObject(penthouseGltf.scene);
    const pSize = pBox.getSize(new THREE.Vector3());
    const pCenter = pBox.getCenter(new THREE.Vector3());

    console.log('Optimized Interior Bounding Box:', {
      min: pBox.min.toArray().map(v => Number(v.toFixed(2))),
      max: pBox.max.toArray().map(v => Number(v.toFixed(2))),
      size: pSize.toArray().map(v => Number(v.toFixed(2)))
    });

    // 3. Build Smooth Architectural Radiant Matte Plaster Ceiling
    // Crisp, radiant warm off-white luxury drywall matching reference living room
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0xfcfbf9, // Crisp warm white luxury drywall plaster
      emissive: 0xf6ede2, // Subtle warm indirect bounce light so ceiling is bright and luminous
      emissiveIntensity: 0.38,
      roughness: 0.92,
      metalness: 0.0,
      dithering: true,
      side: THREE.DoubleSide
    });
    ceilingMaterial.name = 'Penthouse_Interior_Ceiling_Material';

    // Create solid architectural ceiling slab covering penthouse footprint
    const sizeX = (pSize && pSize.x > 0) ? pSize.x + 0.6 : 31.2;
    const sizeZ = (pSize && pSize.z > 0) ? pSize.z + 0.6 : 28.2;
    const posX = (pCenter && !isNaN(pCenter.x)) ? pCenter.x : 20.35;
    const posZ = (pCenter && !isNaN(pCenter.z)) ? pCenter.z : 9.83;

    const ceilingGeometry = new THREE.BoxGeometry(sizeX, 0.25, sizeZ);
    penthouseCeilingMesh = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    penthouseCeilingMesh.name = 'Penthouse_Interior_Ceiling';
    penthouseCeilingMesh.position.set(posX, 33.22, posZ);
    penthouseCeilingMesh.castShadow = false; // Allows sun and natural light to stream in and cast crisp interior shadows
    penthouseCeilingMesh.receiveShadow = true;
    penthouseGroup.add(penthouseCeilingMesh);

    // 4. Build Architectural Surrounding Perimeter Walls for Penthouse Floor
    perimeterGroup = new THREE.Group();
    perimeterGroup.name = 'Penthouse_Surrounding_Walls';

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf5f1ea, // Exact Venetian cream plaster matching interior walls
      roughness: 0.52, // Satin eggshell sheen (NOT flat)
      metalness: 0.0,
      dithering: true,
      side: THREE.FrontSide
    });

    const glassBalconyMat = new THREE.MeshStandardMaterial({
      color: 0x99ccee,
      roughness: 0.05,
      metalness: 0.85,
      transparent: true,
      opacity: 0.40,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const handrailMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e1e,
      roughness: 0.25,
      metalness: 0.90
    });

    // Floor elevation: 30.20, Ceiling: 33.22, Height: 3.02m
    const wallY = 30.20 + 3.02 / 2; // 31.71m center
    const wallH = 3.02;
    const wallThick = 0.22;

    // North Perimeter Wall (Z = -3.70, covers entire Master Suite & Foyer north edge from X: 5.35 to 35.35)
    const northGeo = new THREE.BoxGeometry(30.0 + wallThick, wallH, wallThick);
    const northWall = new THREE.Mesh(northGeo, wallMat);
    northWall.position.set(20.35, wallY, -3.70);
    northWall.receiveShadow = true;
    perimeterGroup.add(northWall);

    // East Perimeter Wall (X = 35.35, covers Master Suite & Dining east edge from Z: -3.70 to 23.35)
    const eastGeo = new THREE.BoxGeometry(wallThick, wallH, 27.0 + wallThick);
    const eastWall = new THREE.Mesh(eastGeo, wallMat);
    eastWall.position.set(35.35, wallY, 9.83);
    eastWall.receiveShadow = true;
    perimeterGroup.add(eastWall);

    // West Perimeter Wall (solid north half from Z: -3.70 to 12.0)
    const westNorthGeo = new THREE.BoxGeometry(wallThick, wallH, 15.7);
    const westNorthWall = new THREE.Mesh(westNorthGeo, wallMat);
    westNorthWall.position.set(5.35, wallY, 4.15);
    westNorthWall.receiveShadow = true;
    perimeterGroup.add(westNorthWall);

    // South Perimeter Wall (solid east half from X: 16.0 to 35.35)
    const southEastGeo = new THREE.BoxGeometry(19.35, wallH, wallThick);
    const southEastWall = new THREE.Mesh(southEastGeo, wallMat);
    southEastWall.position.set(25.68, wallY, 23.35);
    southEastWall.receiveShadow = true;
    perimeterGroup.add(southEastWall);

    // Panoramic Sky Balcony Enclosure (Safety glass & luxury dark bronze handrail)
    // West terrace glass railing: X = 5.35, Z: 12.0 to 23.35 (length 11.35m, height 1.30m)
    const glassH = 1.30;
    const glassY = 30.20 + glassH / 2;
    const westGlassGeo = new THREE.BoxGeometry(0.06, glassH, 11.35);
    const westGlass = new THREE.Mesh(westGlassGeo, glassBalconyMat);
    westGlass.position.set(5.35, glassY, 17.67);
    perimeterGroup.add(westGlass);

    const westRailGeo = new THREE.BoxGeometry(0.12, 0.08, 11.35);
    const westRail = new THREE.Mesh(westRailGeo, handrailMat);
    westRail.position.set(5.35, 30.20 + glassH, 17.67);
    perimeterGroup.add(westRail);

    // South terrace glass railing: Z = 23.35, X: 5.35 to 16.0 (length 10.65m, height 1.30m)
    const southGlassGeo = new THREE.BoxGeometry(10.65, glassH, 0.06);
    const southGlass = new THREE.Mesh(southGlassGeo, glassBalconyMat);
    southGlass.position.set(10.68, glassY, 23.35);
    perimeterGroup.add(southGlass);

    const southRailGeo = new THREE.BoxGeometry(10.65, 0.08, 0.12);
    const southRail = new THREE.Mesh(southRailGeo, handrailMat);
    southRail.position.set(10.68, 30.20 + glassH, 23.35);
    perimeterGroup.add(southRail);

    penthouseGroup.add(perimeterGroup);

    // Register all roof & ceiling meshes with AlignmentManager
    alignmentManager.setRoofMeshes([...roofMeshes, penthouseCeilingMesh]);

    // Apply any initial saved alignment offsets
    alignmentManager.applyTransform();

    // Initial Mode Visibility: When in exterior mode with Roof ON, hide interior to prevent zoom Z-fighting
    if (alignmentManager.state.roofVis && cameraController.mode === 'exterior') {
      buildingOverlapMeshes.forEach(m => { m.visible = true; });
      penthouseGroup.visible = false;
    }

    loaderStatus.textContent = 'Compiling PBR Shaders & Finalizing Scene...';
    if (loaderPercent) loaderPercent.textContent = '100%';
    if (loaderFill) loaderFill.style.width = '100%';

    // Dismiss loader screen with smooth fade
    setTimeout(() => {
      if (loaderScreen) loaderScreen.classList.add('fade-out');
    }, 600);

  } catch (err) {
    console.error('Error loading 3D assets:', err);
    if (loaderStatus) {
      loaderStatus.textContent = `Asset load error: ${err.message || 'Check console'}`;
      loaderStatus.style.color = '#ff6b6b';
    }
  }
}

loadModels();

// ============================================================================
// 6. UI Navigation & Mode Switching
// ============================================================================
const btnModeExterior = document.getElementById('btn-mode-exterior');
const btnModeWalkthrough = document.getElementById('btn-mode-walkthrough');
const hintExterior = document.getElementById('hint-exterior');
const hintWalkthrough = document.getElementById('hint-walkthrough');
const btnEnterPenthouseQuick = document.getElementById('btn-enter-penthouse-quick');
const btnExitToExteriorQuick = document.getElementById('btn-exit-to-exterior-quick');

const btnToggleRoof = document.getElementById('btn-toggle-roof');
const roofLabel = document.getElementById('roof-label');

btnToggleRoof?.addEventListener('click', () => {
  const newVis = !alignmentManager.state.roofVis;
  alignmentManager.setRoofVisibility(newVis);
  if (cameraController.mode === 'exterior') {
    if (newVis) {
      buildingOverlapMeshes.forEach(m => { m.visible = true; });
      penthouseGroup.visible = false;
    } else {
      buildingOverlapMeshes.forEach(m => { m.visible = false; });
      penthouseGroup.visible = true;
      if (penthouseCeilingMesh) penthouseCeilingMesh.visible = false;
      if (perimeterGroup) perimeterGroup.visible = true;
    }
  }
  playUiClick();
});

function setUIMode(targetMode) {
  if (targetMode === 'walkthrough') {
    btnModeExterior?.classList.remove('active');
    btnModeWalkthrough?.classList.add('active');
    hintExterior?.classList.add('hidden');
    hintWalkthrough?.classList.remove('hidden');
    
    // In walkthrough mode: Hide overlapping building level 11 geometry to ELIMINATE Z-fighting!
    buildingOverlapMeshes.forEach(m => { m.visible = false; });
    // Ensure penthouse interior, ceiling, and surrounding perimeter walls are visible
    penthouseGroup.visible = true;
    if (penthouseCeilingMesh) penthouseCeilingMesh.visible = true;
    if (perimeterGroup) perimeterGroup.visible = true;
    
    cameraController.setMode('walkthrough');
  } else {
    btnModeWalkthrough?.classList.remove('active');
    btnModeExterior?.classList.add('active');
    hintWalkthrough?.classList.add('hidden');
    hintExterior?.classList.remove('hidden');

    // In exterior view:
    // If Roof is ON: Show full exterior building, HIDE penthouse interior so they don't Z-fight on zoom!
    if (alignmentManager.state.roofVis) {
      buildingOverlapMeshes.forEach(m => { m.visible = true; });
      penthouseGroup.visible = false;
    } else {
      // Cutaway dollhouse mode: Show penthouse, hide roof
      buildingOverlapMeshes.forEach(m => { m.visible = false; });
      penthouseGroup.visible = true;
      if (penthouseCeilingMesh) penthouseCeilingMesh.visible = false;
      if (perimeterGroup) perimeterGroup.visible = true;
    }
    cameraController.setMode('exterior');
  }
  playUiClick();
}

btnModeExterior?.addEventListener('click', () => setUIMode('exterior'));
btnModeWalkthrough?.addEventListener('click', () => setUIMode('walkthrough'));
btnEnterPenthouseQuick?.addEventListener('click', () => setUIMode('walkthrough'));
btnExitToExteriorQuick?.addEventListener('click', () => setUIMode('exterior'));

// Lighting Preset Switcher Button
const btnLighting = document.getElementById('btn-lighting');
const lightingLabel = document.getElementById('lighting-label');
btnLighting?.addEventListener('click', () => {
  const p = envManager.nextPreset();
  if (lightingLabel) lightingLabel.textContent = p.name;
  playUiClick();
});

// Audio Atmosphere Toggle Button
const btnSound = document.getElementById('btn-sound');
const soundIconOn = document.getElementById('sound-icon-on');
const soundIconOff = document.getElementById('sound-icon-off');
btnSound?.addEventListener('click', () => {
  const isPlaying = toggleAudio();
  if (isPlaying) {
    soundIconOn?.classList.remove('hidden');
    soundIconOff?.classList.add('hidden');
  } else {
    soundIconOn?.classList.add('hidden');
    soundIconOff?.classList.remove('hidden');
  }
  playUiClick();
});

// ============================================================================
// 7. Zero Frame Drop Performance Monitor
// ============================================================================
const fpsDisplay = document.getElementById('fps-display');
let frameCount = 0;
let lastFpsTime = performance.now();
let lastTime = performance.now();

// Adaptive resolution scaler to prevent frame drops
let lowFpsStreak = 0;

function updatePerformanceMonitor(now) {
  frameCount++;
  if (now - lastFpsTime >= 1000) {
    const currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    if (fpsDisplay) fpsDisplay.textContent = `${currentFps} FPS`;

    // Dynamic resolution protection for silky smooth performance
    if (currentFps < 45) {
      lowFpsStreak++;
      if (lowFpsStreak > 2 && renderer.getPixelRatio() > 1.0) {
        renderer.setPixelRatio(1.0);
        const resEl = document.getElementById('resolution-display');
        if (resEl) resEl.textContent = 'BALANCED';
      }
    } else {
      lowFpsStreak = 0;
    }

    frameCount = 0;
    lastFpsTime = now;
  }
}

// ============================================================================
// 8. Main Render Loop
// ============================================================================
function animate(currentTime) {
  requestAnimationFrame(animate);

  const delta = Math.min((currentTime - lastTime) / 1000, 0.1); // clamp delta to prevent physics jumps
  lastTime = currentTime;

  // Update Camera & Controls
  cameraController.update(delta);

  // Render MiniMap HUD
  if (miniMap) {
    miniMap.render(currentTime);
  }

  // Render 3D Scene directly with native MSAA & ACES Filmic tone mapping (60 FPS smooth)
  renderer.render(scene, camera);

  // Update Performance HUD
  updatePerformanceMonitor(currentTime);
}

requestAnimationFrame(animate);

// ============================================================================
// 9. Window Resize Handling
// ============================================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  composer.setSize(window.innerWidth, window.innerHeight);
  if (miniMap) miniMap.resizeCanvas();
});
