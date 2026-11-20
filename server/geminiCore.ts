import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { TaskPriority, WritingMode } from '../src/types/hub.ts';

export const GEMINI_MODEL = 'gemini-4-hydrogen';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export class GeminiServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = 'GEMINI_API_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isGeminiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiServiceError(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets (or Netlify Environment Variables) to run live Gemini generation.',
      503,
      'GEMINI_KEY_MISSING'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(
  fn: (model: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  let lastError: unknown;
  const attempts = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];

  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    try {
      const result = await fn(model);
      return { result, modelUsed: model };
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient =
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('429') ||
        msg.toLowerCase().includes('unavailable') ||
        msg.toLowerCase().includes('high demand') ||
        msg.toLowerCase().includes('timeout');
      if (!isTransient || i === attempts.length - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

function extractReadableMessage(rawMessage: string): string {
  const trimmed = rawMessage.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string }; message?: string };
      if (parsed.error?.message) return parsed.error.message;
      if (parsed.message) return parsed.message;
    } catch {
      // Keep raw string
    }
  }
  return rawMessage;
}

export function formatGeminiError(error: unknown): {
  status: number;
  body: { error: string; code: string; model: string };
} {
  const errObj = error as { statusCode?: number; status?: number; message?: string; code?: string };
  const rawStatus = errObj?.statusCode || errObj?.status || 500;
  const status = rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const readable = extractReadableMessage(errObj?.message || 'Unexpected Gemini API error.');

  let friendlyMessage = readable;
  if (readable.includes('API_KEY_INVALID') || status === 400) {
    friendlyMessage =
      'The configured Gemini API key was rejected (400). Verify GEMINI_API_KEY in Settings > Secrets.';
  } else if (readable.includes('PERMISSION_DENIED') || status === 403) {
    friendlyMessage =
      'Permission denied by Gemini API (403). Check your key permissions in Settings > Secrets.';
  } else if (readable.includes('RESOURCE_EXHAUSTED') || status === 429) {
    friendlyMessage =
      'Gemini API rate or quota limit reached (429). Please retry shortly or verify quota in Settings > Secrets.';
  }

  return {
    status,
    body: {
      error: friendlyMessage,
      code: errObj?.code || 'GEMINI_API_ERROR',
      model: GEMINI_MODEL,
    },
  };
}

const WRITING_INSTRUCTIONS: Record<WritingMode, string> = {
  email:
    'Draft a crisp, executive-ready email. Include a clear "Subject:" line followed by the email body. Avoid fluff or generic pleasantries.',
  report:
    'Write a structured executive report using clean Markdown headings (Executive Summary, Key Findings, Recommendations, Next Steps).',
  linkedin:
    'Compose a high-clarity professional LinkedIn post with a strong opening insight, concise paragraphs, and a thoughtful closing question. Avoid excessive hashtags or emojis.',
  cover_letter:
    'Write a tailored, persuasive cover letter connecting the candidate background to role outcomes with concrete authority and conciseness.',
  tone_refine:
    'Rewrite the provided text to elevate its tone according to the requested target tone while preserving factual meaning and precision.',
  grammar:
    'Correct grammar, syntax, punctuation, and sentence clarity in the provided text. Return the polished text first, followed by a brief bulleted list of key edits made.',
};

function buildWritingPrompt(params: {
  mode?: WritingMode;
  prompt?: string;
  context?: string;
  tone?: string;
  length?: string;
}) {
  const { mode, prompt, context, tone, length } = params;
  if (!mode || !WRITING_INSTRUCTIONS[mode]) {
    throw new GeminiServiceError('Invalid writing mode selected.', 400, 'INVALID_INPUT');
  }
  if (!prompt?.trim() && !context?.trim()) {
    throw new GeminiServiceError(
      'Please provide a brief or source text before generating.',
      400,
      'INVALID_INPUT'
    );
  }

  const systemInstruction = [
    'You are an executive editorial and business communications specialist.',
    WRITING_INSTRUCTIONS[mode],
    tone ? `Desired Tone: ${tone}.` : '',
    length ? `Desired Length: ${length}.` : '',
    'Deliver the finished writing directly without meta-commentary.',
  ]
    .filter(Boolean)
    .join(' ');

  const userParts: string[] = [];
  if (prompt?.trim()) userParts.push(`Brief / Instructions:\n${prompt.trim()}`);
  if (context?.trim()) userParts.push(`Source Text / Reference Context:\n${context.trim()}`);

  return { systemInstruction, contents: userParts.join('\n\n') };
}

export async function runGeminiWrite(params: {
  mode?: WritingMode;
  prompt?: string;
  context?: string;
  tone?: string;
  length?: string;
}) {
  const { systemInstruction, contents } = buildWritingPrompt(params);
  const ai = getClient();

  const { result: response, modelUsed } = await withRetry((model) =>
    ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
  );

  const content = (response.text ?? '').trim();
  if (!content) {
    throw new GeminiServiceError(
      'Gemini returned an empty response. Please try refining your brief.',
      502,
      'EMPTY_RESPONSE'
    );
  }

  return {
    content,
    model: modelUsed,
    generatedAt: new Date().toISOString(),
  };
}

