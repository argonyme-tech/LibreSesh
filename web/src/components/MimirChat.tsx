import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PrimaryButton, Spinner, useToast } from './ui';

/** Mímir add-on: the chat, extracted so it can live both in the Mímir tab and
 *  in the floating panel available across the app ("the system's main chat",
 *  per the facilitator's decision 2026-09-01). Indigo = Mímir speaking. */

export const mimirChip =
  'inline-flex items-center gap-1 rounded-full border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300';

export function MimirChat({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const [engine, setEngine] = useState<boolean | null>(null);
  const [model, setModel] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const refresh = useCallback(
    () =>
      api
        .mimirStatus(slug)
        .then((s) => {
          setEngine(s.engine);
          setModel(s.model);
        })
        .catch(() => setEngine(false)),
    [slug],
  );
  useEffect(() => void refresh(), [refresh]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const saveKey = useCallback(async () => {
    if (!keyDraft.trim()) return;
    setSavingKey(true);
    try {
      await api.mimirSetKey(slug, {
        key: keyDraft.trim(),
        ...(urlDraft.trim() ? { url: urlDraft.trim() } : {}),
        ...(modelDraft.trim() ? { model: modelDraft.trim() } : {}),
      });
      setKeyDraft('');
      await refresh();
      toast.show('Engine armed — the key lives on the server only');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setSavingKey(false);
    }
  }, [keyDraft, refresh, slug, toast]);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      const res = await api.mimirChat(slug, next);
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      toast.show((err as Error).message);
      setMessages(messages);
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }, [busy, draft, messages, slug, toast]);

  if (engine === null) return <Spinner label="Checking engine…" />;

  if (!engine) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-stone-900 p-5 text-sm">
        <span className={mimirChip}>◆ engine off</span>
        <p className="mt-3">
          Paste an API key — stored on the server only, never shown again. Default provider is
          the Claude API (<code>console.anthropic.com</code>); fill the optional fields for any
          OpenAI-compatible engine:
        </p>
        <div className="mt-3 space-y-2">
          <input
            type="password"
            className="w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 p-2.5 text-sm"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="API key (sk-ant-…, nvapi-…, gsk_…)"
            aria-label="Engine API key"
            autoComplete="off"
          />
          <input
            className="w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 p-2.5 text-sm"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="Base URL (optional) — e.g. https://integrate.api.nvidia.com/v1"
            aria-label="Engine base URL"
          />
          <input
            className="w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 p-2.5 text-sm"
            value={modelDraft}
            onChange={(e) => setModelDraft(e.target.value)}
            placeholder="Model (optional) — e.g. meta/llama-3.3-70b-instruct"
            aria-label="Engine model"
          />
          <PrimaryButton onClick={() => void saveKey()} disabled={savingKey || !keyDraft.trim()}>
            {savingKey ? 'Arming…' : 'Arm engine'}
          </PrimaryButton>
        </div>
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          Anthropic = best fidelity to the doctrine prompt. NVIDIA free tier logs what you send —
          demo use only, never real group material. Ollama/DGX works once the server can reach it
          (base URL <code>http://…:11434/v1</code>, any key).
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'h-[70vh]'}`}>
      {!compact && (
        <div className="mb-2 text-xs text-stone-500 dark:text-stone-400">
          Engine: <code>{model}</code> · the prompt is the facilitator's own compiled doctrine ·
          nothing from Mímir reaches the group without human approval.
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-stone-400">
            ◆ Ask about the HOW, not the WHAT: "which voice is missing from Thursday's agenda?",
            "give me a fan of formats to open the kitchen conflict".
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            {m.role === 'assistant' && <span className={mimirChip}>◆ Mímir · proposal</span>}
            <div
              className={`mt-1 inline-block max-w-[85%] whitespace-pre-wrap rounded-xl p-3 text-left text-sm ${
                m.role === 'user'
                  ? 'bg-stone-200 dark:bg-stone-800'
                  : 'border border-indigo-200 dark:border-indigo-900'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-stone-400">◆ thinking…</p>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 p-3 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder="Talk to Mímir…"
          aria-label="Message for Mímir"
        />
        <PrimaryButton onClick={() => void send()} disabled={busy || !draft.trim()}>
          Send
        </PrimaryButton>
      </div>
    </div>
  );
}

/** Floating Mímir presence on every event page (facilitator's decision:
 *  Mímir is the system's main chat). Small, dismiss-by-toggle, and it never
 *  covers content while closed. Admins get the engine chat; everyone else a
 *  compass to the tools — Mímir advises the organisation, not the room. */
export function MimirFab({ slug, role }: { slug: string; role: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Mímir"
        className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-indigo-400/50 bg-indigo-600 text-lg text-white shadow-lg hover:bg-indigo-500"
      >
        ◆
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Mímir panel"
          className="fixed bottom-20 right-4 z-40 flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-2xl border border-indigo-300 dark:border-indigo-800 bg-stone-50 dark:bg-stone-950 p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="font-semibold">
              <span className="text-indigo-600 dark:text-indigo-400">◆</span> Mímir
            </span>
            <span className={mimirChip}>advises · never decides</span>
            <Link
              to={`/e/${slug}/mimir`}
              className="ml-auto text-xs text-stone-500 dark:text-stone-400 underline"
            >
              open tab
            </Link>
          </div>
          {role === 'admin' ? (
            <div className="min-h-0 flex-1">
              <MimirChat slug={slug} compact />
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-stone-600 dark:text-stone-300">
                Mímir helps design sessions and processes. The chat serves the organisers; these
                are yours:
              </p>
              <Link to={`/e/${slug}/mimir`} className="block underline">
                🎤 Design your session (guided interview)
              </Link>
              <Link to={`/e/${slug}/mimir`} className="block underline">
                🎲 Dynamics catalog
              </Link>
              <Link to={`/e/${slug}/proposals`} className="block underline">
                ◇ Decisions board
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
