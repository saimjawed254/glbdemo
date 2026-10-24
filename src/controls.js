import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { playFootstep } from './audio.js';

export class DualCameraController {
  constructor(camera, domElement, onPositionChange) {
    this.camera = camera;
    this.domElement = domElement;
    this.onPositionChange = onPositionChange;

    this.mode = 'exterior'; // 'exterior' | 'walkthrough'
    this.isTransitioning = false;

    // Penthouse architectural levels
    this.floorY = 30.20; // Penthouse floor elevation (exact GLB floor height)
    this.eyeHeight = 1.65; // Human eye height in meters
    this.targetY = this.floorY + this.eyeHeight; // 31.85m standing eye height

    // Strict architectural boundary limits to prevent moving outside the floor
    this.bounds = {
      minX: 6.2,
      maxX: 34.5,
      minZ: -2.8,
      maxZ: 22.4
    };

    // Smooth, cinematic luxury walking speed (down from 4.5 m/s)
    this.walkSpeed = 2.0;
    this.sprintMultiplier = 1.4;
    this.mouseSensitivity = 1.0;
    this.damping = 0.82;

    // Velocity & Keys
    this.velocity = new THREE.Vector3();
    this.moveKeys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      up: false,
      down: false
    };

    // Zoom FOV
    this.defaultFov = 65;
    this.targetFov = 65;
    this.minFov = 35;
    this.maxFov = 85;

    // Footstep timing
    this.stepTimer = 0;

    // Initialize Orbit Controls (Exterior)
    this.initOrbitControls();

    // Initialize PointerLock Controls (Walkthrough)
    this.initPointerLockControls();

