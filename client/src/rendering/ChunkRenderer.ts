import * as THREE from 'three';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '@shared/constants.ts';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { GreedyMesher } from './GreedyMesher.ts';
import { TextureAtlas } from './TextureAtlas.ts';

export class ChunkRenderer {
  private meshes: Map<string, THREE.Mesh> = new Map();
  private material: THREE.MeshStandardMaterial;
  private scene: THREE.Scene;

  public totalTriangles = 0;
  public totalChunks = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const atlas = TextureAtlas.get();

    // High-end stylized low-poly material combining procedural atlas texturing,
    // baked directional face shading, smooth vertex ambient occlusion, and emissive glow
    this.material = new THREE.MeshStandardMaterial({
      map: atlas.texture,
      emissiveMap: atlas.emissiveTexture,
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      transparent: true,
      alphaTest: 0.05,
      flatShading: false
    });

    this.material.onBeforeCompile = (shader) => {
      // 1. Pass tile coordinate and voxel UV to fragment shader
      shader.vertexShader = `
        attribute vec2 tileCoord;
        varying vec2 vTileCoord;
        varying vec2 vVoxelUv;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        #include <uv_vertex>
        vTileCoord = tileCoord;
        vVoxelUv = uv;
        `
      );

      // 2. Fragment shader declarations
      shader.fragmentShader = `
        varying vec2 vTileCoord;
        varying vec2 vVoxelUv;
      ` + shader.fragmentShader;

      // 3. Tile repeating inside 16x16 procedural atlas
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 localUV = fract(vVoxelUv);
          vec2 clampedUV = clamp(localUV, 0.002, 0.998);
          vec2 atlasUV = vec2(vTileCoord.x + clampedUV.x, 15.0 - vTileCoord.y + clampedUV.y) / 16.0;
          vec4 texColor = texture2D(map, atlasUV);
          diffuseColor *= texColor;
        #endif
        `
      );

      // 4. Emissive glow sampling from emissive atlas
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #ifdef USE_EMISSIVEMAP
          vec2 localEmissiveUV = fract(vVoxelUv);
          vec2 clampedEmissiveUV = clamp(localEmissiveUV, 0.002, 0.998);
          vec2 atlasEmissiveUV = vec2(vTileCoord.x + clampedEmissiveUV.x, 15.0 - vTileCoord.y + clampedEmissiveUV.y) / 16.0;
          vec4 texEmissive = texture2D(emissiveMap, atlasEmissiveUV);
          totalEmissiveRadiance += texEmissive.rgb * 2.2;
        #endif
        `
      );
    };
  }

  /**
   * Scans the world for dirty chunks and generates updated greedy meshes.
   * Only re-meshes chunks that have been modified or need initial meshing.
   */
  public update(world: VoxelWorld): number {
    let remeshedCount = 0;
    let triangleSum = 0;

    for (const [key, chunk] of world.chunks) {
      if (!chunk.isDirty) {
        const existing = this.meshes.get(key);
        if (existing && existing.geometry.index) {
          triangleSum += existing.geometry.index.count / 3;
        }
        continue;
      }

      // Chunk is dirty -> re-mesh with greedy mesher
      chunk.isDirty = false;
      remeshedCount++;

      const existingMesh = this.meshes.get(key);
      if (existingMesh) {
        this.scene.remove(existingMesh);
        existingMesh.geometry.dispose();
        this.meshes.delete(key);
      }

      if (chunk.isEmpty()) {
        continue;
      }

      const geometry = GreedyMesher.meshChunk(chunk, world);
      if (geometry) {
        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.position.set(
          chunk.cx * CHUNK_SIZE_X,
          chunk.cy * CHUNK_SIZE_Y,
          chunk.cz * CHUNK_SIZE_Z
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);
        this.meshes.set(key, mesh);

        if (geometry.index) {
          triangleSum += geometry.index.count / 3;
        }
      }
    }

    this.totalTriangles = triangleSum;
    this.totalChunks = this.meshes.size;

    return remeshedCount;
  }

  public dispose(): void {
    for (const [, mesh] of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
    this.material.dispose();
  }
}
