import {
  ArrowUpRight,
  CheckSquare,
  FileText,
  FolderKanban,
  Mail,
  PenLine,
  Scale,
  Sparkles,
} from 'lucide-react';
import type {
  DocumentItem,
  HubMetrics,
  ModuleId,
  ProjectItem,
  TaskItem,
} from '../types/hub';
import type { HealthStatus } from '../services/api';
import { formatShortDate } from '../utils/hubLogic';

interface OverviewDashboardProps {
  metrics: HubMetrics;
  tasks: TaskItem[];
  projects: ProjectItem[];
  documents: DocumentItem[];
  health: HealthStatus | null;
  workspaceConnected: boolean;
  workspaceEmail: string | null;
  onNavigate: (module: ModuleId) => void;
}

export function OverviewDashboard({
  metrics,
  tasks,
  projects,
  documents,
  health,
  workspaceConnected,
  workspaceEmail,
  onNavigate,
}: OverviewDashboardProps) {
  const openTasks = tasks.filter((t) => t.status !== 'done').slice(0, 4);
  const recentDocs = documents.slice(0, 4);

  return (
    <div className="space-y-10">
      {/* Executive Header */}
      <section className="flex flex-col justify-between gap-6 border-b border-neutral-200 pb-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-neutral-500">
            Executive Command
          </p>
          <h1 className="mt-2 font-serif-editorial text-3xl font-medium tracking-tight text-neutral-950 sm:text-4xl">
            Unified AI Productivity Hub
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            Draft executive communications, synthesize meeting intelligence into tasks, and
            operate directly across Gmail and Google Docs from one monochrome workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('writing-lab')}
            className="inline-flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 whitespace-nowrap shrink-0"
          >
            <PenLine className="h-4 w-4" />
            New Writing Piece
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ai-workspace')}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-950 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            Analyze Notes
          </button>
        </div>
      </section>

      {/* Single-Row KPI Strip */}
      <section aria-label="Workspace metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-xs font-medium text-neutral-500">Open Tasks</p>
          <p className="mt-2 font-mono-tabular text-3xl font-medium text-neutral-950">
            {metrics.openTasks}
          </p>
          <p className="mt-2 text-xs text-neutral-500 tabular-nums">
            {metrics.highPriorityOpen} high priority · {metrics.completionRate}% complete
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-xs font-medium text-neutral-500">Active Projects</p>
          <p className="mt-2 font-mono-tabular text-3xl font-medium text-neutral-950">
            {metrics.activeProjects}
          </p>
          <p className="mt-2 text-xs text-neutral-500 tabular-nums">
            {metrics.totalProjects} total initiatives in vault
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-xs font-medium text-neutral-500">Saved Documents</p>
          <p className="mt-2 font-mono-tabular text-3xl font-medium text-neutral-950">
            {metrics.totalDocuments}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Writing, briefs & synced docs
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-xs font-medium text-neutral-500">Integrations</p>
          <p className="mt-2 text-lg font-semibold text-neutral-950">
            {health?.geminiConfigured ? 'Gemini Ready' : 'Gemini Unconfigured'}
          </p>
          <p className="mt-2 text-xs text-neutral-500 truncate">
            {workspaceConnected
              ? `Google connected${workspaceEmail ? ` · ${workspaceEmail}` : ''}`
              : 'Google Workspace sign-in needed'}
          </p>
        </div>
      </section>

      {/* Module Launchers */}
      <section aria-label="Workspace modules">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-950">
            Core Modules
          </h2>
          <span className="text-xs text-neutral-500">Select a workspace</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              id: 'writing-lab' as ModuleId,
              title: 'Professional Writing Lab',
              description:
                'Generate emails, reports, LinkedIn posts, cover letters, and refine tone or grammar with Gemini or prompt templates.',
              icon: PenLine,
            },
            {
              id: 'ai-workspace' as ModuleId,
              title: 'Personal AI Workspace',
              description:
                'Summarize raw notes, extract key points, organize briefs, and push extracted action items directly to Task Manager.',
              icon: Sparkles,
            },
            {
              id: 'google-productivity' as ModuleId,
              title: 'Gemini & Google Productivity',
              description:
                'Read Gmail threads, draft and send emails, and summarize, create, or refine Google Docs with OAuth authorization.',
              icon: Mail,
            },
            {
              id: 'task-manager' as ModuleId,
              title: 'Task Manager',
              description:
                'Prioritize deliverables, link workstreams to projects, and track execution status with persistent storage.',
              icon: CheckSquare,
            },
            {
              id: 'project-vault' as ModuleId,
              title: 'Project Vault',
              description:
                'Maintain strategic initiatives, ownership records, target dates, and connected documents in one register.',
              icon: FolderKanban,
            },
            {
              id: 'tools-comparison' as ModuleId,
              title: 'AI Tools Comparison',
              description:
                'Compare Gemini, ChatGPT, and Claude capabilities and copy structured prompts for external model workflows.',
              icon: Scale,
            },
          ].map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onNavigate(mod.id)}
                className="group flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-neutral-950 focus-visible:outline-2 focus-visible:outline-neutral-950"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <Icon className="h-4 w-4 text-neutral-950" />
                    <ArrowUpRight className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neutral-950" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-neutral-950">
                    {mod.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
                    {mod.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Two-column Operational Feed: Active Tasks + Recent Documents */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-950">Priority Queue</h2>
            <button
              type="button"
              onClick={() => onNavigate('task-manager')}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-950 whitespace-nowrap shrink-0"
            >
              Open Task Manager
            </button>
          </div>
          {openTasks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-neutral-600">All tasks are currently completed.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {openTasks.map((task) => {
                const proj = projects.find((p) => p.id === task.projectId);
                return (
                  <li key={task.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-medium text-neutral-950">{task.title}</p>
                      <span className="font-mono-tabular text-xs text-neutral-500 whitespace-nowrap shrink-0">
                        {task.dueDate ? formatShortDate(task.dueDate) : 'No date'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {task.priority.toUpperCase()} · {task.status.replace('_', ' ')}
                      {proj ? ` · ${proj.name}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-950">Document Library</h2>
            <button
              type="button"
              onClick={() => onNavigate('document-library')}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-950 whitespace-nowrap shrink-0"
            >
              View All Documents
            </button>
          </div>
          {recentDocs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-neutral-600">No archived documents yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {recentDocs.map((doc) => (
                <li key={doc.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      <p className="truncate text-sm font-medium text-neutral-950">
                        {doc.title}
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs text-neutral-500 whitespace-nowrap shrink-0">
                      {formatShortDate(doc.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {doc.category.replace('_', ' ')} · {doc.provider}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
