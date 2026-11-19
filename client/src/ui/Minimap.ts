import * as THREE from 'three';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { LocalPlayer } from '../entities/LocalPlayer.ts';
import { RemotePlayerManager } from '../entities/RemotePlayerManager.ts';
import { BlockId } from '@shared/constants.ts';
import { Team } from '@shared/match/MatchTypes.ts';

const RADAR_SIZE = 160;
const RADAR_RADIUS = RADAR_SIZE / 2;
const WORLD_RADIUS = 36; // Viewable radius in voxel meters

export class Minimap {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public visible = true;

  private sweepAngle = 0;
  private scanCanvas: HTMLCanvasElement;
  private scanCtx: CanvasRenderingContext2D;
  private lastScanTime = 0;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'hud-minimap-container';
    this.container.style.position = 'absolute';
    this.container.style.top = '14px';
    this.container.style.right = '16px';
    this.container.style.width = `${RADAR_SIZE}px`;
    this.container.style.height = `${RADAR_SIZE}px`;
    this.container.style.borderRadius = '50%';
    this.container.style.background = 'radial-gradient(circle, rgba(10, 18, 28, 0.88) 60%, rgba(4, 8, 14, 0.95) 100%)';
    this.container.style.border = '2px solid rgba(0, 255, 204, 0.45)';
    this.container.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 16px rgba(0, 255, 204, 0.15)';
    this.container.style.backdropFilter = 'blur(8px)';
    this.container.style.overflow = 'hidden';
    this.container.style.zIndex = '140';
    this.container.style.pointerEvents = 'none';

    this.canvas = document.createElement('canvas');
    this.canvas.width = RADAR_SIZE;
    this.canvas.height = RADAR_SIZE;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx = this.canvas.getContext('2d')!;

    // Offscreen buffer for caching local slice of voxel geometry
    this.scanCanvas = document.createElement('canvas');
    this.scanCanvas.width = RADAR_SIZE;
    this.scanCanvas.height = RADAR_SIZE;
    this.scanCtx = this.scanCanvas.getContext('2d')!;

