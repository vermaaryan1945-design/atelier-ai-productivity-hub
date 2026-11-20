import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
} from '../src/types/hub.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'hub-store.json');

function createInitialSeed(): HubData {
  const now = new Date().toISOString();
  const projects: ProjectItem[] = [
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
  ];

  const tasks: TaskItem[] = [
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
  ];

  const documents: DocumentItem[] = [
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
  ];

  return {
    tasks,
    projects,
    documents,
    workspaceNotes: [],
  };
}

function ensureStore(): HubData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial = createInitialSeed();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<HubData>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      workspaceNotes: Array.isArray(parsed.workspaceNotes) ? parsed.workspaceNotes : [],
    };
  } catch {
    const fallback = createInitialSeed();
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function writeStore(data: HubData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

export function getHubData(): HubData {
  return ensureStore();
}

export function createTask(input: {
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  projectId?: string | null;
  source?: string;
}): TaskItem {
  const data = ensureStore();
  const now = new Date().toISOString();
  const item: TaskItem = {
    id: `task-${crypto.randomUUID().slice(0, 8)}`,
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
  writeStore(data);
  return item;
}

export function updateTask(
  id: string,
  patch: Partial<Omit<TaskItem, 'id' | 'createdAt'>>
): TaskItem | null {
  const data = ensureStore();
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated: TaskItem = {
    ...data.tasks[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  data.tasks[idx] = updated;
  writeStore(data);
  return updated;
}

export function deleteTask(id: string): boolean {
  const data = ensureStore();
  const next = data.tasks.filter((t) => t.id !== id);
  if (next.length === data.tasks.length) return false;
  data.tasks = next;
  writeStore(data);
  return true;
}

export function createProject(input: {
  name: string;
  summary?: string;
  owner?: string;
  status?: ProjectStatus;
  targetDate?: string;
}): ProjectItem {
  const data = ensureStore();
  const now = new Date().toISOString();
  const project: ProjectItem = {
    id: `proj-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim(),
    summary: (input.summary ?? '').trim(),
    owner: (input.owner ?? 'Workspace Owner').trim(),
    status: input.status ?? 'active',
    targetDate: input.targetDate ?? '',
    createdAt: now,
    updatedAt: now,
  };
  data.projects.unshift(project);
  writeStore(data);
  return project;
}

export function updateProject(
  id: string,
  patch: Partial<Omit<ProjectItem, 'id' | 'createdAt'>>
): ProjectItem | null {
  const data = ensureStore();
  const idx = data.projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated: ProjectItem = {
    ...data.projects[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  data.projects[idx] = updated;
  writeStore(data);
  return updated;
}

export function deleteProject(id: string): boolean {
  const data = ensureStore();
  const next = data.projects.filter((p) => p.id !== id);
  if (next.length === data.projects.length) return false;
  data.projects = next;
  data.tasks = data.tasks.map((t) =>
    t.projectId === id ? { ...t, projectId: null, updatedAt: new Date().toISOString() } : t
  );
  data.documents = data.documents.map((d) =>
    d.projectId === id ? { ...d, projectId: null, updatedAt: new Date().toISOString() } : d
  );
  writeStore(data);
  return true;
}

export function createDocument(input: {
  title: string;
  content: string;
  category?: DocumentCategory;
  provider?: string;
  projectId?: string | null;
  externalDocId?: string;
}): DocumentItem {
  const data = ensureStore();
  const now = new Date().toISOString();
  const doc: DocumentItem = {
    id: `doc-${crypto.randomUUID().slice(0, 8)}`,
    title: input.title.trim(),
    content: input.content,
    category: input.category ?? 'writing',
    provider: input.provider ?? 'Gemini 4 Hydrogen',
    projectId: input.projectId ?? null,
    externalDocId: input.externalDocId,
    createdAt: now,
    updatedAt: now,
  };
  data.documents.unshift(doc);
  writeStore(data);
  return doc;
}

export function updateDocument(
  id: string,
  patch: Partial<Omit<DocumentItem, 'id' | 'createdAt'>>
): DocumentItem | null {
  const data = ensureStore();
  const idx = data.documents.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const updated: DocumentItem = {
    ...data.documents[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  data.documents[idx] = updated;
  writeStore(data);
  return updated;
}

export function deleteDocument(id: string): boolean {
  const data = ensureStore();
  const next = data.documents.filter((d) => d.id !== id);
  if (next.length === data.documents.length) return false;
  data.documents = next;
  writeStore(data);
  return true;
}

export function saveWorkspaceNote(note: Omit<WorkspaceNoteItem, 'id' | 'createdAt'>): WorkspaceNoteItem {
  const data = ensureStore();
  const created: WorkspaceNoteItem = {
    ...note,
    id: `note-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  data.workspaceNotes.unshift(created);
  if (data.workspaceNotes.length > 25) {
    data.workspaceNotes = data.workspaceNotes.slice(0, 25);
  }
  writeStore(data);
  return created;
}
