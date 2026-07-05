import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Instance, User } from './store.js';

export type AutomationStep =
  | { type: 'text'; text: string; sendEnter?: boolean }
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
  replyApproved: boolean;
  replyApprovedAt?: string;
  replyClaimedAt?: string;
  replyClaimedBy?: string;
  replyClaimExpiresAt?: string;
  replyFailedAt?: string;
  replyError?: string;
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
  createdAt: string;
  updatedAt: string;
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
  bridgeError?: string;
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

interface AutomationData extends AutomationConfig {
  audienceContacts: AutomationAudienceContact[];
  bridgeEvents: WecomBridgeEvent[];
  bridgeWorkers: WecomBridgeWorker[];
  bridgeRunReports: WecomBridgeRunReport[];
  massSendJobs: MassSendJob[];
  momentDrafts: MomentDraft[];
  auditEvents: AutomationAuditEvent[];
}

const FILE = process.env.PANEL_AUTOMATION_DATA || '/data/automation.json';
const MAX_AUDIT_EVENTS = 1000;
const MAX_KNOWLEDGE_ITEMS = 500;
const MAX_AUDIENCE_CONTACTS = 2000;
const MAX_BRIDGE_EVENTS = 500;
const MAX_BRIDGE_WORKERS = 100;
const MAX_BRIDGE_RUN_REPORTS = 300;
const DEFAULT_BRIDGE_REPLY_CLAIM_TTL_SECONDS = 300;

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
  bridgeEvents: [],
  bridgeWorkers: [],
  bridgeRunReports: [],
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
      !!event.replyDraft?.trim() &&
      (!event.replyClaimedAt || isBridgeReplyClaimExpired(event, nowIso)) &&
      !event.replyDeliveredAt,
  ).length;
  const claimedReplies = activeBridgeEvents.filter(
    (event) => event.replyApproved && !!event.replyClaimedAt && !isBridgeReplyClaimExpired(event, nowIso) && !event.replyDeliveredAt,
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

export function updateAutomationConfig(raw: any): AutomationConfig {
  data = normalizeData(
    {
      settings: raw?.settings ?? data.settings,
      persona: raw?.persona ?? data.persona,
      knowledgeNotes: raw?.knowledgeNotes ?? data.knowledgeNotes,
      rules: raw?.rules ?? data.rules,
      knowledgeItems: raw?.knowledgeItems ?? data.knowledgeItems,
      audienceContacts: data.audienceContacts,
      bridgeEvents: data.bridgeEvents,
      bridgeWorkers: data.bridgeWorkers,
      bridgeRunReports: data.bridgeRunReports,
      massSendJobs: data.massSendJobs,
      momentDrafts: data.momentDrafts,
      auditEvents: data.auditEvents,
    },
    true,
  );
  persist();
  return getAutomationConfig();
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
          replyApproved: existing.replyApproved,
          replyApprovedAt: existing.replyApprovedAt,
          replyClaimedAt: existing.replyClaimedAt,
          replyClaimedBy: existing.replyClaimedBy,
          replyClaimExpiresAt: existing.replyClaimExpiresAt,
          replyFailedAt: existing.replyFailedAt,
          replyError: existing.replyError,
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
    if ((event.replyDraft || '') !== previousDraft) {
      event.replyClaimedAt = undefined;
      event.replyClaimedBy = undefined;
      event.replyClaimExpiresAt = undefined;
      event.replyFailedAt = undefined;
      event.replyError = undefined;
      event.replyDeliveredAt = undefined;
    }
    if (!event.replyDraft) {
      event.replyApproved = false;
      event.replyApprovedAt = undefined;
      event.replyClaimedAt = undefined;
      event.replyClaimedBy = undefined;
      event.replyClaimExpiresAt = undefined;
      event.replyFailedAt = undefined;
      event.replyError = undefined;
      event.replyDeliveredAt = undefined;
    }
  }
  if (typeof raw?.replyApproved === 'boolean') {
    if (raw.replyApproved && !event.replyDraft?.trim()) throw new Error('批准前需要先保存回复草稿');
    event.replyApproved = raw.replyApproved;
    event.replyApprovedAt = raw.replyApproved ? now : undefined;
    if (!raw.replyApproved) {
      event.replyClaimedAt = undefined;
      event.replyClaimedBy = undefined;
      event.replyClaimExpiresAt = undefined;
      event.replyFailedAt = undefined;
      event.replyError = undefined;
      event.replyDeliveredAt = undefined;
    }
  }
  const deliveryStatus = normalizeBridgeReplyDeliveryStatus(raw?.deliveryStatus);
  if (raw?.deliveryStatus !== undefined && !deliveryStatus) throw new Error('Bridge 回复交付状态不合法');
  if (raw?.markClaimed === true || deliveryStatus === 'claimed') {
    if (!event.replyApproved || !event.replyDraft?.trim()) throw new Error('未批准的回复不能领取');
    if (event.replyDeliveredAt) throw new Error('已交付的回复不能再次领取');
    const workerId = str(raw?.replyClaimedBy ?? raw?.workerId ?? raw?.clientId ?? actor.username, 120).trim() || actor.username;
    if (event.replyClaimedAt && !isBridgeReplyClaimExpired(event, now) && event.replyClaimedBy && event.replyClaimedBy !== workerId) {
      throw new Error(`回复已由 ${event.replyClaimedBy} 领取，未超时前不能重复领取`);
    }
    event.replyClaimedAt = now;
    event.replyClaimedBy = workerId;
    event.replyClaimExpiresAt = claimExpiresAt(now, raw?.claimTtlSeconds ?? raw?.ttlSeconds);
    event.replyFailedAt = undefined;
    event.replyError = undefined;
  }
  if (raw?.markReleased === true || deliveryStatus === 'released') {
    if (event.replyDeliveredAt) throw new Error('已交付的回复不能释放领取');
    event.replyClaimedAt = undefined;
    event.replyClaimedBy = undefined;
    event.replyClaimExpiresAt = undefined;
    event.replyFailedAt = undefined;
    event.replyError = undefined;
  }
  if (raw?.markFailed === true || deliveryStatus === 'failed') {
    if (!event.replyApproved) throw new Error('未批准的回复不能标记失败');
    event.replyFailedAt = now;
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
    event.replyError = undefined;
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
        !!event.replyDraft?.trim() &&
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
  if (status === 'pending') {
    item.sentAt = undefined;
    item.auditEventId = undefined;
  }
  item.bridgeClaimedAt = undefined;
  item.bridgeClaimedBy = undefined;
  item.bridgeClaimExpiresAt = undefined;
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
    if (item.status === 'pending') item.error = undefined;
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
    draft.bridgeError = undefined;
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
    draft.bridgeError = undefined;
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
  draft.bridgeError = undefined;
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
    bridgeEvents: bridgeEventsRaw.slice(-MAX_BRIDGE_EVENTS).map((event: any) => normalizeBridgeEvent(event, preserveIds, now)),
    bridgeWorkers: bridgeWorkersRaw.slice(-MAX_BRIDGE_WORKERS).map((worker: any) => normalizeBridgeWorker(worker, preserveIds, now)),
    bridgeRunReports: bridgeRunReportsRaw.slice(-MAX_BRIDGE_RUN_REPORTS).map((report: any) => normalizeBridgeRunReport(report, preserveIds, now)),
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

function normalizeBridgeEvent(raw: any, preserveIds: boolean, now: string): WecomBridgeEvent {
  const id = preserveIds && typeof raw?.id === 'string' && raw.id ? raw.id : randomUUID();
  const inboundText = str(raw?.inboundText ?? raw?.text ?? raw?.content ?? raw?.message ?? raw?.body, 4000).trim();
  const conversationName = str(raw?.conversationName ?? raw?.chatName ?? raw?.roomName ?? raw?.contactName ?? raw?.conversation, 120).trim();
  const senderName = str(raw?.senderName ?? raw?.sender ?? raw?.fromName ?? raw?.from ?? raw?.author, 120).trim();
  const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  const receivedAt = normalizeIsoDate(raw?.receivedAt ?? raw?.messageTime ?? raw?.timestamp ?? raw?.time, now);
  return {
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
    replyDraft: str(raw?.replyDraft, 1000).trim() || undefined,
    replyApproved: typeof raw?.replyApproved === 'boolean' ? raw.replyApproved : false,
    replyApprovedAt: typeof raw?.replyApprovedAt === 'string' && raw.replyApprovedAt ? raw.replyApprovedAt : undefined,
    replyClaimedAt: typeof raw?.replyClaimedAt === 'string' && raw.replyClaimedAt ? raw.replyClaimedAt : undefined,
    replyClaimedBy: str(raw?.replyClaimedBy, 120).trim() || undefined,
    replyClaimExpiresAt: typeof raw?.replyClaimExpiresAt === 'string' && raw.replyClaimExpiresAt ? raw.replyClaimExpiresAt : undefined,
    replyFailedAt: typeof raw?.replyFailedAt === 'string' && raw.replyFailedAt ? raw.replyFailedAt : undefined,
    replyError: str(raw?.replyError, 1000).trim() || undefined,
    replyDeliveredAt: typeof raw?.replyDeliveredAt === 'string' && raw.replyDeliveredAt ? raw.replyDeliveredAt : undefined,
  };
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
    createdAt: typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now,
    updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
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
    bridgeError: str(raw?.bridgeError, 300).trim() || undefined,
  };
}

function normalizeStep(raw: any): AutomationStep | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type === 'text') {
    const text = str(raw.text, 500).trim();
    if (!text) return null;
    return { type: 'text', text, sendEnter: raw.sendEnter !== false };
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
  return rule.responseSteps.some((step) => step.type === 'text' || step.type === 'key');
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
  draft.bridgeError = undefined;
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

function cloneBridgeEvent(event: WecomBridgeEvent): WecomBridgeEvent {
  return { ...event };
}

function cloneBridgeRunReport(report: WecomBridgeRunReport): WecomBridgeRunReport {
  return { ...report };
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

function normalizeBridgeRunStatus(value: unknown): WecomBridgeRunStatus {
  const raw = String(value || '').toLowerCase();
  if (raw === 'started' || raw === 'running') return 'started';
  if (raw === 'failed' || raw === 'error') return 'failed';
  return 'completed';
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

function audienceItemFromRaw(item: any): any {
  return typeof item === 'string' ? { name: item } : item;
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
