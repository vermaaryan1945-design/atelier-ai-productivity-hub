import { useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  DocumentCategory,
  DocumentItem,
  ProjectItem,
  TaskItem,
} from '../types/hub';
import {
  createDocumentApi,
  deleteDocumentApi,
  updateDocumentApi,
} from '../services/api';
import {
  exportHubBackupJson,
  filterDocuments,
  formatShortDate,
} from '../utils/hubLogic';
import { ConfirmDialog } from './ConfirmDialog';

interface DocumentLibraryProps {
  documents: DocumentItem[];
  projects: ProjectItem[];
  tasks?: TaskItem[];
  onDocumentsChange: (docs: DocumentItem[]) => void;
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  writing: 'Writing Lab',
  workspace_brief: 'Workspace Brief',
  google_doc: 'Google Doc',
  email_draft: 'Email Draft',
  note: 'Note',
};

export function DocumentLibrary({
  documents,
  projects,
  tasks = [],
  onDocumentsChange,
}: DocumentLibraryProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<DocumentCategory>('note');
  const [newContent, setNewContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const visibleDocs = filterDocuments(documents, query, categoryFilter);
  const activeDoc =
    visibleDocs.find((d) => d.id === selectedId) ?? visibleDocs[0] ?? null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newTitle.trim() || !newContent.trim()) {
      setError('Title and content are required.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await createDocumentApi({
        title: newTitle.trim(),
        content: newContent,
        category: newCategory,
        provider: 'Manual Entry',
      });
      onDocumentsChange([created, ...documents]);
      setSelectedId(created.id);
      setNewTitle('');
      setNewContent('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateContent = async (doc: DocumentItem, content: string) => {
    onDocumentsChange(
      documents.map((d) => (d.id === doc.id ? { ...d, content } : d))
    );
    try {
      const updated = await updateDocumentApi(doc.id, { content });
      onDocumentsChange(documents.map((d) => (d.id === doc.id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document.');
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadMarkdown = (doc: DocumentItem) => {
    const blob = new Blob([`# ${doc.title}\n\n${doc.content}`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'document'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDocumentApi(deleteTarget.id);
      const remaining = documents.filter((d) => d.id !== deleteTarget.id);
      onDocumentsChange(remaining);
      if (selectedId === deleteTarget.id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportBackupJson = () => {
    const json = exportHubBackupJson({
      tasks,
      projects,
      documents,
    });
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atelier-workspace-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-neutral-500">Knowledge Archive</p>
          <h1 className="mt-1 font-serif-editorial text-2xl font-medium text-neutral-950 sm:text-3xl">
            Document Library
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Search, inspect, edit, and export every writing piece, synthesized brief, and synced document.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start shrink-0">
          <button
            type="button"
            onClick={handleExportBackupJson}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-800 hover:border-neutral-950 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Backup JSON
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            {showCreate ? 'Close' : 'New Document'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-xs font-medium text-neutral-900">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-neutral-200 bg-white p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-neutral-950">Create Archive Document</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="doc-create-title" className="block text-xs font-medium text-neutral-700">
                Title
              </label>
              <input
                id="doc-create-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Document title"
                className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="doc-create-cat" className="block text-xs font-medium text-neutral-700">
                Category
              </label>
              <select
                id="doc-create-cat"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as DocumentCategory)}
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
              >
                <option value="note">Note</option>
                <option value="writing">Writing Lab</option>
                <option value="workspace_brief">Workspace Brief</option>
                <option value="email_draft">Email Draft</option>
                <option value="google_doc">Google Doc</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="doc-create-content" className="block text-xs font-medium text-neutral-700">
              Content
            </label>
            <textarea
              id="doc-create-content"
              rows={6}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write or paste document body..."
              className="mt-1.5 w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Document'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            aria-label="Search documents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search library..."
            className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
          />
        </div>
        <select
          aria-label="Filter documents by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 focus:border-neutral-950 focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="writing">Writing Lab</option>
          <option value="workspace_brief">Workspace Briefs</option>
          <option value="google_doc">Google Docs</option>
          <option value="email_draft">Email Drafts</option>
          <option value="note">Notes</option>
        </select>
      </div>

      {visibleDocs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-neutral-400" />
          <h2 className="mt-3 text-sm font-semibold text-neutral-950">No documents found</h2>
          <p className="mt-1 text-xs text-neutral-600">
            Save outputs from Writing Lab, AI Workspace, or create a manual entry above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-2.5 lg:col-span-4">
            {visibleDocs.map((doc) => {
              const selected = activeDoc?.id === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selected
                      ? 'border-neutral-950 bg-neutral-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-400'
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-neutral-950">{doc.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {CATEGORY_LABELS[doc.category]} · {formatShortDate(doc.updatedAt)}
                  </p>
                </button>
              );
            })}
          </div>

          {activeDoc && (
            <div className="flex flex-col rounded-lg border border-neutral-200 bg-white lg:col-span-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 p-6">
                <div>
                  <p className="text-xs text-neutral-500">
                    {CATEGORY_LABELS[activeDoc.category]} · {activeDoc.provider}
                    {activeDoc.projectId
                      ? ` · ${projects.find((p) => p.id === activeDoc.projectId)?.name ?? ''}`
                      : ''}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-neutral-950">
                    {activeDoc.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(activeDoc.content)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:border-neutral-950 whitespace-nowrap"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadMarkdown(activeDoc)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:border-neutral-950 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export .md
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(activeDoc)}
                    aria-label={`Delete document '${activeDoc.title}'`}
                    className="rounded-md border border-neutral-200 p-1.5 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6">
                <textarea
                  aria-label="Document editor"
                  rows={16}
                  value={activeDoc.content}
                  onChange={(e) => handleUpdateContent(activeDoc, e.target.value)}
                  className="w-full resize-y border-0 bg-transparent text-sm leading-relaxed text-neutral-900 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Document"
        description={
          deleteTarget
            ? `Permanently delete "${deleteTarget.title}" from your Document Library?`
            : ''
        }
        confirmLabel="Delete Document"
        busy={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
