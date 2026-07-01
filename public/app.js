import { ICONS, ITEM_ICON, PALETTE, QUESTION_SPEC, QUESTIONS, SEED } from './sds-data.js';
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

class SystemDesignStudio {
  constructor(root) {
    this.root = root;
    this.state = {
      screen: 'dashboard',
      question: 'twitter',
      comps: SEED.comps.map((component) => ({ ...component, props: { ...(component.props || {}) } })),
      edges: SEED.edges.map((edge) => ({ ...edge })),
      selectedId: null,
      selectedEdgeId: null,
      inspectorTab: 'general',
      broken: [],
      traffic: 0,
      constraints: [],
      problemsOpen: false,
      aiOpen: false,
      candidateLink: 'https://systemdesign.studio/i/twitter-priya',
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
    this.drag = null;
  }

  mount() {
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('change', (event) => this.handleChange(event));
    this.root.addEventListener('dragstart', (event) => this.handleDragStart(event));
    this.root.addEventListener('dragover', (event) => {
      if (event.target.closest('[data-canvas]')) event.preventDefault();
    });
    this.root.addEventListener('drop', (event) => this.handleDrop(event));
    this.root.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    window.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    window.addEventListener('pointerup', () => { this.drag = null; });
    this.render();
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.render();
  }

  seedFor(question) {
    if (question !== 'twitter') return { comps: [], edges: [] };
    return {
      comps: SEED.comps.map((component) => ({ ...component, props: { ...(component.props || {}) } })),
      edges: SEED.edges.map((edge) => ({ ...edge })),
    };
  }

  openWorkspace(question = this.state.question) {
    const seed = this.seedFor(question);
    this.setState({
      screen: 'workspace',
      question,
      comps: seed.comps,
      edges: seed.edges,
      selectedId: null,
      selectedEdgeId: null,
      broken: [],
      traffic: 0,
      constraints: [],
      problemsOpen: false,
      aiOpen: false,
      inspectorTab: 'general',
    });
  }

  render() {
    const html = this.state.screen === 'dashboard' ? this.renderDashboard()
      : this.state.screen === 'setup' ? this.renderSetup()
      : this.state.screen === 'link' ? this.renderLinkGenerated()
      : this.state.screen === 'review' ? this.renderReview()
      : this.renderWorkspace();
    this.root.innerHTML = html + (this.state.toast ? `<div class="toast">${esc(this.state.toast)}</div>` : '');
  }

  renderDashboard() {
    const stats = [
      ['Interviews this week', '12'],
      ['Avg. duration', '46m'],
      ['Pass rate', '58%'],
      ['Question presets', String(QUESTIONS.length)],
    ];
    return `
      <div class="app dashboard">
        ${this.renderTopbar('dashboard')}
        <div class="dashboard-body">
          <div class="page-head">
            <div>
              <div class="page-title">Good afternoon, Aarav</div>
              <div class="subtle">You have 2 interviews scheduled today.</div>
            </div>
            <button class="btn primary" data-action="setup">Create interview</button>
          </div>
          <div class="grid stats">
            ${stats.map(([label, value]) => `<div class="card stat"><div class="subtle">${label}</div><div class="stat-value">${value}</div></div>`).join('')}
          </div>
          <div class="section-head"><div class="section-title">Resume in progress</div></div>
          <button class="card resume-card" data-action="workspace" data-question="twitter">
            <span class="icon-tile" style="color:var(--accent-soft);background:rgba(99,102,241,.18)">${this.icon('monitor', 21)}</span>
            <span style="text-align:left;flex:1">
              <strong>Design Twitter - Senior Backend loop</strong><br>
              <span class="subtle">Candidate: Priya S. - 10 components placed - paused 12 min ago</span>
            </span>
            <span style="color:var(--accent-soft);font-weight:700">Resume</span>
          </button>
          <div class="section-head">
            <div class="section-title">Upcoming interviews</div>
            <span class="mono-label">Today</span>
          </div>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-bottom:26px">
            ${['Payment System - 4:00 PM', 'Food Delivery - 6:30 PM'].map((item) => `<div class="card stat"><strong>${item}</strong><div class="subtle" style="margin-top:4px">Diagnostics enabled - interviewer hints only</div></div>`).join('')}
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
            ${['Twitter feed - reviewed', 'Payment ledger - shared', 'Ride matching - draft'].map((item) => `<div class="card stat"><strong>${item}</strong><div class="subtle" style="margin-top:4px">Architecture health, diagnostics, and scorecard preserved.</div></div>`).join('')}
          </div>
        </div>
      </div>`;
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
    const current = QUESTIONS.find((question) => question.id === this.state.question) || QUESTIONS[0];
    return `
      <div class="app dashboard">
        ${this.renderTopbar('setup')}
        <div class="setup-body">
          <div class="page-head">
            <div>
              <div class="page-title">Create interview</div>
              <div class="subtle">Configure the workspace, permissions, diagnostics, and candidate link.</div>
            </div>
            <div style="display:flex;gap:10px">
              <button class="btn" data-action="workspace" data-question="${esc(this.state.question)}">Start workspace</button>
              <button class="btn primary" data-action="generateLink">Generate candidate link</button>
            </div>
          </div>
          <div class="setup-grid">
            <div>
              <div class="form-grid">
                <div class="card stat">
                  <div class="mono-label">Question source</div>
                  <div class="pill-row" style="margin:12px 0 14px">
                    <span class="pill" style="color:var(--accent-soft);border-color:rgba(99,102,241,.45);background:rgba(99,102,241,.16)">Preset</span>
                    <span class="pill">Custom</span>
                  </div>
                  <div class="grid">
                    ${QUESTIONS.slice(0, 6).map((question) => `
                      <button class="card stat" data-action="selectSetupQuestion" data-question="${esc(question.id)}" style="text-align:left;border-color:${question.id === this.state.question ? 'rgba(99,102,241,.45)' : 'var(--border)'}">
                        <strong>${esc(question.title)}</strong>
                        <div class="subtle" style="font-size:12px;margin-top:4px">${esc(question.topics.join(', '))} - ${esc(question.dur)}m</div>
                      </button>`).join('')}
                  </div>
                </div>
                <div class="card stat">
                  <div class="mono-label">Custom prompt</div>
                  <textarea class="textarea" aria-label="Custom system design prompt"></textarea>
                  <div class="form-grid" style="margin-top:12px">
                    <label><span class="mono-label">Difficulty</span><select class="select"><option>${esc(current.diff)}</option><option>Medium</option><option>Easy</option></select></label>
                    <label><span class="mono-label">Duration</span><select class="select"><option>${esc(current.dur)} min</option><option>30 min</option><option>60 min</option></select></label>
                  </div>
                </div>
              </div>
              <div class="form-grid" style="margin-top:14px">
                ${this.renderChecklist('Interviewer controls', [
                  'Allow candidate editing',
                  'Enable diagnostics during interview',
                  'Hide health score from candidate',
                  'Enable failure injection',
                  'AI hints for interviewer only',
                ])}
                ${this.renderChecklist('Permissions', [
                  'Candidate can view question',
                  'Candidate can edit canvas',
                  'Candidate cannot view scorecard',
                  'Interviewer can inject scenarios',
                  'Panel can view submitted review',
                ])}
              </div>
            </div>
            <aside class="card stat" style="position:sticky;top:20px;align-self:start">
              <div class="mono-label">Session summary</div>
              <h2 style="margin:12px 0 4px">${esc(current.title)}</h2>
              <div class="subtle">Senior Backend loop - ${esc(current.dur)} minutes</div>
              <div class="grid" style="margin:18px 0">
                ${[
                  ['Candidate', 'Priya S.'],
                  ['Diagnostics', 'Enabled'],
                  ['AI hints', 'Interviewer only'],
                  ['Failure injection', 'Allowed'],
                ].map(([a, b]) => `<div style="display:flex;justify-content:space-between;font-size:13px"><span class="subtle">${a}</span><strong>${b}</strong></div>`).join('')}
              </div>
              <button class="btn primary" style="width:100%;margin-bottom:10px" data-action="generateLink">Generate candidate link</button>
              <button class="btn" style="width:100%" data-action="workspace" data-question="${esc(this.state.question)}">Start workspace</button>
            </aside>
          </div>
        </div>
      </div>`;
  }

  renderChecklist(title, items) {
    return `<div class="card stat"><div class="mono-label">${esc(title)}</div>${items.map((item) => `<label class="check-row"><span>${esc(item)}</span><input type="checkbox" checked></label>`).join('')}</div>`;
  }

  renderLinkGenerated() {
    const question = QUESTIONS.find((item) => item.id === this.state.question) || QUESTIONS[0];
    return `
      <div class="app dashboard">
        ${this.renderTopbar('link')}
        <div style="min-height:calc(100vh - 54px);display:grid;place-items:center;padding:34px">
          <div class="card stat" style="width:min(720px,100%);padding:28px">
            <div class="icon-tile" style="width:48px;height:48px;color:#6ee7b7;background:rgba(52,211,153,.14);margin-bottom:18px">${this.icon('shield', 24)}</div>
            <div class="page-title">Candidate link generated</div>
            <p class="subtle">Share this session with the candidate, then open the workspace when they join.</p>
            <div class="mono-label">Candidate link</div>
            <div style="display:flex;gap:10px;margin:8px 0 18px">
              <input class="field" readonly value="${esc(this.state.candidateLink)}">
              <button class="btn" data-action="copyLink">Copy link</button>
            </div>
            <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
              ${[
                ['Candidate', 'Priya S.'],
                ['Question', question.title],
                ['Status', 'Candidate joined'],
              ].map(([a, b]) => `<div class="card stat"><div class="subtle">${esc(a)}</div><strong>${esc(b)}</strong></div>`).join('')}
            </div>
            <div style="display:flex;gap:10px">
              <button class="btn" style="flex:1" data-action="setup">Edit setup</button>
              <button class="btn primary" style="flex:1" data-action="workspace" data-question="${esc(this.state.question)}">Start workspace</button>
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
          ${this.state.aiOpen ? this.renderAiPanel() : this.renderRightPanel()}
        </div>
        ${this.renderStatusbar()}
      </div>`;
  }

  renderTopbar(mode) {
    const isWorkspace = mode === 'workspace';
    return `
      <header class="topbar">
        <div class="brand" data-action="dashboard" role="button" tabindex="0">
          <span class="logo">S</span><span class="brand-title">SystemDesign Studio</span><span class="beta">PUBLIC</span>
        </div>
        <div class="divider"></div>
        ${isWorkspace ? `
          <button class="btn icon-btn active" title="Select">${this.icon('search', 16)}</button>
          <button class="btn icon-btn" title="Pan">${this.icon('net', 16)}</button>
          <button class="btn icon-btn" title="Connect">${this.icon('stream', 16)}</button>
          <button class="btn icon-btn" title="Comment">${this.icon('bell', 16)}</button>
          <div class="spacer"></div>
          <span class="mono-label toolbar-label">Simulate</span>
          <button class="btn danger" data-action="breakSelected">Break</button>
          <button class="btn ${this.state.traffic ? 'active' : ''}" data-action="traffic" data-value="1000">Traffic ${this.state.traffic ? 'x' + this.state.traffic : ''}</button>
          <button class="btn" data-action="injectScenario" data-scenario="redis">Redis down</button>
          <button class="btn optional-wide" data-action="injectScenario" data-scenario="kafka">Kafka down</button>
          <button class="btn optional-wide" data-action="injectScenario" data-scenario="db">DB outage</button>
          <button class="btn" data-action="resetSimulation">Reset</button>
          <div class="spacer"></div>
          <button class="btn" data-action="toggleAi">AI hints</button>
          <button class="btn primary" data-action="review">Finish & review</button>`
        : `
          <div class="spacer"></div>
          <button class="btn" data-action="dashboard">Dashboard</button>
          ${mode !== 'setup' ? '<button class="btn primary" data-action="setup">Create interview</button>' : ''}`}
      </header>`;
  }

  renderPalette() {
    return `
      <aside class="left-panel">
        <div class="panel-head">
          <div class="section-title">Components</div>
          <input class="palette-search" aria-label="Filter components">
        </div>
        <div class="panel-scroll">
          ${PALETTE.map((group) => `
            <div class="palette-group">
              <div class="mono-label" style="color:${group.color};margin:0 0 7px 6px">${esc(group.cat)}</div>
              ${group.items.map((item) => `
                <button class="palette-item" draggable="true" data-palette-name="${esc(item)}" data-palette-cat="${esc(group.cat)}" data-action="addComponent">
                  <span class="icon-tile" style="color:${group.color};background:${group.color}22">${this.iconForName(item, 16)}</span>
                  <span>${esc(item)}</span>
                </button>`).join('')}
            </div>`).join('')}
        </div>
      </aside>`;
  }

  renderCanvas() {
    const byId = this.byId();
    const affected = this.affectedNodes();
    const diagnostics = this.diagnostics();
    const spec = QUESTION_SPEC[this.state.question] || QUESTION_SPEC.twitter;
    return `
      <section class="canvas-wrap" data-canvas>
        <div class="question-panel card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <strong>${esc((QUESTIONS.find((q) => q.id === this.state.question) || QUESTIONS[0]).title)}</strong>
            <span class="pill" style="color:var(--bad-2)">Hard</span>
          </div>
          <p class="subtle" style="font-size:12.5px;line-height:1.45">${esc(spec.statement || 'Design the system and explain tradeoffs.')}</p>
          <div class="mono-label">Requirements</div>
          ${(spec.functional || []).slice(0, 4).map((item) => `<div style="font-size:12px;margin-top:6px;color:var(--text-2)">+ ${esc(item)}</div>`).join('')}
        </div>
        <div class="canvas-layer">
          <svg class="edges">${this.state.edges.map((edge) => this.renderEdgePath(edge, byId)).join('')}</svg>
          ${this.state.edges.map((edge) => this.renderEdgeLabel(edge, byId)).join('')}
          ${this.state.comps.map((component) => this.renderNode(component, diagnostics, affected)).join('')}
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
    return `
      <div class="${className}" data-node-id="${esc(component.id)}" data-action="selectNode" style="left:${component.x}px;top:${component.y}px">
        ${severity ? `<span class="diag-dot ${severity}">${nodeDiagnostics.length}</span>` : ''}
        <span class="icon-tile" style="color:${color};background:${color}22">${this.iconForName(component.base || component.type, 18)}</span>
        <span style="min-width:0">
          <strong style="font-size:13px">${esc(component.type)}</strong><br>
          <span class="subtle" style="font-size:11px">${esc(component.cat)}</span>
        </span>
      </div>`;
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
    const selected = this.selectedComponent();
    const edge = this.selectedEdge();
    if (selected) return this.renderInspector(selected);
    if (edge) return this.renderEdgeInspector(edge);
    return this.renderHealthPanel();
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
            <button class="btn danger" data-action="breakSelected">${this.state.broken.includes(component.id) ? 'Restore component' : 'Break component'}</button>
            <button class="btn" data-action="deleteSelected">Delete</button>
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
    if (field.t === 'bool') {
      return `<label class="check-row"><span>${esc(field.l)}</span><input data-field="${esc(field.k)}" type="checkbox" ${value ? 'checked' : ''}></label>`;
    }
    if (field.t === 'sel') {
      return `<label style="display:block;margin-top:10px"><span class="mono-label">${esc(field.l)}</span><select class="select" data-field="${esc(field.k)}">${field.opts.map((option) => `<option ${String(option) === String(value) ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
    }
    return `<label style="display:block;margin-top:10px"><span style="display:flex;justify-content:space-between"><span class="mono-label">${esc(field.l)}</span>${unit}</span><input class="field" data-field="${esc(field.k)}" type="${field.t === 'num' ? 'number' : 'text'}" value="${esc(value)}"></label>`;
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
    return `
      <aside class="right-panel">
        <div class="panel-head"><div class="section-title">Connection</div><div class="subtle">${esc(edge.id)}</div></div>
        <div class="panel-scroll">
          <label><span class="mono-label">Protocol</span><select class="select" data-edge-field="protocol">${EDGE_PROTOCOLS.map((item) => `<option ${item === edge.protocol ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label>
          <label style="display:block;margin-top:12px"><span class="mono-label">Serializer</span><select class="select" data-edge-field="serializer">${EDGE_SERIALIZERS.map((item) => `<option ${item === (edge.serializer || 'JSON') ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label>
          ${['badge', 'retries', 'timeout', 'pool'].map((field) => `<label style="display:block;margin-top:12px"><span class="mono-label">${esc(field)}</span><input class="field" data-edge-field="${esc(field)}" value="${esc(edge[field] || '')}"></label>`).join('')}
          ${['tls', 'compression', 'cb', 'bidir'].map((field) => `<label class="check-row"><span>${esc(field.toUpperCase())}</span><input data-edge-field="${esc(field)}" type="checkbox" ${edge[field] ? 'checked' : ''}></label>`).join('')}
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
    const hints = [
      ['Potential SPOF', 'Redis cache has no replica or fallback path under failure.', 'var(--bad-2)'],
      ['Missing component', 'No rate limiter sits between the gateway and hot services.', 'var(--accent-2)'],
      ['Bottleneck', 'The write path can saturate before fan-out catches up.', 'var(--warn)'],
      ['Follow-up', 'Ask how the candidate handles celebrity fan-out.', 'var(--ai)'],
    ];
    return `
      <aside class="right-panel">
        <div class="panel-head"><div class="section-title">AI hints</div><div class="subtle" style="font-size:12px">Critique only. No generated answers.</div></div>
        <div class="panel-scroll">
          ${hints.map(([title, body, color]) => `<div class="card stat" style="border-left:3px solid ${color};border-radius:0 8px 8px 0;margin-bottom:10px"><strong style="color:${color}">${title}</strong><div class="subtle" style="font-size:12.5px;margin-top:5px">${body}</div></div>`).join('')}
          <button class="btn" style="width:100%" data-action="toggleAi">Back to inspector</button>
        </div>
      </aside>`;
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
        <span>Saved locally - deployable static artifact</span>
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
          </main>
          <aside class="review-side">
            <div class="panel-head" style="display:flex;gap:16px;align-items:center">
              <div class="icon-tile" style="width:74px;height:74px;border-radius:999px;background:conic-gradient(var(--accent) 0% ${avg / 5 * 100}%, rgba(255,255,255,.08) ${avg / 5 * 100}% 100%)"><strong style="font:800 22px var(--mono)">${avg.toFixed(1)}</strong></div>
              <div><div class="section-title">Scorecard</div><div class="subtle" style="font-size:12px">Manual interviewer assessment.</div></div>
            </div>
            <div class="panel-scroll">
              ${scoreKeys.map((key) => `<div class="check-row"><span>${esc(key)}</span><span>${[1, 2, 3, 4, 5].map((n) => `<button class="score-dot ${n <= this.state.scores[key] ? 'on' : ''}" data-action="score" data-score-key="${esc(key)}" data-score="${n}"></button>`).join('')}</span></div>`).join('')}
              <div class="mono-label" style="margin-top:18px">Final feedback</div>
              <textarea class="textarea" aria-label="Overall feedback for the loop debrief" style="margin-top:8px"></textarea>
              <div style="display:flex;gap:9px;margin-top:12px">
                <button class="btn good" style="flex:1" data-action="submitted">Advance</button>
                <button class="btn danger" style="flex:1" data-action="submitted">No hire</button>
              </div>
            </div>
          </aside>
        </div>
      </div>`;
  }

  metricRow(label, value, width, warn = false) {
    return `<div class="metric-row"><div class="metric-line"><span>${esc(label)}</span><strong style="font-family:var(--mono);color:${warn ? 'var(--warn)' : 'var(--accent-soft)'}">${esc(value)}</strong></div><div class="bar ${warn ? 'warn' : ''}"><span style="width:${width}"></span></div></div>`;
  }

  handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'dashboard') this.setState({ screen: 'dashboard' });
    if (action === 'setup') this.setState({ screen: 'setup' });
    if (action === 'workspace') this.openWorkspace(target.dataset.question || this.state.question);
    if (action === 'selectSetupQuestion') this.setState({ question: target.dataset.question });
    if (action === 'generateLink') this.setState({ screen: 'link', candidateLink: `https://systemdesign.studio/i/${this.state.question}-priya` });
    if (action === 'copyLink') this.toast('Candidate link copied');
    if (action === 'review') this.setState({ screen: 'review' });
    if (action === 'submitted') this.toast('Evaluation submitted');
    if (action === 'selectNode') this.setState({ selectedId: target.dataset.nodeId, selectedEdgeId: null, inspectorTab: 'general' });
    if (action === 'selectEdge') this.setState({ selectedEdgeId: target.dataset.edgeId, selectedId: null });
    if (action === 'selectDiagnostic') this.setState({ selectedId: target.dataset.nodeId || null, selectedEdgeId: null, problemsOpen: true });
    if (action === 'tab') this.setState({ inspectorTab: target.dataset.tab });
    if (action === 'toggleProblems') this.setState({ problemsOpen: !this.state.problemsOpen });
    if (action === 'toggleAi') this.setState({ aiOpen: !this.state.aiOpen });
    if (action === 'traffic') this.setState({ traffic: this.state.traffic ? 0 : Number(target.dataset.value || 1000), problemsOpen: true });
    if (action === 'resetSimulation') this.setState({ traffic: 0, broken: [], constraints: [], problemsOpen: false });
    if (action === 'injectScenario') this.injectScenario(target.dataset.scenario);
    if (action === 'breakSelected') this.toggleBreakSelected();
    if (action === 'deleteSelected') this.deleteSelected();
    if (action === 'addComponent') this.addComponent(target.dataset.paletteName, target.dataset.paletteCat);
    if (action === 'score') this.setState({ scores: { ...this.state.scores, [target.dataset.scoreKey]: Number(target.dataset.score) } });
  }

  handleChange(event) {
    const field = event.target.closest('[data-field]');
    if (field && this.state.selectedId) {
      const value = field.type === 'checkbox' ? field.checked : field.value;
      this.state.comps = this.state.comps.map((component) => {
        if (component.id !== this.state.selectedId) return component;
        if (field.dataset.field === 'name') return { ...component, type: value };
        return { ...component, props: { ...(component.props || {}), [field.dataset.field]: value } };
      });
      this.render();
    }
    const edgeField = event.target.closest('[data-edge-field]');
    if (edgeField && this.state.selectedEdgeId) {
      const value = edgeField.type === 'checkbox' ? edgeField.checked : edgeField.value;
      this.state.edges = this.state.edges.map((edge) => edge.id === this.state.selectedEdgeId ? { ...edge, [edgeField.dataset.edgeField]: value } : edge);
      this.render();
    }
  }

  handleDragStart(event) {
    const item = event.target.closest('[data-palette-name]');
    if (!item) return;
    event.dataTransfer.setData('application/json', JSON.stringify({ name: item.dataset.paletteName, cat: item.dataset.paletteCat }));
  }

  handleDrop(event) {
    const canvas = event.target.closest('[data-canvas]');
    if (!canvas) return;
    event.preventDefault();
    const payload = JSON.parse(event.dataTransfer.getData('application/json') || '{}');
    const rect = canvas.getBoundingClientRect();
    this.addComponent(payload.name, payload.cat, event.clientX - rect.left - 75, event.clientY - rect.top - 33);
  }

  handlePointerDown(event) {
    const node = event.target.closest('[data-node-id]');
    if (!node) return;
    const component = this.state.comps.find((item) => item.id === node.dataset.nodeId);
    if (!component) return;
    this.drag = { id: component.id, x: event.clientX, y: event.clientY, ox: component.x, oy: component.y };
  }

  handlePointerMove(event) {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.x;
    const dy = event.clientY - this.drag.y;
    this.state.comps = this.state.comps.map((component) => component.id === this.drag.id ? { ...component, x: Math.round(this.drag.ox + dx), y: Math.round(this.drag.oy + dy) } : component);
    this.render();
  }

  addComponent(name, cat, x = 420, y = 180) {
    if (!name || !cat) return;
    const id = `c${Date.now()}`;
    this.setState({
      comps: [...this.state.comps, { id, type: name, cat, x: Math.round(x), y: Math.round(y), w: 150, props: {} }],
      selectedId: id,
      selectedEdgeId: null,
    });
  }

  injectScenario(id) {
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
  }

  toggleBreakSelected() {
    const id = this.state.selectedId;
    if (!id) return;
    const broken = this.state.broken.includes(id)
      ? this.state.broken.filter((item) => item !== id)
      : [...this.state.broken, id];
    this.setState({ broken });
  }

  deleteSelected() {
    if (this.state.selectedId) {
      const id = this.state.selectedId;
      this.setState({
        comps: this.state.comps.filter((item) => item.id !== id),
        edges: this.state.edges.filter((edge) => edge.from !== id && edge.to !== id),
        selectedId: null,
      });
    }
    if (this.state.selectedEdgeId) {
      this.setState({ edges: this.state.edges.filter((edge) => edge.id !== this.state.selectedEdgeId), selectedEdgeId: null });
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

const root = $('#app');
const app = new SystemDesignStudio(root);
app.mount();
