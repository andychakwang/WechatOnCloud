import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fstatic from '@fastify/static';
import httpProxy from 'http-proxy';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import {
  initStore,
  findByUsername,
  findById,
  verifyPassword,
  publicUser,
  listUsers,
  createSub,
  setDisabled,
  resetPassword,
  deleteUser,
  setUserInstances,
  listInstances,
  findInstance,
  setInstanceMemLimits,
  userInstances,
  userCanAccess,
  createInstance,
  removeInstance as removeInstanceRecord,
  renameInstance,
  setInstanceIcon,
  setInstanceUsers,
  publicInstance,
  APP_TYPES,
  type AppType,
  type User,
  type Instance,
} from './store.js';
import {
  ensureNetwork,
  ensureRunning,
  runInstance,
  stopInstance,
  upgradeInstance,
  removeInstance as removeInstanceContainer,
  instanceRuntime,
  triggerWechat,
  wechatStatus,
  instanceTarget,
  uploadToInstance,
  listInstanceFiles,
  downloadFromInstance,
  deleteInstanceFile,
  instanceLogs,
  buildDiagnostics,
  typeInInstance,
  keyInInstance,
  copyTextToInstanceClipboard,
  readTextFromInstanceClipboard,
  openConversationInInstance,
  automationSelfTestInInstance,
  inspectAutomationInInstance,
  verifyAutomationTargetInInstance,
  listOrphanVolumes,
  removeVolume,
  listOrphanContainers,
  removeContainerById,
  instanceMemoryMB,
  instanceHttpHealthy,
  regenInstanceMachineId,
  listVolume,
  volMkdir,
  volMove,
  volDelete,
  volUploadFile,
  volExtractArchive,
  volDownloadFile,
  volBackupStream,
  volRestoreArchive,
  getPanelSelfUpgradePlan,
  startPanelSelfUpgrade,
} from './docker.js';
import { createSession, getSession, destroySession, destroyUserSessions } from './sessions.js';
import { parseHost, parseAllowedHosts, isRequestHostAllowed } from './host-guard.js';
import { CURRENT_VERSION, versionInfo, ensureChecked, checkForUpdate, startUpdateChecker } from './version.js';
import { appendInstanceLog, readInstanceLog, appendPanelLog, readPanelLog, pruneOldLogs, filterSince, rangeToMs, DIAG_RANGES } from './logs.js';
import {
  initAutomationStore,
  getAutomationConfig,
  getAutomationOverview,
  getAutomationHealth,
  getAutomationPreflightReport,
  getAutomationActionQueue,
  approveAutomationActionQueueReview,
  approveAutomationActionQueueReviews,
  updateAutomationConfig,
  exportAutomationBundle,
  exportWecomRpaPackage,
  recordWecomRpaPackageIssue,
  serializeWecomRpaPackage,
  importAutomationBundle,
  importWecomAssistantAssets,
  ingestWecomBridgeEvents,
  planWecomBridgeEventReply,
  planWecomBridgeEventReplies,
  importAutomationKnowledge,
  importAutomationAudience,
  listAutomationAudience,
  listAutomationMaterials,
  getWecomBridgeMaterialMap,
  importAutomationMaterials,
  patchAutomationMaterialAsset,
  deleteAutomationMaterialAsset,
  patchAutomationAudienceContact,
  deleteAutomationAudienceContact,
  listWecomBridgeWorkers,
  patchWecomBridgeWorker,
  listWecomBridgeRunReports,
  listWecomRpaPackageIssues,
  summarizeWecomBridgeRunReports,
  getWecomBridgeRunnerPolicy,
  updateWecomBridgeRunnerPolicy,
  recoverAutomationBridgeOutbox,
  listApprovedWecomBridgeReplies,
  listApprovedWecomBridgeMassTasks,
  listApprovedWecomBridgeMomentTasks,
  listWecomBridgeEvents,
  recordWecomBridgeHeartbeat,
  recordWecomBridgeRunReport,
  patchWecomBridgeReplyDelivery,
  patchWecomBridgeMassTaskDelivery,
  patchWecomBridgeMomentTaskDelivery,
  patchAutomationKnowledge,
  patchWecomBridgeEvent,
  deleteAutomationKnowledge,
  simulateAutomation,
  listAutomationAudit,
  listMassSendJobs,
  createMassSendJob,
  createMassSendJobFromAudience,
  patchMassSendJob,
  patchMassSendItem,
  listMomentDrafts,
  createMomentDraft,
  patchMomentDraft,
  planAutomationReply,
  draftAutomationReply,
  draftCampaignKit,
  draftMassSendContent,
  draftMomentContent,
  sendAutomationRule,
  sendAutomationText,
  sendNextMassSendItem,
  prepareMomentDraft,
} from './automation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const STATIC_DIR = process.env.STATIC_DIR || join(__dirname, '../../web/dist');
const COOKIE = 'woc_sess';
const AUTOMATION_BRIDGE_ENDPOINT = '/api/automation/bridge/wecom/import';
const AUTOMATION_BRIDGE_ASSISTANT_ENDPOINT = '/api/automation/bridge/wecom/assistant-import';
const AUTOMATION_BRIDGE_AUDIENCE_ENDPOINT = '/api/automation/bridge/wecom/audience';
const AUTOMATION_BRIDGE_MATERIAL_ENDPOINT = '/api/automation/bridge/wecom/materials';
const AUTOMATION_BRIDGE_MATERIAL_MAP_ENDPOINT = '/api/automation/bridge/wecom/material-map';
const AUTOMATION_BRIDGE_EVENT_ENDPOINT = '/api/automation/bridge/wecom/events';
const AUTOMATION_BRIDGE_REPLY_ENDPOINT = '/api/automation/bridge/wecom/replies';
const AUTOMATION_BRIDGE_MASS_TASK_ENDPOINT = '/api/automation/bridge/wecom/mass-tasks';
const AUTOMATION_BRIDGE_MOMENT_TASK_ENDPOINT = '/api/automation/bridge/wecom/moment-tasks';
const AUTOMATION_BRIDGE_HEARTBEAT_ENDPOINT = '/api/automation/bridge/wecom/heartbeat';
const AUTOMATION_BRIDGE_RUN_REPORT_ENDPOINT = '/api/automation/bridge/wecom/run-report';
const AUTOMATION_BRIDGE_RUNNER_POLICY_ENDPOINT = '/api/automation/bridge/wecom/runner-policy';
const AUTOMATION_RPA_PACKAGE_ENDPOINT = '/api/admin/automation/rpa-package';
const AUTOMATION_BRIDGE_TOKEN = String(process.env.AUTOMATION_BRIDGE_TOKEN || process.env.WECOM_BRIDGE_TOKEN || '').trim();
const AUTOMATION_BRIDGE_TOKEN_MIN_LENGTH = 16;
// Public hostnames the panel will accept Host headers for, in addition to the
// always-on loopback + RFC1918 LAN allowlist. Required for HTTPS reverse-proxy
// deploys (Caddy/nginx/飞牛 内置反代) where the public hostname differs from
// the LAN IP. See .env.example.
const ALLOWED_HOSTS = parseAllowedHosts(process.env.PANEL_ALLOWED_HOSTS);

function basicAuth(inst: Instance) {
  return 'Basic ' + Buffer.from(`${inst.kasmUser}:${inst.kasmPassword}`).toString('base64');
}

initStore();
initAutomationStore();

const app = Fastify({ logger: true, trustProxy: true });

// DNS-rebinding gate: reject requests whose Host header is neither a loopback /
// RFC1918 LAN address nor in PANEL_ALLOWED_HOSTS. Runs before every route so
// /api/*, /desktop/* and static-file responses are all covered.
app.addHook('onRequest', async (req, reply) => {
  if (!isRequestHostAllowed(req.headers.host, req.headers['x-forwarded-host'], ALLOWED_HOSTS)) {
    // 把被拒的 Host / X-Forwarded-Host 一起回显，反代调试时可一眼看出"后端实际收到的是什么"
    // —— 决定是去白名单加这个 host，还是修反代让它透传 Host。不泄露敏感信息。
    reply.code(400).send({
      error: 'Host header not allowed',
      host: parseHost(req.headers.host) || null,
      forwardedHost: req.headers['x-forwarded-host'] || null,
      hint: '反代部署请把对外域名加入 PANEL_ALLOWED_HOSTS（.env 逗号分隔，支持 *.example.com），改完用 docker compose up -d 重建容器（不是 restart）使其生效',
    });
  }
});

await app.register(cookie);
// 文件上传走原始二进制（前端以 application/octet-stream 直传 File）
app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

// ---------- 鉴权辅助 ----------
function currentUser(req: FastifyRequest): User | null {
  const token = req.cookies?.[COOKIE];
  const s = getSession(token);
  if (!s) return null;
  const u = findById(s.userId);
  if (!u || u.disabled) return null;
  return u;
}

function requireAuth(req: FastifyRequest, reply: FastifyReply): User | null {
  const u = currentUser(req);
  if (!u) {
    reply.code(401).send({ error: '未登录' });
    return null;
  }
  return u;
}

function requireAdmin(req: FastifyRequest, reply: FastifyReply): User | null {
  const u = requireAuth(req, reply);
  if (!u) return null;
  if (u.role !== 'admin') {
    reply.code(403).send({ error: '需要管理员权限' });
    return null;
  }
  return u;
}

function firstHeaderValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || '').split(',')[0]?.trim() || '';
}

function requestPublicOrigin(req?: FastifyRequest): string {
  const host = firstHeaderValue(req?.headers['x-forwarded-host'] as any) || firstHeaderValue(req?.headers.host);
  if (!host) return '';
  const proto = firstHeaderValue(req?.headers['x-forwarded-proto'] as any) || 'http';
  return `${proto}://${host}`;
}

function shellSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function automationBridgeRunnerGuide(req?: FastifyRequest) {
  const panelUrl = requestPublicOrigin(req) || 'http://nasbot.cloud:36081';
  const policy = getWecomBridgeRunnerPolicy();
  const configPath = '~/.config/wechat-on-cloud/wecom-bridge.env';
  const configPathShell = '$HOME/.config/wechat-on-cloud/wecom-bridge.env';
  const workspacePath = '$HOME/wechat-on-cloud-automation';
  const repoUrl = 'https://github.com/andychakwang/WechatOnCloud.git';
  const branch = 'andy/automation-lab';
  const materialMapPath = '$HOME/.config/wechat-on-cloud/wecom-materials.json';
  const materialMapCommandPath = '~/.config/wechat-on-cloud/wecom-materials.json';
  const launchAgentLabel = 'com.wechatoncloud.wecom-bridge';
  const launchAgentPlistPath = `~/Library/LaunchAgents/${launchAgentLabel}.plist`;
  const launchAgentLogPath = `~/Library/Logs/${launchAgentLabel}.log`;
  const launchAgentErrorLogPath = `~/Library/Logs/${launchAgentLabel}.err.log`;
  const wecomCliExecutable = 'wecom-cli';
  const tokenPlaceholder = 'replace-with-bridge-token-from-nas-docker-env';
  const defaultWorkerId = 'mac-bridge-01';
  const envFile = [
    '# WechatOnCloud WeCom Bridge runner config',
    '# chmod 600; contains the Bridge token.',
    `WOC_PANEL_URL=${shellSingle(panelUrl)}`,
    `AUTOMATION_BRIDGE_TOKEN=${shellSingle(tokenPlaceholder)}`,
    "WECOM_USE_REMOTE_POLICY='1'",
    `WECOM_RUNNER_ENGINE=${shellSingle(policy.runnerEngine)}`,
    `WECOM_RUNNER_MODE=${shellSingle(policy.mode)}`,
    `WECOM_RUNNER_TARGET=${shellSingle(policy.target)}`,
    `WECOM_RUNNER_LIMIT=${shellSingle(String(policy.limit))}`,
    `WECOM_CLAIM_TTL_SECONDS=${shellSingle(String(policy.claimTtlSeconds))}`,
    `WECOM_MOMENT_PASTE_MODE=${shellSingle(policy.momentPasteMode)}`,
    '# Optional: hand off Moments composer preparation to your existing Mac RPA project.',
    "# WECOM_MOMENT_PASTE_MODE='external-rpa'",
    '# WECOM_MOMENT_RPA_COMMAND=$HOME/path/to/your-wecom-moment-rpa.sh',
    `WECOM_MATERIAL_MAP_FILE=${materialMapPath}`,
    "WECOM_MATERIAL_MAP_KIND='image'",
    "WECOM_MATERIAL_MAP_INCLUDE_SKIPPED='1'",
    `WECOM_CLI_EXECUTABLE=${shellSingle(wecomCliExecutable)}`,
    "# Optional: keep @wecom/cli auth/config isolated from other local tools.",
    '# WECOM_CLI_CONFIG_DIR=$HOME/.config/wechat-on-cloud/wecom-cli',
    '# WECOM_CLI_TMP_DIR=$HOME/.cache/wechat-on-cloud/wecom-cli',
    `WECOM_USE_RPA_PACKAGE=${shellSingle(policy.runnerEngine === 'rpa-package' ? '1' : '0')}`,
    'WECOM_RPA_PACKAGE_SAVE_DIR=$HOME/.config/wechat-on-cloud/rpa-packages',
    "WECOM_BRIDGE_CAPABILITIES='reply,mass,moment,prepare,material-map,target-match,handler-verification'",
    `WECOM_REQUIRE_TARGET_MATCH=${shellSingle(policy.requireTargetMatch ? '1' : '0')}`,
    `WECOM_REQUIRE_HANDLER_VERIFICATION=${shellSingle(policy.requireHandlerVerification ? '1' : '0')}`,
    `WECOM_BRIDGE_INTERVAL_SEC=${shellSingle(String(policy.heartbeatIntervalSeconds))}`,
    `WECOM_BRIDGE_WORKER_ID=${shellSingle(defaultWorkerId)}`,
  ].join('\n');
  const bootstrapScript = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    `repo_url=${shellSingle(repoUrl)}`,
    `repo_branch=${shellSingle(branch)}`,
    `workspace_dir="${workspacePath}"`,
    `config_file="${configPathShell}"`,
    '',
    'need_cmd() {',
    '  if ! command -v "$1" >/dev/null 2>&1; then',
    '    echo "ERROR: missing required command: $1" >&2',
    '    exit 1',
    '  fi',
    '}',
    '',
    'need_cmd git',
    'need_cmd node',
    '',
    'mkdir -p "$(dirname "$config_file")"',
    'mkdir -p "$(dirname "$workspace_dir")"',
    '',
    'if [[ -d "$workspace_dir/.git" ]]; then',
    '  git -C "$workspace_dir" fetch --prune origin "$repo_branch"',
    '  git -C "$workspace_dir" checkout "$repo_branch"',
    '  git -C "$workspace_dir" pull --ff-only origin "$repo_branch"',
    'else',
    '  git clone --branch "$repo_branch" --depth 1 "$repo_url" "$workspace_dir"',
    'fi',
    '',
    'cat > "$config_file" <<\'EOF\'',
    envFile,
    'EOF',
    'chmod 600 "$config_file"',
    '',
    'cd "$workspace_dir"',
    'echo "Wrote $config_file"',
    'echo "Edit AUTOMATION_BRIDGE_TOKEN in $config_file, then run:"',
    'echo "  npm install -g @wecom/cli"',
    'echo "  wecom-cli init"',
    'echo "  scripts/wecom-bridge-runner.sh doctor"',
    'echo "  scripts/wecom-bridge-runner.sh run-once"',
    'echo "  scripts/install-wecom-bridge-launchagent.sh --dry-run --redact-secrets"',
  ].join('\n');
  return {
    panelUrl,
    configPath,
    workspacePath,
    repoUrl,
    branch,
    tokenEnvName: 'AUTOMATION_BRIDGE_TOKEN',
    tokenPlaceholder,
    defaultWorkerId,
    runnerScript: 'scripts/wecom-bridge-runner.sh',
    installScript: 'scripts/install-wecom-bridge-launchagent.sh',
    materialMapPath,
    launchAgentLabel,
    launchAgentPlistPath,
    launchAgentLogPath,
    launchAgentErrorLogPath,
    wecomCliExecutable,
    wecomCliInstallCommand: 'npm install -g @wecom/cli',
    wecomCliInitCommand: `${wecomCliExecutable} init`,
    modes: ['dry-run', 'prepare', 'send'],
    targets: ['replies', 'mass', 'moments', 'all'],
    envFile,
    bootstrapScript,
    commands: {
      bootstrap: `cat > /tmp/woc-mac-runner-bootstrap.sh <<'EOF'\n${bootstrapScript}\nEOF\nbash /tmp/woc-mac-runner-bootstrap.sh`,
      writeEnv: `mkdir -p ~/.config/wechat-on-cloud\ncat > ${configPath} <<'EOF'\n${envFile}\nEOF\nchmod 600 ${configPath}`,
      syncMaterialMap: `node scripts/wecom-bridge-client.mjs material-map --kind image --include-skipped 1 --output ${materialMapCommandPath}`,
      printConfig: 'scripts/wecom-bridge-runner.sh print-config',
      doctor: 'scripts/wecom-bridge-runner.sh doctor',
      doctorReport: 'WECOM_DOCTOR_REPORT=1 scripts/wecom-bridge-runner.sh doctor',
      doctorWithoutCli: 'WECOM_DOCTOR_CLI=0 scripts/wecom-bridge-runner.sh doctor',
      wecomCliInstall: 'npm install -g @wecom/cli',
      wecomCliInit: `${wecomCliExecutable} init`,
      wecomCliCheck: `${wecomCliExecutable} --version && ${wecomCliExecutable} auth show --auth-status`,
      syncCliAudience: `node scripts/wecom-bridge-client.mjs sync-cli-audience --wecom-cli ${wecomCliExecutable} --source wecom-cli-contact --tag wecom-cli`,
      importAssistantAssets:
        'node scripts/wecom-bridge-client.mjs import-assistant ~/Library/Application\\ Support/WeComAIAssistant/Backups/wecom-assistant-export.json --source wecom-ai-assistant --dry-run',
      dryRunAll: 'WECOM_RUNNER_MODE=dry-run WECOM_RUNNER_TARGET=all scripts/wecom-bridge-runner.sh run-once',
      dryRunRpaPackageAll:
        'WECOM_USE_RPA_PACKAGE=1 WECOM_RUNNER_MODE=dry-run WECOM_RUNNER_TARGET=all scripts/wecom-bridge-runner.sh run-once',
      prepareAll: 'WECOM_RUNNER_MODE=prepare WECOM_RUNNER_TARGET=all scripts/wecom-bridge-runner.sh run-once',
      prepareMomentExternalRpa:
        'WECOM_RUNNER_MODE=prepare WECOM_RUNNER_TARGET=moments WECOM_MOMENT_PASTE_MODE=external-rpa WECOM_MOMENT_RPA_COMMAND="$HOME/path/to/your-wecom-moment-rpa.sh" scripts/wecom-bridge-runner.sh run-once',
      sendAll: 'WECOM_RUNNER_MODE=send WECOM_RUNNER_TARGET=all WECOM_ALLOW_SEND=1 scripts/wecom-bridge-runner.sh run-once',
      dryRunLaunchAgent:
        "WECOM_RUNNER_MODE='dry-run' WECOM_RUNNER_TARGET='all' WECOM_BRIDGE_INTERVAL_SEC=60 scripts/install-wecom-bridge-launchagent.sh --dry-run --redact-secrets",
      installLaunchAgent: "WECOM_RUNNER_MODE='dry-run' WECOM_RUNNER_TARGET='all' WECOM_BRIDGE_INTERVAL_SEC=60 scripts/install-wecom-bridge-launchagent.sh",
      launchAgentStatus: `launchctl list | grep ${launchAgentLabel} || true`,
      tailLaunchAgentLog: `tail -n 80 -f ~/Library/Logs/${launchAgentLabel}.log ~/Library/Logs/${launchAgentLabel}.err.log`,
      unloadLaunchAgent: `launchctl unload ~/Library/LaunchAgents/${launchAgentLabel}.plist || true`,
    },
  };
}

function automationBridgeStatus(req?: FastifyRequest) {
  const configured = AUTOMATION_BRIDGE_TOKEN.length > 0;
  const tokenLengthOk = AUTOMATION_BRIDGE_TOKEN.length >= AUTOMATION_BRIDGE_TOKEN_MIN_LENGTH;
  return {
    enabled: configured && tokenLengthOk,
    configured,
    tokenLengthOk,
    tokenEnvName: 'AUTOMATION_BRIDGE_TOKEN',
    compatibilityEnvName: 'WECOM_BRIDGE_TOKEN',
    endpoint: AUTOMATION_BRIDGE_ENDPOINT,
    knowledgeEndpoint: AUTOMATION_BRIDGE_ENDPOINT,
    assistantEndpoint: AUTOMATION_BRIDGE_ASSISTANT_ENDPOINT,
    audienceEndpoint: AUTOMATION_BRIDGE_AUDIENCE_ENDPOINT,
    materialEndpoint: AUTOMATION_BRIDGE_MATERIAL_ENDPOINT,
    materialMapEndpoint: AUTOMATION_BRIDGE_MATERIAL_MAP_ENDPOINT,
    eventEndpoint: AUTOMATION_BRIDGE_EVENT_ENDPOINT,
    replyEndpoint: AUTOMATION_BRIDGE_REPLY_ENDPOINT,
    massTaskEndpoint: AUTOMATION_BRIDGE_MASS_TASK_ENDPOINT,
    momentTaskEndpoint: AUTOMATION_BRIDGE_MOMENT_TASK_ENDPOINT,
    heartbeatEndpoint: AUTOMATION_BRIDGE_HEARTBEAT_ENDPOINT,
    runReportEndpoint: AUTOMATION_BRIDGE_RUN_REPORT_ENDPOINT,
    runnerPolicyEndpoint: AUTOMATION_BRIDGE_RUNNER_POLICY_ENDPOINT,
    rpaPackageEndpoint: AUTOMATION_RPA_PACKAGE_ENDPOINT,
    workers: listWecomBridgeWorkers(20),
    authHeaders: ['Authorization: Bearer <token>', 'X-Automation-Token: <token>'],
    runnerGuide: automationBridgeRunnerGuide(req),
  };
}

function bridgeTokenFrom(req: FastifyRequest): string {
  const auth = String(req.headers.authorization || '').trim();
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return String(req.headers['x-automation-token'] || '').trim();
}

function tokenEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function boolQuery(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function requireAutomationBridge(req: FastifyRequest, reply: FastifyReply): boolean {
  const status = automationBridgeStatus();
  if (!status.configured) {
    reply.code(404).send({ error: '自动化 Bridge 未启用' });
    return false;
  }
  if (!status.tokenLengthOk) {
    reply.code(503).send({ error: `AUTOMATION_BRIDGE_TOKEN 至少需要 ${AUTOMATION_BRIDGE_TOKEN_MIN_LENGTH} 个字符` });
    return false;
  }
  const token = bridgeTokenFrom(req);
  if (!token) {
    reply.code(401).send({ error: '缺少 Bridge token' });
    return false;
  }
  if (!tokenEquals(token, AUTOMATION_BRIDGE_TOKEN)) {
    reply.code(403).send({ error: 'Bridge token 不正确' });
    return false;
  }
  return true;
}

const AUTOMATION_BRIDGE_USER: User = {
  id: 'automation-bridge',
  username: 'automation-bridge',
  role: 'admin',
  passwordHash: '',
  disabled: false,
  createdAt: new Date(0).toISOString(),
  allowedInstances: [],
};

// ---------- 登录 / 会话 ----------
app.post('/api/auth/login', async (req, reply) => {
  const { username, password } = (req.body as any) ?? {};
  const u = username ? findByUsername(username) : undefined;
  if (!u || u.disabled || !verifyPassword(u, password ?? '')) {
    return reply.code(401).send({ error: '用户名或密码错误' });
  }
  const token = createSession(u.id);
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return { user: publicUser(u) };
});

app.post('/api/auth/logout', async (req, reply) => {
  destroySession(req.cookies?.[COOKIE]);
  reply.clearCookie(COOKIE, { path: '/' });
  return { ok: true };
});

app.get('/api/auth/me', async (req, reply) => {
  const u = currentUser(req);
  if (!u) return reply.code(401).send({ error: '未登录' });
  return { user: publicUser(u) };
});

// ---------- 版本与更新检测 ----------
// 当前构建版本 + 缓存的「最新版」检测结果（后台每 6h 查一次 Docker Hub/GHCR）。任何登录用户可读。
app.get('/api/version', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  ensureChecked(); // 刚启动还没首检时，触发一次后台检查（不阻塞本次响应）
  return versionInfo();
});
// 立即重新检查（管理员，用于「检查更新」按钮）。
app.post('/api/admin/version/check', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return await checkForUpdate();
});

app.get('/api/admin/panel-upgrade/plan', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  try {
    const query = req.query as any;
    return { plan: await getPanelSelfUpgradePlan(query?.version || query?.targetVersion || '') };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '生成面板升级计划失败' });
  }
});

app.post('/api/admin/panel-upgrade/start', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = await startPanelSelfUpgrade(req.body as any);
    appendPanelLog('WARN', `面板自升级由 ${admin.username} 触发：target=${result.plan.targetVersion} helper=${result.helperName}`);
    return result;
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '启动面板自升级失败' });
  }
});

// ---------- 自动化实验版（管理员） ----------
// 这是与本地企微 AI 回复助手融合后的保守自动化内核：
// 规则必须 approved，发送必须 confirm=true，且经过敏感词/限流/冷却校验。
app.get('/api/admin/automation/config', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { config: getAutomationConfig() };
});

app.get('/api/admin/automation/overview', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { overview: getAutomationOverview() };
});

app.get('/api/admin/automation/health', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { health: getAutomationHealth() };
});

app.get('/api/admin/automation/preflight', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { report: getAutomationPreflightReport() };
});

app.get('/api/admin/automation/action-queue', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const query = req.query as any;
  return { queue: getAutomationActionQueue({ limit: Number(query?.limit || 20), offset: query?.offset, target: query?.target }) };
});

app.post('/api/admin/automation/action-queue/items/:itemId/approve', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const query = req.query as any;
    const body = req.body as any;
    const result = approveAutomationActionQueueReview(admin, (req.params as any).itemId, {
      limit: Number(body?.limit ?? query?.limit ?? 20),
      offset: body?.queueOffset ?? body?.offset ?? query?.offset,
      target: body?.queueTarget ?? body?.viewTarget ?? query?.target,
    });
    appendPanelLog('INFO', `审核自动化队列项「${result.item.title}」by ${admin.username}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '审核自动化队列项失败' });
  }
});

app.post('/api/admin/automation/action-queue/reviews/approve', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = approveAutomationActionQueueReviews(admin, req.body as any);
    appendPanelLog(
      'INFO',
      `${result.dryRun ? '预览批量审核' : '批量审核'}自动化队列 by ${admin.username}：target=${result.target} candidates=${result.candidates.length} approved=${result.approved.total} failed=${result.failed.length}`,
    );
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '批量审核自动化队列失败' });
  }
});

app.put('/api/admin/automation/config', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const config = updateAutomationConfig(req.body);
    appendPanelLog('INFO', `自动化配置由 ${admin.username} 更新：${config.rules.length} 条规则，总开关=${config.settings.enabled ? '开' : '关'}`);
    return { config };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '保存自动化配置失败' });
  }
});

app.get('/api/admin/automation/bundle', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const query = req.query as any;
  return {
    bundle: exportAutomationBundle({
      includeBridgeEvents: query?.includeBridgeEvents === '1' || query?.includeBridgeEvents === 'true',
      includeOperational: query?.includeOperational === '1' || query?.includeOperational === 'true',
      includeAudit: query?.includeAudit === '1' || query?.includeAudit === 'true',
    }),
  };
});

app.get('/api/admin/automation/rpa-package', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const query = req.query as any;
    const pkg = exportWecomRpaPackage({
      target: query?.target,
      actionQueueItemIds: query?.actionQueueItemIds ?? query?.queueItemIds ?? query?.itemIds,
      limit: query?.limit,
      ttlMinutes: query?.ttlMinutes ?? query?.ttl ?? query?.expiresInMinutes,
      expiresAt: query?.expiresAt,
      format: query?.format,
      mode: query?.mode,
      includeSource: query?.includeSource,
      sourceTask: query?.sourceTask,
      source: query?.source,
      workerSource: query?.workerSource ?? query?.bridgeSource ?? query?.worker_source ?? query?.bridge_source,
      workerId: query?.workerId || admin.username,
      capabilities: query?.capabilities ?? query?.capability ?? query?.workerCapabilities,
      requireSendable: query?.requireSendable ?? query?.sendable ?? query?.requireAutoSend,
      packageId: query?.packageId,
    });
    const download = query?.download === '1' || query?.download === 'true';
    const raw = download || pkg.format === 'jsonl' || query?.raw === '1' || query?.raw === 'true';
    recordWecomRpaPackageIssue(admin, pkg, { ...query, download, raw });
    if (raw) {
      const filename = `${pkg.packageId}.${pkg.format === 'json' ? 'json' : 'jsonl'}`;
      reply.header('content-type', pkg.format === 'json' ? 'application/json; charset=utf-8' : 'application/x-ndjson; charset=utf-8');
      if (download) reply.header('content-disposition', `attachment; filename="${filename}"`);
      return reply.send(serializeWecomRpaPackage(pkg, pkg.format));
    }
    return { package: pkg };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '导出 RPA 运行包失败' });
  }
});

app.get('/api/admin/automation/rpa-package/issues', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const query = req.query as any;
  return { packages: listWecomRpaPackageIssues(Number(query?.limit || 50)) };
});

app.post('/api/admin/automation/bundle/import', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = importAutomationBundle(admin, req.body as any);
    appendPanelLog(
      'INFO',
      `${result.dryRun ? '预览' : '导入'}自动化资产包 by ${admin.username}：新增 ${Object.values(result.imported).reduce((sum, value) => sum + value, 0)}，更新 ${Object.values(result.updated).reduce((sum, value) => sum + value, 0)}，跳过 ${result.skipped}`,
    );
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '导入自动化资产包失败' });
  }
});

app.post('/api/admin/automation/wecom-assistant/import', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = importWecomAssistantAssets(admin, req.body as any);
    appendPanelLog(
      'INFO',
      `${result.dryRun ? '预览' : '导入'}企微助手融合资产 by ${admin.username}：翻译规则 ${result.translated.rules}，资料 ${result.translated.knowledgeItems}；新增 ${Object.values(result.result.imported).reduce((sum, value) => sum + value, 0)}，更新 ${Object.values(result.result.updated).reduce((sum, value) => sum + value, 0)}，跳过 ${result.result.skipped + result.translated.skipped}`,
    );
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '导入企微助手资产失败' });
  }
});

app.get('/api/admin/automation/bridge', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { bridge: automationBridgeStatus(req) };
});

app.get('/api/admin/automation/bridge-events', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const query = req.query as any;
  return { events: listWecomBridgeEvents(Number(query?.limit || 100), query?.status) };
});

app.post('/api/admin/automation/bridge-events/:eventId/reply-plan', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = await planWecomBridgeEventReply(admin, (req.params as any).eventId, {
      overwrite: true,
      ...(req.body as any),
    });
    appendPanelLog('INFO', `生成企微 Bridge 回复草稿「${result.event.conversationName || result.event.senderName}」by ${admin.username}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '生成企微 Bridge 回复草稿失败' });
  }
});

app.get('/api/admin/automation/bridge-runs', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const query = req.query as any;
  return { reports: listWecomBridgeRunReports(Number(query?.limit || 50), String(query?.workerId || '')) };
});

app.patch('/api/admin/automation/bridge-workers/:workerId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const worker = patchWecomBridgeWorker(admin, decodeURIComponent(String((req.params as any).workerId || '')), req.body as any);
    appendPanelLog('INFO', `${worker.enabled ? '恢复' : '暂停'} Bridge worker「${worker.workerId}」by ${admin.username}`);
    return { worker };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新 Bridge worker 失败' });
  }
});

app.get('/api/admin/automation/bridge-runs/summary', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const query = req.query as any;
  return {
    summary: summarizeWecomBridgeRunReports({
      limit: query?.limit,
      hours: query?.hours,
      windowHours: query?.windowHours,
      workerId: query?.workerId,
    }),
  };
});

app.get('/api/admin/automation/runner-policy', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { policy: getWecomBridgeRunnerPolicy() };
});

app.put('/api/admin/automation/runner-policy', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const policy = updateWecomBridgeRunnerPolicy(admin, req.body as any);
    appendPanelLog('INFO', `更新 Mac Runner 策略 by ${admin.username}：${policy.runnerEngine}/${policy.target}/${policy.mode}，limit=${policy.limit}`);
    return { policy };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新 Mac Runner 策略失败' });
  }
});

app.post('/api/admin/automation/bridge-recovery', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = recoverAutomationBridgeOutbox(admin, req.body as any);
    const filters = [
      result.workerId ? `worker=${result.workerId}` : '',
      result.failureReason ? `原因=${result.failureReason}` : '',
      result.minFailedAgeSeconds > 0 ? `失败冷却>=${result.minFailedAgeSeconds}s` : '',
      result.cursor ? 'cursor=继续' : '',
      result.hasMore ? 'hasMore=1' : '',
    ].filter(Boolean);
    appendPanelLog(
      'INFO',
      `${result.dryRun ? '预览' : '恢复'} Bridge 出箱${filters.length ? ` ${filters.join(' ')}` : ''} by ${admin.username}：释放 ${result.replies.releasedClaims + result.mass.releasedClaims + result.moments.releasedClaims}，重试 ${result.replies.retriedFailed + result.mass.retriedFailed + result.moments.retriedFailed}，limit=${result.limit}`,
    );
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '恢复 Bridge 出箱失败' });
  }
});

app.patch('/api/admin/automation/bridge-events/:eventId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const event = patchWecomBridgeEvent(admin, (req.params as any).eventId, req.body as any);
    appendPanelLog('INFO', `更新企微 Bridge 消息事件「${event.conversationName || event.senderName}」by ${admin.username}`);
    return { event };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新 Bridge 消息事件失败' });
  }
});

app.post('/api/admin/automation/knowledge/import', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = importAutomationKnowledge(admin, req.body as any);
    appendPanelLog('INFO', `导入企微接入资料 by ${admin.username}：新增 ${result.imported}，更新 ${result.updated}，跳过 ${result.skipped}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '导入接入资料失败' });
  }
});

app.get('/api/admin/automation/audience', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const query = req.query as any;
  return {
    contacts: listAutomationAudience(Number(query?.limit || 200), String(query?.query || ''), String(query?.tag || '')),
  };
});

app.post('/api/admin/automation/audience/import', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = importAutomationAudience(admin, req.body as any);
    appendPanelLog('INFO', `导入受众资产 by ${admin.username}：新增 ${result.imported}，更新 ${result.updated}，跳过 ${result.skipped}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '导入受众资产失败' });
  }
});

app.get('/api/admin/automation/materials', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const query = req.query as any;
  return {
    assets: listAutomationMaterials(Number(query?.limit || 200), String(query?.query || ''), String(query?.tag || '')),
  };
});

