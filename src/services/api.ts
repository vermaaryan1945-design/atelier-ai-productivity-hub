import type {
  DocumentCategory,
  DocumentItem,
  GmailMessageSummary,
  GoogleDocDetail,
  HubData,
  ProjectItem,
  ProjectStatus,
  TaskItem,
  TaskPriority,
  TaskStatus,
  WorkspaceNoteItem,
  WritingMode,
} from '../types/hub';
import {
  localCreateDocument,
  localCreateProject,
  localCreateTask,
  localDeleteDocument,
  localDeleteProject,
  localDeleteTask,
  localSaveWorkspaceNote,
  localUpdateDocument,
  localUpdateProject,
  localUpdateTask,
  readLocalHub,
  writeLocalHub,
} from './localStore';

let useLocalStorageFallback = false;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text };
    }
  }
  if (!res.ok) {
    const errObj = parsed as { error?: string };
    throw new Error(errObj?.error || `Request failed with status ${res.status}`);
  }
  return parsed as T;
}

export interface HealthStatus {
  ok: boolean;
  geminiConfigured: boolean;
  geminiModel: string;
  workspaceOAuthConfigured: boolean;
  storageMode?: 'server' | 'serverless';
  timestamp: string;
}

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const health = await requestJson<HealthStatus>('/api/health');
    if (health.storageMode === 'serverless') {
      useLocalStorageFallback = true;
    }
    return health;
  } catch {
    useLocalStorageFallback = true;
    return {
      ok: true,
      geminiConfigured: false,
      geminiModel: 'gemini-4-hydrogen',
      workspaceOAuthConfigured: true,
      storageMode: 'serverless',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function fetchHubData(): Promise<HubData> {
  if (useLocalStorageFallback) {
    return readLocalHub();
  }
  try {
    const data = await requestJson<HubData>('/api/hub');
    writeLocalHub(data);
    return data;
  } catch {
    useLocalStorageFallback = true;
    return readLocalHub();
  }
}

export async function createTaskApi(payload: {
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  projectId?: string | null;
  source?: string;
}): Promise<TaskItem> {
  if (useLocalStorageFallback) return localCreateTask(payload);
  try {
    const created = await requestJson<TaskItem>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return created;
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      useLocalStorageFallback = true;
      return localCreateTask(payload);
    }
    throw err;
  }
}

export async function updateTaskApi(
  id: string,
  patch: Partial<Omit<TaskItem, 'id' | 'createdAt'>>
): Promise<TaskItem> {
  if (useLocalStorageFallback) return localUpdateTask(id, patch);
  return requestJson<TaskItem>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteTaskApi(id: string): Promise<{ deleted: boolean }> {
  if (useLocalStorageFallback) return localDeleteTask(id);
  return requestJson<{ deleted: boolean }>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function createProjectApi(payload: {
  name: string;
  summary?: string;
  owner?: string;
  status?: ProjectStatus;
  targetDate?: string;
}): Promise<ProjectItem> {
  if (useLocalStorageFallback) return localCreateProject(payload);
  return requestJson<ProjectItem>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateProjectApi(
  id: string,
  patch: Partial<Omit<ProjectItem, 'id' | 'createdAt'>>
): Promise<ProjectItem> {
  if (useLocalStorageFallback) return localUpdateProject(id, patch);
  return requestJson<ProjectItem>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteProjectApi(id: string): Promise<{ deleted: boolean }> {
  if (useLocalStorageFallback) return localDeleteProject(id);
  return requestJson<{ deleted: boolean }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function createDocumentApi(payload: {
  title: string;
  content: string;
  category?: DocumentCategory;
  provider?: string;
  projectId?: string | null;
  externalDocId?: string;
}): Promise<DocumentItem> {
  if (useLocalStorageFallback) return localCreateDocument(payload);
  return requestJson<DocumentItem>('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateDocumentApi(
  id: string,
  patch: Partial<Omit<DocumentItem, 'id' | 'createdAt'>>
): Promise<DocumentItem> {
  if (useLocalStorageFallback) return localUpdateDocument(id, patch);
  return requestJson<DocumentItem>(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteDocumentApi(id: string): Promise<{ deleted: boolean }> {
  if (useLocalStorageFallback) return localDeleteDocument(id);
  return requestJson<{ deleted: boolean }>(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function saveWorkspaceNoteApi(
  payload: Omit<WorkspaceNoteItem, 'id' | 'createdAt'>
): Promise<WorkspaceNoteItem> {
  if (useLocalStorageFallback) return localSaveWorkspaceNote(payload);
  return requestJson<WorkspaceNoteItem>('/api/workspace-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function generateWritingApi(payload: {
  mode: WritingMode;
  prompt: string;
  context?: string;
  tone?: string;
  length?: string;
}): Promise<{ content: string; model: string; generatedAt: string }> {
  return requestJson('/api/gemini/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function generateWritingStreamApi(
  payload: {
    mode: WritingMode;
    prompt: string;
    context?: string;
    tone?: string;
    length?: string;
  },
  onChunk: (fullTextSoFar: string) => void
): Promise<{ content: string; model: string; generatedAt: string }> {
  const res = await fetch('/api/gemini/write/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    return generateWritingApi(payload);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    const data = (await res.json()) as {
      content?: string;
      model?: string;
      generatedAt?: string;
      error?: string;
    };
    if (data.error) throw new Error(data.error);
    const full = data.content ?? '';
    onChunk(full);
    return {
      content: full,
      model: data.model ?? 'gemini-4-hydrogen',
      generatedAt: data.generatedAt ?? new Date().toISOString(),
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let model = 'gemini-4-hydrogen';
  let generatedAt = new Date().toISOString();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      const evt = JSON.parse(jsonStr) as {
        chunk?: string;
        done?: boolean;
        model?: string;
        generatedAt?: string;
        error?: string;
      };
      if (evt.error) {
        throw new Error(evt.error);
      }
      if (evt.chunk) {
        accumulated += evt.chunk;
        onChunk(accumulated);
      }
      if (evt.done) {
        if (evt.model) model = evt.model;
        if (evt.generatedAt) generatedAt = evt.generatedAt;
      }
    }
  }

  return { content: accumulated.trim(), model, generatedAt };
}

export function analyzeWorkspaceApi(payload: {
  action: 'summarize' | 'key_points' | 'action_items' | 'organize';
  notes: string;
  title?: string;
}): Promise<{
  suggestedTitle: string;
  summary: string;
  keyPoints: string[];
  actionItems: Array<{ title: string; priority: TaskPriority; dueHint: string }>;
  organizedSections: Array<{ heading: string; content: string }>;
  model: string;
}> {
  return requestJson('/api/gemini/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function googleAssistApi(payload: {
  task: 'email_draft' | 'doc_generate' | 'doc_summarize' | 'doc_improve';
  prompt?: string;
  sourceContent?: string;
  tone?: string;
  recipientContext?: string;
}): Promise<{
  subject?: string;
  title?: string;
  content: string;
  improvements?: string;
  model: string;
}> {
  return requestJson('/api/gemini/google-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchGmailMessages(accessToken: string): Promise<{
  messages: GmailMessageSummary[];
}> {
  return requestJson('/api/workspace/gmail/messages', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function createGmailDraft(
  accessToken: string,
  payload: { to: string; subject: string; body: string }
): Promise<{ draftId: string; status: string }> {
  return requestJson('/api/workspace/gmail/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function sendGmailMessage(
  accessToken: string,
  payload: { to: string; subject: string; body: string }
): Promise<{ messageId: string; threadId: string; status: string }> {
  return requestJson('/api/workspace/gmail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<GoogleDocDetail> {
  return requestJson(`/api/workspace/docs/${encodeURIComponent(documentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function createGoogleDoc(
  accessToken: string,
  payload: { title: string; content: string }
): Promise<{ documentId: string; title: string; url: string }> {
  return requestJson('/api/workspace/docs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function appendGoogleDoc(
  accessToken: string,
  documentId: string,
  content: string
): Promise<{ documentId: string; status: string; url: string }> {
  return requestJson(`/api/workspace/docs/${encodeURIComponent(documentId)}/append`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
}
