import { useState, type FormEvent } from 'react';
import { Check, Circle, Clock, Download, Plus, Search, Trash2 } from 'lucide-react';
import type {
  ProjectItem,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../types/hub';
import { createTaskApi, deleteTaskApi, updateTaskApi } from '../services/api';
import { exportTasksToCsv, filterTasks, formatShortDate } from '../utils/hubLogic';
import { ConfirmDialog } from './ConfirmDialog';

interface TaskManagerProps {
  tasks: TaskItem[];
  projects: ProjectItem[];
  onTasksChange: (tasks: TaskItem[]) => void;
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export function TaskManager({ tasks, projects, onTasksChange }: TaskManagerProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const visibleTasks = filterTasks(tasks, query, statusFilter, priorityFilter);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Enter a task title.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createTaskApi({
        title: title.trim(),
        notes,
        priority,
        dueDate,
        projectId: projectId || null,
        source: 'Manual',
      });
      onTasksChange([created, ...tasks]);
      setTitle('');
      setNotes('');
      setDueDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCycleStatus = async (task: TaskItem) => {
    const next = NEXT_STATUS[task.status];
    try {
      const updated = await updateTaskApi(task.id, { status: next });
      onTasksChange(tasks.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTaskApi(deleteTarget.id);
      onTasksChange(tasks.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCsv = () => {
    const csv = exportTasksToCsv(visibleTasks, projects);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atelier-tasks.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const json = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        application: 'Atelier AI Productivity Hub',
        tasks: visibleTasks,
      },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atelier-tasks.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-neutral-500">Execution Ledger</p>
          <h1 className="mt-1 font-serif-editorial text-2xl font-medium text-neutral-950 sm:text-3xl">
            Task Manager
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Track action items across projects and AI Workspace syntheses with persistent state.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={visibleTasks.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-800 hover:border-neutral-950 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            disabled={visibleTasks.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-800 hover:border-neutral-950 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-neutral-950">Add Deliverable</h2>
        {error && (
          <p role="alert" className="text-xs font-medium text-neutral-900">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <label htmlFor="new-task-title" className="block text-xs font-medium text-neutral-700">
              Task Title
            </label>
            <input
              id="new-task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Review Q4 engineering budget"
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="new-task-priority" className="block text-xs font-medium text-neutral-700">
              Priority
            </label>
            <select
              id="new-task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="new-task-due" className="block text-xs font-medium text-neutral-700">
              Due Date
            </label>
            <input
              id="new-task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="new-task-project" className="block text-xs font-medium text-neutral-700">
              Project
            </label>
            <select
              id="new-task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            aria-label="Task notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context or acceptance notes..."
            className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? 'Adding...' : 'Create Task'}
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            aria-label="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'todo', label: 'To Do' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'done', label: 'Done' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-neutral-950 text-white'
                    : 'text-neutral-600 hover:text-neutral-950'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-neutral-950 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="rounded-lg border border-neutral-200 bg-white">
        {visibleTasks.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-neutral-950">No matching tasks found</p>
            <p className="mt-1 text-xs text-neutral-500">
              Create a new deliverable above or adjust your active filters.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {visibleTasks.map((task) => {
              const proj = projects.find((p) => p.id === task.projectId);
              return (
                <li
                  key={task.id}
                  className="flex flex-col justify-between gap-4 px-5 py-4 transition-colors hover:bg-neutral-50 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleCycleStatus(task)}
                      aria-label={`Change status for '${task.title}' (currently ${STATUS_LABELS[task.status]})`}
                      className="mt-0.5 flex h-6 w-6 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-950 transition-colors hover:border-neutral-950 shrink-0"
                    >
                      {task.status === 'done' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : task.status === 'in_progress' ? (
                        <Clock className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3 w-3 text-neutral-300" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          task.status === 'done'
                            ? 'text-neutral-400 line-through'
                            : 'text-neutral-950'
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.notes && (
                        <p className="mt-0.5 text-xs text-neutral-600">{task.notes}</p>
                      )}
                      <p className="mt-1 text-xs text-neutral-500">
                        {STATUS_LABELS[task.status]} · {task.priority.toUpperCase()} · {task.source}
                        {proj ? ` · ${proj.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                    <span className="font-mono-tabular text-xs text-neutral-500 whitespace-nowrap">
                      {task.dueDate ? formatShortDate(task.dueDate) : 'No due date'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(task)}
                      aria-label={`Delete task '${task.title}'`}
                      className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Task"
        description={
          deleteTarget
            ? `Permanently remove "${deleteTarget.title}" from the Task Manager?`
            : ''
        }
        confirmLabel="Delete Task"
        busy={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
