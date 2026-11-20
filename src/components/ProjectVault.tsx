import { useState, type FormEvent } from 'react';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';
import type {
  DocumentItem,
  ProjectItem,
  ProjectStatus,
  TaskItem,
} from '../types/hub';
import {
  createProjectApi,
  deleteProjectApi,
  updateProjectApi,
} from '../services/api';
import { formatShortDate } from '../utils/hubLogic';
import { ConfirmDialog } from './ConfirmDialog';

interface ProjectVaultProps {
  projects: ProjectItem[];
  tasks: TaskItem[];
  documents: DocumentItem[];
  onProjectsChange: (projects: ProjectItem[]) => void;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  planning: 'Planning',
  on_hold: 'On Hold',
  completed: 'Completed',
};

export function ProjectVault({
  projects,
  tasks,
  documents,
  onProjectsChange,
}: ProjectVaultProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    projects[0]?.id ?? null
  );
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedProject =
    projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await createProjectApi({
        name: name.trim(),
        summary,
        owner: owner.trim() || 'Workspace Owner',
        status,
        targetDate,
      });
      onProjectsChange([created, ...projects]);
      setSelectedId(created.id);
      setName('');
      setSummary('');
      setOwner('');
      setTargetDate('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (project: ProjectItem, nextStatus: ProjectStatus) => {
    try {
      const updated = await updateProjectApi(project.id, { status: nextStatus });
      onProjectsChange(projects.map((p) => (p.id === project.id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteProjectApi(deleteTarget.id);
      const remaining = projects.filter((p) => p.id !== deleteTarget.id);
      onProjectsChange(remaining);
      if (selectedId === deleteTarget.id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project.');
    } finally {
      setIsDeleting(false);
    }
  };

  const linkedTasks = selectedProject
    ? tasks.filter((t) => t.projectId === selectedProject.id)
    : [];
  const linkedDocs = selectedProject
    ? documents.filter((d) => d.projectId === selectedProject.id)
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-neutral-500">Initiative Register</p>
          <h1 className="mt-1 font-serif-editorial text-2xl font-medium text-neutral-950 sm:text-3xl">
            Project Vault
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Organize strategic initiatives with linked deliverables and archived briefs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 whitespace-nowrap shrink-0 self-start"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Close Form' : 'New Project'}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-xs font-medium text-neutral-900">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-neutral-200 bg-white p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-neutral-950">Register New Project</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="proj-name" className="block text-xs font-medium text-neutral-700">
                Project Name
              </label>
              <input
                id="proj-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 2027 Platform Architecture"
                className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="proj-owner" className="block text-xs font-medium text-neutral-700">
                Lead / Owner
              </label>
              <input
                id="proj-owner"
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g., Operations Lead"
                className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="proj-status" className="block text-xs font-medium text-neutral-700">
                  Status
                </label>
                <select
                  id="proj-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="planning">Planning</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label htmlFor="proj-target" className="block text-xs font-medium text-neutral-700">
                  Target Date
                </label>
                <input
                  id="proj-target"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="proj-summary" className="block text-xs font-medium text-neutral-700">
              Executive Scope
            </label>
            <textarea
              id="proj-summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Concise scope statement, outcomes, and key stakeholders..."
              className="mt-1.5 w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
          <FolderKanban className="mx-auto h-6 w-6 text-neutral-400" />
          <h2 className="mt-3 text-sm font-semibold text-neutral-950">Vault is empty</h2>
          <p className="mt-1 text-xs text-neutral-600">
            Create your first strategic project to organize tasks and documents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            {projects.map((project) => {
              const tCount = tasks.filter((t) => t.projectId === project.id).length;
              const dCount = documents.filter((d) => d.projectId === project.id).length;
              const active = selectedProject?.id === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedId(project.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    active
                      ? 'border-neutral-950 bg-neutral-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold text-neutral-950">{project.name}</h2>
                    <span className="text-xs font-medium text-neutral-500 whitespace-nowrap shrink-0">
                      {STATUS_LABEL[project.status]}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">
                    {project.summary || 'No executive summary recorded.'}
                  </p>
                  <p className="mt-2.5 text-xs text-neutral-500 tabular-nums">
                    {project.owner} · {tCount} tasks · {dCount} docs
                  </p>
                </button>
              );
            })}
          </div>

          {selectedProject && (
            <div className="rounded-lg border border-neutral-200 bg-white lg:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 p-6">
                <div>
                  <p className="text-xs text-neutral-500">
                    {selectedProject.owner} · Target{' '}
                    {selectedProject.targetDate
                      ? formatShortDate(selectedProject.targetDate)
                      : 'Unscheduled'}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-neutral-950">
                    {selectedProject.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Project status"
                    value={selectedProject.status}
                    onChange={(e) =>
                      handleStatusChange(selectedProject, e.target.value as ProjectStatus)
                    }
                    className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 focus:border-neutral-950 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="planning">Planning</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selectedProject)}
                    aria-label={`Delete project '${selectedProject.name}'`}
                    className="rounded-md border border-neutral-200 p-1.5 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="divide-y divide-neutral-200">
                <section className="p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Scope & Mandate
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-800">
                    {selectedProject.summary || 'No scope statement added yet.'}
                  </p>
                </section>

                <section className="p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Linked Deliverables ({linkedTasks.length})
                  </h3>
                  {linkedTasks.length === 0 ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      No tasks linked to this project yet. Assign tasks in Task Manager.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-200">
                      {linkedTasks.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-xs font-medium text-neutral-900">{t.title}</span>
                          <span className="text-xs text-neutral-500 whitespace-nowrap shrink-0">
                            {t.status.replace('_', ' ')} · {t.priority}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Linked Documents ({linkedDocs.length})
                  </h3>
                  {linkedDocs.length === 0 ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      No documents linked yet. Link documents when saving from Writing Lab.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-200">
                      {linkedDocs.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-xs font-medium text-neutral-900">{d.title}</span>
                          <span className="font-mono-tabular text-xs text-neutral-500 whitespace-nowrap shrink-0">
                            {formatShortDate(d.updatedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Project"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.name}" from the Project Vault? Linked tasks and documents will remain in your workspace unlinked.`
            : ''
        }
        confirmLabel="Delete Project"
        busy={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
