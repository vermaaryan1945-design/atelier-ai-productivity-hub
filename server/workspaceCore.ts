import {
  encodeMimeEmail,
  extractDocBodyText,
  extractHeader,
} from './workspaceUtils.ts';

export interface WorkspaceResult {
  status: number;
  data: Record<string, unknown>;
}

export function parseBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function parseGoogleError(res: globalThis.Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: { message?: string; status?: string };
    };
    return data.error?.message || `Google API returned HTTP ${res.status}`;
  } catch {
    return `Google API returned HTTP ${res.status}`;
  }
}

export async function listGmailMessages(token: string | null): Promise<WorkspaceResult> {
  if (!token) {
    return {
      status: 401,
      data: { error: 'Google authorization required. Sign in with Google to access Gmail.' },
    };
  }

  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) {
      return { status: listRes.status, data: { error: await parseGoogleError(listRes) } };
    }

    const listData = (await listRes.json()) as {
      messages?: Array<{ id: string; threadId: string }>;
    };
    const refs = listData.messages ?? [];

    const detailed = await Promise.all(
      refs.map(async (ref) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) return null;
        const msgJson = (await msgRes.json()) as {
          id: string;
          threadId: string;
          snippet?: string;
          payload?: { headers?: Array<{ name?: string; value?: string }> };
        };
        const headers = msgJson.payload?.headers;
        return {
          id: msgJson.id,
          threadId: msgJson.threadId,
          subject: extractHeader(headers, 'Subject') || '(No Subject)',
          from: extractHeader(headers, 'From') || 'Unknown Sender',
          date: extractHeader(headers, 'Date') || '',
          snippet: msgJson.snippet || '',
        };
      })
    );

    return { status: 200, data: { messages: detailed.filter(Boolean) } };
  } catch (error) {
    return {
      status: 502,
      data: {
        error: error instanceof Error ? error.message : 'Failed to connect to Gmail API.',
      },
    };
  }
}

export async function createGmailDraftRemote(
  token: string | null,
  body: { to?: string; subject?: string; body?: string }
): Promise<WorkspaceResult> {
  if (!token) {
    return {
      status: 401,
      data: { error: 'Google authorization required to create a Gmail draft.' },
    };
  }

  if (!body.subject?.trim() || !body.body?.trim()) {
    return {
      status: 400,
      data: { error: 'Subject and email body are required to create a draft.' },
    };
  }

  try {
    const raw = encodeMimeEmail({
      to: body.to?.trim() || '',
      subject: body.subject.trim(),
      body: body.body.trim(),
    });

    const draftRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: { raw } }),
      }
    );

    if (!draftRes.ok) {
      return { status: draftRes.status, data: { error: await parseGoogleError(draftRes) } };
    }

    const data = (await draftRes.json()) as { id?: string };
    return { status: 200, data: { draftId: data.id, status: 'draft_created' } };
  } catch (error) {
    return {
      status: 502,
      data: { error: error instanceof Error ? error.message : 'Failed to create Gmail draft.' },
    };
  }
}

export async function sendGmailMessageRemote(
  token: string | null,
  body: { to?: string; subject?: string; body?: string }
): Promise<WorkspaceResult> {
  if (!token) {
    return {
      status: 401,
      data: { error: 'Google authorization required to send an email.' },
    };
  }

  if (!body.to?.trim() || !body.subject?.trim() || !body.body?.trim()) {
    return {
      status: 400,
      data: { error: 'Recipient, subject, and body are required to send an email.' },
    };
  }

  try {
    const raw = encodeMimeEmail({
      to: body.to.trim(),
      subject: body.subject.trim(),
      body: body.body.trim(),
    });

    const sendRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      }
    );

    if (!sendRes.ok) {
      return { status: sendRes.status, data: { error: await parseGoogleError(sendRes) } };
    }

    const data = (await sendRes.json()) as { id?: string; threadId?: string };
    return {
      status: 200,
      data: { messageId: data.id, threadId: data.threadId, status: 'sent' },
    };
  } catch (error) {
    return {
      status: 502,
      data: { error: error instanceof Error ? error.message : 'Failed to send Gmail message.' },
    };
  }
}

