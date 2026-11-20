import type {
  DocumentCategory,
  DocumentItem,
  HubData,
  ProjectItem,
  ProjectStatus,
  TaskItem,
  TaskPriority,
  TaskStatus,
  WorkspaceNoteItem,
} from '../types/hub';

const STORAGE_KEY = 'atelier_productivity_hub_v1';

function createClientSeed(): HubData {
  const now = new Date().toISOString();
  return {
    projects: [
      {
        id: 'proj-q4-ops',
        name: 'Q4 Executive Operating Plan',
        summary:
          'Cross-functional alignment across product engineering, enterprise delivery, and board communications for Q4.',
        owner: 'Operations Lead',
        status: 'active',
        targetDate: '2026-12-15',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'proj-client-briefs',
        name: 'Enterprise Client Briefings',
        summary:
          'Standardized executive briefs, onboarding playbooks, and proposal templates for strategic accounts.',
        owner: 'Client Strategy',
        status: 'active',
        targetDate: '2026-12-01',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'proj-knowledge-arch',
        name: 'Internal Knowledge Architecture',
        summary:
          'Consolidating meeting transcripts, engineering RFCs, and vendor evaluations into structured archives.',
        owner: 'Knowledge Ops',
        status: 'planning',
        targetDate: '2027-01-20',
        createdAt: now,
        updatedAt: now,
      },
    ],
    tasks: [
      {
        id: 'task-1',
        title: 'Finalize Q4 board executive summary memo',
        notes: 'Incorporate regional revenue variance and engineering milestone schedule.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-11-24',
        projectId: 'proj-q4-ops',
        source: 'Manual',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'task-2',
        title: 'Draft enterprise kickoff email sequence for Acme Holdings',
        notes: 'Prepare three-part executive cadence in Writing Lab and push draft to Gmail.',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-11-22',
        projectId: 'proj-client-briefs',
        source: 'Writing Lab',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'task-3',
        title: 'Synthesize Tuesday leadership sync notes into action items',
        notes: 'Extract owner commitments and archive clean briefing in Document Library.',
        status: 'todo',
        priority: 'medium',
        dueDate: '2026-11-25',
        projectId: 'proj-q4-ops',
        source: 'AI Workspace',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'task-4',
        title: 'Audit Google Docs onboarding template structure',
        notes: 'Verify section headings and executive tone consistency.',
        status: 'done',
        priority: 'low',
        dueDate: '2026-11-19',
        projectId: 'proj-knowledge-arch',
        source: 'Google Productivity',
        createdAt: now,
        updatedAt: now,
      },
    ],
    documents: [
      {
        id: 'doc-1',
        title: 'Q4 Strategic Priorities Brief',
        content:
          '# Q4 Strategic Priorities Brief\n\n## Core Objectives\n1. Maintain 99.95% platform reliability across enterprise workspaces.\n2. Standardize client executive reporting with weekly structured summaries.\n3. Consolidate team meeting notes into verifiable action trackers.\n\n## Operating Cadence\n- Monday: Executive priority alignment\n- Wednesday: Delivery risk review\n- Friday: Stakeholder digest publication',
        category: 'workspace_brief',
        provider: 'Atelier Archive',
        projectId: 'proj-q4-ops',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc-2',
        title: 'Executive Announcement — Enterprise Launch',
        content:
          'Subject: Introducing Our Q4 Enterprise Delivery Framework\n\nTeam,\n\nOver the past quarter we streamlined our cross-functional review cycle to eliminate duplicated reporting and sharpen delivery accountability. Beginning Monday, all strategic client briefings and milestone memos will follow our unified architecture.\n\nThank you for your focus and precision.',
        category: 'writing',
        provider: 'Atelier Archive',
        projectId: 'proj-client-briefs',
        createdAt: now,
        updatedAt: now,
      },
    ],
    workspaceNotes: [],
  };
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readLocalHub(): HubData {
  if (typeof window === 'undefined') return createClientSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createClientSeed();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as Partial<HubData>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      workspaceNotes: Array.isArray(parsed.workspaceNotes) ? parsed.workspaceNotes : [],
    };
  } catch {
    return createClientSeed();
  }
}

export function writeLocalHub(data: HubData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota issues
  }
}

