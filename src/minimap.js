// Interactive Architectural Mini-Map HUD Engine

export class MiniMap {
  constructor(canvasId, onNavigateToRoom) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.onNavigateToRoom = onNavigateToRoom;

    // Penthouse real-world bounds: X ~ 5.0 to 35.5, Z ~ -3.8 to 23.5
    this.worldBounds = {
      minX: 5.0,
      maxX: 35.5,
      minZ: -3.8,
      maxZ: 23.5
    };

    // Hotspot rooms configured with exact 3D penthouse coordinates
    this.rooms = [
      { id: 'living', name: 'Grand Living & Dining Salon', x: 21.0, z: 4.5, bounds: { minX: 15.0, maxX: 26.0, minZ: -2.0, maxZ: 10.5 } },
      { id: 'master', name: 'Master Penthouse Suite', x: 30.5, z: 3.5, bounds: { minX: 26.0, maxX: 35.5, minZ: -3.8, maxZ: 11.0 } },
      { id: 'dining', name: 'Gourmet Kitchen & Dining Bar', x: 22.0, z: 13.5, bounds: { minX: 16.0, maxX: 28.0, minZ: 10.5, maxZ: 17.5 } },
      { id: 'foyer', name: 'Grand Foyer & Entry', x: 10.5, z: 3.5, bounds: { minX: 5.0, maxX: 15.0, minZ: -3.8, maxZ: 7.0 } },
      { id: 'terrace', name: 'Panoramic Sky Balcony', x: 9.5, z: 17.5, bounds: { minX: 5.0, maxX: 16.0, minZ: 10.5, maxZ: 23.5 } }
    ];

    // Current player state
    this.playerX = 18.0;
    this.playerZ = 7.5;
    this.playerLookX = 0;
    this.playerLookZ = 1;

    this.radarAngle = 0;
    this.isExpanded = false;

    this.roomLabelEl = document.getElementById('minimap-room-label');
    this.coordSpecEl = document.getElementById('player-coords');

