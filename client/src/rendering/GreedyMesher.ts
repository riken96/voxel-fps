import * as THREE from 'three';
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  BlockId
} from '@shared/constants.ts';
import { Chunk } from '@shared/world/Chunk.ts';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { getBlockDef, isBlockSolid } from '@shared/world/BlockTypes.ts';
import { TextureAtlas } from './TextureAtlas.ts';

interface MaskCell {
  blockId: number;
  dir: number; // +1 for positive face, -1 for negative face
}

function computeVertexAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) {
    return 0.52;
  }
  const count = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
  switch (count) {
    case 0: return 1.0;
    case 1: return 0.82;
    case 2: return 0.67;
    case 3: return 0.52;
    default: return 1.0;
  }
}

/**
 * Optimized Greedy Mesher based on Mikola Lysenko's algorithm.
 * Merges coplanar adjacent voxel faces into unified quads, dramatically
 * reducing vertex counts, draw calls, and fragment shading overhead.
 */
export class GreedyMesher {
  public static meshChunk(chunk: Chunk, world: VoxelWorld): THREE.BufferGeometry | null {
    if (chunk.isEmpty()) {
      return null;
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const tileCoords: number[] = [];
    const indices: number[] = [];

    const dims = [CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z];
    const atlas = TextureAtlas.get();

    // Helper to query block with world boundary fallback
    const getBlockAt = (bx: number, by: number, bz: number): number => {
      if (
        bx >= 0 && bx < CHUNK_SIZE_X &&
        by >= 0 && by < CHUNK_SIZE_Y &&
        bz >= 0 && bz < CHUNK_SIZE_Z
      ) {
        return chunk.getBlock(bx, by, bz);
      }
      // World coordinate fallback for seamless cross-chunk culling
      const wx = chunk.cx * CHUNK_SIZE_X + bx;
      const wy = chunk.cy * CHUNK_SIZE_Y + by;
      const wz = chunk.cz * CHUNK_SIZE_Z + bz;
      return world.getBlock(wx, wy, wz);
    };

    let vertexOffset = 0;

    // Iterate through all 3 axes (0 = X, 1 = Y, 2 = Z)
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;

      const x = [0, 0, 0];
      const q = [0, 0, 0];
      q[d] = 1;

      // 2D mask for slicing plane
      const mask: (MaskCell | null)[] = new Array(dims[u] * dims[v]).fill(null);

      for (x[d] = -1; x[d] < dims[d]; ) {
        // 1. Build mask for current slice
        let n = 0;
        for (x[v] = 0; x[v] < dims[v]; x[v]++) {
          for (x[u] = 0; x[u] < dims[u]; x[u]++) {
            const blockA = x[d] >= 0 ? getBlockAt(x[0], x[1], x[2]) : BlockId.AIR;
            const blockB =
              x[d] < dims[d] - 1
                ? getBlockAt(x[0] + q[0], x[1] + q[1], x[2] + q[2])
                : BlockId.AIR;

            const defA = getBlockDef(blockA);
            const defB = getBlockDef(blockB);

            const solidA = defA.isSolid;
            const solidB = defB.isSolid;

            if (solidA === solidB) {
              mask[n++] = null;
            } else if (solidA) {
              // Face pointing in +d direction
              mask[n++] = { blockId: blockA, dir: 1 };
            } else {
              // Face pointing in -d direction
              mask[n++] = { blockId: blockB, dir: -1 };
            }
          }
        }

        x[d]++;

        // 2. Greedy merge adjacent matching mask cells into quads
        n = 0;
        for (let j = 0; j < dims[v]; j++) {
          for (let i = 0; i < dims[u]; ) {
            const current = mask[n];
            if (current !== null) {
              // Compute width w along u axis
              let w = 1;
              while (
                i + w < dims[u] &&
                mask[n + w] !== null &&
                mask[n + w]!.blockId === current.blockId &&
                mask[n + w]!.dir === current.dir
              ) {
                w++;
              }

              // Compute height h along v axis
              let h = 1;
              let canGrow = true;
              while (j + h < dims[v] && canGrow) {
                for (let k = 0; k < w; k++) {
                  const check = mask[n + k + h * dims[u]];
                  if (
                    check === null ||
                    check.blockId !== current.blockId ||
                    check.dir !== current.dir
                  ) {
                    canGrow = false;
                    break;
                  }
                }
                if (canGrow) h++;
              }

              // Generate Quad geometry
              x[u] = i;
              x[v] = j;

              const du = [0, 0, 0];
              const dv = [0, 0, 0];
              du[u] = w;
              dv[v] = h;

              // Face normal vector
              const normal = [0, 0, 0];
              normal[d] = current.dir;

              // Quad corner coordinates in chunk local space
              const c0 = [x[0], x[1], x[2]];
              const c1 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
              const c2 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
              const c3 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];

              // Block definition & tile coordinate from procedural atlas
              const blockDef = getBlockDef(current.blockId);
              const tile = atlas.getTileCoord(current.blockId, d, current.dir);

              // Directional face shading (subtle top lighting baked into vertex colors)
              let faceShade = 1.0;
              if (normal[1] > 0) faceShade = 1.0;       // Top (+Y)
              else if (normal[1] < 0) faceShade = 0.55;  // Bottom (-Y)
              else if (normal[0] !== 0) faceShade = 0.8; // X sides
              else if (normal[2] !== 0) faceShade = 0.7; // Z sides

              // Sample Ambient Occlusion in the adjacent air layer
              const airD = current.dir > 0 ? x[d] : x[d] - 1;
              const sampleSolid = (su: number, sv: number): boolean => {
                const coord = [0, 0, 0];
                coord[d] = airD;
                coord[u] = su;
                coord[v] = sv;
                return isBlockSolid(getBlockAt(coord[0], coord[1], coord[2]));
              };

              // Corner 0: (i, j)
              let ao0 = computeVertexAO(
                sampleSolid(i - 1, j),
                sampleSolid(i, j - 1),
                sampleSolid(i - 1, j - 1)
              );
              // Corner 1: (i + w, j)
              let ao1 = computeVertexAO(
                sampleSolid(i + w, j),
                sampleSolid(i + w - 1, j - 1),
                sampleSolid(i + w, j - 1)
              );
              // Corner 2: (i + w, j + h)
              let ao2 = computeVertexAO(
                sampleSolid(i + w, j + h - 1),
                sampleSolid(i + w - 1, j + h),
                sampleSolid(i + w, j + h)
              );
              // Corner 3: (i, j + h)
              let ao3 = computeVertexAO(
                sampleSolid(i - 1, j + h - 1),
                sampleSolid(i, j + h),
                sampleSolid(i - 1, j + h)
              );

              // Emissive bloom boost: glowing neon surfaces don't receive dark AO
              if (blockDef.emissive) {
                ao0 = ao1 = ao2 = ao3 = 1.0;
                faceShade = 1.0;
              }

              // Quad corner UV coordinates so multi-block merged faces tile cleanly per 1x1 block
              let uv0 = [0, 0];
              let uv1 = [w, 0];
              let uv2 = [w, h];
              let uv3 = [0, h];

              if (d === 0) {
                // X axis face: u is Y (vertical), v is Z (horizontal)
                uv0 = [0, 0];
                uv1 = [0, w];
                uv2 = [h, w];
                uv3 = [h, 0];
              }

              let quadAOs = [ao0, ao1, ao2, ao3];

              if (current.dir > 0) {
                // Winding order for positive face
                positions.push(
                  c0[0], c0[1], c0[2],
                  c1[0], c1[1], c1[2],
                  c2[0], c2[1], c2[2],
                  c3[0], c3[1], c3[2]
                );
                uvs.push(
                  uv0[0], uv0[1],
                  uv1[0], uv1[1],
                  uv2[0], uv2[1],
                  uv3[0], uv3[1]
                );
                quadAOs = [ao0, ao1, ao2, ao3];
              } else {
                // Winding order for negative face
                positions.push(
                  c0[0], c0[1], c0[2],
                  c3[0], c3[1], c3[2],
                  c2[0], c2[1], c2[2],
                  c1[0], c1[1], c1[2]
                );
                uvs.push(
                  uv0[0], uv0[1],
                  uv3[0], uv3[1],
                  uv2[0], uv2[1],
                  uv1[0], uv1[1]
                );
                quadAOs = [ao0, ao3, ao2, ao1];
              }

              for (let vIdx = 0; vIdx < 4; vIdx++) {
                normals.push(normal[0], normal[1], normal[2]);
                const ao = quadAOs[vIdx];
                const finalShade = ao * faceShade;
                colors.push(finalShade, finalShade, finalShade);
                tileCoords.push(tile.col, tile.row);
              }

              // Diagonal flip to prevent anisotropic quad crease artifacts
              if (quadAOs[0] + quadAOs[2] > quadAOs[1] + quadAOs[3]) {
                indices.push(
                  vertexOffset,
                  vertexOffset + 1,
                  vertexOffset + 2,
                  vertexOffset,
                  vertexOffset + 2,
                  vertexOffset + 3
                );
              } else {
                indices.push(
                  vertexOffset + 1,
                  vertexOffset + 2,
                  vertexOffset + 3,
                  vertexOffset + 1,
                  vertexOffset + 3,
                  vertexOffset
                );
              }
              vertexOffset += 4;

              // Zero-out mask for merged rectangle
              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) {
                  mask[n + k + l * dims[u]] = null;
                }
              }

              i += w;
              n += w;
            } else {
              i++;
              n++;
            }
          }
        }
      }
    }

    if (positions.length === 0) {
      return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('tileCoord', new THREE.Float32BufferAttribute(tileCoords, 2));
    geometry.setIndex(indices);

    return geometry;
  }
}
