import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Instance, User } from './store.js';

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

export interface WecomBridgeMaterialMapItem {
  key: string;
  path: string;
  localPath: string;
  title: string;
  kind: AutomationMaterialKind;
  source: string;
  tags: string[];
  description: string;
  url?: string;
}

export interface WecomBridgeMaterialMap {
  generatedAt: string;
  source: string;
  format: 'materials';
  materials: WecomBridgeMaterialMapItem[];
  map: Record<string, string>;
  skipped: { key: string; title: string; reason: string }[];
}

export type WecomBridgeEventStatus = 'new' | 'planned' | 'archived';
type WecomBridgeReplyDeliveryStatus = 'claimed' | 'failed' | 'delivered' | 'released';
type WecomBridgeMassDeliveryStatus = 'claimed' | 'failed' | 'sent' | 'delivered' | 'released';
type WecomBridgeMomentDeliveryStatus = 'claimed' | 'failed' | 'prepared' | 'published' | 'released';

export interface WecomBridgeEvent {
  id: string;
  source: string;
  externalId?: string;
  conversationName: string;
  senderName: string;
  inboundText: string;
  conversationContext: string;
  status: WecomBridgeEventStatus;
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

export interface WecomBridgeWorker {
  id: string;
  workerId: string;
  source: string;
  mode: string;
  host: string;
  pid?: number;
  version?: string;
  note?: string;
  pendingReplies: number;
  pendingMassTasks: number;
  pendingMomentTasks: number;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WecomBridgeWorkerStatus extends WecomBridgeWorker {
  online: boolean;
  staleSeconds: number;
  offlineAfterSeconds: number;
}

export type WecomBridgeRunTarget = 'replies' | 'mass' | 'moments' | 'all' | 'unknown';
export type WecomBridgeRunStatus = 'started' | 'completed' | 'failed';
export type WecomBridgeRunnerMode = 'dry-run' | 'prepare' | 'send';
export type WecomBridgeRunnerTarget = 'replies' | 'mass' | 'moments' | 'all';
export type WecomBridgeMomentPasteMode = 'clipboard-only' | 'current-input';
export type WecomBridgeRunReportItemTarget = 'reply' | 'mass' | 'moment' | 'unknown';
export type BridgeRecoveryReleaseMode = 'none' | 'expired' | 'all';

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
  items: WecomBridgeRunReportItem[];
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
  mode: WecomBridgeRunnerMode;
  target: WecomBridgeRunnerTarget;
  limit: number;
  claimTtlSeconds: number;
  heartbeatIntervalSeconds: number;
  momentPasteMode: WecomBridgeMomentPasteMode;
  allowSend: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface WecomBridgeEventIngestResult {
  events: WecomBridgeEvent[];
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface AutomationSettings {
  enabled: boolean;
  aiDraftEnabled: boolean;
  automaticRuleRepliesEnabled: boolean;
  massSendEnabled: boolean;
  momentsEnabled: boolean;
  maximumAutomaticSendsPerHour: number;
  perConversationCooldownMinutes: number;
  requireConfirmForSend: boolean;
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

export type RiskLevel = 'normal' | 'review' | 'block';

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

export interface AutomationDecision {
  action: 'send-rule' | 'review' | 'none' | 'blocked';
  rule: AutomationRule | null;
  risk: RiskAssessment;
  reasons: string[];
}

export type ReplyPlanMode = 'keyword-rule' | 'ai-draft' | 'manual-review' | 'blocked';

export interface AutomationReplyPlan {
  mode: ReplyPlanMode;
  decision: AutomationDecision;
  draft: string;
  model?: string;
  ruleId?: string;
  canSendRule: boolean;
  canSendText: boolean;
  reasons: string[];
}

export type MassSendItemStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type MassSendJobStatus = 'draft' | 'queued' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface MassSendItem {
  id: string;
  recipientName: string;
  status: MassSendItemStatus;
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

export interface MassSendJobOptions {
  perSendDelaySeconds: number;
  requireOperatorConfirmRecipient: boolean;
  openConversationBeforeSend: boolean;
  searchShortcut: string;
  searchResultDelaySeconds: number;
  postOpenDelaySeconds: number;
}

export interface MassSendJob {
  id: string;
  title: string;
  message: string;
  status: MassSendJobStatus;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  options: MassSendJobOptions;
  items: MassSendItem[];
}

export interface WecomBridgeMassSendTask {
  id: string;
  jobId: string;
  itemId: string;
  jobTitle: string;
  recipientName: string;
  message: string;
  options: MassSendJobOptions;
  claimedAt?: string;
  claimedBy?: string;
  claimExpiresAt?: string;
}

export type MomentDraftStatus = 'draft' | 'ready' | 'prepared' | 'published' | 'archived';

export interface MomentDraft {
  id: string;
  title: string;
  text: string;
  imageNotes: string;
  materials: string[];
  status: MomentDraftStatus;
  approved: boolean;
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

export interface WecomBridgeMomentTask {
  id: string;
  draftId: string;
  title: string;
  text: string;
  imageNotes: string;
  materials: string[];
  status: MomentDraftStatus;
  claimedAt?: string;
  claimedBy?: string;
  claimExpiresAt?: string;
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
  riskLevel?: RiskLevel;
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
  bridgeWorkers?: WecomBridgeWorker[];
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

interface AutomationData extends AutomationConfig {
  audienceContacts: AutomationAudienceContact[];
  materialAssets: AutomationMaterialAsset[];
  bridgeEvents: WecomBridgeEvent[];
  bridgeWorkers: WecomBridgeWorker[];
  bridgeRunReports: WecomBridgeRunReport[];
  runnerPolicy: WecomBridgeRunnerPolicy;
  massSendJobs: MassSendJob[];
  momentDrafts: MomentDraft[];
  auditEvents: AutomationAuditEvent[];
}

const FILE = process.env.PANEL_AUTOMATION_DATA || '/data/automation.json';
const MAX_AUDIT_EVENTS = 1000;
const MAX_KNOWLEDGE_ITEMS = 500;
const MAX_AUDIENCE_CONTACTS = 2000;
const MAX_MATERIAL_ASSETS = 1000;
const MAX_BRIDGE_EVENTS = 500;
const MAX_BRIDGE_WORKERS = 100;
const MAX_BRIDGE_RUN_REPORTS = 300;
const MAX_BRIDGE_RUN_REPORT_ITEMS = 100;
const DEFAULT_BRIDGE_REPLY_CLAIM_TTL_SECONDS = 300;

const DEFAULT_RUNNER_POLICY: WecomBridgeRunnerPolicy = {
  mode: 'dry-run',
  target: 'all',
  limit: 5,
  claimTtlSeconds: 300,
  heartbeatIntervalSeconds: 60,
  momentPasteMode: 'clipboard-only',
  allowSend: false,
  updatedAt: '',
  updatedBy: 'system',
};

const DEFAULT_SETTINGS: AutomationSettings = {
  enabled: false,
  aiDraftEnabled: true,
  automaticRuleRepliesEnabled: true,
  massSendEnabled: false,
  momentsEnabled: false,
  maximumAutomaticSendsPerHour: 20,
  perConversationCooldownMinutes: 10,
  requireConfirmForSend: true,
};

const DEFAULT_DATA: AutomationData = {
  settings: DEFAULT_SETTINGS,
  persona: '',
  knowledgeNotes: '',
  rules: [],
  knowledgeItems: [],
  audienceContacts: [],
  materialAssets: [],
  bridgeEvents: [],
  bridgeWorkers: [],
  bridgeRunReports: [],
  runnerPolicy: DEFAULT_RUNNER_POLICY,
  massSendJobs: [],
  momentDrafts: [],
  auditEvents: [],
};

let data: AutomationData = structuredClone(DEFAULT_DATA);

export function initAutomationStore() {
  if (existsSync(FILE)) {
    const parsed = JSON.parse(readFileSync(FILE, 'utf8'));
    data = normalizeData(parsed, false);
  } else {
    data = structuredClone(DEFAULT_DATA);
  }
  persist();
}

export function getAutomationConfig(): AutomationConfig {
  return {
    settings: { ...data.settings },
    persona: data.persona,
    knowledgeNotes: data.knowledgeNotes,
    rules: data.rules.map(cloneRule),
    knowledgeItems: data.knowledgeItems.map(cloneKnowledgeItem),
  };
}

export function getAutomationOverview(): AutomationOverview {
  const nowIso = new Date().toISOString();
  const workers = data.bridgeWorkers.map((worker) => publicBridgeWorker(worker));
  const activeBridgeEvents = data.bridgeEvents.filter((event) => event.status !== 'archived');
  const massItems = data.massSendJobs.flatMap((job) => job.items);
  const lastAudit = data.auditEvents[data.auditEvents.length - 1];
  const lastRun = data.bridgeRunReports
    .slice()
    .sort((a, b) => Date.parse(b.finishedAt || b.updatedAt) - Date.parse(a.finishedAt || a.updatedAt))[0];
  const pendingReplies = activeBridgeEvents.filter(
    (event) =>
      event.replyApproved &&
      hasRunnableBridgeReply(event) &&
      (!event.replyClaimedAt || isBridgeReplyClaimExpired(event, nowIso)) &&
      !event.replyDeliveredAt,
  ).length;
  const claimedReplies = activeBridgeEvents.filter(
    (event) => event.replyApproved && hasRunnableBridgeReply(event) && !!event.replyClaimedAt && !isBridgeReplyClaimExpired(event, nowIso) && !event.replyDeliveredAt,
  ).length;
  const pendingMassTasks = data.massSendJobs.reduce((sum, job) => {
    if (!isMassJobBridgeRunnable(job)) return sum;
    return (
      sum +
      job.items.filter((item) => item.status === 'pending' && (!item.bridgeClaimedAt || isMassItemBridgeClaimExpired(item, nowIso))).length
    );
  }, 0);
  const claimedMassTasks = data.massSendJobs.reduce(
    (sum, job) => sum + job.items.filter((item) => item.status === 'pending' && !!item.bridgeClaimedAt && !isMassItemBridgeClaimExpired(item, nowIso)).length,
    0,
  );
  const pendingMomentTasks = data.momentDrafts.filter(
    (draft) => isMomentDraftBridgeRunnable(draft) && (!draft.bridgeClaimedAt || isMomentDraftBridgeClaimExpired(draft, nowIso)),
  ).length;
  const claimedMomentTasks = data.momentDrafts.filter(
    (draft) => draft.status === 'ready' && !!draft.bridgeClaimedAt && !isMomentDraftBridgeClaimExpired(draft, nowIso),
  ).length;
  const lastWorkerSeenAt = data.bridgeWorkers
    .map((worker) => worker.lastSeenAt || worker.updatedAt)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const riskFlags: string[] = [];
  if (!data.settings.enabled) riskFlags.push('automation_off');
  if (data.settings.enabled && data.bridgeWorkers.length > 0 && workers.every((worker) => !worker.online)) riskFlags.push('bridge_workers_offline');
  if (pendingReplies + pendingMassTasks + pendingMomentTasks > 0 && workers.every((worker) => !worker.online)) riskFlags.push('pending_without_worker');
  if (massItems.some((item) => item.status === 'failed')) riskFlags.push('mass_failures');
  if (data.momentDrafts.some((draft) => !!draft.bridgeFailedAt)) riskFlags.push('moment_failures');

  return {
    generatedAt: nowIso,
    settings: { ...data.settings },
    knowledge: {
      total: data.knowledgeItems.length,
      approved: data.knowledgeItems.filter((item) => item.approved).length,
      enabled: data.knowledgeItems.filter((item) => item.enabled).length,
    },
    materials: {
      total: data.materialAssets.length,
      approved: data.materialAssets.filter((asset) => asset.approved).length,
      enabled: data.materialAssets.filter((asset) => asset.enabled).length,
      images: data.materialAssets.filter((asset) => asset.kind === 'image').length,
    },
    audience: {
      total: data.audienceContacts.length,
      enabled: data.audienceContacts.filter((contact) => contact.enabled).length,
      approved: data.audienceContacts.filter((contact) => contact.approved).length,
      groups: data.audienceContacts.filter((contact) => contact.type === 'group' || contact.type === 'room').length,
      contacts: data.audienceContacts.filter((contact) => contact.type === 'contact').length,
    },
    rules: {
      total: data.rules.length,
      enabled: data.rules.filter((rule) => rule.enabled).length,
      approved: data.rules.filter((rule) => rule.approved).length,
    },
    bridge: {
      workersTotal: workers.length,
      workersOnline: workers.filter((worker) => worker.online).length,
      lastWorkerSeenAt,
      events: {
        active: activeBridgeEvents.length,
        new: activeBridgeEvents.filter((event) => event.status === 'new').length,
        planned: activeBridgeEvents.filter((event) => event.status === 'planned').length,
        approvedPending: pendingReplies,
        claimed: claimedReplies,
        failed: activeBridgeEvents.filter((event) => !!event.replyFailedAt).length,
        delivered: activeBridgeEvents.filter((event) => !!event.replyDeliveredAt).length,
      },
      pendingReplies,
      pendingMassTasks,
      pendingMomentTasks,
      runs: {
        total: data.bridgeRunReports.length,
        recentFailures: data.bridgeRunReports.slice(-50).filter((report) => report.status === 'failed').length,
        lastRunAt: lastRun?.finishedAt || lastRun?.updatedAt,
        lastRunStatus: lastRun?.status,
        lastRunTarget: lastRun?.target,
      },
      runnerPolicy: cloneRunnerPolicy(data.runnerPolicy),
    },
    mass: {
      jobsTotal: data.massSendJobs.length,
      draft: data.massSendJobs.filter((job) => job.status === 'draft').length,
      queued: data.massSendJobs.filter((job) => job.status === 'queued').length,
      running: data.massSendJobs.filter((job) => job.status === 'running').length,
      paused: data.massSendJobs.filter((job) => job.status === 'paused').length,
      completed: data.massSendJobs.filter((job) => job.status === 'completed').length,
      cancelled: data.massSendJobs.filter((job) => job.status === 'cancelled').length,
      approvedRunnableJobs: data.massSendJobs.filter(isMassJobBridgeRunnable).length,
      itemsPending: massItems.filter((item) => item.status === 'pending').length,
      itemsSent: massItems.filter((item) => item.status === 'sent').length,
      itemsFailed: massItems.filter((item) => item.status === 'failed').length,
      itemsSkipped: massItems.filter((item) => item.status === 'skipped').length,
      bridgeClaimedItems: claimedMassTasks,
    },
    moments: {
      draftsTotal: data.momentDrafts.length,
      draft: data.momentDrafts.filter((draft) => draft.status === 'draft').length,
      ready: data.momentDrafts.filter((draft) => draft.status === 'ready').length,
      prepared: data.momentDrafts.filter((draft) => draft.status === 'prepared').length,
      published: data.momentDrafts.filter((draft) => draft.status === 'published').length,
      archived: data.momentDrafts.filter((draft) => draft.status === 'archived').length,
      approvedReady: data.momentDrafts.filter(isMomentDraftBridgeRunnable).length,
      bridgeClaimedDrafts: claimedMomentTasks,
      bridgeFailedDrafts: data.momentDrafts.filter((draft) => !!draft.bridgeFailedAt).length,
    },
    audit: {
      total: data.auditEvents.length,
      lastAt: lastAudit?.timestamp,
      lastAction: lastAudit?.action,
    },
    riskFlags,
  };
}

export function getAutomationPreflightReport(): AutomationPreflightReport {
  const nowIso = new Date().toISOString();
  const overview = getAutomationOverview();
  const checks: AutomationPreflightCheck[] = [];
  const enabledApprovedRules = data.rules.filter((rule) => rule.enabled && rule.approved);
  const runnableRuleCount = enabledApprovedRules.filter(hasRunnableSteps).length;
  const pendingTotal = overview.bridge.pendingReplies + overview.bridge.pendingMassTasks + overview.bridge.pendingMomentTasks;
  const runnableMassJobs = data.massSendJobs.filter(isMassJobBridgeRunnable);
  const readyMomentDrafts = data.momentDrafts.filter((draft) => draft.approved && draft.status === 'ready' && !!draft.text.trim());
  const add = (check: AutomationPreflightCheck) => checks.push(check);

  if (data.settings.enabled) {
    add({
      id: 'automation_enabled',
      level: 'ok',
      title: '自动化总开关已开启',
      message: 'AI 回复、群发和朋友圈队列可以按各自开关进入执行链路。',
    });
  } else {
    add({
      id: 'automation_off',
      level: 'block',
      title: '自动化总开关关闭',
      message: 'Bridge 拉取、群发队列和朋友圈草稿都会被总开关拦截。',
      action: '在自动化工作台开启总开关后再运行 Mac Runner。',
    });
  }

  if (overview.bridge.workersOnline > 0) {
    add({
      id: 'bridge_worker_online',
      level: 'ok',
      title: 'Mac Bridge 在线',
      message: `${overview.bridge.workersOnline} 个 Runner 最近上报了心跳。`,
      count: overview.bridge.workersOnline,
    });
  } else if (pendingTotal > 0) {
    add({
      id: 'pending_without_worker',
      level: 'block',
      title: '有待办但没有在线 Mac Bridge',
      message: `当前有 ${pendingTotal} 个出箱待办，没有在线 Runner 可以领取。`,
      count: pendingTotal,
      action: '启动 Mac 端 wecom-bridge-runner，并确认心跳回到面板。',
    });
  } else if (overview.bridge.workersTotal > 0) {
    add({
      id: 'bridge_workers_offline',
      level: 'warn',
      title: 'Mac Bridge 暂时离线',
      message: '历史 Runner 已登记，但当前都不在线；有新队列时不会自动执行。',
      action: '需要自动处理时启动 Mac Runner。',
    });
  } else {
    add({
      id: 'bridge_worker_not_registered',
      level: 'warn',
      title: '尚未登记 Mac Bridge',
      message: '面板还没有收到过 Mac Runner 心跳，自动化只能先停留在云端队列。',
      action: '按“企微 Bridge”区域的环境变量和命令启动 Runner。',
    });
  }

  if (!data.settings.automaticRuleRepliesEnabled && runnableRuleCount > 0) {
    add({
      id: 'rule_replies_off',
      level: 'warn',
      title: '规则自动回复关闭',
      message: `${runnableRuleCount} 条已审核规则不会自动生成可发送回复。`,
      count: runnableRuleCount,
      action: '如需关键词规则自动生效，开启“规则自动回复”。',
    });
  }

  if (!data.settings.aiDraftEnabled && overview.bridge.events.active > 0) {
    add({
      id: 'ai_draft_off',
      level: 'warn',
      title: 'AI 草稿关闭',
      message: '企微消息仍会进入 Bridge 收件箱，但不会自动生成 AI 草稿。',
      count: overview.bridge.events.active,
    });
  }

  if (!data.settings.massSendEnabled && runnableMassJobs.length > 0) {
    const pending = runnableMassJobs.reduce((sum, job) => sum + job.items.filter((item) => item.status === 'pending').length, 0);
    add({
      id: 'mass_send_off',
      level: 'block',
      title: '群发队列开关关闭',
      message: `${runnableMassJobs.length} 个已审核群发队列不会被 Bridge 拉取。`,
      count: pending,
      refs: runnableMassJobs.slice(0, 8).map((job) => job.title),
      action: '确认队列内容后开启“群发队列”。',
    });
  }

  if (!data.settings.momentsEnabled && readyMomentDrafts.length > 0) {
    add({
      id: 'moments_off',
      level: 'block',
      title: '朋友圈半自动开关关闭',
      message: `${readyMomentDrafts.length} 个已就绪朋友圈草稿不会被 Bridge 拉取。`,
      count: readyMomentDrafts.length,
      refs: readyMomentDrafts.slice(0, 8).map((draft) => draft.title),
      action: '确认草稿后开启“朋友圈半自动”。',
    });
  }

  const missingTriggerRules = enabledApprovedRules.filter((rule) => rule.triggers.length === 0);
  if (missingTriggerRules.length > 0) {
    add({
      id: 'rule_missing_triggers',
      level: 'warn',
      title: '规则缺少触发词',
      message: `${missingTriggerRules.length} 条已审核规则不会命中任何消息。`,
      count: missingTriggerRules.length,
      refs: missingTriggerRules.slice(0, 8).map((rule) => rule.name),
      action: '给这些规则补充触发词，或停用不再需要的规则。',
    });
  }

  const missingStepRules = enabledApprovedRules.filter((rule) => !hasRunnableSteps(rule));
  if (missingStepRules.length > 0) {
    add({
      id: 'rule_missing_steps',
      level: 'block',
      title: '规则缺少可执行回复',
      message: `${missingStepRules.length} 条已审核规则没有文本、按键或图片步骤。`,
      count: missingStepRules.length,
      refs: missingStepRules.slice(0, 8).map((rule) => rule.name),
      action: '补充回复步骤后再批准规则。',
    });
  }

  const materialReferences = collectMaterialReferences();
  const materialIssues = checkMaterialReferences(materialReferences);
  for (const issue of materialIssues) add(issue);
  if (materialReferences.length > 0 && materialIssues.length === 0) {
    add({
      id: 'material_references_ok',
      level: 'ok',
      title: '素材引用可用',
      message: `${materialReferences.length} 个素材引用均已启用、审核并配置本机路径。`,
      count: materialReferences.length,
    });
  }

  const directImageRefs = collectDirectImagePathReferences();
  if (directImageRefs.length > 0) {
    add({
      id: 'direct_image_paths',
      level: 'warn',
      title: '图片步骤使用直接路径',
      message: `${directImageRefs.length} 个图片步骤使用了本机路径，NAS 无法确认 Mac 上文件是否存在。`,
      count: directImageRefs.length,
      refs: directImageRefs.slice(0, 8),
      action: '建议导入素材资产并改用 imageKey，便于统一预检和迁移。',
    });
  }

  const riskyMassJobs = runnableMassJobs
    .map((job) => ({ job, risk: assessRisk([job.message]) }))
    .filter((hit) => hit.risk.level !== 'normal');
  if (riskyMassJobs.length > 0) {
    add({
      id: 'mass_content_risk',
      level: 'block',
      title: '群发内容触发风控',
      message: `${riskyMassJobs.length} 个群发队列会被领取逻辑拦截。`,
      count: riskyMassJobs.length,
      refs: riskyMassJobs.slice(0, 8).map((hit) => `${hit.job.title}：${hit.risk.reasons.join('；')}`),
      action: '调整群发内容，或拆到人工审核流程。',
    });
  }

  const riskyMomentDrafts = readyMomentDrafts
    .map((draft) => ({ draft, risk: assessRisk([draft.text, draft.imageNotes]) }))
    .filter((hit) => hit.risk.level !== 'normal');
  if (riskyMomentDrafts.length > 0) {
    add({
      id: 'moment_content_risk',
      level: 'block',
      title: '朋友圈内容触发风控',
      message: `${riskyMomentDrafts.length} 个朋友圈草稿会被领取逻辑拦截。`,
      count: riskyMomentDrafts.length,
      refs: riskyMomentDrafts.slice(0, 8).map((hit) => `${hit.draft.title}：${hit.risk.reasons.join('；')}`),
      action: '调整文案或图片说明后重新审核。',
    });
  }

  if (overview.mass.itemsFailed > 0) {
    add({
      id: 'mass_failures',
      level: 'warn',
      title: '存在失败的群发目标',
      message: `${overview.mass.itemsFailed} 个群发目标处于失败状态。`,
      count: overview.mass.itemsFailed,
      action: '查看失败原因，修正后重新置为待发或跳过。',
    });
  }

  if (overview.moments.bridgeFailedDrafts > 0) {
    add({
      id: 'moment_failures',
      level: 'warn',
      title: '存在失败的朋友圈草稿',
      message: `${overview.moments.bridgeFailedDrafts} 个朋友圈草稿曾被 Mac Runner 标记失败。`,
      count: overview.moments.bridgeFailedDrafts,
      action: '打开草稿检查错误信息，修正后重新审核。',
    });
  }

  if (overview.bridge.runs.recentFailures > 0) {
    add({
      id: 'recent_runner_failures',
      level: 'warn',
      title: '近期 Runner 有失败记录',
      message: `最近 50 次 Runner 上报中有 ${overview.bridge.runs.recentFailures} 次失败。`,
      count: overview.bridge.runs.recentFailures,
      action: '查看 Bridge 运行记录，确认 Mac 端窗口、权限和素材路径。',
    });
  }

  const policy = data.runnerPolicy;
  if (policy.mode === 'send' && !policy.allowSend) {
    add({
      id: 'runner_send_locked',
      level: 'warn',
      title: 'Runner 发送模式未放行',
      message: '远程策略设置为 send，但 allowSend 未开启；Mac Runner 会降级到 prepare。',
      action: '保持受控准备，或在确认风险后同时开启 allowSend 与 Mac 端 WECOM_ACCEPT_REMOTE_SEND。',
    });
  }
  if (overview.bridge.pendingReplies > 0 && !runnerPolicyIncludes(policy.target, 'replies')) {
    addRunnerTargetWarning('runner_target_excludes_replies', 'AI 回复', overview.bridge.pendingReplies, policy.target);
  }
  if (overview.bridge.pendingMassTasks > 0 && !runnerPolicyIncludes(policy.target, 'mass')) {
    addRunnerTargetWarning('runner_target_excludes_mass', '群发队列', overview.bridge.pendingMassTasks, policy.target);
  }
  if (overview.bridge.pendingMomentTasks > 0 && !runnerPolicyIncludes(policy.target, 'moments')) {
    addRunnerTargetWarning('runner_target_excludes_moments', '朋友圈', overview.bridge.pendingMomentTasks, policy.target);
  }

  function addRunnerTargetWarning(id: string, label: string, count: number, target: WecomBridgeRunnerTarget) {
    add({
      id,
      level: 'warn',
      title: `Runner 目标未包含${label}`,
      message: `${label}有 ${count} 个待办，但远程 Runner 目标是 ${target}。`,
      count,
      action: '把 Runner 目标切到 all，或为该队列单独启动 Runner。',
    });
  }

  const summary = preflightSummary(checks);
  return {
    generatedAt: nowIso,
    level: summary.block > 0 ? 'block' : summary.warn > 0 ? 'warn' : 'ok',
    summary,
    checks,
  };
}

export function updateAutomationConfig(raw: any): AutomationConfig {
  data = normalizeData(
    {
      settings: raw?.settings ?? data.settings,
      persona: raw?.persona ?? data.persona,
      knowledgeNotes: raw?.knowledgeNotes ?? data.knowledgeNotes,
      rules: raw?.rules ?? data.rules,
      knowledgeItems: raw?.knowledgeItems ?? data.knowledgeItems,
      audienceContacts: data.audienceContacts,
      materialAssets: data.materialAssets,
      bridgeEvents: data.bridgeEvents,
      bridgeWorkers: data.bridgeWorkers,
      bridgeRunReports: data.bridgeRunReports,
      runnerPolicy: data.runnerPolicy,
      massSendJobs: data.massSendJobs,
      momentDrafts: data.momentDrafts,
      auditEvents: data.auditEvents,
    },
    true,
  );
  persist();
  return getAutomationConfig();
}

export function exportAutomationBundle(raw: any = {}): AutomationBundle {
  const includeBridgeEvents = raw?.includeBridgeEvents === true;
  const includeOperational = raw?.includeOperational === true;
  const includeAudit = raw?.includeAudit === true;
  const bundle: AutomationBundle = {
    schema: 'wechat-on-cloud.automation-bundle',
    version: 1,
    exportedAt: new Date().toISOString(),
    summary: automationBundleSummary(data, includeBridgeEvents),
    config: getAutomationConfig(),
    audienceContacts: data.audienceContacts.map(cloneAudienceContact),
    materialAssets: data.materialAssets.map(cloneMaterialAsset),
    massSendJobs: data.massSendJobs.map(cloneMassSendJob),
    momentDrafts: data.momentDrafts.map(cloneMomentDraft),
    runnerPolicy: cloneRunnerPolicy(data.runnerPolicy),
  };
  if (includeBridgeEvents) bundle.bridgeEvents = data.bridgeEvents.map(cloneBridgeEvent);
  if (includeOperational) {
    bundle.bridgeWorkers = data.bridgeWorkers.map((worker) => ({ ...worker }));
    bundle.bridgeRunReports = data.bridgeRunReports.map(cloneBridgeRunReport);
  }
  if (includeAudit) bundle.auditEvents = data.auditEvents.map((event) => ({ ...event }));
  return bundle;
}

export function importAutomationBundle(actor: User, raw: any): AutomationBundleImportResult {
  const bundle = raw?.bundle && typeof raw.bundle === 'object' ? raw.bundle : raw;
  if (!bundle || typeof bundle !== 'object') throw new Error('资产包格式不合法');
  const mode: AutomationBundleMode = raw?.mode === 'append' ? 'append' : 'upsert';
  const dryRun = raw?.dryRun !== false;
  const includeConfig = raw?.includeConfig !== false;
  const includeQueues = raw?.includeQueues !== false;
  const keepOperationalState = raw?.keepOperationalState === true;
  const includeBridgeEvents = raw?.includeBridgeEvents === true && keepOperationalState;
  const now = new Date().toISOString();
  const target: AutomationData = structuredClone(data);
  const imported = emptyBundleCounters();
  const updated = emptyBundleCounters();
  const ids = emptyBundleIdLists();
  const errors: string[] = [];
  let skipped = 0;

  const configRaw = bundle.config && typeof bundle.config === 'object' ? bundle.config : bundle;
  if (includeConfig) {
    const settings = normalizeSettings(configRaw?.settings ?? bundle.settings);
    if (!keepOperationalState) settings.enabled = false;
    target.settings = settings;
    target.persona = str(configRaw?.persona ?? bundle.persona ?? target.persona, 2000);
    target.knowledgeNotes = str(configRaw?.knowledgeNotes ?? bundle.knowledgeNotes ?? target.knowledgeNotes, 50000);
    if (bundle.runnerPolicy && raw?.includeRunnerPolicy !== false) {
      target.runnerPolicy = normalizeRunnerPolicy(
        {
          ...bundle.runnerPolicy,
          updatedAt: now,
          updatedBy: actor.username,
        },
        now,
      );
    }
  }

  const mergeItems = <T extends { id: string; createdAt?: string; updatedAt?: string }>(
    category: keyof AutomationBundleSummary,
    list: T[],
    rawItems: any[],
    normalize: (item: any) => T,
    keyOf: (item: T) => string,
    validate: (item: T) => string | null,
  ) => {
    for (const [index, rawItem] of rawItems.entries()) {
      try {
        const item = normalize(rawItem);
        const reason = validate(item);
        if (reason) throw new Error(reason);
        const key = keyOf(item);
        const existingIndex = mode === 'upsert' && key ? list.findIndex((current) => keyOf(current) === key) : -1;
        if (existingIndex >= 0) {
          const existing = list[existingIndex];
          list[existingIndex] = {
            ...item,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: now,
          };
          updated[category] += 1;
          ids[category].push(existing.id);
        } else {
          list.push(item);
          imported[category] += 1;
          ids[category].push(item.id);
        }
      } catch (e: any) {
        skipped += 1;
        errors.push(`${bundleCategoryLabel(category)} 第 ${index + 1} 条跳过：${e?.message || e}`);
      }
    }
  };

  const rulesRaw = bundleArray(configRaw?.rules ?? bundle.rules).slice(0, 200);
  mergeItems(
    'rules',
    target.rules,
    rulesRaw,
    (item) => normalizeRule({ ...item, updatedAt: now }, false, now),
    (item) => item.name.trim().toLowerCase(),
    (item) => (!item.name.trim() ? '规则名称为空' : null),
  );

  const knowledgeRaw = bundleArray(configRaw?.knowledgeItems ?? bundle.knowledgeItems).slice(0, MAX_KNOWLEDGE_ITEMS);
  mergeItems(
    'knowledgeItems',
    target.knowledgeItems,
    knowledgeRaw,
    (item) => normalizeKnowledgeItem({ ...item, updatedAt: now, lastImportedAt: now }, false, now),
    (item) => `${item.source.toLowerCase()}\n${item.title.toLowerCase()}`,
    (item) => (!item.content.trim() ? '资料内容为空' : null),
  );

  const audienceRaw = bundleArray(bundle.audienceContacts ?? bundle.contacts ?? bundle.audience).slice(0, MAX_AUDIENCE_CONTACTS);
  mergeItems(
    'audienceContacts',
    target.audienceContacts,
    audienceRaw,
    (item) => normalizeAudienceContact({ ...item, updatedAt: now, lastImportedAt: now }, false, now),
    (item) => `${item.source.toLowerCase()}\n${item.type}\n${item.name.toLowerCase()}`,
    (item) => (!item.name.trim() ? '受众名称为空' : null),
  );

  const materialRaw = bundleArray(bundle.materialAssets ?? bundle.assets ?? bundle.materials).slice(0, MAX_MATERIAL_ASSETS);
  mergeItems(
    'materialAssets',
    target.materialAssets,
    materialRaw,
    (item) => normalizeMaterialAsset({ ...item, updatedAt: now, lastImportedAt: now }, false, now),
    (item) => `${item.source.toLowerCase()}\n${item.key.toLowerCase()}`,
    (item) => {
      if (!item.key.trim()) return '素材 key 为空';
      if (!item.localPath.trim() && !item.url.trim() && !item.description.trim()) return '素材至少需要本机路径、URL 或说明';
      return null;
    },
  );

  if (includeQueues) {
    const massRaw = bundleArray(bundle.massSendJobs ?? bundle.massJobs).slice(0, 500);
    mergeItems(
      'massSendJobs',
      target.massSendJobs,
      massRaw,
      (item) => normalizeMassSendJob(prepareBundleMassJob(item, keepOperationalState), false, now),
      (item) => item.title.trim().toLowerCase(),
      (item) => {
        if (!item.title.trim()) return '群发队列标题为空';
        if (!item.message.trim()) return '群发内容为空';
        if (!item.items.length) return '群发目标为空';
        return null;
      },
    );

    const momentRaw = bundleArray(bundle.momentDrafts ?? bundle.moments).slice(0, 500);
    mergeItems(
      'momentDrafts',
      target.momentDrafts,
      momentRaw,
      (item) => normalizeMomentDraft(prepareBundleMomentDraft(item, keepOperationalState), false, now),
      (item) => item.title.trim().toLowerCase(),
      (item) => (!item.text.trim() ? '朋友圈文案为空' : null),
    );
  }

  if (includeBridgeEvents) {
    const bridgeRaw = bundleArray(bundle.bridgeEvents).slice(0, MAX_BRIDGE_EVENTS);
    mergeItems(
      'bridgeEvents',
      target.bridgeEvents,
      bridgeRaw,
      (item) => normalizeBridgeEvent({ ...item, updatedAt: now }, false, now),
      (item) => `${item.source.toLowerCase()}\n${(item.externalId || item.id).toLowerCase()}`,
      (item) => (!item.inboundText.trim() ? 'Bridge 消息内容为空' : null),
    );
  }

  const result: AutomationBundleImportResult = {
    dryRun,
    mode,
    includeConfig,
    keepOperationalState,
    summary: automationBundleSummaryFromRaw(bundle),
    imported,
    updated,
    ids,
    skipped,
    errors,
  };

  if (!dryRun) {
    data = normalizeData(target, true);
    addAutomationAudit({
      action: 'bundle_imported',
      actor: actor.username,
      message: `导入自动化资产包：新增 ${sumBundleCounters(imported)}，更新 ${sumBundleCounters(updated)}，跳过 ${skipped}`,
    });
  }
  return result;
}

export function listWecomBridgeEvents(limit = 100, status?: string): WecomBridgeEvent[] {
  const n = clampInt(limit, 1, 500, 100);
  const wantedStatus = normalizeBridgeEventStatus(status);
  return data.bridgeEvents
    .filter((event) => !wantedStatus || event.status === wantedStatus)
    .slice(-n)
    .reverse()
    .map(cloneBridgeEvent);
}

export function listWecomBridgeWorkers(limit = 50, offlineAfterSeconds = 180): WecomBridgeWorkerStatus[] {
  const n = clampInt(limit, 1, MAX_BRIDGE_WORKERS, 50);
  const offlineAfter = clampInt(offlineAfterSeconds, 30, 24 * 60 * 60, 180);
  const now = Date.now();
  return data.bridgeWorkers
    .slice()
    .sort((a, b) => Date.parse(b.lastSeenAt || b.updatedAt) - Date.parse(a.lastSeenAt || a.updatedAt))
    .slice(0, n)
    .map((worker) => publicBridgeWorker(worker, now, offlineAfter));
}

export function listWecomBridgeRunReports(limit = 50, workerId = ''): WecomBridgeRunReport[] {
  const n = clampInt(limit, 1, MAX_BRIDGE_RUN_REPORTS, 50);
  const wantedWorkerId = str(workerId, 120).trim();
  return data.bridgeRunReports
    .filter((report) => !wantedWorkerId || report.workerId === wantedWorkerId)
    .slice(-n)
    .reverse()
    .map(cloneBridgeRunReport);
}

export function getWecomBridgeRunnerPolicy(): WecomBridgeRunnerPolicy {
  return cloneRunnerPolicy(data.runnerPolicy);
}

export function updateWecomBridgeRunnerPolicy(actor: User, raw: any): WecomBridgeRunnerPolicy {
  data.runnerPolicy = normalizeRunnerPolicy(
    {
      ...data.runnerPolicy,
      ...(raw && typeof raw === 'object' ? raw : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: actor.username,
    },
    new Date().toISOString(),
  );
  persist();
  addAutomationAudit({
    action: 'bridge_runner_policy_updated',
    actor: actor.username,
    message: `更新 Mac Runner 策略：${data.runnerPolicy.target}/${data.runnerPolicy.mode}，limit=${data.runnerPolicy.limit}`,
  });
  return cloneRunnerPolicy(data.runnerPolicy);
}

export function recordWecomBridgeHeartbeat(actor: User, raw: any): WecomBridgeWorkerStatus {
  const now = new Date().toISOString();
  const source = str(raw?.source || raw?.sourceName || 'wecom-mac-bridge', 80).trim() || 'wecom-mac-bridge';
  const workerId =
    str(raw?.workerId ?? raw?.worker ?? raw?.clientId ?? raw?.hostname ?? raw?.host, 120).trim() ||
    `${source}-${actor.username}`;
  const host = str(raw?.host ?? raw?.hostname ?? '', 120).trim();
  const pid = Number.isFinite(Number(raw?.pid)) ? Math.max(0, Math.trunc(Number(raw.pid))) : undefined;
  const incoming: WecomBridgeWorker = {
    id: `${source}:${workerId}`,
    workerId,
    source,
    mode: str(raw?.mode || raw?.runnerMode || raw?.status || 'unknown', 60).trim() || 'unknown',
    host,
    pid,
    version: str(raw?.version || raw?.clientVersion || '', 80).trim() || undefined,
    note: str(raw?.note || raw?.message || '', 300).trim() || undefined,
    pendingReplies: clampInt(raw?.pendingReplies, 0, 100000, 0),
    pendingMassTasks: clampInt(raw?.pendingMassTasks, 0, 100000, 0),
    pendingMomentTasks: clampInt(raw?.pendingMomentTasks, 0, 100000, 0),
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const existingIndex = data.bridgeWorkers.findIndex(
    (worker) => worker.source.toLowerCase() === source.toLowerCase() && worker.workerId === workerId,
  );
  if (existingIndex >= 0) {
    const existing = data.bridgeWorkers[existingIndex];
    data.bridgeWorkers[existingIndex] = {
      ...incoming,
      id: existing.id,
      createdAt: existing.createdAt,
    };
  } else {
    data.bridgeWorkers.push(incoming);
  }
  if (data.bridgeWorkers.length > MAX_BRIDGE_WORKERS) {
    data.bridgeWorkers = data.bridgeWorkers
      .slice()
      .sort((a, b) => Date.parse(b.lastSeenAt || b.updatedAt) - Date.parse(a.lastSeenAt || a.updatedAt))
      .slice(0, MAX_BRIDGE_WORKERS);
  }
  persist();
  return publicBridgeWorker(existingIndex >= 0 ? data.bridgeWorkers[existingIndex] : incoming);
}

export function recordWecomBridgeRunReport(actor: User, raw: any): WecomBridgeRunReport {
  const now = new Date().toISOString();
  const report = normalizeBridgeRunReport(raw, false, now);
  data.bridgeRunReports.push(report);
  if (data.bridgeRunReports.length > MAX_BRIDGE_RUN_REPORTS) {
    data.bridgeRunReports = data.bridgeRunReports.slice(-MAX_BRIDGE_RUN_REPORTS);
  }
  persist();

  const handled = report.handledReplies + report.handledMassTasks + report.handledMomentTasks;
  const failed = report.failedReplies + report.failedMassTasks + report.failedMomentTasks;
  if (report.status === 'failed' || handled > 0 || failed > 0) {
    addAutomationAudit({
      action: 'bridge_run_reported',
      actor: actor.username,
      message: `Bridge worker「${report.workerId}」${report.target}/${report.mode} 运行${report.status === 'failed' ? '失败' : '完成'}：处理 ${handled}，失败 ${failed}`,
    });
  }
  return cloneBridgeRunReport(report);
}

export function ingestWecomBridgeEvents(actor: User, raw: any): WecomBridgeEventIngestResult {
  const now = new Date().toISOString();
  const source = str(raw?.source || raw?.sourceName || 'wecom-mac-bridge', 80).trim() || 'wecom-mac-bridge';
  const rawEvents = extractBridgeEventItems(raw).slice(0, 100);
  const result: WecomBridgeEventIngestResult = {
    events: [],
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const [index, rawEvent] of rawEvents.entries()) {
    try {
      const event = normalizeBridgeEvent({ ...rawEvent, source: rawEvent?.source || source }, false, now);
      if (!event.inboundText.trim()) throw new Error('消息内容为空');
      if (!event.conversationName.trim() && !event.senderName.trim()) throw new Error('会话名和发送人不能同时为空');

      const existingIndex = event.externalId
        ? data.bridgeEvents.findIndex((x) => x.source.toLowerCase() === event.source.toLowerCase() && x.externalId === event.externalId)
        : -1;
      if (existingIndex >= 0) {
        const existing = data.bridgeEvents[existingIndex];
        const saved: WecomBridgeEvent = {
          ...event,
          id: existing.id,
          status: existing.status === 'archived' ? 'archived' : event.status,
          createdAt: existing.createdAt,
          updatedAt: now,
          lastPlannedAt: existing.lastPlannedAt,
          replyDraft: existing.replyDraft,
          replySteps: existing.replySteps?.map((step) => ({ ...step })),
          replyApproved: existing.replyApproved,
          replyApprovedAt: existing.replyApprovedAt,
          replyClaimedAt: existing.replyClaimedAt,
          replyClaimedBy: existing.replyClaimedBy,
          replyClaimExpiresAt: existing.replyClaimExpiresAt,
          replyFailedAt: existing.replyFailedAt,
          replyFailedBy: existing.replyFailedBy,
          replyError: existing.replyError,
          replyRetryCount: existing.replyRetryCount,
          replyDeliveredAt: existing.replyDeliveredAt,
        };
        data.bridgeEvents[existingIndex] = saved;
        result.updated += 1;
        result.events.push(cloneBridgeEvent(saved));
      } else {
        data.bridgeEvents.push(event);
        result.imported += 1;
        result.events.push(cloneBridgeEvent(event));
      }
    } catch (e: any) {
      result.skipped += 1;
      result.errors.push(`第 ${index + 1} 条跳过：${e?.message || e}`);
    }
  }

  if (data.bridgeEvents.length > MAX_BRIDGE_EVENTS) {
    data.bridgeEvents = data.bridgeEvents.slice(-MAX_BRIDGE_EVENTS);
  }
  if (result.imported || result.updated) {
    persist();
    addAutomationAudit({
      action: 'bridge_events_ingested',
      actor: actor.username,
      message: `Bridge 收到企微消息事件：新增 ${result.imported} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`,
    });
  }
  return result;
}

export function patchWecomBridgeEvent(actor: User, eventId: string, raw: any): WecomBridgeEvent {
  const event = data.bridgeEvents.find((item) => item.id === eventId);
  if (!event) throw new Error('Bridge 消息事件不存在');
  const status = raw?.status === undefined ? null : normalizeBridgeEventStatus(raw?.status);
  if (raw?.status !== undefined && !status) throw new Error('Bridge 消息事件状态不合法');
  const now = new Date().toISOString();
  if (status) event.status = status;
  if (typeof raw?.replyDraft === 'string') {
    const previousDraft = event.replyDraft || '';
    event.replyDraft = str(raw.replyDraft, 1000).trim() || undefined;
    if (raw?.replySteps === undefined) event.replySteps = undefined;
    if ((event.replyDraft || '') !== previousDraft) {
      resetBridgeReplyDeliveryState(event);
    }
  }
  if (raw?.replySteps !== undefined || raw?.steps !== undefined || raw?.responseSteps !== undefined) {
    const previousSteps = JSON.stringify(event.replySteps || []);
    const steps = normalizeBridgeReplySteps(raw?.replySteps ?? raw?.steps ?? raw?.responseSteps);
    event.replySteps = steps.length ? steps : undefined;
    if (event.replySteps) event.replyDraft = bridgeReplyTextFromSteps(event.replySteps) || event.replyDraft;
    if (JSON.stringify(event.replySteps || []) !== previousSteps) resetBridgeReplyDeliveryState(event);
  }
  if (!hasRunnableBridgeReply(event)) {
    event.replyApproved = false;
    event.replyApprovedAt = undefined;
    resetBridgeReplyDeliveryState(event);
  }
  if (typeof raw?.replyApproved === 'boolean') {
    if (raw.replyApproved && !hasRunnableBridgeReply(event)) throw new Error('批准前需要先保存可执行回复草稿');
    event.replyApproved = raw.replyApproved;
    event.replyApprovedAt = raw.replyApproved ? now : undefined;
    if (!raw.replyApproved) resetBridgeReplyDeliveryState(event);
  }
  const deliveryStatus = normalizeBridgeReplyDeliveryStatus(raw?.deliveryStatus);
  if (raw?.deliveryStatus !== undefined && !deliveryStatus) throw new Error('Bridge 回复交付状态不合法');
  if (raw?.markClaimed === true || deliveryStatus === 'claimed') {
    if (!event.replyApproved || !hasRunnableBridgeReply(event)) throw new Error('未批准的回复不能领取');
    if (event.replyDeliveredAt) throw new Error('已交付的回复不能再次领取');
    const workerId = str(raw?.replyClaimedBy ?? raw?.workerId ?? raw?.clientId ?? actor.username, 120).trim() || actor.username;
    if (event.replyClaimedAt && !isBridgeReplyClaimExpired(event, now) && event.replyClaimedBy && event.replyClaimedBy !== workerId) {
      throw new Error(`回复已由 ${event.replyClaimedBy} 领取，未超时前不能重复领取`);
    }
    event.replyClaimedAt = now;
    event.replyClaimedBy = workerId;
    event.replyClaimExpiresAt = claimExpiresAt(now, raw?.claimTtlSeconds ?? raw?.ttlSeconds);
    event.replyFailedAt = undefined;
    event.replyFailedBy = undefined;
    event.replyError = undefined;
  }
  if (raw?.markReleased === true || deliveryStatus === 'released') {
    if (event.replyDeliveredAt) throw new Error('已交付的回复不能释放领取');
    event.replyClaimedAt = undefined;
    event.replyClaimedBy = undefined;
    event.replyClaimExpiresAt = undefined;
    event.replyFailedAt = undefined;
    event.replyFailedBy = undefined;
    event.replyError = undefined;
  }
  if (raw?.markFailed === true || deliveryStatus === 'failed') {
    if (!event.replyApproved) throw new Error('未批准的回复不能标记失败');
    const failureWorkerId =
      str(raw?.replyFailedBy ?? raw?.replyClaimedBy ?? raw?.workerId ?? raw?.clientId ?? event.replyClaimedBy ?? actor.username, 120).trim() ||
      actor.username;
    event.replyFailedAt = now;
    event.replyFailedBy = failureWorkerId;
    event.replyError = str(raw?.replyError ?? raw?.error ?? raw?.message ?? 'Mac 端执行失败', 1000).trim() || 'Mac 端执行失败';
    event.replyClaimedAt = undefined;
    event.replyClaimedBy = undefined;
    event.replyClaimExpiresAt = undefined;
    event.replyDeliveredAt = undefined;
  }
  if (raw?.markDelivered === true || deliveryStatus === 'delivered') {
    if (!event.replyApproved) throw new Error('未批准的回复不能标记交付');
    if (!event.replyClaimedAt) {
      event.replyClaimedAt = now;
      event.replyClaimedBy = str(raw?.replyClaimedBy ?? raw?.workerId ?? raw?.clientId ?? actor.username, 120).trim() || actor.username;
    }
    event.replyClaimExpiresAt = undefined;
    event.replyFailedAt = undefined;
    event.replyFailedBy = undefined;
    event.replyError = undefined;
    event.replyRetryCount = undefined;
    event.replyDeliveredAt = now;
  }
  event.updatedAt = now;
  if (status === 'planned') event.lastPlannedAt = now;
  persist();
  addAutomationAudit({
    action: 'bridge_event_updated',
    actor: actor.username,
    conversationName: event.conversationName || event.senderName,
    message: `更新企微消息事件「${event.conversationName || event.senderName}」：${event.status}${event.replyApproved ? '，回复已批准' : ''}${event.replyDeliveredAt ? '，已交付' : event.replyFailedAt ? '，交付失败' : event.replyClaimedAt ? '，已领取' : ''}`,
  });
  return cloneBridgeEvent(event);
}

export function listApprovedWecomBridgeReplies(limit = 50): WecomBridgeEvent[] {
  const n = clampInt(limit, 1, 200, 50);
  const now = new Date().toISOString();
  return data.bridgeEvents
    .filter(
      (event) =>
        event.replyApproved &&
        hasRunnableBridgeReply(event) &&
        (!event.replyClaimedAt || isBridgeReplyClaimExpired(event, now)) &&
        !event.replyDeliveredAt &&
        event.status !== 'archived',
    )
    .slice(-n)
    .reverse()
    .map(cloneBridgeEvent);
}

export function patchWecomBridgeReplyDelivery(actor: User, eventId: string, raw: any): WecomBridgeEvent {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const hasExplicitAction =
    payload.deliveryStatus !== undefined ||
    payload.markClaimed === true ||
    payload.markFailed === true ||
    payload.markDelivered === true ||
    payload.markReleased === true;
  return patchWecomBridgeEvent(actor, eventId, hasExplicitAction ? payload : { markDelivered: true });
}

export function markWecomBridgeReplyDelivered(actor: User, eventId: string): WecomBridgeEvent {
  return patchWecomBridgeEvent(actor, eventId, { markDelivered: true });
}

export function recoverAutomationBridgeOutbox(actor: User, raw: any): AutomationBridgeRecoveryResult {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const now = new Date().toISOString();
  const dryRun = payload.dryRun === true;
  const releaseClaims = normalizeBridgeRecoveryReleaseMode(payload.releaseClaims ?? payload.claims) || 'expired';
  const retryFailed = payload.retryFailed !== false;
  const includeReplies = payload.includeReplies !== false;
  const includeMass = payload.includeMass !== false;
  const includeMoments = payload.includeMoments !== false;
  const limit = clampInt(payload.limit, 1, 2000, 500);
  const workerIdFilter = str(payload.workerId ?? payload.claimedBy ?? payload.worker ?? '', 120).trim();
  const failureReasonFilter = str(payload.failureReason ?? payload.errorContains ?? payload.failedReason ?? '', 300).trim();
  const failureReasonNeedle = failureReasonFilter.toLowerCase();
  const minFailedAgeSeconds = clampInt(
    payload.minFailedAgeSeconds ?? payload.retryFailedAfterSeconds ?? payload.failedCooldownSeconds ?? payload.failureCooldownSeconds,
    0,
    7 * 24 * 60 * 60,
    0,
  );
  const maxRetryAttempts = clampInt(payload.maxRetryAttempts ?? payload.maxRetries ?? payload.retryLimit ?? payload.retryAttemptsLimit, 0, 100, 0);
  const cursorFilter = str(payload.cursor ?? payload.after ?? payload.afterCursor ?? '', 300).trim();
  const result: AutomationBridgeRecoveryResult = {
    generatedAt: now,
    dryRun,
    releaseClaims,
    retryFailed,
    workerId: workerIdFilter || undefined,
    failureReason: failureReasonFilter || undefined,
    minFailedAgeSeconds,
    maxRetryAttempts,
    cursor: cursorFilter || undefined,
    hasMore: false,
    limit,
    replies: { releasedClaims: 0, retriedFailed: 0 },
    mass: { releasedClaims: 0, retriedFailed: 0, resumedJobs: 0 },
    moments: { releasedClaims: 0, retriedFailed: 0 },
    totalChanged: 0,
    changes: [],
  };
  const resumedJobIds = new Set<string>();
  const nowMs = Date.parse(now);
  let lastRecordedCursor: string | undefined;
  let cursorPassed = !cursorFilter;
  let shouldStop = false;
  const cursorPart = (value: string) => encodeURIComponent(value).replace(/%20/g, '+');
  const recoveryCursor = (target: AutomationBridgeRecoveryChange['target'], action: AutomationBridgeRecoveryChange['action'], ...parts: string[]) =>
    [target, action, ...parts].map(cursorPart).join('|');
  const shouldConsiderCursor = (cursorKey: string) => {
    if (cursorPassed) return true;
    if (cursorKey === cursorFilter) cursorPassed = true;
    return false;
  };
  const record = (change: AutomationBridgeRecoveryChange): boolean => {
    if (result.changes.length >= limit) {
      result.hasMore = true;
      result.nextCursor = lastRecordedCursor;
      return false;
    }
    result.changes.push(change);
    lastRecordedCursor = change.cursor;
    return true;
  };
  const workerMatches = (workerId?: string) => !workerIdFilter || workerId === workerIdFilter;
  const failureReasonMatches = (message?: string) => !failureReasonNeedle || String(message || '').toLowerCase().includes(failureReasonNeedle);
  const failedAgeMatches = (failedAt?: string) => {
    if (minFailedAgeSeconds <= 0) return true;
    const failedAtMs = Date.parse(failedAt || '');
    if (!Number.isFinite(failedAtMs)) return false;
    return nowMs - failedAtMs >= minFailedAgeSeconds * 1000;
  };
  const retryAttempts = (value?: number) => (Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0);
  const retryAttemptsMatch = (value?: number) => maxRetryAttempts <= 0 || retryAttempts(value) < maxRetryAttempts;
  const shouldReleaseReplyClaim = (event: WecomBridgeEvent) => {
    if (releaseClaims === 'none' || !event.replyClaimedAt) return false;
    if (!workerMatches(event.replyClaimedBy)) return false;
    return releaseClaims === 'all' || isBridgeReplyClaimExpired(event, now);
  };
  const shouldReleaseMassClaim = (item: MassSendItem) => {
    if (releaseClaims === 'none' || !item.bridgeClaimedAt) return false;
    if (!workerMatches(item.bridgeClaimedBy)) return false;
    return releaseClaims === 'all' || isMassItemBridgeClaimExpired(item, now);
  };
  const shouldReleaseMomentClaim = (draft: MomentDraft) => {
    if (releaseClaims === 'none' || !draft.bridgeClaimedAt) return false;
    if (!workerMatches(draft.bridgeClaimedBy)) return false;
    return releaseClaims === 'all' || isMomentDraftBridgeClaimExpired(draft, now);
  };
  let changed = false;

  if (includeReplies) {
    for (const event of data.bridgeEvents) {
      if (shouldStop) break;
      const canRecoverReply = event.status !== 'archived' && event.replyApproved && hasRunnableBridgeReply(event) && !event.replyDeliveredAt;
      const releaseCursor = recoveryCursor('reply', 'release-claim', event.id);
      if (shouldConsiderCursor(releaseCursor) && canRecoverReply && shouldReleaseReplyClaim(event)) {
        const reason = releaseClaims === 'all' ? 'force_release' : 'claim_expired';
        if (
          !record({
            target: 'reply',
            id: event.id,
            name: event.conversationName || event.senderName,
            action: 'release-claim',
            reason,
            workerId: event.replyClaimedBy,
            cursor: releaseCursor,
          })
        ) {
          shouldStop = true;
          break;
        }
        result.replies.releasedClaims += 1;
        if (!dryRun) {
          event.replyClaimedAt = undefined;
          event.replyClaimedBy = undefined;
          event.replyClaimExpiresAt = undefined;
          event.updatedAt = now;
        }
        changed = true;
      }
      const retryCursor = recoveryCursor('reply', 'retry-failed', event.id);
      if (
        shouldConsiderCursor(retryCursor) &&
        canRecoverReply &&
        retryFailed &&
        event.replyFailedAt &&
        workerMatches(event.replyFailedBy) &&
        failureReasonMatches(event.replyError) &&
        failedAgeMatches(event.replyFailedAt) &&
        retryAttemptsMatch(event.replyRetryCount)
      ) {
        const retryCount = retryAttempts(event.replyRetryCount);
        if (
          !record({
            target: 'reply',
            id: event.id,
            name: event.conversationName || event.senderName,
            action: 'retry-failed',
            reason: 'failed_retry',
            workerId: event.replyFailedBy,
            error: event.replyError,
            failedAt: event.replyFailedAt,
            retryCount,
            nextRetryCount: retryCount + 1,
            cursor: retryCursor,
          })
        ) {
          shouldStop = true;
          break;
        }
        result.replies.retriedFailed += 1;
        if (!dryRun) {
          event.replyFailedAt = undefined;
          event.replyFailedBy = undefined;
          event.replyError = undefined;
          event.replyRetryCount = retryCount + 1;
          event.replyClaimedAt = undefined;
          event.replyClaimedBy = undefined;
          event.replyClaimExpiresAt = undefined;
          event.updatedAt = now;
        }
        changed = true;
      }
    }
  }

  if (!shouldStop && includeMass) {
    for (const job of data.massSendJobs) {
      if (shouldStop) break;
      if (!job.approved || job.status === 'draft' || job.status === 'completed' || job.status === 'cancelled') continue;
      let jobChanged = false;
      for (const item of job.items) {
        if (shouldStop) break;
        const releaseCursor = recoveryCursor('mass', 'release-claim', job.id, item.id);
        if (shouldConsiderCursor(releaseCursor) && item.status === 'pending' && shouldReleaseMassClaim(item)) {
          const reason = releaseClaims === 'all' ? 'force_release' : 'claim_expired';
          if (
            !record({
              target: 'mass',
              id: `${job.id}:${item.id}`,
              name: item.recipientName,
              action: 'release-claim',
              reason,
              workerId: item.bridgeClaimedBy,
              cursor: releaseCursor,
            })
          ) {
            shouldStop = true;
            break;
          }
          result.mass.releasedClaims += 1;
          if (!dryRun) {
            item.bridgeClaimedAt = undefined;
            item.bridgeClaimedBy = undefined;
            item.bridgeClaimExpiresAt = undefined;
            item.bridgeFailedAt = undefined;
            item.bridgeFailedBy = undefined;
            item.error = undefined;
          }
          jobChanged = true;
          changed = true;
        }
        const retryCursor = recoveryCursor('mass', 'retry-failed', job.id, item.id);
        if (
          shouldConsiderCursor(retryCursor) &&
          retryFailed &&
          item.status === 'failed' &&
          workerMatches(item.bridgeFailedBy) &&
          failureReasonMatches(item.error) &&
          failedAgeMatches(item.bridgeFailedAt) &&
          retryAttemptsMatch(item.bridgeRetryCount)
        ) {
          const retryCount = retryAttempts(item.bridgeRetryCount);
          if (
            !record({
              target: 'mass',
              id: `${job.id}:${item.id}`,
              name: item.recipientName,
              action: 'retry-failed',
              reason: 'failed_retry',
              workerId: item.bridgeFailedBy,
              error: item.error,
              failedAt: item.bridgeFailedAt,
              retryCount,
              nextRetryCount: retryCount + 1,
              cursor: retryCursor,
            })
          ) {
            shouldStop = true;
            break;
          }
          result.mass.retriedFailed += 1;
          if (!resumedJobIds.has(job.id) && job.status === 'paused') {
            resumedJobIds.add(job.id);
            result.mass.resumedJobs += 1;
          }
          if (!dryRun) {
            item.status = 'pending';
            item.error = undefined;
            item.sentAt = undefined;
            item.auditEventId = undefined;
            item.bridgeClaimedAt = undefined;
            item.bridgeClaimedBy = undefined;
            item.bridgeClaimExpiresAt = undefined;
            item.bridgeFailedAt = undefined;
            item.bridgeFailedBy = undefined;
            item.bridgeRetryCount = retryCount + 1;
            if (job.status === 'paused') job.status = 'queued';
          }
          jobChanged = true;
          changed = true;
        }
      }
      if (jobChanged && !dryRun) {
        job.updatedAt = now;
        refreshMassJobCompletion(job);
      }
    }
  }

  if (!shouldStop && includeMoments) {
    for (const draft of data.momentDrafts) {
      if (shouldStop) break;
      if (draft.status === 'published' || draft.status === 'archived') continue;
      const releaseCursor = recoveryCursor('moment', 'release-claim', draft.id);
      if (shouldConsiderCursor(releaseCursor) && shouldReleaseMomentClaim(draft)) {
        const reason = releaseClaims === 'all' ? 'force_release' : 'claim_expired';
        if (
          !record({
            target: 'moment',
            id: draft.id,
            name: draft.title,
            action: 'release-claim',
            reason,
            workerId: draft.bridgeClaimedBy,
            cursor: releaseCursor,
          })
        ) {
          shouldStop = true;
          break;
        }
        result.moments.releasedClaims += 1;
        if (!dryRun) {
          clearMomentBridgeClaim(draft);
          draft.updatedAt = now;
        }
        changed = true;
      }
      const retryCursor = recoveryCursor('moment', 'retry-failed', draft.id);
      if (
        shouldConsiderCursor(retryCursor) &&
        retryFailed &&
        draft.bridgeFailedAt &&
        workerMatches(draft.bridgeFailedBy) &&
        failureReasonMatches(draft.bridgeError) &&
        failedAgeMatches(draft.bridgeFailedAt) &&
        retryAttemptsMatch(draft.bridgeRetryCount)
      ) {
        const retryCount = retryAttempts(draft.bridgeRetryCount);
        if (
          !record({
            target: 'moment',
            id: draft.id,
            name: draft.title,
            action: 'retry-failed',
            reason: 'failed_retry',
            workerId: draft.bridgeFailedBy,
            error: draft.bridgeError,
            failedAt: draft.bridgeFailedAt,
            retryCount,
            nextRetryCount: retryCount + 1,
            cursor: retryCursor,
          })
        ) {
          shouldStop = true;
          break;
        }
        result.moments.retriedFailed += 1;
        if (!dryRun) {
          draft.status = 'ready';
          draft.approved = true;
          draft.bridgeFailedAt = undefined;
          draft.bridgeFailedBy = undefined;
          draft.bridgeError = undefined;
          draft.bridgeRetryCount = retryCount + 1;
          clearMomentBridgeClaim(draft);
          draft.updatedAt = now;
        }
        changed = true;
      }
    }
  }

  result.totalChanged = result.changes.length;
  if (changed && !dryRun) {
    persist();
    addAutomationAudit({
      action: 'bridge_outbox_recovered',
      actor: actor.username,
      message: `恢复 Bridge 出箱${workerIdFilter ? `（worker=${workerIdFilter}）` : ''}${failureReasonFilter ? `（原因=${failureReasonFilter}）` : ''}${minFailedAgeSeconds > 0 ? `（失败冷却>=${minFailedAgeSeconds}s）` : ''}${maxRetryAttempts > 0 ? `（最多重试${maxRetryAttempts}次）` : ''}：释放 ${result.replies.releasedClaims + result.mass.releasedClaims + result.moments.releasedClaims} 个领取，重试 ${result.replies.retriedFailed + result.mass.retriedFailed + result.moments.retriedFailed} 个失败项`,
    });
  }
  return result;
}

export function importAutomationKnowledge(actor: User, raw: any): AutomationKnowledgeImportResult {
  const now = new Date().toISOString();
  const source = str(raw?.source || raw?.sourceName || 'wecom-mac', 80).trim() || 'wecom-mac';
  const defaultCategory = normalizeKnowledgeCategory(raw?.category) || 'faq';
  const defaultApproved = raw?.approveImported === true || raw?.approved === true;
  const defaultEnabled = raw?.enabled !== false;
  const mode = raw?.mode === 'append' ? 'append' : 'upsert';
  const rawItems = extractKnowledgeImportItems(raw, defaultCategory).slice(0, 200);
  const result: AutomationKnowledgeImportResult = {
    items: [],
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const [index, rawItem] of rawItems.entries()) {
    try {
      const item = normalizeKnowledgeItem(
        {
          ...rawItem,
          source: rawItem?.source || source,
          category: rawItem?.category || defaultCategory,
          enabled: typeof rawItem?.enabled === 'boolean' ? rawItem.enabled : defaultEnabled,
          approved: typeof rawItem?.approved === 'boolean' ? rawItem.approved : defaultApproved,
          createdAt: now,
          updatedAt: now,
        },
        false,
        now,
      );
      if (!item.title.trim()) throw new Error('标题为空');
      if (!item.content.trim() && item.targetNames.length === 0) throw new Error('内容和目标名单都为空');

      const existingIndex =
        mode === 'upsert'
          ? data.knowledgeItems.findIndex(
              (x) => x.source.toLowerCase() === item.source.toLowerCase() && x.title.toLowerCase() === item.title.toLowerCase(),
            )
          : -1;
      if (existingIndex >= 0) {
        const existing = data.knowledgeItems[existingIndex];
        const saved = {
          ...item,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
        data.knowledgeItems[existingIndex] = saved;
        result.updated += 1;
        result.items.push(cloneKnowledgeItem(saved));
      } else {
        data.knowledgeItems.push(item);
        result.imported += 1;
        result.items.push(cloneKnowledgeItem(item));
      }
    } catch (e: any) {
      result.skipped += 1;
      result.errors.push(`第 ${index + 1} 条跳过：${e?.message || e}`);
    }
  }

  if (data.knowledgeItems.length > MAX_KNOWLEDGE_ITEMS) {
    data.knowledgeItems = data.knowledgeItems.slice(-MAX_KNOWLEDGE_ITEMS);
  }
  if (result.imported || result.updated) {
    persist();
    addAutomationAudit({
      action: 'knowledge_imported',
      actor: actor.username,
      message: `导入企微接入资料：新增 ${result.imported} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`,
    });
  }
  return result;
}

export function patchAutomationKnowledge(actor: User, itemId: string, raw: any): AutomationKnowledgeItem {
  const current = data.knowledgeItems.find((item) => item.id === itemId);
  if (!current) throw new Error('接入资料不存在');
  const now = new Date().toISOString();
  const next = normalizeKnowledgeItem(
    {
      ...current,
      ...raw,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: now,
    },
    true,
    now,
  );
  if (!next.content.trim() && next.targetNames.length === 0) throw new Error('内容和目标名单不能同时为空');
  Object.assign(current, next);
  persist();
  addAutomationAudit({
    action: 'knowledge_updated',
    actor: actor.username,
    message: `更新企微接入资料「${current.title}」：${current.enabled ? '启用' : '停用'}，${current.approved ? '已审核' : '未审核'}`,
  });
  return cloneKnowledgeItem(current);
}

export function deleteAutomationKnowledge(actor: User, itemId: string): { ok: true } {
  const index = data.knowledgeItems.findIndex((item) => item.id === itemId);
  if (index < 0) throw new Error('接入资料不存在');
  const [removed] = data.knowledgeItems.splice(index, 1);
  persist();
  addAutomationAudit({
    action: 'knowledge_deleted',
    actor: actor.username,
    message: `删除企微接入资料「${removed.title}」`,
  });
  return { ok: true };
}

export function listAutomationAudience(limit = 200, query = '', tag = ''): AutomationAudienceContact[] {
  const n = clampInt(limit, 1, 1000, 200);
  const q = String(query || '').trim().toLowerCase();
  const t = String(tag || '').trim().toLowerCase();
  return data.audienceContacts
    .filter((contact) => {
      const haystack = [contact.name, contact.source, contact.note, ...contact.aliases, ...contact.tags].join('\n').toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (t && !contact.tags.some((tagName) => tagName.toLowerCase() === t)) return false;
      return true;
    })
    .slice(-n)
    .reverse()
    .map(cloneAudienceContact);
}

export function importAutomationAudience(actor: User, raw: any): AutomationAudienceImportResult {
  const now = new Date().toISOString();
  const source = str(raw?.source || raw?.sourceName || 'wecom-mac', 80).trim() || 'wecom-mac';
  const defaultType = normalizeAudienceContactType(raw?.type ?? raw?.contactType);
  const defaultApproved = raw?.approveImported === true || raw?.approved === true;
  const defaultEnabled = raw?.enabled !== false;
  const mode = raw?.mode === 'append' ? 'append' : 'upsert';
  const rawItems = extractAudienceImportItems(raw).slice(0, 500);
  const result: AutomationAudienceImportResult = {
    contacts: [],
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const [index, rawItem] of rawItems.entries()) {
    try {
      const contact = normalizeAudienceContact(
        {
          ...rawItem,
          source: rawItem?.source || source,
          type: rawItem?.type || rawItem?.contactType || defaultType,
          enabled: typeof rawItem?.enabled === 'boolean' ? rawItem.enabled : defaultEnabled,
          approved: typeof rawItem?.approved === 'boolean' ? rawItem.approved : defaultApproved,
          createdAt: now,
          updatedAt: now,
          lastImportedAt: now,
        },
        false,
        now,
      );
      if (!contact.name.trim()) throw new Error('名称为空');
      const existingIndex =
        mode === 'upsert'
          ? data.audienceContacts.findIndex(
              (x) =>
                x.source.toLowerCase() === contact.source.toLowerCase() &&
                x.name.toLowerCase() === contact.name.toLowerCase() &&
                x.type === contact.type,
            )
          : -1;
      if (existingIndex >= 0) {
        const existing = data.audienceContacts[existingIndex];
        const saved: AutomationAudienceContact = {
          ...contact,
          id: existing.id,
          aliases: uniqueStrings([...existing.aliases, ...contact.aliases]).slice(0, 20),
          tags: uniqueStrings([...existing.tags, ...contact.tags]).slice(0, 30),
          note: contact.note || existing.note,
          createdAt: existing.createdAt,
          updatedAt: now,
          lastImportedAt: now,
        };
        data.audienceContacts[existingIndex] = saved;
        result.updated += 1;
        result.contacts.push(cloneAudienceContact(saved));
      } else {
        data.audienceContacts.push(contact);
        result.imported += 1;
        result.contacts.push(cloneAudienceContact(contact));
      }
    } catch (e: any) {
      result.skipped += 1;
      result.errors.push(`第 ${index + 1} 条跳过：${e?.message || e}`);
    }
  }

  if (data.audienceContacts.length > MAX_AUDIENCE_CONTACTS) {
    data.audienceContacts = data.audienceContacts.slice(-MAX_AUDIENCE_CONTACTS);
  }
  if (result.imported || result.updated) {
    persist();
    addAutomationAudit({
      action: 'audience_imported',
      actor: actor.username,
      message: `导入受众资产：新增 ${result.imported} 个，更新 ${result.updated} 个，跳过 ${result.skipped} 个`,
    });
  }
  return result;
}

export function patchAutomationAudienceContact(actor: User, contactId: string, raw: any): AutomationAudienceContact {
  const current = data.audienceContacts.find((contact) => contact.id === contactId);
  if (!current) throw new Error('受众不存在');
  const now = new Date().toISOString();
  const next = normalizeAudienceContact(
    {
      ...current,
      ...raw,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: now,
      lastImportedAt: current.lastImportedAt,
    },
    true,
    now,
  );
  if (!next.name.trim()) throw new Error('受众名称不能为空');
  Object.assign(current, next);
  persist();
  addAutomationAudit({
    action: 'audience_updated',
    actor: actor.username,
    message: `更新受众「${current.name}」：${current.enabled ? '启用' : '停用'}，${current.approved ? '已审核' : '未审核'}`,
  });
  return cloneAudienceContact(current);
}

export function deleteAutomationAudienceContact(actor: User, contactId: string): { ok: true } {
  const index = data.audienceContacts.findIndex((contact) => contact.id === contactId);
  if (index < 0) throw new Error('受众不存在');
  const [removed] = data.audienceContacts.splice(index, 1);
  persist();
  addAutomationAudit({
    action: 'audience_deleted',
    actor: actor.username,
    message: `删除受众「${removed.name}」`,
  });
  return { ok: true };
}

export function listAutomationMaterials(limit = 200, query = '', tag = ''): AutomationMaterialAsset[] {
  const n = clampInt(limit, 1, 1000, 200);
  const q = String(query || '').trim().toLowerCase();
  const t = String(tag || '').trim().toLowerCase();
  return data.materialAssets
    .filter((asset) => {
      const haystack = [asset.key, asset.title, asset.source, asset.description, asset.localPath, asset.url, ...asset.tags].join('\n').toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (t && !asset.tags.some((tagName) => tagName.toLowerCase() === t)) return false;
      return true;
    })
    .slice(-n)
    .reverse()
    .map(cloneMaterialAsset);
}

export function getWecomBridgeMaterialMap(raw: any = {}): WecomBridgeMaterialMap {
  const generatedAt = new Date().toISOString();
  const rawKind = String(raw?.kind ?? raw?.type ?? '').trim().toLowerCase();
  const kind = rawKind && rawKind !== 'all' && rawKind !== '*' ? normalizeMaterialKind(rawKind) : null;
  const tag = str(raw?.tag, 60).trim().toLowerCase();
  const source = str(raw?.source, 80).trim().toLowerCase();
  const includeSkipped = raw?.includeSkipped !== false && raw?.includeSkipped !== '0' && raw?.includeSkipped !== 'false';
  const materials: WecomBridgeMaterialMapItem[] = [];
  const map: Record<string, string> = {};
  const skipped: WecomBridgeMaterialMap['skipped'] = [];

  for (const asset of data.materialAssets) {
    if (!asset.enabled || !asset.approved) continue;
    if (kind && asset.kind !== kind) continue;
    if (tag && !asset.tags.some((name) => name.toLowerCase() === tag)) continue;
    if (source && asset.source.toLowerCase() !== source) continue;
    const key = asset.key.trim();
    if (!key) continue;
    const localPath = asset.localPath.trim();
    if (!localPath) {
      if (includeSkipped) skipped.push({ key, title: asset.title, reason: 'missing_local_path' });
      continue;
    }
    const item: WecomBridgeMaterialMapItem = {
      key,
      path: localPath,
      localPath,
      title: asset.title,
      kind: asset.kind,
      source: asset.source,
      tags: [...asset.tags],
      description: asset.description,
      ...(asset.url ? { url: asset.url } : {}),
    };
    materials.push(item);
    map[key] = localPath;
  }

  return {
    generatedAt,
    source: 'wechat-on-cloud-material-registry',
    format: 'materials',
    materials,
    map,
    skipped,
  };
}

export function importAutomationMaterials(actor: User, raw: any): AutomationMaterialImportResult {
  const now = new Date().toISOString();
  const source = str(raw?.source || raw?.sourceName || 'wecom-mac', 80).trim() || 'wecom-mac';
  const defaultKind = normalizeMaterialKind(raw?.kind ?? raw?.type) || 'image';
  const defaultApproved = raw?.approveImported === true || raw?.approved === true;
  const defaultEnabled = raw?.enabled !== false;
  const mode = raw?.mode === 'append' ? 'append' : 'upsert';
  const rawItems = extractMaterialImportItems(raw).slice(0, 500);
  const result: AutomationMaterialImportResult = {
    assets: [],
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const [index, rawItem] of rawItems.entries()) {
    try {
      const asset = normalizeMaterialAsset(
        {
          ...rawItem,
          source: rawItem?.source || source,
          kind: rawItem?.kind || rawItem?.type || defaultKind,
          enabled: typeof rawItem?.enabled === 'boolean' ? rawItem.enabled : defaultEnabled,
          approved: typeof rawItem?.approved === 'boolean' ? rawItem.approved : defaultApproved,
          createdAt: now,
          updatedAt: now,
          lastImportedAt: now,
        },
        false,
        now,
      );
      if (!asset.key.trim()) throw new Error('素材 key 为空');
      if (!asset.localPath.trim() && !asset.url.trim() && !asset.description.trim()) throw new Error('素材至少需要本机路径、URL 或说明');
      const existingIndex =
        mode === 'upsert'
          ? data.materialAssets.findIndex((x) => x.source.toLowerCase() === asset.source.toLowerCase() && x.key.toLowerCase() === asset.key.toLowerCase())
          : -1;
      if (existingIndex >= 0) {
        const existing = data.materialAssets[existingIndex];
        const saved: AutomationMaterialAsset = {
          ...asset,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
          lastImportedAt: now,
        };
        data.materialAssets[existingIndex] = saved;
        result.updated += 1;
        result.assets.push(cloneMaterialAsset(saved));
      } else {
        data.materialAssets.push(asset);
        result.imported += 1;
        result.assets.push(cloneMaterialAsset(asset));
      }
    } catch (e: any) {
      result.skipped += 1;
      result.errors.push(`第 ${index + 1} 条跳过：${e?.message || e}`);
    }
  }

  if (data.materialAssets.length > MAX_MATERIAL_ASSETS) {
    data.materialAssets = data.materialAssets.slice(-MAX_MATERIAL_ASSETS);
  }
  if (result.imported || result.updated) {
    persist();
    addAutomationAudit({
      action: 'materials_imported',
      actor: actor.username,
      message: `导入素材资产：新增 ${result.imported} 个，更新 ${result.updated} 个，跳过 ${result.skipped} 个`,
    });
  }
  return result;
}

export function patchAutomationMaterialAsset(actor: User, assetId: string, raw: any): AutomationMaterialAsset {
  const current = data.materialAssets.find((asset) => asset.id === assetId);
  if (!current) throw new Error('素材资产不存在');
  const now = new Date().toISOString();
  const next = normalizeMaterialAsset(
    {
      ...current,
      ...raw,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: now,
      lastImportedAt: current.lastImportedAt,
    },
    true,
    now,
  );
  if (!next.key.trim()) throw new Error('素材 key 不能为空');
  if (!next.localPath.trim() && !next.url.trim() && !next.description.trim()) throw new Error('素材至少需要本机路径、URL 或说明');
  const duplicate = data.materialAssets.find(
    (asset) => asset.id !== current.id && asset.source.toLowerCase() === next.source.toLowerCase() && asset.key.toLowerCase() === next.key.toLowerCase(),
  );
  if (duplicate) throw new Error(`同来源下已存在素材 key：${next.key}`);
  Object.assign(current, next);
  persist();
  addAutomationAudit({
    action: 'material_updated',
    actor: actor.username,
    message: `更新素材资产「${current.key}」：${current.enabled ? '启用' : '停用'}，${current.approved ? '已审核' : '未审核'}`,
  });
  return cloneMaterialAsset(current);
}

export function deleteAutomationMaterialAsset(actor: User, assetId: string): { ok: true } {
  const index = data.materialAssets.findIndex((asset) => asset.id === assetId);
  if (index < 0) throw new Error('素材资产不存在');
  const [removed] = data.materialAssets.splice(index, 1);
  persist();
  addAutomationAudit({
    action: 'material_deleted',
    actor: actor.username,
    message: `删除素材资产「${removed.key}」`,
  });
  return { ok: true };
}

export function listAutomationAudit(limit = 200): AutomationAuditEvent[] {
  const n = clampInt(limit, 1, 1000, 200);
  return data.auditEvents.slice(-n).reverse();
}

export function listMassSendJobs(limit = 100): MassSendJob[] {
  const n = clampInt(limit, 1, 500, 100);
  return data.massSendJobs.slice(-n).reverse().map(cloneMassSendJob);
}

export function createMassSendJob(actor: User, raw: any): MassSendJob {
  const now = new Date().toISOString();
  const job = normalizeMassSendJob(
    {
      ...raw,
      id: randomUUID(),
      status: 'draft',
      approved: false,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.username,
    },
    true,
    now,
  );
  if (job.items.length === 0) throw new Error('群发队列至少需要 1 个联系人或群聊');
  if (!job.message.trim()) throw new Error('群发内容不能为空');
  data.massSendJobs.push(job);
  persist();
  addAutomationAudit({
    action: 'mass_job_created',
    actor: actor.username,
    message: `创建群发队列「${job.title}」，${job.items.length} 个目标`,
  });
  return cloneMassSendJob(job);
}

export function patchMassSendJob(actor: User, jobId: string, raw: any): MassSendJob {
  const job = data.massSendJobs.find((j) => j.id === jobId);
  if (!job) throw new Error('群发队列不存在');
  const now = new Date().toISOString();
  if (typeof raw?.approved === 'boolean') job.approved = raw.approved;
  if (typeof raw?.title === 'string') job.title = str(raw.title, 80).trim() || job.title;
  if (typeof raw?.message === 'string') {
    const msg = str(raw.message, 2000).trim();
    if (!msg) throw new Error('群发内容不能为空');
    job.message = msg;
  }
  if (raw?.status) {
    const status = normalizeMassSendJobStatus(raw.status);
    if (!status) throw new Error('群发队列状态不合法');
    job.status = status;
  }
  if (raw?.options && typeof raw.options === 'object') job.options = normalizeMassSendOptions({ ...job.options, ...raw.options });
  job.updatedAt = now;
  refreshMassJobCompletion(job);
  persist();
  addAutomationAudit({
    action: 'mass_job_updated',
    actor: actor.username,
    message: `更新群发队列「${job.title}」：${job.status}${job.approved ? '，已审核' : '，未审核'}`,
  });
  return cloneMassSendJob(job);
}

export function patchMassSendItem(actor: User, jobId: string, itemId: string, raw: any): MassSendJob {
  const job = data.massSendJobs.find((j) => j.id === jobId);
  if (!job) throw new Error('群发队列不存在');
  const item = job.items.find((x) => x.id === itemId);
  if (!item) throw new Error('群发目标不存在');
  const status = normalizeMassSendItemStatus(raw?.status);
  if (!status) throw new Error('群发目标状态不合法');
  if (status === 'sent') throw new Error('不能手动标记为已发送');
  const reason = str(raw?.error || raw?.reason, 300).trim();
  item.status = status;
  item.error = status === 'pending' ? undefined : reason || (status === 'skipped' ? '手动跳过' : '手动标记失败');
  item.bridgeFailedAt = status === 'failed' ? new Date().toISOString() : undefined;
  item.bridgeRetryCount = undefined;
  if (status === 'pending') {
    item.sentAt = undefined;
    item.auditEventId = undefined;
  }
  item.bridgeClaimedAt = undefined;
  item.bridgeClaimedBy = undefined;
  item.bridgeClaimExpiresAt = undefined;
  if (status !== 'failed') item.bridgeFailedAt = undefined;
  item.bridgeFailedBy = undefined;
  job.updatedAt = new Date().toISOString();
  refreshMassJobCompletion(job);
  persist();
  addAutomationAudit({
    action: `mass_item_${status}`,
    actor: actor.username,
    conversationName: item.recipientName,
    message: `群发队列「${job.title}」目标「${item.recipientName}」标记为 ${status}${item.error ? `：${item.error}` : ''}`,
  });
  return cloneMassSendJob(job);
}

export function listApprovedWecomBridgeMassTasks(limit = 50): WecomBridgeMassSendTask[] {
  const n = clampInt(limit, 1, 200, 50);
  if (!data.settings.enabled || !data.settings.massSendEnabled) return [];
  const now = new Date().toISOString();
  const tasks: WecomBridgeMassSendTask[] = [];
  for (const job of data.massSendJobs) {
    if (tasks.length >= n) break;
    if (!isMassJobBridgeRunnable(job)) continue;
    const item = job.items.find((candidate) => candidate.status === 'pending');
    if (!item) {
      refreshMassJobCompletion(job);
      continue;
    }
    if (item.bridgeClaimedAt && !isMassItemBridgeClaimExpired(item, now)) continue;
    try {
      enforceRateLimits(item.recipientName);
      enforceMassSendDelay(job);
      const risk = assessRisk([job.message]);
      if (risk.level !== 'normal') continue;
    } catch {
      continue;
    }
    tasks.push(massTaskFrom(job, item));
  }
  return tasks;
}

export function patchWecomBridgeMassTaskDelivery(
  actor: User,
  taskId: string,
  raw: any,
): { task?: WecomBridgeMassSendTask; job: MassSendJob; item: MassSendItem; event?: AutomationAuditEvent } {
  ensureBridgeMassTaskEnabled();
  const { jobId, itemId } = parseMassTaskId(taskId);
  const job = data.massSendJobs.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error('群发队列不存在');
  const item = job.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('群发目标不存在');
  const deliveryStatus = normalizeBridgeMassDeliveryStatus(raw?.deliveryStatus ?? raw?.status);
  if (!deliveryStatus) throw new Error('Bridge 群发任务状态不合法');
  if (!isMassJobBridgeRunnable(job) && deliveryStatus !== 'released') throw new Error('群发队列当前不可执行');
  const now = new Date().toISOString();
  const workerId = str(raw?.workerId ?? raw?.replyClaimedBy ?? raw?.clientId ?? actor.username, 120).trim() || actor.username;

  if (deliveryStatus === 'claimed') {
    if (item.status !== 'pending') throw new Error('只有待发送目标可以领取');
    if (item.bridgeClaimedAt && !isMassItemBridgeClaimExpired(item, now) && item.bridgeClaimedBy && item.bridgeClaimedBy !== workerId) {
      throw new Error(`群发目标已由 ${item.bridgeClaimedBy} 领取，未超时前不能重复领取`);
    }
    try {
      enforceRateLimits(item.recipientName);
      enforceMassSendDelay(job);
      const risk = assessRisk([job.message]);
      if (risk.level === 'block') throw new Error(`风险拦截：${risk.reasons.join('；')}`);
      if (risk.level === 'review') throw new Error(`群发内容需要人工复核：${risk.reasons.join('；')}`);
    } catch (e: any) {
      throw new Error(e?.message || '群发任务暂不可领取');
    }
    item.bridgeClaimedAt = now;
    item.bridgeClaimedBy = workerId;
    item.bridgeClaimExpiresAt = claimExpiresAt(now, raw?.claimTtlSeconds ?? raw?.ttlSeconds);
    item.error = undefined;
    item.bridgeFailedAt = undefined;
    item.bridgeFailedBy = undefined;
    job.status = job.status === 'queued' ? 'running' : job.status;
    job.updatedAt = now;
    persist();
    return { task: massTaskFrom(job, item), job: cloneMassSendJob(job), item: { ...item } };
  }

  if (deliveryStatus === 'released') {
    if (item.status === 'sent') throw new Error('已发送目标不能释放领取');
    item.bridgeClaimedAt = undefined;
    item.bridgeClaimedBy = undefined;
    item.bridgeClaimExpiresAt = undefined;
    if (item.status === 'pending') {
      item.error = undefined;
      item.bridgeFailedAt = undefined;
      item.bridgeFailedBy = undefined;
    }
    job.updatedAt = now;
    persist();
    return { task: item.status === 'pending' ? massTaskFrom(job, item) : undefined, job: cloneMassSendJob(job), item: { ...item } };
  }

  if (deliveryStatus === 'failed') {
    if (item.status === 'sent') throw new Error('已发送目标不能标记失败');
    const msg = str(raw?.error ?? raw?.message ?? raw?.reason ?? 'Mac 端群发执行失败', 300).trim() || 'Mac 端群发执行失败';
    item.status = 'failed';
    item.error = msg;
    item.bridgeClaimedAt = undefined;
    item.bridgeClaimedBy = undefined;
    item.bridgeClaimExpiresAt = undefined;
    item.bridgeFailedAt = now;
    item.bridgeFailedBy = workerId;
    job.status = 'paused';
    job.updatedAt = now;
    const event = addAutomationAudit({
      action: 'mass_item_failed',
      actor: actor.username,
      conversationName: item.recipientName,
      message: `Bridge 群发队列「${job.title}」发送给「${item.recipientName}」失败：${msg}`,
    });
    item.auditEventId = event.id;
    persist();
    return { job: cloneMassSendJob(job), item: { ...item }, event };
  }

  if (deliveryStatus === 'sent' || deliveryStatus === 'delivered') {
    if (item.status === 'sent') return { job: cloneMassSendJob(job), item: { ...item } };
    if (item.status !== 'pending') throw new Error('只有待发送目标可以标记为已发送');
    item.status = 'sent';
    item.sentAt = now;
    item.error = undefined;
    item.bridgeClaimedAt = undefined;
    item.bridgeClaimedBy = undefined;
    item.bridgeClaimExpiresAt = undefined;
    item.bridgeFailedAt = undefined;
    item.bridgeFailedBy = undefined;
    item.bridgeRetryCount = undefined;
    job.status = 'running';
    job.updatedAt = now;
    const event = addAutomationAudit({
      action: 'mass_item_sent',
      actor: actor.username,
      conversationName: item.recipientName,
      riskLevel: 'normal',
      message: `Bridge 群发队列「${job.title}」发送给「${item.recipientName}」`,
    });
    item.auditEventId = event.id;
    refreshMassJobCompletion(job);
    persist();
    return { job: cloneMassSendJob(job), item: { ...item }, event };
  }

  throw new Error('Bridge 群发任务状态不合法');
}

export function listMomentDrafts(limit = 100): MomentDraft[] {
  const n = clampInt(limit, 1, 500, 100);
  return data.momentDrafts.slice(-n).reverse().map(cloneMomentDraft);
}

export function createMomentDraft(actor: User, raw: any): MomentDraft {
  const now = new Date().toISOString();
  const draft = normalizeMomentDraft(
    {
      ...raw,
      id: randomUUID(),
      status: 'draft',
      approved: false,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.username,
    },
    true,
    now,
  );
  if (!draft.text.trim()) throw new Error('朋友圈文案不能为空');
  data.momentDrafts.push(draft);
  persist();
  addAutomationAudit({
    action: 'moment_draft_created',
    actor: actor.username,
    message: `创建朋友圈草稿「${draft.title}」`,
  });
  return cloneMomentDraft(draft);
}

export function patchMomentDraft(actor: User, draftId: string, raw: any): MomentDraft {
  const draft = data.momentDrafts.find((d) => d.id === draftId);
  if (!draft) throw new Error('朋友圈草稿不存在');
  const now = new Date().toISOString();
  let shouldClearBridgeState = false;
  if (typeof raw?.approved === 'boolean' && raw.approved !== draft.approved) {
    draft.approved = raw.approved;
    shouldClearBridgeState = true;
  }
  if (typeof raw?.title === 'string') {
    const title = str(raw.title, 80).trim() || draft.title;
    if (title !== draft.title) {
      draft.title = title;
      shouldClearBridgeState = true;
    }
  }
  if (typeof raw?.text === 'string') {
    const text = str(raw.text, 2000).trim();
    if (!text) throw new Error('朋友圈文案不能为空');
    if (text !== draft.text) {
      draft.text = text;
      shouldClearBridgeState = true;
    }
  }
  if (typeof raw?.imageNotes === 'string') {
    const imageNotes = str(raw.imageNotes, 2000).trim();
    if (imageNotes !== draft.imageNotes) {
      draft.imageNotes = imageNotes;
      shouldClearBridgeState = true;
    }
  }
  if (Array.isArray(raw?.materials)) {
    const materials = normalizeMaterials(raw.materials);
    if (materials.join('\n') !== draft.materials.join('\n')) {
      draft.materials = materials;
      shouldClearBridgeState = true;
    }
  }
  if (raw?.status) {
    const status = normalizeMomentDraftStatus(raw.status);
    if (!status) throw new Error('朋友圈草稿状态不合法');
    if (status !== draft.status) {
      draft.status = status;
      shouldClearBridgeState = true;
    }
    if (status === 'published' && !draft.publishedAt) draft.publishedAt = now;
  }
  if (shouldClearBridgeState) clearMomentBridgeState(draft);
  draft.updatedAt = now;
  persist();
  addAutomationAudit({
    action: 'moment_draft_updated',
    actor: actor.username,
    message: `更新朋友圈草稿「${draft.title}」：${draft.status}${draft.approved ? '，已审核' : '，未审核'}`,
  });
  return cloneMomentDraft(draft);
}

export function listApprovedWecomBridgeMomentTasks(limit = 50): WecomBridgeMomentTask[] {
  const n = clampInt(limit, 1, 200, 50);
  if (!data.settings.enabled || !data.settings.momentsEnabled) return [];
  const now = new Date().toISOString();
  const tasks: WecomBridgeMomentTask[] = [];
  for (const draft of data.momentDrafts) {
    if (tasks.length >= n) break;
    if (!isMomentDraftBridgeRunnable(draft)) continue;
    if (draft.bridgeClaimedAt && !isMomentDraftBridgeClaimExpired(draft, now)) continue;
    const risk = assessRisk([draft.text, draft.imageNotes]);
    if (risk.level !== 'normal') continue;
    tasks.push(momentTaskFrom(draft));
  }
  return tasks;
}

export function patchWecomBridgeMomentTaskDelivery(
  actor: User,
  taskId: string,
  raw: any,
): { task?: WecomBridgeMomentTask; draft: MomentDraft; event?: AutomationAuditEvent } {
  ensureBridgeMomentTaskEnabled();
  const draftId = String(taskId || raw?.draftId || '').trim();
  const draft = data.momentDrafts.find((candidate) => candidate.id === draftId);
  if (!draft) throw new Error('朋友圈 Bridge 任务不存在');
  const deliveryStatus = normalizeBridgeMomentDeliveryStatus(raw?.deliveryStatus ?? raw?.status);
  if (!deliveryStatus) throw new Error('Bridge 朋友圈任务状态不合法');
  const now = new Date().toISOString();
  const workerId = str(raw?.workerId ?? raw?.clientId ?? actor.username, 120).trim() || actor.username;

  if (deliveryStatus === 'claimed') {
    if (!isMomentDraftBridgeRunnable(draft)) throw new Error('朋友圈草稿当前不可领取');
    if (draft.bridgeClaimedAt && !isMomentDraftBridgeClaimExpired(draft, now) && draft.bridgeClaimedBy && draft.bridgeClaimedBy !== workerId) {
      throw new Error(`朋友圈草稿已由 ${draft.bridgeClaimedBy} 领取，未超时前不能重复领取`);
    }
    const risk = assessRisk([draft.text, draft.imageNotes]);
    if (risk.level === 'block') throw new Error(`风险拦截：${risk.reasons.join('；')}`);
    if (risk.level === 'review') throw new Error(`朋友圈内容需要人工复核：${risk.reasons.join('；')}`);
    draft.bridgeClaimedAt = now;
    draft.bridgeClaimedBy = workerId;
    draft.bridgeClaimExpiresAt = claimExpiresAt(now, raw?.claimTtlSeconds ?? raw?.ttlSeconds);
    draft.bridgeFailedAt = undefined;
    draft.bridgeFailedBy = undefined;
    draft.bridgeError = undefined;
    draft.updatedAt = now;
    persist();
    return { task: momentTaskFrom(draft), draft: cloneMomentDraft(draft) };
  }

  if (deliveryStatus === 'released') {
    if (draft.status === 'published') throw new Error('已发布草稿不能释放领取');
    clearMomentBridgeClaim(draft);
    draft.updatedAt = now;
    persist();
    return { task: isMomentDraftBridgeRunnable(draft) ? momentTaskFrom(draft) : undefined, draft: cloneMomentDraft(draft) };
  }

  if (deliveryStatus === 'failed') {
    if (draft.status === 'published') throw new Error('已发布草稿不能标记失败');
    const msg = str(raw?.error ?? raw?.message ?? raw?.reason ?? 'Mac 端朋友圈执行失败', 300).trim() || 'Mac 端朋友圈执行失败';
    draft.status = 'draft';
    draft.approved = false;
    draft.bridgeFailedAt = now;
    draft.bridgeFailedBy = workerId;
    draft.bridgeError = msg;
    clearMomentBridgeClaim(draft);
    draft.updatedAt = now;
    const event = addAutomationAudit({
      action: 'moment_draft_failed',
      actor: actor.username,
      message: `Bridge 朋友圈草稿「${draft.title}」准备失败：${msg}`,
    });
    persist();
    return { draft: cloneMomentDraft(draft), event };
  }

  if (deliveryStatus === 'prepared') {
    if (!draft.approved) throw new Error('朋友圈草稿尚未审核，不能标记已准备');
    if (draft.status === 'archived') throw new Error('朋友圈草稿已归档');
    if (draft.status === 'published') throw new Error('朋友圈草稿已标记发布');
    const risk = assessRisk([draft.text, draft.imageNotes]);
    if (risk.level === 'block') throw new Error(`风险拦截：${risk.reasons.join('；')}`);
    if (risk.level === 'review') throw new Error(`朋友圈内容需要人工复核：${risk.reasons.join('；')}`);
    draft.status = 'prepared';
    draft.lastPreparedAt = now;
    draft.bridgeFailedAt = undefined;
    draft.bridgeFailedBy = undefined;
    draft.bridgeError = undefined;
    draft.bridgeRetryCount = undefined;
    clearMomentBridgeClaim(draft);
    draft.updatedAt = now;
    const event = addAutomationAudit({
      action: 'moment_draft_prepared',
      actor: actor.username,
      riskLevel: risk.level,
      message: `Bridge 已准备朋友圈草稿「${draft.title}」，等待人工确认发布`,
    });
    persist();
    return { draft: cloneMomentDraft(draft), event };
  }

  if (deliveryStatus === 'published') {
    if (!draft.approved) throw new Error('朋友圈草稿尚未审核，不能标记发布');
    if (draft.status === 'archived') throw new Error('朋友圈草稿已归档');
    draft.status = 'published';
    draft.publishedAt = now;
    draft.bridgeFailedAt = undefined;
    draft.bridgeFailedBy = undefined;
    draft.bridgeError = undefined;
    draft.bridgeRetryCount = undefined;
    clearMomentBridgeClaim(draft);
    draft.updatedAt = now;
    const event = addAutomationAudit({
      action: 'moment_draft_published',
      actor: actor.username,
      message: `Bridge 标记朋友圈草稿「${draft.title}」已发布`,
    });
    persist();
    return { draft: cloneMomentDraft(draft), event };
  }

  throw new Error('Bridge 朋友圈任务状态不合法');
}

export function addAutomationAudit(event: Omit<AutomationAuditEvent, 'id' | 'timestamp'>): AutomationAuditEvent {
  const full: AutomationAuditEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };
  data.auditEvents.push(full);
  if (data.auditEvents.length > MAX_AUDIT_EVENTS) data.auditEvents = data.auditEvents.slice(-MAX_AUDIT_EVENTS);
  persist();
  return full;
}

export function simulateAutomation(inboundText: string): AutomationDecision {
  const text = String(inboundText || '').trim();
  if (!text) {
    return {
      action: 'none',
      rule: null,
      risk: { level: 'review', reasons: ['没有可判断的客户消息'] },
      reasons: ['没有可判断的客户消息'],
    };
  }

  const rule = findMatchingRule(text);
  if (!rule) {
    const risk = assessRisk([text]);
    return {
      action: risk.level === 'block' ? 'blocked' : 'review',
      rule: null,
      risk,
      reasons: ['未命中已启用关键词规则，可进入 AI 草稿或人工处理'],
    };
  }

  const draftText = ruleText(rule);
  const risk = assessApprovedRule([text], draftText);
  if (!rule.approved) {
    return {
      action: 'review',
      rule,
      risk: { level: 'review', reasons: ['命中规则尚未审核，不能自动发送'] },
      reasons: ['命中规则尚未审核，不能自动发送'],
    };
  }
  if (risk.level === 'block') {
    return {
      action: 'blocked',
      rule,
      risk,
      reasons: risk.reasons,
    };
  }
  return {
    action: risk.level === 'normal' ? 'send-rule' : 'review',
    rule,
    risk,
    reasons: risk.level === 'normal' ? ['命中已审核规则，可在确认后发送'] : risk.reasons,
  };
}

export async function planAutomationReply(req: DraftReplyRequest): Promise<AutomationReplyPlan> {
  const decision = simulateAutomation(req.inboundText);
  const baseReasons = [...decision.reasons, ...decision.risk.reasons].filter(Boolean);
  if (decision.action === 'blocked') {
    return {
      mode: 'blocked',
      decision,
      draft: '',
      canSendRule: false,
      canSendText: false,
      reasons: uniqueStrings(baseReasons),
    };
  }

  if (decision.action === 'send-rule' && decision.rule) {
    const draft = ruleText(decision.rule);
    return {
      mode: data.settings.automaticRuleRepliesEnabled ? 'keyword-rule' : 'manual-review',
      decision,
      draft,
      ruleId: decision.rule.id,
      canSendRule: data.settings.automaticRuleRepliesEnabled && decision.risk.level === 'normal',
      canSendText: false,
      reasons: data.settings.automaticRuleRepliesEnabled
        ? uniqueStrings(baseReasons)
        : uniqueStrings([...baseReasons, '关键词规则自动回复开关未开启，只生成待确认话术']),
    };
  }

  if (!data.settings.aiDraftEnabled) {
    return {
      mode: 'manual-review',
      decision,
      draft: '',
      canSendRule: false,
      canSendText: false,
      reasons: uniqueStrings([...baseReasons, 'AI 草稿开关未开启，请人工处理']),
    };
  }

  const ai = await draftAutomationReply(req);
  if (ai.risk.level === 'block') {
    return {
      mode: 'blocked',
      decision: { ...decision, action: 'blocked', risk: ai.risk },
      draft: ai.draft,
      model: ai.model,
      canSendRule: false,
      canSendText: false,
      reasons: uniqueStrings([...baseReasons, ...ai.risk.reasons]),
    };
  }
  return {
    mode: ai.risk.level === 'normal' ? 'ai-draft' : 'manual-review',
    decision: { ...decision, risk: ai.risk },
    draft: ai.draft,
    model: ai.model,
    canSendRule: false,
    canSendText: ai.risk.level === 'normal',
    reasons:
      ai.risk.level === 'normal'
        ? uniqueStrings([...baseReasons, 'AI 已生成草稿，发送前仍需要人工确认'])
        : uniqueStrings([...baseReasons, ...ai.risk.reasons, 'AI 草稿需要人工复核后再发送']),
  };
}

export interface AutomationSendRequest {
  ruleId: string;
  inboundText?: string;
  conversationName?: string;
  confirm?: boolean;
}

export interface AutomationSendTextRequest {
  text: string;
  inboundText?: string;
  conversationName?: string;
  confirm?: boolean;
  allowReview?: boolean;
}

export interface AutomationExecutor {
  typeText(text: string): Promise<void>;
  key(key: string): Promise<void>;
  openConversation?(recipientName: string, options: ConversationOpenOptions): Promise<void>;
  copyText?(text: string): Promise<void>;
}

export interface ConversationOpenOptions {
  searchShortcut: string;
  searchResultDelaySeconds: number;
  postOpenDelaySeconds: number;
}

export async function sendAutomationRule(
  inst: Instance,
  actor: User,
  req: AutomationSendRequest,
  executor: AutomationExecutor,
): Promise<AutomationAuditEvent> {
  ensureAutomationEnabled(req.confirm);
  const rule = data.rules.find((r) => r.id === req.ruleId);
  if (!rule) throw new Error('规则不存在');
  if (!rule.enabled) throw new Error('规则未启用');
  if (!rule.approved) throw new Error('规则尚未审核，不能发送');
  if (!hasRunnableSteps(rule)) throw new Error('规则没有可发送步骤');

  const conversationName = normalizeConversationName(req.conversationName);
  enforceRateLimits(conversationName);

  const inbound = String(req.inboundText || '').trim();
  const risk = assessApprovedRule(inbound ? [inbound] : [], ruleText(rule));
  if (risk.level !== 'normal') throw new Error(`风险拦截：${risk.reasons.join('；')}`);

  await executeSteps(rule.responseSteps, executor);
  return addAutomationAudit({
    action: 'rule_sent',
    actor: actor.username,
    instanceId: inst.id,
    instanceName: inst.name,
    conversationName,
    ruleId: rule.id,
    ruleName: rule.name,
    riskLevel: risk.level,
    message: `发送已审核规则「${rule.name}」`,
  });
}

export async function sendAutomationText(
  inst: Instance,
  actor: User,
  req: AutomationSendTextRequest,
  executor: AutomationExecutor,
): Promise<AutomationAuditEvent> {
  ensureAutomationEnabled(req.confirm);
  const text = String(req.text || '').trim();
  if (!text || text.length > 500) throw new Error('发送文本为空或超过 500 字');
  const conversationName = normalizeConversationName(req.conversationName);
  enforceRateLimits(conversationName);
  const inbound = String(req.inboundText || '').trim();
  const risk = assessRisk(inbound ? [inbound, text] : [text]);
  if (risk.level === 'block') throw new Error(`风险拦截：${risk.reasons.join('；')}`);
  if (risk.level === 'review' && !req.allowReview) throw new Error(`需要人工复核：${risk.reasons.join('；')}`);

  await executor.typeText(text);
  await executor.key('Return');
  return addAutomationAudit({
    action: 'text_sent',
    actor: actor.username,
    instanceId: inst.id,
    instanceName: inst.name,
    conversationName,
    riskLevel: risk.level,
    message: '确认发送单条文本',
  });
}

export interface MassSendNextRequest {
  confirm?: boolean;
  operatorConfirmedRecipient?: boolean;
  openConversationBeforeSend?: boolean;
}

export interface MassSendNextResult {
  job: MassSendJob;
  item: MassSendItem;
  event: AutomationAuditEvent;
  openedConversation: boolean;
}

export async function sendNextMassSendItem(
  inst: Instance,
  actor: User,
  jobId: string,
  req: MassSendNextRequest,
  executor: AutomationExecutor,
): Promise<MassSendNextResult> {
  ensureFeatureEnabled('mass', req.confirm);
  const job = data.massSendJobs.find((j) => j.id === jobId);
  if (!job) throw new Error('群发队列不存在');
  if (!job.approved) throw new Error('群发队列尚未审核，不能发送');
  if (job.status === 'cancelled') throw new Error('群发队列已取消');
  if (job.status === 'completed') throw new Error('群发队列已完成');
  if (job.status === 'paused') throw new Error('群发队列已暂停');
  const pending = job.items.find((item) => item.status === 'pending');
  if (!pending) {
    job.status = 'completed';
    job.updatedAt = new Date().toISOString();
    persist();
    throw new Error('群发队列没有待发送目标');
  }
  if (pending.bridgeClaimedAt && !isMassItemBridgeClaimExpired(pending)) {
    throw new Error(`群发目标已由 ${pending.bridgeClaimedBy || 'Mac Bridge'} 领取，未超时前不能从 Web 重复发送`);
  }

  enforceRateLimits(pending.recipientName);
  enforceMassSendDelay(job);
  const risk = assessRisk([job.message]);
  if (risk.level === 'block') throw new Error(`风险拦截：${risk.reasons.join('；')}`);
  if (risk.level === 'review') throw new Error(`群发内容需要人工复核：${risk.reasons.join('；')}`);

  const shouldOpenConversation =
    typeof req.openConversationBeforeSend === 'boolean' ? req.openConversationBeforeSend : job.options.openConversationBeforeSend;
  if (job.options.requireOperatorConfirmRecipient && req.operatorConfirmedRecipient !== true) {
    throw new Error(shouldOpenConversation ? '发送前需要确认允许自动搜索并打开目标会话' : '请先确认当前微信窗口已打开目标联系人/群聊');
  }
  try {
    if (shouldOpenConversation) {
      if (!executor.openConversation) throw new Error('当前实例执行器不支持自动打开会话');
      await executor.openConversation(pending.recipientName, {
        searchShortcut: job.options.searchShortcut,
        searchResultDelaySeconds: job.options.searchResultDelaySeconds,
        postOpenDelaySeconds: job.options.postOpenDelaySeconds,
      });
    }

    await executor.typeText(job.message);
    await executor.key('Return');
  } catch (e: any) {
    const msg = str(e?.message || e, 300) || '执行失败';
    const now = new Date().toISOString();
    job.status = 'paused';
    job.updatedAt = now;
    pending.status = 'failed';
    pending.error = msg;
    pending.bridgeClaimedAt = undefined;
    pending.bridgeClaimedBy = undefined;
    pending.bridgeClaimExpiresAt = undefined;
    pending.bridgeFailedAt = now;
    pending.bridgeFailedBy = undefined;
    const event = addAutomationAudit({
      action: 'mass_item_failed',
      actor: actor.username,
      instanceId: inst.id,
      instanceName: inst.name,
      conversationName: pending.recipientName,
      message: `群发队列「${job.title}」发送给「${pending.recipientName}」失败：${msg}`,
    });
    pending.auditEventId = event.id;
    persist();
    throw new Error(`群发执行失败，队列已暂停：${msg}`);
  }

  const now = new Date().toISOString();
  job.status = 'running';
  job.updatedAt = now;
  pending.status = 'sent';
  pending.sentAt = now;
  pending.error = undefined;
  pending.bridgeClaimedAt = undefined;
  pending.bridgeClaimedBy = undefined;
  pending.bridgeClaimExpiresAt = undefined;
  pending.bridgeFailedAt = undefined;
  pending.bridgeFailedBy = undefined;
  pending.bridgeRetryCount = undefined;
  const event = addAutomationAudit({
    action: 'mass_item_sent',
    actor: actor.username,
    instanceId: inst.id,
    instanceName: inst.name,
    conversationName: pending.recipientName,
    riskLevel: risk.level,
    message: `群发队列「${job.title}」${shouldOpenConversation ? '自动打开会话并' : ''}发送给「${pending.recipientName}」`,
  });
  pending.auditEventId = event.id;
  refreshMassJobCompletion(job);
  persist();
  return { job: cloneMassSendJob(job), item: { ...pending }, event, openedConversation: shouldOpenConversation };
}

export interface MomentPrepareRequest {
  confirm?: boolean;
  mode?: MomentPrepareMode;
}

export type MomentPrepareMode = 'fill-current-input' | 'copy-to-clipboard';

export interface MomentPrepareResult {
  draft: MomentDraft;
  event: AutomationAuditEvent;
  mode: MomentPrepareMode;
}

export async function prepareMomentDraft(
  inst: Instance,
  actor: User,
  draftId: string,
  req: MomentPrepareRequest,
  executor: AutomationExecutor,
): Promise<MomentPrepareResult> {
  ensureFeatureEnabled('moments', req.confirm);
  const draft = data.momentDrafts.find((d) => d.id === draftId);
  if (!draft) throw new Error('朋友圈草稿不存在');
  if (!draft.approved) throw new Error('朋友圈草稿尚未审核，不能填入发布框');
  if (draft.status === 'archived') throw new Error('朋友圈草稿已归档');
  if (draft.status === 'published') throw new Error('朋友圈草稿已标记发布');
  if (draft.bridgeClaimedAt && !isMomentDraftBridgeClaimExpired(draft)) {
    throw new Error(`朋友圈草稿已由 ${draft.bridgeClaimedBy || 'Mac Bridge'} 领取，未超时前不能从 Web 重复准备`);
  }
  const risk = assessRisk([draft.text, draft.imageNotes]);
  if (risk.level === 'block') throw new Error(`风险拦截：${risk.reasons.join('；')}`);
  if (risk.level === 'review') throw new Error(`朋友圈内容需要人工复核：${risk.reasons.join('；')}`);

  const mode: MomentPrepareMode = req.mode === 'copy-to-clipboard' ? 'copy-to-clipboard' : 'fill-current-input';
  if (mode === 'copy-to-clipboard') {
    if (!executor.copyText) throw new Error('当前实例执行器不支持写入剪贴板');
    await executor.copyText(draft.text);
  } else {
    await executor.typeText(draft.text);
  }

  const now = new Date().toISOString();
  draft.status = 'prepared';
  draft.lastPreparedAt = now;
  draft.bridgeFailedAt = undefined;
  draft.bridgeFailedBy = undefined;
  draft.bridgeError = undefined;
  draft.bridgeRetryCount = undefined;
  clearMomentBridgeClaim(draft);
  draft.updatedAt = now;
  const event = addAutomationAudit({
    action: 'moment_draft_prepared',
    actor: actor.username,
    instanceId: inst.id,
    instanceName: inst.name,
    riskLevel: risk.level,
    message: mode === 'copy-to-clipboard' ? `已将朋友圈草稿「${draft.title}」复制到实例剪贴板` : `已将朋友圈草稿「${draft.title}」填入当前发布框`,
  });
  persist();
  return { draft: cloneMomentDraft(draft), event, mode };
}

export interface DraftReplyRequest {
  inboundText: string;
  conversationContext?: string;
  extraInstruction?: string;
}

export interface DraftReplyResult {
  draft: string;
  risk: RiskAssessment;
  model: string;
}

export async function draftAutomationReply(req: DraftReplyRequest): Promise<DraftReplyResult> {
  const inboundText = String(req.inboundText || '').trim();
  if (!inboundText) throw new Error('客户消息为空');
  if (inboundText.length > 2000) throw new Error('客户消息过长');

  const apiKey = process.env.AUTOMATION_AI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!apiKey) throw new Error('未配置 AUTOMATION_AI_API_KEY 或 OPENAI_API_KEY');
  const baseUrl = stripTrailingSlash(process.env.AUTOMATION_AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
  const model = process.env.AUTOMATION_AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const matchedKnowledgeItems = selectKnowledgeForAi(
    [inboundText, String(req.conversationContext || ''), String(req.extraInstruction || '')],
    8,
  );

  const payload = {
    model,
    temperature: 0.4,
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: [
          '你是微信私域运营回复助手。只生成一条可直接发送的中文回复草稿。',
          '必须克制、具体、像真人，不要夸大承诺，不要编造价格/政策/资料。',
          '遇到投诉、退款、付款、验证码、账号、安全、法律、医疗等高风险内容时，建议人工处理。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            persona: data.persona,
            knowledgeNotes: data.knowledgeNotes.slice(0, 6000),
            matchedKnowledgeItems: formatKnowledgeForPrompt(matchedKnowledgeItems),
            conversationContext: String(req.conversationContext || '').slice(0, 4000),
            inboundText,
            extraInstruction: String(req.extraInstruction || '').slice(0, 1000),
            outputRules: ['只返回回复正文', '不要解释你的思考过程', '长度控制在 300 字以内'],
          },
          null,
          2,
        ),
      },
    ],
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || body?.message || `AI 接口请求失败 (${res.status})`);
  }
  const draft = String(body?.choices?.[0]?.message?.content || '').trim();
  if (!draft) throw new Error('AI 没有返回回复内容');
  const clipped = draft.slice(0, 500);
  return {
    draft: clipped,
    risk: assessRisk([inboundText, clipped]),
    model,
  };
}

export interface DraftMomentRequest {
  topic: string;
  audience?: string;
  tone?: string;
  extraInstruction?: string;
}

export interface DraftMomentResult {
  draft: string;
  risk: RiskAssessment;
  model: string;
}

export async function draftMomentContent(req: DraftMomentRequest): Promise<DraftMomentResult> {
  const topic = String(req.topic || '').trim();
  if (!topic) throw new Error('朋友圈主题不能为空');
  if (topic.length > 1000) throw new Error('朋友圈主题过长');
  if (!data.settings.aiDraftEnabled) throw new Error('AI 草稿开关未开启');

  const apiKey = process.env.AUTOMATION_AI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!apiKey) throw new Error('未配置 AUTOMATION_AI_API_KEY 或 OPENAI_API_KEY');
  const baseUrl = stripTrailingSlash(process.env.AUTOMATION_AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
  const model = process.env.AUTOMATION_AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const matchedKnowledgeItems = selectKnowledgeForAi(
    [topic, String(req.audience || ''), String(req.tone || ''), String(req.extraInstruction || '')],
    8,
  );
  const payload = {
    model,
    temperature: 0.55,
    max_tokens: 650,
    messages: [
      {
        role: 'system',
        content: [
          '你是微信朋友圈私域运营文案助手。生成一条可以直接发朋友圈的中文文案。',
          '表达要像真人，不要像广告，不要夸大承诺，不写敏感承诺和诱导性话术。',
          '如果主题涉及付款、退款、法律、医疗、账号安全等高风险内容，写成需要人工确认的克制草稿。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            persona: data.persona,
            knowledgeNotes: data.knowledgeNotes.slice(0, 6000),
            matchedKnowledgeItems: formatKnowledgeForPrompt(matchedKnowledgeItems),
            topic,
            audience: String(req.audience || '').slice(0, 500),
            tone: String(req.tone || '').slice(0, 120) || '自然、克制、有个人感',
            extraInstruction: String(req.extraInstruction || '').slice(0, 1000),
            outputRules: ['只返回朋友圈正文', '不要解释', '控制在 500 字以内', '可以自然分段，但不要堆砌表情'],
          },
          null,
          2,
        ),
      },
    ],
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || body?.message || `AI 接口请求失败 (${res.status})`);
  const draft = String(body?.choices?.[0]?.message?.content || '').trim();
  if (!draft) throw new Error('AI 没有返回朋友圈文案');
  const clipped = draft.slice(0, 1000);
  return {
    draft: clipped,
    risk: assessRisk([topic, clipped]),
    model,
  };
}

function normalizeData(raw: any, preserveIds: boolean): AutomationData {
  const now = new Date().toISOString();
  const rulesRaw = Array.isArray(raw?.rules) ? raw.rules : [];
  const knowledgeRaw = Array.isArray(raw?.knowledgeItems) ? raw.knowledgeItems : [];
  const audienceRaw = Array.isArray(raw?.audienceContacts) ? raw.audienceContacts : [];
  const materialRaw = Array.isArray(raw?.materialAssets) ? raw.materialAssets : [];
  const bridgeEventsRaw = Array.isArray(raw?.bridgeEvents) ? raw.bridgeEvents : [];
  const bridgeWorkersRaw = Array.isArray(raw?.bridgeWorkers) ? raw.bridgeWorkers : [];
  const bridgeRunReportsRaw = Array.isArray(raw?.bridgeRunReports) ? raw.bridgeRunReports : [];
  const massJobsRaw = Array.isArray(raw?.massSendJobs) ? raw.massSendJobs : [];
  const momentDraftsRaw = Array.isArray(raw?.momentDrafts) ? raw.momentDrafts : [];
  return {
    settings: normalizeSettings(raw?.settings),
    persona: str(raw?.persona, 2000),
    knowledgeNotes: str(raw?.knowledgeNotes, 50000),
    rules: rulesRaw.slice(0, 200).map((r: any) => normalizeRule(r, preserveIds, now)),
    knowledgeItems: knowledgeRaw.slice(-MAX_KNOWLEDGE_ITEMS).map((item: any) => normalizeKnowledgeItem(item, preserveIds, now)),
    audienceContacts: audienceRaw.slice(-MAX_AUDIENCE_CONTACTS).map((contact: any) => normalizeAudienceContact(contact, preserveIds, now)),
    materialAssets: materialRaw.slice(-MAX_MATERIAL_ASSETS).map((asset: any) => normalizeMaterialAsset(asset, preserveIds, now)),
    bridgeEvents: bridgeEventsRaw.slice(-MAX_BRIDGE_EVENTS).map((event: any) => normalizeBridgeEvent(event, preserveIds, now)),
    bridgeWorkers: bridgeWorkersRaw.slice(-MAX_BRIDGE_WORKERS).map((worker: any) => normalizeBridgeWorker(worker, preserveIds, now)),
    bridgeRunReports: bridgeRunReportsRaw.slice(-MAX_BRIDGE_RUN_REPORTS).map((report: any) => normalizeBridgeRunReport(report, preserveIds, now)),
    runnerPolicy: normalizeRunnerPolicy(raw?.runnerPolicy, now),
    massSendJobs: massJobsRaw.slice(-500).map((j: any) => normalizeMassSendJob(j, preserveIds, now)),
    momentDrafts: momentDraftsRaw.slice(-500).map((d: any) => normalizeMomentDraft(d, preserveIds, now)),
    auditEvents: Array.isArray(raw?.auditEvents) ? raw.auditEvents.slice(-MAX_AUDIT_EVENTS).map(normalizeAuditEvent).filter(Boolean) : [],
  };
}

function normalizeSettings(raw: any): AutomationSettings {
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.enabled,
    aiDraftEnabled: typeof raw?.aiDraftEnabled === 'boolean' ? raw.aiDraftEnabled : DEFAULT_SETTINGS.aiDraftEnabled,
    automaticRuleRepliesEnabled:
      typeof raw?.automaticRuleRepliesEnabled === 'boolean' ? raw.automaticRuleRepliesEnabled : DEFAULT_SETTINGS.automaticRuleRepliesEnabled,
    massSendEnabled: typeof raw?.massSendEnabled === 'boolean' ? raw.massSendEnabled : DEFAULT_SETTINGS.massSendEnabled,
    momentsEnabled: typeof raw?.momentsEnabled === 'boolean' ? raw.momentsEnabled : DEFAULT_SETTINGS.momentsEnabled,
    maximumAutomaticSendsPerHour: clampInt(raw?.maximumAutomaticSendsPerHour, 0, 1000, DEFAULT_SETTINGS.maximumAutomaticSendsPerHour),
    perConversationCooldownMinutes: clampInt(raw?.perConversationCooldownMinutes, 0, 24 * 60, DEFAULT_SETTINGS.perConversationCooldownMinutes),
    requireConfirmForSend: typeof raw?.requireConfirmForSend === 'boolean' ? raw.requireConfirmForSend : DEFAULT_SETTINGS.requireConfirmForSend,
  };
}

function normalizeRule(raw: any, preserveIds: boolean, now: string): AutomationRule {
  const id = preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID();
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  return {
    id,
    name: str(raw?.name || '未命名规则', 80) || '未命名规则',
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
    approved: typeof raw?.approved === 'boolean' ? raw.approved : false,
    priority: clampInt(raw?.priority, 0, 9999, 100),
    triggers: Array.isArray(raw?.triggers)
      ? Array.from(new Set<string>(raw.triggers.map((x: any) => str(x, 80).trim()).filter(Boolean))).slice(0, 50)
      : [],
    responseSteps: Array.isArray(raw?.responseSteps) ? raw.responseSteps.map(normalizeStep).filter(Boolean).slice(0, 30) : [],
    createdAt,
    updatedAt: now,
  };
}

function normalizeKnowledgeItem(raw: any, preserveIds: boolean, now: string): AutomationKnowledgeItem {
  const content = str(raw?.content ?? raw?.answer ?? raw?.text ?? raw?.script ?? raw?.body ?? raw?.notes ?? raw?.reply, 12000).trim();
  const targetNames = normalizeStringList(raw?.targetNames ?? raw?.targets ?? raw?.recipients ?? raw?.contacts ?? raw?.groups, 120, 500);
  const title =
    str(raw?.title ?? raw?.name ?? raw?.question ?? raw?.label, 120).trim() ||
    deriveTitleFromContent(content) ||
    (targetNames.length ? `联系人分组 ${targetNames[0]}` : '未命名资料');
  const category = normalizeKnowledgeCategory(raw?.category ?? raw?.type) || 'other';
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  return {
    id: preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID(),
    title,
    category,
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
    approved: typeof raw?.approved === 'boolean' ? raw.approved : false,
    source: str(raw?.source || 'manual', 80).trim() || 'manual',
    tags: normalizeStringList(raw?.tags ?? raw?.labels ?? raw?.keywords, 60, 30),
    triggers: normalizeStringList(raw?.triggers ?? raw?.keywords ?? raw?.questions ?? raw?.match, 80, 50),
    content,
    targetNames,
    createdAt,
    updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
  };
}

function normalizeAudienceContact(raw: any, preserveIds: boolean, now: string): AutomationAudienceContact {
  const name = str(
    (typeof raw === 'string' ? raw : undefined) ??
      raw?.name ??
      raw?.displayName ??
      raw?.recipientName ??
      raw?.conversationName ??
      raw?.roomName ??
      raw?.groupName ??
      raw?.contactName ??
      raw?.title,
    120,
  ).trim();
  const type = normalizeAudienceContactType(raw?.type ?? raw?.contactType ?? raw?.category, name);
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  return {
    id: preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID(),
    name,
    type,
    aliases: normalizeStringList(raw?.aliases ?? raw?.alias ?? raw?.nicknames ?? raw?.remarkNames, 120, 20),
    tags: normalizeStringList(raw?.tags ?? raw?.labels ?? raw?.groups ?? raw?.segments, 60, 30),
    source: str(raw?.source || 'manual', 80).trim() || 'manual',
    note: str(raw?.note ?? raw?.notes ?? raw?.description ?? raw?.memo, 500).trim(),
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
    approved: typeof raw?.approved === 'boolean' ? raw.approved : false,
    createdAt,
    updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
    lastImportedAt: typeof raw?.lastImportedAt === 'string' && raw.lastImportedAt ? raw.lastImportedAt : undefined,
  };
}

function normalizeMaterialAsset(raw: any, preserveIds: boolean, now: string): AutomationMaterialAsset {
  const key = normalizeMaterialKey(raw?.key ?? raw?.imageKey ?? raw?.materialKey ?? raw?.assetKey ?? raw?.name ?? raw?.title) || '';
  const localPath = str(raw?.localPath ?? raw?.path ?? raw?.imagePath ?? raw?.filePath, 1000).trim();
  const url = str(raw?.url ?? raw?.href ?? raw?.link, 1000).trim();
  const description = str(raw?.description ?? raw?.note ?? raw?.notes ?? raw?.caption ?? raw?.text, 1000).trim();
  const title = str(raw?.title ?? raw?.name ?? raw?.label ?? key, 120).trim() || key || '未命名素材';
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  return {
    id: preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID(),
    key,
    title,
    kind: normalizeMaterialKind(raw?.kind ?? raw?.type ?? raw?.category) || guessMaterialKind(localPath || url),
    source: str(raw?.source || 'manual', 80).trim() || 'manual',
    tags: normalizeStringList(raw?.tags ?? raw?.labels ?? raw?.keywords, 60, 30),
    description,
    localPath,
    url,
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
    approved: typeof raw?.approved === 'boolean' ? raw.approved : false,
    createdAt,
    updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
    lastImportedAt: typeof raw?.lastImportedAt === 'string' && raw.lastImportedAt ? raw.lastImportedAt : undefined,
  };
}

function normalizeBridgeEvent(raw: any, preserveIds: boolean, now: string): WecomBridgeEvent {
  const id = preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID();
  const inboundText = str(raw?.inboundText ?? raw?.text ?? raw?.content ?? raw?.message ?? raw?.body, 4000).trim();
  const conversationName = str(raw?.conversationName ?? raw?.chatName ?? raw?.roomName ?? raw?.contactName ?? raw?.conversation, 120).trim();
  const senderName = str(raw?.senderName ?? raw?.sender ?? raw?.fromName ?? raw?.from ?? raw?.author, 120).trim();
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  const receivedAt = normalizeIsoDate(raw?.receivedAt ?? raw?.messageTime ?? raw?.timestamp ?? raw?.time, now);
  const replySteps = normalizeBridgeReplySteps(raw?.replySteps ?? raw?.steps ?? raw?.responseSteps);
  const replyDraft = str(raw?.replyDraft, 1000).trim() || bridgeReplyTextFromSteps(replySteps) || undefined;
  const event: WecomBridgeEvent = {
    id,
    source: str(raw?.source || 'wecom-mac-bridge', 80).trim() || 'wecom-mac-bridge',
    externalId: str(raw?.externalId ?? raw?.messageId ?? raw?.msgId ?? raw?.eventId, 120).trim() || undefined,
    conversationName,
    senderName,
    inboundText,
    conversationContext: str(raw?.conversationContext ?? raw?.context ?? raw?.recentMessages ?? raw?.history, 6000).trim(),
    status: normalizeBridgeEventStatus(raw?.status) || 'new',
    receivedAt,
    createdAt,
    updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
    lastPlannedAt: typeof raw?.lastPlannedAt === 'string' && raw.lastPlannedAt ? raw.lastPlannedAt : undefined,
    replyDraft,
    replySteps: replySteps.length ? replySteps : undefined,
    replyApproved: typeof raw?.replyApproved === 'boolean' ? raw.replyApproved : false,
    replyApprovedAt: typeof raw?.replyApprovedAt === 'string' && raw.replyApprovedAt ? raw.replyApprovedAt : undefined,
    replyClaimedAt: typeof raw?.replyClaimedAt === 'string' && raw.replyClaimedAt ? raw.replyClaimedAt : undefined,
    replyClaimedBy: str(raw?.replyClaimedBy, 120).trim() || undefined,
    replyClaimExpiresAt: typeof raw?.replyClaimExpiresAt === 'string' && raw.replyClaimExpiresAt ? raw.replyClaimExpiresAt : undefined,
    replyFailedAt: typeof raw?.replyFailedAt === 'string' && raw.replyFailedAt ? raw.replyFailedAt : undefined,
    replyFailedBy: str(raw?.replyFailedBy, 120).trim() || undefined,
    replyError: str(raw?.replyError, 1000).trim() || undefined,
    replyRetryCount: clampInt(raw?.replyRetryCount ?? raw?.retryCount, 0, 100, 0) || undefined,
    replyDeliveredAt: typeof raw?.replyDeliveredAt === 'string' && raw.replyDeliveredAt ? raw.replyDeliveredAt : undefined,
  };
  if (event.replyApproved && !hasRunnableBridgeReply(event)) {
    event.replyApproved = false;
    event.replyApprovedAt = undefined;
  }
  return event;
}

function normalizeBridgeWorker(raw: any, preserveIds: boolean, now: string): WecomBridgeWorker {
  const source = str(raw?.source || 'wecom-mac-bridge', 80).trim() || 'wecom-mac-bridge';
  const workerId = str(raw?.workerId ?? raw?.worker ?? raw?.clientId ?? 'wecom-worker', 120).trim() || 'wecom-worker';
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  const updatedAt = typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now;
  return {
    id: preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : `${source}:${workerId}`,
    workerId,
    source,
    mode: str(raw?.mode || 'unknown', 60).trim() || 'unknown',
    host: str(raw?.host ?? raw?.hostname ?? '', 120).trim(),
    pid: Number.isFinite(Number(raw?.pid)) ? Math.max(0, Math.trunc(Number(raw.pid))) : undefined,
    version: str(raw?.version || '', 80).trim() || undefined,
    note: str(raw?.note || '', 300).trim() || undefined,
    pendingReplies: clampInt(raw?.pendingReplies, 0, 100000, 0),
    pendingMassTasks: clampInt(raw?.pendingMassTasks, 0, 100000, 0),
    pendingMomentTasks: clampInt(raw?.pendingMomentTasks, 0, 100000, 0),
    lastSeenAt: normalizeIsoDate(raw?.lastSeenAt, updatedAt),
    createdAt,
    updatedAt,
  };
}

function normalizeBridgeRunReport(raw: any, preserveIds: boolean, now: string): WecomBridgeRunReport {
  const source = str(raw?.source || 'wecom-mac-bridge', 80).trim() || 'wecom-mac-bridge';
  const workerId =
    str(raw?.workerId ?? raw?.worker ?? raw?.clientId ?? raw?.hostname ?? raw?.host, 120).trim() || `${source}-worker`;
  const startedAt = normalizeIsoDate(raw?.startedAt ?? raw?.startTime ?? raw?.createdAt, now);
  const finishedAt = raw?.finishedAt || raw?.endedAt || raw?.endTime ? normalizeIsoDate(raw?.finishedAt ?? raw?.endedAt ?? raw?.endTime, now) : undefined;
  const rawItems = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.details)
      ? raw.details
      : Array.isArray(raw?.handled)
        ? raw.handled
        : [];
  return {
    id: preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID(),
    source,
    workerId,
    mode: str(raw?.mode ?? raw?.runnerMode ?? raw?.statusMode ?? 'unknown', 60).trim() || 'unknown',
    target: normalizeBridgeRunTarget(raw?.target ?? raw?.runnerTarget),
    status: normalizeBridgeRunStatus(raw?.status ?? raw?.runStatus),
    startedAt,
    finishedAt,
    durationMs: Number.isFinite(Number(raw?.durationMs)) ? Math.max(0, Math.trunc(Number(raw.durationMs))) : undefined,
    handledReplies: clampInt(raw?.handledReplies ?? raw?.repliesHandled, 0, 100000, 0),
    handledMassTasks: clampInt(raw?.handledMassTasks ?? raw?.massHandled ?? raw?.handledMass, 0, 100000, 0),
    handledMomentTasks: clampInt(raw?.handledMomentTasks ?? raw?.momentsHandled ?? raw?.handledMoments, 0, 100000, 0),
    failedReplies: clampInt(raw?.failedReplies ?? raw?.repliesFailed, 0, 100000, 0),
    failedMassTasks: clampInt(raw?.failedMassTasks ?? raw?.massFailed, 0, 100000, 0),
    failedMomentTasks: clampInt(raw?.failedMomentTasks ?? raw?.momentsFailed, 0, 100000, 0),
    error: str(raw?.error ?? raw?.message ?? raw?.reason, 1000).trim() || undefined,
    summary: str(raw?.summary ?? raw?.note, 1000).trim() || undefined,
    items: rawItems.slice(0, MAX_BRIDGE_RUN_REPORT_ITEMS).map(normalizeBridgeRunReportItem),
    createdAt: typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now,
    updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
  };
}

function normalizeBridgeRunReportItem(raw: any): WecomBridgeRunReportItem {
  const base = raw && typeof raw === 'object' ? raw : {};
  const id =
    str(base.id ?? base.taskId ?? base.eventId ?? base.draftId ?? base.externalId, 160).trim() ||
    randomUUID();
  const target = normalizeBridgeRunReportItemTarget(base.target ?? base.kind ?? base.type);
  const name = str(base.name ?? base.conversationName ?? base.recipientName ?? base.title ?? base.label, 240).trim();
  const action = str(base.action ?? base.status ?? base.deliveryStatus, 80).trim();
  const signal = str(base.signal, 80).trim();
  const error = str(base.error ?? base.message ?? base.reason, 500).trim();
  const verification = normalizeBridgeTargetVerification(base, name);
  const item: WecomBridgeRunReportItem = {
    id,
    target,
  };
  if (name) item.name = name;
  if (action) item.action = action;
  if (typeof base.ok === 'boolean') item.ok = base.ok;
  if (typeof base.dryRun === 'boolean') item.dryRun = base.dryRun;
  if (typeof base.claimed === 'boolean') item.claimed = base.claimed;
  if (Number.isFinite(Number(base.exitCode))) item.exitCode = Math.max(0, Math.trunc(Number(base.exitCode)));
  if (signal) item.signal = signal;
  if (error) item.error = error;
  if (verification) item.verification = verification;
  return item;
}

function normalizeBridgeTargetVerification(raw: any, fallbackName = ''): WecomBridgeTargetVerification | undefined {
  const wrapper = raw && typeof raw === 'object' ? raw : {};
  const base =
    wrapper.verification && typeof wrapper.verification === 'object'
      ? wrapper.verification
      : wrapper.targetVerification && typeof wrapper.targetVerification === 'object'
        ? wrapper.targetVerification
        : wrapper.visualCheck && typeof wrapper.visualCheck === 'object'
          ? wrapper.visualCheck
          : wrapper;
  const required =
    typeof base.required === 'boolean'
      ? base.required
      : typeof base.verificationRequired === 'boolean'
        ? base.verificationRequired
        : typeof wrapper.verificationRequired === 'boolean'
          ? wrapper.verificationRequired
          : undefined;
  const verified =
    typeof base.verified === 'boolean'
      ? base.verified
      : typeof base.targetVerified === 'boolean'
        ? base.targetVerified
        : typeof base.conversationVerified === 'boolean'
          ? base.conversationVerified
          : undefined;
  const conversationMatched =
    typeof base.conversationMatched === 'boolean'
      ? base.conversationMatched
      : typeof base.matched === 'boolean'
        ? base.matched
        : typeof base.conversationVerified === 'boolean'
          ? base.conversationVerified
          : undefined;
  const inputReady =
    typeof base.inputReady === 'boolean'
      ? base.inputReady
      : typeof base.inputFocused === 'boolean'
        ? base.inputFocused
        : undefined;
  const rawExpectedName = str(base.expectedName ?? base.expectedConversationName ?? base.targetName, 240).trim();
  const expectedName = rawExpectedName || fallbackName;
  const matchedName = str(base.matchedName ?? base.matchedConversationName ?? base.actualName ?? base.actualConversationName, 240).trim();
  const activeApp = str(base.activeApp ?? base.appName ?? base.applicationName, 120).trim();
  const windowTitle = str(base.windowTitle ?? base.title, 240).trim();
  const ocrText = str(base.ocrText ?? base.visibleText ?? base.screenText, 1000).trim();
  const visualSummary = str(base.visualSummary ?? base.summary ?? base.visualCheckSummary, 500).trim();
  const error = str(base.error ?? base.reason ?? base.verificationError, 500).trim();
  const rawConfidence = Number(base.confidence ?? base.matchConfidence ?? base.score);
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence)) : undefined;
  const checkedAt = base.checkedAt || base.verifiedAt || base.timestamp ? normalizeIsoDate(base.checkedAt ?? base.verifiedAt ?? base.timestamp, new Date().toISOString()) : undefined;