    this.initEvents();
  }

  initEvents() {
    // Room chip buttons
    const chips = document.querySelectorAll('.room-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = chip.dataset.room;
        const target = this.rooms.find(r => r.id === roomId);
        if (target && this.onNavigateToRoom) {
          this.onNavigateToRoom(target.x, target.z, target.name);
        }
      });
    });

    // Canvas click detection for direct hotspot navigation
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const canvasX = clickX * scaleX;
      const canvasY = clickY * scaleY;

      // Find if clicked near any room pin
      let closest = null;
      let minDistance = 35; // pixel threshold

      this.rooms.forEach(room => {
        const pt = this.worldToCanvas(room.x, room.z);
        const dist = Math.hypot(pt.x - canvasX, pt.y - canvasY);
        if (dist < minDistance) {
          minDistance = dist;
          closest = room;
        }
      });

      if (closest && this.onNavigateToRoom) {
        this.onNavigateToRoom(closest.x, closest.z, closest.name);
      }
    });

    // Expand / Collapse
    const expandBtn = document.getElementById('btn-minimap-toggle-size');
    const container = document.getElementById('minimap-container');
    if (expandBtn && container) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isExpanded = !this.isExpanded;
        container.classList.toggle('expanded', this.isExpanded);
        setTimeout(() => this.resizeCanvas(), 360);
      });
    }

    // Recenter
    const recenterBtn = document.getElementById('btn-minimap-recenter');
    if (recenterBtn) {
      recenterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Recenter pulse
        this.radarAngle = 0;
      });
    }
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
  }

  worldToCanvas(x, z) {
    const pad = 28;
    const w = this.canvas.width - pad * 2;
    const h = this.canvas.height - pad * 2;

    const spanX = this.worldBounds.maxX - this.worldBounds.minX;
    const spanZ = this.worldBounds.maxZ - this.worldBounds.minZ;

    const u = (x - this.worldBounds.minX) / spanX;
    const v = (z - this.worldBounds.minZ) / spanZ;

    return {
      x: pad + u * w,
      y: pad + v * h
    };
  }

  updatePlayer(x, z, lookX, lookZ) {
    this.playerX = x;
    this.playerZ = z;
    if (lookX !== undefined && lookZ !== undefined) {
      this.playerLookX = lookX;
      this.playerLookZ = lookZ;
    }

    if (this.coordSpecEl) {
      this.coordSpecEl.textContent = `X: ${x.toFixed(1)}  Z: ${z.toFixed(1)}`;
    }

    // Determine current room with exact 3D bounds
    let currentRoom = 'Penthouse Main Floor';
    for (const r of this.rooms) {
      if (
        x >= r.bounds.minX && x <= r.bounds.maxX &&
        z >= r.bounds.minZ && z <= r.bounds.maxZ
      ) {
        currentRoom = r.name;
        break;
      }
    }
    if (this.roomLabelEl && this.roomLabelEl.textContent !== currentRoom) {
      this.roomLabelEl.textContent = currentRoom;
    }
  }

  render(time) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    // 1. Architectural Blueprint Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Penthouse Architectural Outline & True Partitions
    const pTopLeft = this.worldToCanvas(this.worldBounds.minX, this.worldBounds.minZ);
    const pBottomRight = this.worldToCanvas(this.worldBounds.maxX, this.worldBounds.maxZ);

    // Footprint backdrop
    ctx.fillStyle = 'rgba(15, 22, 34, 0.75)';
    ctx.fillRect(pTopLeft.x, pTopLeft.y, pBottomRight.x - pTopLeft.x, pBottomRight.y - pTopLeft.y);

    // Outer architectural perimeter wall
    ctx.strokeStyle = 'rgba(223, 184, 130, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(pTopLeft.x, pTopLeft.y, pBottomRight.x - pTopLeft.x, pBottomRight.y - pTopLeft.y);

    // Interior Room Partition Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.lineWidth = 1.5;

    // West column dividing wall (Foyer & Terrace vs Living Lounge)
    const p1 = this.worldToCanvas(14.0, -3.8);
    const p2 = this.worldToCanvas(14.0, 12.0);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // East column dividing wall (Living Lounge vs Master & Dining)
    const p3 = this.worldToCanvas(21.5, -3.8);
    const p4 = this.worldToCanvas(21.5, 12.5);
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.stroke();

    // Horizontal wall separating Master Suite from Dining & Bar
    const p5 = this.worldToCanvas(21.5, 5.0);
    const p6 = this.worldToCanvas(35.5, 5.0);
    ctx.beginPath();
    ctx.moveTo(p5.x, p5.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.stroke();

    // Horizontal wall separating Foyer from Terrace walkway
    const p7 = this.worldToCanvas(5.0, 7.0);
    const p8 = this.worldToCanvas(14.0, 7.0);
    ctx.beginPath();
    ctx.moveTo(p7.x, p7.y);
    ctx.lineTo(p8.x, p8.y);
    ctx.stroke();

    // Panoramic Sky Terrace glass railing (dashed cyan line)
    const t1 = this.worldToCanvas(5.0, 12.0);
    const t2 = this.worldToCanvas(16.0, 12.0);
    const t3 = this.worldToCanvas(16.0, 23.5);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(78, 242, 210, 0.65)';
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Room Labels & Interactive Teleport Pins
    this.rooms.forEach(room => {
      const pt = this.worldToCanvas(room.x, room.z);

      // Pin center dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#dfb882';
      ctx.fill();

      // Pin border ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(223, 184, 130, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Room Name
      ctx.font = '600 9px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(room.id.toUpperCase(), pt.x, pt.y + 16);
    });

    // 4. Player Position & Orientation Cone
    const playerPt = this.worldToCanvas(this.playerX, this.playerZ);

    // Calculate canvas view angle from look vector:
    // In canvas: +X is right, +Y is down (towards +Z in 3D)
    const canvasViewAngle = Math.atan2(this.playerLookZ, this.playerLookX);
    const coneLength = 32;
    const fovHalf = Math.PI / 5; // ~36 degree cone

    ctx.save();
    ctx.translate(playerPt.x, playerPt.y);

    const fovGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coneLength);
    fovGrad.addColorStop(0, 'rgba(78, 242, 210, 0.50)');
    fovGrad.addColorStop(0.7, 'rgba(78, 242, 210, 0.15)');
    fovGrad.addColorStop(1, 'rgba(78, 242, 210, 0)');

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneLength, canvasViewAngle - fovHalf, canvasViewAngle + fovHalf);
    ctx.closePath();
    ctx.fillStyle = fovGrad;
    ctx.fill();

    // Pulse Ring around player
    const pulseRadius = 6 + (Math.sin(time * 0.005) + 1) * 3;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(78, 242, 210, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Center player beacon dot
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#4ef2d2';
    ctx.shadowColor = '#4ef2d2';
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  }
}
