export type ModuleId =
  | 'overview'
  | 'writing-lab'
  | 'ai-workspace'
  | 'task-manager'
  | 'project-vault'
  | 'tools-comparison'
  | 'google-productivity'
  | 'document-library';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskItem {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  projectId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'active' | 'planning' | 'on_hold' | 'completed';

export interface ProjectItem {
  id: string;
  name: string;
  summary: string;
  owner: string;
  status: ProjectStatus;
  targetDate: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentCategory =
  | 'writing'
  | 'workspace_brief'
  | 'google_doc'
  | 'email_draft'
  | 'note';

export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  category: DocumentCategory;
  provider: string;
  projectId: string | null;
  externalDocId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceNoteItem {
  id: string;
  title: string;
  rawInput: string;
  actionType: 'summarize' | 'key_points' | 'action_items' | 'organize';
  summary: string;
  keyPoints: string[];
  actionItems: Array<{ title: string; priority: TaskPriority; dueHint: string; addedToTasks?: boolean }>;
  organizedSections: Array<{ heading: string; content: string }>;
  createdAt: string;
}

export interface HubData {
  tasks: TaskItem[];
  projects: ProjectItem[];
  documents: DocumentItem[];
  workspaceNotes: WorkspaceNoteItem[];
}

export interface HubMetrics {
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  highPriorityOpen: number;
  completionRate: number;
  totalProjects: number;
  activeProjects: number;
  totalDocuments: number;
}

export type WritingMode =
  | 'email'
  | 'report'
  | 'linkedin'
  | 'cover_letter'
  | 'tone_refine'
  | 'grammar';

export type WritingProvider = 'gemini' | 'chatgpt' | 'claude';

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface GoogleDocDetail {
  documentId: string;
  title: string;
  bodyText: string;
  revisionId?: string;
}
