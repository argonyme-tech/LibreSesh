import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { requireRole } from '../auth.js';
import { audit } from '../audit.js';
import type { Ctx } from '../context.js';
import { limit } from '../ratelimit.js';
import { parse, mimirCatalogSchema, mimirChatSchema, mimirPromptSchema } from '../validation.js';

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
    res.json({
      engine: Boolean(process.env.MIMIR_API_KEY),
      prompt: Boolean(promptPath && existsSync(promptPath)),
      model: process.env.MIMIR_MODEL ?? 'claude-opus-5',
    });
  });

  router.post(
    '/mimir/chat',
    requireRole(ctx.db, 'admin'),
    limit(ctx.limiter, 'write'),
    async (req, res, next) => {
      try {
        const body = parse(mimirChatSchema, req.body);
        const apiKey = process.env.MIMIR_API_KEY;
        if (!apiKey) {
          res.status(503).json({
            error: {
              message:
                'Mímir engine is not armed: set MIMIR_API_KEY in the server environment and restart.',
              code: 'no_engine',
            },
          });
          return;
        }
        const systemText =
          promptPath && existsSync(promptPath)
            ? readFileSync(promptPath, 'utf8')
            : 'Eres Mímir, asistente de procesos de un facilitador humano. Señalas y devuelves; nunca decides. (Prompt completo no cargado: súbelo con PUT /mimir/prompt.)';

        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
          model: process.env.MIMIR_MODEL ?? 'claude-opus-5',
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
