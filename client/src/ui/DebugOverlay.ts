import { PlayerState } from '@shared/physics/PlayerState.ts';
import { VoxelRaycastHit } from '@shared/math/Ray.ts';
import { getBlockDef } from '@shared/world/BlockTypes.ts';

export class DebugOverlay {
  private element: HTMLElement;
  private netDisplay: HTMLElement;
  private fpsDisplay: HTMLElement;
  private posDisplay: HTMLElement;
  private speedDisplay: HTMLElement;
  private stateDisplay: HTMLElement;
  private renderDisplay: HTMLElement;
  private targetDisplay: HTMLElement;

  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 60;
  public visible = true;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'debug-overlay';
    this.element.style.position = 'absolute';
    this.element.style.top = '14px';
    this.element.style.left = '14px';
    this.element.style.color = '#e0f7fa';
    this.element.style.fontFamily = "'JetBrains Mono', 'Courier New', monospace";
    this.element.style.fontSize = '12px';
    this.element.style.backgroundColor = 'rgba(10, 16, 26, 0.85)';
    this.element.style.padding = '12px 16px';
    this.element.style.borderRadius = '6px';
    this.element.style.border = '1px solid rgba(0, 255, 204, 0.3)';
    this.element.style.backdropFilter = 'blur(6px)';
    this.element.style.lineHeight = '1.6';
    this.element.style.pointerEvents = 'none';
    this.element.style.zIndex = '200';

    this.netDisplay = document.createElement('div');
    this.fpsDisplay = document.createElement('div');
    this.posDisplay = document.createElement('div');
    this.speedDisplay = document.createElement('div');
    this.stateDisplay = document.createElement('div');
    this.renderDisplay = document.createElement('div');
    this.targetDisplay = document.createElement('div');

    this.element.appendChild(this.netDisplay);
    this.element.appendChild(this.fpsDisplay);
    this.element.appendChild(this.posDisplay);
    this.element.appendChild(this.speedDisplay);
    this.element.appendChild(this.stateDisplay);
    this.element.appendChild(this.renderDisplay);
    this.element.appendChild(this.targetDisplay);

    parent.appendChild(this.element);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'F3') {
        this.setVisible(!this.visible);
      }
    });
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.element.style.display = this.visible ? 'block' : 'none';
  }

  public update(
    playerState: PlayerState,
    totalChunks: number,
    totalTriangles: number,
    targetHit: VoxelRaycastHit | null,
    netStatus: string,
    pingMs: number,
    remoteCount: number,
    reconciledCount: number
  ): void {
    if (!this.visible) return;

    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;
    if (elapsed >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    const hozSpeed = playerState.velocity.horizontalLength();
    const fpsColor = this.currentFps >= 55 ? '#00ffcc' : this.currentFps >= 30 ? '#ffb300' : '#ff5252';

    // Net status badge
    const statusColor = netStatus === 'Connected' ? '#00e676' : '#ff9100';
    this.netDisplay.innerHTML = `Net: <span style="color:${statusColor}; font-weight:bold;">${netStatus}</span> | Ping: <span style="color:#00e676;">${pingMs}ms</span> | Players: ${remoteCount + 1} | Reconciled: ${reconciledCount}`;

    this.fpsDisplay.innerHTML = `<span style="color: ${fpsColor}; font-weight: bold;">FPS: ${this.currentFps}</span> <span style="color:#78909c;">(60Hz Deterministic Tick)</span>`;

    this.posDisplay.innerHTML = `XYZ: <span style="color:#ffffff;">${playerState.position.x.toFixed(2)} / ${playerState.position.y.toFixed(2)} / ${playerState.position.z.toFixed(2)}</span>`;

    const speedColor = hozSpeed > 14 ? '#ff0055' : hozSpeed > 9 ? '#00ffcc' : '#b0bec5';
    this.speedDisplay.innerHTML = `Speed: <span style="color:${speedColor}; font-weight:bold;">${hozSpeed.toFixed(1)} m/s</span> | Vert: ${playerState.velocity.y.toFixed(1)} m/s`;

    const groundedBadge = playerState.isGrounded
      ? `<span style="background:#00e676; color:#000; padding:1px 4px; border-radius:3px; font-weight:bold;">GROUND</span>`
      : `<span style="background:#29b6f6; color:#000; padding:1px 4px; border-radius:3px; font-weight:bold;">AIR</span>`;

    const crouchBadge = playerState.isCrouching
      ? `<span style="background:#ab47bc; color:#fff; padding:1px 4px; border-radius:3px; font-weight:bold;">SLIDE</span>`
      : '';

    const sprintBadge = playerState.isSprinting
      ? `<span style="background:#ff9100; color:#000; padding:1px 4px; border-radius:3px; font-weight:bold;">SPRINT</span>`
      : '';

    this.stateDisplay.innerHTML = `State: ${groundedBadge} ${crouchBadge} ${sprintBadge}`;

    this.renderDisplay.innerHTML = `Meshing: <span style="color:#00ffcc;">${totalChunks} Chunks</span> | <span style="color:#00ffcc;">${totalTriangles.toLocaleString()} Tris</span> (Greedy)`;

    if (targetHit && targetHit.hit) {
      const def = getBlockDef(targetHit.blockId);
      this.targetDisplay.innerHTML = `Target: <span style="color:#ffd54f;">${def.name}</span> (${targetHit.blockX}, ${targetHit.blockY}, ${targetHit.blockZ}) Dist: ${targetHit.distance.toFixed(1)}m`;
    } else {
      this.targetDisplay.innerHTML = `Target: <span style="color:#78909c;">None</span>`;
    }
  }
}
