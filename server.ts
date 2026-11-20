import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  createDocument,
  createProject,
  createTask,
  deleteDocument,
  deleteProject,
  deleteTask,
  getHubData,
  saveWorkspaceNote,
  updateDocument,
  updateProject,
  updateTask,
} from './server/store.ts';
import {
  handleGeminiGoogleAssist,
  handleGeminiWorkspace,
  handleGeminiWrite,
  handleGeminiWriteStream,
} from './server/gemini.ts';
import {
  handleDocsAppend,
  handleDocsCreate,
  handleDocsGet,
  handleGmailCreateDraft,
  handleGmailListMessages,
  handleGmailSendMessage,
} from './server/workspace.ts';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  // Health & safe capability status (never exposes secrets)
  app.get('/api/health', (_req, res) => {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const geminiConfigured = Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY');
    const firebaseConfigExists = fs.existsSync(
      path.resolve(process.cwd(), 'firebase-applet-config.json')
    );

    res.json({
      ok: true,
      geminiConfigured,
      geminiModel: 'gemini-4-hydrogen',
      workspaceOAuthConfigured: firebaseConfigExists,
      storageMode: 'server',
      timestamp: new Date().toISOString(),
    });
  });

  // Hub state CRUD
  app.get('/api/hub', (_req, res) => {
    res.json(getHubData());
  });

  app.post('/api/tasks', (req, res) => {
    const { title, notes, status, priority, dueDate, projectId, source } = req.body ?? {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Task title is required.' });
      return;
    }
    const created = createTask({
      title,
      notes,
      status,
      priority,
      dueDate,
      projectId,
      source,
    });
    res.status(201).json(created);
  });

  app.patch('/api/tasks/:id', (req, res) => {
    const updated = updateTask(req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const ok = deleteTask(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  app.post('/api/projects', (req, res) => {
    const { name, summary, owner, status, targetDate } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Project name is required.' });
      return;
    }
    const created = createProject({ name, summary, owner, status, targetDate });
    res.status(201).json(created);
  });

  app.patch('/api/projects/:id', (req, res) => {
    const updated = updateProject(req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/projects/:id', (req, res) => {
    const ok = deleteProject(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  app.post('/api/documents', (req, res) => {
    const { title, content, category, provider, projectId, externalDocId } = req.body ?? {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Document title is required.' });
      return;
    }
    if (typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Document content is required.' });
      return;
    }
    const created = createDocument({
      title,
      content,
      category,
      provider,
      projectId,
      externalDocId,
    });
    res.status(201).json(created);
  });

  app.patch('/api/documents/:id', (req, res) => {
    const updated = updateDocument(req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/documents/:id', (req, res) => {
    const ok = deleteDocument(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  app.post('/api/workspace-notes', (req, res) => {
    const body = req.body ?? {};
    if (!body.title || !body.rawInput) {
      res.status(400).json({ error: 'Note title and raw input are required.' });
      return;
    }
    const saved = saveWorkspaceNote(body);
    res.status(201).json(saved);
  });

  // Server-side Gemini AI endpoints
  app.post('/api/gemini/write', handleGeminiWrite);
  app.post('/api/gemini/write/stream', handleGeminiWriteStream);
  app.post('/api/gemini/workspace', handleGeminiWorkspace);
  app.post('/api/gemini/google-assist', handleGeminiGoogleAssist);

  // Google Workspace proxy endpoints (client passes Bearer accessToken)
  app.get('/api/workspace/gmail/messages', handleGmailListMessages);
  app.post('/api/workspace/gmail/drafts', handleGmailCreateDraft);
  app.post('/api/workspace/gmail/send', handleGmailSendMessage);
  app.get('/api/workspace/docs/:documentId', handleDocsGet);
  app.post('/api/workspace/docs', handleDocsCreate);
  app.post('/api/workspace/docs/:documentId/append', handleDocsAppend);

  // Frontend serving (Vite dev middleware in dev, static dist/ in production)
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Atelier AI Productivity Hub listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
