import { ICONS, IDEAL_SOLUTIONS, ITEM_ICON, PALETTE, QUESTION_SPEC, QUESTIONS } from './sds-data.js';
import {
  EDGE_PROTOCOLS,
  EDGE_SERIALIZERS,
  cfgOf,
  runValidation,
  scoreArchitecture,
  specFor,
} from './sds-knowledge.js';

const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const money = (value) => value >= 1000 ? `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : `$${Math.round(value)}`;
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const categoryColor = Object.fromEntries(PALETTE.map((group) => [group.cat, group.color]));

const STORAGE_KEYS = {
  user: 'sds.currentUser',
  sessions: 'sds.sessions',
  token: 'sds.apiToken',
};

export const DEFAULT_PERMISSIONS = {
  allowCandidateEdit: true,
  diagnosticsDuringInterview: true,
  showHealthToCandidate: false,
  allowFailureInjection: true,
  aiHintsInterviewerOnly: true,
  candidateCanViewQuestion: true,
  panelCanViewReview: true,
};

const ROLE_LABELS = {
  interviewer: 'Interviewer',
  candidate: 'Candidate',
  panel: 'Panel',
};

const DEFAULT_LOGIN = { name: '', email: '' };

const runtimeConfig = typeof window !== 'undefined' ? (window.SDS_CONFIG || {}) : {};

class ApiClient {
  constructor({ baseUrl = runtimeConfig.apiBaseUrl || '', storage = null } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.storage = storage;
  }

  token() {
    try {
      return this.storage?.getItem(STORAGE_KEYS.token) || '';
    } catch {
      return '';
    }
  }

  setToken(token) {
    try {
      if (token) this.storage?.setItem(STORAGE_KEYS.token, token);
      else this.storage?.removeItem(STORAGE_KEYS.token);
    } catch {
      // Storage can be blocked by browser policy.
    }
  }

  async request(path, { method = 'GET', body, token = this.token() } = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      const error = new Error('API is not reachable. Configure runtime-config.js with the deployed API URL.');
      error.status = response.status;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed with ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  signup(body) {
    return this.request('/api/auth/signup', { method: 'POST', body, token: '' });
  }

  login(body) {
    return this.request('/api/auth/login', { method: 'POST', body, token: '' });
  }

  me() {
    return this.request('/api/me');
  }

  interviews() {
    return this.request('/api/interviews');
  }

  createInterview(body) {
    return this.request('/api/interviews', { method: 'POST', body });
  }

  shareInterview(id) {
    return this.request(`/api/interviews/${encodeURIComponent(id)}/share`, { method: 'POST' });
  }

  updateInterview(id, body) {
    return this.request(`/api/interviews/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  }

  share(token) {
    return this.request(`/api/share/${encodeURIComponent(token)}`, { token: '' });
  }

  updateSharedInterview(token, body) {
    return this.request(`/api/share/${encodeURIComponent(token)}`, { method: 'PATCH', body, token: '' });
  }
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function questionById(questionId) {
  return QUESTIONS.find((question) => question.id === questionId) || QUESTIONS[0];
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function firstName(nameOrEmail) {
  const value = String(nameOrEmail || '').trim();
  if (!value) return 'there';
  return value.split(/\s|@/)[0] || value;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'session';
}

function shortId(prefix = 'sds') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function customPromptText(draft) {
  return String(draft?.customPrompt || '').trim();
}

function isCustomDraft(draft) {
  return draft?.questionMode === 'custom' && customPromptText(draft).length > 0;
}

function titleFromPrompt(prompt, fallback = 'Custom interview') {
  const firstLine = String(prompt || '').split('\n').map((line) => line.trim()).find(Boolean) || fallback;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function normalizeUser(user) {
  if (!user) return null;
  const email = normalizeEmail(user.email);
  const name = String(user.name || email || '').trim();
  if (!name && !email) return null;
  return { name: name || email, email };
}

function normalizeSession(session) {
  if (!session) return null;
  const question = questionById(session.questionId);
  return {
    id: session.id || shortId('session'),
    title: session.title || question.title,
    questionId: session.questionId || question.id,
    prompt: session.prompt || QUESTION_SPEC[question.id]?.statement || question.tagline,
    owner: normalizeUser(session.owner) || { name: 'Interviewer', email: '' },
    candidate: {
      name: String(session.candidate?.name || 'Candidate').trim(),
      email: normalizeEmail(session.candidate?.email),
    },
    difficulty: session.difficulty || question.diff,
    duration: Number(session.duration || question.dur),
    status: session.status || 'draft',
    permissions: { ...DEFAULT_PERMISSIONS, ...(session.permissions || {}) },
    architecture: session.architecture || { comps: [], edges: [], comments: [] },
    scores: session.scores || {},
    review: session.review || {},
    updatedAt: session.updatedAt || new Date().toISOString(),
    createdAt: session.createdAt || session.updatedAt || new Date().toISOString(),
  };
}

function readStorage(storage, key, fallback) {
  if (!storage) return fallback;
  try {
    return safeJsonParse(storage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function writeStorage(storage, key, value) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in strict/private browser contexts.
  }
}

export function createDefaultDraft(user = null, questionId = 'twitter') {
  const question = questionById(questionId);
  return {
    questionId: question.id,
    questionMode: 'preset',
    customPrompt: '',
    candidateName: '',
    candidateEmail: '',
    difficulty: question.diff,
    duration: question.dur,
    permissions: { ...DEFAULT_PERMISSIONS },
    ownerEmail: normalizeEmail(user?.email),
  };
}

export function createSessionFromDraft({ user, draft, questionId = draft?.questionId || 'twitter' }) {
  const question = questionById(questionId);
  const spec = QUESTION_SPEC[question.id] || QUESTION_SPEC.twitter;
  const now = new Date().toISOString();
  const candidateName = String(draft?.candidateName || '').trim() || 'Candidate';
  const customPrompt = customPromptText(draft);
  const custom = isCustomDraft(draft);
  return normalizeSession({
    id: draft?.sessionId || shortId(slugify(`${question.id}-${candidateName}`)),
    title: custom
      ? titleFromPrompt(customPrompt)
      : question.title,
    questionId: question.id,
    prompt: custom
      ? customPrompt
      : spec.statement,
    owner: normalizeUser(user) || { name: 'Interviewer', email: '' },
    candidate: {
      name: candidateName,
      email: normalizeEmail(draft?.candidateEmail),
    },
    difficulty: draft?.difficulty || question.diff,
    duration: Number(draft?.duration || question.dur),
    permissions: { ...DEFAULT_PERMISSIONS, ...(draft?.permissions || {}) },
    status: 'in-progress',
    createdAt: now,
    updatedAt: now,
  });
}

export function createInitialState({ storage, location } = {}) {
  const currentUser = normalizeUser(readStorage(storage, STORAGE_KEYS.user, null));
  const sessions = readStorage(storage, STORAGE_KEYS.sessions, []).map(normalizeSession).filter(Boolean);
  const url = location instanceof URL ? location : new URL(location?.href || String(location || 'https://systemdesign.studio/'));
  const pendingShareToken = url.searchParams.get('share') || '';
  const activeSession = sessions[0] || null;
  const question = activeSession?.questionId || 'twitter';
  const draft = createDefaultDraft(currentUser, question);
  if (activeSession) {
    draft.sessionId = activeSession.id;
    draft.candidateName = activeSession.candidate.name;
    draft.candidateEmail = activeSession.candidate.email;
    draft.difficulty = activeSession.difficulty;
    draft.duration = activeSession.duration;
    draft.permissions = { ...DEFAULT_PERMISSIONS, ...activeSession.permissions };
    draft.customPrompt = activeSession.prompt || '';
  }

  return {
    screen: currentUser ? (pendingShareToken ? 'join' : 'dashboard') : 'login',
    currentUser,
    authMode: 'signup',
    login: currentUser ? { name: currentUser.name, email: currentUser.email, password: '' } : { ...DEFAULT_LOGIN, password: '' },
    pendingInvite: null,
    pendingShareToken,
    visibility: null,
    sessions,
    activeSessionId: activeSession?.id || null,
    role: 'interviewer',
    draft,
    question,
    shareLinks: {},
    candidateLink: '',
    interviewerLink: '',
    pan: { x: 0, y: 0 },
    connectionStartId: null,
    paletteQuery: '',
    questionCollapsed: false,
    idealOpen: false,
    renamingId: null,
    renameDraft: '',
    comments: activeSession?.architecture?.comments || [],
    saveState: activeSession ? 'saved' : 'idle',
    reviewFeedback: activeSession?.review?.feedback || '',
    reviewDecision: activeSession?.review?.decision || '',
    comps: [],
    edges: [],
    selectedId: null,
    selectedEdgeId: null,
    inspectorTab: 'general',
    broken: [],
    traffic: 0,
    zoom: 1,
    constraints: [],
    problemsOpen: false,
    aiOpen: false,
    tool: 'select',
    scores: {
      Scalability: 4,
      Availability: 3,
      Reliability: 3,
      Communication: 4,
      Tradeoffs: 3,
      'Database choice': 4,
      Caching: 3,
      'Load balancing': 4,
      Observability: 2,
      Security: 3,
    },
    toast: '',
  };
}

export class SystemDesignStudio {
  constructor(root, options = {}) {
    this.root = root;
    this.storage = options.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    this.location = options.location || (typeof window !== 'undefined' ? window.location : new URL('https://systemdesign.studio/'));
    this.navigator = options.navigator || (typeof window !== 'undefined' ? window.navigator : null);
    this.api = options.api || new ApiClient({ baseUrl: options.apiBaseUrl, storage: this.storage });
    this.WebSocket = options.WebSocket || (typeof window !== 'undefined' ? window.WebSocket : null);
    this.state = createInitialState({ storage: this.storage, location: this.location });
    this.drag = null;
    this.syncTimer = null;
    this.sharedSocket = null;
    this.sharedSocketUrl = '';
    this.reconnectTimer = null;
  }

  mount() {
    this.root.addEventListener('click', (event) => { void this.handleClick(event); });
    this.root.addEventListener('change', (event) => this.handleChange(event));
    this.root.addEventListener('input', (event) => this.handleInput(event));
    this.root.addEventListener('dragstart', (event) => this.handleDragStart(event));
    this.root.addEventListener('dragover', (event) => {
      if (event.target.closest('[data-canvas]')) event.preventDefault();
    });
    this.root.addEventListener('drop', (event) => this.handleDrop(event));
    this.root.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    this.root.addEventListener('dblclick', (event) => this.handleDoubleClick(event));
    this.root.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    window.addEventListener('pointerup', () => { void this.handlePointerUp(); });
    this.render();
    void this.bootstrapFromApi();
    this.startSharedSync();
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.render();
  }

  baseUrl() {
    const href = this.location?.href || 'https://systemdesign.studio/';
    const url = new URL(href);
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  apiOrigin() {
    return this.api?.baseUrl || runtimeConfig.apiBaseUrl || this.baseUrl();
  }

  saveUser(user) {
    writeStorage(this.storage, STORAGE_KEYS.user, user);
  }

  saveSessions(sessions = this.state.sessions) {
    writeStorage(this.storage, STORAGE_KEYS.sessions, sessions.map(normalizeSession).filter(Boolean));
  }

  async bootstrapFromApi() {
    try {
      if (this.state.pendingShareToken) {
        const invite = await this.api.share(this.state.pendingShareToken);
        const session = normalizeSession(invite.interview);
        this.setState({
          pendingInvite: { role: invite.role, session },
          role: invite.role,
          visibility: invite.visibility,
          sessions: [session, ...this.state.sessions.filter((item) => item.id !== session.id)],
          activeSessionId: session.id,
          screen: this.state.currentUser ? 'join' : 'login',
        });
      }

      if (!this.api.token()) return;
      const me = await this.api.me();
      const list = await this.api.interviews();
      const user = normalizeUser(me.user);
      const sessions = list.interviews.map(normalizeSession).filter(Boolean);
      this.saveUser(user);
      this.saveSessions(sessions);
      this.setState({
        currentUser: user,
        login: { name: user.name, email: user.email, password: '' },
        sessions: this.state.pendingInvite
          ? [this.state.pendingInvite.session, ...sessions.filter((session) => session.id !== this.state.pendingInvite.session.id)]
          : sessions,
        activeSessionId: this.state.activeSessionId || sessions[0]?.id || null,
        screen: this.state.pendingInvite ? 'join' : this.state.screen === 'login' ? 'dashboard' : this.state.screen,
      });
    } catch (error) {
      if (error.status === 401) this.api.setToken('');
      if (this.state.screen !== 'login') this.toast(error.message);
    }
  }

  startSharedSync() {
    if (typeof window === 'undefined' || typeof window.setInterval !== 'function') return;
    if (this.syncTimer) window.clearInterval(this.syncTimer);
    this.syncTimer = window.setInterval(() => {
      void this.refreshActiveSession();
    }, 2500);
  }

  webSocketUrl(session = this.activeSession()) {
    if (!session?.id || !this.WebSocket) return '';
    const url = new URL(this.apiOrigin());
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `/api/ws/interviews/${encodeURIComponent(session.id)}`;
    url.hash = '';
    url.search = '';
    if (this.state.pendingShareToken) {
      url.searchParams.set('share', this.state.pendingShareToken);
    } else if (typeof this.api.token === 'function' && this.api.token()) {
      url.searchParams.set('auth', this.api.token());
    } else {
      return '';
    }
    return url.toString();
  }

  closeSharedSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.sharedSocket) return;
    const socket = this.sharedSocket;
    this.sharedSocket = null;
    this.sharedSocketUrl = '';
    try {
      socket.close();
    } catch {
      // Socket may already be closed.
    }
  }

  scheduleSharedSocketReconnect() {
    if (this.reconnectTimer || !['workspace', 'review'].includes(this.state.screen)) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectSharedSocket();
    }, 1500);
  }

  connectSharedSocket() {
    const url = this.webSocketUrl();
    if (!url) return;
    if (this.sharedSocket && this.sharedSocketUrl === url && this.sharedSocket.readyState <= 1) return;
    this.closeSharedSocket();
    try {
      const socket = new this.WebSocket(url);
      this.sharedSocket = socket;
      this.sharedSocketUrl = url;
      socket.addEventListener('message', (event) => {
        const payload = safeJsonParse(event.data, null);
        if (payload?.type === 'interview.updated' && payload.interviewId === this.state.activeSessionId) {
          void this.refreshActiveSession({ force: true });
        }
      });
      socket.addEventListener('close', () => {
        if (this.sharedSocket === socket) {
          this.sharedSocket = null;
          this.sharedSocketUrl = '';
          this.scheduleSharedSocketReconnect();
        }
      });
      socket.addEventListener('error', () => {
        if (this.sharedSocket === socket) {
          this.sharedSocket = null;
          this.sharedSocketUrl = '';
          this.scheduleSharedSocketReconnect();
        }
      });
    } catch {
      this.scheduleSharedSocketReconnect();
    }
  }

  activeSession() {
    return this.state.sessions.find((session) => session.id === this.state.activeSessionId) || null;
  }

  upsertSession(session) {
    const normalized = normalizeSession(session);
    const sessions = [normalized, ...this.state.sessions.filter((item) => item.id !== normalized.id)];
    this.state.sessions = sessions;
    this.state.activeSessionId = normalized.id;
    this.saveSessions(sessions);
    return normalized;
  }

  architecturePayload() {
    return {
      comps: this.state.comps.map((component) => ({ ...component, props: { ...(component.props || {}) } })),
      edges: this.state.edges.map((edge) => ({ ...edge })),
      comments: this.state.comments.map((comment) => ({ ...comment })),
    };
  }

  updateActiveSessionPatch(patch) {
    const active = this.activeSession();
    if (!active) return null;
    const updated = normalizeSession({ ...active, ...patch, updatedAt: new Date().toISOString() });
    this.state.sessions = [updated, ...this.state.sessions.filter((session) => session.id !== updated.id)];
    this.saveSessions(this.state.sessions);
    return updated;
  }

  async persistArchitecture() {
    const active = this.updateActiveSessionPatch({ architecture: this.architecturePayload() });
    if (!active) return;
    this.setState({ saveState: 'saving' });
    try {
      const body = { architecture: active.architecture };
      const result = this.state.pendingShareToken
        ? await this.api.updateSharedInterview(this.state.pendingShareToken, body)
        : await this.api.updateInterview(active.id, body);
      const saved = this.upsertSession(result.interview);
      this.setState({
        saveState: 'saved',
        activeSessionId: saved.id,
        role: result.role || this.state.role,
        visibility: result.visibility || this.state.visibility,
      });
    } catch (error) {
      this.setState({ saveState: 'save failed' });
      this.toast(error.message);
    }
  }

  async saveReview(decision) {
    const active = this.activeSession();
    if (!active || !this.canSubmitReview()) return;
    const review = {
      decision,
      feedback: this.state.reviewFeedback.trim(),
      submittedAt: new Date().toISOString(),
      submittedBy: this.state.currentUser?.email || this.activeRole(),
      idealAssessment: this.compareToIdealSolution(),
    };
    this.setState({ reviewDecision: decision, saveState: 'saving' });
    try {
      const body = {
        status: 'reviewed',
        scores: this.state.scores,
        review,
        architecture: this.architecturePayload(),
      };
      const result = this.state.pendingShareToken
        ? await this.api.updateSharedInterview(this.state.pendingShareToken, body)
        : await this.api.updateInterview(active.id, body);
      const saved = this.upsertSession(result.interview);
      this.setState({
        saveState: 'saved',
        activeSessionId: saved.id,
        role: result.role || this.state.role,
        visibility: result.visibility || this.state.visibility,
      });
      this.toast('Review saved');
    } catch (error) {
      this.setState({ saveState: 'save failed' });
      this.toast(error.message);
    }
  }

  sessionPayloadFromDraft() {
    const draft = this.state.draft;
    const question = questionById(draft.questionId);
    const spec = QUESTION_SPEC[question.id] || QUESTION_SPEC.twitter;
    const customPrompt = customPromptText(draft);
    const custom = isCustomDraft(draft);
    return {
      questionId: question.id,
      title: custom ? titleFromPrompt(customPrompt) : question.title,
      prompt: custom ? customPrompt : spec.statement,
      candidateName: draft.candidateName || 'Candidate',
      candidateEmail: draft.candidateEmail,
      difficulty: draft.difficulty || question.diff,
      duration: Number(draft.duration || question.dur),
      permissions: draft.permissions,
      architecture: { comps: [], edges: [], comments: [] },
      scores: this.state.scores,
    };
  }

  async persistSessionFromSetup() {
    if (!this.state.currentUser) {
      this.setState({ screen: 'login' });
      return null;
    }
    const created = await this.api.createInterview(this.sessionPayloadFromDraft());
    const session = this.upsertSession(created.interview);
    const share = await this.api.shareInterview(session.id);
    this.setState({
      shareLinks: share.links,
      candidateLink: share.links.candidate,
      interviewerLink: share.links.interviewer,
    });
    return session;
  }

  createSessionFromSetup() {
    const session = createSessionFromDraft({
      user: this.state.currentUser,
      draft: this.state.draft,
      questionId: this.state.draft.questionId,
    });
    return this.upsertSession(session);
  }

  startNewInterviewSetup(questionId = this.state.question || 'twitter') {
    const question = questionById(questionId);
    this.closeSharedSocket();
    this.setState({
      screen: 'setup',
      question: question.id,
      draft: createDefaultDraft(this.state.currentUser, question.id),
      activeSessionId: null,
      shareLinks: {},
      candidateLink: '',
      interviewerLink: '',
      comps: [],
      edges: [],
      comments: [],
      selectedId: null,
      selectedEdgeId: null,
      pan: { x: 0, y: 0 },
      zoom: 1,
      connectionStartId: null,
      questionCollapsed: false,
      idealOpen: false,
      renamingId: null,
      renameDraft: '',
      saveState: 'idle',
    });
  }

  openWorkspace(question = this.state.question, options = {}) {
    const session = options.sessionId
      ? this.state.sessions.find((item) => item.id === options.sessionId)
      : this.activeSession();
    const canvas = session?.architecture || { comps: [], edges: [], comments: [] };
    const workspaceQuestion = session?.questionId || question;
    this.setState({
      screen: 'workspace',
      question: workspaceQuestion,
      role: options.role || this.state.role || 'interviewer',
      activeSessionId: options.sessionId || this.state.activeSessionId,
      comps: (canvas.comps || []).map((component) => ({ ...component, props: { ...(component.props || {}) } })),
      edges: (canvas.edges || []).map((edge) => ({ ...edge })),
      comments: (canvas.comments || []).map((comment) => ({ ...comment })),
      pan: { x: 0, y: 0 },
      connectionStartId: null,
      saveState: session ? 'saved' : 'idle',
      reviewFeedback: session?.review?.feedback || '',
      reviewDecision: session?.review?.decision || '',
      selectedId: null,
      selectedEdgeId: null,
      broken: [],
      traffic: 0,
      zoom: 1,
      questionCollapsed: false,
      idealOpen: false,
      renamingId: null,
      renameDraft: '',
      constraints: [],
      problemsOpen: false,
      aiOpen: false,
      inspectorTab: 'general',
    });
    this.connectSharedSocket();
  }

  openWorkspaceForSession(session, role = this.state.role) {
    const normalized = this.upsertSession(session);
    this.openWorkspace(normalized.questionId, { role, sessionId: normalized.id });
  }

  activeRole() {
    return this.state.role || 'interviewer';
  }

  permissions() {
    return { ...DEFAULT_PERMISSIONS, ...(this.activeSession()?.permissions || this.state.draft.permissions || {}) };
  }

  visibility() {
    if (this.state.visibility) return this.state.visibility;
    const permissions = this.permissions();
    const role = this.activeRole();
    if (role === 'candidate') {
      return {
        canSeeQuestion: Boolean(permissions.candidateCanViewQuestion),
        canSeeArchitecture: true,
        canEditCanvas: Boolean(permissions.allowCandidateEdit),
        canSeeHealth: Boolean(permissions.showHealthToCandidate),
        canInjectFailures: false,
        canSeeAiHints: !permissions.aiHintsInterviewerOnly,
        canSeeScorecard: false,
        canSubmitReview: false,
      };
    }
    if (role === 'panel') {
      return {
        canSeeQuestion: true,
        canSeeArchitecture: true,
        canEditCanvas: false,
        canSeeHealth: true,
        canInjectFailures: false,
        canSeeAiHints: false,
        canSeeScorecard: Boolean(permissions.panelCanViewReview),
        canSubmitReview: false,
      };
    }
    return {
      canSeeQuestion: true,
      canSeeArchitecture: true,
      canEditCanvas: true,
      canSeeHealth: true,
      canInjectFailures: Boolean(permissions.allowFailureInjection),
      canSeeAiHints: true,
      canSeeScorecard: true,
      canSubmitReview: true,
    };
  }

  canEdit() {
    return Boolean(this.visibility().canEditCanvas);
  }

  canInjectFailures() {
    return Boolean(this.visibility().canInjectFailures);
  }

  canViewHealth() {
    return Boolean(this.visibility().canSeeHealth);
  }

  canViewAiHints() {
    return Boolean(this.visibility().canSeeAiHints);
  }

  canSubmitReview() {
    return Boolean(this.visibility().canSubmitReview);
  }

  isCustomActiveSession() {
    const active = this.activeSession();
    if (!active) return false;
    const spec = QUESTION_SPEC[active.questionId] || null;
    return Boolean(active.prompt && spec?.statement && active.prompt.trim() !== spec.statement.trim());
  }

  setZoom(value) {
    this.setState({ zoom: Math.round(clamp(Number(value) || 1, 0.5, 2) * 100) / 100 });
  }

  async refreshActiveSession({ force = false } = {}) {
    const active = this.activeSession();
    if (!active) return null;
    if (!force && (this.drag || this.state.saveState === 'saving')) return active;
    try {
      let role = this.state.role;
      let visibility = this.state.visibility;
      let nextSession = null;
      if (this.state.pendingShareToken) {
        const shared = await this.api.share(this.state.pendingShareToken);
        role = shared.role || role;
        visibility = shared.visibility || visibility;
        nextSession = normalizeSession(shared.interview);
      } else if (typeof this.api.token === 'function' && this.api.token()) {
        const list = await this.api.interviews();
        nextSession = list.interviews.map(normalizeSession).find((session) => session?.id === active.id) || null;
      }
      if (!nextSession) return active;
      const currentTime = Date.parse(active.updatedAt || '') || 0;
      const nextTime = Date.parse(nextSession.updatedAt || '') || 0;
      if (!force && nextTime <= currentTime) return active;
      const saved = this.upsertSession(nextSession);
      const canvas = saved.architecture || { comps: [], edges: [], comments: [] };
      const selectedExists = (canvas.comps || []).some((component) => component.id === this.state.selectedId);
      const edgeExists = (canvas.edges || []).some((edge) => edge.id === this.state.selectedEdgeId);
      const patch = {
        activeSessionId: saved.id,
        role,
        visibility,
        saveState: 'saved',
      };
      if (this.state.screen === 'workspace' || this.state.screen === 'review') {
        Object.assign(patch, {
          question: saved.questionId,
          comps: (canvas.comps || []).map((component) => ({ ...component, props: { ...(component.props || {}) } })),
          edges: (canvas.edges || []).map((edge) => ({ ...edge })),
          comments: (canvas.comments || []).map((comment) => ({ ...comment })),
          reviewFeedback: saved.review?.feedback || this.state.reviewFeedback,
          reviewDecision: saved.review?.decision || this.state.reviewDecision,
          selectedId: selectedExists ? this.state.selectedId : null,
          selectedEdgeId: edgeExists ? this.state.selectedEdgeId : null,
        });
      }
      this.setState(patch);
      this.connectSharedSocket();
      return saved;
    } catch (error) {
      if (force) this.toast(error.message);
      return active;
    }
  }

  render() {
    const html = this.state.screen === 'login' ? this.renderLogin()
      : this.state.screen === 'join' ? this.renderJoin()
      : this.state.screen === 'dashboard' ? this.renderDashboard()
      : this.state.screen === 'setup' ? this.renderSetup()
      : this.state.screen === 'link' ? this.renderLinkGenerated()
      : this.state.screen === 'review' ? this.renderReview()
      : this.renderWorkspace();
    this.root.innerHTML = html + (this.state.toast ? `<div class="toast">${esc(this.state.toast)}</div>` : '');
  }

  renderLogin() {
    const invite = this.state.pendingInvite;
    return `
      <div class="app dashboard auth-screen">
        <div class="auth-shell">
          <section class="auth-panel card">
            <div class="brand auth-brand">
              <span class="logo">S</span><span class="brand-title">SystemDesign Studio</span><span class="beta">PUBLIC</span>
            </div>
            <div class="page-title">${invite ? 'Sign in to join interview' : 'Sign in to your workspace'}</div>
            <p class="subtle">${invite ? `${esc(invite.session.owner.name)} shared ${esc(invite.session.title)} with you.` : 'Use a lightweight workspace account for local drafts, interviews, and share links.'}</p>
            <div class="pill-row" style="margin-top:18px">
              <button class="pill pill-button ${this.state.authMode === 'signup' ? 'active' : ''}" data-action="authMode" data-mode="signup">Create account</button>
              <button class="pill pill-button ${this.state.authMode === 'login' ? 'active' : ''}" data-action="authMode" data-mode="login">Sign in</button>
            </div>
            ${this.state.authMode === 'signup' ? `<label style="display:block;margin-top:18px">
              <span class="mono-label">Name</span>
              <input class="field" data-login-field="name" autocomplete="name" value="${esc(this.state.login.name)}" placeholder="Neha Rao">
            </label>` : ''}
            <label style="display:block;margin-top:12px">
              <span class="mono-label">Work email</span>
              <input class="field" data-login-field="email" autocomplete="email" value="${esc(this.state.login.email)}" placeholder="neha@example.com">
            </label>
            <label style="display:block;margin-top:12px">
              <span class="mono-label">Password</span>
              <input class="field" data-login-field="password" type="password" autocomplete="${this.state.authMode === 'signup' ? 'new-password' : 'current-password'}" value="${esc(this.state.login.password)}" placeholder="At least 12 characters">
            </label>
            <button class="btn primary" style="width:100%;margin-top:16px" data-action="signIn">${invite ? 'Continue to invite' : this.state.authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
            <div class="subtle" style="font-size:12px;margin-top:10px">Accounts and interviews are stored by the configured SystemDesign Studio API.</div>
            ${invite ? `<div class="visibility-card" style="margin-top:16px">
              <div class="mono-label">Invite visibility</div>
              <div class="visibility-row"><span>Role</span><strong>${esc(ROLE_LABELS[invite.role] || invite.role)}</strong></div>
              <div class="visibility-row"><span>Question</span><strong>${esc(invite.session.title)}</strong></div>
              <div class="visibility-row"><span>Candidate access</span><strong>${invite.session.permissions.showHealthToCandidate ? 'Health visible' : 'Health hidden'}</strong></div>
            </div>` : ''}
          </section>
        </div>
      </div>`;
  }

  renderJoin() {
    const invite = this.state.pendingInvite;
    const session = invite?.session || this.activeSession();
    if (!session && this.state.pendingShareToken) {
      return `
        <div class="app dashboard">
          ${this.renderTopbar('join')}
          <div style="min-height:calc(100vh - 54px);display:grid;place-items:center;padding:34px">
            <div class="card stat" style="width:min(560px,100%);padding:28px;text-align:center">
              <div class="page-title">Opening shared workspace</div>
              <p class="subtle">Validating the invite token and loading the latest interview state.</p>
            </div>
          </div>
        </div>`;
    }
    if (!session) return this.renderDashboard();
    return `
      <div class="app dashboard">
        ${this.renderTopbar('join')}
        <div style="min-height:calc(100vh - 54px);display:grid;place-items:center;padding:34px">
          <div class="card stat" style="width:min(760px,100%);padding:28px">
            <div class="pill" style="width:max-content;color:var(--accent-soft);margin-bottom:14px">${esc(ROLE_LABELS[this.state.role] || this.state.role)} invite</div>
            <div class="page-title">${esc(session.title)}</div>
            <p class="subtle">You are joining the shared workspace as ${esc(ROLE_LABELS[this.state.role] || this.state.role)}. Your role controls what you can edit, inspect, and review.</p>
            <div class="grid" style="grid-template-columns:repeat(3,1fr);margin:18px 0">
              <div class="card stat"><div class="subtle">Interviewer</div><strong>${esc(session.owner.name)}</strong></div>
              <div class="card stat"><div class="subtle">Candidate</div><strong>${esc(session.candidate.name)}</strong></div>
              <div class="card stat"><div class="subtle">Duration</div><strong>${esc(session.duration)}m</strong></div>
            </div>
            ${this.renderVisibilityMatrix(session)}
            <div style="display:flex;gap:10px;margin-top:20px">
              <button class="btn" style="flex:1" data-action="dashboard">Dashboard</button>
              <button class="btn primary" style="flex:1" data-action="acceptInvite">Join workspace</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  renderDashboard() {
    const user = this.state.currentUser || { name: 'Guest', email: '' };
    const sessions = this.state.sessions;
    const activeSessions = sessions.filter((session) => session.status !== 'reviewed');
    const stats = [
      ['Interviews this week', String(sessions.length)],
      ['Avg. duration', sessions.length ? `${Math.round(sessions.reduce((sum, session) => sum + session.duration, 0) / sessions.length)}m` : '0m'],
      ['Active sessions', String(activeSessions.length)],
      ['Question presets', String(QUESTIONS.length)],
    ];
    return `
      <div class="app dashboard">
        ${this.renderTopbar('dashboard')}
        <div class="dashboard-body">
          <div class="page-head">
            <div>
              <div class="page-title">Good afternoon, ${esc(firstName(user.name || user.email))}</div>
              <div class="subtle">${sessions.length ? `${sessions.length} interview workspace${sessions.length === 1 ? '' : 's'} saved to this account.` : 'Create your first interview workspace.'}</div>
            </div>
            <button class="btn primary" data-action="setup">Create interview</button>
          </div>
          <div class="grid stats">
            ${stats.map(([label, value]) => `<div class="card stat"><div class="subtle">${label}</div><div class="stat-value">${value}</div></div>`).join('')}
          </div>
          <div class="section-head"><div class="section-title">Resume in progress</div></div>
          ${activeSessions.length ? activeSessions.slice(0, 2).map((session) => this.renderSessionCard(session)).join('') : `
            <div class="card empty-state">
              <strong>No active interview yet</strong>
              <span class="subtle">Choose a preset or create a custom prompt to start a shared blank workspace.</span>
              <button class="btn primary" data-action="setup">Create interview</button>
            </div>`}
          <div class="section-head">
            <div class="section-title">Upcoming interviews</div>
            <span class="mono-label">${esc(user.email || 'Local account')}</span>
          </div>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-bottom:26px">
            ${sessions.length ? sessions.slice(0, 3).map((session) => `<div class="card stat"><strong>${esc(session.title)} - ${esc(session.duration)}m</strong><div class="subtle" style="margin-top:4px">Candidate: ${esc(session.candidate.name)} - ${session.permissions.aiHintsInterviewerOnly ? 'AI hints interviewer only' : 'AI hints visible'}</div></div>`).join('') : '<div class="card stat"><strong>No scheduled interviews</strong><div class="subtle" style="margin-top:4px">New sessions appear here after you generate links.</div></div>'}
          </div>
          <div class="section-head">
            <div class="section-title">Question library</div>
            <span class="mono-label">Open-source packs and community templates</span>
          </div>
          <div class="grid question-grid">
            ${QUESTIONS.map((question) => this.renderQuestionCard(question)).join('')}
          </div>
          <div class="section-head"><div class="section-title">Recent architectures</div></div>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">
            ${sessions.length ? sessions.slice(0, 3).map((session) => `<div class="card stat"><strong>${esc(session.title)} - ${esc(session.status)}</strong><div class="subtle" style="margin-top:4px">Candidate: ${esc(session.candidate.name)} - ${esc(new Date(session.updatedAt).toLocaleDateString())}</div></div>`).join('') : '<div class="card stat"><strong>No recent architectures</strong><div class="subtle" style="margin-top:4px">Finished reviews and drafts will be preserved per signed-in user.</div></div>'}
          </div>
        </div>
      </div>`;
  }

  renderSessionCard(session) {
    return `
      <button class="card resume-card" data-action="resumeSession" data-session-id="${esc(session.id)}">
        <span class="icon-tile" style="color:var(--accent-soft);background:rgba(99,102,241,.18)">${this.icon('monitor', 21)}</span>
        <span style="text-align:left;flex:1">
          <strong>${esc(session.title)} - ${esc(session.difficulty)} loop</strong><br>
          <span class="subtle">Candidate: ${esc(session.candidate.name)} - ${esc(session.duration)}m - ${esc(session.status)}</span>
        </span>
        <span style="color:var(--accent-soft);font-weight:700">Resume</span>
      </button>`;
  }

  renderQuestionCard(question) {
    const diffColor = question.diff === 'Easy' ? 'var(--good)' : question.diff === 'Medium' ? 'var(--warn-2)' : 'var(--bad-2)';
    return `
      <button class="card question-card" data-action="workspace" data-question="${esc(question.id)}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span class="icon-tile" style="color:var(--accent-soft);background:rgba(129,140,248,.14)">${this.icon('cube', 20)}</span>
          <span class="pill" style="color:${diffColor}">${esc(question.diff)}</span>
        </div>
        <div style="font-weight:800;font-size:15px;text-align:left">${esc(question.title)}</div>
        <div class="subtle" style="font-size:12.5px;margin:4px 0 12px;text-align:left;min-height:32px">${esc(question.tagline)}</div>
        <div class="pill-row">
          ${question.topics.map((topic) => `<span class="pill">${esc(topic)}</span>`).join('')}
          <span class="pill" style="margin-left:auto;font-family:var(--mono)">${esc(question.dur)}m</span>
        </div>
      </button>`;
  }

  renderSetup() {
    const draft = this.state.draft;
    const current = questionById(draft.questionId);
    const spec = QUESTION_SPEC[current.id] || QUESTION_SPEC.twitter;
    return `
      <div class="app dashboard">
        ${this.renderTopbar('setup')}
        <div class="setup-body">
          <div class="page-head">
            <div>
              <div class="page-title">Create interview</div>
              <div class="subtle">Configure the question, permissions, diagnostics, and shared blank workspace.</div>
            </div>
            <div style="display:flex;gap:10px">
              <button class="btn" data-action="workspace" data-question="${esc(draft.questionId)}">Start workspace</button>
              <button class="btn primary" data-action="generateLink">Generate candidate link</button>
            </div>
          </div>
          <div class="setup-grid">
            <div>
              <div class="form-grid">
                <div class="card stat">
                  <div class="mono-label">Question source</div>
                  <div class="pill-row" style="margin:12px 0 14px">
                    <button class="pill pill-button ${draft.questionMode === 'preset' ? 'active' : ''}" data-action="questionMode" data-mode="preset">Preset</button>
                    <button class="pill pill-button ${draft.questionMode === 'custom' ? 'active' : ''}" data-action="questionMode" data-mode="custom">Custom</button>
                  </div>
                  <div class="grid">
                    ${QUESTIONS.slice(0, 6).map((question) => `
                      <button class="card stat" data-action="selectSetupQuestion" data-question="${esc(question.id)}" style="text-align:left;border-color:${question.id === draft.questionId ? 'rgba(99,102,241,.45)' : 'var(--border)'}">
                        <strong>${esc(question.title)}</strong>
                        <div class="subtle" style="font-size:12px;margin-top:4px">${esc(question.topics.join(', '))} - ${esc(question.dur)}m</div>
                      </button>`).join('')}
                  </div>
                </div>
                <div class="card stat">
                  <div class="mono-label">Interview prompt</div>
                  <textarea class="textarea" data-session-field="customPrompt" aria-label="Custom system design prompt" placeholder="${esc(spec.statement)}">${esc(draft.customPrompt)}</textarea>
                  <div class="form-grid" style="margin-top:12px">
                    <label><span class="mono-label">Difficulty</span><select class="select" data-session-field="difficulty">${['Easy', 'Medium', 'Hard'].map((item) => `<option ${item === draft.difficulty ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label>
                    <label><span class="mono-label">Duration</span><select class="select" data-session-field="duration">${[30, 40, 45, 50, 60].map((item) => `<option value="${item}" ${Number(item) === Number(draft.duration) ? 'selected' : ''}>${item} min</option>`).join('')}</select></label>
                  </div>
                  <div class="mono-label" style="margin-top:14px">Question details</div>
                  ${(spec.functional || []).slice(0, 3).map((item) => `<div style="font-size:12px;margin-top:7px;color:var(--text-2)">+ ${esc(item)}</div>`).join('')}
                </div>
              </div>
              <div class="form-grid" style="margin-top:14px">
                <div class="card stat">
                  <div class="mono-label">Candidate</div>
                  <label style="display:block;margin-top:10px"><span class="mono-label">Candidate name</span><input class="field" data-session-field="candidateName" value="${esc(draft.candidateName)}" placeholder="Sam Lee"></label>
                  <label style="display:block;margin-top:10px"><span class="mono-label">Candidate email</span><input class="field" data-session-field="candidateEmail" value="${esc(draft.candidateEmail)}" placeholder="sam@example.com"></label>
                </div>
                <div class="card stat">
                  <div class="mono-label">Interviewer</div>
                  <div class="visibility-row"><span>Name</span><strong>${esc(this.state.currentUser?.name || 'Signed-in user')}</strong></div>
                  <div class="visibility-row"><span>Email</span><strong>${esc(this.state.currentUser?.email || 'local')}</strong></div>
                  <div class="visibility-row"><span>Question</span><strong>${esc(current.title)}</strong></div>
                </div>
              </div>
              <div class="form-grid" style="margin-top:14px">
                ${this.renderChecklist('Interviewer controls', [
                  ['allowCandidateEdit', 'Allow candidate editing'],
                  ['diagnosticsDuringInterview', 'Enable diagnostics during interview'],
                  ['showHealthToCandidate', 'Show health score to candidate'],
                  ['allowFailureInjection', 'Enable failure injection'],
                  ['aiHintsInterviewerOnly', 'AI hints for interviewer only'],
                ])}
                ${this.renderChecklist('Permissions', [
                  ['candidateCanViewQuestion', 'Candidate can view question'],
                  ['allowCandidateEdit', 'Candidate can edit canvas'],
                  ['showHealthToCandidate', 'Candidate can view health panel'],
                  ['allowFailureInjection', 'Interviewer can inject scenarios'],
                  ['panelCanViewReview', 'Panel can view submitted review'],
                ])}
              </div>
            </div>
            <aside class="card stat" style="position:sticky;top:20px;align-self:start">
              <div class="mono-label">Session summary</div>
              <h2 style="margin:12px 0 4px">${esc(current.title)}</h2>
              <div class="subtle">${esc(draft.difficulty)} loop - ${esc(draft.duration)} minutes</div>
              <div class="grid" style="margin:18px 0">
                ${[
                  ['Candidate', draft.candidateName || 'Not set'],
                  ['Diagnostics', draft.permissions.diagnosticsDuringInterview ? 'Enabled' : 'Hidden'],
                  ['AI hints', draft.permissions.aiHintsInterviewerOnly ? 'Interviewer only' : 'Visible'],
                  ['Candidate health', draft.permissions.showHealthToCandidate ? 'Visible' : 'Hidden'],
                ].map(([a, b]) => `<div style="display:flex;justify-content:space-between;font-size:13px"><span class="subtle">${a}</span><strong>${b}</strong></div>`).join('')}
              </div>
              ${this.renderVisibilityMatrix({ permissions: draft.permissions })}
              <button class="btn primary" style="width:100%;margin-bottom:10px" data-action="generateLink">Generate candidate link</button>
              <button class="btn" style="width:100%" data-action="workspace" data-question="${esc(draft.questionId)}">Start workspace</button>
            </aside>
          </div>
        </div>
      </div>`;
  }

  renderChecklist(title, items) {
    const permissions = this.state.draft?.permissions || DEFAULT_PERMISSIONS;
    return `<div class="card stat"><div class="mono-label">${esc(title)}</div>${items.map((item) => {
      const [key, label] = Array.isArray(item) ? item : [item, item];
      return `<label class="check-row"><span>${esc(label)}</span><input data-permission="${esc(key)}" type="checkbox" ${permissions[key] ? 'checked' : ''}></label>`;
    }).join('')}</div>`;
  }

  renderVisibilityMatrix(source) {
    const permissions = { ...DEFAULT_PERMISSIONS, ...(source?.permissions || {}) };
    const rows = [
      ['Candidate access', permissions.allowCandidateEdit ? 'Can edit canvas' : 'View only'],
      ['Interviewer access', permissions.allowFailureInjection ? 'Diagnostics + failure injection' : 'Diagnostics only'],
      ['Panel access', permissions.panelCanViewReview ? 'Review summary visible' : 'No review access'],
      ['Health score', permissions.showHealthToCandidate ? 'Visible to candidate' : 'Hidden from candidate'],
    ];
    return `<div class="visibility-card">${rows.map(([a, b]) => `<div class="visibility-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('')}</div>`;
  }

  renderLinkGenerated() {
    const session = this.activeSession();
    const question = questionById(session?.questionId || this.state.question);
    const links = this.state.shareLinks;
    return `
      <div class="app dashboard">
        ${this.renderTopbar('link')}
        <div style="min-height:calc(100vh - 54px);display:grid;place-items:center;padding:34px">
          <div class="card stat" style="width:min(820px,100%);padding:28px">
            <div class="icon-tile" style="width:48px;height:48px;color:#6ee7b7;background:rgba(52,211,153,.14);margin-bottom:18px">${this.icon('shield', 24)}</div>
            <div class="page-title">Share links generated</div>
            <p class="subtle">These links open the same live workspace. Server-side roles decide who can edit, inspect health, inject failures, and submit review notes.</p>
            ${['candidate', 'interviewer', 'panel'].map((role) => `
              <div class="mono-label" style="margin-top:12px">${esc(ROLE_LABELS[role])} invite</div>
              <div style="display:flex;gap:10px;margin:8px 0 10px">
                <input class="field" data-role-link="${esc(role)}" readonly value="${esc(links[role] || '')}">
                <button class="btn" data-action="copyShareLink" data-role="${esc(role)}">Copy</button>
              </div>`).join('')}
            <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
              ${[
                ['Candidate', session?.candidate?.name || 'Candidate'],
                ['Question', question.title],
                ['Status', session?.status || 'in-progress'],
              ].map(([a, b]) => `<div class="card stat"><div class="subtle">${esc(a)}</div><strong>${esc(b)}</strong></div>`).join('')}
            </div>
            ${this.renderVisibilityMatrix(session)}
            <div style="display:flex;gap:10px">
              <button class="btn" style="flex:1" data-action="setup">Edit setup</button>
              <button class="btn primary" style="flex:1" data-action="workspace" data-question="${esc(session?.questionId || this.state.question)}">Start workspace</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  renderWorkspace() {
    return `
      <div class="app workspace">
        ${this.renderTopbar('workspace')}
        <div class="workspace-main">
          ${this.renderPalette()}
          ${this.renderCanvas()}
          ${this.state.idealOpen && this.canSubmitReview() ? this.renderIdealSolutionPanel()
            : this.state.aiOpen && this.canViewAiHints() ? this.renderAiPanel()
              : this.renderRightPanel()}
        </div>
        ${this.renderStatusbar()}
      </div>`;
  }

  renderTopbar(mode) {
    const isWorkspace = mode === 'workspace';
    const role = this.activeRole();
    return `
      <header class="topbar">
        <div class="brand" data-action="dashboard" role="button" tabindex="0">
          <span class="logo">S</span><span class="brand-title">SystemDesign Studio</span><span class="beta">PUBLIC</span>
        </div>
        <div class="divider"></div>
        ${isWorkspace ? `
          <button class="btn icon-btn ${this.state.tool === 'select' ? 'active' : ''}" data-action="tool" data-tool="select" title="Select">${this.icon('search', 16)}</button>
          <button class="btn icon-btn ${this.state.tool === 'pan' ? 'active' : ''}" data-action="tool" data-tool="pan" title="Pan">${this.icon('net', 16)}</button>
          <button class="btn icon-btn ${this.state.tool === 'connect' ? 'active' : ''}" data-action="tool" data-tool="connect" title="Connect">${this.icon('stream', 16)}</button>
          <button class="btn icon-btn ${this.state.tool === 'comment' ? 'active' : ''}" data-action="tool" data-tool="comment" title="Comment">${this.icon('bell', 16)}</button>
          <button class="btn icon-btn" data-action="zoomOut" title="Zoom out">-</button>
          <span class="pill role-pill">${Math.round((this.state.zoom || 1) * 100)}%</span>
          <button class="btn icon-btn" data-action="zoomIn" title="Zoom in">+</button>
          <span class="pill role-pill">${esc(ROLE_LABELS[role] || role)}</span>
          <div class="spacer"></div>
          ${this.canInjectFailures() ? `
            <span class="mono-label toolbar-label">Simulate</span>
            <button class="btn danger" data-action="breakSelected">Break</button>
            <button class="btn ${this.state.traffic ? 'active' : ''}" data-action="traffic" data-value="1000">Traffic ${this.state.traffic ? 'x' + this.state.traffic : ''}</button>
            <button class="btn" data-action="injectScenario" data-scenario="redis">Redis down</button>
            <button class="btn optional-wide" data-action="injectScenario" data-scenario="kafka">Kafka down</button>
            <button class="btn optional-wide" data-action="injectScenario" data-scenario="db">DB outage</button>
            <button class="btn" data-action="resetSimulation">Reset</button>
          ` : ''}
          <div class="spacer"></div>
          ${this.canViewAiHints() ? '<button class="btn" data-action="toggleAi">AI hints</button>' : ''}
          ${this.canSubmitReview() ? `<button class="btn ${this.state.idealOpen ? 'active' : ''}" data-action="toggleIdealSolution">Ideal solution</button>` : ''}
          ${this.visibility().canSeeScorecard ? '<button class="btn primary" data-action="review">Finish & review</button>' : ''}`
        : `
          <div class="spacer"></div>
          <button class="btn" data-action="dashboard">Dashboard</button>
          ${this.state.currentUser ? `<button class="btn" data-action="signOut">Sign out</button>` : ''}
          ${mode !== 'setup' ? '<button class="btn primary" data-action="setup">Create interview</button>' : ''}`}
      </header>`;
  }

  renderPalette() {
    if (!this.canEdit()) {
      return `
        <aside class="left-panel">
          <div class="panel-head">
            <div class="section-title">Workspace access</div>
            <div class="subtle" style="font-size:12px">This role is view-only for canvas edits.</div>
          </div>
          <div class="panel-scroll">
            ${this.renderVisibilityMatrix(this.activeSession() || { permissions: this.permissions() })}
          </div>
        </aside>`;
    }
    const terms = this.state.paletteQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return `
      <aside class="left-panel">
        <div class="panel-head">
          <div class="section-title">Components</div>
          <input class="palette-search" data-palette-search aria-label="Filter components" value="${esc(this.state.paletteQuery)}" placeholder="Search components">
        </div>
        <div class="panel-scroll">
          ${PALETTE.map((group) => {
            const items = group.items.filter((item) => {
              const haystack = `${item} ${group.cat}`.toLowerCase();
              return !terms.length || terms.every((term) => haystack.includes(term));
            });
            if (!items.length) return '';
            return `
            <div class="palette-group">
              <div class="mono-label" style="color:${group.color};margin:0 0 7px 6px">${esc(group.cat)}</div>
              ${items.map((item) => `
                <button class="palette-item" draggable="true" title="Drag to canvas or click to add" data-palette-name="${esc(item)}" data-palette-cat="${esc(group.cat)}" data-action="addComponent">
                  <span class="icon-tile" style="color:${group.color};background:${group.color}22">${this.iconForName(item, 16)}</span>
                  <span>${esc(item)}</span>
                </button>`).join('')}
            </div>`;
          }).join('') || '<div class="subtle" style="padding:12px">No matching components.</div>'}
        </div>
      </aside>`;
  }

  renderCanvas() {
    const byId = this.byId();
    const affected = this.affectedNodes();
    const diagnostics = this.diagnostics();
    const spec = QUESTION_SPEC[this.state.question] || QUESTION_SPEC.twitter;
    const active = this.activeSession();
    const custom = this.isCustomActiveSession();
    const title = active?.title || (QUESTIONS.find((q) => q.id === this.state.question) || QUESTIONS[0]).title;
    const difficulty = active?.difficulty || questionById(this.state.question).diff;
    const questionPanel = this.state.questionCollapsed ? `
        <button class="question-panel question-panel-collapsed card" data-action="toggleQuestionPanel" title="Show question">
          <span>${esc(title)}</span>
          <strong>Show question</strong>
        </button>` : `
        <div class="question-panel card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <strong>${esc(title)}</strong>
            <span style="display:flex;align-items:center;gap:6px">
              <span class="pill" style="color:var(--bad-2)">${esc(difficulty)}</span>
              <button class="btn icon-btn question-minimize" data-action="toggleQuestionPanel" title="Minimize question">-</button>
            </span>
          </div>
          ${this.visibility().canSeeQuestion ? `
            <p class="subtle" style="font-size:12.5px;line-height:1.45">${esc(active?.prompt || spec.statement || 'Design the system and explain tradeoffs.')}</p>
            ${custom ? '<div class="mono-label">Custom prompt</div>' : `<div class="mono-label">Requirements</div>
            ${(spec.functional || []).slice(0, 4).map((item) => `<div style="font-size:12px;margin-top:6px;color:var(--text-2)">+ ${esc(item)}</div>`).join('')}`}`
          : '<p class="subtle" style="font-size:12.5px;line-height:1.45">Question details are hidden for this role.</p>'}
        </div>`;
    return `
      <section class="canvas-wrap" data-canvas>
        ${questionPanel}
        ${this.state.connectionStartId ? '<div class="connection-hint">Choose a target component to create the connection</div>' : ''}
        <div class="canvas-layer" style="transform:translate(${this.state.pan.x}px, ${this.state.pan.y}px) scale(${this.state.zoom || 1})">
          <svg class="edges">${this.state.edges.map((edge) => this.renderEdgePath(edge, byId)).join('')}</svg>
          ${this.state.edges.map((edge) => this.renderEdgeLabel(edge, byId)).join('')}
          ${this.state.comps.map((component) => this.renderNode(component, diagnostics, affected)).join('')}
          ${this.renderComments()}
        </div>
        ${this.state.problemsOpen ? this.renderDiagnostics() : ''}
      </section>`;
  }

  renderNode(component, diagnostics, affected) {
    const color = categoryColor[component.cat] || 'var(--accent-soft)';
    const nodeDiagnostics = diagnostics.filter((item) => item.nodeId === component.id);
    const severity = nodeDiagnostics.some((item) => item.sev === 'critical') ? 'critical'
      : nodeDiagnostics.some((item) => item.sev === 'warn') ? 'warn' : '';
    const isBroken = this.state.broken.includes(component.id);
    const className = ['node',
      this.state.selectedId === component.id ? 'selected' : '',
      isBroken ? 'broken' : '',
      !isBroken && affected.has(component.id) ? 'affected' : '',
      !isBroken && this.state.traffic ? 'overloaded' : '',
    ].filter(Boolean).join(' ');
    const isRenaming = this.state.renamingId === component.id;
    return `
      <div class="${className}" data-node-id="${esc(component.id)}" data-action="selectNode" style="left:${component.x}px;top:${component.y}px">
        ${this.canEdit() ? `<button class="node-connect" data-action="startConnection" data-node-id="${esc(component.id)}" title="Connect this component">+</button>` : ''}
        ${severity ? `<span class="diag-dot ${severity}">${nodeDiagnostics.length}</span>` : ''}
        <span class="icon-tile" style="color:${color};background:${color}22">${this.iconForName(component.base || component.type, 18)}</span>
        ${isRenaming ? `
          <span style="min-width:0;flex:1">
            <input class="node-rename" data-rename-input data-node-id="${esc(component.id)}" value="${esc(this.state.renameDraft || component.type)}" aria-label="Rename component" autofocus>
            <span class="subtle" style="font-size:11px">${esc(component.cat)}</span>
          </span>` : `
          <span style="min-width:0">
            <strong style="font-size:13px">${esc(component.type)}</strong><br>
            <span class="subtle" style="font-size:11px">${esc(component.cat)}</span>
          </span>`}
      </div>`;
  }

  renderComments() {
    return this.state.comments.map((comment) => `
      <div class="canvas-comment" data-comment-id="${esc(comment.id)}" style="left:${comment.x}px;top:${comment.y}px">
        <textarea data-comment-id="${esc(comment.id)}" aria-label="Architecture comment">${esc(comment.text)}</textarea>
        <button class="btn icon-btn" data-action="deleteComment" data-comment-id="${esc(comment.id)}" title="Delete comment">x</button>
      </div>`).join('');
  }

  renderEdgePath(edge, byId) {
    const from = byId[edge.from];
    const to = byId[edge.to];
    if (!from || !to) return '';
    const x1 = from.x + (from.w || 150) / 2;
    const y1 = from.y + 33;
    const x2 = to.x + (to.w || 150) / 2;
    const y2 = to.y + 33;
    const dx = Math.max(30, Math.abs(x2 - x1) * 0.42);
    const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    const bad = this.state.broken.includes(edge.from) || this.state.broken.includes(edge.to);
    const selected = this.state.selectedEdgeId === edge.id;
    return `<path class="edge-path ${bad ? 'bad' : ''} ${selected ? 'selected' : ''}" d="${d}"></path>`;
  }

  renderEdgeLabel(edge, byId) {
    const from = byId[edge.from];
    const to = byId[edge.to];
    if (!from || !to) return '';
    const x = (from.x + (from.w || 150) / 2 + to.x + (to.w || 150) / 2) / 2;
    const y = (from.y + 33 + to.y + 33) / 2;
    return `<button class="edge-label ${this.state.traffic ? 'hot' : ''}" data-action="selectEdge" data-edge-id="${esc(edge.id)}" style="left:${x}px;top:${y}px">${esc(edge.badge || edge.protocol || 'HTTP')}</button>`;
  }

  renderRightPanel() {
    if (this.state.idealOpen && this.canSubmitReview()) return this.renderIdealSolutionPanel();
    const selected = this.selectedComponent();
    const edge = this.selectedEdge();
    if (selected) return this.renderInspector(selected);
    if (edge) return this.renderEdgeInspector(edge);
    if (!this.canViewHealth()) return this.renderRestrictedPanel('Architecture health', 'Health score, diagnostics totals, and readiness dimensions are hidden from this role.');
    return this.renderHealthPanel();
  }

  renderRestrictedPanel(title, body) {
    return `
      <aside class="right-panel">
        <div class="panel-head">
          <div class="section-title">${esc(title)}</div>
          <div class="subtle" style="font-size:12px">Role: ${esc(ROLE_LABELS[this.activeRole()] || this.activeRole())}</div>
        </div>
        <div class="panel-scroll">
          <div class="card stat">
            <div class="icon-tile" style="color:var(--warn);background:rgba(245,158,11,.14);margin-bottom:12px">${this.icon('shield', 20)}</div>
            <strong>Visibility restricted</strong>
            <div class="subtle" style="font-size:12.5px;margin-top:6px">${esc(body)}</div>
          </div>
          ${this.renderVisibilityMatrix(this.activeSession() || { permissions: this.permissions() })}
        </div>
      </aside>`;
  }

  renderHealthPanel() {
    const health = this.health();
    return `
      <aside class="right-panel">
        <div class="panel-head">
          <div class="section-title">Architecture health</div>
          <div class="subtle" style="font-size:12px">Production readiness snapshot</div>
        </div>
        <div class="panel-scroll">
          <div class="card stat" style="text-align:center">
            <div style="font:800 42px/1 var(--mono);color:${health.score >= 4 ? 'var(--good)' : health.score >= 3 ? 'var(--accent-soft)' : health.score >= 2 ? 'var(--warn)' : 'var(--bad)'}">${health.score.toFixed(1)}</div>
            <div class="subtle">/ 5.0 - ${esc(health.grade)}</div>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:12px">
            ${[
              ['Cost', money(health.cost)],
              ['p99', health.p99],
              ['Availability', health.availability],
              ['Throughput', health.throughput],
              ['SPOFs', String(health.spofs)],
              ['Security', health.secure ? 'Clear' : 'Gaps'],
            ].map(([a, b]) => `<div class="card stat"><div class="subtle">${a}</div><strong>${b}</strong></div>`).join('')}
          </div>
          <div style="margin-top:16px">${health.dims.map((dim) => this.metricRow(dim.name, dim.value.toFixed(1), `${Math.round(dim.value / 5 * 100)}%`, dim.value < 3)).join('')}</div>
          <button class="btn" style="width:100%;margin-top:10px" data-action="toggleProblems">Open diagnostics (${this.diagnostics().length})</button>
        </div>
      </aside>`;
  }

  idealSolution() {
    return IDEAL_SOLUTIONS[this.state.question] || IDEAL_SOLUTIONS.twitter;
  }

  compareToIdealSolution() {
    const ideal = this.idealSolution();
    const idealNames = (ideal.components || []).map((component) => component.name || component);
    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const currentNames = this.state.comps.map((component) => normalize(component.type));
    const matched = idealNames.filter((name) => {
      const idealName = normalize(name);
      return currentNames.some((current) => current.includes(idealName) || idealName.includes(current));
    });
    const diagnostics = this.diagnostics();
    const criticals = diagnostics.filter((item) => item.sev === 'critical').length;
    const coverage = idealNames.length ? Math.round((matched.length / idealNames.length) * 100) : 0;
    const suggestedScore = Math.round(clamp(1 + (coverage / 100) * 3.2 - criticals * 0.35, 1, 5) * 10) / 10;
    return {
      coverage,
      matched,
      missing: idealNames.filter((name) => !matched.includes(name)),
      diagnostics: diagnostics.length,
      criticals,
      suggestedScore,
    };
  }

  renderIdealSolutionPanel() {
    const ideal = this.idealSolution();
    const assessment = this.compareToIdealSolution();
    return `
      <aside class="right-panel ideal-panel">
        <div class="panel-head">
          <div class="section-title">Ideal solution</div>
          <div class="subtle" style="font-size:12px">${esc(ideal.summary)}</div>
          <button class="btn" style="width:100%;margin-top:12px" data-action="toggleIdealSolution">Back to candidate canvas</button>
        </div>
        <div class="panel-scroll">
          <div class="card stat" style="text-align:center;margin-bottom:12px">
            <div class="stat-value">${assessment.coverage}%</div>
            <div class="subtle">candidate coverage vs reference</div>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:12px">
            <div class="card stat"><div class="subtle">Suggested score</div><strong>${assessment.suggestedScore.toFixed(1)} / 5</strong></div>
            <div class="card stat"><div class="subtle">Critical gaps</div><strong>${assessment.criticals}</strong></div>
          </div>
          <div class="card stat" style="margin-bottom:12px">
            <div class="mono-label">Reference components</div>
            <div class="pill-row" style="margin-top:10px">${(ideal.components || []).map((component) => `<span class="pill ${assessment.missing.includes(component.name) ? 'missing-pill' : ''}">${esc(component.name)}</span>`).join('')}</div>
          </div>
          <div class="card stat" style="margin-bottom:12px">
            <div class="mono-label">Reference flows</div>
            ${(ideal.edges || []).map((edge) => `<div class="visibility-row"><span>${esc(edge.from)} -> ${esc(edge.to)}</span><strong>${esc(edge.protocol)}</strong></div>`).join('')}
          </div>
          <div class="card stat" style="margin-bottom:12px">
            <div class="mono-label">Scoring evidence</div>
            ${(ideal.keyPoints || []).map((point) => `<div style="font-size:12.5px;margin-top:7px;color:var(--text-2)">+ ${esc(point)}</div>`).join('')}
          </div>
          <div class="card stat">
            <div class="mono-label">Rubric</div>
            ${(ideal.rubric || []).map((item) => `<div class="visibility-row"><span>${esc(item.dimension)}</span><strong>${item.weight}%</strong></div>`).join('')}
          </div>
        </div>
      </aside>`;
  }

  renderInspector(component) {
    const spec = specFor(component);
    const config = cfgOf(component);
    const tabs = [...spec.tabs.map((tab) => ({ id: tab.id, label: tab.label })), { id: 'metrics', label: 'Metrics' }, { id: 'failure', label: 'Failure' }, { id: 'cost', label: 'Cost' }, { id: 'interview', label: 'Interview' }];
    const active = tabs.some((tab) => tab.id === this.state.inspectorTab) ? this.state.inspectorTab : tabs[0].id;
    const tab = spec.tabs.find((item) => item.id === active);
    return `
      <aside class="right-panel">
        <div class="panel-head">
          <div style="display:flex;gap:11px;align-items:center">
            <span class="icon-tile" style="color:${categoryColor[component.cat]};background:${categoryColor[component.cat]}22">${this.iconForName(component.base || component.type, 20)}</span>
            <div style="min-width:0;flex:1">
              <div class="section-title">${esc(component.type)}</div>
              <div class="subtle" style="font-size:12px">${esc(spec.blurb)}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn danger" data-action="breakSelected" ${this.canInjectFailures() ? '' : 'disabled'}>${this.state.broken.includes(component.id) ? 'Restore component' : 'Break component'}</button>
            <button class="btn" data-action="deleteSelected" ${this.canEdit() ? '' : 'disabled'}>Delete</button>
          </div>
        </div>
        <div class="tabs">${tabs.map((item) => `<button class="tab ${item.id === active ? 'active' : ''}" data-action="tab" data-tab="${esc(item.id)}">${esc(item.label)}</button>`).join('')}</div>
        <div class="panel-scroll">
          ${tab ? tab.groups.map((group) => `<div class="card stat" style="margin-bottom:12px"><div class="mono-label">${esc(group.title)}</div>${group.fields.map((field) => this.renderField(field, component, config)).join('')}</div>`).join('') : ''}
          ${active === 'metrics' ? this.renderMetrics(spec, config) : ''}
          ${active === 'failure' ? spec.failure.map((item) => `<div class="card stat" style="margin-bottom:10px;border-color:rgba(239,68,68,.18)"><strong style="color:var(--bad-2)">${esc(item.l)}</strong><div class="subtle" style="font-size:12px;margin-top:4px">${esc(item.d)}</div></div>`).join('') : ''}
          ${active === 'cost' ? `<div class="card stat"><div class="subtle">Estimated monthly cost</div><div class="stat-value">${money(spec.cost(config, this.loadMult()))}</div><div class="subtle">Cost model changes with replicas, capacity, and simulated load.</div></div>` : ''}
          ${active === 'interview' ? this.renderInterviewTips(spec) : ''}
        </div>
      </aside>`;
  }

  renderField(field, component, config) {
    const value = field.k === 'name' ? component.type : config[field.k];
    const unit = field.unit ? `<span class="subtle">${esc(field.unit)}</span>` : '';
    const disabled = this.canEdit() ? '' : 'disabled';
    if (field.t === 'bool') {
      return `<label class="check-row"><span>${esc(field.l)}</span><input data-field="${esc(field.k)}" type="checkbox" ${value ? 'checked' : ''} ${disabled}></label>`;
    }
    if (field.t === 'sel') {
      return `<label style="display:block;margin-top:10px"><span class="mono-label">${esc(field.l)}</span><select class="select" data-field="${esc(field.k)}" ${disabled}>${field.opts.map((option) => `<option ${String(option) === String(value) ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
    }
    return `<label style="display:block;margin-top:10px"><span style="display:flex;justify-content:space-between"><span class="mono-label">${esc(field.l)}</span>${unit}</span><input class="field" data-field="${esc(field.k)}" type="${field.t === 'num' ? 'number' : 'text'}" value="${esc(value)}" ${disabled}></label>`;
  }

  renderMetrics(spec, config) {
    return spec.metrics(config, this.loadMult()).map((metric) => this.metricRow(metric.l, `${metric.v}${metric.unit || ''}`, `${Math.round(clamp(metric.bar || 0, 0, 1) * 100)}%`, metric.warn)).join('');
  }

  renderInterviewTips(spec) {
    const tips = spec.tips;
    return `
      <div class="card stat" style="margin-bottom:12px"><div class="mono-label">Pros</div>${tips.pros.map((item) => `<div style="font-size:12.5px;margin-top:6px;color:var(--text-2)">+ ${esc(item)}</div>`).join('')}</div>
      <div class="card stat" style="margin-bottom:12px"><div class="mono-label">Cons</div>${tips.cons.map((item) => `<div style="font-size:12.5px;margin-top:6px;color:var(--text-2)">- ${esc(item)}</div>`).join('')}</div>
      <div class="card stat"><div class="mono-label">Follow-ups</div>${tips.followups.map((item) => `<div style="font-size:12.5px;margin-top:8px;color:var(--ai)">${esc(item)}</div>`).join('')}</div>`;
  }

  renderEdgeInspector(edge) {
    const disabled = this.canEdit() ? '' : 'disabled';
    return `
      <aside class="right-panel">
        <div class="panel-head">
          <div class="section-title">Connection</div>
          <div class="subtle">${esc(edge.id)}</div>
          <button class="btn danger" style="width:100%;margin-top:12px" data-action="deleteSelected" ${this.canEdit() ? '' : 'disabled'}>Delete connection</button>
        </div>
        <div class="panel-scroll">
          <label><span class="mono-label">Protocol</span><select class="select" data-edge-field="protocol" ${disabled}>${EDGE_PROTOCOLS.map((item) => `<option ${item === edge.protocol ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label>
          <label style="display:block;margin-top:12px"><span class="mono-label">Serializer</span><select class="select" data-edge-field="serializer" ${disabled}>${EDGE_SERIALIZERS.map((item) => `<option ${item === (edge.serializer || 'JSON') ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label>
          ${['badge', 'retries', 'timeout', 'pool'].map((field) => `<label style="display:block;margin-top:12px"><span class="mono-label">${esc(field)}</span><input class="field" data-edge-field="${esc(field)}" value="${esc(edge[field] || '')}" ${disabled}></label>`).join('')}
          ${['tls', 'compression', 'cb', 'bidir'].map((field) => `<label class="check-row"><span>${esc(field.toUpperCase())}</span><input data-edge-field="${esc(field)}" type="checkbox" ${edge[field] ? 'checked' : ''} ${disabled}></label>`).join('')}
        </div>
      </aside>`;
  }

  renderDiagnostics() {
    const diagnostics = this.diagnostics();
    return `
      <div class="diag-panel card">
        <div class="panel-head" style="display:flex;align-items:center;justify-content:space-between">
          <div><div class="section-title">Diagnostics</div><div class="subtle" style="font-size:12px">Critical, warning, and suggestion issues</div></div>
          <button class="btn icon-btn" data-action="toggleProblems">x</button>
        </div>
        <div class="diag-list">
          ${diagnostics.length ? diagnostics.map((item) => `
            <button class="diag-item" data-action="selectDiagnostic" data-node-id="${esc(item.nodeId || '')}" style="border-left-color:${item.sev === 'critical' ? 'var(--bad)' : item.sev === 'warn' ? 'var(--warn)' : 'var(--accent-2)'};width:100%;text-align:left">
              <div style="display:flex;justify-content:space-between;gap:10px"><strong>${esc(item.title)}</strong><span class="mono-label">${esc(item.sev)}</span></div>
              <div class="subtle" style="font-size:12px;margin-top:4px">${esc(item.node || 'Architecture')} - ${esc(item.impact)}</div>
              <div style="font-size:12px;color:var(--text-2);margin-top:5px">Fix: ${esc(item.fix)}</div>
            </button>`).join('') : '<div class="subtle" style="padding:20px;text-align:center">No problems detected.</div>'}
        </div>
      </div>`;
  }

  renderAiPanel() {
    const hints = this.renderDynamicAiHints();
    return `
      <aside class="right-panel">
        <div class="panel-head"><div class="section-title">AI hints</div><div class="subtle" style="font-size:12px">Critique and follow-up prompts for the interviewer.</div></div>
        <div class="panel-scroll">
          ${hints.map(([title, body, color]) => `<div class="card stat" style="border-left:3px solid ${color};border-radius:0 8px 8px 0;margin-bottom:10px"><strong style="color:${color}">${title}</strong><div class="subtle" style="font-size:12.5px;margin-top:5px">${body}</div></div>`).join('')}
          <button class="btn" style="width:100%" data-action="toggleAi">Back to inspector</button>
        </div>
      </aside>`;
  }

  renderDynamicAiHints() {
    const diagnostics = this.diagnostics();
    const spec = QUESTION_SPEC[this.state.question] || QUESTION_SPEC.twitter;
    const hints = diagnostics.slice(0, 4).map((item) => [
      item.sev === 'critical' ? `Critical: ${item.title}` : item.title,
      `${item.impact} Suggested fix: ${item.fix}`,
      item.sev === 'critical' ? 'var(--bad-2)' : item.sev === 'warn' ? 'var(--warn)' : 'var(--accent-2)',
    ]);
    if (!this.state.comps.some((component) => /Rate Limiter|Gateway/.test(component.type))) {
      hints.push(['Missing control', 'Ask where rate limiting, quota, and abuse controls belong in the request path.', 'var(--accent-2)']);
    }
    if (this.state.traffic) {
      hints.push(['Load follow-up', `Traffic is simulated at x${this.state.traffic}; ask which components saturate first and how they shed load.`, 'var(--warn)']);
    }
    for (const followup of (spec.followups || []).slice(0, 2)) {
      hints.push(['Interview follow-up', followup, 'var(--ai)']);
    }
    return hints.length ? hints.slice(0, 6) : [['Architecture check', 'Ask the candidate to justify the primary bottleneck and failure domain.', 'var(--ai)']];
  }

  renderStatusbar() {
    return `
      <footer class="statusbar">
        <span style="color:var(--good)">Candidate online</span>
        <span>Interviewer online</span>
        <span class="status-chip">${this.state.comps.length} nodes - ${this.state.edges.length} links</span>
        <span class="status-chip">Traffic ${this.state.traffic ? 'x' + this.state.traffic : 'baseline'}</span>
        <span class="status-chip">${this.diagnostics().length} diagnostics</span>
        <span class="spacer"></span>
        <span>Persistence: ${esc(this.state.saveState)}</span>
      </footer>`;
  }

  renderReview() {
    const metrics = [
      ['Components', this.state.comps.length],
      ['Connections', this.state.edges.length],
      ['Data stores', this.state.comps.filter((c) => c.cat === 'Storage').length],
      ['Caches', this.state.comps.filter((c) => /Redis|Cache/.test(c.type)).length],
      ['Queues', this.state.comps.filter((c) => c.cat === 'Messaging').length],
      ['Load balancers', this.state.comps.filter((c) => /Load Balancer/.test(c.type)).length],
    ];
    const scoreKeys = Object.keys(this.state.scores);
    const avg = scoreKeys.reduce((sum, key) => sum + this.state.scores[key], 0) / scoreKeys.length;
    const canSeeScorecard = Boolean(this.visibility().canSeeScorecard);
    const ideal = this.idealSolution();
    const idealAssessment = this.compareToIdealSolution();
    return `
      <div class="app dashboard">
        ${this.renderTopbar('review')}
        <div class="review-layout">
          <main class="review-main">
            <div class="section-head"><div><div class="section-title">Final architecture</div><div class="subtle">Frozen summary for the interview debrief.</div></div><span class="pill">frozen</span></div>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:22px">
              ${metrics.map(([label, value]) => `<div class="card stat"><div class="stat-value">${value}</div><div class="subtle">${label}</div></div>`).join('')}
            </div>
            <div class="mono-label">Components placed</div>
            <div class="pill-row" style="margin:10px 0 24px">${this.state.comps.map((component) => `<span class="pill">${esc(component.type)}</span>`).join('')}</div>
            <div class="mono-label">Generated observations</div>
            ${this.diagnostics().slice(0, 6).map((item) => `<div class="diag-item" style="border-left-color:${item.sev === 'critical' ? 'var(--bad)' : 'var(--warn)'}"><strong>${esc(item.title)}</strong><div class="subtle" style="font-size:12px;margin-top:4px">${esc(item.impact)}</div></div>`).join('')}
            <div class="section-head"><div><div class="section-title">Ideal solution comparison</div><div class="subtle">${esc(ideal.title)}</div></div><span class="pill">${idealAssessment.coverage}% match</span></div>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:18px">
              <div class="card stat"><div class="subtle">Suggested score</div><div class="stat-value">${idealAssessment.suggestedScore.toFixed(1)}</div></div>
              <div class="card stat"><div class="subtle">Missing reference components</div><strong>${idealAssessment.missing.slice(0, 4).join(', ') || 'None'}</strong></div>
              <div class="card stat"><div class="subtle">Critical diagnostics</div><strong>${idealAssessment.criticals}</strong></div>
            </div>
          </main>
          <aside class="review-side">
            ${canSeeScorecard ? `
            <div class="panel-head" style="display:flex;gap:16px;align-items:center">
              <div class="icon-tile" style="width:74px;height:74px;border-radius:999px;background:conic-gradient(var(--accent) 0% ${avg / 5 * 100}%, rgba(255,255,255,.08) ${avg / 5 * 100}% 100%)"><strong style="font:800 22px var(--mono)">${avg.toFixed(1)}</strong></div>
              <div><div class="section-title">Scorecard</div><div class="subtle" style="font-size:12px">Manual interviewer assessment.</div></div>
            </div>
            <div class="panel-scroll">
              ${scoreKeys.map((key) => `<div class="check-row"><span>${esc(key)}</span><span>${[1, 2, 3, 4, 5].map((n) => `<button class="score-dot ${n <= this.state.scores[key] ? 'on' : ''}" data-action="score" data-score-key="${esc(key)}" data-score="${n}"></button>`).join('')}</span></div>`).join('')}
              <div class="mono-label" style="margin-top:18px">Final feedback</div>
              <textarea class="textarea" data-review-field="feedback" aria-label="Overall feedback for the loop debrief" style="margin-top:8px">${esc(this.state.reviewFeedback)}</textarea>
              <div style="display:flex;gap:9px;margin-top:12px">
                <button class="btn good" style="flex:1" data-action="submitted" data-decision="advance">Advance</button>
                <button class="btn danger" style="flex:1" data-action="submitted" data-decision="no-hire">No hire</button>
              </div>
            </div>` : this.renderRestrictedReviewPanel()}
          </aside>
        </div>
      </div>`;
  }

  renderRestrictedReviewPanel() {
    return `
      <div class="panel-head">
        <div class="section-title">Scorecard</div>
        <div class="subtle" style="font-size:12px">Hidden from ${esc(ROLE_LABELS[this.activeRole()] || this.activeRole())}</div>
      </div>
      <div class="panel-scroll">
        <div class="card stat">
          <strong>Review visibility restricted</strong>
          <div class="subtle" style="font-size:12.5px;margin-top:6px">Final scoring, hire/no-hire decision, and feedback are visible only to interviewer or approved panel roles.</div>
        </div>
      </div>`;
  }

  metricRow(label, value, width, warn = false) {
    return `<div class="metric-row"><div class="metric-line"><span>${esc(label)}</span><strong style="font-family:var(--mono);color:${warn ? 'var(--warn)' : 'var(--accent-soft)'}">${esc(value)}</strong></div><div class="bar ${warn ? 'warn' : ''}"><span style="width:${width}"></span></div></div>`;
  }

  async handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) {
      this.handleCanvasClick(event);
      return;
    }
    if (target.disabled) return;
    const action = target.dataset.action;
    if (action === 'authMode') this.setState({ authMode: target.dataset.mode });
    if (action === 'signIn') await this.signIn();
    if (action === 'signOut') this.signOut();
    if (action === 'dashboard') {
      this.closeSharedSocket();
      this.setState({ screen: 'dashboard' });
    }
    if (action === 'setup') this.startNewInterviewSetup(this.state.question);
    if (action === 'workspace') {
      if (this.state.screen === 'dashboard' && target.dataset.question) {
        this.startNewInterviewSetup(target.dataset.question);
        return;
      }
      const session = this.state.screen === 'setup'
        ? await this.persistSessionFromSetup()
        : this.activeSession() || await this.persistSessionFromSetup();
      if (session) this.openWorkspace(session.questionId, { sessionId: session.id });
    }
    if (action === 'resumeSession') {
      const session = this.state.sessions.find((item) => item.id === target.dataset.sessionId);
      if (session) this.openWorkspace(session.questionId, { sessionId: session.id, role: 'interviewer' });
    }
    if (action === 'acceptInvite') {
      const invite = this.state.pendingInvite;
      if (invite) this.openWorkspace(invite.session.questionId, { sessionId: invite.session.id, role: invite.role });
    }
    if (action === 'selectSetupQuestion') {
      const question = questionById(target.dataset.question);
      this.setState({
        question: question.id,
        draft: {
          ...this.state.draft,
          questionId: question.id,
          difficulty: question.diff,
          duration: question.dur,
        },
      });
    }
    if (action === 'questionMode') this.setState({ draft: { ...this.state.draft, questionMode: target.dataset.mode } });
    if (action === 'generateLink') {
      const session = await this.persistSessionFromSetup();
      if (session) this.setState({ screen: 'link' });
    }
    if (action === 'copyLink') await this.copyText(this.state.candidateLink, 'Candidate link copied');
    if (action === 'copyShareLink') await this.copyText(this.state.shareLinks[target.dataset.role], `${ROLE_LABELS[target.dataset.role]} link copied`);
    if (action === 'review' && this.visibility().canSeeScorecard) this.setState({ screen: 'review' });
    if (action === 'submitted') await this.saveReview(target.dataset.decision);
    if (action === 'selectNode') {
      if (this.state.tool === 'connect' && this.canEdit()) this.createConnection(target.dataset.nodeId);
      else this.setState({ selectedId: target.dataset.nodeId, selectedEdgeId: null, inspectorTab: 'general' });
    }
    if (action === 'startConnection' && this.canEdit()) {
      this.setState({ tool: 'connect' });
      this.createConnection(target.dataset.nodeId);
    }
    if (action === 'selectEdge') this.setState({ selectedEdgeId: target.dataset.edgeId, selectedId: null });
    if (action === 'selectDiagnostic') this.setState({ selectedId: target.dataset.nodeId || null, selectedEdgeId: null, problemsOpen: true });
    if (action === 'tab') this.setState({ inspectorTab: target.dataset.tab });
    if (action === 'toggleProblems') this.setState({ problemsOpen: !this.state.problemsOpen });
    if (action === 'toggleAi' && this.canViewAiHints()) this.setState({ aiOpen: !this.state.aiOpen });
    if (action === 'toggleIdealSolution' && this.canSubmitReview()) this.toggleIdealSolution();
    if (action === 'toggleQuestionPanel') this.toggleQuestionPanel();
    if (action === 'tool') this.setState({ tool: target.dataset.tool });
    if (action === 'zoomOut') this.setZoom((this.state.zoom || 1) - 0.25);
    if (action === 'zoomIn') this.setZoom((this.state.zoom || 1) + 0.25);
    if (action === 'traffic' && this.canInjectFailures()) this.setState({ traffic: this.state.traffic ? 0 : Number(target.dataset.value || 1000), problemsOpen: true });
    if (action === 'resetSimulation' && this.canInjectFailures()) this.setState({ traffic: 0, broken: [], constraints: [], problemsOpen: false });
    if (action === 'injectScenario') this.injectScenario(target.dataset.scenario);
    if (action === 'breakSelected') this.toggleBreakSelected();
    if (action === 'deleteSelected') this.deleteSelected();
    if (action === 'deleteComment') this.deleteComment(target.dataset.commentId);
    if (action === 'addComponent') this.addComponent(target.dataset.paletteName, target.dataset.paletteCat);
    if (action === 'score') this.setState({ scores: { ...this.state.scores, [target.dataset.scoreKey]: Number(target.dataset.score) } });
  }

  async signIn() {
    try {
      const body = {
        name: this.state.login.name,
        email: this.state.login.email,
        password: this.state.login.password,
      };
      const auth = this.state.authMode === 'login'
        ? await this.api.login(body)
        : await this.api.signup(body);
      this.api.setToken(auth.token);
      const user = normalizeUser(auth.user);
      this.saveUser(user);
      const list = await this.api.interviews();
      const sessions = list.interviews.map(normalizeSession).filter(Boolean);
      this.saveSessions(sessions);
      this.setState({
        currentUser: user,
        login: { name: user.name, email: user.email, password: '' },
        sessions: this.state.pendingInvite
          ? [this.state.pendingInvite.session, ...sessions.filter((session) => session.id !== this.state.pendingInvite.session.id)]
          : sessions,
        screen: (this.state.pendingInvite || this.state.pendingShareToken) ? 'join' : 'dashboard',
      });
    } catch (error) {
      this.toast(error.message);
    }
  }

  signOut() {
    this.closeSharedSocket();
    this.api.setToken('');
    try {
      this.storage?.removeItem(STORAGE_KEYS.user);
      this.storage?.removeItem(STORAGE_KEYS.sessions);
    } catch {
      // Ignore storage cleanup failures.
    }
    this.setState({
      ...createInitialState({ storage: this.storage, location: this.location }),
      currentUser: null,
      sessions: [],
      screen: 'login',
    });
  }

  async copyText(value, message) {
    if (!value) {
      this.toast('No link available yet');
      return;
    }
    try {
      await this.navigator.clipboard.writeText(value);
      this.toast(message);
    } catch {
      this.toast(value);
    }
  }

  restorePaletteSearchFocus(cursor) {
    const input = this.root.querySelector?.('[data-palette-search]');
    if (!input) return;
    input.focus?.();
    if (typeof input.setSelectionRange === 'function') {
      const position = Math.max(0, Math.min(Number(cursor) || 0, this.state.paletteQuery.length));
      input.setSelectionRange(position, position);
    }
  }

  handleKeyDown(event) {
    const renameInput = event.target?.closest?.('[data-rename-input]');
    if (renameInput) {
      if (event.key === 'Enter') {
        event.preventDefault?.();
        this.commitRename(renameInput.value);
      }
      if (event.key === 'Escape') {
        event.preventDefault?.();
        this.cancelRename();
      }
      return;
    }

    const editable = event.target?.closest?.('input, textarea, select, [contenteditable="true"]');
    if (editable) return;

    if (event.key === 'Escape' && this.state.connectionStartId) {
      event.preventDefault?.();
      this.setState({ connectionStartId: null, tool: 'select' });
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && (this.state.selectedId || this.state.selectedEdgeId)) {
      event.preventDefault?.();
      this.deleteSelected();
    }
  }

  handleDoubleClick(event) {
    if (!this.canEdit()) return;
    const node = event.target.closest('[data-node-id]');
    if (!node || event.target.closest('button, input, textarea, select')) return;
    this.beginRename(node.dataset.nodeId);
  }

  handleWheel(event) {
    const canvas = event.target.closest('[data-canvas]');
    const panel = event.target.closest('.left-panel, .right-panel, .question-panel, .diag-panel, .canvas-comment');
    if (!canvas || panel) return;
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.1 : -0.1;
    this.setZoom((this.state.zoom || 1) + step);
  }

  handleInput(event) {
    const paletteSearch = event.target.closest('[data-palette-search]');
    if (paletteSearch) {
      const cursor = paletteSearch.selectionStart ?? paletteSearch.value.length;
      this.state.paletteQuery = paletteSearch.value;
      this.render();
      this.restorePaletteSearchFocus(cursor);
      return;
    }
    const rename = event.target.closest('[data-rename-input]');
    if (rename) {
      this.state.renameDraft = rename.value;
      return;
    }
    const login = event.target.closest('[data-login-field]');
    if (login) {
      this.state.login = { ...this.state.login, [login.dataset.loginField]: login.value };
      return;
    }
    const sessionField = event.target.closest('[data-session-field]');
    if (sessionField) {
      const value = sessionField.dataset.sessionField === 'duration' ? Number(sessionField.value) : sessionField.value;
      this.state.draft = { ...this.state.draft, [sessionField.dataset.sessionField]: value };
      return;
    }
    const comment = event.target.closest('[data-comment-id]');
    if (comment && event.target.tagName === 'TEXTAREA') {
      this.state.comments = this.state.comments.map((item) => item.id === comment.dataset.commentId ? { ...item, text: event.target.value } : item);
      return;
    }
    const review = event.target.closest('[data-review-field]');
    if (review) {
      this.state.reviewFeedback = review.value;
    }
  }

  handleChange(event) {
    const rename = event.target.closest('[data-rename-input]');
    if (rename) {
      this.commitRename(rename.value);
      return;
    }
    const permission = event.target.closest('[data-permission]');
    if (permission) {
      const permissions = { ...this.state.draft.permissions, [permission.dataset.permission]: permission.checked };
      this.setState({ draft: { ...this.state.draft, permissions } });
      return;
    }
    const sessionField = event.target.closest('[data-session-field]');
    if (sessionField) {
      const value = sessionField.dataset.sessionField === 'duration' ? Number(sessionField.value) : sessionField.value;
      this.setState({ draft: { ...this.state.draft, [sessionField.dataset.sessionField]: value } });
      return;
    }
    const field = event.target.closest('[data-field]');
    if (field && this.state.selectedId && this.canEdit()) {
      const value = field.type === 'checkbox' ? field.checked : field.value;
      this.state.comps = this.state.comps.map((component) => {
        if (component.id !== this.state.selectedId) return component;
        if (field.dataset.field === 'name') return { ...component, type: value };
        return { ...component, props: { ...(component.props || {}), [field.dataset.field]: value } };
      });
      this.render();
      void this.persistArchitecture();
    }
    const edgeField = event.target.closest('[data-edge-field]');
    if (edgeField && this.state.selectedEdgeId && this.canEdit()) {
      const value = edgeField.type === 'checkbox' ? edgeField.checked : edgeField.value;
      this.state.edges = this.state.edges.map((edge) => edge.id === this.state.selectedEdgeId ? { ...edge, [edgeField.dataset.edgeField]: value } : edge);
      this.render();
      void this.persistArchitecture();
    }
    const comment = event.target.closest('[data-comment-id]');
    if (comment && event.target.tagName === 'TEXTAREA') {
      void this.persistArchitecture();
    }
  }

  beginRename(nodeId) {
    if (!nodeId || !this.canEdit()) return;
    const component = this.state.comps.find((item) => item.id === nodeId);
    if (!component) return;
    this.setState({
      selectedId: nodeId,
      selectedEdgeId: null,
      renamingId: nodeId,
      renameDraft: component.type,
    });
  }

  commitRename(value) {
    if (!this.state.renamingId || !this.canEdit()) return;
    const nextName = String(value || '').trim();
    if (!nextName) {
      this.cancelRename();
      return;
    }
    const id = this.state.renamingId;
    this.setState({
      comps: this.state.comps.map((component) => component.id === id ? { ...component, type: nextName } : component),
      selectedId: id,
      selectedEdgeId: null,
      renamingId: null,
      renameDraft: '',
    });
    void this.persistArchitecture();
  }

  cancelRename() {
    this.setState({ renamingId: null, renameDraft: '' });
  }

  toggleQuestionPanel() {
    this.setState({ questionCollapsed: !this.state.questionCollapsed });
  }

  toggleIdealSolution() {
    this.setState({
      idealOpen: !this.state.idealOpen,
      aiOpen: false,
      selectedId: null,
      selectedEdgeId: null,
    });
  }

  handleDragStart(event) {
    if (!this.canEdit()) return;
    const item = event.target.closest('[data-palette-name]');
    if (!item) return;
    event.dataTransfer.setData('application/json', JSON.stringify({ name: item.dataset.paletteName, cat: item.dataset.paletteCat }));
  }

  handleDrop(event) {
    if (!this.canEdit()) return;
    const canvas = event.target.closest('[data-canvas]');
    if (!canvas) return;
    event.preventDefault();
    const payload = JSON.parse(event.dataTransfer.getData('application/json') || '{}');
    const rect = canvas.getBoundingClientRect();
    const point = this.canvasPoint(event.clientX, event.clientY, rect);
    this.addComponent(payload.name, payload.cat, point.x - 75, point.y - 33);
  }

  handlePointerDown(event) {
    if (event.button && event.button !== 0) return;
    if (event.target.closest('.node-connect, [data-rename-input], button, input, textarea, select')) return;
    const canvas = event.target.closest('[data-canvas]');
    if (this.state.tool === 'pan' && canvas) {
      event.preventDefault?.();
      this.drag = { kind: 'pan', x: event.clientX, y: event.clientY, ox: this.state.pan.x, oy: this.state.pan.y };
      return;
    }
    if (!this.canEdit() || this.state.tool === 'connect' || this.state.tool === 'comment') return;
    const node = event.target.closest('[data-node-id]');
    if (!node) return;
    const component = this.state.comps.find((item) => item.id === node.dataset.nodeId);
    if (!component) return;
    event.preventDefault?.();
    this.drag = { kind: 'node', id: component.id, x: event.clientX, y: event.clientY, ox: component.x, oy: component.y };
  }

  handlePointerMove(event) {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.x;
    const dy = event.clientY - this.drag.y;
    if (this.drag.kind === 'pan') {
      this.state.pan = { x: Math.round(this.drag.ox + dx), y: Math.round(this.drag.oy + dy) };
      this.render();
      return;
    }
    if (this.drag.kind === 'node') {
      const zoom = this.state.zoom || 1;
      this.state.comps = this.state.comps.map((component) => component.id === this.drag.id ? { ...component, x: Math.round(this.drag.ox + dx / zoom), y: Math.round(this.drag.oy + dy / zoom) } : component);
      this.render();
    }
  }

  async handlePointerUp() {
    const finished = this.drag;
    this.drag = null;
    if (finished?.kind === 'node') await this.persistArchitecture();
  }

  handleCanvasClick(event) {
    if (this.state.tool !== 'comment' || !this.canEdit()) return;
    const canvas = event.target.closest('[data-canvas]');
    if (!canvas || event.target.closest('[data-node-id], [data-comment-id], .edge-label')) return;
    const rect = canvas.getBoundingClientRect();
    const point = this.canvasPoint(event.clientX, event.clientY, rect);
    this.addCanvasComment(point.x, point.y);
  }

  canvasPoint(clientX, clientY, rect) {
    const zoom = this.state.zoom || 1;
    return {
      x: (clientX - rect.left - this.state.pan.x) / zoom,
      y: (clientY - rect.top - this.state.pan.y) / zoom,
    };
  }

  nextComponentPosition() {
    const index = this.state.comps.length;
    return {
      x: 320 + (index % 3) * 190,
      y: 160 + Math.floor(index / 3) * 96,
    };
  }

  addComponent(name, cat, x = null, y = null) {
    if (!name || !cat || !this.canEdit()) return;
    const id = `c${Date.now()}`;
    const position = x === null || y === null ? this.nextComponentPosition() : { x, y };
    this.setState({
      comps: [...this.state.comps, { id, type: name, cat, x: Math.round(position.x), y: Math.round(position.y), w: 150, props: {} }],
      selectedId: id,
      selectedEdgeId: null,
    });
    void this.persistArchitecture();
  }

  createConnection(nodeId) {
    if (!nodeId || !this.byId()[nodeId]) return;
    if (!this.state.connectionStartId) {
      this.setState({ connectionStartId: nodeId, selectedId: nodeId, selectedEdgeId: null });
      this.toast('Select target component');
      return;
    }
    if (this.state.connectionStartId === nodeId) {
      this.setState({ connectionStartId: null });
      return;
    }
    const edge = {
      id: `e${Date.now()}`,
      from: this.state.connectionStartId,
      to: nodeId,
      protocol: 'gRPC',
      serializer: 'JSON',
      tls: true,
      retries: '2',
      timeout: '500ms',
      pool: '64',
    };
    this.setState({
      edges: [...this.state.edges, edge],
      selectedId: null,
      selectedEdgeId: edge.id,
      connectionStartId: null,
    });
    void this.persistArchitecture();
  }

  addCanvasComment(x, y) {
    const text = typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt('Add architecture comment', 'Investigate this tradeoff')
      : 'Investigate this tradeoff';
    if (!text) return;
    const comment = {
      id: `note-${Date.now()}`,
      x: Math.round(x),
      y: Math.round(y),
      text: String(text).trim(),
    };
    this.setState({ comments: [...this.state.comments, comment] });
    void this.persistArchitecture();
  }

  deleteComment(commentId) {
    if (!commentId || !this.canEdit()) return;
    this.setState({ comments: this.state.comments.filter((comment) => comment.id !== commentId) });
    void this.persistArchitecture();
  }

  injectScenario(id) {
    if (!this.canInjectFailures()) return;
    const ids = (predicate) => this.state.comps.filter(predicate).map((component) => component.id);
    const scenarios = {
      redis: { broken: ids((component) => /Redis|Cache/.test(component.type)), text: 'Redis down' },
      kafka: { broken: ids((component) => /Kafka|Pub\/Sub/.test(component.type)), text: 'Kafka broker dies' },
      db: { broken: ids((component) => component.cat === 'Storage' && !/Redis|S3/.test(component.type)), text: 'DB outage' },
      spike: { traffic: 1000, text: 'Traffic x1000 spike' },
    };
    const scenario = scenarios[id] || scenarios.spike;
    this.setState({
      broken: scenario.broken ? Array.from(new Set([...this.state.broken, ...scenario.broken])) : this.state.broken,
      traffic: scenario.traffic || this.state.traffic,
      constraints: [...this.state.constraints, scenario.text],
      problemsOpen: true,
    });
    void this.persistArchitecture();
  }

  toggleBreakSelected() {
    if (!this.canInjectFailures()) return;
    const id = this.state.selectedId;
    if (!id) return;
    const broken = this.state.broken.includes(id)
      ? this.state.broken.filter((item) => item !== id)
      : [...this.state.broken, id];
    this.setState({ broken });
    void this.persistArchitecture();
  }

  deleteSelected() {
    if (!this.canEdit()) return;
    if (this.state.selectedId) {
      const id = this.state.selectedId;
      this.setState({
        comps: this.state.comps.filter((item) => item.id !== id),
        edges: this.state.edges.filter((edge) => edge.from !== id && edge.to !== id),
        selectedId: null,
      });
      void this.persistArchitecture();
    }
    if (this.state.selectedEdgeId) {
      this.setState({ edges: this.state.edges.filter((edge) => edge.id !== this.state.selectedEdgeId), selectedEdgeId: null });
      void this.persistArchitecture();
    }
  }

  diagnostics() {
    return runValidation({ comps: this.state.comps, edges: this.state.edges, byId: this.byId() });
  }

  health() {
    const diagnostics = this.diagnostics();
    const score = scoreArchitecture({ comps: this.state.comps, edges: this.state.edges }, diagnostics, this.loadMult());
    const totalCost = this.state.comps.reduce((sum, component) => {
      const spec = specFor(component);
      return sum + spec.cost(cfgOf(component), this.loadMult());
    }, 0);
    const spofs = this.state.comps.filter((component) => {
      const config = cfgOf(component);
      return (component.cat === 'Storage' || /Load Balancer|Redis|Kafka/.test(component.type))
        && !((+config.replicas > 0) || (+config.rf > 1) || (+config.members > 1) || config.multiAz);
    }).length;
    return {
      score: score.overall,
      grade: score.overall >= 4.3 ? 'Production-ready' : score.overall >= 3.5 ? 'Solid, with gaps' : score.overall >= 2.5 ? 'Needs hardening' : 'Fragile',
      dims: Object.entries(score.dims).map(([name, value]) => ({ name, value })),
      cost: totalCost,
      p99: this.state.traffic > 100 ? '~480 ms' : this.state.traffic ? '~120 ms' : '~55 ms',
      availability: score.dims.Availability >= 4 ? '99.99%' : score.dims.Availability >= 3 ? '99.95%' : '99.5%',
      throughput: `${Math.max(20, this.state.comps.filter((item) => item.cat === 'Compute').length * 20)}K RPS`,
      spofs,
      secure: diagnostics.filter((item) => item.sev === 'critical').length === 0,
    };
  }

  affectedNodes() {
    const graph = {};
    for (const edge of this.state.edges) {
      graph[edge.from] = graph[edge.from] || [];
      graph[edge.from].push(edge.to);
    }
    const affected = new Set();
    const queue = [...this.state.broken];
    while (queue.length) {
      const node = queue.shift();
      for (const next of graph[node] || []) {
        if (!affected.has(next) && !this.state.broken.includes(next)) {
          affected.add(next);
          queue.push(next);
        }
      }
    }
    return affected;
  }

  byId() {
    return Object.fromEntries(this.state.comps.map((component) => [component.id, component]));
  }

  selectedComponent() {
    return this.state.comps.find((component) => component.id === this.state.selectedId);
  }

  selectedEdge() {
    return this.state.edges.find((edge) => edge.id === this.state.selectedEdgeId);
  }

  loadMult() {
    return this.state.traffic >= 1000 ? 24 : this.state.traffic ? 6 : 1;
  }

  iconForName(name, size = 18) {
    const key = ITEM_ICON[name] || name;
    return this.icon(key, size);
  }

  icon(key, size = 18) {
    const glyph = ICONS[key] || ICONS.cube;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${glyph.fill ? 'currentColor' : 'none'}" stroke="${glyph.fill ? 'none' : 'currentColor'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph.d}</svg>`;
  }

  toast(message) {
    this.setState({ toast: message });
    window.setTimeout(() => {
      this.state.toast = '';
      this.render();
    }, 1600);
  }
}

if (typeof document !== 'undefined') {
  const root = $('#app');
  if (root) {
    const app = new SystemDesignStudio(root);
    app.mount();
  }
}
