import { useState } from 'react';
import { Check, Plus, Save, Sparkles } from 'lucide-react';
import type {
  DocumentItem,
  TaskItem,
  TaskPriority,
  WorkspaceNoteItem,
} from '../types/hub';
import {
  analyzeWorkspaceApi,
  createDocumentApi,
  createTaskApi,
  saveWorkspaceNoteApi,
} from '../services/api';

interface AIWorkspaceProps {
  workspaceNotes: WorkspaceNoteItem[];
  geminiConfigured: boolean;
  onTaskCreated: (task: TaskItem) => void;
  onDocumentSaved: (doc: DocumentItem) => void;
  onWorkspaceNoteSaved: (note: WorkspaceNoteItem) => void;
}

type WorkspaceAction = 'summarize' | 'key_points' | 'action_items' | 'organize';

const ACTIONS: Array<{ id: WorkspaceAction; label: string }> = [
  { id: 'summarize', label: 'Note Summarization' },
  { id: 'key_points', label: 'Key-Point Extraction' },
  { id: 'action_items', label: 'Action-Item Extraction' },
  { id: 'organize', label: 'Information Organization' },
];

export function AIWorkspace({
  workspaceNotes,
  geminiConfigured,
  onTaskCreated,
  onDocumentSaved,
  onWorkspaceNoteSaved,
}: AIWorkspaceProps) {
  const [action, setAction] = useState<WorkspaceAction>('organize');
  const [title, setTitle] = useState('');
  const [rawNotes, setRawNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<{
    suggestedTitle: string;
    summary: string;
    keyPoints: string[];
    actionItems: Array<{ title: string; priority: TaskPriority; dueHint: string; added?: boolean }>;
    organizedSections: Array<{ heading: string; content: string }>;
  } | null>(null);

  const handleAnalyze = async () => {
    setError(null);
    setStatusMessage(null);
    if (!rawNotes.trim()) {
      setError('Paste meeting notes, transcripts, or research excerpts to analyze.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await analyzeWorkspaceApi({
        action,
        notes: rawNotes,
        title: title.trim() || undefined,
      });

      const nextAnalysis = {
        suggestedTitle: res.suggestedTitle,
        summary: res.summary,
        keyPoints: res.keyPoints,
        actionItems: res.actionItems.map((i) => ({ ...i, added: false })),
        organizedSections: res.organizedSections,
      };
      setAnalysis(nextAnalysis);

      const savedNote = await saveWorkspaceNoteApi({
        title: res.suggestedTitle,
        rawInput: rawNotes,
        actionType: action,
        summary: res.summary,
        keyPoints: res.keyPoints,
        actionItems: res.actionItems,
        organizedSections: res.organizedSections,
      });
      onWorkspaceNoteSaved(savedNote);
      setStatusMessage(`Structured synthesis completed via ${res.model}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePushActionToTask = async (idx: number) => {
    if (!analysis) return;
    const item = analysis.actionItems[idx];
    if (!item || item.added) return;

    try {
      const created = await createTaskApi({
        title: item.title,
        notes: `Extracted from "${analysis.suggestedTitle}" (${item.dueHint})`,
        priority: item.priority,
        status: 'todo',
        source: 'AI Workspace',
      });
      onTaskCreated(created);
      setAnalysis((prev) =>
        prev
          ? {
              ...prev,
              actionItems: prev.actionItems.map((a, i) =>
                i === idx ? { ...a, added: true } : a
              ),
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create task.');
    }
  };

  const handleSaveBrief = async () => {
    if (!analysis) return;
    const markdown = [
      `# ${analysis.suggestedTitle}`,
      '',
      '## Executive Summary',
      analysis.summary,
      '',
      '## Key Points',
      ...analysis.keyPoints.map((kp) => `- ${kp}`),
      '',
      '## Action Items',
      ...analysis.actionItems.map(
        (ai) => `- [${ai.priority.toUpperCase()}] ${ai.title} (${ai.dueHint})`
      ),
      '',
      ...analysis.organizedSections.flatMap((sec) => [`## ${sec.heading}`, sec.content, '']),
    ].join('\n');

    try {
      const saved = await createDocumentApi({
        title: analysis.suggestedTitle,
        content: markdown,
        category: 'workspace_brief',
        provider: 'Gemini 4 Hydrogen',
      });
      onDocumentSaved(saved);
      setStatusMessage('Brief archived in Document Library.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive brief.');
    }
  };

  const loadSampleNotes = () => {
    setTitle('Q4 Product & Operations Weekly Sync');
    setRawNotes(
      'Attended by Elena (Ops), Marcus (Eng), Priya (Client Delivery).\n' +
        '- Engineering confirmed platform latency dropped 18% after query indexing.\n' +
        '- Enterprise client Acme Holdings requested updated onboarding runbook by Friday.\n' +
        '- Marcus will audit API error telemetry before Wednesday deployment.\n' +
        '- Need to draft executive board memo summarizing Q4 delivery milestones by Nov 24.\n' +
        '- Budget review for Q1 infrastructure tooling moved to Dec 2.'
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-neutral-500">Knowledge Synthesis</p>
          <h1 className="mt-1 font-serif-editorial text-2xl font-medium text-neutral-950 sm:text-3xl">
            Personal AI Workspace
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Transform unstructured notes into summaries, key points, organized sections, and live tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSampleNotes}
          className="rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-950 hover:text-neutral-950 whitespace-nowrap shrink-0 self-start"
        >
          Load Sample Meeting Notes
        </button>
      </div>

      {!geminiConfigured && (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
          Server status: <span className="font-semibold text-neutral-950">GEMINI_API_KEY</span> is not configured. Configure it in <span className="font-medium">Settings &gt; Secrets</span> to enable live Workspace synthesis.
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        {/* Raw Input */}
        <div className="space-y-4 xl:col-span-5">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Workspace synthesis focus">
            {ACTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={action === item.id}
                onClick={() => setAction(item.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  action === item.id
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="workspace-note-title" className="block text-xs font-medium text-neutral-700">
              Session / Note Title (optional)
            </label>
            <input
              id="workspace-note-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Executive Architecture Review"
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="workspace-raw-notes" className="block text-xs font-medium text-neutral-700">
              Unstructured Notes or Transcript
            </label>
            <textarea
              id="workspace-raw-notes"
              rows={11}
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              placeholder="Paste raw meeting notes, voice transcript, or research bullets..."
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm leading-relaxed text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4" />
            {isAnalyzing ? 'Synthesizing Notes...' : 'Synthesize with Gemini'}
          </button>

          {workspaceNotes.length > 0 && (
            <div className="pt-4">
              <p className="text-xs font-semibold text-neutral-700">Recent Analyses</p>
              <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
                {workspaceNotes.slice(0, 4).map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTitle(note.title);
                        setRawNotes(note.rawInput);
                        setAnalysis({
                          suggestedTitle: note.title,
                          summary: note.summary,
                          keyPoints: note.keyPoints,
                          actionItems: note.actionItems,
                          organizedSections: note.organizedSections,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-left transition-colors hover:bg-neutral-50"
                    >
                      <p className="truncate text-xs font-medium text-neutral-950">{note.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {note.actionItems.length} action items · {note.keyPoints.length} key points
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Structured Output */}
        <div className="space-y-6 xl:col-span-7">
          {error && (
            <div role="alert" className="rounded-lg border border-neutral-300 bg-neutral-50 p-4 text-xs font-medium text-neutral-900">
              Error: {error}
            </div>
          )}

          {!analysis ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
              <Sparkles className="h-6 w-6 text-neutral-400" />
              <h2 className="mt-3 text-sm font-semibold text-neutral-950">
                Ready for Structured Synthesis
              </h2>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-neutral-600">
                Run Gemini synthesis to extract an executive summary, key decisions, organized sections, and one-click tasks.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-neutral-950">
                    {analysis.suggestedTitle}
                  </h2>
                  {statusMessage && (
                    <p className="mt-0.5 text-xs text-neutral-500">{statusMessage}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveBrief}
                  className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 whitespace-nowrap shrink-0"
                >
                  <Save className="h-3.5 w-3.5" />
                  Archive Brief
                </button>
              </div>

              <div className="divide-y divide-neutral-200">
                <section className="p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Executive Summary
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-900">
                    {analysis.summary}
                  </p>
                </section>

                <section className="p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Key Points
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {analysis.keyPoints.map((kp, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-800">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-950 shrink-0" />
                        <span>{kp}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Action Items
                    </h3>
                    <span className="text-xs text-neutral-500 tabular-nums">
                      {analysis.actionItems.length} detected
                    </span>
                  </div>
                  <ul className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-200">
                    {analysis.actionItems.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-950">{item.title}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {item.priority.toUpperCase()} · {item.dueHint}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePushActionToTask(idx)}
                          disabled={item.added}
                          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                            item.added
                              ? 'border border-neutral-200 bg-neutral-50 text-neutral-600'
                              : 'bg-neutral-950 text-white hover:bg-neutral-800'
                          }`}
                        >
                          {item.added ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Added to Tasks
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              Add to Task Manager
                            </>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                {analysis.organizedSections.length > 0 && (
                  <section className="p-6 space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Organized Breakdown
                    </h3>
                    <div className="space-y-4">
                      {analysis.organizedSections.map((sec, idx) => (
                        <div key={idx}>
                          <h4 className="text-sm font-semibold text-neutral-950">
                            {sec.heading}
                          </h4>
                          <p className="mt-1 text-sm leading-relaxed text-neutral-700">
                            {sec.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