app.post('/api/admin/automation/materials/import', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = importAutomationMaterials(admin, req.body as any);
    appendPanelLog('INFO', `导入素材资产 by ${admin.username}：新增 ${result.imported}，更新 ${result.updated}，跳过 ${result.skipped}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '导入素材资产失败' });
  }
});

app.post(AUTOMATION_BRIDGE_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const result = importAutomationKnowledge(AUTOMATION_BRIDGE_USER, {
      ...(req.body as any),
      source: (req.body as any)?.source || 'wecom-mac-bridge',
    });
    appendPanelLog('INFO', `Bridge 导入企微接入资料：新增 ${result.imported}，更新 ${result.updated}，跳过 ${result.skipped}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 导入接入资料失败' });
  }
});

app.post(AUTOMATION_BRIDGE_ASSISTANT_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const body = (req.body as any) ?? {};
    const result = importWecomAssistantAssets(AUTOMATION_BRIDGE_USER, {
      ...body,
      source: body?.source || 'wecom-ai-assistant-bridge',
    });
    appendPanelLog(
      'INFO',
      `${result.dryRun ? '预览' : 'Bridge 导入'}企微助手融合资产：翻译规则 ${result.translated.rules}，资料 ${result.translated.knowledgeItems}；新增 ${Object.values(result.result.imported).reduce((sum, value) => sum + value, 0)}，更新 ${Object.values(result.result.updated).reduce((sum, value) => sum + value, 0)}，跳过 ${result.result.skipped + result.translated.skipped}`,
    );
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 导入企微助手资产失败' });
  }
});

app.post(AUTOMATION_BRIDGE_AUDIENCE_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const result = importAutomationAudience(AUTOMATION_BRIDGE_USER, {
      ...(req.body as any),
      source: (req.body as any)?.source || 'wecom-mac-bridge',
    });
    appendPanelLog('INFO', `Bridge 导入受众资产：新增 ${result.imported}，更新 ${result.updated}，跳过 ${result.skipped}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 导入受众资产失败' });
  }
});

app.post(AUTOMATION_BRIDGE_MATERIAL_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const result = importAutomationMaterials(AUTOMATION_BRIDGE_USER, {
      ...(req.body as any),
      source: (req.body as any)?.source || 'wecom-mac-bridge',
    });
    appendPanelLog('INFO', `Bridge 导入素材资产：新增 ${result.imported}，更新 ${result.updated}，跳过 ${result.skipped}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 导入素材资产失败' });
  }
});

app.get(AUTOMATION_BRIDGE_MATERIAL_MAP_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  return { materialMap: getWecomBridgeMaterialMap(req.query as any) };
});

