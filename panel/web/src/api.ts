export interface PanelUser {
  id: string;
  username: string;
  role: 'admin' | 'sub';
  disabled: boolean;
  createdAt: string;
  allowedInstances: string[]; // admin 为空数组（隐式全部）
  mustChangePassword?: boolean; // 仍在用默认密码时为 true
}

export type WechatPhase = 'idle' | 'downloading' | 'extracting' | 'installing' | 'done' | 'error';
export interface WechatStatus {
  phase: WechatPhase;
  percent: number; // -1 表示进度不确定
  installed: boolean;
  version: string;
  message: string;
  updatedAt: number;
}

export type RuntimeState = 'running' | 'stopped' | 'missing';
export type AppType = 'wechat' | 'telegram' | 'chromium' | 'custom';
export const APP_LABELS: Record<AppType, string> = {
  wechat: '微信',
  telegram: 'Telegram',
  chromium: 'Chromium',
  custom: '自定义应用',
};

// 各应用的 UI 画像，供卡片/桌面页按类型显示正确文案（避免到处写死「微信」）。
//   needsInstall: 是否需要运行时下载安装（微信/Telegram 是；Chromium 已烤进镜像、即创建即就绪）。
//   enterHint:    首次进入实例的提示。
//   updateLabel:  「管理」菜单里的更新按钮文案（needsInstall=false 时不显示）。
export interface AppProfile {
  label: string;
  needsInstall: boolean;
  enterHint: string;
  updateLabel: string;
}
export const APP_PROFILES: Record<AppType, AppProfile> = {
  wechat: { label: '微信', needsInstall: true, enterHint: '首次进入请扫码登录微信', updateLabel: '更新微信' },
  telegram: { label: 'Telegram', needsInstall: true, enterHint: '首次进入请登录 Telegram', updateLabel: '更新 Telegram' },
  chromium: { label: 'Chromium', needsInstall: false, enterHint: '浏览器已就绪，直接使用即可', updateLabel: '' },
  custom: { label: '自定义应用', needsInstall: true, enterHint: '', updateLabel: '更新' },
};
export const appProfile = (t?: AppType): AppProfile => APP_PROFILES[t ?? 'wechat'] ?? APP_PROFILES.wechat;
export interface PanelInstance {
  id: string;
  name: string;
  appType?: AppType; // 缺省（老实例）= wechat
  icon?: string; // 自定义图标：data: 图片 / builtin:<key>；缺省按 appType 取默认图标
  createdAt: string;
  createdBy: string;
  memSoftLimitMB?: number;
  memHardLimitMB?: number;
}
export interface MemLimits {
  soft: number | null;
  hard: number | null;
  defaultSoft: number;
  defaultHard: number;
  currentMB: number;
  watchdogEnabled: boolean;
  intervalSec: number;
}
export interface InstanceWithStatus extends PanelInstance {
  runtime: RuntimeState;
  wechat: WechatStatus;
}

export interface VolEntry {
  name: string;
  type: 'dir' | 'file' | 'link' | 'other';
  size: number;
  mtime: number; // epoch ms
}

export interface VersionInfo {
  current: string; // 当前构建版本（如 v1.2.0 / dev）
  latest: string | null; // 仓库上最新发布版（如 v1.2.1）；查不到为 null
  hasUpdate: boolean; // 有更高的语义化版本可用
  checkedAt: number; // 上次检查时间戳（ms）；0=尚未检查
  source: string | null; // 数据来源：dockerhub / ghcr / dockerhub+ghcr
  error: string | null; // 检查失败原因
}

export interface PanelSelfUpgradePlan {
  enabled: boolean;
  currentVersion: string;
  targetVersion: string;
  targetContainer: string;
  currentImage: string;
  targetPanelImage: string;
  targetWechatImage: string;
  imagePrefix: string;
  dockerSocket: string;
  projectDir: string;
  canStart: boolean;
  warnings: string[];
}

export interface PanelSelfUpgradeStartResult {
  ok: true;
  helperName: string;
  plan: PanelSelfUpgradePlan;
}

export type AutomationStep =
  | { type: 'text'; text: string; sendEnter?: boolean }
  | { type: 'image'; imagePath?: string; imageKey?: string; sendEnter?: boolean }
  | { type: 'key'; key: string }
  | { type: 'wait'; seconds: number };

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  approved: boolean;
  priority: number;
  triggers: string[];
  responseSteps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
}

export type AutomationKnowledgeCategory = 'faq' | 'script' | 'policy' | 'contact-group' | 'moment-material' | 'other';