export async function streamGeminiWrite(
  params: {
    mode?: WritingMode;
    prompt?: string;
    context?: string;
    tone?: string;
    length?: string;
  },
  onChunk: (text: string) => void
): Promise<{ model: string; generatedAt: string }> {
  const { systemInstruction, contents } = buildWritingPrompt(params);
  const ai = getClient();

  const attempts = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];
  let lastError: unknown;

  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    let emittedAny = false;
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      for await (const chunk of stream) {
        const piece = chunk.text;
        if (piece) {
          emittedAny = true;
          onChunk(piece);
        }
      }
      return { model, generatedAt: new Date().toISOString() };
    } catch (error) {
      lastError = error;
      if (emittedAny || i === attempts.length - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

export async function runGeminiWorkspace(params: {
  action?: 'summarize' | 'key_points' | 'action_items' | 'organize';
  notes?: string;
  title?: string;
}) {
  const { action, notes, title } = params;
  if (!notes?.trim()) {
    throw new GeminiServiceError(
      'Paste meeting notes, transcripts, or research text to analyze.',
      400,
      'INVALID_INPUT'
    );
  }

  const validAction =
    action && ['summarize', 'key_points', 'action_items', 'organize'].includes(action)
      ? action
      : 'organize';

  const ai = getClient();

  const { result: response, modelUsed } = await withRetry((model) =>
    ai.models.generateContent({
      model,
      contents: `Workspace Note Title: ${title?.trim() || 'Untitled Note'}\nPrimary Mode Requested: ${validAction}\n\nRaw Notes:\n${notes.trim()}`,
      config: {
        systemInstruction:
          'You are a precision executive chief-of-staff. Analyze the raw notes and return structured synthesis JSON: an executive summary, concise key points, concrete assignable action items with realistic priority ("high", "medium", or "low") and due hint, and organized topical sections.',
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTitle: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  dueHint: { type: Type.STRING },
                },
                required: ['title', 'priority', 'dueHint'],
              },
            },
            organizedSections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['heading', 'content'],
              },
            },
          },
          required: [
            'suggestedTitle',
            'summary',
            'keyPoints',
            'actionItems',
            'organizedSections',
          ],
        },
      },
    })
  );

  const jsonText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(jsonText) as {
    suggestedTitle?: string;
    summary?: string;
    keyPoints?: string[];
    actionItems?: Array<{ title: string; priority: string; dueHint: string }>;
    organizedSections?: Array<{ heading: string; content: string }>;
  };

  const normalizedActionItems = (parsed.actionItems ?? []).map((item) => {
    const p = item.priority?.toLowerCase();
    const priority: TaskPriority = p === 'high' || p === 'low' ? p : 'medium';
    return {
      title: item.title || 'Follow up item',
      priority,
      dueHint: item.dueHint || 'This week',
    };
  });

  return {
    suggestedTitle: parsed.suggestedTitle || title?.trim() || 'Workspace Synthesis',
    summary: parsed.summary || '',
    keyPoints: parsed.keyPoints ?? [],
    actionItems: normalizedActionItems,
    organizedSections: parsed.organizedSections ?? [],
    model: modelUsed,
  };
}

export async function runGeminiGoogleAssist(params: {
  task?: 'email_draft' | 'doc_generate' | 'doc_summarize' | 'doc_improve';
  prompt?: string;
  sourceContent?: string;
  tone?: string;
  recipientContext?: string;
}) {
  const { task, prompt, sourceContent, tone, recipientContext } = params;
  if (!prompt?.trim() && !sourceContent?.trim()) {
    throw new GeminiServiceError(
      'Provide instructions or source content for Gemini assistance.',
      400,
      'INVALID_INPUT'
    );
  }

  const ai = getClient();
  const assistTask = task ?? 'email_draft';

  if (assistTask === 'email_draft') {
    const { result: response, modelUsed } = await withRetry((model) =>
      ai.models.generateContent({
        model,
        contents: [
          recipientContext ? `Email Thread / Recipient Context:\n${recipientContext}` : '',
          prompt ? `Drafting Instructions:\n${prompt}` : '',
          sourceContent ? `Reference Notes:\n${sourceContent}` : '',
          tone ? `Tone: ${tone}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        config: {
          systemInstruction:
            'Draft a polished, ready-to-send business email. Return JSON with a concise subject line and clean plain-text email body.',
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              body: { type: Type.STRING },
            },
            required: ['subject', 'body'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      subject?: string;
      body?: string;
    };
    return {
      subject: parsed.subject ?? 'Follow-up',
      content: parsed.body ?? '',
      model: modelUsed,
    };
  }

  if (assistTask === 'doc_generate' || assistTask === 'doc_improve') {
    const { result: response, modelUsed } = await withRetry((model) =>
      ai.models.generateContent({
        model,
        contents: [
          prompt ? `Instructions:\n${prompt}` : '',
          sourceContent ? `Existing Document Text:\n${sourceContent}` : '',
          tone ? `Target Tone: ${tone}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        config: {
          systemInstruction:
            assistTask === 'doc_generate'
              ? 'Generate a well-structured Google Doc in clean plain text with clear section titles and paragraphs. Return JSON with title and content.'
              : 'Improve the clarity, structure, executive polish, and grammar of the provided Google Doc text. Return JSON with title, content (the improved full document text), and a concise summary of improvements.',
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              improvements: { type: Type.STRING },
            },
            required: ['title', 'content'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      title?: string;
      content?: string;
      improvements?: string;
    };
    return {
      title: parsed.title ?? 'Generated Document',
      content: parsed.content ?? '',
      improvements: parsed.improvements ?? '',
      model: modelUsed,
    };
  }

  const { result: response, modelUsed } = await withRetry((model) =>
    ai.models.generateContent({
      model,
      contents: `Document Content to Summarize:\n${sourceContent || prompt}`,
      config: {
        systemInstruction:
          'Summarize this Google Doc for an executive reader. Return a clear overview paragraph followed by key takeaways and open decisions.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
  );

  return {
    content: (response.text ?? '').trim(),
    model: modelUsed,
  };
}
