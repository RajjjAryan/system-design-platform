import assert from 'node:assert/strict';

import {
  SystemDesignStudio,
  createInitialState,
  createDefaultDraft,
  createSessionFromDraft,
} from '../public/app.js';
import { QUESTIONS } from '../public/sds-data.js';

function root() {
  return { innerHTML: '', addEventListener() {} };
}

function eventTargetWithClosest(matches = {}) {
  return {
    tagName: 'DIV',
    closest(selector) {
      return matches[selector] || null;
    },
  };
}

function canvasTarget(rect = { left: 0, top: 0 }) {
  const canvas = {
    getBoundingClientRect() {
      return { left: rect.left, top: rect.top };
    },
  };
  return {
    canvas,
    target: {
      tagName: 'DIV',
      closest(selector) {
        if (selector === '[data-canvas]') return canvas;
        return null;
      },
    },
  };
}

function storage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.get(key) || null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

const owner = { name: 'Neha Rao', email: 'neha@example.com' };

{
  const state = createInitialState({
    storage: storage(),
    location: new URL('https://studio.example.test/?reset=reset-token'),
  });

  assert.equal(state.screen, 'login');
  assert.equal(state.authMode, 'reset');
  assert.equal(state.pendingResetToken, 'reset-token');
  assert.equal(state.authNotice, 'Enter a new password to complete the reset.');
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/?verify=verify-token'),
    api: {
      async verifyEmail(body) {
        assert.deepEqual(body, { token: 'verify-token' });
        return { verified: true, user: { name: 'Verified User', email: 'verified@example.com' } };
      },
      token() {
        return '';
      },
    },
  });

  await app.bootstrapFromApi();

  assert.equal(app.state.pendingVerifyToken, '');
  assert.equal(app.state.authMode, 'login');
  assert.equal(app.state.login.email, 'verified@example.com');
  assert.equal(app.state.authNotice, 'Email verified. Sign in to continue.');
}

{
  const calls = [];
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/?reset=reset-token'),
    api: {
      async resetPassword(body) {
        calls.push(body);
        return { reset: true };
      },
    },
  });
  app.state.login.password = 'new correct horse battery staple';

  await app.resetPassword();

  assert.deepEqual(calls, [{ token: 'reset-token', password: 'new correct horse battery staple' }]);
  assert.equal(app.state.pendingResetToken, '');
  assert.equal(app.state.authMode, 'login');
  assert.equal(app.state.authNotice, 'Password updated. Sign in with the new password.');
}

{
  const calls = [];
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {
      async requestPasswordReset(body) {
        calls.push(body);
        return { sent: true };
      },
    },
  });
  app.state.authMode = 'forgot';
  app.state.login.email = 'neha@example.com';

  await app.requestPasswordReset();

  assert.deepEqual(calls, [{ email: 'neha@example.com' }]);
  assert.equal(app.state.authMode, 'login');
  assert.equal(app.state.authNotice, 'If that account exists, a password reset link has been sent.');
}