  const hasAny =
    required !== undefined ||
    verified !== undefined ||
    conversationMatched !== undefined ||
    inputReady !== undefined ||
    !!rawExpectedName ||
    !!matchedName ||
    !!activeApp ||
    !!windowTitle ||
    !!ocrText ||
    !!visualSummary ||
    confidence !== undefined ||
    !!error ||
    !!checkedAt;
  if (!hasAny) return undefined;

  const verification: WecomBridgeTargetVerification = {};
  if (required !== undefined) verification.required = required;
  if (verified !== undefined) verification.verified = verified;
  if (expectedName) verification.expectedName = expectedName;
  if (matchedName) verification.matchedName = matchedName;
  if (conversationMatched !== undefined) verification.conversationMatched = conversationMatched;
  if (inputReady !== undefined) verification.inputReady = inputReady;
  if (activeApp) verification.activeApp = activeApp;
  if (windowTitle) verification.windowTitle = windowTitle;
  if (ocrText) verification.ocrText = ocrText;
  if (visualSummary) verification.visualSummary = visualSummary;
  if (confidence !== undefined) verification.confidence = confidence;
  if (error) verification.error = error;
  if (checkedAt) verification.checkedAt = checkedAt;
  return verification;
}

function normalizeRunnerPolicy(raw: any, now: string): WecomBridgeRunnerPolicy {
  const base = raw && typeof raw === 'object' ? raw : {};
  let mode = normalizeBridgeRunnerMode(base.mode ?? base.runnerMode) || DEFAULT_RUNNER_POLICY.mode;
  let target = normalizeBridgeRunnerTarget(base.target ?? base.runnerTarget) || DEFAULT_RUNNER_POLICY.target;
  if (mode === 'send' && target === 'moments') mode = 'prepare';
  return {
    mode,
    target,
    limit: clampInt(base.limit ?? base.runnerLimit, 1, 50, DEFAULT_RUNNER_POLICY.limit),
    claimTtlSeconds: clampInt(base.claimTtlSeconds ?? base.claimTtl ?? base.ttlSeconds, 30, 86400, DEFAULT_RUNNER_POLICY.claimTtlSeconds),
    heartbeatIntervalSeconds: clampInt(
      base.heartbeatIntervalSeconds ?? base.intervalSeconds ?? base.intervalSec,
      15,
      24 * 60 * 60,
      DEFAULT_RUNNER_POLICY.heartbeatIntervalSeconds,
    ),
    momentPasteMode: normalizeMomentPasteMode(base.momentPasteMode ?? base.pasteMode) || DEFAULT_RUNNER_POLICY.momentPasteMode,
    allowSend: base.allowSend === true,
    updatedAt: typeof base.updatedAt === 'string' && base.updatedAt ? base.updatedAt : now,
    updatedBy: str(base.updatedBy || 'system', 80).trim() || 'system',
  };
}

