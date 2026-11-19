import * as THREE from 'three';
import { VoxelRaycastHit } from '@shared/math/Ray.ts';

/**
 * Visual wireframe cube that snaps to the targeted voxel block.
 */
export class VoxelHighlight {
  public mesh: THREE.LineSegments;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const boxGeometry = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const material = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      linewidth: 2,
      depthTest: true
    });

    this.mesh = new THREE.LineSegments(edges, material);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  public update(hit: VoxelRaycastHit | null): void {
    if (!hit || !hit.hit) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    // Voxel coordinates are integer block corners; center is +0.5
    this.mesh.position.set(
      hit.blockX + 0.5,
      hit.blockY + 0.5,
      hit.blockZ + 0.5
    );
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
}
