import { useState } from 'react';
import { Check, Copy, ExternalLink, Save, Sparkles } from 'lucide-react';
import type {
  DocumentItem,
  ProjectItem,
  WritingMode,
  WritingProvider,
} from '../types/hub';
import { createDocumentApi, generateWritingStreamApi } from '../services/api';
import { buildProviderPrompt } from '../utils/hubLogic';

interface WritingLabProps {
  projects: ProjectItem[];
  geminiConfigured: boolean;
  onDocumentSaved: (doc: DocumentItem) => void;
}

const WRITING_MODES: Array<{
  id: WritingMode;
  label: string;
  actionLabel: string;
  placeholder: string;
}> = [
  {
    id: 'email',
    label: 'Email Generation',
    actionLabel: 'Generate Email',
    placeholder: 'e.g., Follow up with the enterprise procurement team on Q4 contract redlines and propose a Thursday review call.',
  },
  {
    id: 'report',
    label: 'Report Generation',
    actionLabel: 'Generate Report',
    placeholder: 'e.g., Executive summary of Q4 engineering reliability milestones, key risks, and next-quarter priorities.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn Content',
    actionLabel: 'Generate LinkedIn Post',
    placeholder: 'e.g., Share three lessons on building disciplined operational workflows without tool sprawl.',
  },
  {
    id: 'cover_letter',
    label: 'Cover Letter',
    actionLabel: 'Generate Cover Letter',
    placeholder: 'e.g., Principal Product Operations Lead role emphasizing cross-functional scale and executive reporting.',
  },
  {
    id: 'tone_refine',
    label: 'Tone Refinement',
    actionLabel: 'Refine Tone',
    placeholder: 'e.g., Refine the draft below to sound authoritative, calm, and concise for board leadership.',
  },
  {
    id: 'grammar',
    label: 'Grammar Improvement',
    actionLabel: 'Improve Grammar',
    placeholder: 'e.g., Fix grammar, punctuation, and tighten passive phrasing in the source draft below.',
  },
];

const TONES = ['Executive & Direct', 'Warm & Diplomatic', 'Analytical & Formal', 'Concise & Persuasive'];
const LENGTHS = ['Concise (1-2 paragraphs)', 'Standard', 'Comprehensive'];

