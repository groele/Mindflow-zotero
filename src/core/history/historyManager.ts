import { MindMapNode } from '../model/types';
import { cloneTree } from '../model/treeOps';

export class HistoryManager {
  private undoStack: MindMapNode[] = [];
  private redoStack: MindMapNode[] = [];
  private maxSteps: number;

  constructor(maxSteps = 50) {
    this.maxSteps = maxSteps;
  }

  public push(state: MindMapNode): void {
    // Editor operations create a new tree before pushing the previous state.
    // Avoid serializing the entire map on every edit; keep a defensive snapshot.
    this.undoStack.push(cloneTree(state));
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  public undo(currentState: MindMapNode): MindMapNode | null {
    if (!this.canUndo()) return null;

    const previousState = this.undoStack.pop()!;
    this.redoStack.push(cloneTree(currentState));
    return cloneTree(previousState);
  }

  public redo(currentState: MindMapNode): MindMapNode | null {
    if (!this.canRedo()) return null;

    const nextState = this.redoStack.pop()!;
    this.undoStack.push(cloneTree(currentState));
    return cloneTree(nextState);
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
