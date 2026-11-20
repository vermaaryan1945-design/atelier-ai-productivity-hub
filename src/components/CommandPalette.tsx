import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Search,
  X,
} from 'lucide-react';
import type {
  DocumentItem,
  ModuleId,
  ProjectItem,
  TaskItem,
} from '../types/hub';

interface CommandPaletteProps {
  open: boolean;
  tasks: TaskItem[];
  projects: ProjectItem[];
  documents: DocumentItem[];
  onClose: () => void;
  onNavigate: (module: ModuleId) => void;
}

interface PaletteResult {
  id: string;
  group: 'Module' | 'Task' | 'Project' | 'Document';
  title: string;
  subtitle: string;
  module: ModuleId;
}

const MODULES: Array<{ id: ModuleId; title: string; subtitle: string }> = [
  { id: 'overview', title: 'Overview Dashboard', subtitle: 'Executive summary & KPIs' },
  { id: 'writing-lab', title: 'Professional Writing Lab', subtitle: 'Emails, reports, LinkedIn, cover letters & refinement' },
  { id: 'ai-workspace', title: 'Personal AI Workspace', subtitle: 'Summarize notes, extract action items & organize briefs' },
  { id: 'google-productivity', title: 'Google Productivity', subtitle: 'Authorized Gmail & Google Docs assistant' },
  { id: 'task-manager', title: 'Task Manager', subtitle: 'Priorities, deliverables & CSV export' },
  { id: 'project-vault', title: 'Project Vault', subtitle: 'Strategic initiatives & linked records' },
  { id: 'document-library', title: 'Document Library', subtitle: 'Archived briefs, drafts & JSON backup' },
  { id: 'tools-comparison', title: 'AI Tools Comparison', subtitle: 'Gemini, ChatGPT & Claude matrix and prompts' },
];

export function CommandPalette({
  open,
  tasks,
  projects,
  documents,
  onClose,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteResult[] = [];

    for (const m of MODULES) {
      if (
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.subtitle.toLowerCase().includes(q)
      ) {
        list.push({
          id: `mod-${m.id}`,
          group: 'Module',
          title: m.title,
          subtitle: m.subtitle,
          module: m.id,
        });
      }
    }

    for (const t of tasks) {
      if (!q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q)) {
        list.push({
          id: `task-${t.id}`,
          group: 'Task',
          title: t.title,
          subtitle: `${t.priority.toUpperCase()} · ${t.status.replace('_', ' ')}`,
          module: 'task-manager',
        });
      }
    }

    for (const p of projects) {
      if (!q || p.name.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q)) {
        list.push({
          id: `proj-${p.id}`,
          group: 'Project',
          title: p.name,
          subtitle: `${p.owner} · ${p.status}`,
          module: 'project-vault',
        });
      }
    }

    for (const d of documents) {
      if (!q || d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)) {
        list.push({
          id: `doc-${d.id}`,
          group: 'Document',
          title: d.title,
          subtitle: `${d.category.replace('_', ' ')} · ${d.provider}`,
          module: 'document-library',
        });
      }
    }

    return list.slice(0, 14);
  }, [query, tasks, projects, documents]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const handleSelect = (item: PaletteResult) => {
    onNavigate(item.module);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
          <Search className="h-4 w-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Search modules, tasks, projects, and documents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((prev) =>
                  results.length === 0 ? 0 : (prev + 1) % results.length
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((prev) =>
                  results.length === 0
                    ? 0
                    : (prev - 1 + results.length) % results.length
                );
              } else if (e.key === 'Enter' && results[activeIndex]) {
                e.preventDefault();
                handleSelect(results[activeIndex]);
              }
            }}
            placeholder="Jump to module, task, project, or document..."
            className="flex-1 bg-transparent text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              No matching modules, tasks, projects, or documents found.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {results.map((item, idx) => {
                const active = idx === activeIndex;
                const Icon =
                  item.group === 'Module'
                    ? LayoutDashboard
                    : item.group === 'Task'
                      ? CheckSquare
                      : item.group === 'Project'
                        ? FolderKanban
                        : FileText;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                        active ? 'bg-neutral-100' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="h-4 w-4 text-neutral-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-950">
                            {item.title}
                          </p>
                          <p className="truncate text-xs text-neutral-500">
                            {item.group} · {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-[11px] text-neutral-500">
          <span>Use arrow keys to navigate · Enter to open</span>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