function normalizeMassSendJob(raw: any, preserveIds: boolean, now: string): MassSendJob {
  const id = preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID();
  const recipients = Array.isArray(raw?.recipients)
    ? raw.recipients
    : Array.isArray(raw?.items)
      ? raw.items.map((item: any) => item?.recipientName)
      : [];
  const existingItems = Array.isArray(raw?.items) ? raw.items : [];
  const byName = new Map<string, any>();
  existingItems.forEach((item: any) => {
    const name = str(item?.recipientName, 120).trim();
    if (name) byName.set(name, item);
  });
  const items = uniqueStrings(recipients.map((x: any) => str(x, 120).trim()).filter(Boolean))
    .slice(0, 500)
    .map((name) => normalizeMassSendItem(byName.get(name) || { recipientName: name }, preserveIds, now));
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  return {
    id,
    title: str(raw?.title || '未命名群发队列', 80).trim() || '未命名群发队列',
    message: str(raw?.message, 2000).trim(),
    status: normalizeMassSendJobStatus(raw?.status) || 'draft',
    approved: typeof raw?.approved === 'boolean' ? raw.approved : false,
    createdAt,
    updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
    createdBy: str(raw?.createdBy, 80) || 'system',
    options: normalizeMassSendOptions(raw?.options),
    items,
  };
}

