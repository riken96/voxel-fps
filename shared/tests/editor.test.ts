import { VoxelWorld } from '../world/VoxelWorld.ts';
import { BlockId } from '../constants.ts';
import {
  exportMapToJSON,
  importMapFromJSON,
  generateCyberWarehouseTemplate
} from '../world/MapFormat.ts';
import { EditorHistory, EditorAction } from '../../client/src/editor/EditorHistory.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running In-Game Voxel Map Editor & Serialization Test Suite...');

// -------------------------------------------------------------
// Test 1: Map Serialization & Deserialization (Round-trip)
// -------------------------------------------------------------
const world1 = new VoxelWorld();
world1.setBlock(10, 5, -8, BlockId.STONE);
world1.setBlock(-14, 2, 16, BlockId.NEON_CYAN);
world1.setBlock(0, 0, 0, BlockId.WOOD_PLANK);
world1.setBlock(25, 12, 30, BlockId.CRATE);

const exportedJSON = exportMapToJSON(world1, 'Test Roundtrip Arena', 'Engineer');
assert(exportedJSON.name === 'Test Roundtrip Arena', 'Name must match');
assert(exportedJSON.blocks.length === 4, `Expected 4 blocks, got ${exportedJSON.blocks.length}`);

// Load into fresh world2
const world2 = new VoxelWorld();
importMapFromJSON(world2, exportedJSON);

assert(world2.getBlock(10, 5, -8) === BlockId.STONE, 'Block 1 mismatch');
assert(world2.getBlock(-14, 2, 16) === BlockId.NEON_CYAN, 'Block 2 mismatch');
assert(world2.getBlock(0, 0, 0) === BlockId.WOOD_PLANK, 'Block 3 mismatch');
assert(world2.getBlock(25, 12, 30) === BlockId.CRATE, 'Block 4 mismatch');
assert(world2.getBlock(1, 1, 1) === BlockId.AIR, 'Empty block must remain AIR');
console.log('✓ Map JSON serialization & deserialization round-trip passed with 100% fidelity.');

// -------------------------------------------------------------
// Test 2: Cyber Warehouse Template Generation
// -------------------------------------------------------------
const warehouse = generateCyberWarehouseTemplate();
assert(warehouse.blocks.length > 500, `Expected dense warehouse geometry, got ${warehouse.blocks.length} blocks`);
const warehouseWorld = new VoxelWorld();
importMapFromJSON(warehouseWorld, warehouse);
assert(warehouseWorld.isSolid(0, 0, 0) === true, 'Warehouse floor must be solid');
assert(warehouseWorld.isSolid(0, 5, 0) === true, 'Center neon marker must exist');
console.log(`✓ Cyber Warehouse template verified (${warehouse.blocks.length} voxels generated).`);

// -------------------------------------------------------------
// Test 3: Multi-Block Undo / Redo Command Stack
// -------------------------------------------------------------
const editWorld = new VoxelWorld();
editWorld.fillBox(0, 0, 0, 2, 2, 2, BlockId.STONE); // 3x3x3 = 27 stone blocks

const history = new EditorHistory();
assert(history.canUndo() === false, 'Fresh history cannot undo');

// Action: Replace center column with NEON_ORANGE
const deltas = [];
for (let y = 0; y <= 2; y++) {
  deltas.push({
    x: 1,
    y,
    z: 1,
    prevBlockId: BlockId.STONE,
    newBlockId: BlockId.NEON_ORANGE
  });
  editWorld.setBlock(1, y, 1, BlockId.NEON_ORANGE);
}

history.pushAction({ name: 'Paint Column', deltas });
assert(history.canUndo() === true, 'Should be able to undo');
assert(editWorld.getBlock(1, 1, 1) === BlockId.NEON_ORANGE, 'Block should be NEON_ORANGE');

// Dummy chunk renderer updater for test environment
const dummyRenderer = {
  update: () => 0
} as any;

// Execute UNDO
const undone = history.undo(editWorld, dummyRenderer);
assert(undone !== null, 'Undo should succeed');
assert(editWorld.getBlock(1, 1, 1) === BlockId.STONE, 'Block should be reverted to STONE after undo');
assert(history.canRedo() === true, 'Should be able to redo');
console.log('✓ Undo stack successfully reverted multi-block volume to previous state.');

// Execute REDO
const redone = history.redo(editWorld, dummyRenderer);
assert(redone !== null, 'Redo should succeed');
assert(editWorld.getBlock(1, 1, 1) === BlockId.NEON_ORANGE, 'Block should be restored to NEON_ORANGE after redo');
console.log('✓ Redo stack successfully reapplied volume changes.');

console.log('ALL PHASE 4 MAP EDITOR & SERIALIZATION TESTS PASSED SUCCESSFULLY!');
