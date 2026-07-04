#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const DEFAULT_SOURCE = 'wecom-mac-bridge';

const USAGE = `
WeCom Bridge client for WechatOnCloud automation panel.

Environment:
  WOC_PANEL_URL / PANEL_URL / WECHATONCLOUD_PANEL_URL   e.g. http://nasbot.cloud:36081
  AUTOMATION_BRIDGE_TOKEN / WECOM_BRIDGE_TOKEN          bridge token from NAS compose

Commands:
  import-knowledge <file|-> [--source name] [--category faq|script|target|moment|other] [--approve-imported]
  push-events <file|-> [--source name]
  pull-replies [--limit 50]
  mark-delivered <eventId>
  run-approved --handler "command" [--limit 10] [--mark-delivered]

Examples:
  node scripts/wecom-bridge-client.mjs import-knowledge doc/examples/wecom-knowledge.sample.json
  node scripts/wecom-bridge-client.mjs push-events doc/examples/wecom-events.sample.json
  node scripts/wecom-bridge-client.mjs pull-replies --limit 20
  node scripts/wecom-bridge-client.mjs run-approved --handler "./send-to-wecom.sh" --mark-delivered
`;

class BridgeError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

function parseArgs(argv) {
  const command = argv[0] || 'help';
  const options = {};
  const positional = [];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq > 0) {
      options[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      options[key] = next;
      i += 1;
    } else {
      options[key] = true;
    }
  }
  return { command, options, positional };
}

function boolOpt(options, ...names) {
  return names.some((name) => options[name] === true || options[name] === 'true' || options[name] === '1' || options[name] === 'yes');
}

function intOpt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function config(options) {
  const panelUrl = String(
    options.url || options['panel-url'] || process.env.WOC_PANEL_URL || process.env.PANEL_URL || process.env.WECHATONCLOUD_PANEL_URL || '',
  ).replace(/\/+$/, '');
  const token = String(options.token || process.env.AUTOMATION_BRIDGE_TOKEN || process.env.WECOM_BRIDGE_TOKEN || '').trim();
  if (!panelUrl) throw new BridgeError('Missing panel URL. Set WOC_PANEL_URL or pass --url.');
  if (!token) throw new BridgeError('Missing Bridge token. Set AUTOMATION_BRIDGE_TOKEN or pass --token.');
  return { panelUrl, token };
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      text += chunk;
    });
    process.stdin.on('end', () => resolve(text));
    process.stdin.on('error', reject);
  });
}

async function readJsonInput(file) {
  const text = file && file !== '-' ? await readFile(file, 'utf8') : await readStdin();
  if (!text.trim()) throw new BridgeError('Empty JSON input.');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new BridgeError(`Invalid JSON input: ${error.message}`);
  }
}

async function requestJson(options, method, path, body) {
  const { panelUrl, token } = config(options);
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${panelUrl}${path}`, init);
  const text = await response.text();
  let payload = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }
  if (!response.ok) {
    const reason = payload?.error || payload?.message || response.statusText;
    throw new BridgeError(`${method} ${path} failed: HTTP ${response.status} ${reason}`, payload);
  }
  return payload ?? {};
}

function normalizeKnowledgePayload(input, options) {
  const source = String(options.source || input?.source || DEFAULT_SOURCE);
  const category = String(options.category || input?.category || 'other');
  const mode = String(options.mode || input?.mode || 'upsert');
  const approveImported = boolOpt(options, 'approve-imported', 'approve') || input?.approveImported === true;
  if (Array.isArray(input)) return { source, category, mode, approveImported, items: input };
  if (Array.isArray(input?.items)) return { ...input, source, category: input.category || category, mode, approveImported };
  return { source, category, mode, approveImported, items: [input] };
}

function normalizeEventPayload(input, options) {
  const source = String(options.source || input?.source || DEFAULT_SOURCE);
  if (Array.isArray(input)) return { source, events: input };
  if (Array.isArray(input?.events)) return { ...input, source };
  return { source, events: [input] };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function runHandler(command, reply) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: {
        ...process.env,
        WECOM_BRIDGE_REPLY_ID: reply.id || '',
        WECOM_BRIDGE_CONVERSATION_NAME: reply.conversationName || '',
        WECOM_BRIDGE_SENDER_NAME: reply.senderName || '',
        WECOM_BRIDGE_REPLY_DRAFT: reply.replyDraft || '',
      },
    });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal }));
    child.stdin.end(`${JSON.stringify(reply)}\n`);
  });
}

async function main() {
  const { command, options, positional } = parseArgs(process.argv.slice(2));
  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(USAGE.trimStart());
    return;
  }

  if (command === 'import-knowledge') {
    const input = await readJsonInput(positional[0] || options.file || '-');
    const payload = normalizeKnowledgePayload(input, options);
    printJson(await requestJson(options, 'POST', '/api/automation/bridge/wecom/import', payload));
    return;
  }

  if (command === 'push-events') {
    const input = await readJsonInput(positional[0] || options.file || '-');
    const payload = normalizeEventPayload(input, options);
    printJson(await requestJson(options, 'POST', '/api/automation/bridge/wecom/events', payload));
    return;
  }

  if (command === 'pull-replies') {
    const limit = intOpt(options.limit, 50, 1, 200);
    printJson(await requestJson(options, 'GET', `/api/automation/bridge/wecom/replies?limit=${limit}`));
    return;
  }

  if (command === 'mark-delivered') {
    const eventId = positional[0] || options.id || options['event-id'];
    if (!eventId) throw new BridgeError('Missing eventId for mark-delivered.');
    printJson(await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(eventId)}`, {}));
    return;
  }

  if (command === 'run-approved') {
    const handler = options.handler;
    const limit = intOpt(options.limit, 10, 1, 50);
    const markDelivered = boolOpt(options, 'mark-delivered', 'ack', 'ack-delivered');
    const dryRun = boolOpt(options, 'dry-run');
    if (!handler && !dryRun) throw new BridgeError('run-approved requires --handler or --dry-run.');
    const { replies = [] } = await requestJson(options, 'GET', `/api/automation/bridge/wecom/replies?limit=${limit}`);
    const handled = [];
    for (const reply of replies) {
      if (dryRun) {
        handled.push({ id: reply.id, conversationName: reply.conversationName, dryRun: true });
        continue;
      }
      const result = await runHandler(handler, reply);
      const ok = result.code === 0;
      const item = { id: reply.id, conversationName: reply.conversationName, ok, exitCode: result.code, signal: result.signal };
      if (ok && markDelivered) {
        item.delivered = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(reply.id)}`, {});
      }
      handled.push(item);
    }
    printJson({ handled, total: replies.length, markedDelivered: markDelivered });
    return;
  }

  throw new BridgeError(`Unknown command: ${command}\n\n${USAGE.trim()}`);
}

main().catch((error) => {
  const message = error instanceof BridgeError ? error.message : error?.stack || String(error);
  process.stderr.write(`${message}\n`);
  if (error?.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
  process.exit(1);
});
