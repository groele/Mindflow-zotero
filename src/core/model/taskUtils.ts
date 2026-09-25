import { MindMapNode, TaskStatus } from './types';

export interface MapTask {
  nodeId: string;
  text: string;
  status: TaskStatus;
  dueDate?: string;
  priority?: 1 | 2 | 3;
  overdue: boolean;
}

export function collectMapTasks(root: MindMapNode, today = new Date()): MapTask[] {
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const tasks: MapTask[] = [];
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.task) {
      tasks.push({
        nodeId: node.id,
        text: node.text,
        status: node.task.status,
        dueDate: node.task.dueDate,
        priority: node.task.priority,
        overdue: node.task.status !== 'done' && Boolean(node.task.dueDate && node.task.dueDate < localToday),
      });
    }
    for (let i = node.children.length - 1; i >= 0; i -= 1) pending.push(node.children[i]);
  }
  return tasks;
}

export interface BranchTaskProgress { total: number; done: number }

export function summarizeBranchTasks(root: MindMapNode): Map<string, BranchTaskProgress> {
  const progress = new Map<string, BranchTaskProgress>();
  const pending: Array<{ node: MindMapNode; visited: boolean }> = [{ node: root, visited: false }];
  while (pending.length) {
    const { node, visited } = pending.pop()!;
    if (!visited) {
      pending.push({ node, visited: true });
      for (const child of node.children) pending.push({ node: child, visited: false });
      continue;
    }
    const summary = { total: node.task ? 1 : 0, done: node.task?.status === 'done' ? 1 : 0 };
    for (const child of node.children) {
      const childSummary = progress.get(child.id);
      if (childSummary) { summary.total += childSummary.total; summary.done += childSummary.done; }
    }
    progress.set(node.id, summary);
  }
  return progress;
}
