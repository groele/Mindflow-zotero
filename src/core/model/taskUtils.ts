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
