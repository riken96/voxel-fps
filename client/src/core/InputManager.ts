import { UserInput } from '@shared/physics/PlayerState.ts';

export class InputManager {
  private element: HTMLElement;
  public isLocked = false;

  // Mouse look angles (in radians)
  public yaw = 0;
  public pitch = 0;

  // Sensitivity configuration
  public sensitivity = 0.0022; // Radians per pixel
  public invertY = false;

  // Key states
  private keys: Record<string, boolean> = {};
  public mouseButtons: Record<number, boolean> = {};

  // Drag look state when pointer is not locked (e.g. Free-cursor builder mode)
  private isDraggingLook = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private sequence = 0;

  // Callbacks for UI overlay
  private lockListeners: Array<(locked: boolean) => void> = [];

  public addLockListener(fn: (locked: boolean) => void): void {
    this.lockListeners.push(fn);
  }

  public removeLockListener(fn: (locked: boolean) => void): void {
    this.lockListeners = this.lockListeners.filter((l) => l !== fn);
  }

  public set onLockChange(fn: ((locked: boolean) => void) | undefined) {
    if (fn) this.lockListeners.push(fn);
  }

  constructor(element: HTMLElement) {
    this.element = element;

    this.setupPointerLock();
    this.setupKeyboardListeners();
    this.setupMouseListeners();
  }

  private setupPointerLock(): void {
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = !!(
        document.pointerLockElement &&
        (document.pointerLockElement === this.element ||
          document.pointerLockElement === document.body ||
          document.pointerLockElement === this.element.parentElement)
      );
      if (!this.isLocked) {
        this.isDraggingLook = false;
      }
      for (const listener of this.lockListeners) {
        try {
          listener(this.isLocked);
        } catch (err) {
          console.error('Error in lock listener:', err);
        }
      }
    });

    document.addEventListener('pointerlockerror', (e) => {
      console.warn('Pointer lock error:', e);
    });
  }

  public requestLock(): void {
    if (!this.isLocked) {
      try {
        const promise = (this.element.requestPointerLock || document.body.requestPointerLock).call(this.element) as any;
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            try {
              document.body.requestPointerLock();
            } catch {}
          });
        }
      } catch (err) {
        try {
          document.body.requestPointerLock();
        } catch {}
      }
    }
  }

  public exitLock(): void {
    if (this.isLocked) {
      try {
        document.exitPointerLock();
      } catch (err) {
        console.warn('Could not exit pointer lock:', err);
      }
    }
  }

  public toggleLock(): void {
    if (this.isLocked) {
      this.exitLock();
    } else {
      this.requestLock();
    }
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      // If user is currently typing inside an input or textarea, don't capture game movement
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Alt key toggles pointer lock (Free cursor vs Locked look)
      if (e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'Alt') {
        e.preventDefault();
        e.stopPropagation();
        this.toggleLock();
        return;
      }

      this.keys[e.code] = true;

      // Prevent scrolling and unwanted browser defaults for movement keys
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'Alt') {
        e.preventDefault();
        e.stopPropagation();
      }
      this.keys[e.code] = false;
    });

    // Clear stuck keys if the browser window loses focus
    window.addEventListener('blur', () => {
      this.keys = {};
      this.mouseButtons = {};
      this.isDraggingLook = false;
    });
  }

  private setupMouseListeners(): void {
    // Canvas mousedown
    this.element.addEventListener('mousedown', (e) => {
      this.mouseButtons[e.button] = true;

      if (!this.isLocked) {
        // In free-cursor mode, dragging with right click (or left click on viewport) looks around
        this.isDraggingLook = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        // Auto-request pointer lock on canvas clicks
        if (e.button === 0 || e.button === 2) {
          this.requestLock();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      this.mouseButtons[e.button] = false;
      this.isDraggingLook = false;
    });

    window.addEventListener('mousemove', (e) => {
      let movementX = 0;
      let movementY = 0;

      if (this.isLocked) {
        movementX = e.movementX || 0;
        movementY = e.movementY || 0;
      } else if (this.isDraggingLook || this.mouseButtons[0] || this.mouseButtons[2]) {
        // Orbit / drag-look when pointer is not locked
        movementX = e.clientX - this.lastMouseX;
        movementY = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else {
        return;
      }

      // Update yaw (horizontal look, unbounded)
      this.yaw -= movementX * this.sensitivity;

      // Update pitch (vertical look, clamped)
      const pitchDelta = (this.invertY ? -1 : 1) * movementY * this.sensitivity;
      this.pitch -= pitchDelta;

      // Clamp pitch to avoid gimbal lock / flipping upside down
      const maxPitch = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });

    // Disable context menu on the canvas so right click is seamless for ADS & Block Placing
    this.element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  public getSnapshot(dt: number): UserInput {
    this.sequence++;

    const forward = !!(this.keys['KeyW'] || this.keys['ArrowUp']);
    const backward = !!(this.keys['KeyS'] || this.keys['ArrowDown']);
    const left = !!(this.keys['KeyA'] || this.keys['ArrowLeft']);
    const right = !!(this.keys['KeyD'] || this.keys['ArrowRight']);
    const jump = !!this.keys['Space'];
    const crouch = !!(this.keys['KeyC'] || this.keys['ControlLeft']);
    const sprint = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);

    return {
      sequence: this.sequence,
      forward,
      backward,
      left,
      right,
      jump,
      crouch,
      sprint,
      yaw: this.yaw,
      pitch: this.pitch,
      dt
    };
  }

  public isKeyDown(code: string): boolean {
    return !!this.keys[code];
  }

  public isMouseButtonDown(btn: number): boolean {
    return !!this.mouseButtons[btn];
  }

  public resetInput(): void {
    this.keys = {};
    this.mouseButtons = {};
    this.isDraggingLook = false;
  }
}
