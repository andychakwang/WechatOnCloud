import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import {
  api,
  APP_LABELS,
  appProfile,
  type AutomationBridgeRecoveryResult,
  type AutomationStep,
  type AutomationBridgeStatus,
  type AutomationConfig,
  type AutomationAudienceContact,
  type AutomationAudienceMassJobTypeFilter,
  type AutomationAudienceContactType,
  type AutomationBundleImportResult,
  type AutomationBundleMode,
  type AutomationKnowledgeCategory,
  type AutomationKnowledgeItem,
  type AutomationMaterialAsset,
  type AutomationMaterialKind,
  type AutomationOverview,
  type AutomationPreflightReport,
  type AutomationActionQueue,
  type AutomationReplyPlan,
  type InstanceAutomationSelfTest,
  type MassSendJob,
  type MomentDraft,
  type PanelUser,
  type InstanceWithStatus,
  type VolEntry,
  type AppType,
  type BridgeRecoveryReleaseMode,
  type VersionInfo,
  type WecomBridgeEvent,
  type WecomBridgeMomentPasteMode,
  type WecomBridgeRunReport,
  type WecomBridgeWorkerCapability,
  type WecomBridgeRunnerEngine,
  type WecomBridgeRunnerMode,
  type WecomBridgeRunnerPolicy,
  type WecomBridgeRunnerTarget,
  type WecomRpaPackage,
  type WecomRpaPackageFormat,
  type WecomRpaPackageTarget,
} from '../api';
import { InstanceIcon, ICON_CHOICES } from '../AppIcon';
import { useUI, PasswordInput } from '../ui';
import { useAuth } from '../auth';

const BUSY_PHASES = ['downloading', 'extracting', 'installing'];