function normalizeMassSendItem(raw: any, preserveIds: boolean, now: string): MassSendItem {
  const status = normalizeMassSendItemStatus(raw?.status) || 'pending';
  return {
    id: preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID(),
    recipientName: str(raw?.recipientName, 120).trim(),
    status,
    sentAt: typeof raw?.sentAt === 'string' && raw.sentAt ? raw.sentAt : undefined,
    auditEventId: str(raw?.auditEventId, 80) || undefined,
    error: str(raw?.error, 300) || undefined,
    bridgeClaimedAt: typeof raw?.bridgeClaimedAt === 'string' && raw.bridgeClaimedAt ? raw.bridgeClaimedAt : undefined,
    bridgeClaimedBy: str(raw?.bridgeClaimedBy, 120).trim() || undefined,
    bridgeClaimExpiresAt: typeof raw?.bridgeClaimExpiresAt === 'string' && raw.bridgeClaimExpiresAt ? raw.bridgeClaimExpiresAt : undefined,
    bridgeFailedAt: typeof raw?.bridgeFailedAt === 'string' && raw.bridgeFailedAt ? raw.bridgeFailedAt : undefined,
    bridgeFailedBy: str(raw?.bridgeFailedBy, 120).trim() || undefined,
    bridgeRetryCount: clampInt(raw?.bridgeRetryCount ?? raw?.retryCount, 0, 100, 0) || undefined,
  };
}