{
  let tokenValue = 'not-called';
  let interviewsCalled = false;
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {
      setToken(value) {
        tokenValue = value;
      },
      async signup() {
        return {
          verificationRequired: true,
          token: 'signup-token',
          user: { name: 'Neha Rao', email: 'neha@example.com', emailVerified: false },
        };
      },
      async interviews() {
        interviewsCalled = true;
        return { interviews: [] };
      },
    },
  });
  app.state.authMode = 'signup';
  app.state.login = { name: 'Neha Rao', email: 'neha@example.com', password: 'correct horse battery staple' };

  await app.signIn();

  assert.equal(tokenValue, '');
  assert.equal(interviewsCalled, false);
  assert.equal(app.state.authMode, 'login');
  assert.equal(app.state.authNotice, 'Check your email to verify the account before signing in.');
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'login';
  app.state.authMode = 'signup';
  app.state.login.password = 'short';

  const login = app.renderLogin();

  assert.equal(login.includes('data-action="togglePasswordVisibility"'), true);
  assert.equal(login.includes('Create account'), true);
  assert.equal(login.includes('Create an interview'), true);
  assert.equal(login.includes('Share candidate link'), true);
  assert.equal(login.includes('Use at least 12 characters'), true);
  assert.equal(login.includes('data-password-rule="minLength"'), true);

  app.togglePasswordVisibility();
  assert.equal(app.state.passwordVisible, true);
  assert.equal(app.renderLogin().includes('type="text"'), true);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {
      async signup() {
        const error = new Error('Password does not meet the requirements');
        error.details = { password: ['Use at least 12 characters'] };
        throw error;
      },
    },
  });
  app.state.screen = 'login';
  app.state.authMode = 'signup';
  app.state.login = { name: 'Neha Rao', email: 'neha@example.com', password: 'short' };

  await app.signIn();

  assert.equal(app.state.authError, 'Password does not meet the requirements');
  assert.deepEqual(app.state.authDetails.password, ['Use at least 12 characters']);
  assert.equal(app.renderLogin().includes('Password does not meet the requirements'), true);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.currentUser = owner;
  app.state.draft = createDefaultDraft(owner, 'payment');
  app.state.draft.candidateName = 'Sam Lee';
  app.state.draft.candidateEmail = 'sam@example.com';
  app.state.comps = [{ id: 'old-api', type: 'API Service', cat: 'Compute', x: 20, y: 20 }];
  app.state.edges = [{ id: 'old-edge', from: 'old-api', to: 'old-db', protocol: 'HTTP' }];
  app.state.comments = [{ id: 'old-comment', x: 30, y: 30, text: 'belongs to another interview' }];

  const payload = app.sessionPayloadFromDraft();
  assert.equal(payload.questionId, 'payment');
  assert.equal(payload.architecture.comps.length, 0);
  assert.equal(payload.architecture.edges.length, 0);
  assert.equal(payload.architecture.comments.length, 0);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.currentUser = owner;
  app.state.activeSessionId = 'old-session';
  app.state.draft = { ...createDefaultDraft(owner, 'twitter'), candidateName: 'Old Candidate' };
  app.state.comps = [{ id: 'old-api', type: 'API Service', cat: 'Compute', x: 20, y: 20 }];
  app.state.edges = [{ id: 'old-edge', from: 'old-api', to: 'old-db', protocol: 'HTTP' }];
  app.state.comments = [{ id: 'old-comment', x: 30, y: 30, text: 'old note' }];

  app.startNewInterviewSetup('payment');

  assert.equal(app.state.screen, 'setup');
  assert.equal(app.state.activeSessionId, null);
  assert.equal(app.state.draft.questionId, 'payment');
  assert.equal(app.state.draft.candidateName, '');
  assert.equal(app.state.comps.length, 0);
  assert.equal(app.state.edges.length, 0);
  assert.equal(app.state.comments.length, 0);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.currentUser = owner;
  app.state.draft = createDefaultDraft(owner, 'payment');
  app.state.draft.questionMode = 'custom';
  app.state.draft.customPrompt = 'Design realtime fraud detection for card payments\nFlag suspicious authorizations before capture.';

  const payload = app.sessionPayloadFromDraft();

  assert.equal(payload.title, 'Design realtime fraud detection for card payments');
  assert.equal(payload.prompt, 'Design realtime fraud detection for card payments\nFlag suspicious authorizations before capture.');
  assert.equal(payload.questionId, 'payment');
}

{
  const draft = createDefaultDraft(owner, 'payment');
  draft.candidateName = 'Sam Lee';
  const blankSession = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });
  blankSession.architecture = { comps: [], edges: [], comments: [] };

  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.sessions = [blankSession];
  app.state.activeSessionId = blankSession.id;

  app.openWorkspace('payment', { sessionId: blankSession.id, role: 'interviewer' });

  assert.equal(app.state.question, 'payment');
  assert.equal(app.state.comps.length, 0);
  assert.equal(app.state.edges.length, 0);
  assert.equal(app.root.innerHTML.includes('Design Twitter'), false);
}