function fmtBytes(n: number): string {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}
function fmtDate(ms: number): string {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtStaleSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '未知';
  if (seconds < 10) return '刚刚';
  if (seconds < 60) return `${Math.round(seconds)} 秒前`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时前`;
  return `${Math.round(seconds / 86400)} 天前`;
}
function isPastIso(value?: string): boolean {
  if (!value) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms <= Date.now();
}

const MenuIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// 折叠菜单的展开箭头
const CaretIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// 数据卷文件浏览器用的小图标（线性 SVG，统一描边风格，替代渲染不一致的 emoji）
const svgIcon = (children: JSX.Element, size = 16) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const FolderIcon = svgIcon(<path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />, 18);
const FileIcon = svgIcon(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </>,
  18,
);
const DownloadIcon = svgIcon(
  <>
    <path d="M12 3v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M5 21h14" />
  </>,
);
const EditIcon = svgIcon(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </>,
);
const TrashIcon = svgIcon(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
  </>,
);

// 友好空状态：圆形图标 + 标题 + 说明 + 可选引导按钮（沿用首页 .empty-state 样式）
function EmptyState({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: JSX.Element }) {
  return (
    <div className="empty-state">
      <div className="empty-blob">{icon}</div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

const RELEASES_URL = 'https://github.com/Gloridust/WechatOnCloud/releases';

const DIAG_RANGE_OPTIONS = [
  { key: '24h', label: '24 小时' },
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: '1y', label: '1 年' },
];

const AUTO_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  queued: '待发送',
  running: '进行中',
  paused: '已暂停',
  completed: '已完成',
  cancelled: '已取消',
  ready: '已就绪',
  prepared: '已填入',
  published: '已发布',
  archived: '已归档',
  pending: '待发',
  sent: '已发',
  failed: '失败',
  skipped: '跳过',
  new: '新消息',
  planned: '已生成',
};

const KNOWLEDGE_CATEGORY_LABEL: Record<AutomationKnowledgeCategory, string> = {
  faq: 'FAQ',
  script: '话术',
  policy: '边界',
  'contact-group': '人群',
  'moment-material': '朋友圈',
  other: '其他',
};

const AUDIENCE_TYPE_LABEL: Record<AutomationAudienceContactType, string> = {
  contact: '联系人',
  group: '客户群',
  room: '群聊',
  unknown: '未分类',
};

const MATERIAL_KIND_LABEL: Record<AutomationMaterialKind, string> = {
  image: '图片',
  video: '视频',
  file: '文件',
  link: '链接',
  text: '文案',
  other: '其他',
};

const BRIDGE_RUN_TARGET_LABEL: Record<string, string> = {
  replies: 'AI 回复',
  mass: '群发',
  moments: '朋友圈',
  all: '全队列',
  doctor: '接入体检',
  unknown: '未知',
};

const BRIDGE_RUN_ITEM_TARGET_LABEL: Record<string, string> = {
  reply: '回复',
  mass: '群发',
  moment: '朋友圈',
  doctor: '体检',
  unknown: '未知',
};

function bridgeRunVerificationSummary(item: { verification?: WecomBridgeRunReport['items'][number]['verification'] }): string {
  const verification = item.verification;
  if (!verification) return '';
  const parts: string[] = [];
  if (verification.verified === true) parts.push('校验通过');
  else if (verification.verified === false) parts.push('校验失败');
  else if (verification.required) parts.push('待校验');
  if (verification.matchedName) parts.push(`命中 ${verification.matchedName}`);
  else if (verification.expectedName) parts.push(`目标 ${verification.expectedName}`);
  if (verification.windowTitle) parts.push(`窗口 ${verification.windowTitle}`);
  else if (verification.activeApp) parts.push(`应用 ${verification.activeApp}`);
  if (verification.inputReady === false) parts.push('输入框未就绪');
  if (verification.error) parts.push(verification.error);
  return parts.slice(0, 4).join(' · ');
}

const BRIDGE_RUNNER_MODE_LABEL: Record<WecomBridgeRunnerMode, string> = {
  'dry-run': '只预览',
  prepare: '领取并准备',
  send: '受控发送',
};

const BRIDGE_RUNNER_ENGINE_LABEL: Record<WecomBridgeRunnerEngine, string> = {
  bridge: 'Bridge 队列',
  'rpa-package': 'RPA 运行包',
};

const BRIDGE_RUNNER_TARGET_LABEL: Record<WecomBridgeRunnerTarget, string> = {
  replies: 'AI 回复',
  mass: '群发',
  moments: '朋友圈',
  all: '全队列',
};

const BRIDGE_WORKER_CAPABILITY_LABEL: Record<WecomBridgeWorkerCapability, string> = {
  reply: '回复',
  mass: '群发',
  moment: '朋友圈',
  'rpa-package': 'RPA 包',
  prepare: '准备',
  send: '发送',
  'target-match': '目标校验',
  'handler-verification': '交付校验',
  'visual-verification': '视觉校验',
  'material-map': '素材',
};

const BRIDGE_RECOVERY_RELEASE_LABEL: Record<BridgeRecoveryReleaseMode, string> = {
  expired: '超时领取',
  all: '全部领取',
  none: '不释放',
};

const BRIDGE_RECOVERY_ACTION_LABEL: Record<string, string> = {
  'release-claim': '释放领取',
  'retry-failed': '重试失败',
};

const AUTOMATION_RISK_LABEL: Record<string, string> = {
  automation_off: '总开关关闭',
  bridge_workers_offline: 'Mac 离线',
  pending_without_worker: '有待办无在线 Mac',
  worker_lacks_reply: 'Mac 缺回复能力',
  worker_lacks_mass: 'Mac 缺群发能力',
  worker_lacks_moment: 'Mac 缺朋友圈能力',
  worker_lacks_rpa_package: 'Mac 缺 RPA 包能力',
  mass_failures: '群发失败',
  moment_failures: '朋友圈失败',
};

const PREFLIGHT_LEVEL_LABEL: Record<string, string> = {
  ok: '正常',
  warn: '提醒',
  block: '阻断',
};

const ACTION_QUEUE_PRIORITY_LABEL: Record<string, string> = {
  block: '阻断',
  high: '高优先',
  normal: '普通',
  low: '低',
};

const ACTION_QUEUE_TARGET_LABEL: Record<string, string> = {
  ops: '运维',
  reply: 'AI 回复',
  mass: '群发',
  moment: '朋友圈',
};

function preflightLevelClass(level: string): string {
  if (level === 'block') return 'tag-off';
  if (level === 'warn') return 'tag-warn';
  return 'tag-on';
}

function actionQueuePriorityClass(priority: string): string {
  if (priority === 'block') return 'tag-off';
  if (priority === 'high') return 'tag-warn';
  if (priority === 'low') return '';
  return 'tag-on';
}

function actionQueueRpaTarget(queue: AutomationActionQueue): {
  target: WecomRpaPackageTarget;
  total: number;
  replies: number;
  mass: number;
  moments: number;
  limit: number;
  ready: boolean;
  blockedByPreflight: boolean;
  reason: string;
  label: string;
} {
  if (queue.handoff?.rpa) return queue.handoff.rpa;
  const replies = queue.items.filter((item) => item.target === 'reply').length;
  const mass = queue.items.filter((item) => item.target === 'mass').length;
  const moments = queue.items.filter((item) => item.target === 'moment').length;
  const total = replies + mass + moments;
  const active = [
    { target: 'replies' as const, count: replies, label: 'AI 回复' },
    { target: 'mass' as const, count: mass, label: '群发' },
    { target: 'moments' as const, count: moments, label: '朋友圈' },
  ].filter((item) => item.count > 0);
  const target = active.length === 1 ? active[0].target : 'all';
  return {
    target,
    total,
    replies,
    mass,
    moments,
    limit: 50,
    ready: total > 0,
    blockedByPreflight: false,
    reason: total > 0 ? '可生成 RPA 运行包预览。' : '暂无可交给 Mac/RPA 的任务。',
    label: active.length === 1 ? active[0].label : '全队列',
  };
}

function linesOf(text: string): string[] {
  return Array.from(new Set(text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)));
}

function bundleCount(result?: AutomationBundleImportResult | null): string {
  if (!result) return '';
  const imported = Object.values(result.imported || {}).reduce((sum, value) => sum + value, 0);
  const updated = Object.values(result.updated || {}).reduce((sum, value) => sum + value, 0);
  return `新增 ${imported} · 更新 ${updated} · 跳过 ${result.skipped}`;
}

function bridgeRecoveryCount(result?: AutomationBridgeRecoveryResult | null): { released: number; retried: number; total: number } {
  if (!result) return { released: 0, retried: 0, total: 0 };
  const released = result.replies.releasedClaims + result.mass.releasedClaims + result.moments.releasedClaims;
  const retried = result.replies.retriedFailed + result.mass.retriedFailed + result.moments.retriedFailed;
  return { released, retried, total: result.totalChanged };
}

function compactDateForFile(date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}

function replyStepsFromDraft(draft: string): AutomationStep[] {
  const steps: AutomationStep[] = [];
  let buffer: string[] = [];
  const flushText = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (text) steps.push({ type: 'text', text, sendEnter: true });
  };
  for (const rawLine of draft.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    const wait = line.match(/^(?:\[?\s*wait|等待)\s*[:：]?\s*(\d{1,3})\s*(?:s|秒)?\s*\]?$/i);
    if (wait) {
      flushText();
      const seconds = Math.max(1, Math.min(600, Number(wait[1])));
      steps.push({ type: 'wait', seconds });
      continue;
    }
    const image = line.match(/^(?:\[\s*image\s+(.+?)\s*\]|图片\s*[:：]\s*(.+)|image\s*[:：]\s*(.+))$/i);
    if (image) {
      flushText();
      const imagePath = (image[1] || image[2] || image[3] || '').trim();
      if (imagePath) steps.push({ type: 'image', imagePath, sendEnter: true });
      continue;
    }
    const imageKey = line.match(/^(?:\[\s*(?:image-key|material|asset)\s+(.+?)\s*\]|素材\s*[:：]\s*(.+)|(?:image-key|material|asset)\s*[:：]\s*(.+))$/i);
    if (imageKey) {
      flushText();
      const key = (imageKey[1] || imageKey[2] || imageKey[3] || '').trim();
      if (key) steps.push({ type: 'image', imageKey: key, sendEnter: true });
      continue;
    }
    if (!line) {
      flushText();
      continue;
    }
    buffer.push(rawLine);
  }
  flushText();
  return steps.slice(0, 30);
}

function replyStepSummary(steps?: AutomationStep[]): string {
  const items = steps || [];
  const textCount = items.filter((step) => step.type === 'text').length;
  const imagePathCount = items.filter((step) => step.type === 'image' && !!step.imagePath).length;
  const imageKeyCount = items.filter((step) => step.type === 'image' && !!step.imageKey && !step.imagePath).length;
  const waitSeconds = items.reduce((sum, step) => (step.type === 'wait' ? sum + step.seconds : sum), 0);
  if (!items.length) return '单段回复';
  return `${textCount} 段文本${imagePathCount ? ` · ${imagePathCount} 张本机图片` : ''}${imageKeyCount ? ` · ${imageKeyCount} 个素材 key` : ''}${waitSeconds ? ` · 等待 ${waitSeconds} 秒` : ''}`;
}

function defaultAutomationConfig(): AutomationConfig {
  return {
    settings: {
      enabled: false,
      aiDraftEnabled: true,
      automaticRuleRepliesEnabled: true,
      massSendEnabled: false,
      momentsEnabled: false,
      maximumAutomaticSendsPerHour: 20,
      perConversationCooldownMinutes: 10,
      requireConfirmForSend: true,
    },
    persona: '',
    knowledgeNotes: '',
    rules: [],
    knowledgeItems: [],
  };
}

function jobProgress(job: MassSendJob): string {
  const sent = job.items.filter((item) => item.status === 'sent').length;
  return `${sent}/${job.items.length}`;
}

function nextMassTarget(job: MassSendJob): string {
  return job.items.find((item) => item.status === 'pending')?.recipientName || '';
}

function AutomationWorkbench({ instances }: { instances: InstanceWithStatus[] }) {
  const { toast, confirm } = useUI();
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [audienceContacts, setAudienceContacts] = useState<AutomationAudienceContact[]>([]);
  const [materialAssets, setMaterialAssets] = useState<AutomationMaterialAsset[]>([]);
  const [jobs, setJobs] = useState<MassSendJob[]>([]);
  const [drafts, setDrafts] = useState<MomentDraft[]>([]);
  const [audit, setAudit] = useState<import('../api').AutomationAuditEvent[]>([]);
  const [overview, setOverview] = useState<AutomationOverview | null>(null);
  const [preflight, setPreflight] = useState<AutomationPreflightReport | null>(null);
  const [actionQueue, setActionQueue] = useState<AutomationActionQueue | null>(null);
  const [bridge, setBridge] = useState<AutomationBridgeStatus | null>(null);
  const [bridgeEvents, setBridgeEvents] = useState<WecomBridgeEvent[]>([]);
  const [bridgeRuns, setBridgeRuns] = useState<WecomBridgeRunReport[]>([]);
  const [runnerPolicy, setRunnerPolicy] = useState<WecomBridgeRunnerPolicy | null>(null);
  const [bridgeReplyDrafts, setBridgeReplyDrafts] = useState<Record<string, string>>({});
  const [recoveryReleaseClaims, setRecoveryReleaseClaims] = useState<BridgeRecoveryReleaseMode>('expired');
  const [recoveryRetryFailed, setRecoveryRetryFailed] = useState(true);
  const [recoveryIncludeReplies, setRecoveryIncludeReplies] = useState(true);
  const [recoveryIncludeMass, setRecoveryIncludeMass] = useState(true);
  const [recoveryIncludeMoments, setRecoveryIncludeMoments] = useState(true);
  const [recoveryWorkerId, setRecoveryWorkerId] = useState('');
  const [recoveryFailureReason, setRecoveryFailureReason] = useState('');
  const [recoveryMinFailedAge, setRecoveryMinFailedAge] = useState('0');
  const [recoveryMaxRetryAttempts, setRecoveryMaxRetryAttempts] = useState('0');
  const [recoveryCursor, setRecoveryCursor] = useState('');
  const [recoveryLimit, setRecoveryLimit] = useState('500');
  const [recoveryPreview, setRecoveryPreview] = useState<AutomationBridgeRecoveryResult | null>(null);
  const [rpaPackageTarget, setRpaPackageTarget] = useState<WecomRpaPackageTarget>('all');
  const [rpaPackageLimit, setRpaPackageLimit] = useState('50');
  const [rpaPackagePreview, setRpaPackagePreview] = useState<WecomRpaPackage | null>(null);
  const [rpaPackageIncludeSource, setRpaPackageIncludeSource] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [selfTest, setSelfTest] = useState<InstanceAutomationSelfTest | null>(null);

  const [replyInbound, setReplyInbound] = useState('');
  const [replyContext, setReplyContext] = useState('');
  const [replyInstruction, setReplyInstruction] = useState('');
  const [replyPlan, setReplyPlan] = useState<AutomationReplyPlan | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleTriggers, setRuleTriggers] = useState('');
  const [ruleApprove, setRuleApprove] = useState(false);

  const [massTitle, setMassTitle] = useState('');
  const [massRecipients, setMassRecipients] = useState('');
  const [massMessage, setMassMessage] = useState('');
  const [massDelay, setMassDelay] = useState('10');
  const [massAutoOpen, setMassAutoOpen] = useState(true);
  const [massSearchShortcut, setMassSearchShortcut] = useState('ctrl+f');
  const [massSearchDelay, setMassSearchDelay] = useState('2');
  const [massPostOpenDelay, setMassPostOpenDelay] = useState('1');
  const [massAudienceQuery, setMassAudienceQuery] = useState('');
  const [massAudienceTag, setMassAudienceTag] = useState('');
  const [massAudienceType, setMassAudienceType] = useState<AutomationAudienceMassJobTypeFilter>('all');
  const [massAudienceLimit, setMassAudienceLimit] = useState('500');

  const [momentTopic, setMomentTopic] = useState('');
  const [momentAudience, setMomentAudience] = useState('');
  const [momentTone, setMomentTone] = useState('自然、克制、有个人感');
  const [momentTitle, setMomentTitle] = useState('');
  const [momentText, setMomentText] = useState('');
  const [momentImageNotes, setMomentImageNotes] = useState('');
  const [momentMaterials, setMomentMaterials] = useState('');

  const [knowledgeSource, setKnowledgeSource] = useState('wecom-mac');
  const [knowledgeCategory, setKnowledgeCategory] = useState<AutomationKnowledgeCategory>('faq');
  const [knowledgeApproveImported, setKnowledgeApproveImported] = useState(false);
  const [knowledgeImportText, setKnowledgeImportText] = useState('');
  const [audienceSource, setAudienceSource] = useState('wecom-mac');
  const [audienceType, setAudienceType] = useState<AutomationAudienceContactType>('unknown');
  const [audienceApproveImported, setAudienceApproveImported] = useState(false);
  const [audienceImportText, setAudienceImportText] = useState('');
  const [materialSource, setMaterialSource] = useState('wecom-mac');
  const [materialKind, setMaterialKind] = useState<AutomationMaterialKind>('image');
  const [materialApproveImported, setMaterialApproveImported] = useState(false);
  const [materialImportText, setMaterialImportText] = useState('');
  const [bundleImportText, setBundleImportText] = useState('');
  const [bundleMode, setBundleMode] = useState<AutomationBundleMode>('upsert');
  const [bundleIncludeConfig, setBundleIncludeConfig] = useState(true);
  const [bundleKeepOperationalState, setBundleKeepOperationalState] = useState(false);
  const [bundlePreview, setBundlePreview] = useState<AutomationBundleImportResult | null>(null);

  const runningInstances = instances.filter((inst) => inst.runtime === 'running');
  const selectedInstance = instances.find((inst) => inst.id === selectedInstanceId);

  const loadAutomation = async () => {
    setErr('');
    try {
      const [
        { config },
        { overview },
        { report },
        { queue },
        { contacts },
        { assets },
        { jobs },
        { drafts },
        { events },
        { events: bridgeEvents },
        { reports },
        { policy },
      ] = await Promise.all([
        api.getAutomationConfig(),
        api.getAutomationOverview(),
        api.getAutomationPreflight(),
        api.getAutomationActionQueue(12),
        api.listAutomationAudience(200),
        api.listAutomationMaterials(200),
        api.listMassSendJobs(),
        api.listMomentDrafts(),
        api.automationAudit(30),
        api.listWecomBridgeEvents(20),
        api.listWecomBridgeRunReports(20),
        api.getWecomBridgeRunnerPolicy(),
      ]);
      api.getAutomationBridge().then(({ bridge }) => setBridge(bridge)).catch(() => setBridge(null));
      setConfig(config);
      setOverview(overview);
      setPreflight(report);
      setActionQueue(queue);
      setAudienceContacts(contacts);
      setMaterialAssets(assets);
      setJobs(jobs);
      setDrafts(drafts);
      setAudit(events);
      setBridgeEvents(bridgeEvents.filter((event) => event.status !== 'archived'));
      setBridgeRuns(reports);
      setRunnerPolicy(policy);
      setBridgeReplyDrafts(
        Object.fromEntries(bridgeEvents.filter((event) => event.status !== 'archived').map((event) => [event.id, event.replyDraft || ''])),
      );
    } catch (e: any) {
      setErr(e.message || '读取自动化配置失败');
    }
  };

  useEffect(() => {
    loadAutomation();
  }, []);

  useEffect(() => {
    if (!selectedInstanceId && runningInstances[0]) setSelectedInstanceId(runningInstances[0].id);
  }, [instances, selectedInstanceId]);

  const cfg = config ?? defaultAutomationConfig();
  const knowledgeItems = cfg.knowledgeItems ?? [];
  const approvedKnowledgeCount = knowledgeItems.filter((item) => item.enabled && item.approved).length;
  const bridgeGuide = bridge?.runnerGuide;
  const bridgeWorkerOptions = Array.from(new Map((bridge?.workers || []).map((worker) => [worker.workerId, worker])).values());
  const actionQueueRpa = actionQueue ? actionQueueRpaTarget(actionQueue) : null;
  const copyBridgeText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label}已复制`, 'ok');
    } catch {
      toast('复制失败，请手动复制代码块', 'error');
    }
  };
  const setSetting = (patch: Partial<AutomationConfig['settings']>) =>
    setConfig((current) => {
      const base = current ?? defaultAutomationConfig();
      return { ...base, settings: { ...base.settings, ...patch } };
    });

  const saveConfig = async () => {
    if (!config) return;
    setBusy('config');
    try {
      const { config: saved } = await api.updateAutomationConfig(config);
      setConfig(saved);
      toast('自动化配置已保存', 'ok');
    } catch (e: any) {
      toast(e.message || '保存失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const saveRunnerPolicy = async () => {
    if (!runnerPolicy) return;
    setBusy('runner-policy');
    try {
      const { policy } = await api.updateWecomBridgeRunnerPolicy(runnerPolicy);
      setRunnerPolicy(policy);
      toast('Mac Runner 策略已保存', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '保存 Runner 策略失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const bridgeRecoveryLimit = () => {
    const parsed = Number.parseInt(recoveryLimit, 10);
    if (!Number.isFinite(parsed)) return 500;
    return Math.max(1, Math.min(2000, parsed));
  };
  const bridgeRecoveryMinFailedAge = () => {
    const parsed = Number.parseInt(recoveryMinFailedAge, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(7 * 24 * 60 * 60, parsed));
  };
  const bridgeRecoveryMaxRetryAttempts = () => {
    const parsed = Number.parseInt(recoveryMaxRetryAttempts, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, parsed));
  };
  const wecomRpaPackageLimit = () => {
    const parsed = Number.parseInt(rpaPackageLimit, 10);
    if (!Number.isFinite(parsed)) return 50;
    return Math.max(1, Math.min(200, parsed));
  };
  const wecomRpaPackageQuery = (format: WecomRpaPackageFormat, download = false) => {
    const params = new URLSearchParams({
      target: rpaPackageTarget,
      limit: String(wecomRpaPackageLimit()),
      format,
      includeSource: rpaPackageIncludeSource ? '1' : '0',
    });
    if (download) params.set('download', '1');
    return params.toString();
  };
  const previewWecomRpaPackage = async (targetOverride?: WecomRpaPackageTarget, limitOverride?: number) => {
    const target = targetOverride || rpaPackageTarget;
    const limit = limitOverride ?? wecomRpaPackageLimit();
    setBusy('rpa-package');
    try {
      const { package: pkg } = await api.exportWecomRpaPackage({
        target,
        limit,
        format: 'json',
        includeSource: rpaPackageIncludeSource,
      });
      setRpaPackagePreview(pkg);
      toast(`RPA 包已生成：${pkg.counts.total} 个任务`, 'ok');
    } catch (e: any) {
      toast(e.message || '生成 RPA 包失败', 'error');
    } finally {
      setBusy('');
    }
  };
  const previewActionQueueRpaPackage = async () => {
    if (!actionQueueRpa || actionQueueRpa.total <= 0) {
      toast('当前队列没有可交给 RPA 包的任务', 'error');
      return;
    }
    setRpaPackageTarget(actionQueueRpa.target);
    setRpaPackageLimit(String(actionQueueRpa.limit));
    await previewWecomRpaPackage(actionQueueRpa.target, actionQueueRpa.limit);
  };
  const downloadWecomRpaPackage = (format: WecomRpaPackageFormat) => {
    window.open(`/api/admin/automation/rpa-package?${wecomRpaPackageQuery(format, true)}`, '_blank', 'noopener,noreferrer');
  };

  const bridgeRecoveryPayload = (dryRun: boolean, cursorOverride?: string) => {
    const cursor = (cursorOverride ?? recoveryCursor).trim();
    return {
      dryRun,
      releaseClaims: recoveryReleaseClaims,
      retryFailed: recoveryRetryFailed,
      includeReplies: recoveryIncludeReplies,
      includeMass: recoveryIncludeMass,
      includeMoments: recoveryIncludeMoments,
      workerId: recoveryWorkerId.trim() || undefined,
      failureReason: recoveryFailureReason.trim() || undefined,
      minFailedAgeSeconds: bridgeRecoveryMinFailedAge(),
      maxRetryAttempts: bridgeRecoveryMaxRetryAttempts(),
      cursor: cursor || undefined,
      limit: bridgeRecoveryLimit(),
    };
  };

  const previewBridgeRecovery = async (cursorOverride?: string) => {
    setBusy('bridge-recovery-preview');
    try {
      if (cursorOverride !== undefined) setRecoveryCursor(cursorOverride);
      const { result } = await api.recoverAutomationBridgeOutbox(bridgeRecoveryPayload(true, cursorOverride));
      setRecoveryPreview(result);
      const count = bridgeRecoveryCount(result);
      toast(`恢复预览：${count.total} 项，释放 ${count.released}，重试 ${count.retried}`, 'ok');
    } catch (e: any) {
      toast(e.message || '预览 Bridge 出箱恢复失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const recoverBridgeOutbox = async () => {
    const releaseText = BRIDGE_RECOVERY_RELEASE_LABEL[recoveryReleaseClaims];
    const scopes = [
      recoveryIncludeReplies ? 'AI 回复' : '',
      recoveryIncludeMass ? '群发' : '',
      recoveryIncludeMoments ? '朋友圈' : '',
    ].filter(Boolean);
    const workerText = recoveryWorkerId.trim() || '全部 worker';
    const reasonText = recoveryFailureReason.trim() || '全部失败原因';
    const cooldownText = bridgeRecoveryMinFailedAge() > 0 ? `失败冷却 ${bridgeRecoveryMinFailedAge()} 秒` : '不设失败冷却';
    const retryLimitText = bridgeRecoveryMaxRetryAttempts() > 0 ? `最多重试 ${bridgeRecoveryMaxRetryAttempts()} 次` : '不限制重试次数';
    const cursorText = recoveryCursor.trim() ? '从游标继续' : '从头扫描';
    const ok = await confirm({
      title: '恢复 Bridge 出箱？',
      body: `范围：${scopes.join('、') || '未选择'}；Worker：${workerText}；领取：${releaseText}；失败项：${recoveryRetryFailed ? `重试，${reasonText}，${cooldownText}，${retryLimitText}` : '不处理'}；${cursorText}；每批 ${bridgeRecoveryLimit()}。不会直接发送内容。`,
      confirmText: '恢复',
    });
    if (!ok) return;
    setBusy('bridge-recovery');
    try {
      const { result } = await api.recoverAutomationBridgeOutbox(bridgeRecoveryPayload(false));
      setRecoveryPreview(result);
      const count = bridgeRecoveryCount(result);
      toast(`Bridge 出箱已恢复：释放 ${count.released}，重试 ${count.retried}`, 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '恢复 Bridge 出箱失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const importKnowledge = async () => {
    const rawText = knowledgeImportText.trim();
    if (!rawText) return toast('请先粘贴要导入的资料', 'error');
    setBusy('knowledge-import');
    try {
      const { result } = await api.importAutomationKnowledge({
        source: knowledgeSource.trim() || 'wecom-mac',
        category: knowledgeCategory,
        approveImported: knowledgeApproveImported,
        enabled: true,
        mode: 'upsert',
        rawText,
      });
      setKnowledgeImportText('');
      toast(`接入资料已导入：新增 ${result.imported}，更新 ${result.updated}`, 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '导入失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const patchKnowledge = async (item: AutomationKnowledgeItem, payload: Partial<AutomationKnowledgeItem>) => {
    setBusy(`knowledge-${item.id}`);
    try {
      const { item: saved } = await api.patchAutomationKnowledge(item.id, payload);
      setConfig((current) => {
        const base = current ?? defaultAutomationConfig();
        return { ...base, knowledgeItems: (base.knowledgeItems ?? []).map((x) => (x.id === saved.id ? saved : x)) };
      });
      toast('接入资料已更新', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '更新失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const removeKnowledge = async (item: AutomationKnowledgeItem) => {
    const ok = await confirm({
      title: `删除接入资料「${item.title}」？`,
      body: '删除后不会影响已创建的群发队列、朋友圈草稿和关键词规则。',
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    setBusy(`knowledge-${item.id}`);
    try {
      await api.deleteAutomationKnowledge(item.id);
      setConfig((current) => {
        const base = current ?? defaultAutomationConfig();
        return { ...base, knowledgeItems: (base.knowledgeItems ?? []).filter((x) => x.id !== item.id) };
      });
      toast('接入资料已删除', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '删除失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const useKnowledgeAsReplyContext = (item: AutomationKnowledgeItem) => {
    const chunk = [`[${item.title}]`, item.content, item.targetNames.length ? `目标：${item.targetNames.join('、')}` : ''].filter(Boolean).join('\n');
    setReplyContext((current) => [current.trim(), chunk].filter(Boolean).join('\n\n').slice(0, 4000));
    toast('已加入 AI 回复上下文', 'ok');
  };

  const useKnowledgeTargetsForMass = (item: AutomationKnowledgeItem) => {
    if (item.targetNames.length === 0) return toast('这条资料没有目标名单', 'error');
    setMassRecipients((current) => linesOf([current, item.targetNames.join('\n')].filter(Boolean).join('\n')).join('\n'));
    toast('已填入群发目标', 'ok');
  };

  const importAudience = async () => {
    const rawText = audienceImportText.trim();
    if (!rawText) return toast('请先粘贴联系人或群聊名单', 'error');
    setBusy('audience-import');
    try {
      const { result } = await api.importAutomationAudience({
        source: audienceSource.trim() || 'wecom-mac',
        type: audienceType,
        approveImported: audienceApproveImported,
        enabled: true,
        mode: 'upsert',
        rawText,
      });
      setAudienceImportText('');
      toast(`受众已导入：新增 ${result.imported}，更新 ${result.updated}`, 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '导入受众失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const patchAudience = async (contact: AutomationAudienceContact, payload: Partial<AutomationAudienceContact>) => {
    setBusy(`audience-${contact.id}`);
    try {
      const { contact: saved } = await api.patchAutomationAudience(contact.id, payload);
      setAudienceContacts((list) => list.map((item) => (item.id === saved.id ? saved : item)));
      toast('受众已更新', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '更新受众失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const removeAudience = async (contact: AutomationAudienceContact) => {
    const ok = await confirm({
      title: `删除受众「${contact.name}」？`,
      body: '删除后不会影响已经创建的群发队列，只会从受众资产池移除。',
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    setBusy(`audience-${contact.id}`);
    try {
      await api.deleteAutomationAudience(contact.id);
      setAudienceContacts((list) => list.filter((item) => item.id !== contact.id));
      toast('受众已删除', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '删除受众失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const useAudienceForMass = (contacts: AutomationAudienceContact[]) => {
    const names = contacts.map((contact) => contact.name).filter(Boolean);
    if (names.length === 0) return toast('没有可填入的受众', 'error');
    setMassRecipients((current) => linesOf([current, names.join('\n')].filter(Boolean).join('\n')).join('\n'));
    toast(`已填入 ${names.length} 个群发目标`, 'ok');
  };

  const importMaterials = async () => {
    const rawText = materialImportText.trim();
    if (!rawText) return toast('请先粘贴素材台账', 'error');
    setBusy('material-import');
    try {
      const { result } = await api.importAutomationMaterials({
        source: materialSource.trim() || 'wecom-mac',
        kind: materialKind,
        approveImported: materialApproveImported,
        enabled: true,
        mode: 'upsert',
        rawText,
      });
      setMaterialImportText('');
      toast(`素材已导入：新增 ${result.imported}，更新 ${result.updated}`, 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '导入素材失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const patchMaterial = async (asset: AutomationMaterialAsset, payload: Partial<AutomationMaterialAsset>) => {
    setBusy(`material-${asset.id}`);
    try {
      const { asset: saved } = await api.patchAutomationMaterial(asset.id, payload);
      setMaterialAssets((list) => list.map((item) => (item.id === saved.id ? saved : item)));
      toast('素材已更新', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '更新素材失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const removeMaterial = async (asset: AutomationMaterialAsset) => {
    const ok = await confirm({
      title: `删除素材「${asset.key}」？`,
      body: '删除的是云端素材台账记录，不会删除 Mac 本机文件，也不会影响已经下发的任务。',
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    setBusy(`material-${asset.id}`);
    try {
      await api.deleteAutomationMaterial(asset.id);
      setMaterialAssets((list) => list.filter((item) => item.id !== asset.id));
      toast('素材已删除', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '删除素材失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const copyMaterialReplyToken = (asset: AutomationMaterialAsset) => {
    copyBridgeText(`[image-key ${asset.key}]`, '回复素材片段');
  };

  const useMaterialForMoment = (asset: AutomationMaterialAsset) => {
    setMomentMaterials((current) => linesOf([current, asset.key].filter(Boolean).join('\n')).join('\n'));
    toast('已填入朋友圈素材', 'ok');
  };

  const downloadAutomationBundle = async () => {
    setBusy('bundle-export');
    try {
      const { bundle } = await api.exportAutomationBundle();
      const text = JSON.stringify(bundle, null, 2);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `woc-automation-bundle-${compactDateForFile()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('自动化资产包已导出', 'ok');
    } catch (e: any) {
      toast(e.message || '导出资产包失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const parseBundleImportText = () => {
    try {
      return JSON.parse(bundleImportText);
    } catch {
      toast('资产包 JSON 格式不正确', 'error');
      return null;
    }
  };

  const previewAutomationBundleImport = async () => {
    const bundle = parseBundleImportText();
    if (!bundle) return;
    setBusy('bundle-preview');
    try {
      const { result } = await api.importAutomationBundle({
        bundle,
        dryRun: true,
        mode: bundleMode,
        includeConfig: bundleIncludeConfig,
        keepOperationalState: bundleKeepOperationalState,
      });
      setBundlePreview(result);
      toast(`资产包预览完成：${bundleCount(result)}`, result.errors.length ? 'error' : 'ok');
    } catch (e: any) {
      toast(e.message || '预览资产包失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const applyAutomationBundleImport = async () => {
    const bundle = parseBundleImportText();
    if (!bundle) return;
    const ok = await confirm({
      title: '导入自动化资产包？',
      body: bundleKeepOperationalState ? '将保留队列和草稿的审核/领取状态。请确认当前 Mac Runner 不会误处理。' : '队列和朋友圈草稿会以未审核草稿导入，不会被 Mac Runner 立即执行。',
      confirmText: '确认导入',
    });
    if (!ok) return;
    setBusy('bundle-import');
    try {
      const { result } = await api.importAutomationBundle({
        bundle,
        dryRun: false,
        mode: bundleMode,
        includeConfig: bundleIncludeConfig,
        keepOperationalState: bundleKeepOperationalState,
      });
      setBundlePreview(result);
      setBundleImportText('');
      toast(`资产包已导入：${bundleCount(result)}`, result.errors.length ? 'error' : 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '导入资产包失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const useBridgeEventForReply = async (event: WecomBridgeEvent) => {
    setBusy(`bridge-event-${event.id}`);
    try {
      const { result } = await api.planWecomBridgeEventReply(event.id, { overwrite: true });
      const saved = result.event;
      setBridgeEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      setBridgeReplyDrafts((map) => ({ ...map, [saved.id]: saved.replyDraft || '' }));
      setReplyInbound(saved.inboundText);
      setReplyContext(
        [
          saved.conversationName ? `会话：${saved.conversationName}` : '',
          saved.senderName ? `发送人：${saved.senderName}` : '',
          saved.receivedAt ? `时间：${fmtDate(Date.parse(saved.receivedAt))}` : '',
          saved.conversationContext,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 4000),
      );
      setReplyInstruction('基于企微 Bridge 收件箱消息生成一条克制、可人工确认后发送的回复。');
      toast(result.approved ? '已生成并批准规则回复，Mac 端可拉取' : result.planned ? '已生成待审回复草稿' : result.skippedReason || '没有生成回复草稿', result.planned ? 'ok' : 'error');
    } catch (e: any) {
      toast(e.message || '生成回复失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const archiveBridgeEvent = async (event: WecomBridgeEvent) => {
    setBusy(`bridge-event-${event.id}`);
    try {
      const { event: saved } = await api.patchWecomBridgeEvent(event.id, { status: 'archived' });
      setBridgeEvents((list) => list.filter((x) => x.id !== saved.id));
      toast('企微消息已归档', 'ok');
    } catch (e: any) {
      toast(e.message || '归档失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const saveBridgeReplyDraft = async (event: WecomBridgeEvent, approve = false, asSequence = false) => {
    const draft = (bridgeReplyDrafts[event.id] || '').trim();
    if (!draft) return toast('请先填写回复草稿', 'error');
    const replySteps = asSequence ? replyStepsFromDraft(draft) : undefined;
    if (asSequence && !replySteps?.some((step) => step.type === 'text' || step.type === 'image')) return toast('顺序回复至少需要一段文本或一张图片', 'error');
    setBusy(`bridge-reply-${event.id}`);
    try {
      const { event: saved } = await api.patchWecomBridgeEvent(event.id, {
        status: 'planned',
        replyDraft: draft,
        ...(replySteps ? { replySteps } : {}),
        replyApproved: approve ? true : event.replyApproved,
      });
      setBridgeEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      setBridgeReplyDrafts((map) => ({ ...map, [saved.id]: saved.replyDraft || '' }));
      toast(approve ? (asSequence ? '顺序回复已批准，Mac 端可拉取' : '回复草稿已批准，Mac 端可拉取') : asSequence ? '顺序回复已保存' : '回复草稿已保存', 'ok');
    } catch (e: any) {
      toast(e.message || '保存回复草稿失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const toggleBridgeReplyApproval = async (event: WecomBridgeEvent, approved: boolean) => {
    setBusy(`bridge-reply-${event.id}`);
    try {
      const { event: saved } = await api.patchWecomBridgeEvent(event.id, { replyApproved: approved });
      setBridgeEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast(approved ? '回复草稿已批准' : '已取消回复批准', 'ok');
    } catch (e: any) {
      toast(e.message || '更新批准状态失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const releaseBridgeReplyClaim = async (event: WecomBridgeEvent) => {
    setBusy(`bridge-reply-${event.id}`);
    try {
      const { event: saved } = await api.patchWecomBridgeEvent(event.id, {
        deliveryStatus: 'released',
        reason: 'Web 管理员释放 Mac 领取状态',
      });
      setBridgeEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast('已释放领取，Mac 端可重新拉取', 'ok');
    } catch (e: any) {
      toast(e.message || '释放领取失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const runSelfTest = async () => {
    if (!selectedInstance) return toast('请先选择一个运行中的实例', 'error');
    setBusy('self-test');
    setSelfTest(null);
    try {
      const { result } = await api.automationSelfTest(selectedInstance.id);
      setSelfTest(result);
      toast(result.ok ? '实例自动化自检通过' : '实例自动化自检未通过', result.ok ? 'ok' : 'error');
    } catch (e: any) {
      toast(e.message || '自检失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const buildReplyPlan = async () => {
    setBusy('reply-plan');
    setReplyPlan(null);
    try {
      const { plan } = await api.automationReplyPlan({
        inboundText: replyInbound,
        conversationContext: replyContext,
        extraInstruction: replyInstruction,
      });
      setReplyPlan(plan);
      toast(plan.mode === 'blocked' ? '回复已被风险拦截' : '已生成回复计划', plan.mode === 'blocked' ? 'error' : 'ok');
    } catch (e: any) {
      toast(e.message || '生成失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const readInboundFromClipboard = async (copySelection: boolean) => {
    if (!selectedInstance) return toast('请先选择一个运行中的实例', 'error');
    setBusy(copySelection ? 'reply-copy-selection' : 'reply-read-clipboard');
    try {
      const { text } = await api.automationReadClipboard(selectedInstance.id, { copySelection });
      const clipped = text.trim().slice(0, 2000);
      if (!clipped) return toast(copySelection ? '没有读到选中文本' : '实例剪贴板为空', 'error');
      setReplyInbound(clipped);
      toast('已读取到客户消息', 'ok');
    } catch (e: any) {
      toast(e.message || '读取失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const sendReplyPlan = async () => {
    if (!replyPlan || !selectedInstance) return;
    const ok = await confirm({
      title: '发送到当前微信会话？',
      body: `请确认「${selectedInstance.name}」里已经打开正确的聊天窗口。发送后会立刻回车发出。`,
      confirmText: '确认发送',
    });
    if (!ok) return;
    setBusy('reply-send');
    try {
      if (replyPlan.ruleId && replyPlan.canSendRule) {
        await api.automationSendRule(selectedInstance.id, { ruleId: replyPlan.ruleId, inboundText: replyInbound, confirm: true });
      } else {
        await api.automationSendText(selectedInstance.id, { text: replyPlan.draft, inboundText: replyInbound, confirm: true });
      }
      toast('已发送回复', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '发送失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const saveReplyAsRule = async () => {
    if (!replyPlan?.draft) return toast('没有可沉淀的话术', 'error');
    const triggers = linesOf(ruleTriggers || replyInbound);
    if (triggers.length === 0) return toast('请填写至少一个触发词', 'error');
    const now = new Date().toISOString();
    const id = crypto.randomUUID?.() || `rule-${Date.now()}`;
    const next: AutomationConfig = {
      ...cfg,
      rules: [
        ...cfg.rules,
        {
          id,
          name: ruleName.trim() || `回复规则 ${triggers[0].slice(0, 16)}`,
          enabled: true,
          approved: ruleApprove,
          priority: 100,
          triggers,
          responseSteps: [{ type: 'text', text: replyPlan.draft, sendEnter: true }],
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    setBusy('rule-save');
    try {
      const { config: saved } = await api.updateAutomationConfig(next);
      setConfig(saved);
      setRuleName('');
      setRuleTriggers('');
      setRuleApprove(false);
      toast(ruleApprove ? '已保存为已审核关键词规则' : '已保存为待审核关键词规则', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '保存规则失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const createMassJob = async () => {
    const recipients = linesOf(massRecipients);
    setBusy('mass-create');
    try {
      const { job } = await api.createMassSendJob({
        title: massTitle.trim() || `群发队列 ${new Date().toLocaleString()}`,
        message: massMessage,
        recipients,
        options: {
          perSendDelaySeconds: Number(massDelay) || 0,
          requireOperatorConfirmRecipient: true,
          openConversationBeforeSend: massAutoOpen,
          searchShortcut: massSearchShortcut,
          searchResultDelaySeconds: Number(massSearchDelay) || 2,
          postOpenDelaySeconds: Number(massPostOpenDelay) || 1,
        },
      });
      setJobs((list) => [job, ...list]);
      setMassTitle('');
      setMassRecipients('');
      setMassMessage('');
      toast('群发队列已创建，审核后可逐条发送', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '创建失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const createMassJobFromAudience = async () => {
    setBusy('mass-audience-create');
    try {
      const { job, selection } = await api.createMassSendJobFromAudience({
        title: massTitle.trim() || `受众群发 ${new Date().toLocaleString()}`,
        message: massMessage,
        audienceFilter: {
          query: massAudienceQuery.trim(),
          tag: massAudienceTag.trim(),
          type: massAudienceType,
          requireApproved: true,
          requireEnabled: true,
          limit: Number(massAudienceLimit) || 500,
        },
        options: {
          perSendDelaySeconds: Number(massDelay) || 0,
          requireOperatorConfirmRecipient: true,
          openConversationBeforeSend: massAutoOpen,
          searchShortcut: massSearchShortcut,
          searchResultDelaySeconds: Number(massSearchDelay) || 2,
          postOpenDelaySeconds: Number(massPostOpenDelay) || 1,
        },
      });
      setJobs((list) => [job, ...list]);
      setMassTitle('');
      setMassMessage('');
      toast(`已从受众创建 ${selection.selected} 个目标的群发队列`, 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '从受众创建失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const patchJob = async (job: MassSendJob, payload: Parameters<typeof api.patchMassSendJob>[1]) => {
    setBusy(`job-${job.id}`);
    try {
      const { job: saved } = await api.patchMassSendJob(job.id, payload);
      setJobs((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast('队列已更新', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '更新失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const patchJobItem = async (job: MassSendJob, itemId: string, status: 'pending' | 'failed' | 'skipped', reason?: string) => {
    setBusy(`item-${itemId}`);
    try {
      const { job: saved } = await api.patchMassSendItem(job.id, itemId, { status, reason });
      setJobs((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast('目标状态已更新', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '更新失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const sendNextJobItem = async (job: MassSendJob) => {
    if (!selectedInstance) return toast('请先选择一个运行中的实例', 'error');
    const target = nextMassTarget(job);
    if (!target) return toast('没有待发送目标', 'error');
    const autoOpen = job.options.openConversationBeforeSend;
    const ok = await confirm({
      title: autoOpen ? `自动搜索并发送给「${target}」？` : `发送给「${target}」？`,
      body: autoOpen
        ? `请确认「${selectedInstance.name}」的微信窗口可见且已登录。面板会使用 ${job.options.searchShortcut} 搜索目标、回车打开会话，然后粘贴内容并发送。`
        : `请先在「${selectedInstance.name}」的微信窗口手动打开这个联系人或群聊。确认后面板只负责粘贴群发内容并回车。`,
      confirmText: autoOpen ? '搜索并发送' : '已打开，发送',
    });
    if (!ok) return;
    setBusy(`send-${job.id}`);
    try {
      const { job: saved } = await api.automationSendNextMassItem(selectedInstance.id, job.id, {
        confirm: true,
        operatorConfirmedRecipient: true,
        openConversationBeforeSend: autoOpen,
      });
      setJobs((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast('已发送当前队列目标', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '发送失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const draftMomentByAI = async () => {
    setBusy('moment-ai');
    try {
      const { draft } = await api.automationMomentAiDraft({
        topic: momentTopic,
        audience: momentAudience,
        tone: momentTone,
      });
      setMomentText(draft);
      if (!momentTitle.trim()) setMomentTitle(momentTopic.slice(0, 28) || 'AI 朋友圈草稿');
      toast('已生成朋友圈草稿', 'ok');
    } catch (e: any) {
      toast(e.message || '生成失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const createMoment = async () => {
    setBusy('moment-create');
    try {
      const { draft } = await api.createMomentDraft({
        title: momentTitle.trim() || `朋友圈草稿 ${new Date().toLocaleString()}`,
        text: momentText,
        imageNotes: momentImageNotes,
        materials: linesOf(momentMaterials),
      });
      setDrafts((list) => [draft, ...list]);
      setMomentTitle('');
      setMomentText('');
      setMomentImageNotes('');
      setMomentMaterials('');
      toast('朋友圈草稿已创建，审核后可填入发布框', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '创建失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const patchDraft = async (draft: MomentDraft, payload: Parameters<typeof api.patchMomentDraft>[1]) => {
    setBusy(`draft-${draft.id}`);
    try {
      const { draft: saved } = await api.patchMomentDraft(draft.id, payload);
      setDrafts((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast('朋友圈草稿已更新', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '更新失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const prepareDraft = async (draft: MomentDraft, mode: 'fill-current-input' | 'copy-to-clipboard') => {
    if (!selectedInstance) return toast('请先选择一个运行中的实例', 'error');
    const ok = await confirm({
      title: mode === 'copy-to-clipboard' ? `复制朋友圈草稿「${draft.title}」？` : `填入朋友圈草稿「${draft.title}」？`,
      body:
        mode === 'copy-to-clipboard'
          ? `文案会写入「${selectedInstance.name}」实例剪贴板，不会粘贴到任何窗口。你之后可以在朋友圈发布框里手动 Ctrl+V。`
          : `请先在「${selectedInstance.name}」里打开朋友圈发布框并把光标放到正文输入区域。此操作只填入文案，不会点击发布。`,
      confirmText: mode === 'copy-to-clipboard' ? '复制到剪贴板' : '填入文案',
    });
    if (!ok) return;
    setBusy(`prepare-${draft.id}`);
    try {
      const { draft: saved } = await api.automationPrepareMomentDraft(selectedInstance.id, draft.id, { confirm: true, mode });
      setDrafts((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast(mode === 'copy-to-clipboard' ? '已复制到实例剪贴板' : '已填入朋友圈发布框，请人工检查后发布', 'ok');
      await loadAutomation();
    } catch (e: any) {
      toast(e.message || '填入失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const sendableReply = !!replyPlan && (replyPlan.canSendRule || replyPlan.canSendText) && !!replyPlan.draft && !!selectedInstance;

  return (
    <>
      <div className="section-row" style={{ marginTop: 22 }}>
        <span className="section-title">自动化工作台</span>
        <button className="btn-text" onClick={loadAutomation}>
          刷新
        </button>
      </div>
      <div className="settings-block auto-workbench">
        {err && <div className="error">{err}</div>}
        <div className="auto-toolbar">
          <label className="auto-field compact">
            <span className="field-label">执行实例</span>
            <select className="input" value={selectedInstanceId} onChange={(e) => setSelectedInstanceId(e.target.value)}>
              <option value="">选择运行中的实例</option>
              {runningInstances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </label>
          <div className="auto-switches">
            {[
              ['enabled', '总开关'],
              ['aiDraftEnabled', 'AI 草稿'],
              ['automaticRuleRepliesEnabled', '规则回复'],
              ['massSendEnabled', '群发队列'],
              ['momentsEnabled', '朋友圈草稿'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={'chip chip-toggle' + ((cfg.settings as any)[key] ? ' on' : '')}
                onClick={() => setSetting({ [key]: !(cfg.settings as any)[key] } as any)}
              >
                {label}
              </button>
            ))}
            <button className="chip chip-toggle" disabled={!selectedInstance || busy === 'self-test'} onClick={runSelfTest}>
              实例自检
            </button>
          </div>
        </div>
        {overview && (
          <div className="auto-overview-grid">
            <div className="auto-overview-card">
              <div className="auto-overview-head">
                <b>自动化</b>
                <span className={'tag ' + (overview.settings.enabled ? 'tag-on' : 'tag-off')}>{overview.settings.enabled ? '已开启' : '已关闭'}</span>
              </div>
              <div className="auto-overview-metric">{overview.knowledge.approved}/{overview.knowledge.total}</div>
              <div className="muted small">
                已审核资料 · 素材 {overview.materials.approved}/{overview.materials.total} · 受众 {overview.audience.approved}/{overview.audience.total} · 规则{' '}
                {overview.rules.approved}/{overview.rules.total}
              </div>
            </div>
            <div className="auto-overview-card">
              <div className="auto-overview-head">
                <b>AI 回复</b>
                <span className="tag">{overview.bridge.events.active} 条</span>
              </div>
              <div className="auto-overview-metric">{overview.bridge.pendingReplies}</div>
              <div className="muted small">
                待 Mac 拉取 · 新消息 {overview.bridge.events.new} · 已领取 {overview.bridge.events.claimed}
              </div>
            </div>
            <div className="auto-overview-card">
              <div className="auto-overview-head">
                <b>群发队列</b>
                <span className="tag">{overview.mass.approvedRunnableJobs} 队列</span>
              </div>
              <div className="auto-overview-metric">{overview.mass.itemsPending}</div>
              <div className="muted small">
                待发送目标 · 已发 {overview.mass.itemsSent} · 失败 {overview.mass.itemsFailed}
              </div>
            </div>
            <div className="auto-overview-card">
              <div className="auto-overview-head">
                <b>朋友圈</b>
                <span className="tag">{overview.moments.draftsTotal} 草稿</span>
              </div>
              <div className="auto-overview-metric">{overview.bridge.pendingMomentTasks}</div>
              <div className="muted small">
                待准备 · 已准备 {overview.moments.prepared} · 已发布 {overview.moments.published}
              </div>
            </div>
            <div className="auto-overview-card">
              <div className="auto-overview-head">
                <b>Mac Bridge</b>
                <span className={'tag ' + (overview.bridge.workersOnline ? 'tag-on' : 'tag-off')}>
                  {overview.bridge.workersOnline}/{overview.bridge.workersTotal}
                </span>
              </div>
              <div className="auto-overview-metric">
                {overview.bridge.pendingReplies + overview.bridge.pendingMassTasks + overview.bridge.pendingMomentTasks}
              </div>
              <div className="muted small">
                出箱待办 · {overview.bridge.lastWorkerSeenAt ? `最近心跳 ${fmtStaleSeconds((Date.now() - Date.parse(overview.bridge.lastWorkerSeenAt)) / 1000)}` : '暂无心跳'}
              </div>
              <div className="muted small">
                能力 回复 {overview.bridge.capabilities.reply} · 群发 {overview.bridge.capabilities.mass} · 朋友圈 {overview.bridge.capabilities.moment}
                {overview.bridge.capabilities['rpa-package'] ? ` · RPA 包 ${overview.bridge.capabilities['rpa-package']}` : ''}
                {overview.bridge.capabilities.unknown ? ` · 未知 ${overview.bridge.capabilities.unknown}` : ''}
              </div>
            </div>
            {overview.riskFlags.length > 0 && (
              <div className="auto-overview-risk">
                {overview.riskFlags.map((flag) => (
                  <span key={flag} className="chip chip-static chip-bad">
                    {AUTOMATION_RISK_LABEL[flag] || flag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {actionQueue && (
          <div className="auto-action-queue">
            <div className="auto-action-queue-head">
              <div>
                <b>下一步队列</b>
                <div className="muted small">生成于 {fmtDate(Date.parse(actionQueue.generatedAt))}</div>
              </div>
              <div className="auto-preflight-summary">
                <span className="tag tag-off">阻断 {actionQueue.summary.block}</span>
                <span className="tag tag-warn">高优先 {actionQueue.summary.high}</span>
                <span className="tag tag-on">普通 {actionQueue.summary.normal}</span>
              </div>
              <div className="auto-action-queue-tools">
                <span className="muted small">
                  RPA {actionQueueRpa?.total || 0} · 回复 {actionQueueRpa?.replies || 0} · 群发 {actionQueueRpa?.mass || 0} · 朋友圈 {actionQueueRpa?.moments || 0}
                  {actionQueueRpa?.blockedByPreflight ? ' · 预检阻断' : ''}
                </span>
                <button
                  className="btn-text"
                  disabled={busy === 'rpa-package' || !actionQueueRpa?.total}
                  title={actionQueueRpa?.reason || ''}
                  onClick={previewActionQueueRpaPackage}
                >
                  预览 {actionQueueRpa?.label || '全队列'}包
                </button>
              </div>
            </div>
            <div className="auto-action-queue-list">
              {actionQueue.items.slice(0, 8).map((item) => (
                <div key={item.id} className="auto-action-queue-item">
                  <div className="auto-action-main">
                    <div className="auto-action-tags">
                      <span className={'tag ' + actionQueuePriorityClass(item.priority)}>
                        {ACTION_QUEUE_PRIORITY_LABEL[item.priority] || item.priority}
                      </span>
                      <span className="tag">{ACTION_QUEUE_TARGET_LABEL[item.target] || item.target}</span>
                    </div>
                    <div>
                      <b>{item.title}</b>
                      <div className="muted small">{item.detail}</div>
                      <div className="auto-action-next">{item.action}</div>
                      {item.tags.length > 0 && (
                        <div className="chip-row auto-action-tag-row">
                          {item.tags.slice(0, 5).map((tag) => (
                            <span key={tag} className="chip chip-static">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="muted small auto-action-age">{item.staleSeconds !== undefined ? fmtStaleSeconds(item.staleSeconds) : ''}</div>
                </div>
              ))}
              {actionQueue.items.length === 0 && <div className="muted small">暂无待处理动作</div>}
            </div>
          </div>
        )}
        {preflight && (
          <div className={'auto-preflight auto-preflight-' + preflight.level}>
            <div className="auto-preflight-head">
              <div>
                <b>自动化预检</b>
                <div className="muted small">最近检查 {fmtStaleSeconds((Date.now() - Date.parse(preflight.generatedAt)) / 1000)}</div>
              </div>
              <div className="auto-preflight-summary">
                <span className={'tag ' + preflightLevelClass(preflight.level)}>{PREFLIGHT_LEVEL_LABEL[preflight.level]}</span>
                <span className="tag tag-off">阻断 {preflight.summary.block}</span>
                <span className="tag tag-warn">提醒 {preflight.summary.warn}</span>
                <span className="tag tag-on">正常 {preflight.summary.ok}</span>
              </div>
            </div>
            <div className="auto-preflight-list">
              {preflight.checks.map((check) => (
                <div key={check.id} className="auto-preflight-item">
                  <div className="auto-preflight-item-main">
                    <span className={'tag ' + preflightLevelClass(check.level)}>{PREFLIGHT_LEVEL_LABEL[check.level]}</span>
                    <div>
                      <b>{check.title}</b>
                      <div className="muted small">
                        {check.message}
                        {check.action ? ` ${check.action}` : ''}
                      </div>
                    </div>
                  </div>
                  {check.refs && check.refs.length > 0 && (
                    <div className="chip-row auto-preflight-refs">
                      {check.refs.slice(0, 6).map((ref) => (
                        <span key={ref} className={'chip chip-static ' + (check.level === 'block' ? 'chip-bad' : '')}>
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {selfTest && (
          <div className={'auto-self-test ' + (selfTest.ok ? 'ok' : 'bad')}>
            <b>{selfTest.ok ? '自检通过' : '自检未通过'}</b>
            <span className="muted small">DISPLAY {selfTest.display || 'unknown'}</span>
            <div className="chip-row">
              {selfTest.checks.map((check) => (
                <span key={check.name} className={'chip chip-static ' + (check.ok ? '' : 'chip-bad')}>
                  {check.name}: {check.ok ? 'ok' : check.detail || 'fail'}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="auto-grid two">
          <label className="auto-field">
            <span className="field-label">每小时发送上限</span>
            <input
              className="input"
              inputMode="numeric"
              value={cfg.settings.maximumAutomaticSendsPerHour}
              onChange={(e) => setSetting({ maximumAutomaticSendsPerHour: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="auto-field">
            <span className="field-label">单会话冷却分钟</span>
            <input
              className="input"
              inputMode="numeric"
              value={cfg.settings.perConversationCooldownMinutes}
              onChange={(e) => setSetting({ perConversationCooldownMinutes: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
        <label className="auto-check">
          <input type="checkbox" checked={cfg.settings.requireConfirmForSend} onChange={(e) => setSetting({ requireConfirmForSend: e.target.checked })} />
          <span>发送动作必须二次确认</span>
        </label>
        <div className="auto-grid two">
          <label className="auto-field">
            <span className="field-label">账号人设</span>
            <textarea className="input textarea" value={cfg.persona} onChange={(e) => setConfig({ ...cfg, persona: e.target.value })} />
          </label>
          <label className="auto-field">
            <span className="field-label">知识库/禁答边界</span>
            <textarea className="input textarea" value={cfg.knowledgeNotes} onChange={(e) => setConfig({ ...cfg, knowledgeNotes: e.target.value })} />
          </label>
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary s-btn" disabled={busy === 'config'} onClick={saveConfig}>
            保存自动化配置
          </button>
          <span className="muted small">当前实例：{selectedInstance?.name || '未选择'}。生产环境保持不变，新功能仍在本地版本中。</span>
        </div>

        <div className="auto-grid">
          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>企微接入资料</b>
              <span>
                <span className="tag">{knowledgeItems.length} 条</span>
                <span className="tag tag-on">{approvedKnowledgeCount} 可用</span>
              </span>
            </div>
            <div className="auto-grid two compact">
              <label className="auto-field">
                <span className="field-label">来源</span>
                <input className="input" value={knowledgeSource} onChange={(e) => setKnowledgeSource(e.target.value)} />
              </label>
              <label className="auto-field">
                <span className="field-label">分类</span>
                <select className="input" value={knowledgeCategory} onChange={(e) => setKnowledgeCategory(e.target.value as AutomationKnowledgeCategory)}>
                  {(Object.keys(KNOWLEDGE_CATEGORY_LABEL) as AutomationKnowledgeCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {KNOWLEDGE_CATEGORY_LABEL[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              className="input textarea tall"
              placeholder="粘贴企业微信自动化 Mac 版导出的 JSON、Markdown 或话术文本"
              value={knowledgeImportText}
              onChange={(e) => setKnowledgeImportText(e.target.value)}
            />
            <label className="auto-check">
              <input type="checkbox" checked={knowledgeApproveImported} onChange={(e) => setKnowledgeApproveImported(e.target.checked)} />
              <span>导入后标记为已审核</span>
            </label>
            <button className="btn btn-primary s-btn" disabled={busy === 'knowledge-import' || !knowledgeImportText.trim()} onClick={importKnowledge}>
              导入接入资料
            </button>
            {bridge && (
              <div className={'auto-bridge ' + (bridge.enabled ? 'ok' : 'bad')}>
                <b>Mac Bridge {bridge.enabled ? '已启用' : '未启用'}</b>
                <div className="muted small">
                  资料 <code>{location.origin + bridge.knowledgeEndpoint}</code>
                </div>
                <div className="muted small">
                  受众 <code>{location.origin + bridge.audienceEndpoint}</code>
                </div>
                <div className="muted small">
                  素材 <code>{location.origin + bridge.materialEndpoint}</code>
                </div>
                <div className="muted small">
                  素材映射 <code>{location.origin + bridge.materialMapEndpoint}</code>
                </div>
                <div className="muted small">
                  消息 <code>{location.origin + bridge.eventEndpoint}</code>
                </div>
                <div className="muted small">
                  回复 <code>{location.origin + bridge.replyEndpoint}</code>
                </div>
                <div className="muted small">
                  心跳 <code>{location.origin + bridge.heartbeatEndpoint}</code>
                </div>
                <div className="muted small">
                  运行报告 <code>{location.origin + bridge.runReportEndpoint}</code>
                </div>
                <div className="muted small">
                  Runner 策略 <code>{location.origin + bridge.runnerPolicyEndpoint}</code>
                </div>
                <div className="chip-row">
                  <span className={'chip chip-static ' + (bridge.configured ? '' : 'chip-bad')}>{bridge.tokenEnvName}</span>
                  <span className={'chip chip-static ' + (bridge.tokenLengthOk ? '' : 'chip-bad')}>token 长度</span>
                  <span className="chip chip-static">Bearer / X-Automation-Token</span>
                </div>
                {runnerPolicy && (
                  <div className="bridge-runner-guide">
                    <div className="bridge-runner-head">
                      <div>
                        <b>云端 Runner 策略</b>
                        <div className="muted small">
                          {BRIDGE_RUNNER_TARGET_LABEL[runnerPolicy.target]} · {BRIDGE_RUNNER_MODE_LABEL[runnerPolicy.mode]} · 每轮 {runnerPolicy.limit}
                          {' · '}
                          {BRIDGE_RUNNER_ENGINE_LABEL[runnerPolicy.runnerEngine || 'bridge']}
                          {runnerPolicy.requireTargetMatch ? ' · 目标硬校验' : ''}
                          {runnerPolicy.requireHandlerVerification ? ' · 交付校验' : ''}
                        </div>
                      </div>
                      <div className="auto-actions inline">
                        <button className="btn-text" disabled={busy === 'runner-policy'} onClick={saveRunnerPolicy}>
                          保存策略
                        </button>
                      </div>
                    </div>
                    <div className="auto-grid three compact">
                      <label>
                        <span className="field-label">执行引擎</span>
                        <select
                          className="input"
                          value={runnerPolicy.runnerEngine || 'bridge'}
                          onChange={(e) => setRunnerPolicy({ ...runnerPolicy, runnerEngine: e.target.value as WecomBridgeRunnerEngine })}
                        >
                          <option value="bridge">Bridge 队列</option>
                          <option value="rpa-package">RPA 运行包</option>
                        </select>
                      </label>
                      <label>
                        <span className="field-label">模式</span>
                        <select
                          className="input"
                          value={runnerPolicy.mode}
                          onChange={(e) => setRunnerPolicy({ ...runnerPolicy, mode: e.target.value as WecomBridgeRunnerMode })}
                        >
                          <option value="dry-run">只预览</option>
                          <option value="prepare">领取并准备</option>
                          <option value="send">受控发送</option>
                        </select>
                      </label>
                      <label>
                        <span className="field-label">目标</span>
                        <select
                          className="input"
                          value={runnerPolicy.target}
                          onChange={(e) => setRunnerPolicy({ ...runnerPolicy, target: e.target.value as WecomBridgeRunnerTarget })}
                        >
                          <option value="replies">AI 回复</option>
                          <option value="mass">群发</option>
                          <option value="moments">朋友圈</option>
                          <option value="all">全队列</option>
                        </select>
                      </label>
                      <label>
                        <span className="field-label">每轮数量</span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={50}
                          value={runnerPolicy.limit}
                          onChange={(e) => setRunnerPolicy({ ...runnerPolicy, limit: Number(e.target.value) || 1 })}
                        />
                      </label>
                      <label>
                        <span className="field-label">领取 TTL 秒</span>
                        <input
                          className="input"
                          type="number"
                          min={30}
                          max={86400}
                          value={runnerPolicy.claimTtlSeconds}
                          onChange={(e) => setRunnerPolicy({ ...runnerPolicy, claimTtlSeconds: Number(e.target.value) || 300 })}
                        />
                      </label>
                      <label>
                        <span className="field-label">心跳间隔秒</span>
                        <input
                          className="input"
                          type="number"
                          min={15}
                          max={86400}
                          value={runnerPolicy.heartbeatIntervalSeconds}
                          onChange={(e) => setRunnerPolicy({ ...runnerPolicy, heartbeatIntervalSeconds: Number(e.target.value) || 60 })}
                        />
                      </label>
                      <label>
                        <span className="field-label">朋友圈模式</span>
                        <select
                          className="input"
                          value={runnerPolicy.momentPasteMode}
                          onChange={(e) => setRunnerPolicy({ ...runnerPolicy, momentPasteMode: e.target.value as WecomBridgeMomentPasteMode })}
                        >
                          <option value="clipboard-only">复制到剪贴板</option>
                          <option value="current-input">填入当前输入框</option>
                        </select>
                      </label>
                    </div>
                    <label className="auto-check">
                      <input
                        type="checkbox"
                        checked={runnerPolicy.allowSend}
                        onChange={(e) => setRunnerPolicy({ ...runnerPolicy, allowSend: e.target.checked })}
                      />
                      <span>云端策略允许 send 模式，本机仍需显式授权真实发送</span>
                    </label>
                    <label className="auto-check">
                      <input
                        type="checkbox"
                        checked={runnerPolicy.requireTargetMatch}
                        onChange={(e) => setRunnerPolicy({ ...runnerPolicy, requireTargetMatch: e.target.checked })}
                      />
                      <span>回复和群发在粘贴/发送前必须命中目标窗口标题</span>
                    </label>
                    <label className="auto-check">
                      <input
                        type="checkbox"
                        checked={runnerPolicy.requireHandlerVerification}
                        onChange={(e) => setRunnerPolicy({ ...runnerPolicy, requireHandlerVerification: e.target.checked })}
                      />
                      <span>handler 回传目标/视觉校验通过后才标记任务交付成功</span>
                    </label>
                  </div>
                )}
                <div className="bridge-runner-guide">
                  <div className="bridge-runner-head">
                    <div>
                      <b>RPA 运行包</b>
                      <div className="muted small">
                        {rpaPackagePreview
                          ? `${rpaPackagePreview.packageId} · ${rpaPackagePreview.counts.total} 项 · 回复 ${rpaPackagePreview.counts.replies} · 群发 ${rpaPackagePreview.counts.mass} · 朋友圈 ${rpaPackagePreview.counts.moments}`
                          : '未生成'}
                      </div>
                    </div>
                    <div className="auto-actions inline">
                      <button className="btn-text" disabled={busy === 'rpa-package'} onClick={() => previewWecomRpaPackage()}>
                        预览
                      </button>
                      <button className="btn-text" onClick={() => downloadWecomRpaPackage('json')}>
                        JSON
                      </button>
                      <button className="btn-text" onClick={() => downloadWecomRpaPackage('jsonl')}>
                        JSONL
                      </button>
                    </div>
                  </div>
                  <div className="auto-grid three compact">
                    <label>
                      <span className="field-label">目标</span>
                      <select className="input" value={rpaPackageTarget} onChange={(e) => setRpaPackageTarget(e.target.value as WecomRpaPackageTarget)}>
                        <option value="all">全队列</option>
                        <option value="replies">AI 回复</option>
                        <option value="mass">群发</option>
                        <option value="moments">朋友圈</option>
                      </select>
                    </label>
                    <label>
                      <span className="field-label">每类上限</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={200}
                        value={rpaPackageLimit}
                        onChange={(e) => setRpaPackageLimit(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                    </label>
                    <label className="auto-check compact-check">
                      <input type="checkbox" checked={rpaPackageIncludeSource} onChange={(e) => setRpaPackageIncludeSource(e.target.checked)} />
                      <span>包含源任务</span>
                    </label>
                  </div>
                  {rpaPackagePreview && (
                    <div className="chip-row">
                      <span className="chip chip-static">schema {rpaPackagePreview.schema}</span>
                      <span className="chip chip-static">target {rpaPackagePreview.target}</span>
                      <span className="chip chip-static">limit {rpaPackagePreview.limit}</span>
                    </div>
                  )}
                </div>
                <div className="bridge-runner-guide">
                  <div className="bridge-runner-head">
                    <div>
                      <b>Bridge 出箱恢复</b>
                      <div className="muted small">
                        {recoveryPreview
                          ? `${recoveryPreview.dryRun ? '预览' : '已执行'} · ${recoveryPreview.workerId || '全部 worker'} · 冷却 ${recoveryPreview.minFailedAgeSeconds}s · 重试 ${recoveryPreview.maxRetryAttempts || '不限'} · 每批 ${recoveryPreview.limit} · ${bridgeRecoveryCount(recoveryPreview).total} 项${recoveryPreview.hasMore ? ' · 还有下一批' : ''}`
                          : '待预览'}
                      </div>
                    </div>
                    <div className="auto-actions inline">
                      <button className="btn-text" disabled={busy === 'bridge-recovery-preview'} onClick={() => previewBridgeRecovery()}>
                        预览
                      </button>
                      {recoveryPreview?.nextCursor && (
                        <button className="btn-text" disabled={busy === 'bridge-recovery-preview'} onClick={() => previewBridgeRecovery(recoveryPreview.nextCursor || '')}>
                          下一批
                        </button>
                      )}
                      <button className="btn-text" disabled={busy === 'bridge-recovery'} onClick={recoverBridgeOutbox}>
                        执行
                      </button>
                    </div>
                  </div>
                  <div className="auto-grid compact">
                    <label>
                      <span className="field-label">领取</span>
                      <select className="input" value={recoveryReleaseClaims} onChange={(e) => setRecoveryReleaseClaims(e.target.value as BridgeRecoveryReleaseMode)}>
                        <option value="expired">超时领取</option>
                        <option value="all">全部领取</option>
                        <option value="none">不释放</option>
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Worker</span>
                      <select className="input" value={recoveryWorkerId} onChange={(e) => setRecoveryWorkerId(e.target.value)}>
                        <option value="">全部 worker</option>
                        {bridgeWorkerOptions.map((worker) => (
                          <option value={worker.workerId} key={worker.workerId}>
                            {worker.workerId}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">失败原因</span>
                      <input className="input" value={recoveryFailureReason} onChange={(e) => setRecoveryFailureReason(e.target.value)} placeholder="包含文本" />
                    </label>
                    <label>
                      <span className="field-label">失败冷却</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max={7 * 24 * 60 * 60}
                        step="1"
                        value={recoveryMinFailedAge}
                        onChange={(e) => setRecoveryMinFailedAge(e.target.value)}
                        placeholder="秒"
                      />
                    </label>
                    <label>
                      <span className="field-label">重试上限</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={recoveryMaxRetryAttempts}
                        onChange={(e) => setRecoveryMaxRetryAttempts(e.target.value)}
                        placeholder="0=不限"
                      />
                    </label>
                    <label>
                      <span className="field-label">每批</span>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        max="2000"
                        step="1"
                        value={recoveryLimit}
                        onChange={(e) => setRecoveryLimit(e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="field-label">游标</span>
                      <input className="input" value={recoveryCursor} onChange={(e) => setRecoveryCursor(e.target.value)} placeholder="nextCursor" />
                    </label>
                    <div className="auto-field">
                      <span className="field-label">失败项</span>
                      <label className="auto-check">
                        <input type="checkbox" checked={recoveryRetryFailed} onChange={(e) => setRecoveryRetryFailed(e.target.checked)} />
                        <span>重试失败</span>
                      </label>
                    </div>
                    <div className="auto-field">
                      <span className="field-label">队列</span>
                      <div className="chip-row">
                        <label className="auto-check">
                          <input type="checkbox" checked={recoveryIncludeReplies} onChange={(e) => setRecoveryIncludeReplies(e.target.checked)} />
                          <span>AI 回复</span>
                        </label>
                        <label className="auto-check">
                          <input type="checkbox" checked={recoveryIncludeMass} onChange={(e) => setRecoveryIncludeMass(e.target.checked)} />
                          <span>群发</span>
                        </label>
                        <label className="auto-check">
                          <input type="checkbox" checked={recoveryIncludeMoments} onChange={(e) => setRecoveryIncludeMoments(e.target.checked)} />
                          <span>朋友圈</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  {recoveryPreview && (
                    <div className="auto-list compact">
                      {recoveryPreview.changes.slice(0, 5).map((change, index) => (
                        <div className="auto-list-item" key={`${change.target}-${change.id}-${change.action}-${index}`}>
                          <div>
                            <b>
                              {BRIDGE_RUN_ITEM_TARGET_LABEL[change.target] || change.target} · {change.name || change.id}
                            </b>
                            <div className="muted small">
                              {BRIDGE_RECOVERY_ACTION_LABEL[change.action] || change.action}
                              {change.reason ? ` · ${change.reason}` : ''}
                              {change.workerId ? ` · ${change.workerId}` : ''}
                            </div>
                            {change.error && <div className="muted small">失败：{change.error}</div>}
                            {change.failedAt && <div className="muted small">失败时间：{change.failedAt}</div>}
                            {change.retryCount !== undefined && (
                              <div className="muted small">
                                重试：当前 {change.retryCount} 次{change.nextRetryCount !== undefined ? `，恢复后 ${change.nextRetryCount} 次` : ''}
                              </div>
                            )}
                            {change.cursor && <div className="muted small">游标：{change.cursor}</div>}
                          </div>
                          <span className="tag tag-warn">{recoveryPreview.dryRun ? '预览' : '已处理'}</span>
                        </div>
                      ))}
                      {recoveryPreview.totalChanged > 5 && <div className="muted small">还有 {recoveryPreview.totalChanged - 5} 项</div>}
                      {recoveryPreview.nextCursor && <div className="muted small">下一批：{recoveryPreview.nextCursor}</div>}
                      {recoveryPreview.totalChanged === 0 && <div className="muted small">没有待恢复项</div>}
                    </div>
                  )}
                </div>
                {bridgeGuide && (
                  <div className="bridge-runner-guide">
                    <div className="bridge-runner-head">
                      <div>
                        <b>Mac Runner 接入</b>
                        <div className="muted small">
                          面板 <code>{bridgeGuide.panelUrl}</code> · 配置 <code>{bridgeGuide.configPath}</code>
                        </div>
                      </div>
                      <button className="btn-text" onClick={() => copyBridgeText(bridgeGuide.commands.writeEnv, '配置模板')}>
                        复制配置
                      </button>
                    </div>
                    <pre className="auto-code-block">
                      <code>{bridgeGuide.envFile}</code>
                    </pre>
                    <div className="bridge-command-list">
                      <div className="bridge-command-row">
                        <div>
                          <b>全队列 dry-run</b>
                          <code>{bridgeGuide.commands.dryRunAll}</code>
                        </div>
                        <button className="btn-text" onClick={() => copyBridgeText(bridgeGuide.commands.dryRunAll, 'dry-run 命令')}>
                          复制
                        </button>
                      </div>
                      {bridgeGuide.commands.dryRunRpaPackageAll && (
                        <div className="bridge-command-row">
                          <div>
                            <b>RPA 包 dry-run</b>
                            <code>{bridgeGuide.commands.dryRunRpaPackageAll}</code>
                          </div>
                          <button
                            className="btn-text"
                            onClick={() => copyBridgeText(bridgeGuide.commands.dryRunRpaPackageAll!, 'RPA 包 dry-run 命令')}
                          >
                            复制
                          </button>
                        </div>
                      )}
                      {bridgeGuide.commands.syncMaterialMap && (
                        <div className="bridge-command-row">
                          <div>
                            <b>同步素材映射</b>
                            <code>{bridgeGuide.commands.syncMaterialMap}</code>
                          </div>
                          <button className="btn-text" onClick={() => copyBridgeText(bridgeGuide.commands.syncMaterialMap!, '素材映射命令')}>
                            复制
                          </button>
                        </div>
                      )}
                      <div className="bridge-command-row">
                        <div>
                          <b>接入体检</b>
                          <code>{bridgeGuide.commands.doctor}</code>
                        </div>
                        <button className="btn-text" onClick={() => copyBridgeText(bridgeGuide.commands.doctor, '接入体检命令')}>
                          复制
                        </button>
                      </div>
                      <div className="bridge-command-row">
                        <div>
                          <b>体检并回传</b>
                          <code>{bridgeGuide.commands.doctorReport}</code>
                        </div>
                        <button className="btn-text" onClick={() => copyBridgeText(bridgeGuide.commands.doctorReport, '体检回传命令')}>
                          复制
                        </button>
                      </div>
                      <div className="bridge-command-row">
                        <div>
                          <b>领取并准备</b>
                          <code>{bridgeGuide.commands.prepareAll}</code>
                        </div>
                        <button className="btn-text" onClick={() => copyBridgeText(bridgeGuide.commands.prepareAll, 'prepare 命令')}>
                          复制
                        </button>
                      </div>
                      <div className="bridge-command-row">
                        <div>
                          <b>安装定时任务</b>
                          <code>{bridgeGuide.commands.dryRunLaunchAgent}</code>
                        </div>
                        <button className="btn-text" onClick={() => copyBridgeText(bridgeGuide.commands.dryRunLaunchAgent, 'LaunchAgent 预览命令')}>
                          复制
                        </button>
                      </div>
                      <div className="bridge-command-row">
                        <div>
                          <b>受控发送</b>
                          <code>{bridgeGuide.commands.sendAll}</code>
                        </div>
                        <button className="btn-text" onClick={() => copyBridgeText(bridgeGuide.commands.sendAll, 'send 命令')}>
                          复制
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {bridge.workers.length > 0 && (
                  <div className="auto-list compact">
                    {bridge.workers.slice(0, 4).map((worker) => (
                      <div className="auto-list-item" key={worker.id}>
                        <div>
                          <b>{worker.workerId}</b>
                          <div className="muted small">
                            {worker.source} · {worker.mode} · {worker.host || '未知主机'}
                            {worker.pid ? ` · pid ${worker.pid}` : ''}
                          </div>
                          <div className="muted small">
                            最后心跳 {fmtStaleSeconds(worker.staleSeconds)} · 待回复 {worker.pendingReplies} · 待群发 {worker.pendingMassTasks} · 待朋友圈 {worker.pendingMomentTasks}
                          </div>
                          <div className="chip-row">
                            {worker.capabilities.length > 0 ? (
                              worker.capabilities.slice(0, 8).map((capability) => (
                                <span key={capability} className="chip chip-static">
                                  {BRIDGE_WORKER_CAPABILITY_LABEL[capability] || capability}
                                </span>
                              ))
                            ) : (
                              <span className="chip chip-static">能力未知</span>
                            )}
                          </div>
                        </div>
                        <span className={'tag ' + (worker.online ? 'tag-on' : 'tag-off')}>{worker.online ? '在线' : '离线'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {bridgeRuns.length > 0 && (
                  <div className="auto-list compact">
                    {bridgeRuns.slice(0, 4).map((report) => {
                      const handled = report.handledReplies + report.handledMassTasks + report.handledMomentTasks;
                      const failed = report.failedReplies + report.failedMassTasks + report.failedMomentTasks;
                      const reportAt = Date.parse(report.finishedAt || report.updatedAt);
                      const items = report.items || [];
                      const itemSummary = items
                        .slice(0, 3)
                        .map((item) => {
                          const label = BRIDGE_RUN_ITEM_TARGET_LABEL[item.target] || item.target;
                          const result = item.ok === false ? '失败' : item.dryRun ? '预览' : item.ok === true ? '成功' : '记录';
                          const verification = bridgeRunVerificationSummary(item);
                          return `${label} · ${item.name || item.id} · ${item.action || result}${verification ? ` · ${verification}` : ''}`;
                        })
                        .join('；');
                      return (
                        <div className="auto-list-item" key={report.id}>
                          <div>
                            <b>
                              {BRIDGE_RUN_TARGET_LABEL[report.target] || report.target} · {report.mode}
                            </b>
                            <div className="muted small">
                              {report.workerId} · {Number.isFinite(reportAt) ? fmtDate(reportAt) : '时间未知'} · 处理 {handled} · 失败 {failed}
                              {report.durationMs !== undefined ? ` · ${Math.round(report.durationMs / 1000)}s` : ''}
                            </div>
                            {(report.summary || report.error) && <div className="muted small auto-snippet">{report.summary || report.error}</div>}
                            {items.length > 0 && (
                              <div className="muted small auto-snippet">
                                明细 {itemSummary}
                                {items.length > 3 ? `；+${items.length - 3}` : ''}
                              </div>
                            )}
                          </div>
                          <span className={'tag ' + (report.status === 'failed' ? 'tag-off' : report.status === 'started' ? '' : 'tag-on')}>
                            {report.status === 'started' ? '运行中' : AUTO_STATUS_LABEL[report.status] || report.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="auto-list">
              {knowledgeItems.slice(0, 5).map((item) => (
                <div key={item.id} className="auto-list-item">
                  <div>
                    <b>{item.title}</b>
                    <div className="muted small">
                      {KNOWLEDGE_CATEGORY_LABEL[item.category]} · {item.source} · {item.enabled ? '启用' : '停用'} · {item.approved ? '已审核' : '未审核'}
                    </div>
                    {item.content && <div className="muted small auto-snippet">{item.content}</div>}
                    {item.targetNames.length > 0 && <div className="muted small auto-snippet">目标 {item.targetNames.slice(0, 6).join('、')}</div>}
                  </div>
                  <div className="auto-actions">
                    <button className="btn-text" disabled={busy === `knowledge-${item.id}`} onClick={() => patchKnowledge(item, { approved: !item.approved })}>
                      {item.approved ? '撤审' : '审核'}
                    </button>
                    <button className="btn-text" disabled={busy === `knowledge-${item.id}`} onClick={() => patchKnowledge(item, { enabled: !item.enabled })}>
                      {item.enabled ? '停用' : '启用'}
                    </button>
                    <button className="btn-text" disabled={!item.content} onClick={() => useKnowledgeAsReplyContext(item)}>
                      上下文
                    </button>
                    <button className="btn-text" disabled={item.targetNames.length === 0} onClick={() => useKnowledgeTargetsForMass(item)}>
                      群发目标
                    </button>
                    <button className="btn-text danger" disabled={busy === `knowledge-${item.id}`} onClick={() => removeKnowledge(item)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {knowledgeItems.length === 0 && <div className="muted small">暂无接入资料</div>}
            </div>
          </section>

          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>素材资产</b>
              <span>
                <span className="tag">{materialAssets.length} 个素材</span>
                <span className="tag tag-on">{materialAssets.filter((item) => item.enabled && item.approved).length} 可用</span>
              </span>
            </div>
            <div className="auto-grid two compact">
              <input className="input" placeholder="来源，例如 wecom-mac" value={materialSource} onChange={(e) => setMaterialSource(e.target.value)} />
              <select className="input" value={materialKind} onChange={(e) => setMaterialKind(e.target.value as AutomationMaterialKind)}>
                {(Object.keys(MATERIAL_KIND_LABEL) as AutomationMaterialKind[]).map((key) => (
                  <option key={key} value={key}>
                    {MATERIAL_KIND_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="input textarea"
              placeholder="一行一个：素材key | 标题 | Mac本机路径或URL | 标签 | 说明。也支持 JSON：assets/materials/items 数组。"
              value={materialImportText}
              onChange={(e) => setMaterialImportText(e.target.value)}
            />
            <div className="auto-actions inline">
              <label className="auto-check inline-check">
                <input type="checkbox" checked={materialApproveImported} onChange={(e) => setMaterialApproveImported(e.target.checked)} />
                <span>导入后标记为已审核</span>
              </label>
              <button className="btn s-btn" disabled={busy === 'material-import' || !materialImportText.trim()} onClick={importMaterials}>
                导入素材
              </button>
            </div>
            <div className="auto-list">
              {materialAssets.slice(0, 8).map((asset) => (
                <div key={asset.id} className="auto-list-item">
                  <div>
                    <b>{asset.key}</b>
                    <div className="muted small">
                      {asset.title} · {MATERIAL_KIND_LABEL[asset.kind]} · {asset.source} · {asset.enabled ? '启用' : '停用'} · {asset.approved ? '已审核' : '未审核'}
                    </div>
                    {(asset.localPath || asset.url || asset.tags.length > 0 || asset.description) && (
                      <div className="muted small auto-snippet">
                        {[asset.localPath || asset.url, asset.tags.length ? `标签 ${asset.tags.slice(0, 6).join('、')}` : '', asset.description].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="auto-actions">
                    <button className="btn-text" disabled={busy === `material-${asset.id}`} onClick={() => patchMaterial(asset, { approved: !asset.approved })}>
                      {asset.approved ? '撤审' : '审核'}
                    </button>
                    <button className="btn-text" disabled={busy === `material-${asset.id}`} onClick={() => patchMaterial(asset, { enabled: !asset.enabled })}>
                      {asset.enabled ? '停用' : '启用'}
                    </button>
                    <button className="btn-text" onClick={() => copyMaterialReplyToken(asset)}>
                      回复片段
                    </button>
                    <button className="btn-text" onClick={() => useMaterialForMoment(asset)}>
                      朋友圈
                    </button>
                    <button className="btn-text danger" disabled={busy === `material-${asset.id}`} onClick={() => removeMaterial(asset)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {materialAssets.length === 0 && <div className="muted small">暂无素材资产</div>}
            </div>
          </section>

          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>受众资产</b>
              <span className="tag">{audienceContacts.length} 个对象</span>
            </div>
            <div className="auto-grid two compact">
              <input className="input" placeholder="来源，例如 wecom-mac" value={audienceSource} onChange={(e) => setAudienceSource(e.target.value)} />
              <select className="input" value={audienceType} onChange={(e) => setAudienceType(e.target.value as AutomationAudienceContactType)}>
                <option value="unknown">自动识别</option>
                <option value="contact">联系人</option>
                <option value="group">客户群</option>
                <option value="room">群聊</option>
              </select>
            </div>
            <textarea
              className="input textarea"
              placeholder="一行一个联系人或群聊名。也支持 JSON：contacts/items/recipients 数组。"
              value={audienceImportText}
              onChange={(e) => setAudienceImportText(e.target.value)}
            />
            <div className="auto-actions inline">
              <label className="auto-check inline-check">
                <input type="checkbox" checked={audienceApproveImported} onChange={(e) => setAudienceApproveImported(e.target.checked)} />
                <span>导入后标记为已审核</span>
              </label>
              <button className="btn s-btn" disabled={busy === 'audience-import' || !audienceImportText.trim()} onClick={importAudience}>
                导入受众
              </button>
              <button
                className="btn-text"
                disabled={audienceContacts.filter((item) => item.enabled && item.approved).length === 0}
                onClick={() => useAudienceForMass(audienceContacts.filter((item) => item.enabled && item.approved))}
              >
                已审核受众填入群发
              </button>
            </div>
            <div className="auto-list">
              {audienceContacts.slice(0, 8).map((contact) => (
                <div key={contact.id} className="auto-list-item">
                  <div>
                    <b>{contact.name}</b>
                    <div className="muted small">
                      {AUDIENCE_TYPE_LABEL[contact.type]} · {contact.source} · {contact.enabled ? '启用' : '停用'} · {contact.approved ? '已审核' : '未审核'}
                    </div>
                    {(contact.tags.length > 0 || contact.aliases.length > 0 || contact.note) && (
                      <div className="muted small auto-snippet">
                        {[contact.tags.length ? `标签 ${contact.tags.slice(0, 6).join('、')}` : '', contact.aliases.length ? `别名 ${contact.aliases.slice(0, 4).join('、')}` : '', contact.note]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="auto-actions">
                    <button className="btn-text" disabled={busy === `audience-${contact.id}`} onClick={() => patchAudience(contact, { approved: !contact.approved })}>
                      {contact.approved ? '撤审' : '审核'}
                    </button>
                    <button className="btn-text" disabled={busy === `audience-${contact.id}`} onClick={() => patchAudience(contact, { enabled: !contact.enabled })}>
                      {contact.enabled ? '停用' : '启用'}
                    </button>
                    <button className="btn-text" onClick={() => useAudienceForMass([contact])}>
                      群发目标
                    </button>
                    <button className="btn-text danger" disabled={busy === `audience-${contact.id}`} onClick={() => removeAudience(contact)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {audienceContacts.length === 0 && <div className="muted small">暂无受众资产</div>}
            </div>
          </section>

          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>企微消息收件箱</b>
              <span className="tag">{bridgeEvents.length} 条</span>
            </div>
            <div className="auto-list">
              {bridgeEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="auto-list-item">
                  <div>
                    <b>{event.conversationName || event.senderName || '未命名会话'}</b>
                    <div className="muted small">
                      {AUTO_STATUS_LABEL[event.status] || event.status} · {event.source} · {fmtDate(Date.parse(event.receivedAt || event.createdAt))}
                      {event.senderName ? ` · ${event.senderName}` : ''}
                      {event.replyApproved ? ' · 回复已批准' : ''}
                      {event.replySteps?.length ? ` · 顺序回复 ${replyStepSummary(event.replySteps)}` : ''}
                      {event.replyClaimedAt && !event.replyDeliveredAt
                        ? isPastIso(event.replyClaimExpiresAt)
                          ? ` · 领取超时${event.replyClaimedBy ? `(${event.replyClaimedBy})` : ''}`
                          : ` · Mac 已领取${event.replyClaimedBy ? `(${event.replyClaimedBy})` : ''}`
                        : ''}
                      {event.replyFailedAt ? ' · 发送失败' : ''}
                      {event.replyDeliveredAt ? ' · 已交付 Mac' : ''}
                    </div>
                    {event.replyClaimedAt && !event.replyDeliveredAt && event.replyClaimExpiresAt && (
                      <div className="muted small">
                        领取有效期至 {fmtDate(Date.parse(event.replyClaimExpiresAt))}
                        {isPastIso(event.replyClaimExpiresAt) ? '，可被重新拉取' : ''}
                      </div>
                    )}
                    {event.replyError && <div className="muted small auto-snippet">失败原因：{event.replyError}</div>}
                    <div className="muted small auto-snippet">{event.inboundText}</div>
                  </div>
                  <div className="auto-actions">
                    <button className="btn-text" disabled={busy === `bridge-event-${event.id}`} onClick={() => useBridgeEventForReply(event)}>
                      生成回复
                    </button>
                    <button className="btn-text" disabled={busy === `bridge-event-${event.id}`} onClick={() => archiveBridgeEvent(event)}>
                      归档
                    </button>
                  </div>
                  <div className="auto-targets">
                    <textarea
                      className="input textarea"
                      placeholder="人工确认后的回复草稿。空行分段；写 [wait 3] 等待，写 [image /本机路径/a.png] 添加图片，写 [image-key poster] 引用 Mac 本机素材映射。"
                      value={bridgeReplyDrafts[event.id] ?? event.replyDraft ?? ''}
                      onChange={(e) => setBridgeReplyDrafts((map) => ({ ...map, [event.id]: e.target.value }))}
                    />
                    <div className="muted small">当前：{replyStepSummary(event.replySteps)}</div>
                    <div className="auto-actions inline">
                      <button className="btn-text" disabled={busy === `bridge-reply-${event.id}`} onClick={() => saveBridgeReplyDraft(event)}>
                        保存草稿
                      </button>
                      <button className="btn-text" disabled={busy === `bridge-reply-${event.id}`} onClick={() => saveBridgeReplyDraft(event, false, true)}>
                        保存为顺序回复
                      </button>
                      <button className="btn-text" disabled={busy === `bridge-reply-${event.id}`} onClick={() => saveBridgeReplyDraft(event, true)}>
                        保存并批准
                      </button>
                      <button className="btn-text" disabled={busy === `bridge-reply-${event.id}`} onClick={() => saveBridgeReplyDraft(event, true, true)}>
                        顺序批准
                      </button>
                      {event.replyApproved && (
                        <button className="btn-text danger" disabled={busy === `bridge-reply-${event.id}`} onClick={() => toggleBridgeReplyApproval(event, false)}>
                          取消批准
                        </button>
                      )}
                      {event.replyClaimedAt && !event.replyDeliveredAt && (
                        <button className="btn-text" disabled={busy === `bridge-reply-${event.id}`} onClick={() => releaseBridgeReplyClaim(event)}>
                          释放领取
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {bridgeEvents.length === 0 && <div className="muted small">暂无企微 Bridge 消息</div>}
            </div>
          </section>

          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>AI 回复</b>
              <span>
                <span className="tag">{cfg.rules.length} 条规则</span>
                {replyPlan && <span className={'tag ' + (replyPlan.mode === 'blocked' ? 'tag-off' : replyPlan.mode === 'manual-review' ? 'tag-warn' : 'tag-on')}>{replyPlan.mode}</span>}
              </span>
            </div>
            <textarea className="input textarea tall" placeholder="粘贴客户最新消息" value={replyInbound} onChange={(e) => setReplyInbound(e.target.value)} />
            <div className="auto-actions inline">
              <button className="btn-text" disabled={!selectedInstance || busy === 'reply-copy-selection'} onClick={() => readInboundFromClipboard(true)}>
                读取选中文本
              </button>
              <button className="btn-text" disabled={!selectedInstance || busy === 'reply-read-clipboard'} onClick={() => readInboundFromClipboard(false)}>
                读取实例剪贴板
              </button>
            </div>
            <textarea className="input textarea" placeholder="可选：上下文/最近对话" value={replyContext} onChange={(e) => setReplyContext(e.target.value)} />
            <input className="input" placeholder="可选：额外要求" value={replyInstruction} onChange={(e) => setReplyInstruction(e.target.value)} />
            <div className="settings-actions">
              <button className="btn btn-primary s-btn" disabled={busy === 'reply-plan' || !replyInbound.trim()} onClick={buildReplyPlan}>
                生成回复计划
              </button>
              <button className="btn s-btn" disabled={!sendableReply || busy === 'reply-send'} onClick={sendReplyPlan}>
                发送到当前会话
              </button>
            </div>
            {replyPlan && (
              <div className="auto-result">
                <div className="muted small">{replyPlan.reasons.join('；')}</div>
                {replyPlan.draft && <pre>{replyPlan.draft}</pre>}
              </div>
            )}
            {replyPlan?.draft && (
              <div className="auto-rule-box">
                <input className="input" placeholder="保存为规则名称" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
                <textarea
                  className="input textarea"
                  placeholder="触发词，一行一个。留空时会尝试用客户消息作为触发词"
                  value={ruleTriggers}
                  onChange={(e) => setRuleTriggers(e.target.value)}
                />
                <label className="auto-check">
                  <input type="checkbox" checked={ruleApprove} onChange={(e) => setRuleApprove(e.target.checked)} />
                  <span>保存后直接标记为已审核</span>
                </label>
                <button className="btn s-btn" disabled={busy === 'rule-save'} onClick={saveReplyAsRule}>
                  沉淀为关键词规则
                </button>
              </div>
            )}
          </section>

          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>群发队列</b>
              <span className="tag">{jobs.length} 个队列</span>
            </div>
            <input className="input" placeholder="队列名称" value={massTitle} onChange={(e) => setMassTitle(e.target.value)} />
            <textarea className="input textarea tall" placeholder="群发内容" value={massMessage} onChange={(e) => setMassMessage(e.target.value)} />
            <textarea className="input textarea" placeholder="联系人或群聊名，一行一个" value={massRecipients} onChange={(e) => setMassRecipients(e.target.value)} />
            <div className="auto-grid two compact">
              <input className="input" placeholder="受众关键词" value={massAudienceQuery} onChange={(e) => setMassAudienceQuery(e.target.value)} />
              <input className="input" placeholder="受众标签" value={massAudienceTag} onChange={(e) => setMassAudienceTag(e.target.value)} />
              <select className="input" value={massAudienceType} onChange={(e) => setMassAudienceType(e.target.value as AutomationAudienceMassJobTypeFilter)}>
                <option value="all">全部类型</option>
                <option value="contact">联系人</option>
                <option value="group">客户群</option>
                <option value="room">群聊</option>
                <option value="unknown">未知</option>
              </select>
              <input className="input" inputMode="numeric" placeholder="最多目标数" value={massAudienceLimit} onChange={(e) => setMassAudienceLimit(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>
            <button className="btn s-btn" disabled={busy === 'mass-audience-create' || !massMessage.trim()} onClick={createMassJobFromAudience}>
              从受众创建队列
            </button>
            <label className="auto-check">
              <input type="checkbox" checked={massAutoOpen} onChange={(e) => setMassAutoOpen(e.target.checked)} />
              <span>发送前自动搜索并打开目标会话</span>
            </label>
            <div className="auto-grid two compact">
              <label className="auto-field">
                <span className="field-label">每条间隔秒数</span>
                <input className="input" inputMode="numeric" value={massDelay} onChange={(e) => setMassDelay(e.target.value.replace(/[^0-9]/g, ''))} />
              </label>
              <label className="auto-field">
                <span className="field-label">搜索快捷键</span>
                <select className="input" value={massSearchShortcut} onChange={(e) => setMassSearchShortcut(e.target.value)}>
                  <option value="ctrl+f">Ctrl+F</option>
                  <option value="ctrl+k">Ctrl+K</option>
                  <option value="ctrl+l">Ctrl+L</option>
                  <option value="super+s">Super+S</option>
                </select>
              </label>
              <label className="auto-field">
                <span className="field-label">等搜索结果秒数</span>
                <input className="input" inputMode="numeric" value={massSearchDelay} onChange={(e) => setMassSearchDelay(e.target.value.replace(/[^0-9]/g, ''))} />
              </label>
              <label className="auto-field">
                <span className="field-label">打开会话后等待秒数</span>
                <input className="input" inputMode="numeric" value={massPostOpenDelay} onChange={(e) => setMassPostOpenDelay(e.target.value.replace(/[^0-9]/g, ''))} />
              </label>
            </div>
            <button className="btn btn-primary s-btn" disabled={busy === 'mass-create' || !massMessage.trim() || linesOf(massRecipients).length === 0} onClick={createMassJob}>
              创建受控队列
            </button>
            <div className="auto-list">
              {jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="auto-list-item">
                  <div>
                    <b>{job.title}</b>
                    <div className="muted small">
                      {AUTO_STATUS_LABEL[job.status] || job.status} · {jobProgress(job)} · {job.options.openConversationBeforeSend ? '自动搜索' : '当前会话'} · 下一位{' '}
                      {nextMassTarget(job) || '无'}
                    </div>
                  </div>
                  <div className="auto-actions">
                    {!job.approved && (
                      <button className="btn-text" disabled={busy === `job-${job.id}`} onClick={() => patchJob(job, { approved: true, status: 'queued' })}>
                        审核
                      </button>
                    )}
                    <button className="btn-text" disabled={!job.approved || busy === `send-${job.id}` || !nextMassTarget(job)} onClick={() => sendNextJobItem(job)}>
                      发下一条
                    </button>
                    {job.status !== 'cancelled' && job.status !== 'completed' && (
                      <button className="btn-text danger" disabled={busy === `job-${job.id}`} onClick={() => patchJob(job, { status: 'cancelled' })}>
                        取消
                      </button>
                    )}
                  </div>
                  <div className="auto-targets">
                    {job.items.slice(0, 6).map((item) => (
                      <div key={item.id} className="auto-target-row">
                        <span className={'tag ' + (item.status === 'sent' ? 'tag-on' : item.status === 'failed' ? 'tag-off' : item.status === 'skipped' ? 'tag-warn' : '')}>
                          {AUTO_STATUS_LABEL[item.status] || item.status}
                        </span>
                        <span className="auto-target-name" title={item.error || item.recipientName}>
                          {item.recipientName}
                        </span>
                        <span className="auto-target-actions">
                          {item.status === 'pending' && (
                            <button className="btn-text" disabled={busy === `item-${item.id}`} onClick={() => patchJobItem(job, item.id, 'skipped', '手动跳过')}>
                              跳过
                            </button>
                          )}
                          {(item.status === 'failed' || item.status === 'skipped') && (
                            <button className="btn-text" disabled={busy === `item-${item.id}`} onClick={() => patchJobItem(job, item.id, 'pending')}>
                              重置
                            </button>
                          )}
                          {item.status === 'pending' && (
                            <button className="btn-text danger" disabled={busy === `item-${item.id}`} onClick={() => patchJobItem(job, item.id, 'failed', '手动标记失败')}>
                              标失败
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                    {job.items.length > 6 && <div className="muted small">还有 {job.items.length - 6} 个目标未展开</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>朋友圈半自动</b>
              <span className="tag">{drafts.length} 个草稿</span>
            </div>
            <input className="input" placeholder="运营主题" value={momentTopic} onChange={(e) => setMomentTopic(e.target.value)} />
            <input className="input" placeholder="目标人群，可选" value={momentAudience} onChange={(e) => setMomentAudience(e.target.value)} />
            <input className="input" placeholder="语气" value={momentTone} onChange={(e) => setMomentTone(e.target.value)} />
            <button className="btn s-btn" disabled={busy === 'moment-ai' || !momentTopic.trim()} onClick={draftMomentByAI}>
              AI 生成文案
            </button>
            <input className="input" placeholder="草稿标题" value={momentTitle} onChange={(e) => setMomentTitle(e.target.value)} />
            <textarea className="input textarea tall" placeholder="朋友圈正文" value={momentText} onChange={(e) => setMomentText(e.target.value)} />
            <textarea className="input textarea" placeholder="图片/素材说明" value={momentImageNotes} onChange={(e) => setMomentImageNotes(e.target.value)} />
            <textarea className="input textarea" placeholder="素材文件名或链接，一行一个" value={momentMaterials} onChange={(e) => setMomentMaterials(e.target.value)} />
            <button className="btn btn-primary s-btn" disabled={busy === 'moment-create' || !momentText.trim()} onClick={createMoment}>
              保存朋友圈草稿
            </button>
            <div className="auto-list">
              {drafts.slice(0, 5).map((draft) => (
                <div key={draft.id} className="auto-list-item">
                  <div>
                    <b>{draft.title}</b>
                    <div className="muted small">
                      {AUTO_STATUS_LABEL[draft.status] || draft.status} · {draft.approved ? '已审核' : '未审核'}
                      {draft.bridgeClaimedBy ? ` · ${draft.bridgeClaimedBy} 已领取` : ''}
                      {draft.bridgeError ? ` · ${draft.bridgeError}` : ''}
                    </div>
                  </div>
                  <div className="auto-actions">
                    {!draft.approved && (
                      <button className="btn-text" disabled={busy === `draft-${draft.id}`} onClick={() => patchDraft(draft, { approved: true, status: 'ready' })}>
                        审核
                      </button>
                    )}
                    <button className="btn-text" disabled={!draft.approved || busy === `prepare-${draft.id}`} onClick={() => prepareDraft(draft, 'copy-to-clipboard')}>
                      复制
                    </button>
                    <button className="btn-text" disabled={!draft.approved || busy === `prepare-${draft.id}`} onClick={() => prepareDraft(draft, 'fill-current-input')}>
                      填入
                    </button>
                    {draft.status !== 'published' && (
                      <button className="btn-text" disabled={busy === `draft-${draft.id}`} onClick={() => patchDraft(draft, { status: 'published' })}>
                        标记发布
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>资产包备份</b>
              <span className="tag">{bundlePreview ? bundleCount(bundlePreview) : 'JSON'}</span>
            </div>
            <div className="auto-actions inline">
              <button className="btn btn-primary s-btn" disabled={busy === 'bundle-export'} onClick={downloadAutomationBundle}>
                导出资产包
              </button>
              <select className="input compact-input" value={bundleMode} onChange={(e) => setBundleMode(e.target.value as AutomationBundleMode)}>
                <option value="upsert">按名称更新</option>
                <option value="append">全部追加</option>
              </select>
            </div>
            <textarea
              className="input textarea"
              placeholder="粘贴 woc-automation-bundle JSON"
              value={bundleImportText}
              onChange={(e) => {
                setBundleImportText(e.target.value);
                setBundlePreview(null);
              }}
            />
            <div className="auto-actions inline">
              <label className="auto-check inline-check">
                <input type="checkbox" checked={bundleIncludeConfig} onChange={(e) => setBundleIncludeConfig(e.target.checked)} />
                <span>导入规则、人设和开关</span>
              </label>
              <label className="auto-check inline-check">
                <input type="checkbox" checked={bundleKeepOperationalState} onChange={(e) => setBundleKeepOperationalState(e.target.checked)} />
                <span>保留队列运行状态</span>
              </label>
            </div>
            <div className="auto-actions inline">
              <button className="btn s-btn" disabled={busy === 'bundle-preview' || !bundleImportText.trim()} onClick={previewAutomationBundleImport}>
                预览导入
              </button>
              <button className="btn s-btn" disabled={busy === 'bundle-import' || !bundleImportText.trim()} onClick={applyAutomationBundleImport}>
                确认导入
              </button>
            </div>
            {bundlePreview && (
              <div className="muted small auto-snippet">
                {bundleCount(bundlePreview)}
                {bundlePreview.errors.length ? ` · ${bundlePreview.errors.slice(0, 2).join(' / ')}` : ''}
              </div>
            )}
          </section>

          <section className="auto-panel">
            <div className="auto-panel-head">
              <b>审计记录</b>
              <span className="tag">{audit.length}</span>
            </div>
            <div className="auto-list audit">
              {audit.slice(0, 8).map((ev) => (
                <div key={ev.id} className="auto-list-item">
                  <div>
                    <b>{ev.message || ev.action}</b>
                    <div className="muted small">
                      {fmtDate(Date.parse(ev.timestamp))} · {ev.actor}
                      {ev.instanceName ? ` · ${ev.instanceName}` : ''}
                    </div>
                  </div>
                  {ev.riskLevel && <span className={'tag ' + (ev.riskLevel === 'normal' ? 'tag-on' : ev.riskLevel === 'review' ? 'tag-warn' : 'tag-off')}>{ev.riskLevel}</span>}
                </div>
              ))}
              {audit.length === 0 && <div className="muted small">暂无审计记录</div>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// 「诊断与日志」（仅管理员）：单实例「日志」只记录该实例日志；这里一键打包全局——系统信息 +
// 面板运维日志 + 全部实例容器状态/日志 + 容器清单，便于排查部署/创建卡死/黑屏不可用等问题。
function DiagnosticsSection() {
  const [range, setRange] = useState('24h');
  const exportBundle = () => {
    // tar.gz 带 content-disposition: attachment，用隐藏 <a> 触发下载（带同源 cookie），不离开页面。
    const a = document.createElement('a');
    a.href = api.diagnosticsUrl(range);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <>
      <div className="section-row" style={{ marginTop: 22 }}>
        <span className="section-title">诊断与日志</span>
      </div>
      <div className="settings-block">
        <p className="s-desc">打包系统/Docker 信息 + 面板全局日志 + 各实例容器状态与日志 + 容器清单，用于排查部署、创建卡死、黑屏不可用、升级失败等问题。</p>
        <div className="s-field">
          <span className="field-label">时间范围</span>
          <div className="chip-row">
            {DIAG_RANGE_OPTIONS.map((r) => (
              <button key={r.key} className={'chip chip-toggle' + (range === r.key ? ' on' : '')} onClick={() => setRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary s-btn" onClick={exportBundle}>
            导出诊断包
          </button>
          <a className="btn-text" href={api.panelLogUrl(range)} target="_blank" rel="noreferrer">
            查看面板日志 ›
          </a>
        </div>
        <p className="s-foot">导出当前选定范围内的日志（.tar.gz）。超过一年的日志自动清理；诊断包不含密码 / 密钥等敏感信息。</p>
      </div>
    </>
  );
}

// 「关于」：显示真实构建版本号 + 检测新版（后台已每 6h 查 Docker Hub/GHCR；这里读缓存并可手动重查）。
function AboutSection({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useUI();
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.getVersion().then(setInfo).catch(() => {});
  }, []);

  // 当前版本是否为正式发布版（语义化 vX.Y.Z）。dev / dev-<sha> 等本地构建无法与发布版比较，
  // 既不显示「已是最新」也不显示红点，只把最新发布版作为信息展示。
  const isRelease = !!info && /^v?\d+\.\d+\.\d+$/.test(info.current);

  const check = async () => {
    setChecking(true);
    try {
      const r = await api.checkUpdate();
      setInfo(r);
      const rel = /^v?\d+\.\d+\.\d+$/.test(r.current);
      if (r.error) toast('检查失败：' + r.error, 'error');
      else if (r.hasUpdate) toast(`发现新版本 ${r.latest}`, 'ok');
      else if (!rel) toast(`最新发布 ${r.latest ?? '未知'}（当前为开发版）`, 'ok');
      else toast('已是最新版本', 'ok');
    } catch (e: any) {
      toast(e.message || '检查失败', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <div className="section-row" style={{ marginTop: 22 }}>
        <span className="section-title">关于</span>
      </div>
      <div className="settings-block">
        <div className="s-title-row">
          <span className="s-app">云微 · WechatOnCloud</span>
          {info?.hasUpdate ? <span className="tag tag-warn">有新版</span> : info && !isRelease ? <span className="tag">开发版</span> : null}
        </div>
        <p className="s-line">
          当前版本 <b>{info?.current ?? '…'}</b>
          {info?.hasUpdate && info.latest && (
            <>
              {' · '}最新 <b>{info.latest}</b>
            </>
          )}
          {isRelease && info && !info.hasUpdate && info.latest && !info.error && <>{' · '}已是最新</>}
          {!isRelease && info?.latest && !info.error && (
            <>
              {' · '}最新发布 <b>{info.latest}</b>
            </>
          )}
        </p>
        {info?.hasUpdate && (
          <div className="ver-hint">
            在宿主执行 <code>docker compose pull &amp;&amp; docker compose up -d</code> 升级面板；各实例镜像可在「管理 → 升级」单独更新。
          </div>
        )}
        <div className="settings-actions">
          {info?.hasUpdate && (
            <a className="btn btn-primary s-btn" href={RELEASES_URL + '/latest'} target="_blank" rel="noreferrer">
              查看新版
            </a>
          )}
          {isAdmin && (
            <button className="btn-text" disabled={checking} onClick={check}>
              {checking ? '检查中…' : '检查更新'}
            </button>
          )}
          <a className="btn-text" href={RELEASES_URL} target="_blank" rel="noreferrer">
            发布日志 ›
          </a>
        </div>
        {info && (
          <p className="s-foot">
            {info.checkedAt ? `上次检查 ${fmtDate(info.checkedAt)}` : '尚未检查'}
            {info.source && ` · 来源 ${info.source}`}
            {info.error && ` · ${info.error}`}
          </p>
        )}
      </div>
    </>
  );
}

export default function Admin({ onOpenMenu, onChangePassword }: { onOpenMenu: () => void; onChangePassword: () => void }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast, confirm } = useUI();
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [instances, setInstances] = useState<InstanceWithStatus[]>([]);
  const [err, setErr] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingInst, setCreatingInst] = useState(false);
  const [assignInst, setAssignInst] = useState<InstanceWithStatus | null>(null); // 给实例选账户
  const [assignUser, setAssignUser] = useState<PanelUser | null>(null); // 给账户选实例
  const [resetTarget, setResetTarget] = useState<PanelUser | null>(null); // 重置密码弹窗
  const [deleteInst, setDeleteInst] = useState<InstanceWithStatus | null>(null); // 删除实例弹窗
  const [renameInst, setRenameInst] = useState<InstanceWithStatus | null>(null); // 重命名实例弹窗
  const [securityInst, setSecurityInst] = useState<InstanceWithStatus | null>(null); // 安全（内存阈值）弹窗
  const [volumeInst, setVolumeInst] = useState<InstanceWithStatus | null>(null); // 数据卷管理弹窗
  const [iconInst, setIconInst] = useState<InstanceWithStatus | null>(null); // 图标编辑弹窗
  const [acting, setActing] = useState<Record<string, string>>({}); // 实例 id → 进行中的动作文案（启动中/升级中…）
  // 未使用的旧数据卷（来自之前删实例时未勾选"彻底清除"）：允许复用以继承聊天记录，或显式删除。
  const [orphanVols, setOrphanVols] = useState<{ name: string; createdAt?: string; sizeBytes?: number }[]>([]);
  // 残留 woc-wx-* 容器（runInstance 启动失败遗留的 Created 容器等）：占着卷名让删卷报 409。
  const [orphanConts, setOrphanConts] = useState<{ id: string; name: string; status: string; volumeName?: string }[]>([]);
  const setAct = (id: string, label: string | null) =>
    setActing((a) => {
      const n = { ...a };
      if (label) n[id] = label;
      else delete n[id];
      return n;
    });

  const subs = users.filter((u) => u.role !== 'admin');
  const timer = useRef<number | undefined>(undefined);

  const load = async () => {
    if (!isAdmin) return; // 子账号无管理数据权限，管理页只给改密
    try {
      const [{ users }, { instances }] = await Promise.all([api.listUsers(), api.listInstances()]);
      setUsers(users);
      setInstances(instances);
    } catch (e: any) {
      setErr(e.message);
    }
    // 孤儿卷 / 残留容器独立 catch：docker 接口失败不应阻塞用户/实例视图
    try {
      const { volumes } = await api.listOrphanVolumes();
      setOrphanVols(volumes);
    } catch {
      /* ignore */
    }
    try {
      const { containers } = await api.listOrphanContainers();
      setOrphanConts(containers);
    } catch {
      /* ignore */
    }
  };

  const removeOrphanCont = async (c: { id: string; name: string }) => {
    const ok = await confirm({
      title: `删除残留容器「${c.name}」？`,
      body: '此容器不属于任何登记实例（多为创建失败遗留）。删除不会动数据卷，删后才能继续清理同名旧数据卷。',
      danger: true,
      confirmText: '删除容器',
    });
    if (!ok) return;
    try {
      await api.deleteOrphanContainer(c.id);
      toast('已删除残留容器，可继续清理数据卷', 'ok');
      setOrphanConts((cs) => cs.filter((x) => x.id !== c.id));
      // 容器走了之后，原本被它占着的卷可能从"被引用"翻成"孤儿"，刷新一次
      try {
        const { volumes } = await api.listOrphanVolumes();
        setOrphanVols(volumes);
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      toast(e.message || '删除失败', 'error');
    }
  };

  const removeOrphanVol = async (name: string) => {
    const ok = await confirm({
      title: `彻底删除数据卷「${name}」？`,
      body: '该卷里保存的微信本地数据（聊天记录缓存等）将永久消失，无法恢复。',
      danger: true,
      confirmText: '彻底删除',
    });
    if (!ok) return;
    try {
      await api.deleteOrphanVolume(name);
      toast('已删除数据卷', 'ok');
      setOrphanVols((vs) => vs.filter((v) => v.name !== name));
    } catch (e: any) {
      toast(e.message || '删除失败', 'error');
    }
  };

  useEffect(() => {
    load();
    return () => window.clearTimeout(timer.current);
  }, []);

  // 安装/更新进行中时轮询进度
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (instances.some((i) => BUSY_PHASES.includes(i.wechat.phase))) timer.current = window.setTimeout(load, 1500);
    return () => window.clearTimeout(timer.current);
  }, [instances]);

  const trigger = async (inst: InstanceWithStatus, kind: 'install' | 'update') => {
    try {
      await (kind === 'install' ? api.instanceWechatInstall(inst.id) : api.instanceWechatUpdate(inst.id));
      setInstances((list) =>
        list.map((i) =>
          i.id === inst.id ? { ...i, wechat: { ...i.wechat, phase: 'downloading', percent: -1, message: '正在准备…' } } : i,
        ),
      );
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(load, 1000);
      toast(kind === 'install' ? '已开始下载微信' : '已开始更新', 'ok');
    } catch (e: any) {
      toast(e.message || '操作失败', 'error');
    }
  };

  const start = async (inst: InstanceWithStatus) => {
    setAct(inst.id, '启动中…');
    try {
      await api.instanceStart(inst.id);
      toast('实例已启动', 'ok');
      await load();
    } catch (e: any) {
      toast(e.message || '启动失败', 'error');
    } finally {
      setAct(inst.id, null);
    }
  };

  const lifecycle = async (inst: InstanceWithStatus, kind: 'stop' | 'restart' | 'upgrade') => {
    const label = kind === 'stop' ? '停止中…' : kind === 'upgrade' ? '升级中…' : '重启中…';
    setAct(inst.id, label);
    if (kind === 'upgrade') toast('正在升级实例：拉取最新镜像并重建，可能需要几分钟，请勿离开…', 'info');
    try {
      await (kind === 'stop' ? api.instanceStop(inst.id) : kind === 'upgrade' ? api.instanceUpgrade(inst.id) : api.instanceRestart(inst.id));
      toast(kind === 'stop' ? '已停止' : kind === 'upgrade' ? '已升级到最新镜像并重启' : '已重启', 'ok');
      await load();
    } catch (e: any) {
      toast(e.message || '操作失败', 'error');
    } finally {
      setAct(inst.id, null);
    }
  };

  const instName = (id: string) => instances.find((i) => i.id === id)?.name || id;
  const usersForInstance = (id: string) => subs.filter((u) => u.allowedInstances.includes(id));

  const toggle = async (u: PanelUser) => {
    try {
      await api.setDisabled(u.id, !u.disabled);
      toast(u.disabled ? '已启用' : '已禁用', 'ok');
    } catch (e: any) {
      toast(e.message, 'error');
    }
    load();
  };
  const removeUser = async (u: PanelUser) => {
    const ok = await confirm({ title: `删除子账号「${u.username}」？`, body: '该账户将无法再登录。', danger: true, confirmText: '删除' });
    if (!ok) return;
    try {
      await api.deleteUser(u.id);
      toast('已删除', 'ok');
    } catch (e: any) {
      toast(e.message, 'error');
    }
    load();
  };

  return (
    <div className="ws-page">
      <header className="ws-head">
        <button className="ws-menu" onClick={onOpenMenu} aria-label="菜单">
          {MenuIcon}
        </button>
        <span className="ws-title">{isAdmin ? '管理' : '设置'}</span>
      </header>

      <main className="content">
        {err && <div className="error">{err}</div>}

        {isAdmin && (
          <>
            <div className="section-row">
              <span className="section-title">实例</span>
              <button className="btn-text" onClick={() => setCreatingInst(true)}>
                + 新建实例
              </button>
            </div>
            {instances.length === 0 ? (
              <EmptyState
                icon="🖥️"
                title="还没有实例"
                sub="新建一个实例（微信 / Chromium 浏览器），进入后即可在浏览器里使用"
                action={
                  <button className="btn btn-primary" onClick={() => setCreatingInst(true)}>
                    ＋ 新建实例
                  </button>
                }
              />
            ) : (
              <div className="inst-grid">
                {instances.map((inst) => (
                  <InstanceAdminCard
                    key={inst.id}
                    inst={inst}
                    userCount={usersForInstance(inst.id).length}
                    acting={acting[inst.id]}
                    onEnter={() => nav(`/i/${inst.id}`)}
                    onTrigger={trigger}
                    onStart={() => start(inst)}
                    onStop={() => lifecycle(inst, 'stop')}
                    onRestart={() => lifecycle(inst, 'restart')}
                    onUpgrade={() => lifecycle(inst, 'upgrade')}
                    onRename={() => setRenameInst(inst)}
                    onAssign={() => setAssignInst(inst)}
                    onDelete={() => setDeleteInst(inst)}
                    onSecurity={() => setSecurityInst(inst)}
                    onVolume={() => setVolumeInst(inst)}
                    onIcon={() => setIconInst(inst)}
                  />
                ))}
              </div>
            )}

            <AutomationWorkbench instances={instances} />

            <div className="section-row" style={{ marginTop: 22 }}>
              <span className="section-title">子账号</span>
              <button className="btn-text" onClick={() => setCreatingUser(true)}>
                + 新建子账号
              </button>
            </div>
            {subs.length === 0 ? (
              <EmptyState
                icon="👥"
                title="还没有子账号"
                sub="子账号是登录这套面板的身份，可按账号分配能访问哪些实例"
                action={
                  <button className="btn btn-primary" onClick={() => setCreatingUser(true)}>
                    ＋ 新建子账号
                  </button>
                }
              />
            ) : (
              <div className="inst-grid">
                {subs.map((u) => (
                  <div key={u.id} className="inst-card">
                    <div className="inst-head">
                      <span className="inst-name">{u.username}</span>
                      {u.disabled ? <span className="tag tag-off">已禁用</span> : <span className="tag tag-on">正常</span>}
                    </div>
                    <div className="inst-sub">{u.allowedInstances.length > 0 ? `可访问 ${u.allowedInstances.length} 个实例` : '未分配实例'}</div>
                    {u.allowedInstances.length > 0 && (
                      <div className="chip-row" style={{ marginTop: 8 }}>
                        {u.allowedInstances.map((id) => (
                          <span key={id} className="chip chip-static">
                            {instName(id)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="inst-admin-links">
                      <button className="btn-text" onClick={() => setAssignUser(u)}>
                        可访问实例
                      </button>
                      <button className="btn-text" onClick={() => toggle(u)}>
                        {u.disabled ? '启用' : '禁用'}
                      </button>
                      <button className="btn-text" onClick={() => setResetTarget(u)}>
                        重置密码
                      </button>
                      <button className="btn-text danger" onClick={() => removeUser(u)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {orphanConts.length > 0 && (
              <>
                <div className="section-row" style={{ marginTop: 22 }}>
                  <span className="section-title">残留容器</span>
                  <span className="muted small">不属于任何登记实例（多为创建失败遗留）；它们占着数据卷名，需先清理它们才能删除同名数据卷。</span>
                </div>
                <div className="inst-grid">
                  {orphanConts.map((c) => (
                    <div key={c.id} className="inst-card">
                      <div className="inst-head">
                        <span className="inst-name" style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.name}</span>
                        <span className="tag tag-off">{c.status || 'unknown'}</span>
                      </div>
                      {c.volumeName && (
                        <div className="inst-sub" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          占用卷：{c.volumeName}
                        </div>
                      )}
                      <div className="inst-admin-links">
                        <button className="btn-text danger" onClick={() => removeOrphanCont(c)}>
                          删除容器
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {orphanVols.length > 0 && (
              <>
                <div className="section-row" style={{ marginTop: 22 }}>
                  <span className="section-title">未使用的数据卷</span>
                  <span className="muted small">删除实例时未勾选「彻底清除」会保留下来；可在新建实例时复用以继承聊天记录。</span>
                </div>
                <div className="inst-grid">
                  {orphanVols.map((v) => (
                    <div key={v.name} className="inst-card">
                      <div className="inst-head">
                        <span className="inst-name" style={{ fontFamily: 'monospace', fontSize: 13 }}>{v.name}</span>
                      </div>
                      <div className="inst-sub">
                        {v.createdAt ? `创建于 ${v.createdAt.slice(0, 10)}` : '创建时间未知'}
                        {typeof v.sizeBytes === 'number' ? `　·　${(v.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ''}
                      </div>
                      <div className="inst-admin-links">
                        <button className="btn-text" onClick={() => setCreatingInst(true)} title="去「新建实例」对话框，在「数据卷」下拉里选择复用此卷">
                          复用为新实例
                        </button>
                        <button className="btn-text danger" onClick={() => removeOrphanVol(v.name)}>
                          彻底删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* 账号：所有人（含子账号）都能在此改密 */}
        <div className="section-row" style={{ marginTop: isAdmin ? 22 : 0 }}>
          <span className="section-title">账号</span>
        </div>
        <div className="inst-grid">
          <div className="inst-card">
            <div className="inst-head">
              <span className="inst-name">{user?.username}</span>
              {isAdmin ? <span className="tag">管理员</span> : <span className="tag tag-on">子账号</span>}
            </div>
            <div className="inst-sub">{isAdmin ? '可访问全部实例' : `可访问 ${user?.allowedInstances.length ?? 0} 个实例`}</div>
            <div className="inst-actions">
              <button className="btn btn-primary inst-act-wide" onClick={onChangePassword}>
                修改密码
              </button>
            </div>
          </div>
        </div>

        {isAdmin && <DiagnosticsSection />}
        <AboutSection isAdmin={isAdmin} />
      </main>

      {creatingUser && (
        <CreateUser
          instances={instances}
          onClose={() => setCreatingUser(false)}
          onDone={() => {
            setCreatingUser(false);
            load();
          }}
        />
      )}
      {creatingInst && (
        <CreateInstance
          subs={subs}
          onClose={() => setCreatingInst(false)}
          onDone={() => {
            setCreatingInst(false);
            load();
          }}
        />
      )}
      {assignInst && (
        <AssignUsers
          inst={assignInst}
          subs={subs}
          onClose={() => setAssignInst(null)}
          onDone={() => {
            setAssignInst(null);
            load();
          }}
        />
      )}
      {assignUser && (
        <AssignInstances
          user={assignUser}
          instances={instances}
          onClose={() => setAssignUser(null)}
          onDone={() => {
            setAssignUser(null);
            load();
          }}
        />
      )}
      {resetTarget && (
        <ResetPassword
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => {
            setResetTarget(null);
            toast('密码已重置', 'ok');
          }}
        />
      )}
      {deleteInst && (
        <DeleteInstance
          inst={deleteInst}
          onClose={() => setDeleteInst(null)}
          onDone={() => {
            setDeleteInst(null);
            toast('实例已删除', 'ok');
            load();
          }}
        />
      )}
      {renameInst && (
        <RenameInstance
          inst={renameInst}
          onClose={() => setRenameInst(null)}
          onDone={() => {
            setRenameInst(null);
            toast('已重命名', 'ok');
            load();
          }}
        />
      )}
      {securityInst && (
        <InstanceSecurity
          inst={securityInst}
          onClose={() => setSecurityInst(null)}
          onDone={() => {
            toast('已保存安全阈值', 'ok');
            load();
          }}
        />
      )}
      {volumeInst && (
        <VolumeManager inst={volumeInst} onClose={() => setVolumeInst(null)} onChanged={load} />
      )}
      {iconInst && (
        <InstanceIconEditor
          inst={iconInst}
          onClose={() => setIconInst(null)}
          onDone={() => {
            toast('已更新图标', 'ok');
            load();
          }}
        />
      )}
    </div>
  );
}

function RenameInstance({ inst, onClose, onDone }: { inst: InstanceWithStatus; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(inst.name);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.renameInstance(inst.id, name.trim());
      onDone();
    } catch (e: any) {
      setErr(e.message || '重命名失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-mask" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>重命名实例</h2>
        <input className="input" placeholder="实例名称" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy || !name.trim() || name.trim() === inst.name}>
            保存
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPassword({ user, onClose, onDone }: { user: PanelUser; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && pw !== confirm;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pw !== confirm) {
      setErr('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    try {
      await api.resetUser(user.id, pw);
      onDone();
    } catch (e: any) {
      setErr(e.message || '重置失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-mask" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>重置「{user.username}」的密码</h2>
        <PasswordInput placeholder="新密码（至少 6 位）" autoComplete="new-password" value={pw} onChange={setPw} />
        <PasswordInput placeholder="再次输入新密码" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        {(mismatch || err) && <div className="error">{mismatch ? '两次输入的新密码不一致' : err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy || pw.length < 6 || pw !== confirm}>
            重置
          </button>
        </div>
      </form>
    </div>
  );
}

// 「安全」弹窗：编辑某实例的内存安全阀（soft / hard）。
// soft：超过且无人在远程会话时主动重启（柔和自愈，不打扰）
// hard：超过即强制重启（无视会话，防止 OOM）
// 留空 = 使用面板全局默认（来自 env）。
function InstanceSecurity({ inst, onClose, onDone }: { inst: InstanceWithStatus; onClose: () => void; onDone: () => void }) {
  const { toast, confirm } = useUI();
  const [data, setData] = useState<import('../api').MemLimits | null>(null);
  // 输入字段：空串 = "使用默认"（→ 提交时映射为 null）
  const [softStr, setSoftStr] = useState('');
  const [hardStr, setHardStr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  const regenMachineId = async () => {
    const ok = await confirm({
      title: '重置该实例的设备 ID？',
      body: '会生成一个全新的设备标识（machine-id）并重启实例，相当于"换一台新设备"。微信需要重新扫码登录。适用于该账号被微信判定设备风险、登录即被强制退出的情况。',
      danger: true,
      confirmText: '重置并重启',
    });
    if (!ok) return;
    setRegenBusy(true);
    try {
      await api.regenMachineId(inst.id);
      toast('已重置设备 ID，实例正在重启，请稍后重新扫码登录', 'ok');
      onClose();
      onDone();
    } catch (e: any) {
      toast(e.message || '重置失败', 'error');
    } finally {
      setRegenBusy(false);
    }
  };

  // 首次加载 + 每 5s 刷新 currentMB（运行实例的实时内存）
  useEffect(() => {
    let alive = true;
    const fetchOnce = async (initial: boolean) => {
      try {
        const d = await api.getInstanceMemLimits(inst.id);
        if (!alive) return;
        setData(d);
        if (initial) {
          setSoftStr(d.soft == null ? '' : String(d.soft));
          setHardStr(d.hard == null ? '' : String(d.hard));
          setLoaded(true);
        }
      } catch (e: any) {
        if (alive && initial) {
          setErr(e?.message || '读取失败');
          setLoaded(true);
        }
      }
    };
    fetchOnce(true);
    const t = window.setInterval(() => fetchOnce(false), 5000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [inst.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const parse = (s: string): number | null => {
      const t = s.trim();
      if (t === '') return null;
      const n = Number(t);
      if (!Number.isInteger(n)) throw new Error('阈值需为整数（MiB）');
      return n;
    };
    let s: number | null;
    let h: number | null;
    try {
      s = parse(softStr);
      h = parse(hardStr);
    } catch (e: any) {
      setErr(e.message);
      return;
    }
    if (s != null && h != null && s >= h) {
      setErr('soft 阈值需小于 hard 阈值');
      return;
    }
    setBusy(true);
    try {
      await api.setInstanceMemLimits(inst.id, s, h);
      onDone();
      onClose();
    } catch (e: any) {
      setErr(e.message || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const resetToDefault = () => {
    setSoftStr('');
    setHardStr('');
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ maxWidth: 460 }}>
        <h2>安全 · {inst.name}</h2>
        {!loaded ? (
          <div className="muted small" style={{ padding: '14px 0' }}>读取中…</div>
        ) : !data ? (
          <div className="error">{err || '读取失败'}</div>
        ) : (
          <>
            <div className="muted small" style={{ lineHeight: 1.6 }}>
              当 KasmVNC/Xvnc 长跑泄漏内存时，面板的 watchdog 会自动重启实例。两档阈值（单位 MiB）：
              <br />
              <b>soft</b>：超过且<b>无人在远程会话</b>时柔和重启（不打扰使用者）。
              <br />
              <b>hard</b>：超过即<b>强制重启</b>，无视会话，防止 OOM 拖垮宿主。
            </div>

            <div className="security-status">
              <div className="security-row">
                <span>当前内存</span>
                <b>{data.currentMB > 0 ? `${data.currentMB} MiB` : '—'}</b>
              </div>
              <div className="security-row">
                <span>面板默认</span>
                <span className="muted">soft {data.defaultSoft} · hard {data.defaultHard}</span>
              </div>
              <div className="security-row">
                <span>巡检间隔</span>
                <span className="muted">
                  {data.watchdogEnabled ? `每 ${data.intervalSec}s` : 'watchdog 已关闭'}
                </span>
              </div>
            </div>

            <div className="field-label" style={{ marginTop: 12 }}>soft 阈值（留空 = 用默认 {data.defaultSoft}）</div>
            <input
              className="input"
              inputMode="numeric"
              placeholder={`${data.defaultSoft}`}
              value={softStr}
              onChange={(e) => setSoftStr(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <div className="field-label" style={{ marginTop: 8 }}>hard 阈值（留空 = 用默认 {data.defaultHard}）</div>
            <input
              className="input"
              inputMode="numeric"
              placeholder={`${data.defaultHard}`}
              value={hardStr}
              onChange={(e) => setHardStr(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <div className="muted small" style={{ marginTop: 6 }}>
              提示：日常活跃内存约 1500 MiB；soft 建议略高于此（如 2000），hard 建议远低于宿主可用内存（如 3000~4000）。
            </div>

            <div className="field-label" style={{ marginTop: 16 }}>设备身份（machine-id）</div>
            <div className="muted small" style={{ lineHeight: 1.6 }}>
              微信会用设备标识做风控。若该账号被判定<b>设备风险</b>、登录后被强制退出且反复循环，
              可重置为一个全新的唯一设备 ID（相当于换台新设备），再重新扫码登录。会重启该实例。
            </div>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
              onClick={regenMachineId}
              disabled={regenBusy || busy}
            >
              {regenBusy ? '重置中…' : '↻ 重置设备 ID 并重启'}
            </button>

            {err && <div className="error">{err}</div>}
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-text" onClick={resetToDefault} disabled={busy}>
            ↺ 恢复默认
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy || !loaded || !data}>
            保存
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteInstance({ inst, onClose, onDone }: { inst: InstanceWithStatus; onClose: () => void; onDone: () => void }) {
  const [purge, setPurge] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await api.deleteInstance(inst.id, purge);
      onDone();
    } catch (e: any) {
      setErr(e.message || '删除失败');
      setBusy(false);
    }
  };
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <h2>删除实例「{inst.name}」？</h2>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
          容器会被移除。默认保留聊天记录（数据卷），之后可重建同名实例恢复。
        </div>
        <label className={'purge-opt' + (purge ? ' on' : '')} onClick={() => setPurge((v) => !v)}>
          <span className="purge-check">{purge ? '✓' : ''}</span>
          <span>
            同时永久删除聊天记录（数据卷）
            <span className="muted small" style={{ display: 'block' }}>不可恢复，请谨慎勾选</span>
          </span>
        </label>
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={submit}>
            {purge ? '连数据一起删除' : '删除实例'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 管理页的实例卡片：含微信版本管理（下载/更新）+ 重命名/分配/删除
function InstanceAdminCard({
  inst,
  userCount,
  acting,
  onEnter,
  onTrigger,
  onStart,
  onStop,
  onRestart,
  onUpgrade,
  onRename,
  onAssign,
  onDelete,
  onSecurity,
  onVolume,
  onIcon,
}: {
  inst: InstanceWithStatus;
  userCount: number;
  acting?: string;
  onEnter: () => void;
  onTrigger: (inst: InstanceWithStatus, kind: 'install' | 'update') => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onUpgrade: () => void;
  onRename: () => void;
  onAssign: () => void;
  onDelete: () => void;
  onSecurity: () => void;
  onVolume: () => void;
  onIcon: () => void;
}) {
  const wx = inst.wechat;
  const busy = BUSY_PHASES.includes(wx.phase);
  const installed = wx.installed && wx.phase !== 'downloading';
  const offline = inst.runtime !== 'running';
  const working = !!acting || busy; // 生命周期操作中 或 微信下载/更新中 → 锁住卡片
  const [menuOpen, setMenuOpen] = useState(false); // 「管理」菜单是否展开（悬浮层，不占文档流）
  const menuRef = useRef<HTMLDivElement>(null);
  // 悬浮下拉：点击菜单外部时关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [menuOpen]);

  const profile = appProfile(inst.appType);

  let badge: { text: string; cls: string };
  if (acting) badge = { text: '处理中', cls: 'tag-busy' };
  else if (offline) badge = { text: inst.runtime === 'missing' ? '未创建' : '已停止', cls: 'tag-off' };
  else if (busy) badge = { text: '处理中', cls: 'tag-busy' };
  else if (installed) badge = { text: '在线', cls: 'tag-on' };
  else badge = { text: '待安装', cls: 'tag-warn' };

  let sub: string;
  if (acting) sub = acting;
  else if (busy) sub = wx.percent >= 0 ? `${wx.message || '处理中'} ${wx.percent}%` : wx.message || '请稍候…';
  else if (wx.phase === 'error') sub = wx.message || '操作失败，可重试';
  else if (offline) sub = inst.runtime === 'missing' ? '容器尚未创建' : '容器已停止';
  else if (installed) sub = wx.version ? `${profile.label} ${wx.version}` : `${profile.label}已就绪`;
  else sub = `${profile.label}尚未安装`;

  return (
    <div className={'inst-card' + (menuOpen ? ' open-menu' : '')}>
      <div className="inst-head">
        <span className="inst-name">{inst.name}</span>
        <span className={'tag ' + badge.cls}>{badge.text}</span>
      </div>
      <div className="inst-sub">
        {sub}
        {!acting && ` · 可访问 ${userCount} 人`}
      </div>

      {working && (
        <div className="wx-progress">
          <div
            className={'wx-progress-bar' + (acting || wx.percent < 0 ? ' indeterminate' : '')}
            style={!acting && wx.percent >= 0 ? { width: `${wx.percent}%` } : undefined}
          />
        </div>
      )}

      {/* 进行中（升级/重启/停止/下载）时隐藏所有操作，避免重复点击 */}
      {!working && (
        <>
          <div className="inst-actions">
            {offline ? (
              <button className="btn btn-primary inst-act-wide" onClick={onStart}>
                {inst.runtime === 'missing' ? '创建并启动' : '启动实例'}
              </button>
            ) : (
              <button className="btn btn-primary inst-act-wide" disabled={!installed} onClick={onEnter} title={installed ? '' : '需先下载安装' + profile.label}>
                进入实例
              </button>
            )}
          </div>

          <div className="inst-menu-wrap" ref={menuRef}>
            <button className={'inst-menu-toggle' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen((v) => !v)}>
              <span>管理</span>
              <span className="inst-menu-caret">{CaretIcon}</span>
            </button>

            {menuOpen && (
              <div className="inst-menu" onClick={() => setMenuOpen(false)}>
              <div className="inst-menu-group">
                <div className="inst-menu-label">运维</div>
                <div className="inst-menu-items">
                  {!offline && profile.needsInstall && (
                    <button className="btn-text" onClick={() => onTrigger(inst, installed ? 'update' : 'install')}>
                      {installed ? profile.updateLabel : '下载安装'}
                    </button>
                  )}
                  <button className="btn-text" onClick={onUpgrade} title="拉取最新镜像并重建（保留聊天记录）">
                    升级实例
                  </button>
                  {!offline && (
                    <button className="btn-text" onClick={onRestart}>
                      重启
                    </button>
                  )}
                  {!offline && (
                    <button className="btn-text" onClick={onStop}>
                      停止
                    </button>
                  )}
                </div>
              </div>
              <div className="inst-menu-group">
                <div className="inst-menu-label">设置</div>
                <div className="inst-menu-items">
                  <button className="btn-text" onClick={onRename}>
                    重命名
                  </button>
                  <button className="btn-text" onClick={onAssign}>
                    分配账户
                  </button>
                  <button className="btn-text" onClick={() => window.open(api.instanceLogsUrl(inst.id), '_blank')} title="查看实例日志（含历史：重启原因 + 上一容器日志快照，跨重启保留）">
                    日志
                  </button>
                  <button className="btn-text" onClick={onSecurity} title="内存阈值自愈">
                    安全
                  </button>
                  <button className="btn-text" onClick={onIcon} title="设置实例图标：内置图标 / 上传图片裁剪">
                    图标
                  </button>
                  <button className="btn-text" onClick={onVolume} title="数据卷：备份/恢复、上传 PC 微信数据、文件管理">
                    数据卷
                  </button>
                </div>
              </div>
              <div className="inst-menu-group inst-menu-danger">
                <div className="inst-menu-items">
                  <button className="btn-text danger" onClick={onDelete}>
                    删除实例
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// 把裁剪区域画到 128px 画布并导出 PNG dataURL（存进 inst.icon）
async function cropToDataUrl(src: string, area: { x: number; y: number; width: number; height: number }): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const SIZE = 128;
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  c.getContext('2d')!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, SIZE, SIZE);
  return c.toDataURL('image/png');
}

// 实例图标编辑：选内置图标 / 上传图片裁剪 / 恢复默认。
function InstanceIconEditor({ inst, onClose, onDone }: { inst: InstanceWithStatus; onClose: () => void; onDone: () => void }) {
  const { toast } = useUI();
  const [sel, setSel] = useState<string>(inst.icon || ''); // '' = 按应用默认
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState(''); // 非空 = 裁剪态
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('请选择图片文件', 'error');
    if (f.size > 8 * 1024 * 1024) return toast('图片过大（>8MB）', 'error');
    const r = new FileReader();
    r.onload = () => {
      setCropSrc(String(r.result));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    r.readAsDataURL(f);
  };

  const confirmCrop = async () => {
    if (!cropSrc || !area) return;
    try {
      setSel(await cropToDataUrl(cropSrc, area));
      setCropSrc('');
    } catch {
      toast('裁剪失败', 'error');
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.setInstanceIcon(inst.id, sel || null);
      onDone();
      onClose();
    } catch (e: any) {
      toast(e?.message || '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>图标 · {inst.name}</h2>
        {cropSrc ? (
          <>
            <div className="icon-crop">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, a) => setArea(a)}
              />
            </div>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setCropSrc('')}>返回</button>
              <button type="button" className="btn btn-primary" onClick={confirmCrop}>裁剪并使用</button>
            </div>
          </>
        ) : (
          <>
            <div className="icon-edit-top">
              <InstanceIcon icon={sel || undefined} appType={inst.appType} size={56} radius={14} />
              <div className="muted small">预览（{sel.startsWith('data:') ? '自定义图片' : sel.startsWith('builtin:') ? '内置图标' : '按应用默认'}）</div>
            </div>
            <div className="field-label">内置图标</div>
            <div className="icon-grid">
              <button type="button" className={'icon-pick' + (sel === '' ? ' sel' : '')} onClick={() => setSel('')}>
                <InstanceIcon appType={inst.appType} size={38} radius={11} />
                <span>默认</span>
              </button>
              {ICON_CHOICES.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  className={'icon-pick' + (sel === `builtin:${c.key}` ? ' sel' : '')}
                  onClick={() => setSel(`builtin:${c.key}`)}
                >
                  <InstanceIcon icon={`builtin:${c.key}`} size={38} radius={11} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>上传图片并裁剪…</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>取消</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>保存</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 数据卷管理（仅管理员）：整卷备份/恢复 + 文件浏览器（浏览/上传/解压/下载/改名/移动/删除）。
// 主要场景：把 PC 微信数据迁移上来、跨实例迁移、离线备份。全程在「运行中」的实例上操作
// （浏览/改名/删除靠 docker exec，需容器运行）。整卷恢复会覆盖全部数据，强提示并建议恢复后重启实例。
function VolumeManager({ inst, onClose, onChanged }: { inst: InstanceWithStatus; onClose: () => void; onChanged: () => void }) {
  const { toast, confirm } = useUI();
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<VolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(''); // 进行中操作文案；非空即禁用界面
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const extractRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const offline = inst.runtime !== 'running'; // 文件浏览需实例运行中

  const join = (a: string, b: string) => (a ? a + '/' + b : b);

  const load = async (p = path) => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.volumeList(inst.id, p);
      setEntries(r.entries);
      setPath(r.path);
    } catch (e: any) {
      setErr(e?.message || '读取失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (offline) {
      setLoading(false);
      return;
    }
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst.id]);

  const sorted = [...entries].sort((a, b) => {
    if ((a.type === 'dir') !== (b.type === 'dir')) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh');
  });
  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const segs = path ? path.split('/') : [];

  const run = async (label: string, fn: () => Promise<any>, okMsg?: string, skipReload = false) => {
    setBusy(label);
    try {
      await fn();
      if (okMsg) toast(okMsg, 'ok');
      if (!skipReload) await load();
    } catch (e: any) {
      toast(e?.message || '操作失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const doMkdir = async () => {
    const name = mkdirName.trim();
    if (!name) return;
    await run('新建中…', () => api.volumeMkdir(inst.id, join(path, name)), '已新建文件夹');
    setMkdirName('');
    setMkdirOpen(false);
  };

  const doRename = async (oldName: string) => {
    const nv = renameVal.trim();
    setRenaming(null);
    if (!nv || nv === oldName) return;
    // 含 / → 视为相对 /config 的目标路径（移动到子目录）；否则同目录改名
    const to = nv.includes('/') ? nv.replace(/^\/+/, '') : join(path, nv);
    await run('处理中…', () => api.volumeMove(inst.id, join(path, oldName), to), '已重命名 / 移动');
  };

  const doDelete = async (en: VolEntry) => {
    const ok = await confirm({
      title: `删除「${en.name}」？`,
      body: en.type === 'dir' ? '将递归删除该文件夹下所有内容，不可恢复。' : '删除后不可恢复。',
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    await run('删除中…', () => api.volumeDelete(inst.id, join(path, en.name)), '已删除');
  };

  const onPick = (kind: 'upload' | 'extract' | 'restore') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (kind === 'restore') {
      const ok = await confirm({
        title: '恢复整卷备份？',
        body: `将用「${file.name}」覆盖该实例 /config 的全部数据（含登录态、聊天库），不可撤销。建议仅用于本系统导出的备份；恢复后请在卡片上「重启」实例以加载数据。`,
        danger: true,
        confirmText: '覆盖恢复',
      });
      if (!ok) return;
      await run(`恢复 ${file.name}…`, () => api.volumeRestore(inst.id, file), '恢复完成，请重启实例以加载数据', true);
      onChanged();
      return;
    }
    if (kind === 'upload') await run(`上传 ${file.name}…`, () => api.volumeUpload(inst.id, path, file), '上传完成');
    else await run(`解压 ${file.name}…`, () => api.volumeExtract(inst.id, path, file), '解压完成');
  };

  const disabled = !!busy;
  const icon = (en: VolEntry) => (en.type === 'dir' ? FolderIcon : FileIcon);

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="card modal vol-modal" onClick={(e) => e.stopPropagation()}>
        <h2>数据卷 · {inst.name}</h2>

        {/* 整卷备份 / 恢复（运行/停止均可用） */}
        <div className="vol-sec">
          <div className="vol-section-label">整卷备份 / 恢复</div>
          <div className="vol-topbar">
            <a className="btn" href={api.volumeBackupUrl(inst.id)} target="_blank" rel="noreferrer">下载整卷备份</a>
            <button className="btn" disabled={disabled} onClick={() => restoreRef.current?.click()}>恢复备份…</button>
            <input ref={restoreRef} type="file" accept=".gz,.tgz,.tar" hidden onChange={onPick('restore')} />
          </div>
          <div className="vol-hint">整卷含聊天记录，用于跨实例迁移 / 离线备份。</div>
        </div>

        {offline ? (
          <div className="vol-warn">
            实例未运行，文件浏览不可用。可执行上方的整卷备份 / 恢复；要浏览或上传单个文件，请先在卡片上启动实例。
          </div>
        ) : (
          <div className="vol-sec">
            <div className="vol-section-label">文件浏览</div>
            {/* 面包屑 */}
            <div className="vol-crumbs">
              <button className="vol-crumb" disabled={disabled} onClick={() => load('')}>/config</button>
              {segs.map((s, i) => (
                <span key={i}>
                  <span className="vol-sep">/</span>
                  <button className="vol-crumb" disabled={disabled} onClick={() => load(segs.slice(0, i + 1).join('/'))}>
                    {s}
                  </button>
                </span>
              ))}
            </div>

            {/* 工具条 */}
            <div className="vol-tools">
              <button className="btn-text" disabled={disabled} onClick={() => uploadRef.current?.click()}>上传文件</button>
              <button className="btn-text" disabled={disabled} onClick={() => extractRef.current?.click()}>上传并解压</button>
              <button className="btn-text" disabled={disabled} onClick={() => setMkdirOpen((v) => !v)}>新建文件夹</button>
              <button className="btn-text" disabled={disabled} onClick={() => load()}>刷新</button>
              <input ref={uploadRef} type="file" hidden onChange={onPick('upload')} />
              <input ref={extractRef} type="file" accept=".gz,.tgz,.tar" hidden onChange={onPick('extract')} />
            </div>
            {mkdirOpen && (
              <div className="vol-mkdir">
                <input
                  className="input"
                  placeholder="文件夹名"
                  value={mkdirName}
                  autoFocus
                  onChange={(e) => setMkdirName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doMkdir()}
                />
                <button className="btn btn-primary" disabled={disabled || !mkdirName.trim()} onClick={doMkdir}>创建</button>
              </div>
            )}

            {busy && <div className="vol-busy">{busy}</div>}

            {/* 文件列表 */}
            <div className="vol-list">
              {loading ? (
                <div className="muted small" style={{ padding: 16 }}>读取中…</div>
              ) : err ? (
                <div className="error">{err}</div>
              ) : sorted.length === 0 ? (
                <div className="muted small" style={{ padding: 16 }}>{path ? '空目录' : '（无内容）'}</div>
              ) : (
                <>
                  {path && (
                    <button className="vol-row vol-main vol-up" disabled={disabled} onClick={() => load(parent)}>
                      <span className="vol-ic">{FolderIcon}</span>
                      <span className="vol-nm">返回上一级</span>
                    </button>
                  )}
                  {sorted.map((en) => (
                    <div className="vol-row" key={en.name}>
                      {renaming === en.name ? (
                        <input
                          className="input vol-rename"
                          autoFocus
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') doRename(en.name);
                            if (e.key === 'Escape') setRenaming(null);
                          }}
                          onBlur={() => doRename(en.name)}
                        />
                      ) : (
                        <button
                          className="vol-main"
                          disabled={disabled}
                          onClick={() => (en.type === 'dir' ? load(join(path, en.name)) : undefined)}
                          style={{ cursor: en.type === 'dir' ? 'pointer' : 'default' }}
                        >
                          <span className={'vol-ic' + (en.type === 'dir' ? ' dir' : '')}>{icon(en)}</span>
                          <span className="vol-nm">{en.name}</span>
                          <span className="vol-meta">
                            {en.type === 'dir' ? '' : fmtBytes(en.size)}
                            {en.mtime ? ` · ${fmtDate(en.mtime)}` : ''}
                          </span>
                        </button>
                      )}
                      <div className="vol-acts">
                        {en.type === 'file' && (
                          <a
                            className="vol-act"
                            title="下载"
                            href={api.volumeDownloadUrl(inst.id, join(path, en.name))}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {DownloadIcon}
                          </a>
                        )}
                        <button
                          className="vol-act"
                          title="重命名 / 移动"
                          disabled={disabled}
                          onClick={() => {
                            setRenameVal(en.name);
                            setRenaming(en.name);
                          }}
                        >
                          {EditIcon}
                        </button>
                        <button className="vol-act danger" title="删除" disabled={disabled} onClick={() => doDelete(en)}>
                          {TrashIcon}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        <div className="muted small" style={{ marginTop: 10, lineHeight: 1.6 }}>
          PC 微信数据迁移：把数据文件夹打包成 <b>.tar.gz</b>，用「上传并解压」放到对应目录；改动微信正在使用的数据后，重启实例方可生效。能否解密取决于微信版本与设备绑定，请自行测试。
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

// 通用 chip 多选
function ChipMultiSelect({
  options,
  selected,
  onToggle,
  empty,
}: {
  options: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  empty: string;
}) {
  if (options.length === 0) return <div className="muted small">{empty}</div>;
  return (
    <div className="chip-row chip-row-pick">
      {options.map((o) => (
        <button
          type="button"
          key={o.id}
          className={'chip chip-toggle' + (selected.has(o.id) ? ' on' : '')}
          onClick={() => onToggle(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CreateUser({ instances, onClose, onDone }: { instances: InstanceWithStatus[]; onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.createUser(username.trim(), password, [...sel]);
      onDone();
    } catch (e: any) {
      setErr(e.message || '创建失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>新建子账号</h2>
        <input
          className="input"
          placeholder="用户名（3-20 位字母/数字/下划线）"
          autoCapitalize="off"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <PasswordInput placeholder="初始密码（至少 6 位）" autoComplete="new-password" value={password} onChange={setPassword} />
        <div className="field-label">可访问的微信实例</div>
        <ChipMultiSelect
          options={instances.map((i) => ({ id: i.id, label: i.name }))}
          selected={sel}
          onToggle={(id) => setSel((s) => toggleSet(s, id))}
          empty="暂无实例，可稍后在账户里分配"
        />
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy || !username || !password}>
            创建
          </button>
        </div>
      </form>
    </div>
  );
}

// 可创建的应用类型。ready=false 的暂时禁用（即将支持）。Telegram（仅 x86_64）与其它应用暂缓。
const APP_OPTIONS: { type: AppType; desc: string; ready: boolean }[] = [
  { type: 'wechat', desc: '默认', ready: true },
  { type: 'chromium', desc: '浏览器', ready: true },
  { type: 'custom', desc: '即将支持', ready: false },
];

function CreateInstance({ subs, onClose, onDone }: { subs: PanelUser[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [appType, setAppType] = useState<AppType>('wechat');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // 未使用的旧数据卷（之前删除实例但未勾选「彻底清除」时保留下来的），允许在此复用以继承聊天记录。
  const [orphans, setOrphans] = useState<{ name: string; createdAt?: string }[]>([]);
  const [reuse, setReuse] = useState<string>(''); // '' = 不复用，新建空卷

  useEffect(() => {
    let alive = true;
    api
      .listOrphanVolumes()
      .then(({ volumes }) => alive && setOrphans(volumes))
      .catch(() => {
        /* 读取失败时不阻塞创建：列表为空即可，照常新建空卷 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.createInstance(name.trim(), [...sel], reuse || undefined, appType);
      onDone();
    } catch (e: any) {
      setErr(e.message || '创建失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>新建实例</h2>
        <div className="field-label">应用类型</div>
        <div className="app-picker">
          {APP_OPTIONS.map((o) => (
            <button
              key={o.type}
              type="button"
              className={'app-pick' + (appType === o.type ? ' sel' : '')}
              disabled={!o.ready}
              title={o.ready ? '' : '即将支持'}
              onClick={() => o.ready && setAppType(o.type)}
            >
              <span className="app-pick-name">{APP_LABELS[o.type]}</span>
              <span className="app-pick-desc">{o.desc}</span>
            </button>
          ))}
        </div>
        <input className="input" placeholder="实例名称（留空自动命名）" value={name} onChange={(e) => setName(e.target.value)} />
        {appType === 'chromium' && (
          <div className="muted small">Chromium 浏览器随镜像就绪，创建后直接「进入实例」即可（无需下载安装）。</div>
        )}
        <div className="field-label">允许访问的子账号（管理员默认可访问全部）</div>
        <ChipMultiSelect
          options={subs.map((u) => ({ id: u.id, label: u.username }))}
          selected={sel}
          onToggle={(id) => setSel((s) => toggleSet(s, id))}
          empty="暂无子账号"
        />
        {orphans.length > 0 && (
          <>
            <div className="field-label" style={{ marginTop: 12 }}>数据卷（可选）</div>
            <select className="input" value={reuse} onChange={(e) => setReuse(e.target.value)}>
              <option value="">新建空卷（全新登录）</option>
              {orphans.map((v) => (
                <option key={v.name} value={v.name}>
                  复用 · {v.name}
                  {v.createdAt ? `（${v.createdAt.slice(0, 10)} 创建）` : ''}
                </option>
              ))}
            </select>
            <div className="muted small" style={{ marginTop: 4 }}>
              复用旧卷需**用原微信号扫码登录**才能解密历史消息；用别的号登录将看不到旧记录。
            </div>
          </>
        )}
        {err && <div className="error">{err}</div>}
        <div className="muted small" style={{ marginTop: 4 }}>
          创建后拉起一个新的 {APP_LABELS[appType]} 容器；进入实例后点「下载并安装」，再登录即可。
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>
            创建
          </button>
        </div>
      </form>
    </div>
  );
}

function AssignUsers({
  inst,
  subs,
  onClose,
  onDone,
}: {
  inst: InstanceWithStatus;
  subs: PanelUser[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(subs.filter((u) => u.allowedInstances.includes(inst.id)).map((u) => u.id)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.setInstanceUsers(inst.id, [...sel]);
      onDone();
    } catch (e: any) {
      setErr(e.message || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>「{inst.name}」可访问账户</h2>
        <ChipMultiSelect
          options={subs.map((u) => ({ id: u.id, label: u.username }))}
          selected={sel}
          onToggle={(id) => setSel((s) => toggleSet(s, id))}
          empty="暂无子账号"
        />
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignInstances({
  user,
  instances,
  onClose,
  onDone,
}: {
  user: PanelUser;
  instances: InstanceWithStatus[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(user.allowedInstances));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.setUserInstances(user.id, [...sel]);
      onDone();
    } catch (e: any) {
      setErr(e.message || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>{user.username} 可访问实例</h2>
        <ChipMultiSelect
          options={instances.map((i) => ({ id: i.id, label: i.name }))}
          selected={sel}
          onToggle={(id) => setSel((s) => toggleSet(s, id))}
          empty="暂无实例"
        />
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function toggleSet(s: Set<string>, id: string): Set<string> {
  const next = new Set(s);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
