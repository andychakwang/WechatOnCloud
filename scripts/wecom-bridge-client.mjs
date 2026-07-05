#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { hostname } from 'node:os';

const DEFAULT_SOURCE = 'wecom-mac-bridge';
const CLIENT_VERSION = 'automation-lab-r45-audience-mass';

const USAGE = `
WeCom Bridge client for WechatOnCloud automation panel.

Environment:
  WOC_PANEL_URL / PANEL_URL / WECHATONCLOUD_PANEL_URL   e.g. http://nasbot.cloud:36081
  AUTOMATION_BRIDGE_TOKEN / WECOM_BRIDGE_TOKEN          bridge token from NAS compose

Commands:
  import-knowledge <file|-> [--source name] [--category faq|script|target|moment|other] [--approve-imported]
  import-audience <file|-> [--source name] [--type contact|group|room|unknown] [--approve-imported]
  import-materials <file|-> [--source name] [--kind image|video|file|link|text|other] [--approve-imported]
  material-map [--kind image|video|file|link|text|other|all] [--tag tag] [--source name] [--output file]
  push-events <file|-> [--source name]
  heartbeat [--source name] [--worker-id name] [--mode dry-run|prepare|send]
  runner-policy [--worker-id name]
  report-run [--target replies|mass|moments|all|doctor] [--mode dry-run|prepare|send|doctor] [--status completed|failed] [--items-json '[...]']
  pull-replies [--limit 50]
  claim-reply <eventId> [--worker-id name] [--claim-ttl-seconds 300]
  release-reply <eventId> [--worker-id name] [--reason text]
  mark-delivered <eventId> [--worker-id name]
  mark-failed <eventId> [--worker-id name] [--error text]
  run-approved --handler "command" [--limit 10] [--claim] [--mark-delivered] [--report-failure] [--report-run]
  pull-mass-tasks [--limit 50]
  claim-mass-task <taskId> [--worker-id name] [--claim-ttl-seconds 300]
  release-mass-task <taskId> [--worker-id name] [--reason text]
  mark-mass-sent <taskId> [--worker-id name]
  mark-mass-failed <taskId> [--worker-id name] [--error text]
  run-mass --handler "command" [--limit 10] [--claim] [--mark-sent] [--report-failure] [--report-run]
  pull-moment-tasks [--limit 50]
  claim-moment-task <taskId> [--worker-id name] [--claim-ttl-seconds 300]
  release-moment-task <taskId> [--worker-id name] [--reason text]
  mark-moment-prepared <taskId> [--worker-id name]
  mark-moment-published <taskId> [--worker-id name]
  mark-moment-failed <taskId> [--worker-id name] [--error text]
  run-moments --handler "command" [--limit 10] [--claim] [--mark-prepared] [--report-failure] [--report-run]

Examples:
  node scripts/wecom-bridge-client.mjs import-knowledge doc/examples/wecom-knowledge.sample.json
  node scripts/wecom-bridge-client.mjs import-audience doc/examples/wecom-audience.sample.json
  node scripts/wecom-bridge-client.mjs import-materials doc/examples/wecom-materials.sample.json
  node scripts/wecom-bridge-client.mjs material-map --kind image --output ~/.config/wechat-on-cloud/wecom-materials.json
  node scripts/wecom-bridge-client.mjs push-events doc/examples/wecom-events.sample.json
  node scripts/wecom-bridge-client.mjs heartbeat --mode prepare
  node scripts/wecom-bridge-client.mjs runner-policy --worker-id mac-mini-01
  node scripts/wecom-bridge-client.mjs report-run --target all --mode dry-run --handled-replies 2
  node scripts/wecom-bridge-client.mjs pull-replies --limit 20
  node scripts/wecom-bridge-client.mjs release-reply <eventId> --reason "window not ready"
  node scripts/wecom-bridge-client.mjs run-approved --handler "./send-to-wecom.sh" --claim --claim-ttl-seconds 300 --mark-delivered --report-failure
  node scripts/wecom-bridge-client.mjs pull-mass-tasks --limit 5
  node scripts/wecom-bridge-client.mjs run-mass --handler "./scripts/wecom-mac-mass-handler.sh" --claim --mark-sent --report-failure
  node scripts/wecom-bridge-client.mjs run-moments --handler "./scripts/wecom-mac-moment-handler.sh" --claim --mark-prepared --report-failure
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

function workerId(options) {
  return String(options['worker-id'] || options.worker || process.env.WECOM_BRIDGE_WORKER_ID || `${hostname()}-${process.pid}`).trim();
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

function normalizeAudiencePayload(input, options) {
  const source = String(options.source || input?.source || DEFAULT_SOURCE);
  const type = String(options.type || input?.type || 'unknown');
  const mode = String(options.mode || input?.mode || 'upsert');
  const approveImported = boolOpt(options, 'approve-imported', 'approve') || input?.approveImported === true;
  if (Array.isArray(input)) return { source, type, mode, approveImported, contacts: input };
  if (Array.isArray(input?.contacts)) return { ...input, source, type: input.type || type, mode, approveImported };
  if (Array.isArray(input?.audiences)) return { ...input, source, type: input.type || type, mode, approveImported };
  if (Array.isArray(input?.recipients)) return { ...input, source, type: input.type || type, mode, approveImported };
  if (Array.isArray(input?.items)) return { ...input, source, type: input.type || type, mode, approveImported };
  return { source, type, mode, approveImported, contacts: [input] };
}

function normalizeMaterialPayload(input, options) {
  const source = String(options.source || input?.source || DEFAULT_SOURCE);
  const kind = String(options.kind || options.type || input?.kind || input?.type || 'image');
  const mode = String(options.mode || input?.mode || 'upsert');
  const approveImported = boolOpt(options, 'approve-imported', 'approve') || input?.approveImported === true;
  if (Array.isArray(input)) return { source, kind, mode, approveImported, assets: input };
  if (Array.isArray(input?.assets)) return { ...input, source, kind: input.kind || input.type || kind, mode, approveImported };
  if (Array.isArray(input?.materials)) return { ...input, source, kind: input.kind || input.type || kind, mode, approveImported };
  if (Array.isArray(input?.items)) return { ...input, source, kind: input.kind || input.type || kind, mode, approveImported };
  return { source, kind, mode, approveImported, assets: [input] };
}

function normalizeEventPayload(input, options) {
  const source = String(options.source || input?.source || DEFAULT_SOURCE);
  if (Array.isArray(input)) return { source, events: input };
  if (Array.isArray(input?.events)) return { ...input, source };
  return { source, events: [input] };
}

function shouldReportRun(options) {
  return boolOpt(options, 'report-run') || ['1', 'true', 'yes'].includes(String(process.env.WECOM_REPORT_RUN || '').toLowerCase());
}

function runnerMode(options, fallback = 'manual') {
  return String(options.mode || process.env.WECOM_RUNNER_MODE || process.env.WECOM_HANDLER_MODE || fallback);
}

function runStatusFromHandled(handled) {
  return handled.some((item) => item.ok === false) ? 'failed' : 'completed';
}

function runSummary(target, handled, total) {
  const failed = handled.filter((item) => item.ok === false).length;
  return `${target} total=${total} handled=${handled.length} failed=${failed}`;
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonText(text, label) {
  const raw = String(text || '').trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new BridgeError(`Invalid JSON in ${label}: ${error.message}`);
  }
}

async function readJsonOption(value, label) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (raw.startsWith('@')) return parseJsonText(await readFile(raw.slice(1), 'utf8'), label);
  if (raw.startsWith('[') || raw.startsWith('{')) return parseJsonText(raw, label);
  return parseJsonText(await readFile(raw, 'utf8'), label);
}

function parseHandlerJsonOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (!line.startsWith('{') && !line.startsWith('[')) continue;
      try {
        return JSON.parse(line);
      } catch {
        // Keep scanning; handler logs may contain non-JSON lines.
      }
    }
  }
  return undefined;
}

function handlerVerification(result, fallbackName) {
  const data = result?.handlerResult;
  if (!isRecord(data)) return undefined;
  const nested =
    isRecord(data.verification)
      ? data.verification
      : isRecord(data.targetVerification)
        ? data.targetVerification
        : isRecord(data.visualCheck)
          ? data.visualCheck
          : undefined;
  const source = nested || data;
  const signalKeys = nested
    ? [
        'required',
        'verificationRequired',
        'verified',
        'targetVerified',
        'conversationVerified',
        'conversationMatched',
        'matched',
        'inputReady',
        'inputFocused',
        'expectedName',
        'expectedConversationName',
        'targetName',
        'matchedName',
        'matchedConversationName',
        'actualName',
        'actualConversationName',
        'activeApp',
        'appName',
        'applicationName',
        'windowTitle',
        'ocrText',
        'visibleText',
        'screenText',
        'visualSummary',
        'summary',
        'confidence',
        'matchConfidence',
        'score',
        'error',
        'reason',
        'verificationError',
        'checkedAt',
        'verifiedAt',
        'timestamp',
      ]
    : [
        'verified',
        'targetVerified',
        'conversationVerified',
        'conversationMatched',
        'matched',
        'inputReady',
        'inputFocused',
        'expectedName',
        'expectedConversationName',
        'targetName',
        'matchedName',
        'matchedConversationName',
        'actualName',
        'actualConversationName',
        'activeApp',
        'appName',
        'applicationName',
        'windowTitle',
        'ocrText',
        'visibleText',
        'screenText',
        'visualSummary',
        'confidence',
        'matchConfidence',
        'score',
        'verificationError',
        'checkedAt',
        'verifiedAt',
        'timestamp',
      ];
  if (!signalKeys.some((key) => Object.prototype.hasOwnProperty.call(source, key))) return undefined;

  const allowedKeys = new Set(signalKeys.concat(['summary', 'error', 'reason', 'required', 'verificationRequired']));
  const payload = {};
  for (const [key, value] of Object.entries(source)) {
    if (!allowedKeys.has(key)) continue;
    payload[key] = value;
  }
  if (
    fallbackName &&
    !Object.prototype.hasOwnProperty.call(payload, 'expectedName') &&
    !Object.prototype.hasOwnProperty.call(payload, 'expectedConversationName') &&
    !Object.prototype.hasOwnProperty.call(payload, 'targetName')
  ) {
    payload.expectedName = fallbackName;
  }
  return payload;
}

async function postRunReport(options, payload) {
  return await requestJson(options, 'POST', '/api/automation/bridge/wecom/run-report', {
    source: String(options.source || process.env.WECOM_BRIDGE_SOURCE || DEFAULT_SOURCE),
    workerId: workerId(options),
    mode: runnerMode(options),
    ...payload,
  });
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function materialMapPath(options) {
  const params = new URLSearchParams();
  for (const key of ['kind', 'tag', 'source']) {
    const value = String(options[key] || '').trim();
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/api/automation/bridge/wecom/material-map${query ? `?${query}` : ''}`;
}

