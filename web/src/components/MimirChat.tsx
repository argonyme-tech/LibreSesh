import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { popoverPanelClass, usePopover } from './Popover';
import { PrimaryButton, Spinner, useToast } from './ui';

/** Mímir add-on: the chat, extracted so it can live both in the Mímir tab and
 *  in the floating panel available across the app ("the system's main chat",
 *  per the facilitator's decision 2026-09-01). Indigo = Mímir speaking. */

export const mimirChip =
  'inline-flex items-center gap-1 rounded-full border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300';

export function MimirChat({
  slug,
  compact = false,
  seed,
  openConfig = false,
}: {
  slug: string;
  compact?: boolean;
  /** Optional kickoff instruction, auto-sent once when the engine is armed —
   *  used to start a live interview. Shown as a normal message: transparent. */
  seed?: string;
  /** Land straight on the engine form — the "Engine" tool in the Mímir tab. */
  openConfig?: boolean;
}) {
  const [engine, setEngine] = useState<boolean | null>(null);
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState<'anthropic' | 'nvidia' | 'groq' | 'custom'>('anthropic');
  const [keyDraft, setKeyDraft] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; content: string; hidden?: boolean }[]
  >([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(openConfig);
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
        provider,
        ...(provider === 'custom' && urlDraft.trim() ? { url: urlDraft.trim() } : {}),
        ...(provider === 'custom' && modelDraft.trim() ? { model: modelDraft.trim() } : {}),
      });
      setKeyDraft('');
      setShowConfig(false);
      setChatError(null);
      await refresh();
      toast.show('Engine armed — the key lives on the server only');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setSavingKey(false);
    }
  }, [keyDraft, provider, urlDraft, modelDraft, refresh, slug, toast]);

  const sendText = useCallback(
    async (content: string, opts?: { hidden?: boolean }) => {
      const next = [...messages, { role: 'user' as const, content, hidden: opts?.hidden }];
      setMessages(next);
      setChatError(null);
      setBusy(true);
      try {
        const res = await api.mimirChat(
          slug,
          next.map(({ role, content: c }) => ({ role, content: c })),
        );
        setMessages([...next, { role: 'assistant', content: res.reply }]);
      } catch (err) {
        // Keep the thread — an error is information, not an eraser.
        setChatError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [messages, slug],
  );

  const seededRef = useRef(false);
  useEffect(() => {
    if (engine && seed && messages.length === 0 && !seededRef.current) {
      seededRef.current = true;
      void sendText(seed, { hidden: true });
    }
  }, [engine, seed, messages.length, sendText]);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || busy) return;
    setDraft('');
    await sendText(content);
  }, [busy, draft, sendText]);

  if (engine === null) return <Spinner label="Checking engine…" />;

  if (!engine || showConfig) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-stone-900 p-5 text-sm">
        <span className={mimirChip}>◆ engine off</span>
        <p className="mt-3">
          Pick the provider, paste its API key. Stored on the server only, never shown again.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ['anthropic', 'Anthropic', 'sk-ant-…'],
              ['nvidia', 'NVIDIA', 'nvapi-…'],
              ['groq', 'Groq', 'gsk_…'],
              ['custom', 'Other', 'any URL'],
            ] as const
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              onClick={() => setProvider(id)}
              aria-pressed={provider === id}
              className={`rounded-xl border p-2.5 text-left ${
                provider === id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                  : 'border-stone-300 dark:border-stone-700'
              }`}
            >
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-[11px] text-stone-500 dark:text-stone-400">{hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <input
            type="password"
            className="w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 p-2.5 text-sm"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder={
              provider === 'anthropic'
                ? 'sk-ant-…'
                : provider === 'nvidia'
                  ? 'nvapi-…'
                  : provider === 'groq'
                    ? 'gsk_…'
                    : 'API key'
            }
            aria-label="Engine API key"
            autoComplete="off"
          />
          {provider === 'custom' && (
            <>
              <input
                className="w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 p-2.5 text-sm"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="Base URL — e.g. http://your-dgx:11434/v1"
                aria-label="Engine base URL"
              />
              <input
                className="w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 p-2.5 text-sm"
                value={modelDraft}
                onChange={(e) => setModelDraft(e.target.value)}
                placeholder="Model name"
                aria-label="Engine model"
              />
            </>
          )}
          <PrimaryButton onClick={() => void saveKey()} disabled={savingKey || !keyDraft.trim()}>
            {savingKey ? 'Arming…' : 'Arm engine'}
          </PrimaryButton>
        </div>
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          {provider === 'anthropic' &&
            'Best fidelity to the doctrine prompt. Key from console.anthropic.com/settings/keys.'}
          {provider === 'nvidia' &&
            'Free tier — it logs what you send, so demo material only. Key from build.nvidia.com/settings/api-keys; endpoint and model are filled in for you.'}
          {provider === 'groq' && 'Fast and free-tier friendly; endpoint and model filled in for you.'}
          {provider === 'custom' && 'Any OpenAI-compatible endpoint — Ollama, a DGX, vLLM…'}
        </p>
        {showConfig && (
          <button
            type="button"
            onClick={() => setShowConfig(false)}
            className="mt-3 text-xs underline text-stone-500 dark:text-stone-400"
          >
            ← back to chat without changing anything
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'h-[32rem] max-h-[80dvh]'}`}>
      <div className="mb-2 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
        {!compact && (
          <span>
            Engine: <code>{model}</code> · the prompt is the facilitator's own compiled doctrine.
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowConfig(true)}
          className="ml-auto underline hover:text-indigo-500"
        >
          ⚙ Engine settings
        </button>
      </div>{' '}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-stone-400">
            ◆ Ask about the HOW, not the WHAT: "which voice is missing from Thursday's agenda?",
            "give me a fan of formats to open the kitchen conflict".
          </p>
        )}
        {messages.filter((m) => !m.hidden).map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            {m.role === 'assistant' && (
              <span className="flex items-center gap-2">
                <span className={mimirChip}>◆ Mímir · proposal</span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(m.content)
                      .then(() => toast.show('Copied'))
                      .catch(() => toast.show('Could not copy — select the text instead'));
                  }}
                  className="text-[11px] text-stone-400 underline hover:text-indigo-500"
                >
                  copy
                </button>
              </span>
            )}
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
        {chatError && (
          <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
            <b>The engine did not answer:</b> {chatError}
            <div className="mt-1 text-red-600/80 dark:text-red-400/80">
              Wrong key or missing Base URL? Fix it in <b>⚙ Engine settings</b> above, then send
              again — your messages are kept.
            </div>
          </div>
        )}
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
  // Anchored through usePopover like every other panel here: fixed strategy so
  // it can never widen the page, and `size` caps it to the room actually left
  // instead of the 70vh that hid its last rows behind a phone's address bar.
  const { refs, floatingStyles, getReferenceProps, getFloatingProps } = usePopover({
    open,
    onOpenChange: setOpen,
    placement: 'top-end',
  });
  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Mímir"
        className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-indigo-400/50 bg-indigo-600 text-lg text-white shadow-lg hover:bg-indigo-500"
        {...getReferenceProps()}
      >
        ◆
      </button>
      {open && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          aria-label="Mímir panel"
          className={`${popoverPanelClass} w-96 border-indigo-300 p-4 dark:border-indigo-800`}
          {...getFloatingProps()}
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
            <div className="space-y-3 overflow-y-auto text-sm">
              <div className="rounded-lg border border-stone-200 dark:border-stone-700 p-3 text-xs text-stone-600 dark:text-stone-300">
                <b className="text-stone-800 dark:text-stone-100">How this page works</b>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  <li>The schedule is live — it updates for everyone as it changes.</li>
                  <li>⭐ stars a session onto “My agenda”.</li>
                  <li>Pitch a session in the Pitches board; popular ones get a room.</li>
                  <li>Inside a session: leave notes, questions and links — that becomes the harvest.</li>
                </ul>
              </div>
              <p className="text-stone-600 dark:text-stone-300">Mímir's tools for you:</p>
              <Link to={`/e/${slug}/mimir`} className="block underline">
                🎤 Design your session (guided interview)
              </Link>
              <Link to={`/e/${slug}/mimir`} className="block underline">
                🎬 My sessions — designs, scripting, harvest
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
