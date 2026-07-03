import assert from 'node:assert/strict';

import {
  SystemDesignStudio,
  createDefaultDraft,
  createSessionFromDraft,
} from '../public/app.js';

function root() {
  return { innerHTML: '', addEventListener() {} };
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