function normalizeMassSendOptions(raw: any): MassSendJobOptions {
  return {
    perSendDelaySeconds: clampInt(raw?.perSendDelaySeconds, 0, 3600, 10),
    requireOperatorConfirmRecipient: typeof raw?.requireOperatorConfirmRecipient === 'boolean' ? raw.requireOperatorConfirmRecipient : true,
    openConversationBeforeSend: typeof raw?.openConversationBeforeSend === 'boolean' ? raw.openConversationBeforeSend : false,
    searchShortcut: normalizeSearchShortcut(raw?.searchShortcut),
    searchResultDelaySeconds: clampInt(raw?.searchResultDelaySeconds, 1, 30, 2),
    postOpenDelaySeconds: clampInt(raw?.postOpenDelaySeconds, 0, 30, 1),
  };
}

function normalizeMomentDraft(raw: any, preserveIds: boolean, now: string): MomentDraft {
  const id = preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID();
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  return {
    id,
    title: str(raw?.title || '未命名朋友圈草稿', 80).trim() || '未命名朋友圈草稿',
    text: str(raw?.text, 2000).trim(),
    imageNotes: str(raw?.imageNotes, 2000).trim(),
    materials: normalizeMaterials(raw?.materials),
    status: normalizeMomentDraftStatus(raw?.status) || 'draft',
    approved: typeof raw?.approved === 'boolean' ? raw.approved : false,
    createdAt,
    updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
    createdBy: str(raw?.createdBy, 80) || 'system',
    lastPreparedAt: typeof raw?.lastPreparedAt === 'string' && raw.lastPreparedAt ? raw.lastPreparedAt : undefined,
    publishedAt: typeof raw?.publishedAt === 'string' && raw.publishedAt ? raw.publishedAt : undefined,
    bridgeClaimedAt: typeof raw?.bridgeClaimedAt === 'string' && raw.bridgeClaimedAt ? raw.bridgeClaimedAt : undefined,
    bridgeClaimedBy: str(raw?.bridgeClaimedBy, 120).trim() || undefined,
    bridgeClaimExpiresAt: typeof raw?.bridgeClaimExpiresAt === 'string' && raw.bridgeClaimExpiresAt ? raw.bridgeClaimExpiresAt : undefined,
    bridgeFailedAt: typeof raw?.bridgeFailedAt === 'string' && raw.bridgeFailedAt ? raw.bridgeFailedAt : undefined,
    bridgeFailedBy: str(raw?.bridgeFailedBy, 120).trim() || undefined,
    bridgeError: str(raw?.bridgeError, 300).trim() || undefined,
    bridgeRetryCount: clampInt(raw?.bridgeRetryCount ?? raw?.retryCount, 0, 100, 0) || undefined,
  };
}

