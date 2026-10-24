import * as THREE from 'three';

// Ultra-Photorealistic PBR Procedural Texture Generator
// Generates luxury architectural wood grain, woven plush fur/wool rugs, pebbled leather, and bouclé fabrics
// Complete with Diffuse Maps, Bump Maps, and Roughness Maps for full physical light interaction

export class TextureGenerator {
  // ==========================================================================
  // 1. Luxury Architectural Grained Walnut Wood (Diffuse Map)
  // ==========================================================================
  static createWalnutWood() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Rich warm walnut base
    ctx.fillStyle = '#422c1d';
    ctx.fillRect(0, 0, 1024, 1024);

    // Layer 1: Luxury wide wood planks and color variations
    const numPlanks = 6;
    const plankW = 1024 / numPlanks;
    const plankTones = ['#382417', '#452d1e', '#4c3322', '#3a2518', '#483021', '#402a1c'];

    for (let p = 0; p < numPlanks; p++) {
      ctx.fillStyle = plankTones[p % plankTones.length];
      ctx.fillRect(p * plankW, 0, plankW, 1024);

      // Plank bevel / seam shadow
      ctx.fillStyle = 'rgba(15, 9, 6, 0.55)';
      ctx.fillRect(p * plankW + plankW - 2, 0, 2, 1024);
      ctx.fillStyle = 'rgba(85, 58, 38, 0.25)';
      ctx.fillRect(p * plankW, 0, 1, 1024);
    }

    // Layer 2: Organic wood grain growth rings & pores
    for (let i = 0; i < 600; i++) {
      const xStart = Math.random() * 1024;
      const alpha = 0.08 + Math.random() * 0.22;
      const isDark = Math.random() > 0.35;
      ctx.strokeStyle = isDark ? `rgba(22, 13, 8, ${alpha})` : `rgba(110, 75, 48, ${alpha * 0.75})`;
      ctx.lineWidth = 0.8 + Math.random() * 2.6;

      ctx.beginPath();
      let x = xStart;
      let y = 0;
      ctx.moveTo(x, y);

      const freq1 = 0.003 + Math.random() * 0.005;
      const freq2 = 0.012 + Math.random() * 0.018;
      const amp1 = 14 + Math.random() * 26;
      const amp2 = 5 + Math.random() * 10;

      while (y < 1024) {
        y += 6;
        x = xStart + Math.sin(y * freq1) * amp1 + Math.sin(y * freq2) * amp2;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Layer 3: Micro wood pores & tactile grain noise
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 22;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 0.82));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.65));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // ==========================================================================
  // 1B. Walnut Wood Bump Map (Creates Physical Grain Depth & Specular Reflections)
  // ==========================================================================
  static createWoodBump() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Neutral grey baseline
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 1024, 1024);

    // Plank seams
    const numPlanks = 6;
    const plankW = 1024 / numPlanks;
    for (let p = 0; p < numPlanks; p++) {
      ctx.fillStyle = '#404040';
      ctx.fillRect(p * plankW + plankW - 2, 0, 2, 1024);
    }

    // Wood grain height lines
    for (let i = 0; i < 500; i++) {
      const xStart = Math.random() * 1024;
      const alpha = 0.05 + Math.random() * 0.18;
      const isDepression = Math.random() > 0.5;
      ctx.strokeStyle = isDepression ? `rgba(40, 40, 40, ${alpha})` : `rgba(220, 220, 220, ${alpha})`;
      ctx.lineWidth = 1 + Math.random() * 2.2;

      ctx.beginPath();
      let x = xStart;
      let y = 0;
      ctx.moveTo(x, y);

      const freq1 = 0.0035 + Math.random() * 0.004;
      const amp1 = 16 + Math.random() * 22;

      while (y < 1024) {
        y += 6;
        x = xStart + Math.sin(y * freq1) * amp1;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }

  // ==========================================================================
  // 2. Scandinavian Modern Woven Geometric Plush Wool/Fur Area Rug (Diffuse Map)
  // Matching the high-end reference rug under the dining table
  // ==========================================================================
  static createGeometricRug() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Warm ivory / oat plush wool base
    ctx.fillStyle = '#dedad2';
    ctx.fillRect(0, 0, 1024, 1024);

    // Geometric diamond / lattice line pattern (charcoal wool yarn)
    ctx.strokeStyle = '#28292d';
    ctx.lineWidth = 14;

    const gridSize = 128;
    for (let x = -1024; x < 2048; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 1024, 1024);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, 1024);
      ctx.lineTo(x + 1024, 0);
      ctx.stroke();
    }

    // Inner subtle diamond accents
    ctx.strokeStyle = '#3d3f44';
    ctx.lineWidth = 6;
    for (let x = -1024; x < 2048; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x + gridSize / 2, 0);
      ctx.lineTo(x + gridSize / 2 + 1024, 1024);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + gridSize / 2, 1024);
      ctx.lineTo(x + gridSize / 2 + 1024, 0);
      ctx.stroke();
    }

    // Plush fur / high-pile wool fiber grain noise
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const fiber = (Math.random() - 0.5) * 36; // Deep wool fiber noise
      data[i] = Math.min(255, Math.max(0, data[i] + fiber));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + fiber));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + fiber));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // ==========================================================================
  // 2B. Plush Fur / Wool Rug Bump Map (Gives 3D Deep Fiber Texture & Touch)
  // ==========================================================================
  static createRugBump() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Heavy wool fiber pile displacement
    const imgData = ctx.createImageData(1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Perlin-style micro-fur tufts
      const tuft = 128 + (Math.random() - 0.5) * 75;
      data[i] = tuft;
      data[i + 1] = tuft;
      data[i + 2] = tuft;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    return texture;
  }

  // ==========================================================================
  // 3. Luxury Italian Pebbled Leather (For Dining Chairs & Bespoke Sofa)
  // ==========================================================================
  static createLeather() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep rich charcoal / olive leather tone (matching reference chairs)
    ctx.fillStyle = '#262822';
    ctx.fillRect(0, 0, 512, 512);

    // Micro pebble grain
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 1.2 + Math.random() * 2.2;
      const isHighlight = Math.random() > 0.5;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isHighlight ? 'rgba(68, 72, 62, 0.45)' : 'rgba(16, 18, 14, 0.60)';
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // ==========================================================================
  // 3B. Pebbled Leather Bump Map (Authentic Tactile Specular Reflection)
  // ==========================================================================
  static createLeatherBump() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 1.2 + Math.random() * 2.0;
      const isBump = Math.random() > 0.45;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isBump ? 'rgba(210, 210, 210, 0.35)' : 'rgba(50, 50, 50, 0.40)';
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    return texture;
  }

  // ==========================================================================
  // 4. Textured Woven Bouclé / Linen Fabric (For Sofa Cushions & Upholstery)
  // ==========================================================================
  static createLinenFabric() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e4e0d6'; // Warm natural linen
    ctx.fillRect(0, 0, 512, 512);

    // Cross-hatch weave pattern
    ctx.lineWidth = 1;
    for (let i = 0; i < 512; i += 3) {
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(155, 145, 132, 0.38)' : 'rgba(250, 245, 235, 0.50)';
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // ==========================================================================
  // 4B. Linen / Bouclé Fabric Bump Map
  // ==========================================================================
  static createFabricBump() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    ctx.lineWidth = 1;
    for (let i = 0; i < 512; i += 3) {
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(50, 50, 50, 0.40)' : 'rgba(210, 210, 210, 0.40)';
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    return texture;
  }
}