async function runHandler(command, reply) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const child = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: {
        ...process.env,
        WECOM_BRIDGE_REPLY_ID: reply.id || '',
        WECOM_BRIDGE_CONVERSATION_NAME: reply.conversationName || '',
        WECOM_BRIDGE_SENDER_NAME: reply.senderName || '',
        WECOM_BRIDGE_REPLY_DRAFT: reply.replyDraft || '',
        WECOM_BRIDGE_REPLY_STEPS: JSON.stringify(Array.isArray(reply.replySteps) ? reply.replySteps : []),
        WECOM_BRIDGE_REPLY_STEP_COUNT: String(Array.isArray(reply.replySteps) ? reply.replySteps.length : reply.replyDraft ? 1 : 0),
        WECOM_BRIDGE_REPLY_IMAGE_STEP_COUNT: String(Array.isArray(reply.replySteps) ? reply.replySteps.filter((step) => step?.type === 'image').length : 0),
      },
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, stdout, handlerResult: parseHandlerJsonOutput(stdout) }));
    child.stdin.end(`${JSON.stringify(reply)}\n`);
  });
}

async function runMassHandler(command, task) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const child = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: {
        ...process.env,
        WECOM_BRIDGE_MASS_TASK_ID: task.id || '',
        WECOM_BRIDGE_MASS_JOB_ID: task.jobId || '',
        WECOM_BRIDGE_MASS_ITEM_ID: task.itemId || '',
        WECOM_BRIDGE_MASS_JOB_TITLE: task.jobTitle || '',
        WECOM_BRIDGE_RECIPIENT_NAME: task.recipientName || '',
        WECOM_BRIDGE_MASS_MESSAGE: task.message || '',
      },
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, stdout, handlerResult: parseHandlerJsonOutput(stdout) }));
    child.stdin.end(`${JSON.stringify(task)}\n`);
  });
}

