import {
  formatGeminiError,
  GEMINI_MODEL,
  isGeminiConfigured,
  runGeminiGoogleAssist,
  runGeminiWorkspace,
  runGeminiWrite,
  streamGeminiWrite,
} from '../../server/geminiCore.ts';
import {
  appendGoogleDocRemote,
  createGmailDraftRemote,
  createGoogleDocRemote,
  getGoogleDocRemote,
  listGmailMessages,
  parseBearerToken,
  sendGmailMessageRemote,
} from '../../server/workspaceCore.ts';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rawPath = url.pathname
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '');
  const method = req.method.toUpperCase();

  if (method === 'GET' && rawPath === '/health') {
    return jsonResponse({
      ok: true,
      geminiConfigured: isGeminiConfigured(),
      geminiModel: GEMINI_MODEL,
      workspaceOAuthConfigured: true,
      storageMode: 'serverless',
      timestamp: new Date().toISOString(),
    });
  }

  // Gemini endpoints
  if (method === 'POST' && rawPath === '/gemini/write') {
    try {
      const body = await readJsonBody(req);
      return jsonResponse(await runGeminiWrite(body));
    } catch (error) {
      const formatted = formatGeminiError(error);
      return jsonResponse(formatted.body, formatted.status);
    }
  }

  if (method === 'POST' && rawPath === '/gemini/write/stream') {
    const body = await readJsonBody(req);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const meta = await streamGeminiWrite(body, (chunk) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, ...meta })}\n\n`));
        } catch (error) {
          const formatted = formatGeminiError(error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: formatted.body.error })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  }

  if (method === 'POST' && rawPath === '/gemini/workspace') {
    try {
      const body = await readJsonBody(req);
      return jsonResponse(await runGeminiWorkspace(body));
    } catch (error) {
      const formatted = formatGeminiError(error);
      return jsonResponse(formatted.body, formatted.status);
    }
  }

  if (method === 'POST' && rawPath === '/gemini/google-assist') {
    try {
      const body = await readJsonBody(req);
      return jsonResponse(await runGeminiGoogleAssist(body));
    } catch (error) {
      const formatted = formatGeminiError(error);
      return jsonResponse(formatted.body, formatted.status);
    }
  }

  // Google Workspace proxy endpoints
  const token = parseBearerToken(req.headers.get('authorization'));

  if (method === 'GET' && rawPath === '/workspace/gmail/messages') {
    const res = await listGmailMessages(token);
    return jsonResponse(res.data, res.status);
  }

  if (method === 'POST' && rawPath === '/workspace/gmail/drafts') {
    const body = await readJsonBody(req);
    const res = await createGmailDraftRemote(token, body);
    return jsonResponse(res.data, res.status);
  }

  if (method === 'POST' && rawPath === '/workspace/gmail/send') {
    const body = await readJsonBody(req);
    const res = await sendGmailMessageRemote(token, body);
    return jsonResponse(res.data, res.status);
  }

  const docsAppendMatch = rawPath.match(/^\/workspace\/docs\/([^/]+)\/append$/);
  if (method === 'POST' && docsAppendMatch) {
    const body = await readJsonBody(req);
    const res = await appendGoogleDocRemote(
      token,
      decodeURIComponent(docsAppendMatch[1]),
      typeof body.content === 'string' ? body.content : undefined
    );
    return jsonResponse(res.data, res.status);
  }

  const docsGetMatch = rawPath.match(/^\/workspace\/docs\/([^/]+)$/);
  if (method === 'GET' && docsGetMatch) {
    const res = await getGoogleDocRemote(token, decodeURIComponent(docsGetMatch[1]));
    return jsonResponse(res.data, res.status);
  }

  if (method === 'POST' && rawPath === '/workspace/docs') {
    const body = await readJsonBody(req);
    const res = await createGoogleDocRemote(token, body);
    return jsonResponse(res.data, res.status);
  }

  return jsonResponse({ error: `Route not found: ${method} ${rawPath}` }, 404);
}