export async function getGoogleDocRemote(
  token: string | null,
  documentId: string | undefined
): Promise<WorkspaceResult> {
  if (!token) {
    return {
      status: 401,
      data: { error: 'Google authorization required to read Google Docs.' },
    };
  }

  const cleanId = documentId?.trim();
  if (!cleanId) {
    return { status: 400, data: { error: 'Valid Google Doc ID is required.' } };
  }

  try {
    const docRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(cleanId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!docRes.ok) {
      return { status: docRes.status, data: { error: await parseGoogleError(docRes) } };
    }

    const docJson = (await docRes.json()) as {
      documentId: string;
      title?: string;
      revisionId?: string;
    };

    return {
      status: 200,
      data: {
        documentId: docJson.documentId,
        title: docJson.title || 'Untitled Google Doc',
        revisionId: docJson.revisionId,
        bodyText: extractDocBodyText(docJson),
      },
    };
  } catch (error) {
    return {
      status: 502,
      data: { error: error instanceof Error ? error.message : 'Failed to fetch Google Doc.' },
    };
  }
}

export async function createGoogleDocRemote(
  token: string | null,
  body: { title?: string; content?: string }
): Promise<WorkspaceResult> {
  if (!token) {
    return {
      status: 401,
      data: { error: 'Google authorization required to create a Google Doc.' },
    };
  }

  if (!body.title?.trim()) {
    return { status: 400, data: { error: 'Document title is required.' } };
  }

  try {
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: body.title.trim() }),
    });

    if (!createRes.ok) {
      return { status: createRes.status, data: { error: await parseGoogleError(createRes) } };
    }

    const created = (await createRes.json()) as {
      documentId: string;
      title: string;
    };

    if (body.content?.trim()) {
      const updateRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: body.content.trim(),
                },
              },
            ],
          }),
        }
      );

      if (!updateRes.ok) {
        return {
          status: updateRes.status,
          data: { error: await parseGoogleError(updateRes) },
        };
      }
    }

    return {
      status: 200,
      data: {
        documentId: created.documentId,
        title: created.title,
        url: `https://docs.google.com/document/d/${created.documentId}/edit`,
      },
    };
  } catch (error) {
    return {
      status: 502,
      data: { error: error instanceof Error ? error.message : 'Failed to create Google Doc.' },
    };
  }
}

export async function appendGoogleDocRemote(
  token: string | null,
  documentId: string | undefined,
  content: string | undefined
): Promise<WorkspaceResult> {
  if (!token) {
    return {
      status: 401,
      data: { error: 'Google authorization required to update a Google Doc.' },
    };
  }

  const cleanId = documentId?.trim();
  if (!cleanId || !content?.trim()) {
    return { status: 400, data: { error: 'Document ID and content are required.' } };
  }

  try {
    const getRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(cleanId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!getRes.ok) {
      return { status: getRes.status, data: { error: await parseGoogleError(getRes) } };
    }

    const docJson = (await getRes.json()) as {
      body?: { content?: Array<{ endIndex?: number }> };
    };
    const elements = docJson.body?.content ?? [];
    const lastElement = elements[elements.length - 1];
    const insertIndex = Math.max(1, (lastElement?.endIndex ?? 2) - 1);

    const updateRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(cleanId)}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: insertIndex },
                text: `\n\n${content.trim()}`,
              },
            },
          ],
        }),
      }
    );

    if (!updateRes.ok) {
      return { status: updateRes.status, data: { error: await parseGoogleError(updateRes) } };
    }

    return {
      status: 200,
      data: {
        documentId: cleanId,
        status: 'updated',
        url: `https://docs.google.com/document/d/${cleanId}/edit`,
      },
    };
  } catch (error) {
    return {
      status: 502,
      data: { error: error instanceof Error ? error.message : 'Failed to update Google Doc.' },
    };
  }
}