    this.container.appendChild(this.canvas);
    parent.appendChild(this.container);
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Updates radar frame with rotated orientation, local map geometry, and entities.
   */
  public update(
    dt: number,
    localPlayer: LocalPlayer,
    remotePlayers: RemotePlayerManager,
    world: VoxelWorld,
    localTeam: Team = Team.NONE
  ): void {
    if (!this.visible) return;

    this.sweepAngle = (this.sweepAngle + dt * 2.2) % (Math.PI * 2);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

    const playerPos = localPlayer.state.position;
    const playerYaw = localPlayer.state.yaw;

    // Clip circular radar boundary
    ctx.save();
    ctx.beginPath();
    ctx.arc(RADAR_RADIUS, RADAR_RADIUS, RADAR_RADIUS - 2, 0, Math.PI * 2);
    ctx.clip();

    // 1. Radar Grid Circles & Crosshairs
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.12)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(RADAR_RADIUS, RADAR_RADIUS, RADAR_RADIUS * 0.35, 0, Math.PI * 2);
    ctx.arc(RADAR_RADIUS, RADAR_RADIUS, RADAR_RADIUS * 0.70, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(RADAR_RADIUS, 0);
    ctx.lineTo(RADAR_RADIUS, RADAR_SIZE);
    ctx.moveTo(0, RADAR_RADIUS);
    ctx.lineTo(RADAR_SIZE, RADAR_RADIUS);
    ctx.stroke();

    // 2. Render Voxel Walls around Player (world-space slice rotated to player heading)
    const px = Math.floor(playerPos.x);
    const py = Math.floor(playerPos.y);
    const pz = Math.floor(playerPos.z);
    const scale = (RADAR_RADIUS - 8) / WORLD_RADIUS;

    ctx.save();
    ctx.translate(RADAR_RADIUS, RADAR_RADIUS);
    ctx.rotate(playerYaw); // Rotate map so forward is UP

    const scanDist = 28;
    for (let dz = -scanDist; dz <= scanDist; dz += 2) {
      for (let dx = -scanDist; dx <= scanDist; dx += 2) {
        const wx = px + dx;
        const wz = pz + dz;
        const block = world.getBlock(wx, py, wz);

        if (block !== BlockId.AIR) {
          const mapX = (wx - playerPos.x) * scale;
          const mapY = (wz - playerPos.z) * scale;

          if (block === BlockId.JUMP_PAD || block === BlockId.BOUNCE_PAD) {
            ctx.fillStyle = '#ffea00';
            ctx.fillRect(mapX - 2, mapY - 2, 4, 4);
          } else if (block === BlockId.SPEED_PAD) {
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(mapX - 2, mapY - 2, 4, 4);
          } else if (block === BlockId.HAZARD_LAVA) {
            ctx.fillStyle = '#ff3d00';
            ctx.fillRect(mapX - 2, mapY - 2, 4, 4);
          } else {
            ctx.fillStyle = 'rgba(38, 166, 154, 0.35)';
            ctx.fillRect(mapX - 1.5, mapY - 1.5, 3, 3);
          }
        }
      }
    }
    ctx.restore();

    // 3. Radar Sweep Line
    ctx.save();
    ctx.translate(RADAR_RADIUS, RADAR_RADIUS);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, RADAR_RADIUS - 2, this.sweepAngle, this.sweepAngle + 0.35);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 204, 0.08)';
    ctx.fill();
    ctx.restore();

    // 4. Remote Players & AI Bots
    ctx.save();
    ctx.translate(RADAR_RADIUS, RADAR_RADIUS);
    ctx.rotate(playerYaw);

    for (const [, rp] of remotePlayers.players) {
      const rx = rp.group.position.x - playerPos.x;
      const rz = rp.group.position.z - playerPos.z;
      const dist = Math.sqrt(rx * rx + rz * rz);

      if (dist <= WORLD_RADIUS) {
        const blipX = rx * scale;
        const blipY = rz * scale;

        // Is enemy or friendly
        const isTeammate = (localTeam !== Team.NONE && rp.team === localTeam);

        ctx.fillStyle = isTeammate ? '#29b6f6' : '#ff1744';
        ctx.beginPath();
        ctx.arc(blipX, blipY, isTeammate ? 3.5 : 4, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing warning ring for nearby enemies
        if (!isTeammate && dist < 18) {
          ctx.strokeStyle = 'rgba(255, 23, 68, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(blipX, blipY, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // 5. Local Player Center Marker with Forward View Cone
    ctx.save();
    ctx.translate(RADAR_RADIUS, RADAR_RADIUS);

    // View cone (45 degrees forward)
    ctx.fillStyle = 'rgba(0, 255, 204, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 28, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
    ctx.closePath();
    ctx.fill();

    // Arrow indicator pointing up
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 6. Cardinal Direction Ring (N, E, S, W)
    ctx.restore(); // Exit circular clip

    const cardinalDist = RADAR_RADIUS - 9;
    const cardinals = [
      { label: 'N', angle: -playerYaw - Math.PI / 2 },
      { label: 'E', angle: -playerYaw },
      { label: 'S', angle: -playerYaw + Math.PI / 2 },
      { label: 'W', angle: -playerYaw + Math.PI }
    ];

    ctx.font = "900 8px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const c of cardinals) {
      const cx = RADAR_RADIUS + Math.cos(c.angle) * cardinalDist;
      const cy = RADAR_RADIUS + Math.sin(c.angle) * cardinalDist;

      ctx.fillStyle = c.label === 'N' ? '#ff5252' : 'rgba(255, 255, 255, 0.65)';
      ctx.fillText(c.label, cx, cy);
    }
  }

  public dispose(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