{
  const draft = createDefaultDraft(owner, 'payment');
  draft.candidateName = 'Sam Lee';
  const customSession = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });
  customSession.title = 'Design realtime fraud detection for card payments';
  customSession.prompt = 'Design realtime fraud detection for card payments\nFlag suspicious authorizations before capture.';
  customSession.architecture = { comps: [], edges: [], comments: [] };

  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.sessions = [customSession];
  app.state.activeSessionId = customSession.id;

  app.openWorkspace('payment', { sessionId: customSession.id, role: 'interviewer' });

  assert.equal(app.root.innerHTML.includes('Design realtime fraud detection for card payments'), true);
  assert.equal(app.root.innerHTML.includes('Money movement, exactly once.'), false);
}

{
  const draft = createDefaultDraft(owner, 'payment');
  draft.candidateName = 'Sam Lee';
  const session = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });
  session.permissions = { ...session.permissions, aiHintsInterviewerOnly: true };

  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.sessions = [session];
  app.state.activeSessionId = session.id;
  app.state.role = 'candidate';
  app.state.visibility = {
    canSeeQuestion: true,
    canSeeArchitecture: true,
    canEditCanvas: true,
    canSeeHealth: false,
    canInjectFailures: false,
    canSeeAiHints: false,
    canSeeScorecard: false,
  };

  const topbar = app.renderTopbar('workspace');

  assert.equal(topbar.includes('Candidate screen'), false);
  assert.equal(topbar.includes('Interviewer screen'), false);
  assert.equal(topbar.includes('AI hints'), false);
  assert.equal(topbar.includes('Finish & review'), false);
  assert.equal(topbar.includes('Simulate'), false);
  assert.equal(topbar.includes('Traffic'), false);
  assert.equal(topbar.includes('Redis down'), false);
  assert.equal(topbar.includes('Break'), false);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.comps = [
    { id: 'api', type: 'API Service', cat: 'Compute', x: 120, y: 120 },
    { id: 'db', type: 'PostgreSQL', cat: 'Storage', x: 360, y: 120 },
  ];
  app.state.edges = [];
  app.state.zoom = 1;

  const topbar = app.renderTopbar('workspace');
  const canvas = app.renderCanvas();

  assert.equal(topbar.includes('data-action="zoomOut"'), true);
  assert.equal(topbar.includes('data-action="zoomIn"'), true);
  assert.equal(topbar.includes('100%'), true);
  assert.equal(canvas.includes('scale(${this.state.zoom})'), false);
  assert.equal(canvas.includes('scale(1)'), true);
  assert.equal(canvas.includes('data-action="startConnection"'), true);

  app.setZoom(1.25);
  assert.equal(app.state.zoom, 1.25);
  assert.equal(app.renderCanvas().includes('scale(1.25)'), true);
}

{
  const draft = createDefaultDraft(owner, 'payment');
  draft.candidateName = 'Sam Lee';
  const stale = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });
  stale.updatedAt = '2026-07-03T08:00:00.000Z';
  stale.architecture = {
    comps: [{ id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 100 }],
    edges: [],
    comments: [],
  };
  const fresh = {
    ...stale,
    updatedAt: '2026-07-03T08:01:00.000Z',
    architecture: {
      comps: [
        { id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 100 },
        { id: 'db', type: 'PostgreSQL', cat: 'Storage', x: 340, y: 130 },
      ],
      edges: [{ id: 'e1', from: 'api', to: 'db', protocol: 'SQL/TLS' }],
      comments: [{ id: 'n1', x: 240, y: 80, text: 'Candidate added persistence.' }],
    },
  };
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {
      token() {
        return 'owner-token';
      },
      async interviews() {
        return { interviews: [fresh] };
      },
    },
  });
  app.state.sessions = [stale];
  app.state.activeSessionId = stale.id;
  app.openWorkspace('payment', { sessionId: stale.id, role: 'interviewer' });

  await app.refreshActiveSession({ force: true });

  assert.equal(app.state.comps.length, 2);
  assert.equal(app.state.edges.length, 1);
  assert.equal(app.state.comments[0].text, 'Candidate added persistence.');
}

