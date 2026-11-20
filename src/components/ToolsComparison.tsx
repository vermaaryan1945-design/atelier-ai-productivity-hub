import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { buildProviderPrompt } from '../utils/hubLogic';

interface ToolsComparisonProps {
  geminiConfigured: boolean;
}

const PROMPT_TEMPLATES = [
  {
    id: 'exec-brief',
    category: 'Executive Synthesis',
    title: 'Board-Ready Decision Memo',
    taskLabel: 'Executive Decision Memo',
    defaultPrompt:
      'Convert the following project updates into a 1-page decision memo covering Situation, Options Evaluated, Recommendation, and Risks.',
  },
  {
    id: 'client-reply',
    category: 'Client Communications',
    title: 'High-Stakes Scope Clarification Email',
    taskLabel: 'Client Scope Clarification Email',
    defaultPrompt:
      'Write a calm, diplomatic email clarifying timeline boundaries and change-request pricing while preserving executive rapport.',
  },
  {
    id: 'meeting-audit',
    category: 'Operations',
    title: 'Transcript Action & Owner Audit',
    taskLabel: 'Meeting Transcript Audit',
    defaultPrompt:
      'Extract every commitment, owner, deadline, and unresolved dependency from this transcript into a clean markdown table.',
  },
];

export function ToolsComparison({ geminiConfigured }: ToolsComparisonProps) {
  const [selectedProvider, setSelectedProvider] = useState<'chatgpt' | 'claude'>('chatgpt');
  const [selectedTemplateId, setSelectedTemplateId] = useState(PROMPT_TEMPLATES[0].id);
  const [customContext, setCustomContext] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeTemplate =
    PROMPT_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? PROMPT_TEMPLATES[0];

  const compiledPrompt = buildProviderPrompt({
    provider: selectedProvider,
    taskLabel: activeTemplate.taskLabel,
    prompt: activeTemplate.defaultPrompt,
    context: customContext,
    tone: 'Executive & Direct',
  });

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-10">
      <div className="border-b border-neutral-200 pb-6">
        <p className="text-xs font-medium text-neutral-500">Provider Architecture</p>
        <h1 className="mt-1 font-serif-editorial text-2xl font-medium text-neutral-950 sm:text-3xl">
          AI Tools Comparison
        </h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Evaluate integrated Gemini workflows alongside reusable prompt workflows for ChatGPT and Claude.
        </p>
      </div>

      {/* Capability Comparison Table */}
      <section className="rounded-lg border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-700">
              <th className="px-5 py-3.5">Capability Dimension</th>
              <th className="px-5 py-3.5">Google Gemini (gemini-4-hydrogen)</th>
              <th className="px-5 py-3.5">OpenAI ChatGPT</th>
              <th className="px-5 py-3.5">Anthropic Claude</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-xs leading-relaxed text-neutral-700">
            <tr>
              <td className="px-5 py-4 font-semibold text-neutral-950">Integration Mode</td>
              <td className="px-5 py-4 text-neutral-950 font-medium">
                {geminiConfigured
                  ? 'Live Server-Side API Configured'
                  : 'Server-Side API Ready (Set GEMINI_API_KEY)'}
              </td>
              <td className="px-5 py-4">Demonstration / Prompt Mode (No API Key)</td>
              <td className="px-5 py-4">Demonstration / Prompt Mode (No API Key)</td>
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-neutral-950">Primary Strengths</td>
              <td className="px-5 py-4">
                Native Google Workspace synergy, structured JSON extraction into tasks, fast reasoning & drafting.
              </td>
              <td className="px-5 py-4">
                Conversational iteration, brainstorming variants, and structured framework drafting.
              </td>
              <td className="px-5 py-4">
                Long-form editorial nuance, policy analysis, and multi-document synthesis.
              </td>
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-neutral-950">Workspace Sync</td>
              <td className="px-5 py-4">
                Direct save to Document Library, Task Manager, Gmail drafts, and Google Docs.
              </td>
              <td className="px-5 py-4">Copy structured prompt and launch ChatGPT web app.</td>
              <td className="px-5 py-4">Copy structured prompt and launch Claude web app.</td>
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-neutral-950">Official Platform</td>
              <td className="px-5 py-4">Built directly into Writing Lab, AI Workspace & Google Productivity</td>
              <td className="px-5 py-4">
                <a
                  href="https://chatgpt.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-neutral-950 underline underline-offset-4 hover:text-neutral-600"
                >
                  chatgpt.com <ExternalLink className="h-3 w-3" />
                </a>
              </td>
              <td className="px-5 py-4">
                <a
                  href="https://claude.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-neutral-950 underline underline-offset-4 hover:text-neutral-600"
                >
                  claude.ai <ExternalLink className="h-3 w-3" />
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Reusable Prompt Workbench (Demonstration Mode) */}
      <section className="rounded-lg border border-neutral-200 bg-white p-6 space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              ChatGPT & Claude Prompt Workbench (Demonstration Mode)
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              External API keys are not connected. Prepare deterministic prompts here and open the official platform.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-1 self-start">
            {(['chatgpt', 'claude'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedProvider(p)}
                className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                  selectedProvider === p
                    ? 'bg-neutral-950 text-white'
                    : 'text-neutral-600 hover:text-neutral-950'
                }`}
              >
                {p === 'chatgpt' ? 'ChatGPT Prompt' : 'Claude Prompt'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div>
              <p className="text-xs font-medium text-neutral-700">Reusable Templates</p>
              <div className="mt-2 space-y-2">
                {PROMPT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selectedTemplateId === tpl.id
                        ? 'border-neutral-950 bg-neutral-50'
                        : 'border-neutral-200 bg-white hover:border-neutral-400'
                    }`}
                  >
                    <p className="text-xs text-neutral-500">{tpl.category}</p>
                    <p className="mt-0.5 text-sm font-medium text-neutral-950">{tpl.title}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="comparison-context" className="block text-xs font-medium text-neutral-700">
                Attach Context or Raw Notes
              </label>
              <textarea
                id="comparison-context"
                rows={4}
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="Paste facts, metrics, or source draft to inject into the prompt..."
                className="mt-1.5 w-full rounded-md border border-neutral-200 p-3 text-xs text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-neutral-200 bg-neutral-50 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-3">
              <span className="text-xs font-semibold text-neutral-950">
                Prepared Prompt ({selectedProvider === 'chatgpt' ? 'ChatGPT' : 'Claude'})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(compiledPrompt, 'workbench')}
                  className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 whitespace-nowrap shrink-0"
                >
                  {copiedId === 'workbench' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedId === 'workbench' ? 'Copied Prompt' : 'Copy Prompt'}
                </button>
                <a
                  href={selectedProvider === 'chatgpt' ? 'https://chatgpt.com' : 'https://claude.ai'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:border-neutral-950 whitespace-nowrap shrink-0"
                >
                  Open {selectedProvider === 'chatgpt' ? 'ChatGPT' : 'Claude'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <pre className="flex-1 whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-neutral-800">
              {compiledPrompt}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
