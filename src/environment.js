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
        sunIntensity: 2.6,
        sunPosition: new THREE.Vector3(-18, 38, 32), // Angled through panoramic terrace windows
        hemiSky: 0xffeedd,
        hemiGround: 0x3a2e28,
        hemiIntensity: 0.32,
        exposure: 1.02,
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
        sunIntensity: 2.4,
        sunPosition: new THREE.Vector3(-15, 42, 28), // High radiant daytime sun streaming through glazing
        hemiSky: 0xddeeff,
        hemiGround: 0x2e3540,
        hemiIntensity: 0.35,
        exposure: 1.00,
        fogColor: 0x1c2838,
        fogDensity: 0.0008,
        interiorWarmth: 0.85
      },
      {
        name: 'TWILIGHT LUXURY',
        hdrPath: null,
        bgTop: '#090d18',
        bgMid: '#161d2d',
        bgBottom: '#06070a',
        sunColor: 0xff8c55,
        sunIntensity: 1.6,
        sunPosition: new THREE.Vector3(-22, 28, 30),
        hemiSky: 0x5a4066,
        hemiGround: 0x1a1520,
        hemiIntensity: 0.22,
        exposure: 1.05,
        fogColor: 0x0a0f18,
        fogDensity: 0.0018,
        interiorWarmth: 1.25
      }
    ];

    this.interiorLights = [];
    this.interiorSpotlights = [];
    this.initLights();
    this.applyPreset(0);
  }

  initLights() {
    // 1. Directional Sun Light streaming through windows (Optimized 1024x1024 shadow map)
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 110;
    
    // Shadow frustum tightly covering the penthouse footprint
    const d = 24;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 1.5; // Photorealistic soft shadow edges

    // Target the center of the penthouse living and dining salon
    this.sunLightTarget = new THREE.Object3D();
    this.sunLightTarget.position.set(20.35, 30.5, 9.83);
    this.scene.add(this.sunLightTarget);
    this.sunLight.target = this.sunLightTarget;

    this.scene.add(this.sunLight);

    // 2. Soft Architectural Skylight
    this.hemiLight = new THREE.HemisphereLight(0xffeedd, 0x3a2e28, 0.32);
    this.hemiLight.position.set(0, 80, 0);
    this.scene.add(this.hemiLight);

    // 3. Upward Floor-to-Ceiling Architectural Indirect Bounce Light
    this.ceilingBounceLight = new THREE.HemisphereLight(0xfff5ea, 0x222222, 0.35);
    this.ceilingBounceLight.position.set(20.35, 29.5, 9.83);
    this.scene.add(this.ceilingBounceLight);

    // 4. Warm Ambient Interior Fill
    this.ambientLight = new THREE.AmbientLight(0xfff4e6, 0.16);
    this.scene.add(this.ambientLight);

    // 5. Dedicated Architectural Chandelier Spotlight Above Dining Table
    // Casts crisp, smooth contact shadows under vases, dining table, chairs, and rug
    this.diningChandelier = new THREE.SpotLight(0xfff1dc, 3.2, 14, Math.PI / 3, 0.42, 1.8);
    this.diningChandelier.position.set(20.0, 32.7, 8.5);
    this.diningChandelierTarget = new THREE.Object3D();
    this.diningChandelierTarget.position.set(20.0, 30.0, 8.5);
    this.scene.add(this.diningChandelierTarget);
    this.diningChandelier.target = this.diningChandelierTarget;
    this.diningChandelier.castShadow = true;
    this.diningChandelier.shadow.mapSize.width = 1024;
    this.diningChandelier.shadow.mapSize.height = 1024;
    this.diningChandelier.shadow.bias = -0.0001;
    this.diningChandelier.shadow.normalBias = 0.02;
    this.diningChandelier.shadow.radius = 1.8;
    this.scene.add(this.diningChandelier);
    this.interiorSpotlights.push(this.diningChandelier);

    // B. Living Room Salon Spotlight (Soft fill without costly secondary shadow pass)
    this.livingSpotlight = new THREE.SpotLight(0xfff2df, 2.6, 14, Math.PI / 3, 0.42, 1.8);
    this.livingSpotlight.position.set(21.0, 32.7, 4.5);
    this.livingSpotlightTarget = new THREE.Object3D();
    this.livingSpotlightTarget.position.set(21.0, 30.0, 4.5);
    this.scene.add(this.livingSpotlightTarget);
    this.livingSpotlight.target = this.livingSpotlightTarget;
    this.livingSpotlight.castShadow = false;
    this.scene.add(this.livingSpotlight);
    this.interiorSpotlights.push(this.livingSpotlight);

    // C. Gourmet Kitchen Island Spotlight
    this.kitchenSpotlight = new THREE.SpotLight(0xfff4e4, 2.2, 12, Math.PI / 3.2, 0.38, 1.8);
    this.kitchenSpotlight.position.set(22.0, 32.7, 14.0);
    this.kitchenSpotlightTarget = new THREE.Object3D();
    this.kitchenSpotlightTarget.position.set(22.0, 30.0, 14.0);
    this.scene.add(this.kitchenSpotlightTarget);
    this.kitchenSpotlight.target = this.kitchenSpotlightTarget;
    this.kitchenSpotlight.castShadow = false;
    this.scene.add(this.kitchenSpotlight);
    this.interiorSpotlights.push(this.kitchenSpotlight);

    // 6. Dedicated Warm Penthouse Interior Accent Lights
    const interiorPositions = [
      new THREE.Vector3(10.5, 32.2, 3.5),   // Grand Foyer
      new THREE.Vector3(21.0, 32.2, 4.5),   // Grand Living & Dining Salon
      new THREE.Vector3(22.0, 32.2, 14.0),  // Gourmet Kitchen & Bar
      new THREE.Vector3(30.5, 32.2, 3.5),   // Master Penthouse Suite
      new THREE.Vector3(9.5, 32.2, 17.5)    // Panoramic Sky Terrace
    ];

    interiorPositions.forEach((pos) => {
      const pLight = new THREE.PointLight(0xffecd2, 0.55, 12, 1.8);
      pLight.position.copy(pos);
      pLight.castShadow = false;
      this.scene.add(pLight);
      this.interiorLights.push(pLight);
    });

    // 7. Exponential Fog for atmospheric depth
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
      light.intensity = 0.55 * p.interiorWarmth;
    });

    if (this.diningChandelier) this.diningChandelier.intensity = 3.2 * p.interiorWarmth;
    if (this.livingSpotlight) this.livingSpotlight.intensity = 2.8 * p.interiorWarmth;
    if (this.kitchenSpotlight) this.kitchenSpotlight.intensity = 2.4 * p.interiorWarmth;

    return p;
  }

  nextPreset() {
    return this.applyPreset(this.currentPresetIndex + 1);
  }

  getPresetName() {
    return this.presets[this.currentPresetIndex].name;
  }
}