app.post(AUTOMATION_BRIDGE_EVENT_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const body = (req.body as any) ?? {};
    const query = (req.query as any) ?? {};
    const result = ingestWecomBridgeEvents(AUTOMATION_BRIDGE_USER, {
      ...body,
      source: body?.source || 'wecom-mac-bridge',
    });
    const shouldPlanReplies =
      boolQuery(body?.planReplies ?? body?.autoPlanReplies ?? body?.replyPlan ?? query?.planReplies ?? query?.autoPlanReplies);
    if (shouldPlanReplies && result.events.length > 0) {
      const planResult = await planWecomBridgeEventReplies(AUTOMATION_BRIDGE_USER, {
        eventIds: result.events.map((event) => event.id),
        overwrite: boolQuery(body?.overwriteReplyDrafts ?? body?.overwrite ?? query?.overwrite),
        approveRuleReplies: boolQuery(body?.approveRuleReplies ?? body?.approveKeywordRules ?? query?.approveRuleReplies),
        extraInstruction: body?.extraInstruction ?? query?.extraInstruction,
        limit: result.events.length,
      });
      result.events = planResult.results.map((item) => item.event);
      result.planned = planResult.planned;
      result.approved = planResult.approved;
      result.planSkipped = planResult.skipped;
      result.planErrors = planResult.errors;
    }
    appendPanelLog('INFO', `Bridge 收到企微消息事件：新增 ${result.imported}，更新 ${result.updated}，跳过 ${result.skipped}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 写入消息事件失败' });
  }
});

app.post(AUTOMATION_BRIDGE_HEARTBEAT_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const body = req.body as any;
    const pendingReplies = listApprovedWecomBridgeReplies(200, body).length;
    const pendingMassTasks = listApprovedWecomBridgeMassTasks(200, body).length;
    const pendingMomentTasks = listApprovedWecomBridgeMomentTasks(200, body).length;
    const worker = recordWecomBridgeHeartbeat(AUTOMATION_BRIDGE_USER, {
      ...body,
      pendingReplies,
      pendingMassTasks,
      pendingMomentTasks,
    });
    return { worker, pendingReplies, pendingMassTasks, pendingMomentTasks, serverTime: new Date().toISOString() };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 心跳写入失败' });
  }
});

app.post(AUTOMATION_BRIDGE_RUN_REPORT_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const report = recordWecomBridgeRunReport(AUTOMATION_BRIDGE_USER, {
      ...(req.body as any),
      source: (req.body as any)?.source || 'wecom-mac-bridge',
    });
    appendPanelLog(
      report.status === 'failed' ? 'WARN' : 'INFO',
      `Bridge runner 上报 ${report.target}/${report.mode}：worker=${report.workerId}，状态=${report.status}`,
    );
    return { report };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 运行报告写入失败' });
  }
});

app.get(AUTOMATION_BRIDGE_RUNNER_POLICY_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  const query = req.query as any;
  const policy = getWecomBridgeRunnerPolicy();
  const preflight = getAutomationPreflightReport();
  return {
    policy,
    preflight,
    workerId: String(query?.workerId || ''),
    env: {
      WECOM_RUNNER_MODE: policy.mode,
      WECOM_RUNNER_ENGINE: policy.runnerEngine,
      WECOM_RUNNER_TARGET: policy.target,
      WECOM_RUNNER_LIMIT: String(policy.limit),
      WECOM_CLAIM_TTL_SECONDS: String(policy.claimTtlSeconds),
      WECOM_BRIDGE_INTERVAL_SEC: String(policy.heartbeatIntervalSeconds),
      WECOM_MOMENT_PASTE_MODE: policy.momentPasteMode,
      WECOM_USE_RPA_PACKAGE: policy.runnerEngine === 'rpa-package' ? '1' : '0',
      WECOM_ALLOW_SEND: policy.allowSend ? '1' : '',
      WECOM_REQUIRE_TARGET_MATCH: policy.requireTargetMatch ? '1' : '0',
      WECOM_REQUIRE_HANDLER_VERIFICATION: policy.requireHandlerVerification ? '1' : '0',
    },
    serverTime: new Date().toISOString(),
  };
});

app.get(AUTOMATION_BRIDGE_REPLY_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  const query = req.query as any;
  const mode = String(query?.mode || '').trim().toLowerCase();
  const requireSendable = boolQuery(query?.requireSendable ?? query?.sendable ?? query?.requireAutoSend) || mode === 'send';
  return { replies: listApprovedWecomBridgeReplies(Number(query?.limit || 50), { ...query, requireSendable }) };
});

app.patch(`${AUTOMATION_BRIDGE_REPLY_ENDPOINT}/:eventId`, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const event = patchWecomBridgeReplyDelivery(AUTOMATION_BRIDGE_USER, (req.params as any).eventId, req.body as any);
    const state = event.replyDeliveredAt ? '已交付' : event.replyFailedAt ? '交付失败' : event.replyClaimedAt ? '已领取' : '已释放领取';
    appendPanelLog('INFO', `Bridge 标记企微回复${state}：「${event.conversationName || event.senderName}」`);
    return { event };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 更新回复状态失败' });
  }
});

app.get(AUTOMATION_BRIDGE_MASS_TASK_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  const query = req.query as any;
  return { tasks: listApprovedWecomBridgeMassTasks(Number(query?.limit || 50), query) };
});

app.patch(`${AUTOMATION_BRIDGE_MASS_TASK_ENDPOINT}/:taskId`, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const result = patchWecomBridgeMassTaskDelivery(AUTOMATION_BRIDGE_USER, (req.params as any).taskId, req.body as any);
    const state = result.item.status === 'sent' ? '已发送' : result.item.status === 'failed' ? '发送失败' : result.item.bridgeClaimedAt ? '已领取' : '已释放领取';
    appendPanelLog('INFO', `Bridge 标记群发任务${state}：「${result.item.recipientName}」`);
    return result;
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 更新群发任务失败' });
  }
});

app.get(AUTOMATION_BRIDGE_MOMENT_TASK_ENDPOINT, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  const query = req.query as any;
  return { tasks: listApprovedWecomBridgeMomentTasks(Number(query?.limit || 50), query) };
});

app.patch(`${AUTOMATION_BRIDGE_MOMENT_TASK_ENDPOINT}/:taskId`, async (req, reply) => {
  if (!requireAutomationBridge(req, reply)) return;
  try {
    const result = patchWecomBridgeMomentTaskDelivery(AUTOMATION_BRIDGE_USER, (req.params as any).taskId, req.body as any);
    const state =
      result.draft.status === 'published'
        ? '已发布'
        : result.draft.status === 'prepared'
          ? '已准备'
          : result.draft.bridgeFailedAt
            ? '准备失败'
            : result.draft.bridgeClaimedAt
              ? '已领取'
              : '已释放领取';
    appendPanelLog('INFO', `Bridge 标记朋友圈任务${state}：「${result.draft.title}」`);
    return result;
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || 'Bridge 更新朋友圈任务失败' });
  }
});

app.patch('/api/admin/automation/knowledge/:itemId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const item = patchAutomationKnowledge(admin, (req.params as any).itemId, req.body as any);
    appendPanelLog('INFO', `更新企微接入资料「${item.title}」by ${admin.username}`);
    return { item };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新接入资料失败' });
  }
});

app.delete('/api/admin/automation/knowledge/:itemId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    return deleteAutomationKnowledge(admin, (req.params as any).itemId);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '删除接入资料失败' });
  }
});

app.patch('/api/admin/automation/audience/:contactId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const contact = patchAutomationAudienceContact(admin, (req.params as any).contactId, req.body as any);
    appendPanelLog('INFO', `更新受众资产「${contact.name}」by ${admin.username}`);
    return { contact };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新受众资产失败' });
  }
});

app.delete('/api/admin/automation/audience/:contactId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    return deleteAutomationAudienceContact(admin, (req.params as any).contactId);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '删除受众资产失败' });
  }
});

app.patch('/api/admin/automation/materials/:assetId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const asset = patchAutomationMaterialAsset(admin, (req.params as any).assetId, req.body as any);
    appendPanelLog('INFO', `更新素材资产「${asset.key}」by ${admin.username}`);
    return { asset };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新素材资产失败' });
  }
});

app.delete('/api/admin/automation/materials/:assetId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    return deleteAutomationMaterialAsset(admin, (req.params as any).assetId);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '删除素材资产失败' });
  }
});

app.post('/api/admin/automation/simulate', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inboundText = String((req.body as any)?.inboundText || '');
  return { decision: simulateAutomation(inboundText) };
});

app.post('/api/admin/automation/reply-plan', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  try {
    return { plan: await planAutomationReply(req.body as any) };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '生成回复计划失败' });
  }
});

app.get('/api/admin/automation/audit', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { events: listAutomationAudit(Number((req.query as any)?.limit || 200)) };
});

app.post('/api/admin/automation/ai-draft', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  try {
    return await draftAutomationReply(req.body as any);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '生成 AI 草稿失败' });
  }
});

app.post('/api/admin/automation/moment-drafts/ai-draft', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  try {
    return await draftMomentContent(req.body as any);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '生成朋友圈文案失败' });
  }
});

app.post('/api/admin/automation/mass-jobs/ai-draft', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  try {
    return await draftMassSendContent(req.body as any);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '生成群发文案失败' });
  }
});

app.post('/api/admin/automation/campaign-kit/ai-draft', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  try {
    return await draftCampaignKit(req.body as any);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '生成活动套件失败' });
  }
});

app.get('/api/admin/automation/mass-jobs', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { jobs: listMassSendJobs(Number((req.query as any)?.limit || 100)) };
});

app.post('/api/admin/automation/mass-jobs', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const job = createMassSendJob(admin, req.body as any);
    appendPanelLog('INFO', `创建群发队列「${job.title}」by ${admin.username}：${job.items.length} 个目标`);
    return { job };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '创建群发队列失败' });
  }
});

app.post('/api/admin/automation/mass-jobs/from-audience', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const result = createMassSendJobFromAudience(admin, req.body as any);
    appendPanelLog(
      'INFO',
      `从受众资产创建群发队列「${result.job.title}」by ${admin.username}：${result.selection.selected}/${result.selection.matched} 个目标`,
    );
    return result;
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '从受众创建群发队列失败' });
  }
});

app.patch('/api/admin/automation/mass-jobs/:jobId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const job = patchMassSendJob(admin, (req.params as any).jobId, req.body as any);
    appendPanelLog('INFO', `更新群发队列「${job.title}」by ${admin.username}`);
    return { job };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新群发队列失败' });
  }
});

app.patch('/api/admin/automation/mass-jobs/:jobId/items/:itemId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const job = patchMassSendItem(admin, (req.params as any).jobId, (req.params as any).itemId, req.body as any);
    appendPanelLog('INFO', `更新群发队列「${job.title}」目标状态 by ${admin.username}`);
    return { job };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新群发目标失败' });
  }
});

app.get('/api/admin/automation/moment-drafts', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { drafts: listMomentDrafts(Number((req.query as any)?.limit || 100)) };
});

app.post('/api/admin/automation/moment-drafts', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const draft = createMomentDraft(admin, req.body as any);
    appendPanelLog('INFO', `创建朋友圈草稿「${draft.title}」by ${admin.username}`);
    return { draft };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '创建朋友圈草稿失败' });
  }
});

app.patch('/api/admin/automation/moment-drafts/:draftId', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  try {
    const draft = patchMomentDraft(admin, (req.params as any).draftId, req.body as any);
    appendPanelLog('INFO', `更新朋友圈草稿「${draft.title}」by ${admin.username}`);
    return { draft };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '更新朋友圈草稿失败' });
  }
});

app.post('/api/admin/instances/:id/automation/send-rule', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const event = await sendAutomationRule(inst, admin, req.body as any, {
      typeText: (text: string) => typeInInstance(inst, text),
      key: (key: string) => keyInInstance(inst, key),
    });
    appendInstanceLog(inst.id, `[automation] ${event.message} by ${admin.username}`);
    appendPanelLog('INFO', `自动化发送规则「${event.ruleName || event.ruleId}」到实例「${inst.name}」by ${admin.username}`);
    return { event };
  } catch (e: any) {
    appendPanelLog('WARN', `自动化规则发送被拦截：实例「${inst.name}」by ${admin.username}：${e?.message || e}`);
    return reply.code(400).send({ error: e?.message || '自动化发送失败' });
  }
});

app.post('/api/admin/instances/:id/automation/send-text', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const event = await sendAutomationText(inst, admin, req.body as any, {
      typeText: (text: string) => typeInInstance(inst, text),
      key: (key: string) => keyInInstance(inst, key),
    });
    appendInstanceLog(inst.id, `[automation] ${event.message} by ${admin.username}`);
    appendPanelLog('INFO', `自动化确认发送单条文本到实例「${inst.name}」by ${admin.username}`);
    return { event };
  } catch (e: any) {
    appendPanelLog('WARN', `自动化文本发送被拦截：实例「${inst.name}」by ${admin.username}：${e?.message || e}`);
    return reply.code(400).send({ error: e?.message || '自动化发送失败' });
  }
});

app.post('/api/admin/instances/:id/automation/read-clipboard', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const text = await readTextFromInstanceClipboard(inst, !!(req.body as any)?.copySelection);
    appendPanelLog('INFO', `自动化读取实例「${inst.name}」剪贴板 by ${admin.username}：${text.length} 字`);
    return { text };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '读取实例剪贴板失败' });
  }
});

app.post('/api/admin/instances/:id/automation/self-test', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const result = await automationSelfTestInInstance(inst);
    appendPanelLog('INFO', `实例「${inst.name}」自动化自检 by ${admin.username}：${result.ok ? '通过' : '未通过'}`);
    return { result };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '自动化自检失败' });
  }
});

app.post('/api/admin/instances/:id/automation/inspect', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const includeScreenshot = !!(req.body as any)?.includeScreenshot;
    const includeOcr = !!(req.body as any)?.includeOcr;
    const snapshot = await inspectAutomationInInstance(inst, { includeScreenshot, includeOcr });
    appendPanelLog(
      'INFO',
      `实例「${inst.name}」自动化视觉快照 by ${admin.username}：${snapshot.ok ? '成功' : '未就绪'}${snapshot.screenshot ? '，含截图' : ''}${snapshot.ocr ? '，含 OCR' : ''}`,
    );
    return { snapshot };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '读取实例视觉快照失败' });
  }
});

app.post('/api/admin/instances/:id/automation/verify-target', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const result = await verifyAutomationTargetInInstance(inst, req.body as any);
    appendPanelLog(
      result.verification.verified ? 'INFO' : 'WARN',
      `实例「${inst.name}」目标会话校验 by ${admin.username}：${result.verification.expectedName}，置信度=${result.verification.confidence}，${result.verification.verified ? '通过' : '未通过'}`,
    );
    return result;
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '目标会话校验失败' });
  }
});

app.post('/api/admin/instances/:id/automation/mass-jobs/:jobId/send-next', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const { id, jobId } = req.params as any;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const result = await sendNextMassSendItem(inst, admin, jobId, req.body as any, {
      typeText: (text: string) => typeInInstance(inst, text),
      key: (key: string) => keyInInstance(inst, key),
      openConversation: (recipientName, options) => openConversationInInstance(inst, recipientName, options),
    });
    appendInstanceLog(inst.id, `[automation] ${result.event.message} by ${admin.username}`);
    appendPanelLog('INFO', `群发队列「${result.job.title}」发送下一条到实例「${inst.name}」by ${admin.username}`);
    return result;
  } catch (e: any) {
    appendPanelLog('WARN', `群发队列发送被拦截：实例「${inst.name}」by ${admin.username}：${e?.message || e}`);
    return reply.code(400).send({ error: e?.message || '群发队列发送失败' });
  }
});

app.post('/api/admin/instances/:id/automation/moment-drafts/:draftId/prepare', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const { id, draftId } = req.params as any;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const result = await prepareMomentDraft(inst, admin, draftId, req.body as any, {
      typeText: (text: string) => typeInInstance(inst, text),
      key: (key: string) => keyInInstance(inst, key),
      copyText: (text: string) => copyTextToInstanceClipboard(inst, text),
    });
    appendInstanceLog(inst.id, `[automation] ${result.event.message} by ${admin.username}`);
    appendPanelLog('INFO', `朋友圈草稿「${result.draft.title}」填入实例「${inst.name}」by ${admin.username}`);
    return result;
  } catch (e: any) {
    appendPanelLog('WARN', `朋友圈草稿填入被拦截：实例「${inst.name}」by ${admin.username}：${e?.message || e}`);
    return reply.code(400).send({ error: e?.message || '朋友圈草稿填入失败' });
  }
});

// ---------- 自助改密 ----------
app.post('/api/account/password', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const { oldPassword, newPassword } = (req.body as any) ?? {};
  if (!verifyPassword(u, oldPassword ?? '')) return reply.code(400).send({ error: '原密码错误' });
  if (!newPassword || String(newPassword).length < 6) return reply.code(400).send({ error: '新密码至少 6 位' });
  resetPassword(u.id, newPassword);
  return { ok: true };
});

// ---------- 管理员：子账号管理 ----------
app.get('/api/admin/users', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { users: listUsers() };
});

app.post('/api/admin/users', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { username, password } = (req.body as any) ?? {};
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return reply.code(400).send({ error: '用户名为 3-20 位字母、数字或下划线' });
  }
  if (!password || String(password).length < 6) return reply.code(400).send({ error: '密码至少 6 位' });
  const allowedInstances = Array.isArray((req.body as any)?.allowedInstances) ? (req.body as any).allowedInstances : [];
  try {
    return { user: createSub(username, password, allowedInstances) };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

// 账户侧：设置某账户可访问的实例
app.post('/api/admin/users/:id/instances', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const id = (req.params as any).id;
  const instanceIds = Array.isArray((req.body as any)?.instanceIds) ? (req.body as any).instanceIds : [];
  try {
    return { user: setUserInstances(id, instanceIds) };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

app.post('/api/admin/users/:id/disable', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { disabled } = (req.body as any) ?? {};
  const id = (req.params as any).id;
  try {
    const user = setDisabled(id, !!disabled);
    if (disabled) destroyUserSessions(id);
    return { user };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

app.post('/api/admin/users/:id/reset', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { newPassword } = (req.body as any) ?? {};
  const id = (req.params as any).id;
  if (!newPassword || String(newPassword).length < 6) return reply.code(400).send({ error: '密码至少 6 位' });
  try {
    const user = resetPassword(id, newPassword);
    destroyUserSessions(id);
    return { user };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

app.delete('/api/admin/users/:id', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const id = (req.params as any).id;
  try {
    deleteUser(id);
    destroyUserSessions(id);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

// ---------- 微信实例管理 ----------
// 列出当前用户可见实例（含运行态 + 微信安装状态）
app.get('/api/instances', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const visible = userInstances(u);
  const out = await Promise.all(
    visible.map(async (pub) => {
      const inst = findInstance(pub.id)!;
      const [runtime, wx] = await Promise.all([instanceRuntime(inst), wechatStatus(inst)]);
      return { ...pub, runtime, wechat: wx };
    }),
  );
  return { instances: out };
});

// 用户自助「卡死自愈」：当客户端检测到 VNC 多次干净重连仍连不上（多半是实例 KasmVNC 的 ws 接收器卡死——
// nginx 仍能serve 静态页让 noVNC 显示"正在连接"，但新 ws 永远 accept 不了，刷新/重启面板都无效、只能重启容器），
// 客户端调用本接口重启该实例（数据卷保留，约十几秒恢复）。需对该实例有访问权；每实例 3 分钟限一次防重启风暴。
const lastHealAt = new Map<string, number>();
app.post('/api/instances/:id/heal', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  const now = Date.now();
  if (now - (lastHealAt.get(id) || 0) < 180000) {
    return { ok: true, restarted: false, message: '近期已尝试恢复，请稍候重连' };
  }
  lastHealAt.set(id, now);
  appendPanelLog('WARN', `实例「${inst.name}」(id=${id}) 由 ${u.username} 触发卡死自愈（VNC 连不上 → 重启容器，数据保留）`);
  try {
    await runInstance(inst);
    return { ok: true, restarted: true };
  } catch (e: any) {
    appendPanelLog('ERROR', `实例「${inst.name}」(id=${id}) 卡死自愈重启失败：${e?.message || e}`);
    return reply.code(500).send({ error: '恢复失败：' + (e?.message || e) });
  }
});

// 客户端连接日志：前端把 VNC 连接态/动作回传，记进实例持久日志（[client] 前缀），与 [vnc] 服务端日志对齐排查。
app.post('/api/instances/:id/clientlog', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const msg = String((req.body as any)?.msg ?? '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 200);
  if (msg) appendInstanceLog(id, `[client] ${msg}（${u.username}）`);
  return { ok: true };
});

// 新建实例（仅管理员）：生成凭据 + docker run + 分配访问账户
app.post('/api/admin/instances', async (req, reply) => {
  const admin = requireAdmin(req, reply);
  if (!admin) return;
  const { name, reuseVolume, appType } = (req.body as any) ?? {};
  const allowedUserIds = Array.isArray((req.body as any)?.allowedUserIds) ? (req.body as any).allowedUserIds : [];
  if (!name || String(name).trim().length === 0 || String(name).length > 30) {
    return reply.code(400).send({ error: '实例名称为 1-30 个字符' });
  }
  const type: AppType = APP_TYPES.includes(appType) ? appType : 'wechat';
  // 复用卷：必须以 woc-data- 开头，且不能被现存实例占用。后端先校验，避免坏名穿透到 docker run。
  let reuseVolumeName: string | undefined;
  if (reuseVolume) {
    if (typeof reuseVolume !== 'string' || !/^woc-data-[0-9a-zA-Z._-]{1,64}$/.test(reuseVolume)) {
      return reply.code(400).send({ error: '复用卷名不合法' });
    }
    if (listInstances().some((i) => i.volumeName === reuseVolume)) {
      return reply.code(409).send({ error: '该数据卷已被另一个实例占用' });
    }
    reuseVolumeName = reuseVolume;
  }
  const inst = createInstance(String(name), admin.id, allowedUserIds, reuseVolumeName, type);
  appendPanelLog(
    'INFO',
    `创建实例「${inst.name}」(${type}, id=${inst.id}) by ${admin.username}${reuseVolumeName ? ` · 复用卷 ${reuseVolumeName}` : ''} → 开始创建容器（镜像缺失会自动拉取，首次较慢）`,
  );
  appendInstanceLog(inst.id, `实例创建（${type}）by ${admin.username}`);
  try {
    await runInstance(inst);
  } catch (e: any) {
    removeInstanceRecord(inst.id); // 容器起不来则回滚登记
    appendPanelLog('ERROR', `创建实例「${inst.name}」(id=${inst.id}) 失败：${e?.message || e}`);
    return reply.code(500).send({ error: '创建容器失败：' + (e?.message || e) });
  }
  appendPanelLog('INFO', `创建实例「${inst.name}」(id=${inst.id}) 成功`);
  return { instance: publicInstance(inst) };
});

// 列出"未被任何实例引用的 woc-data-* 数据卷"。删除实例时默认保留卷（聊天记录），但 panel 里
// 看不到这些孤儿卷；本接口让管理员在新建实例时复用旧卷（同微信号扫码可继承聊天记录），
// 或在不需要时彻底删除。
app.get('/api/admin/orphan-volumes', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const referenced = new Set(listInstances().map((i) => i.volumeName));
  try {
    const volumes = await listOrphanVolumes(referenced);
    return { volumes };
  } catch (e: any) {
    return reply.code(500).send({ error: e?.message || '读取数据卷失败' });
  }
});

// 列出"残留的 woc-wx-* 容器"：docker 里存在但 store 没登记。多为 runInstance 启动失败遗留
// 的 Created 容器，会占着 woc-data-<id> 卷名让删卷报 409。提供给管理员一键清理。
app.get('/api/admin/orphan-containers', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const known = new Set(listInstances().map((i) => i.containerName));
  try {
    const containers = await listOrphanContainers(known);
    return { containers };
  } catch (e: any) {
    return reply.code(500).send({ error: e?.message || '读取容器失败' });
  }
});

// 强制删除一个残留容器。仅当它不在 store 的已知容器集中（防误删正在用的实例）。
app.delete('/api/admin/orphan-containers/:idOrName', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const idOrName = (req.params as any).idOrName;
  if (!idOrName || typeof idOrName !== 'string') return reply.code(400).send({ error: '参数不合法' });
  if (listInstances().some((i) => i.containerName === idOrName)) {
    return reply.code(409).send({ error: '该容器属于现存实例，不能在此删除' });
  }
  try {
    await removeContainerById(idOrName);
    return { ok: true };
  } catch (e: any) {
    return reply.code(500).send({ error: e?.message || '删除容器失败' });
  }
});

// 显式删除一个未使用的数据卷。被现存实例占用时拒绝（避免误删聊天记录）。
app.delete('/api/admin/orphan-volumes/:name', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const name = (req.params as any).name;
  if (!name || typeof name !== 'string' || !name.startsWith('woc-data-')) {
    return reply.code(400).send({ error: '卷名不合法' });
  }
  if (listInstances().some((i) => i.volumeName === name)) {
    return reply.code(409).send({ error: '该数据卷正被某个实例使用，不能删除' });
  }
  try {
    await removeVolume(name);
    return { ok: true };
  } catch (e: any) {
    return reply.code(500).send({ error: e?.message || '删除数据卷失败' });
  }
});

// 查/改单实例的内存安全阀（soft / hard）。前端"实例卡片 → 安全"弹窗用。
// GET 返回 per-instance 当前覆盖值 + 全局默认 + 实时内存（用于弹窗里展示）。
// PUT 接受 {soft, hard}，每项可为正整数 / null（null = 恢复默认）。
app.get('/api/admin/instances/:id/mem-limits', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  let currentMB = 0;
  try {
    if ((await instanceRuntime(inst)) === 'running') currentMB = await instanceMemoryMB(inst);
  } catch {
    /* ignore：未运行时为 0 */
  }
  return {
    soft: inst.memSoftLimitMB ?? null,
    hard: inst.memHardLimitMB ?? null,
    defaultSoft: DEFAULT_SOFT_MB,
    defaultHard: DEFAULT_HARD_MB,
    currentMB,
    watchdogEnabled: WATCHDOG_ENABLED,
    intervalSec: WATCHDOG_INTERVAL_SEC,
  };
});
app.put('/api/admin/instances/:id/mem-limits', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  const body = (req.body as any) ?? {};
  // 允许 number / null；其它类型都视为"未提供"（保持原值）
  const norm = (v: any): number | null | undefined =>
    v === null ? null : typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined;
  const s = norm(body.soft);
  const h = norm(body.hard);
  // 取最终生效值（写入前校验）
  const finalSoft = s === undefined ? inst.memSoftLimitMB ?? null : s;
  const finalHard = h === undefined ? inst.memHardLimitMB ?? null : h;
  try {
    const pub = setInstanceMemLimits(
      id,
      finalSoft,
      finalHard,
    );
    return { instance: pub };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '阈值不合法' });
  }
});

// 重置实例的设备 machine-id（仅管理员）：滚一个全新的唯一设备身份并重启实例。
// 用于某微信账号被腾讯按"设备风险"标记、登录即被踢时，像"换台新设备"一样恢复。会触发重新扫码登录。
app.post('/api/admin/instances/:id/regen-machine-id', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const id = (req.params as any).id;
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    await regenInstanceMachineId(inst);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '重置设备 ID 失败' });
  }
});

// 删除实例（仅管理员）：默认保留数据卷，?purge=1 才永久删聊天记录
app.delete('/api/admin/instances/:id', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const id = (req.params as any).id;
  const purge = (req.query as any)?.purge === '1' || (req.query as any)?.purge === 'true';
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  appendPanelLog('INFO', `删除实例「${inst.name}」(id=${id})${purge ? ' · 同时清除数据卷' : ' · 保留数据卷'}`);
  await removeInstanceContainer(inst, purge);
  removeInstanceRecord(id);
  controlHolders.delete(id);
  return { ok: true };
});

// 重命名实例（仅管理员）：只改显示名，不动容器/卷。
app.post('/api/admin/instances/:id/rename', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { name } = (req.body as any) ?? {};
  try {
    return { instance: renameInstance((req.params as any).id, String(name ?? '')) };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

// 设置实例自定义图标（仅管理员）：icon = builtin:<key> / data:image 图片 / 空串(恢复默认)。
app.post('/api/admin/instances/:id/icon', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { icon } = (req.body as any) ?? {};
  try {
    return { instance: setInstanceIcon((req.params as any).id, typeof icon === 'string' ? icon : null) };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '设置图标失败' });
  }
});

// 启动实例容器（仅管理员）：容器停止或被删后，一键拉起（不重建数据卷）。
app.post('/api/admin/instances/:id/start', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    await ensureRunning(inst);
    appendPanelLog('INFO', `启动实例「${inst.name}」(id=${inst.id})`);
    return { ok: true };
  } catch (e: any) {
    appendPanelLog('ERROR', `启动实例「${inst.name}」(id=${inst.id}) 失败：${e?.message || e}`);
    return reply.code(500).send({ error: '启动失败：' + (e?.message || e) });
  }
});

// 停止实例容器（仅管理员）：保留容器与数据卷。
app.post('/api/admin/instances/:id/stop', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    await stopInstance(inst);
    appendPanelLog('INFO', `停止实例「${inst.name}」(id=${inst.id})`);
    return { ok: true };
  } catch (e: any) {
    appendPanelLog('ERROR', `停止实例「${inst.name}」(id=${inst.id}) 失败：${e?.message || e}`);
    return reply.code(500).send({ error: '停止失败：' + (e?.message || e) });
  }
});

// 重启实例容器（仅管理员）：按当前本地镜像重建（保留数据卷 → 登录态不丢；快速，不联网拉取）。
app.post('/api/admin/instances/:id/restart', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    appendPanelLog('INFO', `重启实例「${inst.name}」(id=${inst.id})`);
    await runInstance(inst);
    return { ok: true };
  } catch (e: any) {
    appendPanelLog('ERROR', `重启实例「${inst.name}」(id=${inst.id}) 失败：${e?.message || e}`);
    return reply.code(500).send({ error: '重启失败：' + (e?.message || e) });
  }
});

// 升级实例（仅管理员）：拉取最新微信镜像后重建（保留数据卷）。用于把旧实例更新到新版镜像
// （如修复"最小化丢失"等），类似「更新微信」但更新的是实例容器镜像本身。
app.post('/api/admin/instances/:id/upgrade', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    appendPanelLog('INFO', `升级实例「${inst.name}」(id=${inst.id})：拉取最新镜像后重建`);
    await upgradeInstance(inst);
    appendPanelLog('INFO', `升级实例「${inst.name}」(id=${inst.id}) 完成`);
    return { ok: true };
  } catch (e: any) {
    appendPanelLog('ERROR', `升级实例「${inst.name}」(id=${inst.id}) 失败：${e?.message || e}`);
    return reply.code(500).send({ error: '升级失败：' + (e?.message || e) });
  }
});

// 实例侧：设置该实例可被哪些账户访问
app.post('/api/admin/instances/:id/users', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const id = (req.params as any).id;
  const userIds = Array.isArray((req.body as any)?.userIds) ? (req.body as any).userIds : [];
  try {
    setInstanceUsers(id, userIds);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

// ---------- 文件中转（有访问权限即可用；走面板鉴权，不额外暴露） ----------
// 上传：原始二进制直传，落到实例 ~/Desktop，微信文件选择器可直接选到。
app.post('/api/instances/:id/upload', { bodyLimit: 512 * 1024 * 1024 }, async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const name = String((req.query as any)?.name || '').trim();
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: '空文件或格式错误' });
  try {
    await uploadToInstance(findInstance(id)!, name, body);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '上传失败' });
  }
});

// 列出可下载的中转文件
app.get('/api/instances/:id/files', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  try {
    return { files: await listInstanceFiles(findInstance(id)!) };
  } catch {
    return { files: [] };
  }
});

// 删除某个中转文件（有访问权限即可）
app.delete('/api/instances/:id/files', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const name = String((req.query as any)?.name || '').trim();
  try {
    await deleteInstanceFile(findInstance(id)!, name);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '删除失败' });
  }
});

// 下载某个中转文件
app.get('/api/instances/:id/download', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const name = String((req.query as any)?.name || '').trim();
  try {
    const buf = await downloadFromInstance(findInstance(id)!, name);
    reply.header('content-type', 'application/octet-stream');
    reply.header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    return reply.send(buf);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '下载失败' });
  }
});

// ---------- 多端协作：操作控制权（心跳软锁，避免多人同时操作打架） ----------
// 同一实例被多个浏览器连的是同一会话，键鼠会互相打架。这里用"心跳持锁"：
// 当前操作者每隔几秒 beat 续约；TTL 内他人只读（前端盖只读遮罩）。空闲超 TTL 自动释放。
const CONTROL_TTL = 10_000; // ms：超过则视为已空闲，可被接管
const controlHolders = new Map<string, { userId: string; username: string; at: number }>();

// 续约/认领：无人持有、已超时、或本来就是我 → 我成为操作者；否则返回当前操作者。
app.post('/api/instances/:id/control/beat', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const now = Date.now();
  const h = controlHolders.get(id);
  if (!h || now - h.at > CONTROL_TTL || h.userId === u.id) {
    controlHolders.set(id, { userId: u.id, username: u.username, at: now });
    return { mine: true, holder: u.username };
  }
  return { mine: false, holder: h.username };
});

// 只读查询当前操作者（前端轮询；不认领）。超 TTL 视为空闲。
app.get('/api/instances/:id/control', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const h = controlHolders.get(id);
  if (!h || Date.now() - h.at > CONTROL_TTL) return { free: true, mine: false, holder: null };
  return { free: false, mine: h.userId === u.id, holder: h.username };
});

// 主动接管（"申请控制"）：强制把操作权抢过来。
app.post('/api/instances/:id/control/take', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  controlHolders.set(id, { userId: u.id, username: u.username, at: Date.now() });
  return { mine: true, holder: u.username };
});

// 通过 xdotool 在实例容器内输入文字（绕过 VNC XKB keysym 容量限制，修复中文 IME 吞字）
app.post('/api/instances/:id/type', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const { text } = (req.body as any) ?? {};
  if (!text || typeof text !== 'string' || text.length > 500) return reply.code(400).send({ error: '文字为空或过长' });
  try {
    await typeInInstance(findInstance(id)!, text);
    return { ok: true };
  } catch (e: any) {
    return reply.code(500).send({ error: e?.message || '输入失败' });
  }
});

// 模拟单个按键（无感输入模式下按序送出被截下的回车/退格，保证与中文转发的顺序）
app.post('/api/instances/:id/key', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  const { key } = (req.body as any) ?? {};
  if (!key || typeof key !== 'string') return reply.code(400).send({ error: '按键名为空' });
  try {
    await keyInInstance(findInstance(id)!, key);
    return { ok: true };
  } catch (e: any) {
    return reply.code(500).send({ error: e?.message || '按键失败' });
  }
});

// 查看实例容器日志（仅管理员）：排查"无法进入/未安装/卡死"等。inline 文本，浏览器可直接看/另存。
app.get('/api/admin/instances/:id/logs', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  reply.header('content-type', 'text/plain; charset=utf-8');
  // 持久化历史（重启原因 + 上一容器日志快照，跨重建保留）+ 本次容器实时日志。
  const history = readInstanceLog(inst.id).trimEnd();
  let live = '';
  try {
    live = (await instanceLogs(inst)).trimEnd();
  } catch (e: any) {
    live = '获取本次容器日志失败：' + (e?.message || e);
  }
  if (!history && !live) return reply.send('（暂无日志）');
  if (!history) return reply.send(live);
  return reply.send(
    `═══ 历史日志（持久化 · 跨重启保留）═══\n${history}\n\n═══ 本次容器日志（实时）═══\n${live || '（本次容器暂无日志）'}`,
  );
});

// ---------- 全局日志 / 诊断包（仅管理员）----------
// 面板全局运维日志（创建/删除/升级/启停/镜像拉取/错误等跨实例事件），可按时间范围裁剪。
app.get('/api/admin/panel-log', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  reply.header('content-type', 'text/plain; charset=utf-8');
  const since = Date.now() - rangeToMs((req.query as any)?.range);
  const text = filterSince(readPanelLog(), since).trimEnd();
  return reply.send(text || '（暂无面板日志）');
});

// 一键导出诊断包（tar.gz）：系统信息 + 面板日志 + 各实例容器状态/持久日志/实时日志 + 全部容器清单。
// 单实例日志只记录"实例内单次日志"，这里把全局 + 全部实例 + 容器层面的信息打包，便于排查
// 首个实例创建卡死 / 打开实例黑屏不可用 / 升级失败等问题。range：24h（默认）/7d/30d/1y。
app.get('/api/admin/diagnostics', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const range = ((req.query as any)?.range as string) || '24h';
  if (!DIAG_RANGES[range]) return reply.code(400).send({ error: '时间范围非法（24h/7d/30d/1y）' });
  const since = Date.now() - rangeToMs(range);
  try {
    const buf = await buildDiagnostics(listInstances(), since, { range, 面板版本: CURRENT_VERSION });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    reply.header('content-type', 'application/gzip');
    reply.header('content-disposition', `attachment; filename="woc-diag-${range}-${stamp}.tar.gz"`);
    appendPanelLog('INFO', `导出诊断包（范围 ${range}，${buf.length} 字节）`);
    return reply.send(buf);
  } catch (e: any) {
    appendPanelLog('ERROR', `导出诊断包失败：${e?.message || e}`);
    return reply.code(500).send({ error: '生成诊断包失败：' + (e?.message || e) });
  }
});

// ---------- 数据卷管理（仅管理员）：浏览/上传/解压/下载/改名/移动/删除 + 整卷备份/恢复 ----------
// 数据卷 = 容器 /config，含微信完整会话与加密聊天库 → 仅 admin 可见可用（admin 本就有 docker.sock=宿主 root，
// 不新增风险；子账号永不可达）。
// 全程在「运行中」的实例上操作：浏览/改名/移动/删除靠 docker exec（需容器运行），上传/解压/下载/备份靠
// getArchive/putArchive。不强制停止实例（exec 在停止容器无法运行）。整卷恢复会覆盖全部数据，前端强提示
// 并建议恢复后重启实例以加载数据。

// 浏览目录（一层）
app.get('/api/admin/instances/:id/volume', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    return await listVolume(inst, String((req.query as any)?.path || ''));
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '读取目录失败' });
  }
});

// 新建文件夹
app.post('/api/admin/instances/:id/volume/mkdir', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    await volMkdir(inst, String((req.body as any)?.path || ''));
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '新建失败' });
  }
});

// 重命名 / 移动
app.post('/api/admin/instances/:id/volume/move', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  const { from, to } = (req.body as any) ?? {};
  try {
    await volMove(inst, String(from || ''), String(to || ''));
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '移动失败' });
  }
});

// 删除文件 / 目录
app.delete('/api/admin/instances/:id/volume', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    await volDelete(inst, String((req.query as any)?.path || ''));
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '删除失败' });
  }
});

// 下载单个文件
app.get('/api/admin/instances/:id/volume/download', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  const path = String((req.query as any)?.path || '');
  const name = path.split('/').filter(Boolean).pop() || 'file';
  try {
    const buf = await volDownloadFile(inst, path);
    reply.header('content-type', 'application/octet-stream');
    reply.header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    return reply.send(buf);
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '下载失败' });
  }
});

// 上传单个文件到当前目录（原始二进制；落地为 abc 属主）
app.post('/api/admin/instances/:id/volume/upload', { bodyLimit: 2 * 1024 * 1024 * 1024 }, async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  const path = String((req.query as any)?.path || '');
  const name = String((req.query as any)?.name || '').trim();
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: '空文件或格式错误' });
  try {
    await volUploadFile(inst, path, name, body);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '上传失败' });
  }
});

// 上传压缩包并解压到当前目录（.tar / .tar.gz；PC 微信数据迁移用）
app.post('/api/admin/instances/:id/volume/extract', { bodyLimit: 3 * 1024 * 1024 * 1024 }, async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: '空文件或格式错误' });
  try {
    await volExtractArchive(inst, String((req.query as any)?.path || ''), body);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '解压失败（请确认是 .tar 或 .tar.gz）' });
  }
});

// 整卷备份：流式下载 /config 为 .tar.gz
app.get('/api/admin/instances/:id/volume/backup', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    const stream = await volBackupStream(inst);
    reply.header('content-type', 'application/gzip');
    reply.header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`woc-${inst.name}-backup.tar.gz`)}`);
    return reply.send(stream);
  } catch (e: any) {
    return reply.code(500).send({ error: e?.message || '备份失败' });
  }
});

