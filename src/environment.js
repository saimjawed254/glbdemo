import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export class EnvironmentManager {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.rgbeLoader = new RGBELoader();
    this.hdrCache = new Map();

    this.currentPresetIndex = 0;
    this.presets = [
      {
        name: 'GOLDEN HOUR',
        hdrPath: '/hdr/golden_hour.hdr',
        bgTop: '#1b2234',
        bgMid: '#5c433b',
        bgBottom: '#0b0d12',
        sunColor: 0xffd8b0,
        sunIntensity: 2.2,
        sunPosition: new THREE.Vector3(50, 42, 60),
        hemiSky: 0xffeedd,
        hemiGround: 0x3a2e28,
        hemiIntensity: 0.35,
        exposure: 0.92,
        fogColor: 0x16131c,
        fogDensity: 0.0012,
        interiorWarmth: 1.0
      },
      {
        name: 'DAYLIGHT STUDIO',
        hdrPath: '/hdr/city_daylight.hdr',
        bgTop: '#3a5f8a',
        bgMid: '#a8c6e2',
        bgBottom: '#101721',
        sunColor: 0xfff6ec,
        sunIntensity: 2.0,
        sunPosition: new THREE.Vector3(45, 65, 40),
        hemiSky: 0xddeeff,
        hemiGround: 0x2e3540,
        hemiIntensity: 0.38,
        exposure: 0.90,
        fogColor: 0x1c2838,
        fogDensity: 0.0008,
        interiorWarmth: 0.8
      },
      {
        name: 'TWILIGHT LUXURY',
        hdrPath: null,
        bgTop: '#090d18',
        bgMid: '#161d2d',
        bgBottom: '#06070a',
        sunColor: 0xff8c55,
        sunIntensity: 1.4,
        sunPosition: new THREE.Vector3(30, 20, -50),
        hemiSky: 0x5a4066,
        hemiGround: 0x1a1520,
        hemiIntensity: 0.25,
        exposure: 0.95,
        fogColor: 0x0a0f18,
        fogDensity: 0.0018,
        interiorWarmth: 1.2
      }
    ];

    this.interiorLights = [];
    this.initLights();
    this.applyPreset(0);
  }

  initLights() {
    // 1. Directional Sun Light focused directly on Penthouse
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 120;
    
    // Shadow frustum tightly covering the penthouse and roof
    const d = 26;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 2.0;

    // Target the center of the penthouse (X ~ 20.35, Y ~ 31.55, Z ~ 9.83)
    this.sunLightTarget = new THREE.Object3D();
    this.sunLightTarget.position.set(20.35, 31.55, 9.83);
    this.scene.add(this.sunLightTarget);
    this.sunLight.target = this.sunLightTarget;

    this.scene.add(this.sunLight);

    // 2. Soft Architectural Skylight
    this.hemiLight = new THREE.HemisphereLight(0xffeedd, 0x3a2e28, 0.35);
    this.hemiLight.position.set(0, 80, 0);
    this.scene.add(this.hemiLight);

    // 3. Upward Floor-to-Ceiling Architectural Indirect Bounce Light (Makes ceiling luminous and clean)
    this.ceilingBounceLight = new THREE.HemisphereLight(0xfff5ea, 0x222222, 0.40);
    this.ceilingBounceLight.position.set(20.35, 29.5, 9.83);
    this.scene.add(this.ceilingBounceLight);

    // 4. Warm Ambient Interior Fill (Preserves rich darks without clipping)
    this.ambientLight = new THREE.AmbientLight(0xfff4e6, 0.20);
    this.scene.add(this.ambientLight);

    // 5. Dedicated Warm Penthouse Interior Accent Lights
    const interiorPositions = [
      new THREE.Vector3(10.5, 32.2, 3.5),   // Grand Foyer
      new THREE.Vector3(21.0, 32.2, 4.5),   // Grand Living & Dining Salon
      new THREE.Vector3(22.0, 32.2, 14.0),  // Gourmet Kitchen & Bar
      new THREE.Vector3(30.5, 32.2, 3.5),   // Master Penthouse Suite
      new THREE.Vector3(9.5, 32.2, 17.5)    // Panoramic Sky Terrace
    ];

    interiorPositions.forEach((pos) => {
      const pLight = new THREE.PointLight(0xffecd2, 0.60, 12, 1.8);
      pLight.position.copy(pos);
      pLight.castShadow = false;
      this.scene.add(pLight);
    });

    // 6. Exponential Fog for atmospheric depth
    this.scene.fog = new THREE.FogExp2(0x101520, 0.0016);
  }

  createProceduralSkyTexture(preset) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, preset.bgTop);
    grad.addColorStop(0.48, preset.bgMid);
    grad.addColorStop(0.52, preset.bgBottom);
    grad.addColorStop(1, preset.bgBottom);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle horizon glow
    const radial = ctx.createRadialGradient(
      canvas.width * 0.45, canvas.height * 0.48, 5,
      canvas.width * 0.45, canvas.height * 0.48, canvas.width * 0.5
    );
    radial.addColorStop(0, 'rgba(255, 230, 190, 0.35)');
    radial.addColorStop(0.5, 'rgba(255, 180, 120, 0.12)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  applyPreset(index) {
    this.currentPresetIndex = index % this.presets.length;
    const p = this.presets[this.currentPresetIndex];

    // Ultra HDR Environment Lighting (IBL) & Background
    if (p.hdrPath) {
      if (this.hdrCache.has(p.hdrPath)) {
        const { hdrTexture, envMap } = this.hdrCache.get(p.hdrPath);
        this.scene.background = hdrTexture;
        this.scene.environment = envMap;
        this.scene.backgroundBlurriness = 0.04;
        this.scene.environmentIntensity = 0.55;
      } else {
        // Fallback procedural sky immediately while streaming HDR
        const skyTexture = this.createProceduralSkyTexture(p);
        this.scene.background = skyTexture;
        this.scene.environment = this.pmremGenerator.fromEquirectangular(skyTexture).texture;
        
        this.rgbeLoader.load(p.hdrPath, (hdrTexture) => {
          hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
          const envMap = this.pmremGenerator.fromEquirectangular(hdrTexture).texture;
          this.hdrCache.set(p.hdrPath, { hdrTexture, envMap });
          
          // Apply if this preset is still active
          if (this.presets[this.currentPresetIndex].name === p.name) {
            this.scene.background = hdrTexture;
            this.scene.environment = envMap;
            this.scene.backgroundBlurriness = 0.04;
            this.scene.environmentIntensity = 0.55;
          }
        });
      }
    } else {
      const skyTexture = this.createProceduralSkyTexture(p);
      const envMap = this.pmremGenerator.fromEquirectangular(skyTexture).texture;
      this.scene.background = skyTexture;
      this.scene.environment = envMap;
      this.scene.backgroundBlurriness = 0.0;
      this.scene.environmentIntensity = 0.50;
    }

    // Sun
    this.sunLight.color.setHex(p.sunColor);
    this.sunLight.intensity = p.sunIntensity;
    this.sunLight.position.copy(p.sunPosition);

    // Hemisphere
    this.hemiLight.color.setHex(p.hemiSky);
    this.hemiLight.groundColor.setHex(p.hemiGround);
    this.hemiLight.intensity = p.hemiIntensity;

    // Renderer Exposure
    this.renderer.toneMappingExposure = p.exposure;

    // Fog
    if (this.scene.fog) {
      this.scene.fog.color.setHex(p.fogColor);
      this.scene.fog.density = p.fogDensity;
    }

    // Interior warm lights
    this.interiorLights.forEach(light => {
      light.intensity = 1.6 * p.interiorWarmth;
    });

    return p;
  }

  nextPreset() {
    return this.applyPreset(this.currentPresetIndex + 1);
  }

  getPresetName() {
    return this.presets[this.currentPresetIndex].name;
  }
}
