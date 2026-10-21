import type { MindMapDocument, RelationshipLink } from './types';
import { captureNodeDrafts } from './editorState';

export interface EmergencyNodeDraft {
  documentId: string;
  id: string;
  text: string;
}

/** Build a recovery copy without saving or changing the live document. */
export function emergencyDocument(
  document: MindMapDocument | null,
  relationships: RelationshipLink[],
  draft: EmergencyNodeDraft | null,
): MindMapDocument | null {
  const captured = captureNodeDrafts(document,
    draft && draft.documentId === document?.id ? [draft] : []);
  return captured ? { ...captured, relationships } : null;
}
