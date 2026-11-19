import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { ChunkRenderer } from '../rendering/ChunkRenderer.ts';

export interface BlockDelta {
  x: number;
  y: number;
  z: number;
  prevBlockId: number;
  newBlockId: number;
}

export interface EditorAction {
  name: string;
  deltas: BlockDelta[];
}

export class EditorHistory {
  private undoStack: EditorAction[] = [];
  private redoStack: EditorAction[] = [];
  private maxHistory = 60;

  public pushAction(action: EditorAction): void {
    if (action.deltas.length === 0) return;

    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // New action invalidates previous redo branch
    this.redoStack = [];
  }

  public undo(world: VoxelWorld, chunkRenderer: ChunkRenderer): EditorAction | null {
    const action = this.undoStack.pop();
    if (!action) return null;

    // Revert deltas in reverse order
    for (let i = action.deltas.length - 1; i >= 0; i--) {
      const d = action.deltas[i];
      world.setBlock(d.x, d.y, d.z, d.prevBlockId);
    }

    chunkRenderer.update(world);
    this.redoStack.push(action);
    return action;
  }

  public redo(world: VoxelWorld, chunkRenderer: ChunkRenderer): EditorAction | null {
    const action = this.redoStack.pop();
    if (!action) return null;

    // Re-apply deltas in forward order
    for (const d of action.deltas) {
      world.setBlock(d.x, d.y, d.z, d.newBlockId);
    }

    chunkRenderer.update(world);
    this.undoStack.push(action);
    return action;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