{
  const draft = createDefaultDraft(owner, 'payment');
  draft.candidateName = 'Sam Lee';
  const session = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });
  let latestSession = session;
  const openedSockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.listeners = {};
      openedSockets.push(this);
    }

    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }

    close() {
      this.readyState = 3;
    }
  }

  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    WebSocket: FakeWebSocket,
    api: {
      baseUrl: 'https://api.example.test',
      token() {
        return 'owner-token';
      },
      async interviews() {
        return { interviews: [latestSession] };
      },
    },
  });
  app.state.sessions = [session];
  app.state.activeSessionId = session.id;

  app.openWorkspace('payment', { sessionId: session.id, role: 'interviewer' });

  assert.equal(openedSockets.length, 1);
  assert.equal(openedSockets[0].url, `wss://api.example.test/api/ws/interviews/${session.id}?auth=owner-token`);

  latestSession = {
    ...session,
    updatedAt: '2099-01-01T00:00:00.000Z',
    architecture: {
      comps: [{ id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 120 }],
      edges: [],
      comments: [],
    },
  };
  openedSockets[0].listeners.message({
    data: JSON.stringify({ type: 'interview.updated', interviewId: session.id }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(app.state.comps.length, 1);
  assert.equal(app.state.comps[0].type, 'API Service');
}

{
  const persisted = [];
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {
      async updateInterview(id, body) {
        persisted.push({ id, body });
        return { interview: app.activeSession() };
      },
    },
  });
  const session = createSessionFromDraft({ user: owner, draft: createDefaultDraft(owner, 'payment'), questionId: 'payment' });
  app.state.sessions = [session];
  app.state.activeSessionId = session.id;
  app.state.screen = 'workspace';
  app.state.comps = [
    { id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 120 },
    { id: 'db', type: 'PostgreSQL', cat: 'Storage', x: 340, y: 120 },
  ];
  app.state.edges = [{ id: 'edge-1', from: 'api', to: 'db', protocol: 'SQL/TLS' }];
  app.state.selectedEdgeId = 'edge-1';

  let prevented = false;
  app.handleKeyDown({
    key: 'Delete',
    target: eventTargetWithClosest(),
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(app.state.edges.length, 0);
  assert.equal(app.state.selectedEdgeId, null);
  assert.equal(persisted.length, 1);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.comps = [
    { id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 120 },
    { id: 'db', type: 'PostgreSQL', cat: 'Storage', x: 340, y: 120 },
  ];
  app.state.edges = [{ id: 'edge-1', from: 'api', to: 'db', protocol: 'SQL/TLS' }];
  app.state.selectedId = 'api';

  app.handleKeyDown({
    key: 'Backspace',
    target: eventTargetWithClosest(),
    preventDefault() {},
  });

  assert.equal(app.state.comps.some((component) => component.id === 'api'), false);
  assert.equal(app.state.edges.length, 0);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.comps = [{ id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 120 }];

  app.beginRename('api');
  assert.equal(app.renderNode(app.state.comps[0], [], new Set()).includes('data-rename-input'), true);

  app.handleInput({
    target: {
      value: 'Ingress API',
      closest(selector) {
        return selector === '[data-rename-input]' ? this : null;
      },
    },
  });
  app.handleKeyDown({
    key: 'Enter',
    target: eventTargetWithClosest({ '[data-rename-input]': { value: 'Ingress API' } }),
    preventDefault() {},
  });

  assert.equal(app.state.comps[0].type, 'Ingress API');
  assert.equal(app.state.renamingId, null);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.question = 'payment';

  const expanded = app.renderCanvas();
  assert.equal(expanded.includes('data-action="toggleQuestionPanel"'), true);
  assert.equal(expanded.includes('creates payment intents'), true);

  app.toggleQuestionPanel();
  const collapsed = app.renderCanvas();
  assert.equal(collapsed.includes('Show question'), true);
  assert.equal(collapsed.includes('creates payment intents'), false);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.zoom = 1;

  let prevented = false;
  app.handleWheel({
    deltaY: -120,
    target: eventTargetWithClosest({ '[data-canvas]': true }),
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.ok(app.state.zoom > 1);
}

{
  const fakeSearch = {
    focused: false,
    selection: null,
    focus() {
      this.focused = true;
    },
    setSelectionRange(start, end) {
      this.selection = [start, end];
    },
  };
  const searchRoot = {
    innerHTML: '',
    addEventListener() {},
    querySelector(selector) {
      return selector === '[data-palette-search]' ? fakeSearch : null;
    },
  };
  const app = new SystemDesignStudio(searchRoot, {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  const eventSearch = {
    value: 'api gateway',
    selectionStart: 11,
    closest(selector) {
      return selector === '[data-palette-search]' ? this : null;
    },
  };

  app.handleInput({ target: eventSearch });

  assert.equal(app.state.paletteQuery, 'api gateway');
  assert.equal(fakeSearch.focused, true);
  assert.deepEqual(fakeSearch.selection, [11, 11]);
  assert.equal(app.renderPalette().includes('API Gateway'), true);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.selectedEdgeId = 'edge-1';
  app.state.edges = [{ id: 'edge-1', from: 'api', to: 'db', protocol: 'SQL/TLS' }];

  const inspector = app.renderEdgeInspector(app.state.edges[0]);

  assert.equal(inspector.includes('data-action="deleteSelected"'), true);
  assert.equal(inspector.includes('Delete connection'), true);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.role = 'interviewer';
  app.state.question = 'twitter';
  app.state.comps = [
    { id: 'client', type: 'Web Client', cat: 'Frontend', x: 80, y: 120 },
    { id: 'api', type: 'API Gateway', cat: 'API', x: 280, y: 120 },
    { id: 'cache', type: 'Redis', cat: 'Storage', x: 480, y: 120 },
  ];

  assert.equal(app.renderTopbar('workspace').includes('data-action="toggleIdealSolution"'), true);
  app.toggleIdealSolution();
  assert.equal(app.state.idealOpen, true);
  const panel = app.renderRightPanel();
  assert.equal(panel.includes('Ideal solution'), true);
  assert.equal(panel.includes('Suggested score'), true);
  assert.equal(app.compareToIdealSolution().coverage > 0, true);
}

{
  const local = storage();
  const draft = createDefaultDraft(owner, 'payment');
  const session = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });
  const app = new SystemDesignStudio(root(), {
    storage: local,
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.sessions = [session];
  app.state.activeSessionId = session.id;

  app.openWorkspace('payment', { sessionId: session.id, role: 'candidate' });

  assert.equal(app.state.demoOpen, true);
  assert.equal(app.renderWorkspace().includes('data-action="dismissDemo"'), true);
  assert.equal(app.renderWorkspace().includes('Drag components from the palette'), true);

  app.dismissDemo();
  assert.equal(app.state.demoOpen, false);
  assert.equal(local.getItem('sds.demoDismissed'), 'true');
}

{
  const local = storage();
  const draft = createDefaultDraft(owner, 'payment');
  const session = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });
  session.permissions = { ...session.permissions, allowCandidateEdit: false };
  const app = new SystemDesignStudio(root(), {
    storage: local,
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.sessions = [session];
  app.state.activeSessionId = session.id;
  app.state.visibility = {
    canSeeQuestion: true,
    canSeeArchitecture: true,
    canEditCanvas: false,
    canSeeHealth: false,
    canInjectFailures: false,
    canSeeAiHints: false,
    canSeeScorecard: false,
  };

  app.openWorkspace('payment', { sessionId: session.id, role: 'candidate' });

  assert.equal(app.renderCandidateDemo().includes('Review the question'), true);
  assert.equal(app.renderCandidateDemo().includes('Drag components from the palette'), false);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.currentUser = owner;
  app.state.draft = createDefaultDraft(owner, 'payment');
  app.state.setupQuery = '';

  const setup = app.renderSetup();

  assert.equal(setup.includes('data-setup-search'), true);
  for (const question of QUESTIONS) {
    assert.equal(setup.includes(question.title), true, `Expected setup to include ${question.title}`);
  }

  app.state.setupQuery = 'payment ledger';
  const filtered = app.renderSetup();
  assert.equal(filtered.includes('Design Payment System'), true);
  assert.equal(filtered.includes('Design Twitter'), false);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  const session = createSessionFromDraft({ user: owner, draft: createDefaultDraft(owner, 'payment'), questionId: 'payment' });

  const card = app.renderSessionCard(session);

  assert.equal(card.includes('data-action="resumeSession"'), true);
  assert.equal(card.includes('data-action="openShareLinks"'), true);
  assert.equal(card.includes('data-action="archiveSession"'), true);
  assert.equal(card.includes('data-action="deleteSession"'), true);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.presence = { candidate: 1, interviewer: 0, panel: 0 };
  app.state.syncState = 'live';

  const status = app.renderStatusbar();

  assert.equal(status.includes('Candidate online'), true);
  assert.equal(status.includes('Interviewer offline'), true);
  assert.equal(status.includes('Sync: live'), true);
  assert.equal(status.includes('Persistence: idle'), true);
}

{
  const draft = createDefaultDraft(owner, 'payment');
  const session = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });
  const openedSockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.listeners = {};
      openedSockets.push(this);
    }

    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }

    close() {
      this.readyState = 3;
    }
  }

  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    WebSocket: FakeWebSocket,
    api: {
      baseUrl: 'https://api.example.test',
      token() {
        return 'owner-token';
      },
      async interviews() {
        return { interviews: [session] };
      },
    },
  });
  app.state.sessions = [session];
  app.state.activeSessionId = session.id;

  app.openWorkspace('payment', { sessionId: session.id, role: 'interviewer' });
  openedSockets[0].listeners.message({
    data: JSON.stringify({
      type: 'connected',
      role: 'interviewer',
      presence: { interviewer: 1, candidate: 0, panel: 0 },
    }),
  });

  assert.equal(app.state.syncState, 'live');
  assert.deepEqual(app.state.presence, { interviewer: 1, candidate: 0, panel: 0 });

  openedSockets[0].listeners.message({
    data: JSON.stringify({
      type: 'presence.updated',
      presence: { interviewer: 1, candidate: 1, panel: 0 },
    }),
  });
  assert.equal(app.state.presence.candidate, 1);
}

