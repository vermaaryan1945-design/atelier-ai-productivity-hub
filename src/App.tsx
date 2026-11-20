import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Mail,
  Menu,
  PenLine,
  Scale,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  DocumentItem,
  HubData,
  ModuleId,
  ProjectItem,
  TaskItem,
  WorkspaceNoteItem,
} from './types/hub';
import {
  fetchHealth,
  fetchHubData,
  type HealthStatus,
} from './services/api';
import {
  initWorkspaceAuth,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
} from './services/firebaseWorkspaceAuth';
import { computeHubMetrics } from './utils/hubLogic';
import { OverviewDashboard } from './components/OverviewDashboard';
import { WritingLab } from './components/WritingLab';
import { AIWorkspace } from './components/AIWorkspace';
import { TaskManager } from './components/TaskManager';
import { ProjectVault } from './components/ProjectVault';
import { ToolsComparison } from './components/ToolsComparison';
import { GoogleProductivity } from './components/GoogleProductivity';
import { DocumentLibrary } from './components/DocumentLibrary';
import { CommandPalette } from './components/CommandPalette';

const NAV_ITEMS: Array<{
  id: ModuleId;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'writing-lab', label: 'Writing Lab', icon: PenLine },
  { id: 'ai-workspace', label: 'AI Workspace', icon: Sparkles },
  { id: 'google-productivity', label: 'Google Productivity', icon: Mail },
  { id: 'task-manager', label: 'Task Manager', icon: CheckSquare },
  { id: 'project-vault', label: 'Project Vault', icon: FolderKanban },
  { id: 'document-library', label: 'Document Library', icon: FileText },
  { id: 'tools-comparison', label: 'Tools Comparison', icon: Scale },
];

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [hub, setHub] = useState<HubData>({
    tasks: [],
    projects: [],
    documents: [],
    workspaceNotes: [],
  });
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Firebase Auth & in-memory Workspace OAuth access token
  const [workspaceUser, setWorkspaceUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([fetchHubData(), fetchHealth()])
      .then(([hubRes, healthRes]) => {
        if (!active) return;
        setHub(hubRes);
        setHealth(healthRes);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load workspace data.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const unsubscribe = initWorkspaceAuth(
      (user, token) => {
        setWorkspaceUser(user);
        setAccessToken(token);
      },
      () => {
        setWorkspaceUser(null);
        setAccessToken(null);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const metrics = useMemo(
    () => computeHubMetrics(hub.tasks, hub.projects, hub.documents),
    [hub.tasks, hub.projects, hub.documents]
  );

  const handleNavigate = (mod: ModuleId) => {
    setActiveModule(mod);
    setMobileNavOpen(false);
  };

  const handleWorkspaceSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const res = await signInWithGoogleWorkspace();
      setWorkspaceUser(res.user);
      setAccessToken(res.accessToken);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or blocked.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleWorkspaceSignOut = async () => {
    await signOutGoogleWorkspace();
    setWorkspaceUser(null);
    setAccessToken(null);
  };

  const handleTasksChange = (tasks: TaskItem[]) => {
    setHub((prev) => ({ ...prev, tasks }));
  };

  const handleTaskCreated = (task: TaskItem) => {
    setHub((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
  };

  const handleProjectsChange = (projects: ProjectItem[]) => {
    setHub((prev) => ({ ...prev, projects }));
  };

  const handleDocumentsChange = (documents: DocumentItem[]) => {
    setHub((prev) => ({ ...prev, documents }));
  };

  const handleDocumentSaved = (doc: DocumentItem) => {
    setHub((prev) => ({ ...prev, documents: [doc, ...prev.documents] }));
  };

  const handleWorkspaceNoteSaved = (note: WorkspaceNoteItem) => {
    setHub((prev) => ({
      ...prev,
      workspaceNotes: [note, ...prev.workspaceNotes].slice(0, 25),
    }));
  };

  const activeNavMeta = NAV_ITEMS.find((item) => item.id === activeModule) ?? NAV_ITEMS[0];

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="border-b border-neutral-200 px-6 py-5">
          <button
            type="button"
            onClick={() => handleNavigate('overview')}
            className="text-left focus-visible:outline-2 focus-visible:outline-neutral-950"
          >
            <span className="font-serif-editorial text-xl font-semibold tracking-tight text-neutral-950 whitespace-nowrap">
              Atelier
            </span>
          </button>
        </div>

        <nav aria-label="Primary workspace navigation" className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-neutral-950 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-neutral-200 p-5 text-xs text-neutral-500 space-y-1.5">
        <p className="font-medium text-neutral-800">Workspace Readiness</p>
        <p>
          Gemini:{' '}
          {health === null
            ? 'Checking...'
            : health.geminiConfigured
              ? 'Configured'
              : 'Key Required'}
        </p>
        <p className="truncate">
          Google: {accessToken ? workspaceUser?.email || 'Connected' : 'Not Connected'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-neutral-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 border-r border-neutral-200 bg-white sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-white border-r border-neutral-200 h-full">
            <div className="absolute right-3 top-4">
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-8 border-b border-neutral-200 bg-white/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-md border border-neutral-200 p-2 text-neutral-700 hover:border-neutral-950 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-neutral-500 truncate">
              <span className="font-medium text-neutral-950">Atelier</span>
              <span aria-hidden="true">/</span>
              <span className="truncate">{activeNavMeta.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-950 hover:text-neutral-950 whitespace-nowrap shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-neutral-500" />
              <span>Quick Jump</span>
              <span className="hidden sm:inline font-mono text-[11px] text-neutral-400">
                ⌘K
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('google-productivity')}
              className="rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-800 transition-colors hover:border-neutral-950 whitespace-nowrap shrink-0"
            >
              {accessToken ? 'Google Connected' : 'Connect Google'}
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 sm:px-10 sm:py-10 max-w-7xl w-full mx-auto">
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-64 rounded bg-neutral-100" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 rounded-lg border border-neutral-200 bg-neutral-50" />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-lg border border-neutral-300 bg-neutral-50 p-6">
              <h2 className="text-sm font-semibold text-neutral-950">Unable to Load Workspace</h2>
              <p className="mt-1 text-xs text-neutral-600">{loadError}</p>
            </div>
          ) : (
            <>
              {activeModule === 'overview' && (
                <OverviewDashboard
                  metrics={metrics}
                  tasks={hub.tasks}
                  projects={hub.projects}
                  documents={hub.documents}
                  health={health}
                  workspaceConnected={Boolean(accessToken)}
                  workspaceEmail={workspaceUser?.email ?? null}
                  onNavigate={handleNavigate}
                />
              )}

              {activeModule === 'writing-lab' && (
                <WritingLab
                  projects={hub.projects}
                  geminiConfigured={Boolean(health?.geminiConfigured)}
                  onDocumentSaved={handleDocumentSaved}
                />
              )}

              {activeModule === 'ai-workspace' && (
                <AIWorkspace
                  workspaceNotes={hub.workspaceNotes}
                  geminiConfigured={Boolean(health?.geminiConfigured)}
                  onTaskCreated={handleTaskCreated}
                  onDocumentSaved={handleDocumentSaved}
                  onWorkspaceNoteSaved={handleWorkspaceNoteSaved}
                />
              )}

              {activeModule === 'task-manager' && (
                <TaskManager
                  tasks={hub.tasks}
                  projects={hub.projects}
                  onTasksChange={handleTasksChange}
                />
              )}

              {activeModule === 'project-vault' && (
                <ProjectVault
                  projects={hub.projects}
                  tasks={hub.tasks}
                  documents={hub.documents}
                  onProjectsChange={handleProjectsChange}
                />
              )}

              {activeModule === 'tools-comparison' && (
                <ToolsComparison
                  geminiConfigured={Boolean(health?.geminiConfigured)}
                />
              )}

              {activeModule === 'google-productivity' && (
                <GoogleProductivity
                  user={workspaceUser}
                  accessToken={accessToken}
                  geminiConfigured={Boolean(health?.geminiConfigured)}
                  isSigningIn={isSigningIn}
                  authError={authError}
                  onSignIn={handleWorkspaceSignIn}
                  onSignOut={handleWorkspaceSignOut}
                  onDocumentSaved={handleDocumentSaved}
                />
              )}

              {activeModule === 'document-library' && (
                <DocumentLibrary
                  documents={hub.documents}
                  projects={hub.projects}
                  tasks={hub.tasks}
                  onDocumentsChange={handleDocumentsChange}
                />
              )}
            </>
          )}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        tasks={hub.tasks}
        projects={hub.projects}
        documents={hub.documents}
        onClose={() => setPaletteOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