export function WritingLab({
  projects,
  geminiConfigured,
  onDocumentSaved,
}: WritingLabProps) {
  const [mode, setMode] = useState<WritingMode>('email');
  const [provider, setProvider] = useState<WritingProvider>('gemini');
  const [tone, setTone] = useState(TONES[0]);
  const [length, setLength] = useState(LENGTHS[1]);
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeModeMeta = WRITING_MODES.find((m) => m.id === mode) ?? WRITING_MODES[0];

  const promptTemplate =
    provider === 'chatgpt' || provider === 'claude'
      ? buildProviderPrompt({
          provider,
          taskLabel: activeModeMeta.label,
          prompt,
          context,
          tone,
          length,
        })
      : '';

  const handleGenerate = async () => {
    setError(null);
    setStatusMessage(null);

    if (provider !== 'gemini') {
      return;
    }

    if (!prompt.trim() && !context.trim()) {
      setError('Enter a writing brief or source draft before running Gemini generation.');
      return;
    }

    setIsGenerating(true);
    setOutput('');
    setStatusMessage('Streaming response via Gemini...');
    try {
      const result = await generateWritingStreamApi(
        {
          mode,
          prompt,
          context,
          tone,
          length,
        },
        (partialText) => {
          setOutput(partialText);
        }
      );
      setOutput(result.content);
      if (!docTitle.trim()) {
        setDocTitle(`${activeModeMeta.label} — ${new Date().toLocaleDateString('en-US')}`);
      }
      setStatusMessage(`Generated via ${result.model}`);
    } catch (err) {
      setStatusMessage(null);
      setError(err instanceof Error ? err.message : 'Unable to generate writing.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (textToCopy: string) => {
    if (!textToCopy.trim()) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSaveToLibrary = async () => {
    const contentToSave = provider === 'gemini' ? output : promptTemplate;
    if (!contentToSave.trim()) {
      setError('Generate or prepare content before saving to the Document Library.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const saved = await createDocumentApi({
        title: docTitle.trim() || `${activeModeMeta.label} Draft`,
        content: contentToSave,
        category: 'writing',
        provider:
          provider === 'gemini'
            ? 'Gemini 4 Hydrogen'
            : provider === 'chatgpt'
              ? 'ChatGPT (Prompt Mode)'
              : 'Claude (Prompt Mode)',
        projectId: projectId || null,
      });
      onDocumentSaved(saved);
      setStatusMessage('Saved to Document Library.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-medium text-neutral-500">Editorial Engine</p>
          <h1 className="mt-1 font-serif-editorial text-2xl font-medium text-neutral-950 sm:text-3xl">
            Professional Writing Lab
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Compose executive communications, refine tone, or prepare structured prompts across providers.
          </p>
        </div>

        {/* Provider Switcher */}
        <div
          className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-1 self-start"
          role="group"
          aria-label="Select AI writing provider"
        >
          {(
            [
              { id: 'gemini', label: 'Gemini (Live API)' },
              { id: 'chatgpt', label: 'ChatGPT (Prompt Mode)' },
              { id: 'claude', label: 'Claude (Prompt Mode)' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setProvider(item.id);
                setError(null);
                setStatusMessage(null);
              }}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                provider === item.id
                  ? 'bg-neutral-950 text-white'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Writing tasks">
        {WRITING_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => setMode(item.id)}
            className={`rounded-md border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              mode === item.id
                ? 'border-neutral-950 bg-neutral-950 text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:text-neutral-950'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!geminiConfigured && provider === 'gemini' && (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
          Server status: <span className="font-semibold text-neutral-950">GEMINI_API_KEY</span> is not currently configured on the server. Add your key in <span className="font-medium">Settings &gt; Secrets</span> to run live Gemini generation, or switch to ChatGPT / Claude Prompt Mode.
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        {/* Input Controls */}
        <div className="space-y-5 xl:col-span-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="writing-tone" className="block text-xs font-medium text-neutral-700">
                Tone
              </label>
              <select
                id="writing-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="writing-length" className="block text-xs font-medium text-neutral-700">
                Length
              </label>
              <select
                id="writing-length"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
              >
                {LENGTHS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="writing-brief" className="block text-xs font-medium text-neutral-700">
              Brief / Objective
            </label>
            <textarea
              id="writing-brief"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={activeModeMeta.placeholder}
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="writing-context" className="block text-xs font-medium text-neutral-700">
              Source Draft or Reference Notes (optional)
            </label>
            <textarea
              id="writing-context"
              rows={5}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Paste an existing draft for tone refinement, grammar editing, or background context..."
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
            />
          </div>

          {provider === 'gemini' ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? 'Streaming with Gemini...' : activeModeMeta.actionLabel}
            </button>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-950">
                  Demonstration / Prompt Mode — {provider === 'chatgpt' ? 'ChatGPT' : 'Claude'}
                </span>
                <span className="text-xs text-neutral-500">No external API key configured</span>
              </div>
              <p className="text-xs leading-relaxed text-neutral-600">
                External {provider === 'chatgpt' ? 'OpenAI' : 'Anthropic'} credentials are not linked. Copy the structured prompt below and launch the official platform directly.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(promptTemplate)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 whitespace-nowrap shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied Prompt' : 'Copy Reusable Prompt'}
                </button>
                <a
                  href={provider === 'chatgpt' ? 'https://chatgpt.com' : 'https://claude.ai'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-900 hover:border-neutral-950 whitespace-nowrap shrink-0"
                >
                  Open {provider === 'chatgpt' ? 'ChatGPT' : 'Claude'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Output / Workspace Panel */}
        <div className="flex flex-col rounded-lg border border-neutral-200 bg-white xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950">
                {provider === 'gemini'
                  ? 'Generated Deliverable'
                  : `${provider === 'chatgpt' ? 'ChatGPT' : 'Claude'} Prompt Output (Demonstration Mode)`}
              </h2>
              {statusMessage && (
                <p className="mt-0.5 text-xs text-neutral-500">{statusMessage}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(provider === 'gemini' ? output : promptTemplate)}
                disabled={provider === 'gemini' ? !output.trim() : !promptTemplate.trim()}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-950 hover:text-neutral-950 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs font-medium text-neutral-900"
            >
              Error: {error}
            </div>
          )}

          <div className="flex-1 p-5">
            {provider === 'gemini' ? (
              <textarea
                aria-label="Generated writing output"
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                rows={15}
                placeholder="Your Gemini-generated deliverable will appear here. You can edit the text directly before copying or archiving it to your Document Library."
                className="h-full min-h-[340px] w-full resize-y border-0 bg-transparent text-sm leading-relaxed text-neutral-950 placeholder:text-neutral-400 focus:outline-none"
              />
            ) : (
              <pre className="min-h-[340px] whitespace-pre-wrap font-mono text-xs leading-relaxed text-neutral-800">
                {promptTemplate}
              </pre>
            )}
          </div>

          {/* Save Bar */}
          <div className="flex flex-col gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-3.5 sm:flex-row sm:items-center">
            <input
              type="text"
              aria-label="Document title for library archive"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Document title..."
              className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
            />
            <select
              aria-label="Link project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-neutral-950 focus:outline-none"
            >
              <option value="">No project linked</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveToLibrary}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save to Library'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