export interface AutomationKnowledgeItem {
  id: string;
  title: string;
  category: AutomationKnowledgeCategory;
  enabled: boolean;
  approved: boolean;
  source: string;
  tags: string[];
  triggers: string[];
  content: string;
  targetNames: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationKnowledgeImportResult {
  items: AutomationKnowledgeItem[];
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type AutomationAudienceContactType = 'contact' | 'group' | 'room' | 'unknown';

export interface AutomationAudienceContact {
  id: string;
  name: string;
  type: AutomationAudienceContactType;
  aliases: string[];
  tags: string[];
  source: string;
  note: string;
  enabled: boolean;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  lastImportedAt?: string;
}

export interface AutomationAudienceImportResult {
  contacts: AutomationAudienceContact[];
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type AutomationAudienceMassJobTypeFilter = AutomationAudienceContactType | 'all';

export interface AutomationAudienceMassJobFilter {
  query: string;
  tags: string[];
  type: AutomationAudienceMassJobTypeFilter;
  requireApproved: boolean;
  requireEnabled: boolean;
  limit: number;
}

export interface AutomationAudienceMassJobSelection {
  filters: AutomationAudienceMassJobFilter;
  matched: number;
  selected: number;
  skipped: number;
  contacts: AutomationAudienceContact[];
}

export type AutomationMaterialKind = 'image' | 'video' | 'file' | 'link' | 'text' | 'other';

export interface AutomationMaterialAsset {
  id: string;
  key: string;
  title: string;
  kind: AutomationMaterialKind;
  source: string;
  tags: string[];
  description: string;
  localPath: string;
  url: string;
  enabled: boolean;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  lastImportedAt?: string;
}

export interface AutomationMaterialImportResult {
  assets: AutomationMaterialAsset[];
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type WecomBridgeWorkerCapability =
  | 'reply'
  | 'mass'
  | 'moment'
  | 'rpa-package'
  | 'prepare'
  | 'send'
  | 'target-match'
  | 'handler-verification'
  | 'visual-verification'
  | 'material-map';

export interface WecomBridgeWorkerStatus {
  id: string;
  workerId: string;
  source: string;
  enabled: boolean;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  mode: string;
  host: string;
  pid?: number;
  version?: string;
  note?: string;
  capabilities: WecomBridgeWorkerCapability[];
  pendingReplies: number;
  pendingMassTasks: number;
  pendingMomentTasks: number;
  materialMap?: WecomBridgeWorkerMaterialMapStatus;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  online: boolean;
  staleSeconds: number;
  offlineAfterSeconds: number;
}

export interface WecomBridgeWorkerMaterialMapStatus {
  file?: string;
  exists: boolean;
  ok: boolean;
  generatedAt?: string;
  updatedAt: string;
  mapped: number;
  materials: number;
  skipped: number;
  kinds: string[];
  kind?: string;
  tag?: string;
  source?: string;
  error?: string;
}

export type WecomBridgeRunTarget = 'replies' | 'mass' | 'moments' | 'all' | 'doctor' | 'unknown';
export type WecomBridgeRunStatus = 'started' | 'completed' | 'failed';
export type WecomBridgeRunnerMode = 'dry-run' | 'prepare' | 'send';
export type WecomBridgeRunnerTarget = 'replies' | 'mass' | 'moments' | 'all';
export type WecomBridgeRunnerEngine = 'bridge' | 'rpa-package';
export type WecomBridgeMomentPasteMode = 'clipboard-only' | 'current-input' | 'external-rpa';
export type WecomBridgeRunReportItemTarget = 'reply' | 'mass' | 'moment' | 'doctor' | 'unknown';
export type BridgeRecoveryReleaseMode = 'none' | 'expired' | 'all';
export type WecomRpaPackageTarget = 'replies' | 'mass' | 'moments' | 'all';

export interface WecomRpaPackageHandoff {
  generatedFrom: 'automation-rpa-package';
  packageId?: string;
  packageTarget: WecomRpaPackageTarget;
  packageDigest?: string;
  taskDigest?: string;
  packageTaskCount?: number;
  packageTtlMinutes?: number;
  packageExpiresAt?: string;
  recommendedMode: WecomBridgeRunnerMode;
  runnerEngine: WecomBridgeRunnerEngine;
  runnerTarget: WecomBridgeRunnerTarget;
  runnerMode: WecomBridgeRunnerMode;
  allowSend: boolean;
  requireTargetMatch: boolean;
  requireHandlerVerification: boolean;
  momentPasteMode: WecomBridgeMomentPasteMode;
  preflightLevel: AutomationPreflightLevel;
  preflightSummary: Record<AutomationPreflightLevel, number>;
  blockedByPreflight: boolean;
  notes: string[];
}

export interface WecomBridgeTargetVerification {
  required?: boolean;
  verified?: boolean;
  expectedName?: string;
  matchedName?: string;
  conversationMatched?: boolean;
  inputReady?: boolean;
  activeApp?: string;
  windowTitle?: string;
  ocrText?: string;
  visualSummary?: string;
  confidence?: number;
  error?: string;
  checkedAt?: string;
}

export interface WecomBridgeRunReportItem {
  id: string;
  target: WecomBridgeRunReportItemTarget;
  name?: string;
  action?: string;
  ok?: boolean;
  dryRun?: boolean;
  claimed?: boolean;
  exitCode?: number;
  signal?: string;
  error?: string;
  verification?: WecomBridgeTargetVerification;
}

export interface WecomBridgeRunReport {
  id: string;
  source: string;
  workerId: string;
  mode: string;
  target: WecomBridgeRunTarget;
  status: WecomBridgeRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  handledReplies: number;
  handledMassTasks: number;
  handledMomentTasks: number;
  failedReplies: number;
  failedMassTasks: number;
  failedMomentTasks: number;
  error?: string;
  summary?: string;
  packageHandoff?: WecomRpaPackageHandoff;
  items: WecomBridgeRunReportItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WecomBridgeRunWorkerSummary {
  workerId: string;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  handled: number;
  failed: number;
  rpaPackageRuns: number;
  lastRunAt?: string;
  lastStatus?: WecomBridgeRunStatus;
  lastMode?: string;
  lastTarget?: WecomBridgeRunTarget;
}

export interface WecomBridgeRunErrorSummary {
  error: string;
  count: number;
  latestAt?: string;
  workerId?: string;
}

export interface WecomBridgeRunReportsSummary {
  generatedAt: string;
  windowHours: number;
  limit: number;
  workerId?: string;
  totalRuns: number;
  successRate: number;
  status: Record<WecomBridgeRunStatus, number>;
  target: Record<WecomBridgeRunTarget, number>;
  modes: Record<string, number>;
  totals: {
    handled: number;
    failed: number;
    handledReplies: number;
    handledMassTasks: number;
    handledMomentTasks: number;
    failedReplies: number;
    failedMassTasks: number;
    failedMomentTasks: number;
    reportItems: number;
    failedItems: number;
    verificationRequired: number;
    verificationPassed: number;
    verificationFailed: number;
    rpaPackageRuns: number;
    blockedRpaPackageRuns: number;
  };
  rpaPackage: {
    runs: number;
    blockedByPreflight: number;
    preflightLevel: Record<AutomationPreflightLevel, number>;
    recommendedMode: Record<WecomBridgeRunnerMode, number>;
    packageTarget: Record<WecomRpaPackageTarget, number>;
  };
  workers: WecomBridgeRunWorkerSummary[];
  topErrors: WecomBridgeRunErrorSummary[];
}

export type WecomRpaPackageFormat = 'json' | 'jsonl';
export type WecomRpaTaskTarget = 'reply' | 'mass' | 'moment';

export interface WecomRpaTask {
  schema: 'woc.wecom.rpa.task.v1';
  packageId: string;
  taskDigest?: string;
  exportedAt: string;
  expiresAt?: string;
  source: string;
  workerId: string;
  target: WecomRpaTaskTarget;
  id: string;
  operation: 'reply.prepare' | 'mass.prepare' | 'moment.prepare';
  expectedName: string;
  text: string;
  textChars: number;
  requiresOperatorReview: boolean;
  conversationName?: string;
  senderName?: string;
  inboundText?: string;
  steps?: AutomationStep[];
  stepCount?: number;
  imageStepCount?: number;
  recipientName?: string;
  jobId?: string;
  itemId?: string;
  jobTitle?: string;
  draftId?: string;
  title?: string;
  imageNotes?: string;
  materials?: string[];
  materialCount?: number;
  scheduledAt?: string;
}

export interface WecomRpaPackage {
  schema: 'woc.wecom.rpa.package.v1';
  packageId: string;
  packageDigest?: string;
  taskDigest?: string;
  exportedAt: string;
  expiresAt: string;
  ttlMinutes: number;
  source: string;
  workerId: string;
  target: WecomRpaPackageTarget;
  limit: number;
  format: WecomRpaPackageFormat;
  counts: {
    total: number;
    replies: number;
    mass: number;
    moments: number;
  };
  handoff?: WecomRpaPackageHandoff;
  tasks: WecomRpaTask[];
}

export type WecomRpaPackageIssueStatus = 'issued' | 'reported' | 'expired';
export type WecomRpaPackageIssueKind = 'preview' | 'download' | 'raw' | 'reported-only';

export interface WecomRpaPackageIssue {
  id: string;
  packageId: string;
  packageDigest?: string;
  taskDigest?: string;
  issuedAt: string;
  expiresAt?: string;
  ttlMinutes?: number;
  actor: string;
  source: string;
  workerId: string;
  workerSource?: string;
  target: WecomRpaPackageTarget;
  format: WecomRpaPackageFormat | 'unknown';
  requestKind: WecomRpaPackageIssueKind;
  includeSource: boolean;
  status: WecomRpaPackageIssueStatus;
  counts: {
    total: number;
    replies: number;
    mass: number;
    moments: number;
  };
  runCount: number;
  handled: number;
  failed: number;
  lastRunReportId?: string;
  lastRunAt?: string;
  lastRunStatus?: WecomBridgeRunStatus;
  lastRunWorkerId?: string;
  reportedOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationBridgeRecoveryChange {
  target: 'reply' | 'mass' | 'moment';
  id: string;
  name?: string;
  action: 'release-claim' | 'retry-failed';
  reason?: string;
  workerId?: string;
  error?: string;
  failedAt?: string;
  retryCount?: number;
  nextRetryCount?: number;
  cursor?: string;
}

export interface AutomationBridgeRecoveryResult {
  generatedAt: string;
  dryRun: boolean;
  releaseClaims: BridgeRecoveryReleaseMode;
  retryFailed: boolean;
  workerId?: string;
  failureReason?: string;
  minFailedAgeSeconds: number;
  maxRetryAttempts: number;
  cursor?: string;
  nextCursor?: string;
  hasMore: boolean;
  limit: number;
  replies: { releasedClaims: number; retriedFailed: number };
  mass: { releasedClaims: number; retriedFailed: number; resumedJobs: number };
  moments: { releasedClaims: number; retriedFailed: number };
  totalChanged: number;
  changes: AutomationBridgeRecoveryChange[];
}

export interface WecomBridgeRunnerPolicy {
  runnerEngine: WecomBridgeRunnerEngine;
  mode: WecomBridgeRunnerMode;
  target: WecomBridgeRunnerTarget;
  limit: number;
  claimTtlSeconds: number;
  heartbeatIntervalSeconds: number;
  momentPasteMode: WecomBridgeMomentPasteMode;
  allowSend: boolean;
  requireTargetMatch: boolean;
  requireHandlerVerification: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface AutomationBridgeRunnerGuide {
  panelUrl: string;
  configPath: string;
  workspacePath?: string;
  repoUrl?: string;
  branch?: string;
  tokenEnvName: string;
  tokenPlaceholder: string;
  defaultWorkerId: string;
  runnerScript: string;
  installScript: string;
  materialMapPath?: string;
  launchAgentLabel?: string;
  launchAgentPlistPath?: string;
  launchAgentLogPath?: string;
  launchAgentErrorLogPath?: string;
  wecomCliExecutable?: string;
  wecomCliInstallCommand?: string;
  wecomCliInitCommand?: string;
  modes: string[];
  targets: string[];
  envFile: string;
  bootstrapScript?: string;
  commands: {
    bootstrap?: string;
    writeEnv: string;
    syncMaterialMap?: string;
    printConfig: string;
    doctor: string;
    doctorReport: string;
    doctorWithoutCli?: string;
    wecomCliInstall?: string;
    wecomCliInit?: string;
    wecomCliCheck?: string;
    syncCliAudience?: string;
    dryRunAll: string;
    dryRunRpaPackageAll?: string;
    prepareAll: string;
    prepareMomentExternalRpa?: string;
    sendAll: string;
    dryRunLaunchAgent: string;
    installLaunchAgent: string;
    launchAgentStatus?: string;
    tailLaunchAgentLog?: string;
    unloadLaunchAgent?: string;
  };
}

export interface AutomationBridgeStatus {
  enabled: boolean;
  configured: boolean;
  tokenLengthOk: boolean;
  tokenEnvName: string;
  compatibilityEnvName: string;
  endpoint: string;
  knowledgeEndpoint: string;
  assistantEndpoint: string;
  audienceEndpoint: string;
  materialEndpoint: string;
  materialMapEndpoint: string;
  eventEndpoint: string;
  replyEndpoint: string;
  massTaskEndpoint: string;
  momentTaskEndpoint: string;
  heartbeatEndpoint: string;
  runReportEndpoint: string;
  runnerPolicyEndpoint: string;
  rpaPackageEndpoint: string;
  workers: WecomBridgeWorkerStatus[];
  authHeaders: string[];
  runnerGuide?: AutomationBridgeRunnerGuide;
}

export interface WecomBridgeEvent {
  id: string;
  source: string;
  externalId?: string;
  conversationName: string;
  senderName: string;
  inboundText: string;
  conversationContext: string;
  status: 'new' | 'planned' | 'archived';
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  lastPlannedAt?: string;
  replyDraft?: string;
  replySteps?: AutomationStep[];
  replyApproved: boolean;
  replyApprovedAt?: string;
  replyClaimedAt?: string;
  replyClaimedBy?: string;
  replyClaimExpiresAt?: string;
  replyFailedAt?: string;
  replyFailedBy?: string;
  replyError?: string;
  replyRetryCount?: number;
  replyDeliveredAt?: string;
}

export interface AutomationSettings {
  enabled: boolean;
  aiDraftEnabled: boolean;
  automaticRuleRepliesEnabled: boolean;
  massSendEnabled: boolean;
  momentsEnabled: boolean;
  maximumAutomaticSendsPerHour: number;
  maximumAutomaticActionsPerDay: number;
  perConversationCooldownMinutes: number;
  requireConfirmForSend: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface AutomationConfig {
  settings: AutomationSettings;
  persona: string;
  knowledgeNotes: string;
  rules: AutomationRule[];
  knowledgeItems: AutomationKnowledgeItem[];
}

export interface AutomationOverview {
  generatedAt: string;
  settings: AutomationSettings;
  gates: {
    quietHoursActive: boolean;
    quietHoursWindow: string;
    dailyActions: number;
    dailyLimit: number;
    dailyRemaining: number | null;
    blocked: boolean;
    reasons: string[];
  };
  knowledge: {
    total: number;
    approved: number;
    enabled: number;
  };
  materials: {
    total: number;
    enabled: number;
    approved: number;
    images: number;
  };
  audience: {
    total: number;
    enabled: number;
    approved: number;
    groups: number;
    contacts: number;
  };
  rules: {
    total: number;
    enabled: number;
    approved: number;
  };
  bridge: {
    workersTotal: number;
    workersOnline: number;
    workersPaused: number;
    lastWorkerSeenAt?: string;
    events: {
      active: number;
      new: number;
      planned: number;
      approvedPending: number;
      claimed: number;
      failed: number;
      delivered: number;
    };
    pendingReplies: number;
    pendingMassTasks: number;
    pendingMomentTasks: number;
    capabilities: Record<WecomBridgeWorkerCapability | 'unknown', number>;
    runs: {
      total: number;
      recentFailures: number;
      lastRunAt?: string;
      lastRunStatus?: WecomBridgeRunStatus;
      lastRunTarget?: WecomBridgeRunTarget;
    };
    runnerPolicy: WecomBridgeRunnerPolicy;
  };
  mass: {
    jobsTotal: number;
    draft: number;
    queued: number;
    running: number;
    paused: number;
    completed: number;
    cancelled: number;
    approvedRunnableJobs: number;
    scheduledJobs: number;
    itemsPending: number;
    itemsSent: number;
    itemsFailed: number;
    itemsSkipped: number;
    bridgeClaimedItems: number;
  };
  moments: {
    draftsTotal: number;
    draft: number;
    ready: number;
    prepared: number;
    published: number;
    archived: number;
    approvedReady: number;
    scheduledReady: number;
    bridgeClaimedDrafts: number;
    bridgeFailedDrafts: number;
  };
  audit: {
    total: number;
    lastAt?: string;
    lastAction?: string;
  };
  riskFlags: string[];
}

export type AutomationPreflightLevel = 'ok' | 'warn' | 'block';

export interface AutomationPreflightCheck {
  id: string;
  level: AutomationPreflightLevel;
  title: string;
  message: string;
  count?: number;
  action?: string;
  refs?: string[];
}

export interface AutomationPreflightReport {
  generatedAt: string;
  level: AutomationPreflightLevel;
  summary: Record<AutomationPreflightLevel, number>;
  checks: AutomationPreflightCheck[];
}

export type AutomationHealthLevel = 'ok' | 'attention' | 'blocked';
export type AutomationHealthLaneKey = 'reply' | 'mass' | 'moment' | 'bridge' | 'materials';

export interface AutomationHealthLane {
  key: AutomationHealthLaneKey;
  title: string;
  level: AutomationHealthLevel;
  score: number;
  ready: boolean;
  pending: number;
  blockers: AutomationPreflightCheck[];
  warnings: AutomationPreflightCheck[];
  nextAction: string;
  metrics: Record<string, number | string | boolean | null>;
}

export interface AutomationHealth {
  generatedAt: string;
  score: number;
  level: AutomationHealthLevel;
  summary: string;
  totals: {
    pendingReplies: number;
    pendingMassTasks: number;
    pendingMomentTasks: number;
    actionItems: number;
    workersOnline: number;
    workersTotal: number;
    preflightBlocks: number;
    preflightWarnings: number;
  };
  lanes: AutomationHealthLane[];
  blockers: AutomationPreflightCheck[];
  warnings: AutomationPreflightCheck[];
  recommendedActions: string[];
}

export type AutomationActionQueueItemKind = 'preflight-check' | 'review-task' | 'bridge-reply' | 'mass-task' | 'moment-task' | 'runner-report';
export type AutomationActionQueuePriority = 'block' | 'high' | 'normal' | 'low';
export type AutomationActionQueueTarget = 'ops' | 'reply' | 'mass' | 'moment';
export type AutomationActionQueueRpaWorkerTarget = 'replies' | 'mass' | 'moments';

export interface AutomationActionQueueItem {
  id: string;
  kind: AutomationActionQueueItemKind;
  priority: AutomationActionQueuePriority;
  target: AutomationActionQueueTarget;
  title: string;
  detail: string;
  action: string;
  refId?: string;
  secondaryRefId?: string;
  createdAt?: string;
  updatedAt?: string;
  staleSeconds?: number;
  tags: string[];
}

export interface AutomationActionQueue {
  generatedAt: string;
  summary: Record<AutomationActionQueuePriority, number> & { total: number };
  handoff?: {
    rpa: {
      target: WecomRpaPackageTarget;
      label: string;
      total: number;
      replies: number;
      mass: number;
      moments: number;
      limit: number;
      ready: boolean;
      blockedByPreflight: boolean;
      blockedByWorker: boolean;
      reason: string;
      workerReadiness: Record<
        AutomationActionQueueRpaWorkerTarget,
        {
          target: AutomationActionQueueRpaWorkerTarget;
          label: string;
          capability: WecomBridgeWorkerCapability;
          tasks: number;
          onlineWorkers: number;
          capableWorkers: number;
          unknownWorkers: number;
          blocked: boolean;
          reason: string;
        }
      >;
    };
  };
  items: AutomationActionQueueItem[];
}

export interface AutomationAuditEvent {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  instanceId?: string;
  instanceName?: string;
  conversationName?: string;
  ruleId?: string;
  ruleName?: string;
  riskLevel?: 'normal' | 'review' | 'block';
  message: string;
}

export type AutomationBundleMode = 'append' | 'upsert';

export interface AutomationBundleSummary {
  rules: number;
  knowledgeItems: number;
  audienceContacts: number;
  materialAssets: number;
  massSendJobs: number;
  momentDrafts: number;
  bridgeEvents: number;
}

export interface AutomationBundle {
  schema: 'wechat-on-cloud.automation-bundle';
  version: number;
  exportedAt: string;
  summary: AutomationBundleSummary;
  config: AutomationConfig;
  audienceContacts: AutomationAudienceContact[];
  materialAssets: AutomationMaterialAsset[];
  massSendJobs: MassSendJob[];
  momentDrafts: MomentDraft[];
  runnerPolicy: WecomBridgeRunnerPolicy;
  bridgeEvents?: WecomBridgeEvent[];
  bridgeWorkers?: WecomBridgeWorkerStatus[];
  bridgeRunReports?: WecomBridgeRunReport[];
  auditEvents?: AutomationAuditEvent[];
}

export interface AutomationBundleImportResult {
  dryRun: boolean;
  mode: AutomationBundleMode;
  includeConfig: boolean;
  keepOperationalState: boolean;
  summary: AutomationBundleSummary;
  imported: Record<string, number>;
  updated: Record<string, number>;
  ids: Record<string, string[]>;
  skipped: number;
  errors: string[];
}

export interface WecomAssistantImportResult {
  source: string;
  dryRun: boolean;
  mode: AutomationBundleMode;
  translated: {
    rules: number;
    knowledgeItems: number;
    skipped: number;
    errors: string[];
  };
  result: AutomationBundleImportResult;
}

export interface AutomationDecision {
  action: 'send-rule' | 'review' | 'none' | 'blocked';
  rule: AutomationRule | null;
  risk: { level: 'normal' | 'review' | 'block'; reasons: string[] };
  reasons: string[];
}

export interface AutomationReplyPlan {
  mode: 'keyword-rule' | 'ai-draft' | 'manual-review' | 'blocked';
  decision: AutomationDecision;
  draft: string;
  model?: string;
  knowledgeRefs?: AutomationKnowledgeReference[];
  ruleId?: string;
  canSendRule: boolean;
  canSendText: boolean;
  reasons: string[];
}

export interface AutomationKnowledgeReference {
  id: string;
  title: string;
  category: AutomationKnowledgeCategory;
  source: string;
  tags: string[];
  triggers: string[];
  excerpt: string;
}

export interface WecomBridgeReplyPlanResult {
  event: WecomBridgeEvent;
  plan?: AutomationReplyPlan;
  planned: boolean;
  approved: boolean;
  skippedReason?: string;
}

export interface MassSendItem {
  id: string;
  recipientName: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sentAt?: string;
  auditEventId?: string;
  error?: string;
  bridgeClaimedAt?: string;
  bridgeClaimedBy?: string;
  bridgeClaimExpiresAt?: string;
  bridgeFailedAt?: string;
  bridgeFailedBy?: string;
  bridgeRetryCount?: number;
}

export interface MassSendJob {
  id: string;
  title: string;
  message: string;
  status: 'draft' | 'queued' | 'running' | 'paused' | 'completed' | 'cancelled';
  approved: boolean;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  options: {
    perSendDelaySeconds: number;
    requireOperatorConfirmRecipient: boolean;
    openConversationBeforeSend: boolean;
    searchShortcut: string;
    searchResultDelaySeconds: number;
    postOpenDelaySeconds: number;
  };
  items: MassSendItem[];
}

export interface InstanceAutomationSelfTest {
  ok: boolean;
  display: string;
  checks: { name: string; ok: boolean; detail: string }[];
}

export interface InstanceAutomationWindowSnapshot {
  id: string;
  name: string;
  geometry: {
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
    screen: number | null;
  };
}

export interface InstanceAutomationVisualSnapshot {
  ok: boolean;
  capturedAt: string;
  display: string;
  activeWindow: InstanceAutomationWindowSnapshot | null;
  focusedWindow: InstanceAutomationWindowSnapshot | null;
  visibleWindows: InstanceAutomationWindowSnapshot[];
  pointer: { x: number | null; y: number | null; screen: number | null; windowId: string };
  capabilities: {
    xdotool: boolean;
    xclip: boolean;
    screenshot: boolean;
    ocr: boolean;
  };
  screenshot?: {
    mime: 'image/png';
    dataUrl: string;
    bytes: number;
  };
  ocr?: {
    engine: 'tesseract';
    languages: string;
    text: string;
    chars: number;
  };
  warnings: string[];
  summary: string;
}

export interface InstanceAutomationTargetVerifyResult {
  verification: WecomBridgeTargetVerification;
  snapshot: InstanceAutomationVisualSnapshot;
  matches: { source: string; name: string; value: string; score: number }[];
}

export interface MomentDraft {
  id: string;
  title: string;
  text: string;
  imageNotes: string;
  materials: string[];
  status: 'draft' | 'ready' | 'prepared' | 'published' | 'archived';
  approved: boolean;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastPreparedAt?: string;
  publishedAt?: string;
  bridgeClaimedAt?: string;
  bridgeClaimedBy?: string;
  bridgeClaimExpiresAt?: string;
  bridgeFailedAt?: string;
  bridgeFailedBy?: string;
  bridgeError?: string;
  bridgeRetryCount?: number;
}

// 原始二进制上传（File 直传 application/octet-stream），用于数据卷上传/解压/恢复
async function rawUpload(url: string, file: File): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/octet-stream' },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `请求失败 (${res.status})`);
  return data;
}

async function req<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  // 仅在有 body 时声明 JSON content-type：否则 Fastify 对「空 body + application/json」会报 400
  const headers = opts.body ? { 'content-type': 'application/json', ...opts.headers } : opts.headers;
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...opts,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 会话过期：除登录/探测接口外，任意接口收到 401 都说明 cookie 失效，直接回登录页（避免页面卡在错误态）
    const isAuthProbe = path.includes('/api/auth/login') || path.includes('/api/auth/me');
    if (res.status === 401 && !isAuthProbe && location.pathname !== '/login') {
      location.assign('/login');
    }
    throw new Error((data as any).error || `请求失败 (${res.status})`);
  }
  return data as T;
}

function wecomRpaPackageParams(options: {
  target?: WecomRpaPackageTarget;
  limit?: number;
  ttlMinutes?: number;
  format?: WecomRpaPackageFormat;
  includeSource?: boolean;
  mode?: WecomBridgeRunnerMode;
  workerId?: string;
  workerSource?: string;
  capabilities?: string[];
  requireSendable?: boolean;
}): string {
  const params = new URLSearchParams({
    target: options.target || 'all',
    limit: String(options.limit || 50),
    format: options.format || 'json',
    includeSource: options.includeSource ? '1' : '0',
  });
  if (options.mode) params.set('mode', options.mode);
  if (options.ttlMinutes) params.set('ttlMinutes', String(options.ttlMinutes));
  if (options.workerId) params.set('workerId', options.workerId);
  if (options.workerSource) params.set('workerSource', options.workerSource);
  if (options.capabilities?.length) params.set('capabilities', options.capabilities.join(','));
  if (options.requireSendable) params.set('requireSendable', '1');
  return params.toString();
}

export const api = {
  me: () => req<{ user: PanelUser }>('/api/auth/me'),
  login: (username: string, password: string) =>
    req<{ user: PanelUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => req('/api/auth/logout', { method: 'POST' }),
  changePassword: (oldPassword: string, newPassword: string) =>
    req('/api/account/password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),

  // 版本与更新检测
  getVersion: () => req<VersionInfo>('/api/version'),
  checkUpdate: () => req<VersionInfo>('/api/admin/version/check', { method: 'POST' }),
  getPanelUpgradePlan: (version = '') =>
    req<{ plan: PanelSelfUpgradePlan }>(`/api/admin/panel-upgrade/plan${version ? `?version=${encodeURIComponent(version)}` : ''}`),
  startPanelUpgrade: (payload: { version: string; confirm: boolean }) =>
    req<PanelSelfUpgradeStartResult>('/api/admin/panel-upgrade/start', { method: 'POST', body: JSON.stringify(payload) }),

  // 自动化实验版（规则、AI 草稿、确认发送）
  getAutomationConfig: () => req<{ config: AutomationConfig }>('/api/admin/automation/config'),
  getAutomationOverview: () => req<{ overview: AutomationOverview }>('/api/admin/automation/overview'),
  getAutomationHealth: () => req<{ health: AutomationHealth }>('/api/admin/automation/health'),
  getAutomationPreflight: () => req<{ report: AutomationPreflightReport }>('/api/admin/automation/preflight'),
  getAutomationActionQueue: (limit = 20) => req<{ queue: AutomationActionQueue }>(`/api/admin/automation/action-queue?limit=${encodeURIComponent(limit)}`),
  updateAutomationConfig: (config: AutomationConfig) =>
    req<{ config: AutomationConfig }>('/api/admin/automation/config', { method: 'PUT', body: JSON.stringify(config) }),
  exportAutomationBundle: (options: { includeBridgeEvents?: boolean; includeOperational?: boolean; includeAudit?: boolean } = {}) =>
    req<{ bundle: AutomationBundle }>(
      `/api/admin/automation/bundle?includeBridgeEvents=${options.includeBridgeEvents ? '1' : '0'}&includeOperational=${options.includeOperational ? '1' : '0'}&includeAudit=${options.includeAudit ? '1' : '0'}`,
    ),
  importAutomationBundle: (payload: {
    bundle: any;
    dryRun?: boolean;
    mode?: AutomationBundleMode;
    includeConfig?: boolean;
    includeQueues?: boolean;
    keepOperationalState?: boolean;
    includeBridgeEvents?: boolean;
    includeRunnerPolicy?: boolean;
  }) =>
    req<{ result: AutomationBundleImportResult }>('/api/admin/automation/bundle/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  importWecomAssistantAssets: (payload: {
    source?: string;
    dryRun?: boolean;
    mode?: AutomationBundleMode;
    approveImported?: boolean;
    payload?: any;
    snapshot?: any;
    assistant?: any;
    wecomAssistant?: any;
    keywordReplyRules?: any[];
    keywordRules?: any[];
    knowledge?: any;
    persistedKnowledge?: any;
    localKnowledge?: any;
    knowledgeEntries?: any[];
    knowledgeChunks?: any[];
  }) =>
    req<{ result: WecomAssistantImportResult }>('/api/admin/automation/wecom-assistant/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAutomationBridge: () => req<{ bridge: AutomationBridgeStatus }>('/api/admin/automation/bridge'),
  exportWecomRpaPackage: (options: {
    target?: WecomRpaPackageTarget;
    limit?: number;
    format?: WecomRpaPackageFormat;
    includeSource?: boolean;
    mode?: WecomBridgeRunnerMode;
    workerId?: string;
    workerSource?: string;
    capabilities?: string[];
    requireSendable?: boolean;
  } = {}) =>
    req<{ package: WecomRpaPackage }>(`/api/admin/automation/rpa-package?${wecomRpaPackageParams(options)}`),
  listWecomBridgeEvents: (limit = 100, status?: WecomBridgeEvent['status']) =>
    req<{ events: WecomBridgeEvent[] }>(
      `/api/admin/automation/bridge-events?limit=${encodeURIComponent(limit)}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
    ),
  planWecomBridgeEventReply: (eventId: string, payload: { overwrite?: boolean; approveRuleReplies?: boolean; extraInstruction?: string } = {}) =>
    req<{ result: WecomBridgeReplyPlanResult }>(`/api/admin/automation/bridge-events/${eventId}/reply-plan`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listWecomBridgeRunReports: (limit = 50, workerId = '') =>
    req<{ reports: WecomBridgeRunReport[] }>(
      `/api/admin/automation/bridge-runs?limit=${encodeURIComponent(limit)}${workerId ? `&workerId=${encodeURIComponent(workerId)}` : ''}`,
    ),
  listWecomRpaPackageIssues: (limit = 50) =>
    req<{ packages: WecomRpaPackageIssue[] }>(`/api/admin/automation/rpa-package/issues?limit=${encodeURIComponent(limit)}`),
  getWecomBridgeRunReportsSummary: (hours = 24, limit = 300, workerId = '') =>
    req<{ summary: WecomBridgeRunReportsSummary }>(
      `/api/admin/automation/bridge-runs/summary?hours=${encodeURIComponent(hours)}&limit=${encodeURIComponent(limit)}${workerId ? `&workerId=${encodeURIComponent(workerId)}` : ''}`,
    ),
  patchWecomBridgeWorker: (workerId: string, payload: { enabled?: boolean; paused?: boolean; reason?: string; pauseReason?: string }) =>
    req<{ worker: WecomBridgeWorkerStatus }>(`/api/admin/automation/bridge-workers/${encodeURIComponent(workerId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getWecomBridgeRunnerPolicy: () => req<{ policy: WecomBridgeRunnerPolicy }>('/api/admin/automation/runner-policy'),
  updateWecomBridgeRunnerPolicy: (policy: Partial<WecomBridgeRunnerPolicy>) =>
    req<{ policy: WecomBridgeRunnerPolicy }>('/api/admin/automation/runner-policy', {
      method: 'PUT',
      body: JSON.stringify(policy),
    }),
  recoverAutomationBridgeOutbox: (payload: {
    dryRun?: boolean;
    releaseClaims?: BridgeRecoveryReleaseMode | boolean;
    retryFailed?: boolean;
    includeReplies?: boolean;
    includeMass?: boolean;
    includeMoments?: boolean;
    workerId?: string;
    failureReason?: string;
    minFailedAgeSeconds?: number;
    maxRetryAttempts?: number;
    cursor?: string;
    limit?: number;
  }) =>
    req<{ result: AutomationBridgeRecoveryResult }>('/api/admin/automation/bridge-recovery', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  patchWecomBridgeEvent: (
    eventId: string,
    payload: {
      status?: WecomBridgeEvent['status'];
      replyDraft?: string;
      replySteps?: AutomationStep[];
      replyApproved?: boolean;
      markDelivered?: boolean;
      markReleased?: boolean;
      deliveryStatus?: 'claimed' | 'failed' | 'delivered' | 'released';
      reason?: string;
    },
  ) =>
    req<{ event: WecomBridgeEvent }>(`/api/admin/automation/bridge-events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  importAutomationKnowledge: (payload: {
    source?: string;
    category?: AutomationKnowledgeCategory;
    approveImported?: boolean;
    enabled?: boolean;
    mode?: 'append' | 'upsert';
    items?: any[];
    rawText?: string;
    text?: string;
  }) =>
    req<{ result: AutomationKnowledgeImportResult }>('/api/admin/automation/knowledge/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listAutomationAudience: (limit = 200, query = '', tag = '') =>
    req<{ contacts: AutomationAudienceContact[] }>(
      `/api/admin/automation/audience?limit=${encodeURIComponent(limit)}&query=${encodeURIComponent(query)}&tag=${encodeURIComponent(tag)}`,
    ),
  importAutomationAudience: (payload: {
    source?: string;
    type?: AutomationAudienceContactType;
    approveImported?: boolean;
    enabled?: boolean;
    mode?: 'append' | 'upsert';
    contacts?: any[];
    audiences?: any[];
    recipients?: string[];
    items?: any[];
    rawText?: string;
    text?: string;
  }) =>
    req<{ result: AutomationAudienceImportResult }>('/api/admin/automation/audience/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  patchAutomationAudience: (contactId: string, payload: Partial<AutomationAudienceContact>) =>
    req<{ contact: AutomationAudienceContact }>(`/api/admin/automation/audience/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAutomationAudience: (contactId: string) =>
    req<{ ok: true }>(`/api/admin/automation/audience/${contactId}`, {
      method: 'DELETE',
    }),
  listAutomationMaterials: (limit = 200, query = '', tag = '') =>
    req<{ assets: AutomationMaterialAsset[] }>(
      `/api/admin/automation/materials?limit=${encodeURIComponent(limit)}&query=${encodeURIComponent(query)}&tag=${encodeURIComponent(tag)}`,
    ),
  importAutomationMaterials: (payload: {
    source?: string;
    kind?: AutomationMaterialKind;
    type?: AutomationMaterialKind;
    approveImported?: boolean;
    enabled?: boolean;
    mode?: 'append' | 'upsert';
    assets?: any[];
    materials?: any[];
    items?: any[];
    rawText?: string;
    text?: string;
  }) =>
    req<{ result: AutomationMaterialImportResult }>('/api/admin/automation/materials/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  patchAutomationMaterial: (assetId: string, payload: Partial<AutomationMaterialAsset>) =>
    req<{ asset: AutomationMaterialAsset }>(`/api/admin/automation/materials/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAutomationMaterial: (assetId: string) =>
    req<{ ok: true }>(`/api/admin/automation/materials/${assetId}`, {
      method: 'DELETE',
    }),
  patchAutomationKnowledge: (itemId: string, payload: Partial<AutomationKnowledgeItem>) =>
    req<{ item: AutomationKnowledgeItem }>(`/api/admin/automation/knowledge/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAutomationKnowledge: (itemId: string) =>
    req<{ ok: true }>(`/api/admin/automation/knowledge/${itemId}`, {
      method: 'DELETE',
    }),
  simulateAutomation: (inboundText: string) =>
    req<{ decision: AutomationDecision }>('/api/admin/automation/simulate', { method: 'POST', body: JSON.stringify({ inboundText }) }),
  automationReplyPlan: (payload: { inboundText: string; conversationContext?: string; extraInstruction?: string }) =>
    req<{ plan: AutomationReplyPlan }>('/api/admin/automation/reply-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  automationAudit: (limit = 200) =>
    req<{ events: AutomationAuditEvent[] }>(`/api/admin/automation/audit?limit=${encodeURIComponent(limit)}`),
  automationAiDraft: (payload: { inboundText: string; conversationContext?: string; extraInstruction?: string }) =>
    req<{ draft: string; risk: { level: 'normal' | 'review' | 'block'; reasons: string[] }; model: string; knowledgeRefs: AutomationKnowledgeReference[] }>(
      '/api/admin/automation/ai-draft',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  automationMomentAiDraft: (payload: { topic: string; audience?: string; tone?: string; extraInstruction?: string }) =>
    req<{ draft: string; risk: { level: 'normal' | 'review' | 'block'; reasons: string[] }; model: string; knowledgeRefs: AutomationKnowledgeReference[] }>(
      '/api/admin/automation/moment-drafts/ai-draft',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  automationMassAiDraft: (payload: { topic: string; audience?: string; tone?: string; extraInstruction?: string }) =>
    req<{ draft: string; risk: { level: 'normal' | 'review' | 'block'; reasons: string[] }; model: string; knowledgeRefs: AutomationKnowledgeReference[] }>(
      '/api/admin/automation/mass-jobs/ai-draft',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  automationCampaignKitAiDraft: (payload: { topic: string; audience?: string; tone?: string; extraInstruction?: string }) =>
    req<{
      mass: { draft: string; risk: { level: 'normal' | 'review' | 'block'; reasons: string[] }; model: string; knowledgeRefs: AutomationKnowledgeReference[] };
      moment: { draft: string; risk: { level: 'normal' | 'review' | 'block'; reasons: string[] }; model: string; knowledgeRefs: AutomationKnowledgeReference[] };
      knowledgeRefs: AutomationKnowledgeReference[];
    }>('/api/admin/automation/campaign-kit/ai-draft', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listMassSendJobs: (limit = 100) =>
    req<{ jobs: MassSendJob[] }>(`/api/admin/automation/mass-jobs?limit=${encodeURIComponent(limit)}`),
  createMassSendJob: (payload: {
    title: string;
    message: string;
    recipients: string[];
    scheduledAt?: string;
    options?: {
      perSendDelaySeconds?: number;
      requireOperatorConfirmRecipient?: boolean;
      openConversationBeforeSend?: boolean;
      searchShortcut?: string;
      searchResultDelaySeconds?: number;
      postOpenDelaySeconds?: number;
    };
  }) =>
    req<{ job: MassSendJob }>('/api/admin/automation/mass-jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMassSendJobFromAudience: (payload: {
    title: string;
    message: string;
    scheduledAt?: string;
    audienceFilter?: {
      query?: string;
      tag?: string;
      tags?: string[];
      type?: AutomationAudienceMassJobTypeFilter;
      requireApproved?: boolean;
      requireEnabled?: boolean;
      limit?: number;
    };
    options?: {
      perSendDelaySeconds?: number;
      requireOperatorConfirmRecipient?: boolean;
      openConversationBeforeSend?: boolean;
      searchShortcut?: string;
      searchResultDelaySeconds?: number;
      postOpenDelaySeconds?: number;
    };
  }) =>
    req<{ job: MassSendJob; selection: AutomationAudienceMassJobSelection }>('/api/admin/automation/mass-jobs/from-audience', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  patchMassSendJob: (jobId: string, payload: Partial<Pick<MassSendJob, 'title' | 'message' | 'status' | 'approved' | 'scheduledAt'>> & { options?: Partial<MassSendJob['options']> }) =>
    req<{ job: MassSendJob }>(`/api/admin/automation/mass-jobs/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  patchMassSendItem: (jobId: string, itemId: string, payload: { status: MassSendItem['status']; error?: string; reason?: string }) =>
    req<{ job: MassSendJob }>(`/api/admin/automation/mass-jobs/${jobId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  listMomentDrafts: (limit = 100) =>
    req<{ drafts: MomentDraft[] }>(`/api/admin/automation/moment-drafts?limit=${encodeURIComponent(limit)}`),
  createMomentDraft: (payload: { title: string; text: string; imageNotes?: string; materials?: string[]; scheduledAt?: string }) =>
    req<{ draft: MomentDraft }>('/api/admin/automation/moment-drafts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  patchMomentDraft: (draftId: string, payload: Partial<Pick<MomentDraft, 'title' | 'text' | 'imageNotes' | 'materials' | 'status' | 'approved' | 'scheduledAt'>>) =>
    req<{ draft: MomentDraft }>(`/api/admin/automation/moment-drafts/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  automationSendRule: (
    id: string,
    payload: { ruleId: string; inboundText?: string; conversationName?: string; confirm: boolean },
  ) =>
    req<{ event: AutomationAuditEvent }>(`/api/admin/instances/${id}/automation/send-rule`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  automationSendText: (
    id: string,
    payload: { text: string; inboundText?: string; conversationName?: string; confirm: boolean; allowReview?: boolean },
  ) =>
    req<{ event: AutomationAuditEvent }>(`/api/admin/instances/${id}/automation/send-text`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  automationReadClipboard: (id: string, payload: { copySelection?: boolean }) =>
    req<{ text: string }>(`/api/admin/instances/${id}/automation/read-clipboard`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  automationSelfTest: (id: string) =>
    req<{ result: InstanceAutomationSelfTest }>(`/api/admin/instances/${id}/automation/self-test`, { method: 'POST' }),
  automationInspect: (id: string, payload: { includeScreenshot?: boolean; includeOcr?: boolean }) =>
    req<{ snapshot: InstanceAutomationVisualSnapshot }>(`/api/admin/instances/${id}/automation/inspect`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  automationVerifyTarget: (id: string, payload: { expectedName: string; aliases?: string[]; includeScreenshot?: boolean }) =>
    req<InstanceAutomationTargetVerifyResult>(`/api/admin/instances/${id}/automation/verify-target`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  automationSendNextMassItem: (
    id: string,
    jobId: string,
    payload: { confirm: boolean; operatorConfirmedRecipient: boolean; openConversationBeforeSend?: boolean },
  ) =>
    req<{ job: MassSendJob; item: MassSendItem; event: AutomationAuditEvent; openedConversation: boolean }>(
      `/api/admin/instances/${id}/automation/mass-jobs/${jobId}/send-next`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  automationPrepareMomentDraft: (id: string, draftId: string, payload: { confirm: boolean; mode?: 'fill-current-input' | 'copy-to-clipboard' }) =>
    req<{ draft: MomentDraft; event: AutomationAuditEvent; mode: 'fill-current-input' | 'copy-to-clipboard' }>(
      `/api/admin/instances/${id}/automation/moment-drafts/${draftId}/prepare`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  // 子账号
  listUsers: () => req<{ users: PanelUser[] }>('/api/admin/users'),
  createUser: (username: string, password: string, allowedInstances: string[] = []) =>
    req<{ user: PanelUser }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, allowedInstances }),
    }),
  setDisabled: (id: string, disabled: boolean) =>
    req<{ user: PanelUser }>(`/api/admin/users/${id}/disable`, { method: 'POST', body: JSON.stringify({ disabled }) }),
  resetUser: (id: string, newPassword: string) =>
    req<{ user: PanelUser }>(`/api/admin/users/${id}/reset`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  deleteUser: (id: string) => req(`/api/admin/users/${id}`, { method: 'DELETE' }),
  setUserInstances: (id: string, instanceIds: string[]) =>
    req<{ user: PanelUser }>(`/api/admin/users/${id}/instances`, { method: 'POST', body: JSON.stringify({ instanceIds }) }),

  // 微信实例
  listInstances: () => req<{ instances: InstanceWithStatus[] }>('/api/instances'),
  createInstance: (name: string, allowedUserIds: string[] = [], reuseVolume?: string, appType: AppType = 'wechat') =>
    req<{ instance: PanelInstance }>('/api/admin/instances', {
      method: 'POST',
      body: JSON.stringify({ name, allowedUserIds, reuseVolume: reuseVolume || undefined, appType }),
    }),
  regenMachineId: (id: string) =>
    req(`/api/admin/instances/${id}/regen-machine-id`, { method: 'POST' }),
  getInstanceMemLimits: (id: string) =>
    req<MemLimits>(`/api/admin/instances/${id}/mem-limits`),
  setInstanceMemLimits: (id: string, soft: number | null | undefined, hard: number | null | undefined) =>
    req<{ instance: PanelInstance }>(`/api/admin/instances/${id}/mem-limits`, {
      method: 'PUT',
      body: JSON.stringify({ soft, hard }),
    }),
  listOrphanVolumes: () =>
    req<{ volumes: { name: string; createdAt?: string; sizeBytes?: number }[] }>('/api/admin/orphan-volumes'),
  deleteOrphanVolume: (name: string) =>
    req(`/api/admin/orphan-volumes/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  listOrphanContainers: () =>
    req<{ containers: { id: string; name: string; status: string; volumeName?: string }[] }>('/api/admin/orphan-containers'),
  deleteOrphanContainer: (idOrName: string) =>
    req(`/api/admin/orphan-containers/${encodeURIComponent(idOrName)}`, { method: 'DELETE' }),
  setInstanceIcon: (id: string, icon: string | null) =>
    req<{ instance: PanelInstance }>(`/api/admin/instances/${id}/icon`, { method: 'POST', body: JSON.stringify({ icon }) }),
  renameInstance: (id: string, name: string) =>
    req<{ instance: PanelInstance }>(`/api/admin/instances/${id}/rename`, { method: 'POST', body: JSON.stringify({ name }) }),
  deleteInstance: (id: string, purge = false) =>
    req(`/api/admin/instances/${id}${purge ? '?purge=1' : ''}`, { method: 'DELETE' }),
  setInstanceUsers: (id: string, userIds: string[]) =>
    req(`/api/admin/instances/${id}/users`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  instanceWechatStatus: (id: string) => req<{ status: WechatStatus }>(`/api/instances/${id}/wechat/status`),
  // 卡死自愈：VNC 多次重连仍连不上时，重启该实例恢复（限频；需对实例有访问权）。
  healInstance: (id: string) => req<{ ok: boolean; restarted: boolean }>(`/api/instances/${id}/heal`, { method: 'POST' }),
  // 客户端连接日志：把前端的 VNC 连接态/动作回传服务端，记进实例日志（[client] 前缀），便于排查。Fire-and-forget。
  clientLog: (id: string, msg: string) => {
    req(`/api/instances/${id}/clientlog`, { method: 'POST', body: JSON.stringify({ msg }) }).catch(() => {});
  },
  instanceWechatInstall: (id: string) => req(`/api/admin/instances/${id}/wechat/install`, { method: 'POST' }),
  instanceWechatUpdate: (id: string) => req(`/api/admin/instances/${id}/wechat/update`, { method: 'POST' }),
  instanceStart: (id: string) => req(`/api/admin/instances/${id}/start`, { method: 'POST' }),
  instanceStop: (id: string) => req(`/api/admin/instances/${id}/stop`, { method: 'POST' }),
  instanceRestart: (id: string) => req(`/api/admin/instances/${id}/restart`, { method: 'POST' }),
  instanceUpgrade: (id: string) => req(`/api/admin/instances/${id}/upgrade`, { method: 'POST' }),
  instanceLogsUrl: (id: string) => `/api/admin/instances/${id}/logs`,
  // 全局日志 / 诊断包（范围 24h/7d/30d/1y）
  diagnosticsUrl: (range: string) => `/api/admin/diagnostics?range=${encodeURIComponent(range)}`,
  panelLogUrl: (range: string) => `/api/admin/panel-log?range=${encodeURIComponent(range)}`,

  // 文件中转
  listFiles: (id: string) => req<{ files: { name: string; size: number }[] }>(`/api/instances/${id}/files`),
  uploadFile: async (id: string, file: File) => {
    const res = await fetch(`/api/instances/${id}/upload?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).error || '上传失败');
    return res.json();
  },
  downloadFileUrl: (id: string, name: string) => `/api/instances/${id}/download?name=${encodeURIComponent(name)}`,
  deleteFile: (id: string, name: string) => req(`/api/instances/${id}/files?name=${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // 数据卷管理（仅管理员）
  volumeList: (id: string, path = '') =>
    req<{ path: string; entries: VolEntry[] }>(`/api/admin/instances/${id}/volume?path=${encodeURIComponent(path)}`),
  volumeMkdir: (id: string, path: string) =>
    req(`/api/admin/instances/${id}/volume/mkdir`, { method: 'POST', body: JSON.stringify({ path }) }),
  volumeMove: (id: string, from: string, to: string) =>
    req(`/api/admin/instances/${id}/volume/move`, { method: 'POST', body: JSON.stringify({ from, to }) }),
  volumeDelete: (id: string, path: string) =>
    req(`/api/admin/instances/${id}/volume?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  volumeDownloadUrl: (id: string, path: string) =>
    `/api/admin/instances/${id}/volume/download?path=${encodeURIComponent(path)}`,
  volumeBackupUrl: (id: string) => `/api/admin/instances/${id}/volume/backup`,
  volumeUpload: (id: string, path: string, file: File) =>
    rawUpload(`/api/admin/instances/${id}/volume/upload?path=${encodeURIComponent(path)}&name=${encodeURIComponent(file.name)}`, file),
  volumeExtract: (id: string, path: string, file: File) =>
    rawUpload(`/api/admin/instances/${id}/volume/extract?path=${encodeURIComponent(path)}`, file),
  volumeRestore: (id: string, file: File) =>
    rawUpload(`/api/admin/instances/${id}/volume/restore`, file),

  // 多端协作：操作控制权
  controlStatus: (id: string) => req<{ free: boolean; mine: boolean; holder: string | null }>(`/api/instances/${id}/control`),
  controlBeat: (id: string) => req<{ mine: boolean; holder: string }>(`/api/instances/${id}/control/beat`, { method: 'POST' }),
  controlTake: (id: string) => req<{ mine: boolean; holder: string }>(`/api/instances/${id}/control/take`, { method: 'POST' }),
  typeInInstance: (id: string, text: string) => req(`/api/instances/${id}/type`, { method: 'POST', body: JSON.stringify({ text }) }),
  keyInInstance: (id: string, key: string) => req(`/api/instances/${id}/key`, { method: 'POST', body: JSON.stringify({ key }) }),
};
