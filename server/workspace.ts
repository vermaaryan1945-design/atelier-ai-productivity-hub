import type { Request, Response } from 'express';
import {
  appendGoogleDocRemote,
  createGmailDraftRemote,
  createGoogleDocRemote,
  getGoogleDocRemote,
  listGmailMessages,
  parseBearerToken,
  sendGmailMessageRemote,
} from './workspaceCore.ts';

export async function handleGmailListMessages(req: Request, res: Response): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  const result = await listGmailMessages(token);
  res.status(result.status).json(result.data);
}

export async function handleGmailCreateDraft(req: Request, res: Response): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  const result = await createGmailDraftRemote(token, req.body ?? {});
  res.status(result.status).json(result.data);
}

export async function handleGmailSendMessage(req: Request, res: Response): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  const result = await sendGmailMessageRemote(token, req.body ?? {});
  res.status(result.status).json(result.data);
}

export async function handleDocsGet(req: Request, res: Response): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  const result = await getGoogleDocRemote(token, req.params.documentId);
  res.status(result.status).json(result.data);
}

export async function handleDocsCreate(req: Request, res: Response): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  const result = await createGoogleDocRemote(token, req.body ?? {});
  res.status(result.status).json(result.data);
}

export async function handleDocsAppend(req: Request, res: Response): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  const { content } = (req.body ?? {}) as { content?: string };
  const result = await appendGoogleDocRemote(token, req.params.documentId, content);
  res.status(result.status).json(result.data);
}
