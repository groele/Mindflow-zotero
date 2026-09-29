import { MindMapNode, RelationshipLink } from '../model/types';
import { cloneTree } from '../model/treeOps';

export interface EditorState { root: MindMapNode; relationships: RelationshipLink[] }
function cloneState(state: EditorState): EditorState {
  return { root: cloneTree(state.root), relationships: state.relationships.map(link => ({ ...link })) };
}

export class HistoryManager {
  private undoStack: EditorState[] = [];
  private redoStack: EditorState[] = [];
  private maxSteps: number;

  constructor(maxSteps = 50) {
    this.maxSteps = maxSteps;
  }

  public push(state: EditorState): void {
    // Editor operations create a new tree before pushing the previous state.
    // Avoid serializing the entire map on every edit; keep a defensive snapshot.
    this.undoStack.push(cloneState(state));
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  public undo(currentState: EditorState): EditorState | null {
    if (!this.canUndo()) return null;

    const previousState = this.undoStack.pop()!;
    this.redoStack.push(cloneState(currentState));
    return cloneState(previousState);
  }

  public redo(currentState: EditorState): EditorState | null {
    if (!this.canRedo()) return null;

    const nextState = this.redoStack.pop()!;
    this.undoStack.push(cloneState(currentState));
    return cloneState(nextState);
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
