import * as THREE from 'three';
import { RemotePlayerSnapshot } from '@shared/protocol/Messages.ts';
import { RemotePlayer } from './RemotePlayer.ts';

export class RemotePlayerManager {
  private scene: THREE.Scene;
  public players: Map<string, RemotePlayer> = new Map();
  public interpolationDelayMs = 70; // 70ms buffer absorbs typical internet jitter

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public addSnapshot(snap: RemotePlayerSnapshot, serverTime: number): void {
    let player = this.players.get(snap.id);
    if (!player) {
      player = new RemotePlayer(snap.id, snap.username, this.scene);
      this.players.set(snap.id, player);
    }
    player.addSnapshot(snap, serverTime);
  }

  public update(currentServerTime: number, dt: number): void {
    const renderTargetTime = currentServerTime - this.interpolationDelayMs;

    for (const [, player] of this.players) {
      player.updateInterpolation(renderTargetTime, dt);
    }
  }

  public removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      player.dispose(this.scene);
      this.players.delete(id);
    }
  }

  public getCount(): number {
    return this.players.size;
  }

  public dispose(): void {
    for (const [, player] of this.players) {
      player.dispose(this.scene);
    }
    this.players.clear();
  }
}
