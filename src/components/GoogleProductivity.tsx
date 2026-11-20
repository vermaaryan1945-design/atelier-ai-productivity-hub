import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ExternalLink,
  FileText,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import type {
  DocumentItem,
  GmailMessageSummary,
  GoogleDocDetail,
} from '../types/hub';
import {
  appendGoogleDoc,
  createDocumentApi,
  createGmailDraft,
  createGoogleDoc,
  fetchGmailMessages,
  fetchGoogleDoc,
  googleAssistApi,
  sendGmailMessage,
} from '../services/api';
import { extractGoogleDocId } from '../utils/hubLogic';
import { ConfirmDialog } from './ConfirmDialog';

interface GoogleProductivityProps {
  user: User | null;
  accessToken: string | null;
  geminiConfigured: boolean;
  isSigningIn: boolean;
  authError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onDocumentSaved: (doc: DocumentItem) => void;
}

type WorkspaceTab = 'gmail' | 'docs';

interface PendingAction {
  type: 'create_draft' | 'send_email' | 'create_doc' | 'append_doc';
  title: string;
  description: string;
  details: Array<{ label: string; value: string }>;
  confirmLabel: string;
}

export function GoogleProductivity({
  user,
  accessToken,
  geminiConfigured,
  isSigningIn,
  authError,
  onSignIn,
  onSignOut,
  onDocumentSaved,
}: GoogleProductivityProps) {
  const [tab, setTab] = useState<WorkspaceTab>('gmail');

  // Gmail states
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageSummary | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailPrompt, setEmailPrompt] = useState('');
  const [isDraftingEmail, setIsDraftingEmail] = useState(false);

  // Docs states
  const [docInput, setDocInput] = useState('');
  const [loadedDoc, setLoadedDoc] = useState<GoogleDocDetail | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docPrompt, setDocPrompt] = useState('');
  const [docOutput, setDocOutput] = useState('');
  const [docSummary, setDocSummary] = useState('');
  const [isAssistingDoc, setIsAssistingDoc] = useState(false);
  const [createdDocUrl, setCreatedDocUrl] = useState<string | null>(null);

  // Shared status / confirmation
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  const handleLoadInbox = async () => {
    if (!accessToken) return;
    setError(null);
    setNotice(null);
    setIsLoadingMessages(true);
    try {
      const res = await fetchGmailMessages(accessToken);
      setMessages(res.messages);
      setNotice(`Loaded ${res.messages.length} recent Gmail messages.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch Gmail messages.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectMessage = (msg: GmailMessageSummary) => {
    setSelectedMessage(msg);
    const emailMatch = msg.from.match(/<([^>]+)>/);
    setEmailTo(emailMatch ? emailMatch[1] : msg.from);
    setEmailSubject(
      msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`
    );
  };

  const handleGeminiEmailDraft = async () => {
    setError(null);
    setNotice(null);
    if (!emailPrompt.trim() && !selectedMessage) {
      setError('Enter drafting instructions or select a Gmail thread to reply to.');
      return;
    }

    setIsDraftingEmail(true);
    try {
      const result = await googleAssistApi({
        task: 'email_draft',
        prompt:
          emailPrompt.trim() ||
          'Draft a concise, helpful professional reply addressing the thread context.',
        recipientContext: selectedMessage
          ? `From: ${selectedMessage.from}\nSubject: ${selectedMessage.subject}\nSnippet: ${selectedMessage.snippet}`
          : undefined,
        tone: 'Executive & Clear',
      });
      if (result.subject && !emailSubject.trim()) {
        setEmailSubject(result.subject);
      } else if (result.subject && !selectedMessage) {
        setEmailSubject(result.subject);
      }
      setEmailBody(result.content);
      setNotice(`Email draft generated with ${result.model}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gemini email drafting failed.');
    } finally {
      setIsDraftingEmail(false);
    }
  };

  const handleFetchDoc = async () => {
    if (!accessToken) return;
    setError(null);
    setNotice(null);
    const docId = extractGoogleDocId(docInput);
    if (!docId) {
      setError('Enter a valid Google Docs URL or Document ID.');
      return;
    }

    setIsLoadingDoc(true);
    try {
      const doc = await fetchGoogleDoc(accessToken, docId);
      setLoadedDoc(doc);
      setDocTitle(doc.title);
      setNotice(`Loaded Google Doc "${doc.title}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Google Doc.');
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleDocAssist = async (task: 'doc_generate' | 'doc_summarize' | 'doc_improve') => {
    setError(null);
    setNotice(null);

    if (task === 'doc_generate' && !docPrompt.trim()) {
      setError('Provide a document brief before generating a new document.');
      return;
    }
    if ((task === 'doc_summarize' || task === 'doc_improve') && !loadedDoc?.bodyText && !docOutput.trim()) {
      setError('Load a Google Doc first or paste content to summarize or improve.');
      return;
    }

    setIsAssistingDoc(true);
    try {
      const res = await googleAssistApi({
        task,
        prompt: docPrompt.trim(),
        sourceContent: loadedDoc?.bodyText || docOutput,
      });

      if (task === 'doc_summarize') {
        setDocSummary(res.content);
        setNotice(`Document summary generated via ${res.model}.`);
      } else {
        if (res.title && !docTitle.trim()) {
          setDocTitle(res.title);
        }
        setDocOutput(res.content);
        setNotice(
          res.improvements
            ? `Improved content ready (${res.improvements})`
            : `Document draft generated via ${res.model}.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gemini document task failed.');
    } finally {
      setIsAssistingDoc(false);
    }
  };

  const executeConfirmedWorkspaceAction = async () => {
    if (!pendingAction || !accessToken) return;
    setIsExecutingAction(true);
    setError(null);
    setNotice(null);

    try {
      if (pendingAction.type === 'create_draft') {
        const res = await createGmailDraft(accessToken, {
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
        });
        setNotice(`Gmail draft created (Draft ID: ${res.draftId}).`);
      } else if (pendingAction.type === 'send_email') {
        const res = await sendGmailMessage(accessToken, {
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
        });
        setNotice(`Email sent via Gmail (Message ID: ${res.messageId}).`);
      } else if (pendingAction.type === 'create_doc') {
        const res = await createGoogleDoc(accessToken, {
          title: docTitle.trim() || 'Atelier Generated Document',
          content: docOutput,
        });
        setCreatedDocUrl(res.url);
        setNotice(`Created Google Doc "${res.title}".`);
      } else if (pendingAction.type === 'append_doc' && loadedDoc) {
        const res = await appendGoogleDoc(accessToken, loadedDoc.documentId, docOutput);
        setCreatedDocUrl(res.url);
        setNotice(`Updated Google Doc "${loadedDoc.title}".`);
      }
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace operation failed.');
      setPendingAction(null);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleSaveToLocalLibrary = async (title: string, content: string, category: 'email_draft' | 'google_doc') => {
    if (!content.trim()) return;
    try {
      const saved = await createDocumentApi({
        title: title.trim() || 'Google Productivity Draft',
        content,
        category,
        provider: 'Gemini + Google Workspace',
        externalDocId: loadedDoc?.documentId,
      });
      onDocumentSaved(saved);
      setNotice('Saved copy to Document Library.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive copy.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-medium text-neutral-500">Gemini & Workspace Sync</p>
          <h1 className="mt-1 font-serif-editorial text-2xl font-medium text-neutral-950 sm:text-3xl">
            Google Productivity
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Authorized Gmail and Google Docs assistance powered by Gemini and explicit user confirmation.
          </p>
        </div>

        {accessToken ? (
          <div className="flex flex-wrap items-center gap-3 self-start">
            <span className="text-xs text-neutral-600">
              Connected as <strong className="text-neutral-950">{user?.email || 'Google User'}</strong>
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-950 hover:text-neutral-950 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            disabled={isSigningIn}
            className="gsi-material-button self-start shrink-0"
          >
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              </div>
              <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
            </div>
          </button>
        )}
      </div>

      {/* Explicit Connection Setup Interface when unauthenticated */}
      {!accessToken && (
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 space-y-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-base font-semibold text-neutral-950">
                Google Workspace Authorization Required
              </h2>
              <p className="text-xs leading-relaxed text-neutral-600">
                Gmail and Google Docs data are never simulated. Sign in with Google above to grant an in-memory session token with least-privilege permissions:
              </p>
              <ul className="space-y-1 pt-1 text-xs text-neutral-700">
                <li>
                  · <strong>Gmail Read</strong> (<code className="font-mono text-[11px]">gmail.readonly</code>): View recent inbox threads for context.
                </li>
                <li>
                  · <strong>Gmail Compose</strong> (<code className="font-mono text-[11px]">gmail.compose</code>): Create drafts and send emails only after explicit confirmation.
                </li>
                <li>
                  · <strong>Google Docs</strong> (<code className="font-mono text-[11px]">documents</code>): Read, summarize, create, and update documents by ID or URL.
                </li>
              </ul>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-4 text-xs text-neutral-700 shrink-0 sm:w-72">
              <p className="font-semibold text-neutral-950">Readiness Checklist</p>
              <ul className="mt-2 space-y-1.5">
                <li>OAuth Client: Configured</li>
                <li>Gemini Server API: {geminiConfigured ? 'Ready' : 'Needs GEMINI_API_KEY'}</li>
                <li>User Session Token: Not signed in</li>
              </ul>
            </div>
          </div>
          {authError && (
            <p role="alert" className="text-xs font-medium text-neutral-900">
              Sign-in notice: {authError}
            </p>
          )}
        </section>
      )}

      {(error || notice) && (
        <div
          role={error ? 'alert' : 'status'}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-xs font-medium text-neutral-900"
        >
          <span>{error ? `Error: ${error}` : notice}</span>
          {createdDocUrl && (
            <a
              href={createdDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-neutral-600"
            >
              Open in Google Docs <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Workspace Sub-Navigation */}
      <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-1">
        <button
          type="button"
          onClick={() => setTab('gmail')}
          className={`inline-flex items-center gap-2 rounded px-4 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
            tab === 'gmail' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          Gmail Assistant
        </button>
        <button
          type="button"
          onClick={() => setTab('docs')}
          className={`inline-flex items-center gap-2 rounded px-4 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
            tab === 'docs' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Google Docs Studio
        </button>
      </div>

      {tab === 'gmail' ? (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          {/* Inbox Column */}
          <div className="rounded-lg border border-neutral-200 bg-white xl:col-span-5">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-neutral-950">Recent Gmail Threads</h2>
              <button
                type="button"
                onClick={handleLoadInbox}
                disabled={!accessToken || isLoadingMessages}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:border-neutral-950 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                {isLoadingMessages ? 'Loading...' : 'Load Inbox'}
              </button>
            </div>
            {!accessToken ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                Sign in with Google above to load your real Gmail messages.
              </div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                Click "Load Inbox" to retrieve your 8 most recent messages.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {messages.map((msg) => (
                  <li key={msg.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectMessage(msg)}
                      className={`w-full px-5 py-3.5 text-left transition-colors ${
                        selectedMessage?.id === msg.id ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <p className="truncate text-xs font-semibold text-neutral-950">
                        {msg.subject}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">{msg.from}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{msg.snippet}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Email Composer + Gemini Assistant */}
          <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-5 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-4">
              <h2 className="text-sm font-semibold text-neutral-950">
                Gemini Email Drafting & Compose
              </h2>
              {selectedMessage && (
                <span className="text-xs text-neutral-500 truncate max-w-xs">
                  Context: {selectedMessage.subject}
                </span>
              )}
            </div>

            <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
              <label htmlFor="gmail-ai-prompt" className="block text-xs font-medium text-neutral-700">
                Gemini Drafting Instructions
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="gmail-ai-prompt"
                  type="text"
                  value={emailPrompt}
                  onChange={(e) => setEmailPrompt(e.target.value)}
                  placeholder="e.g., Decline Thursday politely and propose Tuesday at 10am..."
                  className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleGeminiEmailDraft}
                  disabled={isDraftingEmail}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isDraftingEmail ? 'Drafting...' : 'Draft with Gemini'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gmail-to" className="block text-xs font-medium text-neutral-700">
                  Recipient
                </label>
                <input
                  id="gmail-to"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="recipient@company.com"
                  className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="gmail-subject" className="block text-xs font-medium text-neutral-700">
                  Subject
                </label>
                <input
                  id="gmail-subject"
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject line"
                  className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="gmail-body" className="block text-xs font-medium text-neutral-700">
                Email Body
              </label>
              <textarea
                id="gmail-body"
                rows={9}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Write or generate email content..."
                className="mt-1.5 w-full rounded-md border border-neutral-200 p-3 text-sm leading-relaxed text-neutral-950 focus:border-neutral-950 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  handleSaveToLocalLibrary(
                    emailSubject || 'Email Draft',
                    `To: ${emailTo}\nSubject: ${emailSubject}\n\n${emailBody}`,
                    'email_draft'
                  )
                }
                disabled={!emailBody.trim()}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-800 hover:border-neutral-950 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <Save className="h-3.5 w-3.5" />
                Save to Library
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!accessToken || !emailSubject.trim() || !emailBody.trim()}
                  onClick={() =>
                    setPendingAction({
                      type: 'create_draft',
                      title: 'Confirm Gmail Draft Creation',
                      description:
                        'Create this draft inside your authorized Gmail account?',
                      details: [
                        { label: 'Recipient', value: emailTo || '(None specified)' },
                        { label: 'Subject', value: emailSubject },
                      ],
                      confirmLabel: 'Create Gmail Draft',
                    })
                  }
                  className="rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-950 hover:border-neutral-950 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Create Gmail Draft
                </button>
                <button
                  type="button"
                  disabled={
                    !accessToken || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()
                  }
                  onClick={() =>
                    setPendingAction({
                      type: 'send_email',
                      title: 'Confirm Sending Email via Gmail',
                      description:
                        'This will immediately send an email from your Gmail account. Verify the recipient and subject before confirming.',
                      details: [
                        { label: 'To', value: emailTo },
                        { label: 'Subject', value: emailSubject },
                      ],
                      confirmLabel: 'Send Email Now',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send via Gmail
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          {/* Load Existing Google Doc + AI Actions */}
          <div className="space-y-5 xl:col-span-5">
            <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-950">
                Open Existing Google Doc
              </h2>
              <div>
                <label htmlFor="gdoc-url-input" className="block text-xs font-medium text-neutral-700">
                  Google Doc URL or Document ID
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="gdoc-url-input"
                    type="text"
                    value={docInput}
                    onChange={(e) => setDocInput(e.target.value)}
                    placeholder="https://docs.google.com/document/d/..."
                    className="flex-1 rounded-md border border-neutral-200 px-3 py-2 text-xs text-neutral-950 focus:border-neutral-950 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleFetchDoc}
                    disabled={!accessToken || isLoadingDoc}
                    className="rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    {isLoadingDoc ? 'Fetching...' : 'Fetch Doc'}
                  </button>
                </div>
              </div>

              {loadedDoc && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3.5">
                  <p className="text-xs font-semibold text-neutral-950">{loadedDoc.title}</p>
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-neutral-600">
                    {loadedDoc.bodyText || '(Document is currently empty)'}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-950">
                Gemini Document Operations
              </h2>
              <div>
                <label htmlFor="gdoc-ai-prompt" className="block text-xs font-medium text-neutral-700">
                  Generation / Improvement Brief
                </label>
                <textarea
                  id="gdoc-ai-prompt"
                  rows={4}
                  value={docPrompt}
                  onChange={(e) => setDocPrompt(e.target.value)}
                  placeholder="e.g., Generate a Q4 Vendor Onboarding Guide, or specify improvements for the fetched document..."
                  className="mt-1.5 w-full rounded-md border border-neutral-200 p-3 text-xs text-neutral-950 focus:border-neutral-950 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleDocAssist('doc_generate')}
                  disabled={isAssistingDoc}
                  className="rounded-md bg-neutral-950 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  Generate New Doc
                </button>
                <button
                  type="button"
                  onClick={() => handleDocAssist('doc_summarize')}
                  disabled={isAssistingDoc}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-900 hover:border-neutral-950 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  Summarize Doc
                </button>
                <button
                  type="button"
                  onClick={() => handleDocAssist('doc_improve')}
                  disabled={isAssistingDoc}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-900 hover:border-neutral-950 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  Improve Content
                </button>
              </div>
            </div>
          </div>

          {/* Document Output & Sync */}
          <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-5 xl:col-span-7">
            <div>
              <label htmlFor="gdoc-title" className="block text-xs font-medium text-neutral-700">
                Document Title
              </label>
              <input
                id="gdoc-title"
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document title for Google Docs or Library archive..."
                className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none"
              />
            </div>

            {docSummary && (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Executive Summary
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-neutral-800">
                  {docSummary}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="gdoc-content" className="block text-xs font-medium text-neutral-700">
                Document Content
              </label>
              <textarea
                id="gdoc-content"
                rows={12}
                value={docOutput}
                onChange={(e) => setDocOutput(e.target.value)}
                placeholder="Generated or improved document content appears here..."
                className="mt-1.5 w-full rounded-md border border-neutral-200 p-3 text-sm leading-relaxed text-neutral-950 focus:border-neutral-950 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  handleSaveToLocalLibrary(
                    docTitle || 'Google Doc Draft',
                    docOutput || docSummary,
                    'google_doc'
                  )
                }
                disabled={!docOutput.trim() && !docSummary.trim()}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-800 hover:border-neutral-950 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <Save className="h-3.5 w-3.5" />
                Save to Library
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {loadedDoc && (
                  <button
                    type="button"
                    disabled={!accessToken || !docOutput.trim()}
                    onClick={() =>
                      setPendingAction({
                        type: 'append_doc',
                        title: 'Confirm Google Doc Update',
                        description:
                          'Append this content to your existing Google Doc?',
                        details: [
                          { label: 'Document', value: loadedDoc.title },
                          { label: 'Document ID', value: loadedDoc.documentId },
                        ],
                        confirmLabel: 'Append to Google Doc',
                      })
                    }
                    className="rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-950 hover:border-neutral-950 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    Append to Loaded Doc
                  </button>
                )}

                <button
                  type="button"
                  disabled={!accessToken || !docTitle.trim() || !docOutput.trim()}
                  onClick={() =>
                    setPendingAction({
                      type: 'create_doc',
                      title: 'Confirm Creating Google Doc',
                      description:
                        'Create a new document inside your Google Docs account with this title and content?',
                      details: [{ label: 'Title', value: docTitle }],
                      confirmLabel: 'Create Google Doc',
                    })
                  }
                  className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Create Google Doc
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description ?? ''}
        details={pendingAction?.details}
        confirmLabel={pendingAction?.confirmLabel ?? 'Confirm'}
        busy={isExecutingAction}
        onConfirm={executeConfirmedWorkspaceAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
