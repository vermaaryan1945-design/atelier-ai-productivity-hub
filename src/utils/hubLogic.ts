import type {
  DocumentItem,
  HubMetrics,
  TaskItem,
  TaskPriority,
} from '../types/hub';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function extractGoogleDocId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]{10,})/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function buildProviderPrompt(params: {
  provider: 'chatgpt' | 'claude';
  taskLabel: string;
  prompt: string;
  context?: string;
  tone?: string;
  length?: string;
}): string {
  const { provider, taskLabel, prompt, context, tone, length } = params;
  const assistantName = provider === 'chatgpt' ? 'ChatGPT' : 'Claude';

  const lines: string[] = [
    `# Role & Objective (${assistantName} Reusable Prompt)`,
    `Act as an executive communications strategist and productivity specialist. Perform: ${taskLabel}.`,
  ];

  if (tone) {
    lines.push(`Target Tone: ${tone}`);
  }
  if (length) {
    lines.push(`Target Length: ${length}`);
  }

  lines.push('', '## Primary Brief', prompt.trim() || '[Insert your brief or request here]');

  if (context && context.trim()) {
    lines.push('', '## Reference Context / Draft', context.trim());
  }

  lines.push(
    '',
    '## Output Standards',
    '- Lead with the core deliverable immediately without conversational filler.',
    '- Use crisp, structured formatting with clear headings or concise paragraphs.',
    '- Keep phrasing precise, accurate, and executive-ready.'
  );

  return lines.join('\n');
}

export function computeHubMetrics(
  tasks: TaskItem[],
  projects: { status: string }[],
  documents: DocumentItem[]
): HubMetrics {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const openTasks = totalTasks - completedTasks;
  const highPriorityOpen = tasks.filter(
    (t) => t.status !== 'done' && t.priority === 'high'
  ).length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const totalDocuments = documents.length;

  return {
    totalTasks,
    openTasks,
    completedTasks,
    highPriorityOpen,
    completionRate,
    totalProjects,
    activeProjects,
    totalDocuments,
  };
}

export function filterTasks(
  tasks: TaskItem[],
  query: string,
  status: string,
  priority: string
): TaskItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return [...tasks]
    .filter((task) => {
      if (status !== 'all' && task.status !== status) return false;
      if (priority !== 'all' && task.priority !== priority) return false;
      if (!normalizedQuery) return true;
      return (
        task.title.toLowerCase().includes(normalizedQuery) ||
        task.notes.toLowerCase().includes(normalizedQuery) ||
        task.source.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function filterDocuments(
  documents: DocumentItem[],
  query: string,
  category: string
): DocumentItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return [...documents]
    .filter((doc) => {
      if (category !== 'all' && doc.category !== category) return false;
      if (!normalizedQuery) return true;
      return (
        doc.title.toLowerCase().includes(normalizedQuery) ||
        doc.content.toLowerCase().includes(normalizedQuery) ||
        doc.provider.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function formatShortDate(iso: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportTasksToCsv(
  tasks: TaskItem[],
  projects: Array<{ id: string; name: string }>
): string {
  const header = ['Title', 'Status', 'Priority', 'Due Date', 'Project', 'Source', 'Notes'];
  const rows = tasks.map((task) => {
    const projectName = projects.find((p) => p.id === task.projectId)?.name ?? '';
    return [
      task.title,
      task.status,
      task.priority,
      task.dueDate,
      projectName,
      task.source,
      task.notes,
    ]
      .map((cell) => escapeCsvCell(cell ?? ''))
      .join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

export function exportHubBackupJson(payload: {
  tasks: TaskItem[];
  projects: Array<{ id: string; name: string }>;
  documents: DocumentItem[];
}): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      application: 'Atelier AI Productivity Hub',
      ...payload,
    },
    null,
    2
  );
}

