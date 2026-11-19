import * as THREE from 'three';
import { BlockId } from '@shared/constants.ts';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { VoxelRaycastHit } from '@shared/math/Ray.ts';
import { ChunkRenderer } from '../rendering/ChunkRenderer.ts';
import { EditorHistory, BlockDelta } from './EditorHistory.ts';

export enum BrushType {
  SINGLE = '1x1',
  CUBE_2X2 = '2x2',
  CUBE_3X3 = '3x3',
  BOX_FILL = 'Box Fill',
  EYEDROPPER = 'Eyedropper'
}

export class MapEditor {
  public activeBrush: BrushType = BrushType.SINGLE;
  public activeBlockId: number = BlockId.CONCRETE;
  public history: EditorHistory;

  // Box Fill Corner State
  public boxCorner1: [number, number, number] | null = null;

  // 3D Preview Wireframe
  public previewMesh: THREE.LineSegments;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.history = new EditorHistory();

    const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const mat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      linewidth: 2,
      depthTest: true
    });
    this.previewMesh = new THREE.LineSegments(edges, mat);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);
  }

  public setBrush(brush: BrushType): void {
    this.activeBrush = brush;
    this.boxCorner1 = null;
    this.updatePreviewScale();
  }

  private updatePreviewScale(): void {
    switch (this.activeBrush) {
      case BrushType.SINGLE:
        this.previewMesh.scale.set(1.002, 1.002, 1.002);
        break;
      case BrushType.CUBE_2X2:
        this.previewMesh.scale.set(2.002, 2.002, 2.002);
        break;
      case BrushType.CUBE_3X3:
        this.previewMesh.scale.set(3.002, 3.002, 3.002);
        break;
    }
  }

  public updatePreview(hit: VoxelRaycastHit | null, isPlacing: boolean): void {
    if (!hit || !hit.hit) {
      this.previewMesh.visible = false;
      return;
    }

    this.previewMesh.visible = true;

    // Eyedropper preview: snaps directly onto target block
    if (this.activeBrush === BrushType.EYEDROPPER) {
      this.previewMesh.scale.set(1.002, 1.002, 1.002);
      this.previewMesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
      return;
    }

    // Box Fill preview
    if (this.activeBrush === BrushType.BOX_FILL && this.boxCorner1) {
      const [c1x, c1y, c1z] = this.boxCorner1;
      const c2x = isPlacing ? hit.blockX + hit.faceNormal.x : hit.blockX;
      const c2y = isPlacing ? hit.blockY + hit.faceNormal.y : hit.blockY;
      const c2z = isPlacing ? hit.blockZ + hit.faceNormal.z : hit.blockZ;

      const minX = Math.min(c1x, c2x);
      const maxX = Math.max(c1x, c2x) + 1;
      const minY = Math.min(c1y, c2y);
      const maxY = Math.max(c1y, c2y) + 1;
      const minZ = Math.min(c1z, c2z);
      const maxZ = Math.max(c1z, c2z) + 1;

      const sizeX = maxX - minX;
      const sizeY = maxY - minY;
      const sizeZ = maxZ - minZ;

      this.previewMesh.scale.set(sizeX + 0.002, sizeY + 0.002, sizeZ + 0.002);
      this.previewMesh.position.set(minX + sizeX * 0.5, minY + sizeY * 0.5, minZ + sizeZ * 0.5);
      return;
    }

    // Standard brushes
    const targetX = isPlacing ? hit.blockX + hit.faceNormal.x : hit.blockX;
    const targetY = isPlacing ? hit.blockY + hit.faceNormal.y : hit.blockY;
    const targetZ = isPlacing ? hit.blockZ + hit.faceNormal.z : hit.blockZ;

    this.updatePreviewScale();
    const halfScaleX = this.previewMesh.scale.x * 0.5;
    const halfScaleY = this.previewMesh.scale.y * 0.5;
    const halfScaleZ = this.previewMesh.scale.z * 0.5;

    this.previewMesh.position.set(
      targetX + halfScaleX,
      targetY + halfScaleY,
      targetZ + halfScaleZ
    );
  }

  public place(
    hit: VoxelRaycastHit,
    world: VoxelWorld,
    chunkRenderer: ChunkRenderer,
    onBlockChanged?: (x: number, y: number, z: number, id: number) => void
  ): boolean {
    if (this.activeBrush === BrushType.EYEDROPPER) {
      this.activeBlockId = hit.blockId;
      return true;
    }

    if (this.activeBrush === BrushType.BOX_FILL) {
      const placeX = hit.blockX + hit.faceNormal.x;
      const placeY = hit.blockY + hit.faceNormal.y;
      const placeZ = hit.blockZ + hit.faceNormal.z;

      if (!this.boxCorner1) {
        // Set first corner
        this.boxCorner1 = [placeX, placeY, placeZ];
        return true;
      } else {
        // Set second corner & execute box fill
        const [c1x, c1y, c1z] = this.boxCorner1;
        this.boxCorner1 = null;

        const minX = Math.min(c1x, placeX);
        const maxX = Math.max(c1x, placeX);
        const minY = Math.min(c1y, placeY);
        const maxY = Math.max(c1y, placeY);
        const minZ = Math.min(c1z, placeZ);
        const maxZ = Math.max(c1z, placeZ);

        const deltas: BlockDelta[] = [];
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              const prev = world.getBlock(x, y, z);
              if (prev !== this.activeBlockId) {
                world.setBlock(x, y, z, this.activeBlockId);
                deltas.push({ x, y, z, prevBlockId: prev, newBlockId: this.activeBlockId });
                if (onBlockChanged) onBlockChanged(x, y, z, this.activeBlockId);
              }
            }
          }
        }

        if (deltas.length > 0) {
          this.history.pushAction({ name: 'Box Fill', deltas });
          chunkRenderer.update(world);
          return true;
        }
        return false;
      }
    }

    // Standard Multi-block / Single brush
    const baseX = hit.blockX + hit.faceNormal.x;
    const baseY = hit.blockY + hit.faceNormal.y;
    const baseZ = hit.blockZ + hit.faceNormal.z;
    const size = this.activeBrush === BrushType.CUBE_3X3 ? 3 : this.activeBrush === BrushType.CUBE_2X2 ? 2 : 1;

    const deltas: BlockDelta[] = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const bx = baseX + x;
          const by = baseY + y;
          const bz = baseZ + z;
          const prev = world.getBlock(bx, by, bz);
          if (prev !== this.activeBlockId) {
            world.setBlock(bx, by, bz, this.activeBlockId);
            deltas.push({ x: bx, y: by, z: bz, prevBlockId: prev, newBlockId: this.activeBlockId });
            if (onBlockChanged) onBlockChanged(bx, by, bz, this.activeBlockId);
          }
        }
      }
    }

    if (deltas.length > 0) {
      this.history.pushAction({ name: `Place ${this.activeBrush}`, deltas });
      chunkRenderer.update(world);
      return true;
    }
    return false;
  }

  public erase(
    hit: VoxelRaycastHit,
    world: VoxelWorld,
    chunkRenderer: ChunkRenderer,
    onBlockChanged?: (x: number, y: number, z: number, id: number) => void
  ): boolean {
    const size = this.activeBrush === BrushType.CUBE_3X3 ? 3 : this.activeBrush === BrushType.CUBE_2X2 ? 2 : 1;

    const deltas: BlockDelta[] = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const bx = hit.blockX + x;
          const by = hit.blockY + y;
          const bz = hit.blockZ + z;
          const prev = world.getBlock(bx, by, bz);
          if (prev !== BlockId.AIR) {
            world.setBlock(bx, by, bz, BlockId.AIR);
            deltas.push({ x: bx, y: by, z: bz, prevBlockId: prev, newBlockId: BlockId.AIR });
            if (onBlockChanged) onBlockChanged(bx, by, bz, BlockId.AIR);
          }
        }
      }
    }

    if (deltas.length > 0) {
      this.history.pushAction({ name: `Erase ${this.activeBrush}`, deltas });
      chunkRenderer.update(world);
      return true;
    }
    return false;
  }

  public dispose(): void {
    this.scene.remove(this.previewMesh);
    this.previewMesh.geometry.dispose();
  }
}
