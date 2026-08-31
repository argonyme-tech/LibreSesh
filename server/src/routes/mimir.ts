import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { requireRole } from '../auth.js';
import { audit } from '../audit.js';
import type { Ctx } from '../context.js';
import { limit } from '../ratelimit.js';
import {
  parse,
  mimirCatalogSchema,
  mimirChatSchema,
  mimirKeySchema,
  mimirPromptSchema,
} from '../validation.js';

/**
 * Mímir add-on (design/mimir-en-libresesh.md): the facilitation co-pilot.
 *
 * Three surfaces, all additive:
 * - The dynamics CATALOG: content lives in the deployment's private data dir
 *   (`catalog.json` beside the database), never in the repo — purchased
 *   material may enter a private catalog in full, but committing it would
 *   redistribute it. Schema: design/catalog.schema.json.
 * - The facilitator PROMPT: `mimir-prompt.md` beside the database. It is the
 *   facilitator's own compiled doctrine; the server ships none.
 * - CHAT: organiser-only, proxied to the Claude API. The key stays in the
 *   server env (MIMIR_API_KEY) and never reaches a browser. Without a key the
 *   route answers 503 and the UI explains how to arm the engine.
 */
export function mimirRoutes(ctx: Ctx): Router {
  const router = Router({ mergeParams: true });
  const dataDir =
    ctx.config.databasePath === ':memory:' ? null : dirname(ctx.config.databasePath);
  const catalogPath = dataDir ? join(dataDir, 'catalog.json') : null;
  const promptPath = dataDir ? join(dataDir, 'mimir-prompt.md') : null;
  // Engine config: env wins; otherwise a file the organiser writes via the
  // admin UI. Same trust boundary as the database it sits next to. With a
  // `url` the engine speaks OpenAI-compatible /chat/completions (NVIDIA,
  // Groq, Ollama…); without one it uses the Anthropic SDK.
  interface Engine {
    key: string;
    url?: string;
    model?: string;
  }
  const enginePath = dataDir ? join(dataDir, 'mimir-engine.json') : null;
  const loadEngine = (): Engine | null => {
    if (process.env.MIMIR_API_KEY) {
      return {
        key: process.env.MIMIR_API_KEY,
        url: process.env.MIMIR_ENGINE_URL,
        model: process.env.MIMIR_MODEL,
      };
    }
    if (enginePath && existsSync(enginePath)) {
      try {
        const cfg = JSON.parse(readFileSync(enginePath, 'utf8')) as Engine;
        return cfg.key ? cfg : null;
      } catch {
        return null;
      }
    }
    return null;
  };
  // Shipped default (CC BY-NC-SA, public upstream). dist/routes/ -> server/.
  const defaultPromptPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'mimir-prompt.default.md',
  );
  const loadPrompt = (): string | null => {
    if (promptPath && existsSync(promptPath)) return readFileSync(promptPath, 'utf8');
    if (existsSync(defaultPromptPath)) return readFileSync(defaultPromptPath, 'utf8');
    return null;
  };

  const EMPTY = { version: 1, dynamics: [] as unknown[] };

  router.get('/mimir/catalog', requireRole(ctx.db, 'user'), (_req, res) => {
    if (!catalogPath || !existsSync(catalogPath)) {
      res.json(EMPTY);
      return;
    }
    // Stored by the PUT below (validated), so parse failures mean disk-level
    // tampering — surface the empty catalog rather than a 500.
    try {
      res.json(JSON.parse(readFileSync(catalogPath, 'utf8')));
    } catch {
      res.json(EMPTY);
    }
  });

  router.put(
    '/mimir/catalog',
    requireRole(ctx.db, 'admin'),
    limit(ctx.limiter, 'write'),
    (req, res) => {
      const body = parse(mimirCatalogSchema, req.body);
      if (!catalogPath) {
        res.status(503).json({ error: { message: 'No data directory on this deployment' } });
        return;
      }
      writeFileSync(catalogPath, JSON.stringify(body, null, 2), 'utf8');
      audit(ctx.db, {
        identityId: req.identity.id,
        eventId: req.event.id,
        action: 'update',
        entity: 'mimir_catalog',
        entityId: 0,
      });
      res.json({ ok: true, dynamics: body.dynamics.length });
    },
  );

  router.put(
    '/mimir/prompt',
    requireRole(ctx.db, 'admin'),
    limit(ctx.limiter, 'write'),
    (req, res) => {
      const body = parse(mimirPromptSchema, req.body);
      if (!promptPath) {
        res.status(503).json({ error: { message: 'No data directory on this deployment' } });
        return;
      }
      writeFileSync(promptPath, body.prompt, 'utf8');
      audit(ctx.db, {
        identityId: req.identity.id,
        eventId: req.event.id,
        action: 'update',
        entity: 'mimir_prompt',
        entityId: 0,
      });
      res.json({ ok: true, bytes: Buffer.byteLength(body.prompt) });
    },
  );

  /** The engine status the UI needs before offering the chat. */
  router.get('/mimir/status', requireRole(ctx.db, 'admin'), (_req, res) => {
    const cfg = loadEngine();
    res.json({
      engine: cfg !== null,
      prompt: loadPrompt() !== null,
      model: cfg?.model ?? (cfg?.url ? '(unset)' : 'claude-opus-5'),
      provider: cfg?.url ? 'openai-compatible' : 'anthropic',
    });
  });

  /** The organiser pastes the engine credentials here; stored beside the
   *  database, never echoed back. `url` switches to an OpenAI-compatible
   *  provider (NVIDIA, Groq, Ollama…); without it, the Anthropic API. */
  router.put(
    '/mimir/key',
    requireRole(ctx.db, 'admin'),
    limit(ctx.limiter, 'write'),
    (req, res) => {
      const body = parse(mimirKeySchema, req.body);
      if (!enginePath) {
        res.status(503).json({ error: { message: 'No data directory on this deployment' } });
        return;
      }
      writeFileSync(
        enginePath,
        JSON.stringify({ key: body.key.trim(), url: body.url, model: body.model }),
        { encoding: 'utf8', mode: 0o600 },
      );
      audit(ctx.db, {
        identityId: req.identity.id,
        eventId: req.event.id,
        action: 'update',
        entity: 'mimir_key',
        entityId: 0,
      });
      res.json({ ok: true, engine: loadEngine() !== null });
    },
  );

  router.post(
    '/mimir/chat',
    requireRole(ctx.db, 'admin'),
    limit(ctx.limiter, 'write'),
    async (req, res, next) => {
      try {
        const body = parse(mimirChatSchema, req.body);
        const cfg = loadEngine();
        if (!cfg) {
          res.status(503).json({
            error: {
              message: 'Mímir engine is not armed: paste a key in the chat panel, or set MIMIR_API_KEY.',
              code: 'no_engine',
            },
          });
          return;
        }
        const systemText =
          loadPrompt() ??
          'Eres Mímir, asistente de procesos de un facilitador humano. Señalas y devuelves; nunca decides.';

        if (cfg.url) {
          // OpenAI-compatible provider (NVIDIA, Groq, Ollama…).
          const r = await fetch(`${cfg.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cfg.key}`,
            },
            body: JSON.stringify({
              model: cfg.model ?? 'meta/llama-3.3-70b-instruct',
              max_tokens: 4000,
              messages: [{ role: 'system', content: systemText }, ...body.messages],
            }),
          });
          if (!r.ok) {
            const detail = (await r.text()).slice(0, 300);
            res
              .status(r.status === 429 ? 429 : 502)
              .json({ error: { message: `Engine (${r.status}): ${detail}`, code: 'engine_error' } });
            return;
          }
          const data = (await r.json()) as {
            choices?: { message?: { content?: string } }[];
            model?: string;
          };
          res.json({
            reply: data.choices?.[0]?.message?.content ?? '',
            model: data.model ?? cfg.model ?? '',
          });
          return;
        }

        const client = new Anthropic({ apiKey: cfg.key });
        const response = await client.messages.create({
          model: cfg.model ?? 'claude-opus-5',
          max_tokens: 8000,
          // The doctrine prompt is large and stable — cache it as prefix.
          system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
          messages: body.messages,
        });
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        res.json({ reply, model: response.model, stopReason: response.stop_reason });
      } catch (err) {
        if (err instanceof Anthropic.APIError) {
          res
            .status(err.status === 429 ? 429 : 502)
            .json({ error: { message: `Claude API: ${err.message}`, code: 'engine_error' } });
          return;
        }
        next(err);
      }
    },
  );

  return router;
}