function normalizeStep(raw: any): AutomationStep | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type === 'text') {
    const text = str(raw.text, 500).trim();
    if (!text) return null;
    return { type: 'text', text, sendEnter: raw.sendEnter !== false };
  }
  if (raw.type === 'image') {
    const imagePath = str(raw.imagePath ?? raw.path ?? raw.filePath, 1000).trim();
    const imageKey = normalizeMaterialKey(raw.imageKey ?? raw.materialKey ?? raw.assetKey ?? raw.key);
    if (!imagePath && !imageKey) return null;
    return { type: 'image', ...(imagePath ? { imagePath } : {}), ...(imageKey ? { imageKey } : {}), sendEnter: raw.sendEnter !== false };
  }
  if (raw.type === 'key') {
    const key = str(raw.key, 20).trim();
    if (!/^[A-Za-z_]{1,20}$/.test(key)) return null;
    return { type: 'key', key };
  }
  if (raw.type === 'wait') {
    return { type: 'wait', seconds: clampInt(raw.seconds, 0, 300, 1) };
  }
  return null;
}

function normalizeBridgeReplySteps(raw: any): AutomationStep[] {
  const items = Array.isArray(raw) ? raw : [];
  const steps: AutomationStep[] = [];
  for (const item of items.slice(0, 20)) {
    steps.push(...normalizeBridgeReplyStep(item));
  }
  return steps.slice(0, 30);
}

