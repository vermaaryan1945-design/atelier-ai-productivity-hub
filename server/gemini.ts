import type { Request, Response } from 'express';
import {
  formatGeminiError,
  runGeminiGoogleAssist,
  runGeminiWorkspace,
  runGeminiWrite,
  streamGeminiWrite,
} from './geminiCore.ts';

export async function handleGeminiWrite(req: Request, res: Response): Promise<void> {
  try {
    const result = await runGeminiWrite(req.body ?? {});
    res.json(result);
  } catch (error) {
    const formatted = formatGeminiError(error);
    res.status(formatted.status).json(formatted.body);
  }
}

export async function handleGeminiWriteStream(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const meta = await streamGeminiWrite(req.body ?? {}, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ done: true, ...meta })}\n\n`);
    res.end();
  } catch (error) {
    const formatted = formatGeminiError(error);
    res.write(`data: ${JSON.stringify({ error: formatted.body.error })}\n\n`);
    res.end();
  }
}

export async function handleGeminiWorkspace(req: Request, res: Response): Promise<void> {
  try {
    const result = await runGeminiWorkspace(req.body ?? {});
    res.json(result);
  } catch (error) {
    const formatted = formatGeminiError(error);
    res.status(formatted.status).json(formatted.body);
  }
}

export async function handleGeminiGoogleAssist(req: Request, res: Response): Promise<void> {
  try {
    const result = await runGeminiGoogleAssist(req.body ?? {});
    res.json(result);
  } catch (error) {
    const formatted = formatGeminiError(error);
    res.status(formatted.status).json(formatted.body);
  }
}