async function runMomentHandler(command, task) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const child = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: {
        ...process.env,
        WECOM_BRIDGE_MOMENT_TASK_ID: task.id || '',
        WECOM_BRIDGE_MOMENT_DRAFT_ID: task.draftId || task.id || '',
        WECOM_BRIDGE_MOMENT_TITLE: task.title || '',
        WECOM_BRIDGE_MOMENT_TEXT: task.text || '',
        WECOM_BRIDGE_MOMENT_IMAGE_NOTES: task.imageNotes || '',
        WECOM_BRIDGE_MOMENT_MATERIALS: Array.isArray(task.materials) ? task.materials.join('\n') : '',
      },
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, stdout, handlerResult: parseHandlerJsonOutput(stdout) }));
    child.stdin.end(`${JSON.stringify(task)}\n`);
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

  if (command === 'import-audience') {
    const input = await readJsonInput(positional[0] || options.file || '-');
    const payload = normalizeAudiencePayload(input, options);
    printJson(await requestJson(options, 'POST', '/api/automation/bridge/wecom/audience', payload));
    return;
  }

  if (command === 'import-materials') {
    const input = await readJsonInput(positional[0] || options.file || '-');
    const payload = normalizeMaterialPayload(input, options);
    printJson(await requestJson(options, 'POST', '/api/automation/bridge/wecom/materials', payload));
    return;
  }

  if (command === 'material-map') {
    const result = await requestJson(options, 'GET', materialMapPath(options));
    const output = positional[0] || options.output || options.file;
    if (output && output !== '-') {
      await writeFile(output, `${JSON.stringify(result.materialMap || result, null, 2)}\n`, 'utf8');
    }
    printJson(result);
    return;
  }

  if (command === 'push-events') {
    const input = await readJsonInput(positional[0] || options.file || '-');
    const payload = normalizeEventPayload(input, options);
    printJson(await requestJson(options, 'POST', '/api/automation/bridge/wecom/events', payload));
    return;
  }

  if (command === 'heartbeat') {
    const source = String(options.source || process.env.WECOM_BRIDGE_SOURCE || DEFAULT_SOURCE);
    const mode = runnerMode(options, 'manual');
    printJson(
      await requestJson(options, 'POST', '/api/automation/bridge/wecom/heartbeat', {
        source,
        workerId: workerId(options),
        mode,
        host: hostname(),
        pid: process.pid,
        version: CLIENT_VERSION,
        note: String(options.note || ''),
      }),
    );
    return;
  }

  if (command === 'report-run') {
    const startedAt = String(options['started-at'] || options.startedAt || new Date().toISOString());
    const finishedAt = String(options['finished-at'] || options.finishedAt || new Date().toISOString());
    const items = await readJsonOption(options['items-json'] || options.itemsJson || options.items, '--items-json');
    const report = await postRunReport(options, {
      target: String(options.target || process.env.WECOM_RUNNER_TARGET || 'unknown'),
      status: String(options.status || 'completed'),
      startedAt,
      finishedAt,
      durationMs: intOpt(options['duration-ms'] || options.durationMs, 0, 0, 24 * 60 * 60 * 1000),
      handledReplies: intOpt(options['handled-replies'], 0, 0, 100000),
      handledMassTasks: intOpt(options['handled-mass-tasks'], 0, 0, 100000),
      handledMomentTasks: intOpt(options['handled-moment-tasks'], 0, 0, 100000),
      failedReplies: intOpt(options['failed-replies'], 0, 0, 100000),
      failedMassTasks: intOpt(options['failed-mass-tasks'], 0, 0, 100000),
      failedMomentTasks: intOpt(options['failed-moment-tasks'], 0, 0, 100000),
      error: String(options.error || ''),
      summary: String(options.summary || ''),
      ...(items !== undefined ? { items } : {}),
    });
    printJson(report);
    return;
  }

  if (command === 'runner-policy') {
    const id = encodeURIComponent(workerId(options));
    printJson(await requestJson(options, 'GET', `/api/automation/bridge/wecom/runner-policy?workerId=${id}`));
    return;
  }

  if (command === 'pull-replies') {
    const limit = intOpt(options.limit, 50, 1, 200);
    printJson(await requestJson(options, 'GET', `/api/automation/bridge/wecom/replies?limit=${limit}`));
    return;
  }

  if (command === 'pull-mass-tasks') {
    const limit = intOpt(options.limit, 50, 1, 200);
    printJson(await requestJson(options, 'GET', `/api/automation/bridge/wecom/mass-tasks?limit=${limit}`));
    return;
  }

  if (command === 'pull-moment-tasks') {
    const limit = intOpt(options.limit, 50, 1, 200);
    printJson(await requestJson(options, 'GET', `/api/automation/bridge/wecom/moment-tasks?limit=${limit}`));
    return;
  }

  if (command === 'mark-delivered') {
    const eventId = positional[0] || options.id || options['event-id'];
    if (!eventId) throw new BridgeError('Missing eventId for mark-delivered.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(eventId)}`, {
        deliveryStatus: 'delivered',
        workerId: workerId(options),
      }),
    );
    return;
  }

  if (command === 'claim-reply') {
    const eventId = positional[0] || options.id || options['event-id'];
    if (!eventId) throw new BridgeError('Missing eventId for claim-reply.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(eventId)}`, {
        deliveryStatus: 'claimed',
        workerId: workerId(options),
        claimTtlSeconds: intOpt(options['claim-ttl-seconds'] || options.ttl, 300, 30, 86400),
      }),
    );
    return;
  }

  if (command === 'release-reply') {
    const eventId = positional[0] || options.id || options['event-id'];
    if (!eventId) throw new BridgeError('Missing eventId for release-reply.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(eventId)}`, {
        deliveryStatus: 'released',
        workerId: workerId(options),
        reason: String(options.reason || options.message || 'released by Mac bridge client'),
      }),
    );
    return;
  }

  if (command === 'mark-failed') {
    const eventId = positional[0] || options.id || options['event-id'];
    if (!eventId) throw new BridgeError('Missing eventId for mark-failed.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(eventId)}`, {
        deliveryStatus: 'failed',
        workerId: workerId(options),
        error: String(options.error || options.message || 'Mac handler failed'),
      }),
    );
    return;
  }

  if (command === 'claim-mass-task') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for claim-mass-task.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/mass-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'claimed',
        workerId: workerId(options),
        claimTtlSeconds: intOpt(options['claim-ttl-seconds'] || options.ttl, 300, 30, 86400),
      }),
    );
    return;
  }

  if (command === 'release-mass-task') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for release-mass-task.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/mass-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'released',
        workerId: workerId(options),
        reason: String(options.reason || options.message || 'released by Mac bridge client'),
      }),
    );
    return;
  }

  if (command === 'mark-mass-sent') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for mark-mass-sent.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/mass-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'sent',
        workerId: workerId(options),
      }),
    );
    return;
  }

  if (command === 'mark-mass-failed') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for mark-mass-failed.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/mass-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'failed',
        workerId: workerId(options),
        error: String(options.error || options.message || 'Mac mass handler failed'),
      }),
    );
    return;
  }

  if (command === 'claim-moment-task') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for claim-moment-task.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'claimed',
        workerId: workerId(options),
        claimTtlSeconds: intOpt(options['claim-ttl-seconds'] || options.ttl, 300, 30, 86400),
      }),
    );
    return;
  }

  if (command === 'release-moment-task') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for release-moment-task.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'released',
        workerId: workerId(options),
        reason: String(options.reason || options.message || 'released by Mac bridge client'),
      }),
    );
    return;
  }

  if (command === 'mark-moment-prepared') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for mark-moment-prepared.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'prepared',
        workerId: workerId(options),
      }),
    );
    return;
  }

  if (command === 'mark-moment-published') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for mark-moment-published.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'published',
        workerId: workerId(options),
      }),
    );
    return;
  }

  if (command === 'mark-moment-failed') {
    const taskId = positional[0] || options.id || options['task-id'];
    if (!taskId) throw new BridgeError('Missing taskId for mark-moment-failed.');
    printJson(
      await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(taskId)}`, {
        deliveryStatus: 'failed',
        workerId: workerId(options),
        error: String(options.error || options.message || 'Mac moment handler failed'),
      }),
    );
    return;
  }

  if (command === 'run-approved') {
    const handler = options.handler;
    const limit = intOpt(options.limit, 10, 1, 50);
    const claim = boolOpt(options, 'claim', 'claim-first');
    const markDelivered = boolOpt(options, 'mark-delivered', 'ack', 'ack-delivered');
    const reportFailure = boolOpt(options, 'report-failure', 'mark-failed');
    const dryRun = boolOpt(options, 'dry-run');
    if (!handler && !dryRun) throw new BridgeError('run-approved requires --handler or --dry-run.');
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const { replies = [] } = await requestJson(options, 'GET', `/api/automation/bridge/wecom/replies?limit=${limit}`);
    const handled = [];
    for (const reply of replies) {
      if (dryRun) {
        handled.push({
          target: 'reply',
          id: reply.id,
          conversationName: reply.conversationName,
          action: 'dry-run',
          stepCount: Array.isArray(reply.replySteps) && reply.replySteps.length ? reply.replySteps.length : reply.replyDraft ? 1 : 0,
          imageStepCount: Array.isArray(reply.replySteps) ? reply.replySteps.filter((step) => step?.type === 'image').length : 0,
          dryRun: true,
        });
        continue;
      }
      let runnable = reply;
      if (claim) {
        const claimed = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(reply.id)}`, {
          deliveryStatus: 'claimed',
          workerId: workerId(options),
          claimTtlSeconds: intOpt(options['claim-ttl-seconds'] || options.ttl, 300, 30, 86400),
        });
        runnable = claimed.event || reply;
      }
      const result = await runHandler(handler, runnable);
      const ok = result.code === 0;
      const item = {
        target: 'reply',
        id: reply.id,
        conversationName: reply.conversationName,
        action: ok ? (markDelivered ? 'delivered' : claim ? 'prepared' : 'handled') : 'failed',
        ok,
        exitCode: result.code,
        signal: result.signal,
        claimed: claim,
      };
      const verification = handlerVerification(result, reply.conversationName);
      if (verification) item.verification = verification;
      if (ok && markDelivered) {
        item.delivered = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(reply.id)}`, {
          deliveryStatus: 'delivered',
          workerId: workerId(options),
        });
      }
      if (!ok && reportFailure) {
        item.failed = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/replies/${encodeURIComponent(reply.id)}`, {
          deliveryStatus: 'failed',
          workerId: workerId(options),
          error: `handler exited with ${result.code}${result.signal ? ` (${result.signal})` : ''}`,
        });
      }
      handled.push(item);
    }
    const output = { handled, total: replies.length, claimed: claim, markedDelivered: markDelivered, reportedFailure: reportFailure };
    if (shouldReportRun(options)) {
      output.runReport = await postRunReport(options, {
        target: 'replies',
        mode: dryRun ? 'dry-run' : runnerMode(options, markDelivered ? 'send' : claim ? 'prepare' : 'manual'),
        status: runStatusFromHandled(handled),
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        handledReplies: handled.length,
        failedReplies: handled.filter((item) => item.ok === false).length,
        items: handled,
        summary: runSummary('replies', handled, replies.length),
      });
    }
    printJson(output);
    return;
  }

  if (command === 'run-mass') {
    const handler = options.handler;
    const limit = intOpt(options.limit, 10, 1, 50);
    const claim = boolOpt(options, 'claim', 'claim-first');
    const markSent = boolOpt(options, 'mark-sent', 'ack', 'ack-sent', 'mark-delivered');
    const reportFailure = boolOpt(options, 'report-failure', 'mark-failed');
    const dryRun = boolOpt(options, 'dry-run');
    if (!handler && !dryRun) throw new BridgeError('run-mass requires --handler or --dry-run.');
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const { tasks = [] } = await requestJson(options, 'GET', `/api/automation/bridge/wecom/mass-tasks?limit=${limit}`);
    const handled = [];
    for (const task of tasks) {
      if (dryRun) {
        handled.push({ target: 'mass', id: task.id, recipientName: task.recipientName, action: 'dry-run', dryRun: true });
        continue;
      }
      let runnable = task;
      if (claim) {
        const claimed = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/mass-tasks/${encodeURIComponent(task.id)}`, {
          deliveryStatus: 'claimed',
          workerId: workerId(options),
          claimTtlSeconds: intOpt(options['claim-ttl-seconds'] || options.ttl, 300, 30, 86400),
        });
        runnable = claimed.task || task;
      }
      const result = await runMassHandler(handler, runnable);
      const ok = result.code === 0;
      const item = {
        target: 'mass',
        id: task.id,
        recipientName: task.recipientName,
        action: ok ? (markSent ? 'sent' : claim ? 'prepared' : 'handled') : 'failed',
        ok,
        exitCode: result.code,
        signal: result.signal,
        claimed: claim,
      };
      const verification = handlerVerification(result, task.recipientName);
      if (verification) item.verification = verification;
      if (ok && markSent) {
        item.sent = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/mass-tasks/${encodeURIComponent(task.id)}`, {
          deliveryStatus: 'sent',
          workerId: workerId(options),
        });
      }
      if (!ok && reportFailure) {
        item.failed = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/mass-tasks/${encodeURIComponent(task.id)}`, {
          deliveryStatus: 'failed',
          workerId: workerId(options),
          error: `handler exited with ${result.code}${result.signal ? ` (${result.signal})` : ''}`,
        });
      }
      handled.push(item);
    }
    const output = { handled, total: tasks.length, claimed: claim, markedSent: markSent, reportedFailure: reportFailure };
    if (shouldReportRun(options)) {
      output.runReport = await postRunReport(options, {
        target: 'mass',
        mode: dryRun ? 'dry-run' : runnerMode(options, markSent ? 'send' : claim ? 'prepare' : 'manual'),
        status: runStatusFromHandled(handled),
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        handledMassTasks: handled.length,
        failedMassTasks: handled.filter((item) => item.ok === false).length,
        items: handled,
        summary: runSummary('mass', handled, tasks.length),
      });
    }
    printJson(output);
    return;
  }

  if (command === 'run-moments') {
    const handler = options.handler;
    const limit = intOpt(options.limit, 10, 1, 50);
    const claim = boolOpt(options, 'claim', 'claim-first');
    const markPrepared = boolOpt(options, 'mark-prepared', 'ack', 'ack-prepared');
    const markPublished = boolOpt(options, 'mark-published', 'ack-published');
    const reportFailure = boolOpt(options, 'report-failure', 'mark-failed');
    const dryRun = boolOpt(options, 'dry-run');
    if (!handler && !dryRun) throw new BridgeError('run-moments requires --handler or --dry-run.');
    if (markPrepared && markPublished) throw new BridgeError('run-moments cannot use --mark-prepared and --mark-published together.');
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const { tasks = [] } = await requestJson(options, 'GET', `/api/automation/bridge/wecom/moment-tasks?limit=${limit}`);
    const handled = [];
    for (const task of tasks) {
      if (dryRun) {
        handled.push({ target: 'moment', id: task.id, title: task.title, action: 'dry-run', dryRun: true });
        continue;
      }
      let runnable = task;
      if (claim) {
        const claimed = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(task.id)}`, {
          deliveryStatus: 'claimed',
          workerId: workerId(options),
          claimTtlSeconds: intOpt(options['claim-ttl-seconds'] || options.ttl, 300, 30, 86400),
        });
        runnable = claimed.task || task;
      }
      const result = await runMomentHandler(handler, runnable);
      const ok = result.code === 0;
      const item = {
        target: 'moment',
        id: task.id,
        title: task.title,
        action: ok ? (markPublished ? 'published' : markPrepared || claim ? 'prepared' : 'handled') : 'failed',
        ok,
        exitCode: result.code,
        signal: result.signal,
        claimed: claim,
      };
      const verification = handlerVerification(result, task.title);
      if (verification) item.verification = verification;
      if (ok && markPrepared) {
        item.prepared = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(task.id)}`, {
          deliveryStatus: 'prepared',
          workerId: workerId(options),
        });
      }
      if (ok && markPublished) {
        item.published = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(task.id)}`, {
          deliveryStatus: 'published',
          workerId: workerId(options),
        });
      }
      if (!ok && reportFailure) {
        item.failed = await requestJson(options, 'PATCH', `/api/automation/bridge/wecom/moment-tasks/${encodeURIComponent(task.id)}`, {
          deliveryStatus: 'failed',
          workerId: workerId(options),
          error: `handler exited with ${result.code}${result.signal ? ` (${result.signal})` : ''}`,
        });
      }
      handled.push(item);
    }
    const output = {
      handled,
      total: tasks.length,
      claimed: claim,
      markedPrepared: markPrepared,
      markedPublished: markPublished,
      reportedFailure: reportFailure,
    };
    if (shouldReportRun(options)) {
      output.runReport = await postRunReport(options, {
        target: 'moments',
        mode: dryRun ? 'dry-run' : runnerMode(options, markPublished ? 'send' : markPrepared || claim ? 'prepare' : 'manual'),
        status: runStatusFromHandled(handled),
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        handledMomentTasks: handled.length,
        failedMomentTasks: handled.filter((item) => item.ok === false).length,
        items: handled,
        summary: runSummary('moments', handled, tasks.length),
      });
    }
    printJson(output);
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