{
  let expectedTimestamp = '';
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {
      async updateInterview(id, body) {
        expectedTimestamp = body.expectedUpdatedAt;
        return {
          interview: {
            ...app.activeSession(),
            architecture: body.architecture,
            updatedAt: '2026-07-03T08:10:00.000Z',
          },
        };
      },
    },
  });
  const session = createSessionFromDraft({ user: owner, draft: createDefaultDraft(owner, 'payment'), questionId: 'payment' });
  session.updatedAt = '2026-07-03T08:00:00.000Z';
  app.state.sessions = [session];
  app.state.activeSessionId = session.id;
  app.state.comps = [{ id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 120 }];

  await app.persistArchitecture();

  assert.equal(expectedTimestamp, '2026-07-03T08:00:00.000Z');
  assert.equal(app.state.saveState, 'saved');
}

{
  const serverSession = createSessionFromDraft({ user: owner, draft: createDefaultDraft(owner, 'payment'), questionId: 'payment' });
  serverSession.updatedAt = '2026-07-03T08:12:00.000Z';
  serverSession.architecture = {
    comps: [{ id: 'server-api', type: 'Server API', cat: 'Compute', x: 100, y: 120 }],
    edges: [],
    comments: [],
  };
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {
      async updateInterview() {
        const error = new Error('Interview changed since you loaded it');
        error.status = 409;
        error.current = serverSession;
        throw error;
      },
    },
  });
  const localSession = createSessionFromDraft({ user: owner, draft: createDefaultDraft(owner, 'payment'), questionId: 'payment' });
  localSession.id = serverSession.id;
  localSession.updatedAt = '2026-07-03T08:00:00.000Z';
  app.state.sessions = [localSession];
  app.state.activeSessionId = localSession.id;
  app.state.screen = 'workspace';
  app.state.comps = [{ id: 'local-api', type: 'Local API', cat: 'Compute', x: 100, y: 120 }];

  await app.persistArchitecture();

  assert.equal(app.state.saveState, 'conflict');
  assert.equal(app.state.comps[0].id, 'server-api');
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {
      async updateInterview() {
        throw new Error('Review should not save without feedback');
      },
    },
  });
  const session = createSessionFromDraft({ user: owner, draft: createDefaultDraft(owner, 'payment'), questionId: 'payment' });
  app.state.sessions = [session];
  app.state.activeSessionId = session.id;
  app.state.reviewFeedback = 'too short';

  await app.saveReview('advance');

  assert.equal(app.state.reviewDecision, '');
  assert.equal(app.state.toast, 'Add specific feedback before submitting the review');
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.comps = [
    { id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 120, w: 150 },
    { id: 'db', type: 'PostgreSQL', cat: 'Storage', x: 360, y: 120, w: 150 },
  ];
  app.state.edges = [];

  const sourceNode = { dataset: { nodeId: 'api' } };
  const connectButton = {
    dataset: { nodeId: 'api' },
    closest(selector) {
      if (selector === '.node-connect') return this;
      if (selector === '[data-node-id]') return sourceNode;
      return null;
    },
  };
  app.handlePointerDown({
    button: 0,
    clientX: 175,
    clientY: 153,
    target: connectButton,
    preventDefault() {},
  });
  app.handlePointerMove({ clientX: 435, clientY: 153 });
  await app.handlePointerUp({
    target: eventTargetWithClosest({ '[data-node-id]': { dataset: { nodeId: 'db' } } }),
  });

  assert.equal(app.state.edges.length, 1);
  assert.equal(app.state.edges[0].from, 'api');
  assert.equal(app.state.edges[0].to, 'db');
  assert.equal(app.state.connectionStartId, null);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.comps = [
    { id: 'api', type: 'API Service', cat: 'Compute', x: 100, y: 120, w: 150 },
    { id: 'db', type: 'PostgreSQL', cat: 'Storage', x: 360, y: 120, w: 150 },
  ];
  app.state.edges = [{ id: 'edge-1', from: 'api', to: 'db', protocol: 'gRPC' }];

  app.beginEdgeProtocolEdit('edge-1');
  assert.equal(app.renderEdgeLabel(app.state.edges[0], app.byId()).includes('data-edge-protocol-select'), true);
  app.commitEdgeProtocol('HTTP');
  assert.equal(app.state.edges[0].protocol, 'HTTP');
  assert.equal(app.state.editingEdgeId, null);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  const { target } = canvasTarget();

  app.handleDoubleClick({
    clientX: 240,
    clientY: 180,
    target,
  });

  assert.equal(app.state.comments.length, 1);
  assert.equal(app.state.comments[0].text, '');
  assert.equal(app.renderComments().includes('data-comment-id'), true);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.zoom = 1;
  app.state.pan = { x: 0, y: 0 };
  const { target } = canvasTarget();

  app.handleWheel({
    deltaY: -120,
    clientX: 200,
    clientY: 100,
    target,
    preventDefault() {},
  });

  assert.equal(app.state.zoom, 1.1);
  assert.equal(app.state.pan.x, -20);
  assert.equal(app.state.pan.y, -10);
}

{
  const app = new SystemDesignStudio(root(), {
    storage: storage(),
    location: new URL('https://studio.example.test/'),
    api: {},
  });
  app.state.screen = 'workspace';
  app.state.tool = 'comment';
  const { target } = canvasTarget();

  app.handleCanvasClick({
    clientX: 240,
    clientY: 180,
    target,
  });

  assert.equal(app.state.comments.length, 1);
  assert.equal(app.state.comments[0].text, '');
}