    // Key & Mouse Listeners
    this.initInputListeners();
  }

  initOrbitControls() {
    this.orbit = new OrbitControls(this.camera, this.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.05;
    this.orbit.screenSpacePanning = true;
    this.orbit.minDistance = 15;
    this.orbit.maxDistance = 180;
    this.orbit.maxPolarAngle = Math.PI / 2 + 0.02; // prevent going below ground plane
    
    // Default building framing
    this.exteriorTarget = new THREE.Vector3(18, 18, 10);
    this.exteriorCameraPos = new THREE.Vector3(-45, 45, 55);
    
    this.orbit.target.copy(this.exteriorTarget);
    this.camera.position.copy(this.exteriorCameraPos);
  }

  initPointerLockControls() {
    this.fpControls = new PointerLockControls(this.camera, this.domElement);
    this.guidePill = document.getElementById('fps-guide-pill');
    this.crosshair = document.getElementById('crosshair');

    const dismissBtn = document.getElementById('btn-dismiss-guide');
    if (dismissBtn && this.guidePill) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.guidePill.classList.add('hidden');
      });
    }

    // Pointer lock state changes
    this.fpControls.addEventListener('lock', () => {
      if (this.guidePill) this.guidePill.classList.add('hidden');
      if (this.crosshair) this.crosshair.classList.remove('hidden');
      document.body.classList.add('first-person-locked');
    });

    this.fpControls.addEventListener('unlock', () => {
      document.body.classList.remove('first-person-locked');
    });

    // Clicking canvas in walkthrough mode activates pointer lock
    this.domElement.addEventListener('click', () => {
      if (this.mode === 'walkthrough' && !this.fpControls.isLocked) {
        try {
          this.fpControls.lock();
        } catch (e) {}
      }
    });
  }

  initInputListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Mouse wheel for FOV zoom
    window.addEventListener('wheel', (e) => {
      if (this.mode === 'walkthrough') {
        this.targetFov += e.deltaY * 0.04;
        this.targetFov = THREE.MathUtils.clamp(this.targetFov, this.minFov, this.maxFov);
      }
    }, { passive: true });

    // Drag look fallback when not locked in pointer lock
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    this.domElement.addEventListener('mousedown', (e) => {
      if (this.mode === 'walkthrough' && !this.fpControls.isLocked) {
        if (e.button === 0) {
          isDragging = true;
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.mode === 'walkthrough' && !this.fpControls.isLocked && isDragging) {
        const deltaX = (e.clientX - prevMouseX) * 0.003 * this.mouseSensitivity;
        const deltaY = (e.clientY - prevMouseY) * 0.003 * this.mouseSensitivity;

        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        euler.y -= deltaX;
        euler.x -= deltaY;
        euler.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, euler.x));
        this.camera.quaternion.setFromEuler(euler);

        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  onKeyDown(e) {
    if (this.mode !== 'walkthrough') return;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveKeys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveKeys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveKeys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveKeys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.moveKeys.sprint = true;
        break;
      case 'Space':
        this.moveKeys.up = true;
        break;
      case 'KeyC':
        this.moveKeys.down = true;
        break;
    }
  }

  onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveKeys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveKeys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveKeys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveKeys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.moveKeys.sprint = false;
        break;
      case 'Space':
        this.moveKeys.up = false;
        break;
      case 'KeyC':
        this.moveKeys.down = false;
        break;
    }
  }

  setMode(targetMode, onComplete) {
    if (this.mode === targetMode || this.isTransitioning) return;
    this.isTransitioning = true;

    if (targetMode === 'walkthrough') {
      this.mode = 'walkthrough';
      this.orbit.enabled = false;

      // Smooth cinematic zoom into penthouse foyer / living entrance
      const targetPos = new THREE.Vector3(18.5, this.targetY, 8.5);
      const targetLook = new THREE.Vector3(18.5, this.targetY, 15.0);

      this.animateCameraTransition(targetPos, targetLook, 1.4, () => {
        this.isTransitioning = false;
        if (this.guidePill) {
          this.guidePill.classList.remove('hidden');
          // auto hide after 5s
          setTimeout(() => {
            if (this.guidePill) this.guidePill.classList.add('hidden');
          }, 5000);
        }
        if (this.crosshair) this.crosshair.classList.remove('hidden');
        if (onComplete) onComplete();
      });

    } else {
      this.mode = 'exterior';
      if (this.fpControls.isLocked) {
        this.fpControls.unlock();
      }
      if (this.guidePill) this.guidePill.classList.add('hidden');
      if (this.crosshair) this.crosshair.classList.add('hidden');

      // Smooth pull out to exterior orbit view
      const targetPos = this.exteriorCameraPos.clone();
      const targetLook = this.exteriorTarget.clone();

      this.animateCameraTransition(targetPos, targetLook, 1.4, () => {
        this.orbit.enabled = true;
        this.orbit.target.copy(targetLook);
        this.isTransitioning = false;
        if (onComplete) onComplete();
      });
    }
  }

  teleportTo(x, z, roomName) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // Target inside the room at eye level
    const targetPos = new THREE.Vector3(x, this.targetY, z);
    
    // Look slightly towards room center or forward
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
    const targetLook = targetPos.clone().add(forward.multiplyScalar(5));

    this.animateCameraTransition(targetPos, targetLook, 1.0, () => {
      this.isTransitioning = false;
    });
  }

  animateCameraTransition(targetPosition, targetLookAt, durationSec, callback) {
    const startPos = this.camera.position.clone();
    const startQuat = this.camera.quaternion.clone();

    // Compute end quaternion
    const tempCamera = this.camera.clone();
    tempCamera.position.copy(targetPosition);
    tempCamera.lookAt(targetLookAt);
    const endQuat = tempCamera.quaternion;

    const startTime = performance.now();
    const durationMs = durationSec * 1000;

    const animateStep = () => {
      const now = performance.now();
      const progress = Math.min((now - startTime) / durationMs, 1);
      
      // Smooth cubic ease-in-out
      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(startPos, targetPosition, ease);
      this.camera.quaternion.slerpQuaternions(startQuat, endQuat, ease);

      if (progress < 1) {
        requestAnimationFrame(animateStep);
      } else {
        this.camera.position.copy(targetPosition);
        this.camera.quaternion.copy(endQuat);
        if (callback) callback();
      }
    };

    requestAnimationFrame(animateStep);
  }

  update(delta) {
    if (this.isTransitioning) return;

    if (this.mode === 'exterior') {
      this.orbit.update();
      if (this.onPositionChange) {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this.onPositionChange(this.camera.position.x, this.camera.position.z, dir.x, dir.z);
      }
      return;
    }

    // Walkthrough Mode Update
    // 1. Smooth FOV Zoom
    if (Math.abs(this.camera.fov - this.targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, 0.12);
      this.camera.updateProjectionMatrix();
    }

    // 2. Physical WASD Movement
    const moveDirection = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0; // lock to horizontal plane
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    if (this.moveKeys.forward) moveDirection.add(forward);
    if (this.moveKeys.backward) moveDirection.sub(forward);
    if (this.moveKeys.right) moveDirection.add(right);
    if (this.moveKeys.left) moveDirection.sub(right);

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
      const currentSpeed = this.walkSpeed * (this.moveKeys.sprint ? this.sprintMultiplier : 1.0);
      this.velocity.x += moveDirection.x * currentSpeed * delta * 8;
      this.velocity.z += moveDirection.z * currentSpeed * delta * 8;

      // Footstep sound trigger
      this.stepTimer += delta * (this.moveKeys.sprint ? 1.6 : 1.0);
      if (this.stepTimer > 0.45) {
        playFootstep();
        this.stepTimer = 0;
      }
    }

    // Floating up/down
    if (this.moveKeys.up) this.camera.position.y += 3.0 * delta;
    if (this.moveKeys.down) this.camera.position.y -= 3.0 * delta;

    // Inertia & Damping
    this.velocity.x *= this.damping;
    this.velocity.z *= this.damping;

    this.camera.position.x += this.velocity.x * delta;
    this.camera.position.z += this.velocity.z * delta;

    // Floor height lock (smoothly snap back to eye height if not manually floating)
    if (!this.moveKeys.up && !this.moveKeys.down) {
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.targetY, 0.15);
    }

    // Architectural Boundaries Collision Clamping
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, this.bounds.minX, this.bounds.maxX);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, this.bounds.minZ, this.bounds.maxZ);

    // Compute exact camera world look direction for mini-map radar
    const lookVector = new THREE.Vector3();
    this.camera.getWorldDirection(lookVector);

    if (this.onPositionChange) {
      this.onPositionChange(this.camera.position.x, this.camera.position.z, lookVector.x, lookVector.z);
    }
  }
}