export function localCreateTask(input: {
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  projectId?: string | null;
  source?: string;
}): TaskItem {
  const data = readLocalHub();
  const now = new Date().toISOString();
  const item: TaskItem = {
    id: genId('task'),
    title: input.title.trim(),
    notes: (input.notes ?? '').trim(),
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    dueDate: input.dueDate ?? '',
    projectId: input.projectId ?? null,
    source: input.source ?? 'Manual',
    createdAt: now,
    updatedAt: now,
  };
  data.tasks.unshift(item);
  writeLocalHub(data);
  return item;
}

export function localUpdateTask(
  id: string,
  patch: Partial<Omit<TaskItem, 'id' | 'createdAt'>>
): TaskItem {
  const data = readLocalHub();
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Task not found.');
  const updated: TaskItem = {
    ...data.tasks[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  data.tasks[idx] = updated;
  writeLocalHub(data);
  return updated;
}

export function localDeleteTask(id: string): { deleted: boolean } {
  const data = readLocalHub();
  data.tasks = data.tasks.filter((t) => t.id !== id);
  writeLocalHub(data);
  return { deleted: true };
}

export function localCreateProject(input: {
  name: string;
  summary?: string;
  owner?: string;
  status?: ProjectStatus;
  targetDate?: string;
}): ProjectItem {
  const data = readLocalHub();
  const now = new Date().toISOString();
  const item: ProjectItem = {
    id: genId('proj'),
    name: input.name.trim(),
    summary: (input.summary ?? '').trim(),
    owner: (input.owner ?? 'Workspace Owner').trim(),
    status: input.status ?? 'active',
    targetDate: input.targetDate ?? '',
    createdAt: now,
    updatedAt: now,
  };
  data.projects.unshift(item);
  writeLocalHub(data);
  return item;
}

export function localUpdateProject(
  id: string,
  patch: Partial<Omit<ProjectItem, 'id' | 'createdAt'>>
): ProjectItem {
  const data = readLocalHub();
  const idx = data.projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Project not found.');
  const updated: ProjectItem = {
    ...data.projects[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  data.projects[idx] = updated;
  writeLocalHub(data);
  return updated;
}

export function localDeleteProject(id: string): { deleted: boolean } {
  const data = readLocalHub();
  data.projects = data.projects.filter((p) => p.id !== id);
  data.tasks = data.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t));
  data.documents = data.documents.map((d) =>
    d.projectId === id ? { ...d, projectId: null } : d
  );
  writeLocalHub(data);
  return { deleted: true };
}

export function localCreateDocument(input: {
  title: string;
  content: string;
  category?: DocumentCategory;
  provider?: string;
  projectId?: string | null;
  externalDocId?: string;
}): DocumentItem {
  const data = readLocalHub();
  const now = new Date().toISOString();
  const item: DocumentItem = {
    id: genId('doc'),
    title: input.title.trim(),
    content: input.content,
    category: input.category ?? 'writing',
    provider: input.provider ?? 'Gemini 4 Hydrogen',
    projectId: input.projectId ?? null,
    externalDocId: input.externalDocId,
    createdAt: now,
    updatedAt: now,
  };
  data.documents.unshift(item);
  writeLocalHub(data);
  return item;
}

export function localUpdateDocument(
  id: string,
  patch: Partial<Omit<DocumentItem, 'id' | 'createdAt'>>
): DocumentItem {
  const data = readLocalHub();
  const idx = data.documents.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Document not found.');
  const updated: DocumentItem = {
    ...data.documents[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  data.documents[idx] = updated;
  writeLocalHub(data);
  return updated;
}

export function localDeleteDocument(id: string): { deleted: boolean } {
  const data = readLocalHub();
  data.documents = data.documents.filter((d) => d.id !== id);
  writeLocalHub(data);
  return { deleted: true };
}

export function localSaveWorkspaceNote(
  note: Omit<WorkspaceNoteItem, 'id' | 'createdAt'>
): WorkspaceNoteItem {
  const data = readLocalHub();
  const created: WorkspaceNoteItem = {
    ...note,
    id: genId('note'),
    createdAt: new Date().toISOString(),
  };
  data.workspaceNotes.unshift(created);
  if (data.workspaceNotes.length > 25) {
    data.workspaceNotes = data.workspaceNotes.slice(0, 25);
  }
  writeLocalHub(data);
  return created;
}
