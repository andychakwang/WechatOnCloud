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

export interface AutomationSettings {
  enabled: boolean;
  maximumAutomaticSendsPerHour: number;
  perConversationCooldownMinutes: number;
  requireConfirmForSend: boolean;
}

export interface AutomationConfig {
  settings: AutomationSettings;
  persona: string;
  knowledgeNotes: string;
  rules: AutomationRule[];
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
  auditEvents: AutomationAuditEvent[];
}

const FILE = process.env.PANEL_AUTOMATION_DATA || '/data/automation.json';
const MAX_AUDIT_EVENTS = 1000;

const DEFAULT_SETTINGS: AutomationSettings = {
  enabled: false,
  maximumAutomaticSendsPerHour: 20,
  perConversationCooldownMinutes: 10,
  requireConfirmForSend: true,
};

const DEFAULT_DATA: AutomationData = {
  settings: DEFAULT_SETTINGS,
  persona: '',
  knowledgeNotes: '',
  rules: [],
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
  };
}

export function updateAutomationConfig(raw: any): AutomationConfig {
  data = normalizeData(
    {
      settings: raw?.settings ?? data.settings,
      persona: raw?.persona ?? data.persona,
      knowledgeNotes: raw?.knowledgeNotes ?? data.knowledgeNotes,
      rules: raw?.rules ?? data.rules,
      auditEvents: data.auditEvents,
    },
    true,
  );
  persist();
  return getAutomationConfig();
}

export function listAutomationAudit(limit = 200): AutomationAuditEvent[] {
  const n = clampInt(limit, 1, 1000, 200);
  return data.auditEvents.slice(-n).reverse();
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

function normalizeData(raw: any, preserveIds: boolean): AutomationData {
  const now = new Date().toISOString();
  const rulesRaw = Array.isArray(raw?.rules) ? raw.rules : [];
  return {
    settings: normalizeSettings(raw?.settings),
    persona: str(raw?.persona, 2000),
    knowledgeNotes: str(raw?.knowledgeNotes, 50000),
    rules: rulesRaw.slice(0, 200).map((r: any) => normalizeRule(r, preserveIds, now)),
    auditEvents: Array.isArray(raw?.auditEvents) ? raw.auditEvents.slice(-MAX_AUDIT_EVENTS).map(normalizeAuditEvent).filter(Boolean) : [],
  };
}

function normalizeSettings(raw: any): AutomationSettings {
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.enabled,
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

function enforceRateLimits(conversationName?: string) {
  const now = Date.now();
  const sends = data.auditEvents.filter((ev) => ['rule_sent', 'text_sent'].includes(ev.action));
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

function cloneRule(rule: AutomationRule): AutomationRule {
  return { ...rule, triggers: [...rule.triggers], responseSteps: rule.responseSteps.map((s) => ({ ...s })) };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