// 整卷恢复：上传本系统导出的 .tar.gz 备份（要求实例已停止）
app.post('/api/admin/instances/:id/volume/restore', { bodyLimit: 3 * 1024 * 1024 * 1024 }, async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const inst = findInstance((req.params as any).id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: '空文件或格式错误' });
  try {
    await volRestoreArchive(inst, body);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e?.message || '恢复失败' });
  }
});

// 该实例的微信安装状态（有访问权限即可看）
app.get('/api/instances/:id/wechat/status', async (req, reply) => {
  const u = requireAuth(req, reply);
  if (!u) return;
  const id = (req.params as any).id;
  if (!userCanAccess(u, id)) return reply.code(403).send({ error: '无权访问该实例' });
  return { status: await wechatStatus(findInstance(id)!) };
});

// 触发该实例微信下载/更新（仅管理员）
async function triggerInstanceWechat(id: string, cmd: 'install' | 'update', reply: FastifyReply) {
  const inst = findInstance(id);
  if (!inst) return reply.code(404).send({ error: '实例不存在' });
  try {
    await triggerWechat(inst, cmd);
    appendPanelLog('INFO', `实例「${inst.name}」(id=${id}) 触发${cmd === 'install' ? '下载安装' : '更新'}应用`);
    return { ok: true };
  } catch (e: any) {
    appendPanelLog('ERROR', `实例「${inst.name}」(id=${id}) 触发${cmd === 'install' ? '安装' : '更新'}失败：${e?.message || e}`);
    return reply.code(500).send({ error: '无法触发安装：' + (e?.message || e) });
  }
}