function normalizeBridgeReplyStep(raw: any): AutomationStep[] {
  if (!raw || typeof raw !== 'object') return [];
  const steps: AutomationStep[] = [];
  const delay = clampInt(raw.delayBeforeSendingSeconds ?? raw.delaySeconds ?? raw.waitSeconds, 0, 600, 0);
  const type = String(raw.type ?? raw.contentType ?? '').trim().toLowerCase();
  if (type === 'wait' || type === 'delay') {
    const seconds = clampInt(raw.seconds ?? raw.delayBeforeSendingSeconds ?? raw.delaySeconds, 0, 600, 1);
    return seconds > 0 ? [{ type: 'wait', seconds }] : [];
  }
  if (type === 'text' || raw.text !== undefined || raw.content !== undefined) {
    const text = str(raw.text ?? raw.content ?? raw.message, 1000).trim();
    if (!text) return [];
    if (delay > 0) steps.push({ type: 'wait', seconds: delay });
    steps.push({ type: 'text', text, sendEnter: raw.sendEnter !== false });
    return steps;
  }
  if (
    type === 'image' ||
    raw.imagePath !== undefined ||
    raw.path !== undefined ||
    raw.filePath !== undefined ||
    raw.imageKey !== undefined ||
    raw.materialKey !== undefined ||
    raw.assetKey !== undefined
  ) {
    const imagePath = str(raw.imagePath ?? raw.path ?? raw.filePath, 1000).trim();
    const imageKey = normalizeMaterialKey(raw.imageKey ?? raw.materialKey ?? raw.assetKey ?? raw.key);
    if (!imagePath && !imageKey) return [];
    if (delay > 0) steps.push({ type: 'wait', seconds: delay });
    steps.push({ type: 'image', ...(imagePath ? { imagePath } : {}), ...(imageKey ? { imageKey } : {}), sendEnter: raw.sendEnter !== false });
    return steps;
  }
  return [];
}

function normalizeMaterialKey(value: unknown): string | undefined {
  const key = str(value, 120).trim();
  return key ? key : undefined;
}

function bridgeReplySteps(event: WecomBridgeEvent): AutomationStep[] {
  if (event.replySteps?.length) return event.replySteps;
  const text = event.replyDraft?.trim();
  return text ? [{ type: 'text', text, sendEnter: true }] : [];
}

function bridgeReplyTextFromSteps(steps: AutomationStep[]): string {
  return steps
    .filter((step): step is Extract<AutomationStep, { type: 'text' }> => step.type === 'text')
    .map((step) => step.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 1000);
}

function hasRunnableBridgeReply(event: WecomBridgeEvent): boolean {
  return bridgeReplySteps(event).some(
    (step) => (step.type === 'text' && !!step.text.trim()) || (step.type === 'image' && !!(step.imagePath?.trim() || step.imageKey?.trim())),
  );
}

function resetBridgeReplyDeliveryState(event: WecomBridgeEvent) {
  event.replyClaimedAt = undefined;
  event.replyClaimedBy = undefined;
  event.replyClaimExpiresAt = undefined;
  event.replyFailedAt = undefined;
  event.replyFailedBy = undefined;
  event.replyError = undefined;
  event.replyRetryCount = undefined;
  event.replyDeliveredAt = undefined;
}

function normalizeAuditEvent(raw: any): AutomationAuditEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: str(raw.id, 80) || randomUUID(),
    timestamp: str(raw.timestamp, 40) || new Date().toISOString(),
    action: str(raw.action, 80) || 'unknown',
    actor: str(raw.actor, 80) || 'system',
    instanceId: str(raw.instanceId, 80) || undefined,
    instanceName: str(raw.instanceName, 120) || undefined,
    conversationName: str(raw.conversationName, 120) || undefined,
    ruleId: str(raw.ruleId, 80) || undefined,
    ruleName: str(raw.ruleName, 120) || undefined,
    riskLevel: raw.riskLevel === 'normal' || raw.riskLevel === 'review' || raw.riskLevel === 'block' ? raw.riskLevel : undefined,
    message: str(raw.message, 300) || '',
  };
}

function persist() {
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
}

function findMatchingRule(text: string): AutomationRule | null {
  const candidates = data.rules
    .filter((rule) => rule.enabled && hasRunnableSteps(rule) && rule.triggers.some((trigger) => text.includes(trigger)))
    .sort((a, b) => (a.priority === b.priority ? a.name.localeCompare(b.name) : a.priority - b.priority));
  return candidates[0] ?? null;
}

function hasRunnableSteps(rule: AutomationRule): boolean {
  return rule.responseSteps.some((step) => step.type === 'text' || step.type === 'key' || step.type === 'image');
}

interface AutomationMaterialReference {
  key: string;
  source: string;
  expectedKind?: AutomationMaterialKind;
  requiresLocalPath: boolean;
}

function collectMaterialReferences(): AutomationMaterialReference[] {
  const refs: AutomationMaterialReference[] = [];
  const pushStepRefs = (steps: AutomationStep[], source: string) => {
    for (const step of steps) {
      if (step.type !== 'image' || !step.imageKey?.trim()) continue;
      refs.push({
        key: step.imageKey,
        source,
        expectedKind: 'image',
        requiresLocalPath: true,
      });
    }
  };

  for (const rule of data.rules.filter((item) => item.enabled && item.approved)) {
    pushStepRefs(rule.responseSteps, `规则「${rule.name}」`);
  }
  for (const event of data.bridgeEvents.filter((item) => item.status !== 'archived' && item.replyApproved && !item.replyDeliveredAt)) {
    pushStepRefs(bridgeReplySteps(event), `Bridge 回复「${event.conversationName || event.senderName || event.id}」`);
  }
  for (const draft of data.momentDrafts.filter((item) => item.approved && item.status === 'ready')) {
    for (const rawKey of draft.materials) {
      const key = normalizeMaterialKey(rawKey);
      if (!key) continue;
      refs.push({
        key,
        source: `朋友圈「${draft.title}」`,
        requiresLocalPath: true,
      });
    }
  }
  return refs;
}

function collectDirectImagePathReferences(): string[] {
  const refs: string[] = [];
  const pushStepRefs = (steps: AutomationStep[], source: string) => {
    for (const step of steps) {
      if (step.type === 'image' && step.imagePath?.trim() && !step.imageKey?.trim()) refs.push(`${source}: ${step.imagePath.trim()}`);
    }
  };
  for (const rule of data.rules.filter((item) => item.enabled && item.approved)) {
    pushStepRefs(rule.responseSteps, `规则「${rule.name}」`);
  }
  for (const event of data.bridgeEvents.filter((item) => item.status !== 'archived' && item.replyApproved && !item.replyDeliveredAt)) {
    pushStepRefs(bridgeReplySteps(event), `Bridge 回复「${event.conversationName || event.senderName || event.id}」`);
  }
  return refs;
}

function checkMaterialReferences(refs: AutomationMaterialReference[]): AutomationPreflightCheck[] {
  if (refs.length === 0) return [];
  const missing: string[] = [];
  const inactive: string[] = [];
  const wrongKind: string[] = [];
  const noLocalPath: string[] = [];

  for (const ref of refs) {
    const asset = findMaterialAssetByKey(ref.key);
    const label = `${ref.source}: ${ref.key}`;
    if (!asset) {
      missing.push(label);
      continue;
    }
    if (!asset.enabled || !asset.approved) {
      inactive.push(`${label}（${asset.enabled ? '启用' : '停用'}，${asset.approved ? '已审核' : '未审核'}）`);
      continue;
    }
    if (ref.expectedKind && asset.kind !== ref.expectedKind) {
      wrongKind.push(`${label}（当前类型 ${asset.kind}）`);
      continue;
    }
    if (ref.requiresLocalPath && !asset.localPath.trim()) {
      noLocalPath.push(label);
    }
  }

  const checks: AutomationPreflightCheck[] = [];
  if (missing.length > 0) {
    checks.push({
      id: 'material_missing',
      level: 'block',
      title: '素材引用不存在',
      message: `${missing.length} 个 imageKey/materialKey 找不到对应素材资产。`,
      count: missing.length,
      refs: missing.slice(0, 10),
      action: '在“素材资产”中导入对应 key，或把回复步骤改为已有 key。',
    });
  }
  if (inactive.length > 0) {
    checks.push({
      id: 'material_inactive',
      level: 'block',
      title: '素材未启用或未审核',
      message: `${inactive.length} 个素材引用存在，但当前不能交给 Runner 使用。`,
      count: inactive.length,
      refs: inactive.slice(0, 10),
      action: '启用并审核这些素材，或替换为已审核素材。',
    });
  }
  if (wrongKind.length > 0) {
    checks.push({
      id: 'material_wrong_kind',
      level: 'block',
      title: '素材类型不匹配',
      message: `${wrongKind.length} 个图片步骤引用的素材不是图片类型。`,
      count: wrongKind.length,
      refs: wrongKind.slice(0, 10),
      action: '把素材类型改为图片，或换成图片素材 key。',
    });
  }
  if (noLocalPath.length > 0) {
    checks.push({
      id: 'material_missing_local_path',
      level: 'block',
      title: '素材缺少 Mac 本机路径',
      message: `${noLocalPath.length} 个素材已登记，但没有 localPath，Mac handler 无法映射为可发送文件。`,
      count: noLocalPath.length,
      refs: noLocalPath.slice(0, 10),
      action: '补充 Mac 可访问的本机路径，或在 Runner 环境里提供等价素材映射。',
    });
  }
  return checks;
}

function findMaterialAssetByKey(key: string): AutomationMaterialAsset | undefined {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return undefined;
  return data.materialAssets.find((asset) => asset.key.trim().toLowerCase() === normalized);
}

function runnerPolicyIncludes(target: WecomBridgeRunnerTarget, queue: WecomBridgeRunnerTarget): boolean {
  return target === 'all' || target === queue;
}

function preflightSummary(checks: AutomationPreflightCheck[]): Record<AutomationPreflightLevel, number> {
  return checks.reduce(
    (summary, check) => {
      summary[check.level] += 1;
      return summary;
    },
    { ok: 0, warn: 0, block: 0 } as Record<AutomationPreflightLevel, number>,
  );
}

function ruleText(rule: AutomationRule): string {
  return rule.responseSteps
    .filter((step): step is Extract<AutomationStep, { type: 'text' }> => step.type === 'text')
    .map((step) => step.text)
    .join('\n');
}

function selectKnowledgeForAi(parts: string[], limit: number): AutomationKnowledgeItem[] {
  const haystack = parts
    .map((part) => String(part || '').toLowerCase())
    .filter(Boolean)
    .join('\n');
  const candidates = data.knowledgeItems.filter((item) => item.enabled && item.approved);
  const scored = candidates
    .map((item) => ({ item, score: scoreKnowledgeItem(item, haystack) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.item.updatedAt) - Date.parse(a.item.updatedAt));

  if (scored.length) return scored.slice(0, limit).map((hit) => cloneKnowledgeItem(hit.item));

  return candidates
    .filter((item) => item.category === 'policy' || item.category === 'faq' || item.category === 'script')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, Math.min(limit, 5))
    .map(cloneKnowledgeItem);
}

function scoreKnowledgeItem(item: AutomationKnowledgeItem, haystack: string): number {
  if (!haystack) return 0;
  let score = 0;
  for (const trigger of item.triggers) {
    if (needleHit(trigger, haystack)) score += 8;
  }
  for (const tag of item.tags) {
    if (needleHit(tag, haystack)) score += 4;
  }
  if (needleHit(item.title, haystack)) score += 3;
  for (const target of item.targetNames) {
    if (needleHit(target, haystack)) score += 2;
  }
  if (item.category === 'policy') score += 1;
  return score;
}

function needleHit(value: string, haystack: string): boolean {
  const needle = value.trim().toLowerCase();
  return needle.length >= 2 && haystack.includes(needle);
}

function formatKnowledgeForPrompt(items: AutomationKnowledgeItem[]) {
  return items.map((item) => ({
    title: item.title,
    category: item.category,
    source: item.source,
    tags: item.tags.slice(0, 12),
    triggers: item.triggers.slice(0, 12),
    targetNames: item.targetNames.slice(0, 30),
    content: item.content.slice(0, 1600),
  }));
}

function assessRisk(parts: string[]): RiskAssessment {
  const content = parts.join('\n');
  const blocked = ['投诉', '举报', '律师', '起诉', '报警', '退款', '退费', '转账', '付款', '支付', '银行卡', '账号', '验证码', '保证通过', '包过', '承诺'];
  const review = ['价格', '多少钱', '费用', '优惠', '发票', '合同', '不满意', '取消', '延期', '资料', '隐私'];
  const blockedHits = blocked.filter((k) => content.includes(k));
  if (blockedHits.length) return { level: 'block', reasons: [`涉及敏感事项：${blockedHits.join('、')}`] };
  const reviewHits = review.filter((k) => content.includes(k));
  if (reviewHits.length) return { level: 'review', reasons: [`回复前请核对：${reviewHits.join('、')}`] };
  return { level: 'normal', reasons: ['未触发敏感规则'] };
}

function assessApprovedRule(inboundParts: string[], draftText: string): RiskAssessment {
  const customerContent = inboundParts.join('\n');
  const inboundBlocked = ['投诉', '举报', '律师', '起诉', '报警', '退款', '退费', '银行卡', '账号', '验证码', '保证通过', '包过', '承诺'];
  const draftBlocked = ['投诉', '举报', '律师', '起诉', '报警', '退款', '退费', '银行卡', '账号', '验证码', '保证通过', '包过', '承诺'];
  const inboundHits = inboundBlocked.filter((k) => customerContent.includes(k));
  if (inboundHits.length) return { level: 'block', reasons: [`客户消息涉及敏感事项：${inboundHits.join('、')}`] };
  const draftHits = draftBlocked.filter((k) => draftText.includes(k));
  if (draftHits.length) return { level: 'block', reasons: [`已审核话术仍包含需人工确认事项：${draftHits.join('、')}`] };
  return { level: 'normal', reasons: ['已审核话术未触发阻断'] };
}

function ensureAutomationEnabled(confirm?: boolean) {
  if (!data.settings.enabled) throw new Error('自动化总开关未开启');
  if (data.settings.requireConfirmForSend && confirm !== true) throw new Error('发送动作需要 confirm=true');
}

function ensureFeatureEnabled(feature: 'mass' | 'moments', confirm?: boolean) {
  ensureAutomationEnabled(confirm);
  if (feature === 'mass' && !data.settings.massSendEnabled) throw new Error('群发队列开关未开启');
  if (feature === 'moments' && !data.settings.momentsEnabled) throw new Error('朋友圈半自动开关未开启');
}

function enforceRateLimits(conversationName?: string) {
  const now = Date.now();
  const sends = data.auditEvents.filter((ev) => ['rule_sent', 'text_sent', 'mass_item_sent'].includes(ev.action));
  const hourlyLimit = data.settings.maximumAutomaticSendsPerHour;
  if (hourlyLimit > 0) {
    const recent = sends.filter((ev) => now - Date.parse(ev.timestamp) < 60 * 60 * 1000);
    if (recent.length >= hourlyLimit) throw new Error('已达到每小时自动发送上限');
  }
  const cooldownMs = data.settings.perConversationCooldownMinutes * 60 * 1000;
  if (conversationName && cooldownMs > 0) {
    const hit = sends.some((ev) => ev.conversationName === conversationName && now - Date.parse(ev.timestamp) < cooldownMs);
    if (hit) throw new Error('该会话处于自动发送冷却时间内');
  }
}

function enforceMassSendDelay(job: MassSendJob) {
  const delayMs = job.options.perSendDelaySeconds * 1000;
  if (delayMs <= 0) return;
  const lastSentAt = job.items
    .filter((item) => item.status === 'sent' && item.sentAt)
    .map((item) => Date.parse(item.sentAt!))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  if (!lastSentAt) return;
  const remaining = delayMs - (Date.now() - lastSentAt);
  if (remaining > 0) throw new Error(`群发队列冷却中，请 ${Math.ceil(remaining / 1000)} 秒后再发送下一条`);
}

function refreshMassJobCompletion(job: MassSendJob) {
  const hasPending = job.items.some((item) => item.status === 'pending');
  if (!hasPending && job.items.length > 0 && job.status !== 'cancelled') job.status = 'completed';
  if (hasPending && job.status === 'completed') job.status = 'queued';
}

async function executeSteps(steps: AutomationStep[], executor: AutomationExecutor) {
  for (const step of steps) {
    if (step.type === 'wait') {
      await sleep(step.seconds * 1000);
    } else if (step.type === 'key') {
      await executor.key(step.key);
    } else if (step.type === 'text') {
      await executor.typeText(step.text);
      if (step.sendEnter !== false) await executor.key('Return');
    } else if (step.type === 'image') {
      throw new Error('实例内自动化暂不支持图片步骤，请通过 Mac Bridge 执行');
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 300000))));
}

function normalizeConversationName(value: unknown): string | undefined {
  const v = str(value, 120).trim();
  return v || undefined;
}

