import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { BundleDto } from '@shared/types';
import { ApiError, api } from '../lib/api';
import { rhythmWarnings } from '../components/RhythmCheck';
import { EmptyState, PrimaryButton, SecondaryButton, Spinner, useToast } from '../components/ui';

/**
 * Mímir add-on: the co-facilitator's own tab (design/mimir-en-libresesh.md).
 * Everything indigo on this page is Mímir speaking; everything the human
 * decides stays unbadged. Mímir proposes — the human decides.
 */

type Status = 'loading' | 'gate' | 'error' | 'ready';
type Tool = 'hub' | 'interview' | 'catalog' | 'rhythm' | 'chat' | 'infographic';

const mimirChip =
  'inline-flex items-center gap-1 rounded-full border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300';

export function MimirPage() {
  const { slug = '' } = useParams();
  const [bundle, setBundle] = useState<BundleDto | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('hub');

  useEffect(() => {
    void (async () => {
      try {
        setBundle(await api.bundle(slug));
        setStatus('ready');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setStatus('gate');
        else {
          setError((err as Error).message);
          setStatus('error');
        }
      }
    })();
  }, [slug]);

  if (status === 'loading') return <Spinner label="Loading Mímir…" />;
  if (status === 'gate' || status === 'error' || !bundle) {
    return (
      <EmptyState>
        {status === 'gate' ? 'You need this event’s password.' : (error ?? 'Could not load.')}
        <div className="mt-3">
          <Link to={`/e/${slug}`} className="underline">
            Go to the schedule
          </Link>
        </div>
      </EmptyState>
    );
  }

  const role = bundle.role;
  const isAdmin = role === 'admin';
  const canUse = role !== 'viewer';

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <header className="border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-4">
          <Link to={`/e/${slug}`} className="text-xs text-stone-500 dark:text-stone-400 underline">
            ← Schedule
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-indigo-600 dark:text-indigo-400">◆</span> Mímir
          </h1>
          <span className={mimirChip}>consejero · no decide</span>
          {tool !== 'hub' && (
            <button
              type="button"
              onClick={() => setTool('hub')}
              className="ml-auto text-xs text-stone-500 dark:text-stone-400 underline"
            >
              ← tools
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {tool === 'hub' && (
          <Hub bundle={bundle} canUse={canUse} isAdmin={isAdmin} onOpen={setTool} slug={slug} />
        )}
        {tool === 'interview' && <Interview slug={slug} onDone={() => setTool('hub')} />}
        {tool === 'catalog' && <Catalog slug={slug} />}
        {tool === 'rhythm' && <Rhythm bundle={bundle} />}
        {tool === 'infographic' && <Infographic bundle={bundle} />}
        {tool === 'chat' && isAdmin && <Chat slug={slug} />}
      </main>
    </div>
  );
}

/* ---------------- hub ---------------- */

function Hub({
  bundle,
  canUse,
  isAdmin,
  onOpen,
  slug,
}: {
  bundle: BundleDto;
  canUse: boolean;
  isAdmin: boolean;
  onOpen: (t: Tool) => void;
  slug: string;
}) {
  const warnings = rhythmWarnings(bundle.sessions, bundle.rooms);
  const tile =
    'rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 text-left hover:border-indigo-400 dark:hover:border-indigo-600';
  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Herramientas de oficio para diseñar sesiones y procesos. Mímir propone y señala;{' '}
        <b>decidir es siempre humano.</b>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {canUse && (
          <button type="button" className={tile} onClick={() => onOpen('interview')}>
            <div className="text-2xl">🎤</div>
            <div className="mt-1 text-sm font-semibold">Diseña tu sesión</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              Entrevista guiada → borrador en Pitches
            </div>
          </button>
        )}
        {canUse && (
          <button type="button" className={tile} onClick={() => onOpen('catalog')}>
            <div className="text-2xl">🎲</div>
            <div className="mt-1 text-sm font-semibold">Catálogo de dinámicas</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              El repertorio del facilitador
            </div>
          </button>
        )}
        <Link to={`/e/${slug}/proposals`} className={tile}>
          <div className="text-2xl">◇</div>
          <div className="mt-1 text-sm font-semibold">Decisiones</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">
            Pitches por fases: inquietud → decisión
          </div>
        </Link>
        <button type="button" className={tile} onClick={() => onOpen('rhythm')}>
          <div className="text-2xl">⏱</div>
          <div className="mt-1 text-sm font-semibold">Ritmo</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {warnings.length === 0 ? 'Agenda sana ahora mismo' : `${warnings.length} aviso(s)`}
          </div>
        </button>
        <button type="button" className={tile} onClick={() => onOpen('infographic')}>
          <div className="text-2xl">🗺</div>
          <div className="mt-1 text-sm font-semibold">Semana visual</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">El proceso de un vistazo</div>
        </button>
        {isAdmin && (
          <button type="button" className={tile} onClick={() => onOpen('chat')}>
            <div className="text-2xl text-indigo-600 dark:text-indigo-400">◆</div>
            <div className="mt-1 text-sm font-semibold">Chat con Mímir</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              Solo organización · el motor del oficio
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- interview (deterministic v1 — no engine needed) ---------------- */

const FORMATS = [
  {
    name: 'Ronda + tarjetas escritas',
    how: 'Colecta en silencio, luego una voz por persona.',
    discard: '<6 personas — sobra estructura.',
  },
  {
    name: 'Grupos de 3 → plenario',
    how: 'Lo tímido habla en pequeño; el plenario solo cosecha.',
    discard: 'sin tiempo para doble vuelta.',
  },
  {
    name: 'Colecta previa + priorización',
    how: 'Aportes antes de la sesión; en sala solo se prioriza.',
    discard: 'el grupo no usa el tablón antes.',
  },
];

function Interview({ slug, onDone }: { slug: string; onDone: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState('');
  const [purpose, setPurpose] = useState('');
  const [format, setFormat] = useState<string | null>(null);
  const [minutes, setMinutes] = useState('45');
  const [saving, setSaving] = useState(false);

  const bubble = (text: string, why?: string) => (
    <div className="mb-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-stone-900 p-4">
      <span className={mimirChip}>◆ Mímir · propuesta</span>
      <p className="mt-2 text-sm">{text}</p>
      {why && <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{why}</p>}
    </div>
  );

  const create = async () => {
    setSaving(true);
    try {
      await api.createProposal(slug, {
        title: purpose.slice(0, 120) || summary.slice(0, 120) || 'Sesión sin título',
        description: [
          summary && `**Resumen:** ${summary}`,
          format && `**Formato elegido:** ${format}`,
          `**Duración:** ${minutes} min (corte real a los 90).`,
          '',
          '_Borrador creado con la entrevista de Mímir — publicarlo y colocarlo es decisión humana._',
        ]
          .filter(Boolean)
          .join('\n'),
        phase: 'proposal',
      });
      toast.show('Borrador creado en Pitches — Mímir propone, tú publicas');
      onDone();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 p-3 text-sm';

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex gap-1 text-[11px]">
        {['Resumen', 'Propósito', 'Formato', 'Tiempo'].map((s, i) => (
          <div
            key={s}
            className={`flex-1 border-t-2 pt-1 text-center ${
              i === step
                ? 'border-indigo-500 font-semibold text-indigo-600 dark:text-indigo-400'
                : i < step
                  ? 'border-green-500 text-stone-500'
                  : 'border-stone-300 dark:border-stone-700 text-stone-400'
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          {bubble(
            'Cuéntame en resumen qué quieres hacer en tu sesión. Con tus palabras, sin formato.',
            'Lo ya sabido no se re-pregunta: de tu resumen saco lo que ya está.',
          )}
          <textarea
            className={`${input} min-h-24`}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Ej.: quiero juntar a la gente del comedor y salir con necesidades priorizadas…"
          />
          <PrimaryButton className="mt-3" onClick={() => setStep(1)} disabled={!summary.trim()}>
            Continuar →
          </PrimaryButton>
        </>
      )}

      {step === 1 && (
        <>
          {bubble(
            '¿Qué tiene que pasar en tu sesión, en una frase — y sin nombrar técnica todavía?',
            'Si no puedes definir el propósito, la doctrina sugiere no reservar sala aún.',
          )}
          <input
            className={input}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Ej.: pasar de quejas sueltas a tres necesidades priorizadas"
          />
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={() => setStep(0)}>← Volver</SecondaryButton>
            <PrimaryButton onClick={() => setStep(2)} disabled={!purpose.trim()}>
              Continuar →
            </PrimaryButton>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {bubble(
            'Abanico de formatos que no premian la facilidad de palabra — eliges tú, cada uno con su condición de descarte:',
          )}
          <div className="space-y-2">
            {FORMATS.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setFormat(f.name)}
                className={`block w-full rounded-xl border p-3 text-left text-sm ${
                  format === f.name
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900'
                }`}
              >
                <b>{f.name}</b>
                <div className="text-xs text-stone-500 dark:text-stone-400">{f.how}</div>
                <div className="mt-1 text-xs text-indigo-700 dark:text-indigo-400">
                  Descarta si: {f.discard}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={() => setStep(1)}>← Volver</SecondaryButton>
            <PrimaryButton onClick={() => setStep(3)} disabled={!format}>
              Continuar →
            </PrimaryButton>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {bubble(
            'Último paso: el tiempo. La atención aguanta ~90 minutos con corte real — elige la duración.',
          )}
          <select className={input} value={minutes} onChange={(e) => setMinutes(e.target.value)}>
            {['30', '45', '60', '90'].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={() => setStep(2)}>← Volver</SecondaryButton>
            <PrimaryButton onClick={() => void create()} disabled={saving}>
              {saving ? 'Creando…' : 'Crear borrador en Pitches ✓'}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- catalog ---------------- */

function Catalog({ slug }: { slug: string }) {
  const [dynamics, setDynamics] = useState<Record<string, unknown>[] | null>(null);
  const [filter, setFilter] = useState('Todas');

  useEffect(() => {
    void api.mimirCatalog(slug).then((c) => setDynamics(c.dynamics)).catch(() => setDynamics([]));
  }, [slug]);

  const categories = useMemo(
    () => [
      'Todas',
      ...Array.from(new Set((dynamics ?? []).map((d) => String(d.category ?? '')))).filter(Boolean),
    ],
    [dynamics],
  );

  if (dynamics === null) return <Spinner label="Loading catalog…" />;

  if (dynamics.length === 0) {
    return (
      <EmptyState>
        <div className="text-3xl opacity-60">🏮</div>
        <b>El catálogo se llena con las dinámicas que vuelca el facilitador.</b>
        <p className="mx-auto mt-2 max-w-sm text-sm">
          Mímir no lo rellena con dinámicas genéricas: si no está en el corpus, no está aquí.
        </p>
      </EmptyState>
    );
  }

  const shown = dynamics.filter((d) => filter === 'Todas' || String(d.category) === filter);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              filter === c
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 font-semibold text-indigo-700 dark:text-indigo-300'
                : 'border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((d, i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <b className="text-sm">{String(d.name)}</b>
              {Boolean(d.safety) && d.safety !== 'segura' && (
                <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                  ⚠ {String(d.safety)}
                </span>
              )}
              {Boolean(d.dominio) && (
                <span className={mimirChip}>{String(d.dominio)}</span>
              )}
            </div>
            {Boolean(d.purpose) && (
              <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
                {String(d.purpose)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
              {Boolean(d.category) && <span>{String(d.category)}</span>}
              {Boolean(d.people) && <span>· 👥 {String(d.people)}</span>}
              {Boolean(d.minutes) && <span>· ⏱ {String(d.minutes)}</span>}
              {Boolean(d.difficulty) && <span>· {String(d.difficulty)}</span>}
            </div>
            {Boolean(d.discardIf) && (
              <p className="mt-2 border-t border-dashed border-stone-300 dark:border-stone-700 pt-2 text-xs text-indigo-700 dark:text-indigo-400">
                Descarta si: {String(d.discardIf)}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
        La elección de dinámica es siempre humana — Mímir solo asegura que el abanico esté delante.
      </p>
    </div>
  );
}

/* ---------------- rhythm ---------------- */

function Rhythm({ bundle }: { bundle: BundleDto }) {
  const warnings = rhythmWarnings(bundle.sessions, bundle.rooms);
  if (warnings.length === 0) {
    return (
      <EmptyState>
        ⏱ Nada que señalar: ningún bloque supera los ~90 min sin pausa real.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      {warnings.map((w) => (
        <div
          key={w.key}
          className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-stone-900 p-4 text-sm"
        >
          <b>{w.what}.</b> {w.why}{' '}
          <span className="text-xs text-indigo-700 dark:text-indigo-400">{w.rule}</span>
        </div>
      ))}
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Avisa, nunca bloquea — reordena, o ignora.
      </p>
    </div>
  );
}

/* ---------------- infographic: the week at a glance ---------------- */

function Infographic({ bundle }: { bundle: BundleDto }) {
  const days = useMemo(() => {
    const byDay = new Map<string, { count: number; minutes: number }>();
    for (const s of bundle.sessions) {
      const day = s.startsAt.slice(0, 10);
      const cur = byDay.get(day) ?? { count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += Math.round((Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 60000);
      byDay.set(day, cur);
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [bundle.sessions]);
  const phases = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of bundle.proposals) c[p.phase] = (c[p.phase] ?? 0) + 1;
    return c;
  }, [bundle.proposals]);
  const max = Math.max(1, ...days.map(([, d]) => d.minutes));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold">Carga por día</h2>
        <div className="space-y-2">
          {days.length === 0 && (
            <p className="text-sm text-stone-500 dark:text-stone-400">Sin sesiones aún.</p>
          )}
          {days.map(([day, d]) => (
            <div key={day} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0 text-stone-500 dark:text-stone-400">{day.slice(5)}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-stone-200 dark:bg-stone-800">
                <div
                  className="h-full rounded bg-indigo-400/70"
                  style={{ width: `${(d.minutes / max) * 100}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-stone-500 dark:text-stone-400">
                {d.count} ses · {Math.round(d.minutes / 60)}h{d.minutes % 60 ? ` ${d.minutes % 60}m` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">Decisiones en curso (pitches por fase)</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              ['concern', '💭 Inquietud'],
              ['inquiry', '🔍 Indagación'],
              ['proposal', '📋 Propuesta'],
              ['decision', '◇ Decisión'],
            ] as const
          ).map(([k, label]) => (
            <span
              key={k}
              className="rounded-full border border-stone-300 dark:border-stone-700 px-3 py-1"
            >
              {label}: <b>{phases[k] ?? 0}</b>
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Una elección nunca se dibuja como paso de agenda: aquí se ve el momento en que está, no
          un resultado dado por hecho.
        </p>
      </div>
    </div>
  );
}

/* ---------------- chat (admin, needs engine) ---------------- */

function Chat({ slug }: { slug: string }) {
  const [engine, setEngine] = useState<boolean | null>(null);
  const [model, setModel] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    void api
      .mimirStatus(slug)
      .then((s) => {
        setEngine(s.engine);
        setModel(s.model);
      })
      .catch(() => setEngine(false));
  }, [slug]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

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
        <span className={mimirChip}>◆ motor apagado</span>
        <p className="mt-3">
          El chat de Mímir necesita una clave de la API de Claude en el servidor. Para armarlo:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-600 dark:text-stone-300">
          <li>
            Crea una clave en <code>console.anthropic.com</code> → API keys.
          </li>
          <li>
            En Easypanel, servicio <code>libresesh</code> → Environment: añade{' '}
            <code>MIMIR_API_KEY=…</code>
          </li>
          <li>Reinicia el servicio. Esta pantalla se convierte en el chat.</li>
        </ol>
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          La clave vive solo en el servidor — nunca llega al navegador. El prompt doctrinal se
          carga aparte (PUT /mimir/prompt) y también queda en el servidor.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="mb-2 text-xs text-stone-500 dark:text-stone-400">
        Motor: <code>{model}</code> · el prompt es la doctrina volcada del facilitador · nada de
        Mímir llega al grupo sin aprobación humana.
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-stone-400">
            ◆ Pregunta de proceso, no de contenido: “¿qué voz falta en la agenda del jueves?”,
            “dame un abanico para abrir el conflicto del comedor”.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            {m.role === 'assistant' && <span className={mimirChip}>◆ Mímir · propuesta</span>}
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
        {busy && <p className="text-xs text-stone-400">◆ pensando…</p>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 p-3 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder="Habla con Mímir…"
          aria-label="Mensaje para Mímir"
        />
        <PrimaryButton onClick={() => void send()} disabled={busy || !draft.trim()}>
          Enviar
        </PrimaryButton>
      </div>
    </div>
  );
}
