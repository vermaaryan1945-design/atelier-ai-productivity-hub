import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProviderPrompt,
  computeHubMetrics,
  exportHubBackupJson,
  exportTasksToCsv,
  extractGoogleDocId,
  filterDocuments,
  filterTasks,
} from './hubLogic';
import {
  encodeMimeEmail,
  extractDocBodyText,
  extractHeader,
} from '../../server/workspaceUtils.ts';
import type { DocumentItem, TaskItem } from '../types/hub';

test('extractGoogleDocId parses full Google Docs URLs and raw IDs', () => {
  assert.equal(
    extractGoogleDocId(
      'https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345/edit?usp=sharing'
    ),
    '1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345'
  );
  assert.equal(
    extractGoogleDocId('1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345'),
    '1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345'
  );
  assert.equal(extractGoogleDocId('short'), null);
  assert.equal(extractGoogleDocId('   '), null);
});

test('buildProviderPrompt produces structured prompts for ChatGPT and Claude', () => {
  const prompt = buildProviderPrompt({
    provider: 'claude',
    taskLabel: 'Executive Report',
    prompt: 'Summarize Q4 infrastructure goals',
    tone: 'Direct & Executive',
    length: 'Concise',
  });
  assert.match(prompt, /Claude Reusable Prompt/);
  assert.match(prompt, /Executive Report/);
  assert.match(prompt, /Direct & Executive/);
  assert.match(prompt, /Summarize Q4 infrastructure goals/);
});

test('computeHubMetrics accurately aggregates tasks, projects, and docs', () => {
  const tasks: TaskItem[] = [
    {
      id: 't1',
      title: 'Draft board memo',
      notes: '',
      status: 'done',
      priority: 'high',
      dueDate: '2026-11-20',
      projectId: 'p1',
      source: 'Manual',
      createdAt: '2026-11-18T10:00:00Z',
      updatedAt: '2026-11-18T10:00:00Z',
    },
    {
      id: 't2',
      title: 'Review contract',
      notes: '',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-11-22',
      projectId: 'p1',
      source: 'AI Workspace',
      createdAt: '2026-11-19T10:00:00Z',
      updatedAt: '2026-11-19T10:00:00Z',
    },
  ];
  const docs: DocumentItem[] = [
    {
      id: 'd1',
      title: 'Memo',
      content: 'Body',
      category: 'writing',
      provider: 'Gemini 4 Hydrogen',
      projectId: null,
      createdAt: '2026-11-19T10:00:00Z',
      updatedAt: '2026-11-19T10:00:00Z',
    },
  ];

  const metrics = computeHubMetrics(
    tasks,
    [{ status: 'active' }, { status: 'planning' }],
    docs
  );
  assert.equal(metrics.totalTasks, 2);
  assert.equal(metrics.openTasks, 1);
  assert.equal(metrics.completedTasks, 1);
  assert.equal(metrics.highPriorityOpen, 1);
  assert.equal(metrics.completionRate, 50);
  assert.equal(metrics.activeProjects, 1);
  assert.equal(metrics.totalDocuments, 1);
});

test('filterTasks and filterDocuments sort and filter deterministically', () => {
  const tasks: TaskItem[] = [
    {
      id: '1',
      title: 'Low priority task',
      notes: 'alpha',
      status: 'todo',
      priority: 'low',
      dueDate: '',
      projectId: null,
      source: 'Manual',
      createdAt: '2026-11-18T10:00:00Z',
      updatedAt: '2026-11-18T10:00:00Z',
    },
    {
      id: '2',
      title: 'Urgent launch check',
      notes: 'beta',
      status: 'todo',
      priority: 'high',
      dueDate: '',
      projectId: null,
      source: 'Manual',
      createdAt: '2026-11-19T10:00:00Z',
      updatedAt: '2026-11-19T10:00:00Z',
    },
  ];

  const sorted = filterTasks(tasks, '', 'all', 'all');
  assert.equal(sorted[0].id, '2');

  const filtered = filterTasks(tasks, 'launch', 'all', 'all');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '2');

  const docs: DocumentItem[] = [
    {
      id: 'd1',
      title: 'Q4 Briefing',
      content: 'Strategy notes',
      category: 'workspace_brief',
      provider: 'Gemini 4 Hydrogen',
      projectId: null,
      createdAt: '2026-11-18T10:00:00Z',
      updatedAt: '2026-11-18T10:00:00Z',
    },
  ];
  assert.equal(filterDocuments(docs, 'briefing', 'workspace_brief').length, 1);
  assert.equal(filterDocuments(docs, 'briefing', 'writing').length, 0);
});

test('extractDocBodyText extracts paragraphs and tables from Docs API payload', () => {
  const text = extractDocBodyText({
    body: {
      content: [
        { paragraph: { elements: [{ textRun: { content: 'Executive Summary\n' } }] } },
        {
          table: {
            tableRows: [
              {
                tableCells: [
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'Quarter' } }] } }] },
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'Target' } }] } }] },
                ],
              },
            ],
          },
        },
      ],
    },
  });
  assert.equal(text, 'Executive Summary\n\nQuarter | Target');
});

test('encodeMimeEmail creates URL-safe base64 RFC 2822 message and extractHeader finds headers', () => {
  const encoded = encodeMimeEmail({
    to: 'team@example.com',
    subject: 'Weekly Update',
    body: 'All milestones are on track.',
  });
  assert.equal(/[+/=]/.test(encoded), false);
  const decoded = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf-8'
  );
  assert.match(decoded, /To: team@example\.com/);
  assert.match(decoded, /Subject: Weekly Update/);
  assert.match(decoded, /All milestones are on track\./);

  assert.equal(
    extractHeader([{ name: 'Subject', value: 'Board Pack' }], 'subject'),
    'Board Pack'
  );
});

test('exportTasksToCsv escapes commas, quotes, and maps project names', () => {
  const csv = exportTasksToCsv(
    [
      {
        id: 't1',
        title: 'Finalize "Q4" plan, review',
        notes: 'Check line\nbreak',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-01',
        projectId: 'p1',
        source: 'Manual',
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      },
    ],
    [{ id: 'p1', name: 'Executive Roadmap' }]
  );

  const lines = csv.split('\n');
  assert.equal(lines[0], 'Title,Status,Priority,Due Date,Project,Source,Notes');
  assert.match(csv, /"Finalize ""Q4"" plan, review"/);
  assert.match(csv, /Executive Roadmap/);
  assert.match(csv, /"Check line\nbreak"/);
});

test('exportHubBackupJson wraps tasks, projects, and documents with metadata', () => {
  const raw = exportHubBackupJson({
    tasks: [],
    projects: [{ id: 'p1', name: 'Ops Scale' }],
    documents: [],
  });
  const parsed = JSON.parse(raw) as {
    exportedAt: string;
    application: string;
    projects: Array<{ id: string; name: string }>;
  };
  assert.equal(parsed.application, 'Atelier AI Productivity Hub');
  assert.ok(parsed.exportedAt);
  assert.equal(parsed.projects[0].name, 'Ops Scale');
});