function str(value: unknown, max: number): string {
  return String(value ?? '').replace(/\r/g, '').slice(0, max);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeBridgeRecoveryReleaseMode(value: unknown): BridgeRecoveryReleaseMode | null {
  if (value === false || value === 'false') return 'none';
  if (value === true || value === 'true') return 'expired';
  const v = str(value, 20).trim().toLowerCase();
  if (v === 'none' || v === 'expired' || v === 'all') return v;
  return null;
}

function claimExpiresAt(nowIso: string, rawTtlSeconds: unknown): string {
  const ttl = clampInt(rawTtlSeconds, 30, 24 * 60 * 60, DEFAULT_BRIDGE_REPLY_CLAIM_TTL_SECONDS);
  return new Date(Date.parse(nowIso) + ttl * 1000).toISOString();
}

function isBridgeReplyClaimExpired(event: WecomBridgeEvent, nowIso = new Date().toISOString()): boolean {
  if (!event.replyClaimedAt) return false;
  const expiresAt = event.replyClaimExpiresAt || claimExpiresAt(event.replyClaimedAt, DEFAULT_BRIDGE_REPLY_CLAIM_TTL_SECONDS);
  const expiresMs = Date.parse(expiresAt);
  const nowMs = Date.parse(nowIso);
  return Number.isFinite(expiresMs) && Number.isFinite(nowMs) && expiresMs <= nowMs;
}

function ensureBridgeMassTaskEnabled() {
  if (!data.settings.enabled) throw new Error('自动化总开关未开启');
  if (!data.settings.massSendEnabled) throw new Error('群发队列开关未开启');
}

function ensureBridgeMomentTaskEnabled() {
  if (!data.settings.enabled) throw new Error('自动化总开关未开启');
  if (!data.settings.momentsEnabled) throw new Error('朋友圈半自动开关未开启');
}

function isMassJobBridgeRunnable(job: MassSendJob): boolean {
  return job.approved && (job.status === 'queued' || job.status === 'running') && !!job.message.trim();
}

function isMassItemBridgeClaimExpired(item: MassSendItem, nowIso = new Date().toISOString()): boolean {
  if (!item.bridgeClaimedAt) return false;
  const expiresAt = item.bridgeClaimExpiresAt || claimExpiresAt(item.bridgeClaimedAt, DEFAULT_BRIDGE_REPLY_CLAIM_TTL_SECONDS);
  const expiresMs = Date.parse(expiresAt);
  const nowMs = Date.parse(nowIso);
  return Number.isFinite(expiresMs) && Number.isFinite(nowMs) && expiresMs <= nowMs;
}

function massTaskFrom(job: MassSendJob, item: MassSendItem): WecomBridgeMassSendTask {
  return {
    id: `${job.id}:${item.id}`,
    jobId: job.id,
    itemId: item.id,
    jobTitle: job.title,
    recipientName: item.recipientName,
    message: job.message,
    options: { ...job.options },
    claimedAt: item.bridgeClaimedAt,
    claimedBy: item.bridgeClaimedBy,
    claimExpiresAt: item.bridgeClaimExpiresAt,
  };
}

function parseMassTaskId(taskId: string): { jobId: string; itemId: string } {
  const raw = String(taskId || '');
  const index = raw.indexOf(':');
  if (index <= 0 || index >= raw.length - 1) throw new Error('群发任务 ID 不合法');
  return { jobId: raw.slice(0, index), itemId: raw.slice(index + 1) };
}

function isMomentDraftBridgeRunnable(draft: MomentDraft): boolean {
  return draft.approved && draft.status === 'ready' && !!draft.text.trim() && !draft.bridgeFailedAt;
}

function isMomentDraftBridgeClaimExpired(draft: MomentDraft, nowIso = new Date().toISOString()): boolean {
  if (!draft.bridgeClaimedAt) return false;
  const expiresAt = draft.bridgeClaimExpiresAt || claimExpiresAt(draft.bridgeClaimedAt, DEFAULT_BRIDGE_REPLY_CLAIM_TTL_SECONDS);
  const expiresMs = Date.parse(expiresAt);
  const nowMs = Date.parse(nowIso);
  return Number.isFinite(expiresMs) && Number.isFinite(nowMs) && expiresMs <= nowMs;
}

function momentTaskFrom(draft: MomentDraft): WecomBridgeMomentTask {
  return {
    id: draft.id,
    draftId: draft.id,
    title: draft.title,
    text: draft.text,
    imageNotes: draft.imageNotes,
    materials: [...draft.materials],
    status: draft.status,
    claimedAt: draft.bridgeClaimedAt,
    claimedBy: draft.bridgeClaimedBy,
    claimExpiresAt: draft.bridgeClaimExpiresAt,
  };
}

function clearMomentBridgeClaim(draft: MomentDraft) {
  draft.bridgeClaimedAt = undefined;
  draft.bridgeClaimedBy = undefined;
  draft.bridgeClaimExpiresAt = undefined;
}

function clearMomentBridgeState(draft: MomentDraft) {
  clearMomentBridgeClaim(draft);
  draft.bridgeFailedAt = undefined;
  draft.bridgeFailedBy = undefined;
  draft.bridgeError = undefined;
  draft.bridgeRetryCount = undefined;
}

function cloneRule(rule: AutomationRule): AutomationRule {
  return { ...rule, triggers: [...rule.triggers], responseSteps: rule.responseSteps.map((s) => ({ ...s })) };
}

function cloneKnowledgeItem(item: AutomationKnowledgeItem): AutomationKnowledgeItem {
  return {
    ...item,
    tags: [...item.tags],
    triggers: [...item.triggers],
    targetNames: [...item.targetNames],
  };
}

function cloneAudienceContact(contact: AutomationAudienceContact): AutomationAudienceContact {
  return {
    ...contact,
    aliases: [...contact.aliases],
    tags: [...contact.tags],
  };
}

function cloneMaterialAsset(asset: AutomationMaterialAsset): AutomationMaterialAsset {
  return {
    ...asset,
    tags: [...asset.tags],
  };
}

function cloneBridgeEvent(event: WecomBridgeEvent): WecomBridgeEvent {
  return { ...event, replySteps: event.replySteps?.map((step) => ({ ...step })) };
}

function cloneBridgeRunReport(report: WecomBridgeRunReport): WecomBridgeRunReport {
  return {
    ...report,
    items: report.items.map((item) => ({
      ...item,
      verification: item.verification ? { ...item.verification } : undefined,
    })),
  };
}

function cloneRunnerPolicy(policy: WecomBridgeRunnerPolicy): WecomBridgeRunnerPolicy {
  return { ...policy };
}

function publicBridgeWorker(worker: WecomBridgeWorker, now = Date.now(), offlineAfterSeconds = 180): WecomBridgeWorkerStatus {
  const lastSeenMs = Date.parse(worker.lastSeenAt || worker.updatedAt);
  const staleSeconds = Number.isFinite(lastSeenMs) ? Math.max(0, Math.round((now - lastSeenMs) / 1000)) : offlineAfterSeconds + 1;
  return {
    ...worker,
    online: staleSeconds <= offlineAfterSeconds,
    staleSeconds,
    offlineAfterSeconds,
  };
}

function cloneMassSendJob(job: MassSendJob): MassSendJob {
  return {
    ...job,
    options: { ...job.options },
    items: job.items.map((item) => ({ ...item })),
  };
}

function cloneMomentDraft(draft: MomentDraft): MomentDraft {
  return {
    ...draft,
    materials: [...draft.materials],
  };
}

function emptyBundleCounters(): Record<keyof AutomationBundleSummary, number> {
  return {
    rules: 0,
    knowledgeItems: 0,
    audienceContacts: 0,
    materialAssets: 0,
    massSendJobs: 0,
    momentDrafts: 0,
    bridgeEvents: 0,
  };
}

function emptyBundleIdLists(): Record<keyof AutomationBundleSummary, string[]> {
  return {
    rules: [],
    knowledgeItems: [],
    audienceContacts: [],
    materialAssets: [],
    massSendJobs: [],
    momentDrafts: [],
    bridgeEvents: [],
  };
}

function sumBundleCounters(counters: Record<string, number>): number {
  return Object.values(counters).reduce((sum, value) => sum + value, 0);
}

function automationBundleSummary(source: AutomationData, includeBridgeEvents = false): AutomationBundleSummary {
  return {
    rules: source.rules.length,
    knowledgeItems: source.knowledgeItems.length,
    audienceContacts: source.audienceContacts.length,
    materialAssets: source.materialAssets.length,
    massSendJobs: source.massSendJobs.length,
    momentDrafts: source.momentDrafts.length,
    bridgeEvents: includeBridgeEvents ? source.bridgeEvents.length : 0,
  };
}

function automationBundleSummaryFromRaw(bundle: any): AutomationBundleSummary {
  const config = bundle?.config && typeof bundle.config === 'object' ? bundle.config : bundle;
  return {
    rules: bundleArray(config?.rules ?? bundle?.rules).length,
    knowledgeItems: bundleArray(config?.knowledgeItems ?? bundle?.knowledgeItems).length,
    audienceContacts: bundleArray(bundle?.audienceContacts ?? bundle?.contacts ?? bundle?.audience).length,
    materialAssets: bundleArray(bundle?.materialAssets ?? bundle?.assets ?? bundle?.materials).length,
    massSendJobs: bundleArray(bundle?.massSendJobs ?? bundle?.massJobs).length,
    momentDrafts: bundleArray(bundle?.momentDrafts ?? bundle?.moments).length,
    bridgeEvents: bundleArray(bundle?.bridgeEvents).length,
  };
}

function bundleArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function bundleCategoryLabel(category: keyof AutomationBundleSummary): string {
  const labels: Record<keyof AutomationBundleSummary, string> = {
    rules: '规则',
    knowledgeItems: '接入资料',
    audienceContacts: '受众',
    materialAssets: '素材',
    massSendJobs: '群发队列',
    momentDrafts: '朋友圈草稿',
    bridgeEvents: 'Bridge 消息',
  };
  return labels[category] || String(category);
}

function prepareBundleMassJob(raw: any, keepOperationalState: boolean): any {
  if (keepOperationalState) return raw;
  const items = Array.isArray(raw?.items)
    ? raw.items.map((item: any) => ({
        ...item,
        status: 'pending',
        sentAt: undefined,
        auditEventId: undefined,
        error: undefined,
        bridgeClaimedAt: undefined,
        bridgeClaimedBy: undefined,
        bridgeClaimExpiresAt: undefined,
        bridgeFailedAt: undefined,
        bridgeFailedBy: undefined,
        bridgeRetryCount: undefined,
      }))
    : raw?.items;
  return {
    ...raw,
    approved: false,
    status: 'draft',
    items,
  };
}

function prepareBundleMomentDraft(raw: any, keepOperationalState: boolean): any {
  if (keepOperationalState) return raw;
  return {
    ...raw,
    approved: false,
    status: 'draft',
    lastPreparedAt: undefined,
    publishedAt: undefined,
    bridgeClaimedAt: undefined,
    bridgeClaimedBy: undefined,
    bridgeClaimExpiresAt: undefined,
    bridgeFailedAt: undefined,
    bridgeFailedBy: undefined,
    bridgeError: undefined,
    bridgeRetryCount: undefined,
  };
}

function normalizeMassSendItemStatus(value: unknown): MassSendItemStatus | null {
  return value === 'pending' || value === 'sent' || value === 'failed' || value === 'skipped' ? value : null;
}

function normalizeMassSendJobStatus(value: unknown): MassSendJobStatus | null {
  return value === 'draft' || value === 'queued' || value === 'running' || value === 'paused' || value === 'completed' || value === 'cancelled'
    ? value
    : null;
}

function normalizeMomentDraftStatus(value: unknown): MomentDraftStatus | null {
  return value === 'draft' || value === 'ready' || value === 'prepared' || value === 'published' || value === 'archived' ? value : null;
}

function normalizeAudienceContactType(value: unknown, name = ''): AutomationAudienceContactType {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (['contact', 'person', 'user', 'friend', '客户', '联系人', '个人'].includes(raw)) return 'contact';
  if (['group', '群', '客户群', '社群'].includes(raw)) return 'group';
  if (['room', 'chatroom', 'group-chat', '群聊', '聊天室'].includes(raw)) return 'room';
  const inferred = String(name || '').trim();
  if (/群|班|营|社群|交流群|客户群/.test(inferred)) return 'group';
  return 'unknown';
}

function normalizeBridgeEventStatus(value: unknown): WecomBridgeEventStatus | null {
  return value === 'new' || value === 'planned' || value === 'archived' ? value : null;
}

function normalizeBridgeRunTarget(value: unknown): WecomBridgeRunTarget {
  const raw = String(value || '').toLowerCase();
  if (raw === 'replies' || raw === 'reply') return 'replies';
  if (raw === 'mass' || raw === 'mass-tasks' || raw === 'mass_tasks') return 'mass';
  if (raw === 'moments' || raw === 'moment') return 'moments';
  if (raw === 'all') return 'all';
  return 'unknown';
}

function normalizeBridgeRunReportItemTarget(value: unknown): WecomBridgeRunReportItemTarget {
  const raw = String(value || '').toLowerCase();
  if (raw === 'reply' || raw === 'replies' || raw === 'event') return 'reply';
  if (raw === 'mass' || raw === 'mass-task' || raw === 'mass_tasks' || raw === 'mass-tasks') return 'mass';
  if (raw === 'moment' || raw === 'moments' || raw === 'draft') return 'moment';
  return 'unknown';
}

function normalizeBridgeRunStatus(value: unknown): WecomBridgeRunStatus {
  const raw = String(value || '').toLowerCase();
  if (raw === 'started' || raw === 'running') return 'started';
  if (raw === 'failed' || raw === 'error') return 'failed';
  return 'completed';
}

function normalizeBridgeRunnerMode(value: unknown): WecomBridgeRunnerMode | null {
  const raw = String(value || '').toLowerCase();
  if (raw === 'dry-run' || raw === 'dryrun' || raw === 'dry_run') return 'dry-run';
  if (raw === 'prepare') return 'prepare';
  if (raw === 'send') return 'send';
  return null;
}

function normalizeBridgeRunnerTarget(value: unknown): WecomBridgeRunnerTarget | null {
  const raw = String(value || '').toLowerCase();
  if (raw === 'replies' || raw === 'reply') return 'replies';
  if (raw === 'mass' || raw === 'mass-tasks' || raw === 'mass_tasks') return 'mass';
  if (raw === 'moments' || raw === 'moment') return 'moments';
  if (raw === 'all') return 'all';
  return null;
}

function normalizeMomentPasteMode(value: unknown): WecomBridgeMomentPasteMode | null {
  const raw = String(value || '').toLowerCase();
  if (raw === 'clipboard-only' || raw === 'clipboard' || raw === 'clipboard_only') return 'clipboard-only';
  if (raw === 'current-input' || raw === 'current_input' || raw === 'input') return 'current-input';
  return null;
}

function normalizeBridgeReplyDeliveryStatus(value: unknown): WecomBridgeReplyDeliveryStatus | null {
  return value === 'claimed' || value === 'failed' || value === 'delivered' || value === 'released' ? value : null;
}

function normalizeBridgeMassDeliveryStatus(value: unknown): WecomBridgeMassDeliveryStatus | null {
  if (value === 'claimed' || value === 'failed' || value === 'sent' || value === 'delivered' || value === 'released') return value;
  return null;
}

function normalizeBridgeMomentDeliveryStatus(value: unknown): WecomBridgeMomentDeliveryStatus | null {
  if (value === 'claimed' || value === 'failed' || value === 'prepared' || value === 'published' || value === 'released') return value;
  return null;
}

function normalizeKnowledgeCategory(value: unknown): AutomationKnowledgeCategory | null {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (['faq', 'qa', '问答', '常见问题'].includes(raw)) return 'faq';
  if (['script', '话术', 'sop', 'reply', '回复'].includes(raw)) return 'script';
  if (['policy', '规则', '边界', '禁答', 'policy-note'].includes(raw)) return 'policy';
  if (['contact-group', 'contacts', 'group', '联系人', '群发名单', '人群分组'].includes(raw)) return 'contact-group';
  if (['moment-material', 'moments', '朋友圈', '素材', '运营素材'].includes(raw)) return 'moment-material';
  if (raw === 'other' || raw === '其它' || raw === '其他') return 'other';
  return 'other';
}

function normalizeMaterialKind(value: unknown): AutomationMaterialKind | null {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (['image', 'img', 'picture', 'photo', 'poster', '图片', '海报', '配图'].includes(raw)) return 'image';
  if (['video', 'movie', '视频'].includes(raw)) return 'video';
  if (['file', 'document', 'doc', '文件', '文档'].includes(raw)) return 'file';
  if (['link', 'url', '链接'].includes(raw)) return 'link';
  if (['text', 'copy', 'caption', '文案'].includes(raw)) return 'text';
  if (raw === 'other' || raw === '其它' || raw === '其他') return 'other';
  return 'other';
}

function guessMaterialKind(value: string): AutomationMaterialKind {
  const lower = value.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic|bmp|tiff?)($|\?)/.test(lower)) return 'image';
  if (/\.(mp4|mov|m4v|avi|webm)($|\?)/.test(lower)) return 'video';
  if (/^https?:\/\//.test(lower)) return 'link';
  return 'image';
}

function extractKnowledgeImportItems(raw: any, fallbackCategory: AutomationKnowledgeCategory): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  const rawText = typeof raw?.rawText === 'string' ? raw.rawText : typeof raw?.text === 'string' ? raw.text : '';
  if (!rawText.trim()) return [];

  const parsed = tryParseJson(rawText);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  if (parsed && typeof parsed === 'object') return [parsed];
  return parseKnowledgeText(rawText, fallbackCategory);
}

function extractAudienceImportItems(raw: any): any[] {
  if (Array.isArray(raw)) return raw.map(audienceItemFromRaw);
  if (Array.isArray(raw?.contacts)) return raw.contacts.map(audienceItemFromRaw);
  if (Array.isArray(raw?.audiences)) return raw.audiences.map(audienceItemFromRaw);
  if (Array.isArray(raw?.recipients)) return raw.recipients.map((name: any) => ({ name }));
  if (Array.isArray(raw?.items)) return raw.items.map(audienceItemFromRaw);
  const rawText = typeof raw?.rawText === 'string' ? raw.rawText : typeof raw?.text === 'string' ? raw.text : '';
  if (!rawText.trim()) return [];

  const parsed = tryParseJson(rawText);
  if (Array.isArray(parsed)) return parsed.map(audienceItemFromRaw);
  if (parsed && Array.isArray(parsed.contacts)) return parsed.contacts.map(audienceItemFromRaw);
  if (parsed && Array.isArray(parsed.audiences)) return parsed.audiences.map(audienceItemFromRaw);
  if (parsed && Array.isArray(parsed.recipients)) return parsed.recipients.map((name: any) => ({ name }));
  if (parsed && Array.isArray(parsed.items)) return parsed.items.map(audienceItemFromRaw);
  if (parsed && typeof parsed === 'object') return [parsed];
  return parseAudienceText(rawText);
}

function extractMaterialImportItems(raw: any): any[] {
  if (Array.isArray(raw)) return raw.map(materialItemFromRaw);
  if (Array.isArray(raw?.assets)) return raw.assets.map(materialItemFromRaw);
  if (Array.isArray(raw?.materials)) return raw.materials.map(materialItemFromRaw);
  if (Array.isArray(raw?.items)) return raw.items.map(materialItemFromRaw);
  const rawText = typeof raw?.rawText === 'string' ? raw.rawText : typeof raw?.text === 'string' ? raw.text : '';
  if (!rawText.trim()) return [];

  const parsed = tryParseJson(rawText);
  if (Array.isArray(parsed)) return parsed.map(materialItemFromRaw);
  if (parsed && Array.isArray(parsed.assets)) return parsed.assets.map(materialItemFromRaw);
  if (parsed && Array.isArray(parsed.materials)) return parsed.materials.map(materialItemFromRaw);
  if (parsed && Array.isArray(parsed.items)) return parsed.items.map(materialItemFromRaw);
  if (parsed && typeof parsed === 'object') return [parsed];
  return parseMaterialText(rawText);
}

function audienceItemFromRaw(item: any): any {
  return typeof item === 'string' ? { name: item } : item;
}

function materialItemFromRaw(item: any): any {
  return typeof item === 'string' ? parseMaterialLine(item) : item;
}

function extractBridgeEventItems(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.events)) return raw.events;
  if (Array.isArray(raw?.messages)) return raw.messages;
  if (Array.isArray(raw?.items)) return raw.items;
  return [raw];
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseKnowledgeText(text: string, fallbackCategory: AutomationKnowledgeCategory): any[] {
  return str(text, 120000)
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map((block) => parseKnowledgeBlock(block, fallbackCategory));
}

function parseKnowledgeBlock(block: string, fallbackCategory: AutomationKnowledgeCategory): any {
  const lines = block
    .split(/\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const mapped: Record<string, string> = {};
  const body: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(title|name|question|tags|triggers|targets|recipients|category|标题|名称|问题|标签|关键词|触发词|目标|联系人|分类)\s*[:：]\s*(.+)$/i);
    if (match) {
      mapped[match[1].toLowerCase()] = match[2].trim();
    } else {
      body.push(line.replace(/^#+\s*/, ''));
    }
  }
  const title = mapped.title || mapped.name || mapped.question || mapped['标题'] || mapped['名称'] || mapped['问题'] || body[0] || deriveTitleFromContent(block);
  const content = body.length > 1 ? body.slice(1).join('\n') : body.join('\n');
  return {
    title,
    category: mapped.category || mapped['分类'] || fallbackCategory,
    tags: mapped.tags || mapped['标签'],
    triggers: mapped.triggers || mapped['关键词'] || mapped['触发词'],
    targetNames: mapped.targets || mapped.recipients || mapped['目标'] || mapped['联系人'],
    content: content || block,
  };
}

function parseAudienceText(text: string): any[] {
  return str(text, 120000)
    .split(/\n/g)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean)
    .slice(0, 1000)
    .map((line) => parseAudienceLine(line));
}

function parseAudienceLine(line: string): any {
  const kindMatch = line.match(/^(contact|person|group|room|联系人|客户|群|群聊|客户群|社群)\s*[:：]\s*(.+)$/i);
  const kind = kindMatch?.[1];
  const rest = kindMatch?.[2] || line;
  const parts = rest
    .split(/\t|\|/g)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    name: parts[0] || rest.trim(),
    type: kind || undefined,
    tags: parts[1] || undefined,
    note: parts.slice(2).join(' · '),
  };
}

function parseMaterialText(text: string): any[] {
  return str(text, 120000)
    .split(/\n/g)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean)
    .slice(0, 1000)
    .map((line) => parseMaterialLine(line));
}

function parseMaterialLine(line: string): any {
  const mapped: Record<string, string> = {};
  const kv = line.match(/^(key|imageKey|materialKey|素材|素材key|标题|title|name|path|localPath|url|tags|kind|type|note|description)\s*[:：]\s*(.+)$/i);
  if (kv) {
    mapped[kv[1].toLowerCase()] = kv[2].trim();
    return {
      key: mapped.key || mapped.imagekey || mapped.materialkey || mapped['素材'] || mapped['素材key'],
      title: mapped.title || mapped.name || mapped['标题'],
      kind: mapped.kind || mapped.type,
      localPath: mapped.path || mapped.localpath,
      url: mapped.url,
      tags: mapped.tags,
      description: mapped.note || mapped.description,
    };
  }
  const parts = line
    .split(/\t|\|/g)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    if (parts.length === 2) {
      const locator = materialLocatorFrom(parts[1]);
      return {
        key: parts[0],
        title: locator ? parts[0] : parts[1],
        localPath: locator?.localPath,
        url: locator?.url,
        description: locator ? '' : parts[1],
      };
    }
    return {
      key: parts[0],
      title: parts[1],
      localPath: parts[2],
      tags: parts[3],
      description: parts.slice(4).join(' · '),
    };
  }
  const [key, rest] = line.split(/\s*=>\s*|\s*,\s*/, 2);
  return {
    key: key?.trim() || line,
    localPath: rest?.trim() || '',
  };
}

function materialLocatorFrom(value: string): { localPath?: string; url?: string } | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return { url: raw };
  if (/^(\/|~\/|\.\/|\.\.\/)/.test(raw)) return { localPath: raw };
  if (/\.(png|jpe?g|gif|webp|heic|bmp|tiff?|mp4|mov|m4v|avi|webm|pdf|docx?|xlsx?|pptx?|zip)$/i.test(raw)) return { localPath: raw };
  return null;
}

function normalizeStringList(raw: any, maxLen: number, limit: number): string[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[\n,，、;；]+/g)
      : [];
  return uniqueStrings(values.map((x: any) => str(x, maxLen).trim()).filter(Boolean)).slice(0, limit);
}

function deriveTitleFromContent(content: string): string {
  return content
    .split(/\n/g)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find(Boolean)
    ?.slice(0, 40) || '';
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 100000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return fallback;
}

function normalizeMaterials(raw: any): string[] {
  return Array.isArray(raw) ? uniqueStrings(raw.map((x: any) => str(x, 300).trim()).filter(Boolean)).slice(0, 50) : [];
}

function normalizeSearchShortcut(value: unknown): string {
  const raw = String(value || 'ctrl+f').trim().toLowerCase();
  const allowed = new Set(['ctrl+f', 'ctrl+k', 'ctrl+l', 'super+s']);
  return allowed.has(raw) ? raw : 'ctrl+f';
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