app.post('/api/admin/instances/:id/wechat/install', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return triggerInstanceWechat((req.params as any).id, 'install', reply);
});

app.post('/api/admin/instances/:id/wechat/update', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return triggerInstanceWechat((req.params as any).id, 'update', reply);
});

// ---------- 反向代理到内网 KasmVNC（按实例注入 Basic auth，会话 + 权限把守） ----------
// 单个 proxy 实例，target 与凭据逐请求指定：凭据暂存在 req 上，proxyReq 时注入。
const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true });
proxy.on('proxyReq', (proxyReq, req) => {
  const auth = (req as any)._wocAuth;
  if (auth) proxyReq.setHeader('authorization', auth);
});
proxy.on('proxyReqWs', (proxyReq, req) => {
  const auth = (req as any)._wocAuth;
  if (auth) proxyReq.setHeader('authorization', auth);
  // 上游（实例 nginx → KasmVNC websockify）回 101 = ws 接收器接受了连接，桌面真正连上。
  // 卡死时这条不会出现（接收器停止 accept），即可定位"卡在面板→实例之间还是实例内部"。
  const instId = (req as any)._wocInstId;
  if (instId) proxyReq.on('upgrade', () => appendInstanceLog(instId, '[vnc] 上游已接受(101) · 桌面连接建立'));
});
// 兜底：剥掉 KasmVNC 401 的 WWW-Authenticate 头，避免浏览器弹出原生 Basic Auth 登录框。
// 正常路径下我们已注入正确凭据（不会 401）；万一凭据失配，宁可桌面加载失败也绝不把登录弹窗暴露给用户。
proxy.on('proxyRes', (proxyRes) => {
  delete proxyRes.headers['www-authenticate'];
});
proxy.on('error', (_err, _req, res) => {
  try {
    const r = res as any;
    if (r && typeof r.writeHead === 'function') {
      r.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      r.end('桌面服务暂时不可用');
    } else if (r && typeof r.destroy === 'function') {
      r.destroy();
    }
  } catch {
    /* ignore */
  }
});

