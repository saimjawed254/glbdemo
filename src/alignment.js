// Fine-Alignment & Calibration Drawer Manager

export class AlignmentManager {
  constructor(penthouseGroup, buildingGroup, cameraController, envManager) {
    this.penthouseGroup = penthouseGroup;
    this.buildingGroup = buildingGroup;
    this.cameraController = cameraController;
    this.envManager = envManager;

    // Default alignment offsets (initial baseline)
    this.state = {
      posX: 0.0,
      posY: 0.0,
      posZ: 0.0,
      rotY: 0.0,
      scale: 1.0,
      walkSpeed: 2.0, // Calibrated luxury walkthrough speed
      mouseSens: 1.0,
      exposure: 1.02, // Calibrated photorealistic HDR exposure
      buildingVis: true,
      roofVis: true,
      penthouseVis: true
    };

    this.roofMeshes = [];

    // Load saved settings if any, but enforce calibrated speed and exposure defaults
    const saved = localStorage.getItem('aura_penthouse_alignment');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.exposure && (parsed.exposure > 1.25 || parsed.exposure < 0.70)) parsed.exposure = 1.02;
        if (parsed.walkSpeed && parsed.walkSpeed > 3.0) parsed.walkSpeed = 2.0;
        this.state = { ...this.state, ...parsed };
      } catch (e) {}
    }

    this.initDOMElements();
    this.applyTransform();
  }

  initDOMElements() {
    this.drawer = document.getElementById('alignment-drawer');
    this.toggleBtn = document.getElementById('btn-tuner-toggle');
    this.closeBtn = document.getElementById('btn-close-drawer');

    // Sliders
    this.sliderPosX = document.getElementById('slider-pos-x');
    this.sliderPosY = document.getElementById('slider-pos-y');
    this.sliderPosZ = document.getElementById('slider-pos-z');
    this.sliderRotY = document.getElementById('slider-rot-y');
    this.sliderScale = document.getElementById('slider-scale');
    this.sliderWalkSpeed = document.getElementById('slider-walk-speed');
    this.sliderMouseSens = document.getElementById('slider-mouse-sens');
    this.sliderExposure = document.getElementById('slider-exposure');

    // Labels
    this.valPosX = document.getElementById('val-pos-x');
    this.valPosY = document.getElementById('val-pos-y');
    this.valPosZ = document.getElementById('val-pos-z');
    this.valRotY = document.getElementById('val-rot-y');
    this.valScale = document.getElementById('val-scale');
    this.valWalkSpeed = document.getElementById('val-walk-speed');
    this.valMouseSens = document.getElementById('val-mouse-sens');
    this.valExposure = document.getElementById('val-exposure');

    // Toggles
    this.toggleBuildingVis = document.getElementById('toggle-building-vis');
    this.toggleRoofVis = document.getElementById('toggle-roof-vis');
    this.togglePenthouseVis = document.getElementById('toggle-penthouse-vis');

    // Buttons
    this.btnCopy = document.getElementById('btn-copy-alignment');
    this.btnReset = document.getElementById('btn-reset-alignment');

    // Sync initial UI values
    this.syncUIFromState();
    this.bindEvents();
  }

  syncUIFromState() {
    if (this.sliderPosX) this.sliderPosX.value = this.state.posX;
    if (this.valPosX) this.valPosX.textContent = `${this.state.posX.toFixed(2)} m`;

    if (this.sliderPosY) this.sliderPosY.value = this.state.posY;
    if (this.valPosY) this.valPosY.textContent = `${this.state.posY.toFixed(2)} m`;

    if (this.sliderPosZ) this.sliderPosZ.value = this.state.posZ;
    if (this.valPosZ) this.valPosZ.textContent = `${this.state.posZ.toFixed(2)} m`;

    if (this.sliderRotY) this.sliderRotY.value = this.state.rotY;
    if (this.valRotY) this.valRotY.textContent = `${this.state.rotY.toFixed(1)}°`;

    if (this.sliderScale) this.sliderScale.value = this.state.scale;
    if (this.valScale) this.valScale.textContent = `${this.state.scale.toFixed(3)}x`;

    if (this.sliderWalkSpeed) this.sliderWalkSpeed.value = this.state.walkSpeed;
    if (this.valWalkSpeed) this.valWalkSpeed.textContent = `${this.state.walkSpeed.toFixed(1)} m/s`;

    if (this.sliderMouseSens) this.sliderMouseSens.value = this.state.mouseSens;
    if (this.valMouseSens) this.valMouseSens.textContent = `${this.state.mouseSens.toFixed(1)}x`;

    if (this.sliderExposure) this.sliderExposure.value = this.state.exposure;
    if (this.valExposure) this.valExposure.textContent = `${this.state.exposure.toFixed(2)}`;

    if (this.toggleBuildingVis) this.toggleBuildingVis.checked = this.state.buildingVis;
    if (this.toggleRoofVis) this.toggleRoofVis.checked = this.state.roofVis;
    if (this.togglePenthouseVis) this.togglePenthouseVis.checked = this.state.penthouseVis;
  }

  bindEvents() {
    // Drawer open / close
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleDrawer());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    // Keyboard shortcut 'H'
    window.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        this.toggleDrawer();
      }
    });

    // Slider inputs
    this.sliderPosX?.addEventListener('input', (e) => {
      this.state.posX = parseFloat(e.target.value);
      this.valPosX.textContent = `${this.state.posX.toFixed(2)} m`;
      this.applyTransform();
    });

    this.sliderPosY?.addEventListener('input', (e) => {
      this.state.posY = parseFloat(e.target.value);
      this.valPosY.textContent = `${this.state.posY.toFixed(2)} m`;
      this.applyTransform();
    });

    this.sliderPosZ?.addEventListener('input', (e) => {
      this.state.posZ = parseFloat(e.target.value);
      this.valPosZ.textContent = `${this.state.posZ.toFixed(2)} m`;
      this.applyTransform();
    });

    this.sliderRotY?.addEventListener('input', (e) => {
      this.state.rotY = parseFloat(e.target.value);
      this.valRotY.textContent = `${this.state.rotY.toFixed(1)}°`;
      this.applyTransform();
    });

    this.sliderScale?.addEventListener('input', (e) => {
      this.state.scale = parseFloat(e.target.value);
      this.valScale.textContent = `${this.state.scale.toFixed(3)}x`;
      this.applyTransform();
    });

    this.sliderWalkSpeed?.addEventListener('input', (e) => {
      this.state.walkSpeed = parseFloat(e.target.value);
      this.valWalkSpeed.textContent = `${this.state.walkSpeed.toFixed(1)} m/s`;
      if (this.cameraController) this.cameraController.walkSpeed = this.state.walkSpeed;
      this.save();
    });

    this.sliderMouseSens?.addEventListener('input', (e) => {
      this.state.mouseSens = parseFloat(e.target.value);
      this.valMouseSens.textContent = `${this.state.mouseSens.toFixed(1)}x`;
      if (this.cameraController) this.cameraController.mouseSensitivity = this.state.mouseSens;
      this.save();
    });

    this.sliderExposure?.addEventListener('input', (e) => {
      this.state.exposure = parseFloat(e.target.value);
      this.valExposure.textContent = `${this.state.exposure.toFixed(2)}`;
      if (this.envManager && this.envManager.renderer) {
        this.envManager.renderer.toneMappingExposure = this.state.exposure;
      }
      this.save();
    });

    this.toggleBuildingVis?.addEventListener('change', (e) => {
      this.state.buildingVis = e.target.checked;
      if (this.buildingGroup) this.buildingGroup.visible = this.state.buildingVis;
      this.save();
    });

    this.toggleRoofVis?.addEventListener('change', (e) => {
      this.setRoofVisibility(e.target.checked);
    });

    this.togglePenthouseVis?.addEventListener('change', (e) => {
      this.state.penthouseVis = e.target.checked;
      if (this.penthouseGroup) this.penthouseGroup.visible = this.state.penthouseVis;
      this.save();
    });

    // Copy JSON to clipboard
    this.btnCopy?.addEventListener('click', () => {
      const config = {
        offsetX: this.state.posX,
        offsetY: this.state.posY,
        offsetZ: this.state.posZ,
        rotationYDegrees: this.state.rotY,
        scale: this.state.scale
      };
      const text = JSON.stringify(config, null, 2);
      navigator.clipboard.writeText(text).then(() => {
        const orig = this.btnCopy.textContent;
        this.btnCopy.textContent = 'Copied to Clipboard!';
        setTimeout(() => { this.btnCopy.textContent = orig; }, 2000);
      });
    });

    // Reset defaults
    this.btnReset?.addEventListener('click', () => {
      this.state.posX = 0.0;
      this.state.posY = 0.0;
      this.state.posZ = 0.0;
      this.state.rotY = 0.0;
      this.state.scale = 1.0;
      this.state.walkSpeed = 2.0;
      this.state.mouseSens = 1.0;
      this.state.exposure = 0.82;
      this.state.buildingVis = true;
      this.state.roofVis = true;
      this.state.penthouseVis = true;
      this.syncUIFromState();
      this.applyTransform();
      this.save();
    });
  }

  setRoofMeshes(meshes) {
    this.roofMeshes = meshes || [];
    this.applyRoofVisibility();
  }

  setRoofVisibility(visible) {
    this.state.roofVis = visible;
    if (this.toggleRoofVis) this.toggleRoofVis.checked = visible;
    const roofLabel = document.getElementById('roof-label');
    if (roofLabel) {
      roofLabel.textContent = visible ? 'ROOF: ON' : 'ROOF: CUTAWAY';
    }
    this.applyRoofVisibility();
    this.save();
  }

  applyRoofVisibility() {
    this.roofMeshes.forEach(mesh => {
      mesh.visible = this.state.roofVis;
    });
  }

  toggleDrawer() {
    if (!this.drawer) return;
    this.drawer.classList.toggle('hidden');
  }

  closeDrawer() {
    if (!this.drawer) return;
    this.drawer.classList.add('hidden');
  }

  applyTransform() {
    if (this.penthouseGroup) {
      this.penthouseGroup.position.set(this.state.posX, this.state.posY, this.state.posZ);
      this.penthouseGroup.rotation.y = (this.state.rotY * Math.PI) / 180;
      this.penthouseGroup.scale.set(this.state.scale, this.state.scale, this.state.scale);
      this.penthouseGroup.visible = this.state.penthouseVis;
    }
    if (this.buildingGroup) {
      this.buildingGroup.visible = this.state.buildingVis;
    }
    this.applyRoofVisibility();
    if (this.cameraController) {
      this.cameraController.walkSpeed = this.state.walkSpeed;
      this.cameraController.mouseSensitivity = this.state.mouseSens;
      this.cameraController.targetY = 29.90 + this.state.posY + 1.65;
    }
    this.save();
  }

  save() {
    localStorage.setItem('aura_penthouse_alignment', JSON.stringify(this.state));
  }
}