// /desktop/:id/rest → rest（剥掉前缀与实例段）。返回 null 表示 url 非法。
function parseDesktopUrl(rawUrl: string): { id: string; rest: string } | null {
  const m = rawUrl.match(/^\/desktop\/([0-9a-f]{6,})(\/.*|\?.*|)?$/);
  if (!m) return null;
  const id = m[1];
  let rest = m[2] || '/';
  if (rest.startsWith('?')) rest = '/' + rest;
  if (rest === '') rest = '/';
  return { id, rest };
}

const desktopHandler = (req: FastifyRequest, reply: FastifyReply) => {
  const u = currentUser(req);
  if (!u) {
    reply.code(302).header('location', '/login').send();
    return;
  }
  const parsed = parseDesktopUrl(req.raw.url || '');
  if (!parsed || !userCanAccess(u, parsed.id)) {
    reply.code(403).send({ error: '无权访问该实例' });
    return;
  }
  const inst = findInstance(parsed.id)!;
  reply.hijack();
  req.raw.url = parsed.rest;
  (req.raw as any)._wocAuth = basicAuth(inst);
  proxy.web(req.raw, reply.raw, { target: instanceTarget(inst) });
};

app.all('/desktop/:id', desktopHandler);
app.all('/desktop/:id/*', desktopHandler);

// ---------- 静态 SPA + 前端路由回退 ----------
await app.register(fstatic, { root: STATIC_DIR, wildcard: false, index: ['index.html'] });
app.setNotFoundHandler((req, reply) => {
  const url = req.raw.url || '';
  if (url.startsWith('/api') || url.startsWith('/desktop')) {
    return reply.code(404).send({ error: 'not found' });
  }
  return reply.sendFile('index.html');
});

// ---------- 启动 + WebSocket 升级（同样校验会话） ----------
function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

await app.ready();

app.server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
  // DNS-rebinding gate for WebSocket upgrades (Fastify's onRequest hook does
  // not run on raw upgrades). KasmVNC proxying goes through this path.
  if (!isRequestHostAllowed(req.headers.host, req.headers['x-forwarded-host'], ALLOWED_HOSTS)) {
    socket.destroy();
    return;
  }
  const parsed = req.url ? parseDesktopUrl(req.url) : null;
  if (!parsed) {
    socket.destroy();
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const s = getSession(cookies[COOKIE]);
  const u = s && findById(s.userId);
  if (!u || u.disabled || !userCanAccess(u, parsed.id)) {
    socket.destroy();
    return;
  }
  const inst = findInstance(parsed.id)!;
  req.url = parsed.rest;
  (req as any)._wocAuth = basicAuth(inst);
  (req as any)._wocInstId = inst.id;
  // 远程桌面连接日志：记录每次 ws 连接尝试 / 上游接受(在 proxyReqWs 里) / 失败 / 关闭时长。
  // 与实例容器内 KasmVNC 的 "got client connection" 按时间对齐，即可看出卡在哪一段。
  const ip = (req.socket && req.socket.remoteAddress) || '?';
  const uname = (u as any).username || '?';
  appendInstanceLog(inst.id, `[vnc] 连接尝试 user=${uname} ip=${ip}`);
  const t0 = Date.now();
  socket.on('close', () => appendInstanceLog(inst.id, `[vnc] 连接关闭（持续 ${Math.round((Date.now() - t0) / 1000)}s）`));
  proxy.ws(req, socket, head, { target: instanceTarget(inst) }, (err: any) => {
    appendInstanceLog(inst.id, `[vnc] 连接失败：${err?.message || err}`);
  });
});

// 探测面板网络 + 重启后把已登记实例的容器拉起来
await ensureNetwork().catch(() => {});
for (const pub of listInstances()) {
  try {
    await ensureRunning(findInstance(pub.id)!);
  } catch (e: any) {
    app.log.warn(`[instance] 启动实例 ${pub.id} 失败: ${e?.message || e}`);
  }
}

// Watchdog：KasmVNC/Xvnc 长跑会泄漏（实测 24h 可达 ~9 GiB），小内存机器会被拖垮。
// 两档阈值，按"是否有人在用"决定时机：
//   soft：mem >= soft 且当前无活跃会话 → 主动重启（柔和自愈，不打扰）
//   hard：mem >= hard → 无视会话强制重启（防止 OOM）
// 优先级 hard > soft。两档阈值可在面板"管理 → 实例卡片 → 安全"按钮里单实例覆盖；缺省走 env。
//
// env 默认（可被 per-instance 覆盖）：
//   WOC_INSTANCE_MEM_SOFT_MB    soft 阈值；默认 1500
//   WOC_INSTANCE_MEM_HARD_MB    hard 阈值；默认 2500（也兼容旧名 WOC_INSTANCE_MEM_LIMIT_MB）
//   WOC_WATCHDOG_INTERVAL_SEC   巡检间隔秒；默认 300（5 分钟），最小 60；0 关闭整个 watchdog
//   WOC_WATCHDOG_HEALTH_FAILS   VNC 响应性探测：连续无响应几次才重启；默认 0=关闭该探测（仅保留内存自愈）
const DEFAULT_SOFT_MB = Math.max(0, Number(process.env.WOC_INSTANCE_MEM_SOFT_MB ?? 1500));
const DEFAULT_HARD_MB = Math.max(
  0,
  Number(process.env.WOC_INSTANCE_MEM_HARD_MB ?? process.env.WOC_INSTANCE_MEM_LIMIT_MB ?? 2500),
);
const WATCHDOG_INTERVAL_SEC = Math.max(60, Number(process.env.WOC_WATCHDOG_INTERVAL_SEC ?? 300));
// VNC 响应性探测默认关闭（=0）。实测健康实例 ~1ms 响应，但偶发宿主级 CPU/IO 争用（如同机重 docker build）
// 会让探测超时被误判为 stall 而重启正常实例，故默认不启用；需要时设为正整数 N（连续 N 次无响应才重启）开启。
const HEALTH_FAIL_LIMIT = Math.max(0, Number(process.env.WOC_WATCHDOG_HEALTH_FAILS ?? 0));
const WATCHDOG_ENABLED = WATCHDOG_INTERVAL_SEC > 0 && (DEFAULT_SOFT_MB > 0 || DEFAULT_HARD_MB > 0);

// 单实例生效阈值：per-instance 覆盖优先；为 undefined 则用 env 默认。
function effectiveLimits(inst: Instance): { soft: number; hard: number } {
  return {
    soft: inst.memSoftLimitMB ?? DEFAULT_SOFT_MB,
    hard: inst.memHardLimitMB ?? DEFAULT_HARD_MB,
  };
}

// "当前有人在远程会话" 启发式判定：复用控制权心跳。前端在用户鼠标/键盘/滚轮交互时 2.5s 节流 beat，
// 故 holder 在 TTL 内即视为"有人在主动操作"。只看屏（不交互）超过 TTL 后会被判为空闲——这是有意的，
// 软自愈宁愿在"看似空闲"时短暂打扰，也不要拖到 hard 强制重启。
function hasActiveSession(id: string): boolean {
  const h = controlHolders.get(id);
  return !!h && Date.now() - h.at <= CONTROL_TTL;
}

if (WATCHDOG_ENABLED) {
  const recovering = new Set<string>(); // 防重入：自愈期间跳过本实例
  const healthFails = new Map<string, number>(); // id → 连续无响应次数（仅 HEALTH_FAIL_LIMIT>0 时启用）

  const recover = async (inst: Instance, reason: string, detail: string) => {
    recovering.add(inst.id);
    app.log.warn(`[watchdog] ${inst.containerName} ${detail}`);
    appendInstanceLog(inst.id, `[看门狗] 自愈重启（${reason}）：${detail}`);
    appendPanelLog('WARN', `[看门狗] 实例「${inst.name}」(id=${inst.id}) 自愈重启（${reason}）：${detail}`);
    try {
      await stopInstance(inst);
      await runInstance(inst);
      healthFails.delete(inst.id);
      app.log.info(`[watchdog] ${inst.containerName} 自愈完成（${reason}）`);
    } catch (e: any) {
      appendPanelLog('ERROR', `[看门狗] 实例「${inst.name}」(id=${inst.id}) 自愈失败（${reason}）：${e?.message || e}`);
      app.log.error(`[watchdog] ${inst.containerName} 自愈失败（${reason}）: ${e?.message || e}`);
    } finally {
      recovering.delete(inst.id);
    }
  };

  const tick = async () => {
    for (const pub of listInstances()) {
      const inst = findInstance(pub.id);
      if (!inst || recovering.has(inst.id)) continue;
      try {
        if ((await instanceRuntime(inst)) !== 'running') {
          healthFails.delete(inst.id);
          continue;
        }
        // 1) 内存阈值自愈（既有）：hard 强制 / soft 仅在无人会话时
        const mb = await instanceMemoryMB(inst);
        if (mb > 0) {
          const { soft, hard } = effectiveLimits(inst);
          const active = hasActiveSession(inst.id);
          if (hard > 0 && mb >= hard) {
            await recover(inst, 'hard', `mem=${mb}MiB ≥ hard=${hard}MiB，强制重启（active=${active}）`);
            continue;
          }
          if (soft > 0 && mb >= soft && !active) {
            await recover(inst, 'soft', `mem=${mb}MiB ≥ soft=${soft}MiB 且无活跃会话，柔和重启`);
            continue;
          }
          if (soft > 0 && mb >= soft && active) {
            app.log.info(`[watchdog] ${inst.containerName} mem=${mb}MiB ≥ soft=${soft}MiB 但用户在使用，延后`);
          }
        }
        // 2) 响应性自愈：探测 VNC 是否还能提供页面；连续 N 次无响应 → 重启。
        //    应对"进程没死、显示在线，但 I/O/服务 stall 读不出 VNC 文件、永远卡在正在连接桌面"。
        //    默认关闭（HEALTH_FAIL_LIMIT=0）：偶发宿主级争用会误判健康实例为 stall；需要时用 env 开启。
        if (HEALTH_FAIL_LIMIT > 0) {
          const healthy = await instanceHttpHealthy(inst);
          if (healthy) {
            healthFails.delete(inst.id);
            continue;
          }
          const fails = (healthFails.get(inst.id) || 0) + 1;
          healthFails.set(inst.id, fails);
          app.log.warn(`[watchdog] ${inst.containerName} VNC 无响应（连续 ${fails}/${HEALTH_FAIL_LIMIT}）`);
          if (fails >= HEALTH_FAIL_LIMIT) {
            await recover(inst, 'unresponsive', `VNC 连续 ${fails} 次无响应（疑似 I/O/服务 stall），自愈重启`);
          }
        }
      } catch (e: any) {
        app.log.warn(`[watchdog] ${pub.id} 检查异常: ${e?.message || e}`);
      }
    }
  };
  setInterval(() => void tick(), WATCHDOG_INTERVAL_SEC * 1000).unref();
  console.log(
    `[watchdog] 已启用 · soft=${DEFAULT_SOFT_MB} MiB · hard=${DEFAULT_HARD_MB} MiB · 间隔=${WATCHDOG_INTERVAL_SEC}s · VNC响应性探测=${HEALTH_FAIL_LIMIT > 0 ? `连续${HEALTH_FAIL_LIMIT}次` : '关闭'}`,
  );
}

await app.listen({ port: PORT, host: HOST });
console.log(`[panel] 监听 http://${HOST}:${PORT}  （多实例反代已就绪）· 版本 ${CURRENT_VERSION}`);
appendPanelLog('INFO', `面板启动 · 版本 ${CURRENT_VERSION} · 监听 ${HOST}:${PORT}`);
startUpdateChecker(); // 后台检测新版（best-effort，失败静默）
// 日志保留期清理：启动后跑一次 + 每 24h 一次，删除超过一年的日志行（unref 不阻止退出）。
pruneOldLogs();
setInterval(() => pruneOldLogs(), 24 * 60 * 60 * 1000).unref();
