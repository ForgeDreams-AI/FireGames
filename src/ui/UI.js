// UI.js — DOM overlay layer. Renders every menu/dialogue/battle/study/reference
// screen as HTML on top of the Phaser canvas (large tap targets, easy theming
// via CSS variables, robust text wrapping). It drives the content-free
// BattleEngine and reads all ACADEMY CONTENT (steps, hints, how-to, badge
// names, time limits) from the data models. The only strings defined here are
// generic INTERFACE chrome (button labels, "What's next?", "Correct!"), which
// are UI copy, not procedure content.

import { BattleEngine } from '../engine/BattleEngine.js';

export class UI {
  constructor(services) {
    this.data = services.data;
    this.config = services.data.config;
    this.model = services.model;       // EventModel
    this.storage = services.storage;
    this.theme = services.theme;
    this.root = document.getElementById('ui-root');
    this.modalStack = [];
  }

  isModalOpen() { return this.modalStack.length > 0; }

  // ---------- low-level DOM helpers ----------
  el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  button(label, onClick, cls) {
    const b = this.el('button', 'cs-btn ' + (cls || ''), label);
    b.addEventListener('click', (ev) => { ev.stopPropagation(); onClick(); });
    return b;
  }

  _openPanel(node, opts) {
    opts = opts || {};
    const overlay = this.el('div', 'cs-overlay');
    if (opts.dim) overlay.classList.add('dim');
    const panel = this.el('div', 'cs-panel ' + (opts.panelClass || ''));
    panel.appendChild(node);
    overlay.appendChild(panel);
    this.root.appendChild(overlay);
    this.modalStack.push(overlay);
    return { overlay, panel, close: () => this._close(overlay, opts.onClose) };
  }

  _close(overlay, onClose) {
    const idx = this.modalStack.indexOf(overlay);
    if (idx >= 0) this.modalStack.splice(idx, 1);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (onClose) onClose();
  }

  toast(msg, kind) {
    const t = this.el('div', 'cs-toast ' + (kind || ''), msg);
    this.root.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
  }

  lockedMessage(gym) {
    return 'Locked — earn the previous badge to unlock this pad.';
  }

  header(title, sub) {
    const h = this.el('div', 'cs-header');
    h.appendChild(this.el('div', 'cs-title', title));
    if (sub) h.appendChild(this.el('div', 'cs-sub', sub));
    return h;
  }

  // Transient top banner (used by enter/exit transitions).
  banner(text) {
    const b = this.el('div', 'cs-banner-flash', text);
    this.root.appendChild(b);
    requestAnimationFrame(() => b.classList.add('show'));
    setTimeout(() => { b.classList.remove('show'); setTimeout(() => b.remove(), 300); }, 1400);
  }

  // ================= GUIDED WALK-THROUGH (study NPC, teach-first) =================
  // Overworld NPCs deliver this too.
  openDialogue(npcDef) { this.openWalkthrough(npcDef.eventId, npcDef.name); }

  openWalkthrough(eventId, speakerName) {
    this.storage.markSeen(eventId);
    if (this.model.hasVariants(eventId)) {
      // pick the side first, then walk shared -> variant -> common tail in order
      this._chooseVariantThen(eventId, (v) => this._runWalkthrough(eventId, v, speakerName), 'Which position are you learning?');
    } else {
      this._runWalkthrough(eventId, this.model.variantsFor(eventId)[0], speakerName);
    }
  }

  _runWalkthrough(eventId, variant, speakerName) {
    const event = this.model.get(eventId);
    const steps = this.model.steps(eventId, variant);
    let i = 0;

    const wrap = this.el('div', 'cs-dialogue');
    const speaker = this.el('div', 'cs-speaker',
      (speakerName || 'Instructor') + (this.model.hasVariants(eventId) ? ' · ' + prettyVariant(variant) : ''));
    const counter = this.el('div', 'cs-sub');
    const body = this.el('div', 'cs-dialogue-body');
    const nav = this.el('div', 'cs-row');
    wrap.appendChild(speaker); wrap.appendChild(counter); wrap.appendChild(body); wrap.appendChild(nav);

    const render = () => {
      body.innerHTML = '';
      const s = steps[i];
      counter.textContent = event.name + ' — step ' + s.order + ' of ' + steps.length;
      if (s.critical) {
        const flag = this.el('div', 'cs-critflag', '⚠ SAFETY-CRITICAL — miss this on the real eval and the attempt is over.');
        body.appendChild(flag);
      }
      body.appendChild(this.el('div', 'cs-line strong', s.step));
      const ht = (s.howto && s.howto.trim()) ? s.howto
        : 'Drill this step to master it — teaching notes coming soon.';
      body.appendChild(this.el('div', 'cs-line teach', ht));
      if (s.hint && s.hint.trim()) {
        const hintRow = this.el('div', 'cs-hint');
        const q = this.button('?', () => hintRow.classList.toggle('open'), 'cs-hint-toggle');
        hintRow.appendChild(q); hintRow.appendChild(this.el('span', 'cs-hint-text', 'Cue: ' + s.hint));
        body.appendChild(hintRow);
      }
    };

    const prev = this.button('‹ Prev', () => { if (i > 0) { i--; render(); } });
    const closeBtn = this.button('Done', () => panel.close(), 'ghost');
    const next = this.button('Next ›', () => { if (i < steps.length - 1) { i++; render(); } else panel.close(); });
    nav.appendChild(prev); nav.appendChild(closeBtn); nav.appendChild(next);

    render();
    var panel = this._openPanel(wrap, { panelClass: 'dialogue-panel' });
  }

  // ================= RTO ENCOUNTER (intro + Drill/Graded prompt) =================
  openRTOEncounter(eventId) {
    const event = this.model.get(eventId);
    this.storage.markSeen(eventId);
    const earned = this.storage.hasBadge(eventId);
    const best = this.storage.bestScore(eventId);

    const intro = (event.rtoIntro && event.rtoIntro.trim()) ? event.rtoIntro
      : 'Ready for your ' + event.name + ' evaluation? Produce the graded steps in order. Miss a critical and the attempt is over.';
    const modePrompt = (event.rtoModePrompt && event.rtoModePrompt.trim()) ? event.rtoModePrompt
      : 'Run it as a DRILL (practice, no penalty) or GRADED (timed badge run, critical-fail live).';

    const wrap = this.el('div', 'cs-dialogue');
    wrap.appendChild(this.el('div', 'cs-speaker', (event.name) + ' · RTO Evaluator'));
    wrap.appendChild(this.el('div', 'cs-sub', event.badgeName + ' · ' + event.standardRef + ' · limit ' +
      formatTime(event.timeLimitSeconds) + ' · pass ' + Math.round((this.config.passThreshold || 0.65) * 100) + '%' +
      (earned ? '  · 🏅 earned' : '') + (best ? '  · best ' + best + '%' : '')));
    wrap.appendChild(this.el('div', 'cs-line strong', intro));
    wrap.appendChild(this.el('div', 'cs-line teach', modePrompt));

    const menu = this.el('div', 'cs-menu');
    menu.appendChild(this.button('🎯 GRADED — RTO badge run', () => { panel.close(); this._chooseVariantThen(eventId, (v) => this.startBattle(eventId, v, 'graded')); }, 'primary'));
    menu.appendChild(this.button('📚 DRILL — practice (no penalty)', () => { panel.close(); this.openDrillMenu(eventId); }));
    menu.appendChild(this.button('📋 Reference checklist', () => this.openReference(eventId)));
    menu.appendChild(this.button('Step back', () => panel.close(), 'ghost'));
    wrap.appendChild(menu);
    var panel = this._openPanel(wrap, { panelClass: 'dialogue-panel' });
  }

  _chooseVariantThen(eventId, cb, title) {
    if (!this.model.hasVariants(eventId)) { cb(this.model.variantsFor(eventId)[0]); return; }
    const wrap = this.el('div');
    wrap.appendChild(this.header(title || 'Choose your position', this.model.get(eventId).name));
    const menu = this.el('div', 'cs-menu');
    this.model.variantsFor(eventId).forEach(v => {
      menu.appendChild(this.button(prettyVariant(v), () => { panel.close(); cb(v); }, 'primary'));
    });
    menu.appendChild(this.button('Back', () => panel.close(), 'ghost'));
    wrap.appendChild(menu);
    var panel = this._openPanel(wrap, { dim: true });
  }

  // ================= STUDY / DRILL RAMP =================
  openDrillMenu(eventId) {
    const event = this.model.get(eventId);
    const wrap = this.el('div');
    wrap.appendChild(this.header('Study & Drill', event.name + ' — climb the ramp'));
    const menu = this.el('div', 'cs-menu');
    const go = (mode) => () => { panel.close(); this._chooseVariantThen(eventId, (v) => {
      if (mode === 'ordering') this.startOrdering(eventId, v);
      else this.startBattle(eventId, v, mode);
    }); };
    menu.appendChild(this.button('① Recognition — “what comes next?” (list shown)', go('recognition')));
    menu.appendChild(this.button('② Ordering — arrange the scrambled steps', go('ordering')));
    menu.appendChild(this.button('③ Free Recall — next step, no list', go('free_recall')));
    menu.appendChild(this.button('④ Timed — free recall against the clock', go('timed')));
    menu.appendChild(this.button('Back', () => panel.close(), 'ghost'));
    wrap.appendChild(menu);
    var panel = this._openPanel(wrap, { dim: true });
  }

  // ================= BATTLE (graded + recognition/free_recall/timed) =================
  startBattle(eventId, variant, mode) {
    const event = this.model.get(eventId);
    const steps = this.model.steps(eventId, variant);
    const cfg = this.config.settings || {};
    const graded = mode === 'graded';
    const engine = new BattleEngine({
      steps, mode,
      optionCount: cfg.optionCount || 4,
      startingHP: graded ? (cfg.startingHP || 5) : 999, // study never KOs on HP
      nonCriticalHPLoss: cfg.nonCriticalHPLoss != null ? cfg.nonCriticalHPLoss : 1,
      passThreshold: this.config.passThreshold || 0.65
    });

    // Time limit: graded uses real limit; timed study uses real or relaxed.
    let timeLimit = 0;
    if (graded) timeLimit = event.timeLimitSeconds;
    else if (mode === 'timed') timeLimit = this.config.studyTimedUsesRealLimit
      ? event.timeLimitSeconds
      : Math.round(event.timeLimitSeconds * (this.config.studyTimedRelaxMultiplier || 1.5));

    const ctx = { eventId, variant, mode, event, engine, steps, timeLimit, graded };
    this._renderBattle(ctx);
  }

  _renderBattle(ctx) {
    const { engine, event, mode, graded } = ctx;
    const wrap = this.el('div', 'cs-battle');

    // Arena: RTO top-right (front), recruit bottom-left (back)
    const arena = this.el('div', 'cs-arena');
    const rtoSide = this.el('div', 'cs-side rto');
    rtoSide.appendChild(this.el('div', 'cs-combatant-name', 'RTO Evaluator'));
    ctx.rtoBar = this._bar('rto');
    rtoSide.appendChild(ctx.rtoBar.wrap);
    rtoSide.appendChild(this._avatar('rto'));

    const recruitSide = this.el('div', 'cs-side recruit');
    recruitSide.appendChild(this._avatar('player'));
    ctx.hpBar = this._bar('player');
    recruitSide.appendChild(ctx.hpBar.wrap);
    recruitSide.appendChild(this.el('div', 'cs-combatant-name', 'Recruit'));

    arena.appendChild(rtoSide);
    arena.appendChild(recruitSide);
    wrap.appendChild(arena);

    // Status row: mode badge, timer, progress
    const status = this.el('div', 'cs-status');
    status.appendChild(this.el('span', 'cs-pill', modeLabel(mode)));
    status.appendChild(this.el('span', 'cs-pill ref', event.name + ' · ' + event.standardRef));
    ctx.timerEl = this.el('span', 'cs-pill timer', ctx.timeLimit ? formatTime(ctx.timeLimit) : '∞');
    status.appendChild(ctx.timerEl);
    wrap.appendChild(status);

    // Sequence tracker (recognition shows full list)
    ctx.tracker = this.el('div', 'cs-tracker');
    wrap.appendChild(ctx.tracker);

    // Prompt + command menu
    ctx.promptEl = this.el('div', 'cs-prompt');
    ctx.menuEl = this.el('div', 'cs-command-menu');
    ctx.feedbackEl = this.el('div', 'cs-feedback');
    wrap.appendChild(ctx.promptEl);
    wrap.appendChild(ctx.feedbackEl);
    wrap.appendChild(ctx.menuEl);

    const panel = this._openPanel(wrap, { panelClass: 'battle-panel', onClose: () => { this._stopTimer(ctx); if (this._activeCtx === ctx) this._activeCtx = null; } });
    ctx.panel = panel;
    this._activeCtx = ctx; // reference to the in-flight battle (QA/support)

    this._updateBars(ctx);
    this._startTimer(ctx);
    this._nextQuestion(ctx);
  }

  _avatar(key) {
    const a = this.el('div', 'cs-avatar ' + key);
    const hex = this.theme.hex(key);
    a.style.background = hex;
    a.textContent = key === 'rto' ? 'RTO' : 'R';
    return a;
  }

  _bar(key) {
    const wrap = this.el('div', 'cs-bar');
    const fill = this.el('div', 'cs-bar-fill ' + key);
    const txt = this.el('div', 'cs-bar-txt');
    wrap.appendChild(fill); wrap.appendChild(txt);
    return { wrap, fill, txt };
  }

  _updateBars(ctx) {
    const { engine } = ctx;
    const total = engine.total || 1;
    const remaining = total - engine.correctCount;
    const rtoPct = Math.max(0, (remaining / total) * 100);
    ctx.rtoBar.fill.style.width = rtoPct + '%';
    ctx.rtoBar.txt.textContent = engine.correctCount + '/' + total + ' steps';
    const hpPct = ctx.graded ? Math.max(0, (engine.hp / engine.maxHP) * 100) : 100;
    ctx.hpBar.fill.style.width = hpPct + '%';
    ctx.hpBar.txt.textContent = ctx.graded ? ('HP ' + engine.hp + '/' + engine.maxHP) : 'STUDY';
  }

  _renderTracker(ctx) {
    const { engine } = ctx;
    ctx.tracker.innerHTML = '';
    if (!engine.showSequence) {
      // free recall / timed / graded: show only the anchor (previous step)
      return;
    }
    ctx.steps.forEach((s, idx) => {
      const row = this.el('div', 'cs-track-row');
      let mark = '○';
      if (idx < engine.i) mark = '✔';
      else if (idx === engine.i) mark = '➤';
      row.textContent = mark + ' ' + (idx < engine.i ? s.step : (idx === engine.i ? '???' : '·····'));
      if (idx === engine.i) row.classList.add('cur');
      if (idx < engine.i) row.classList.add('done');
      ctx.tracker.appendChild(row);
    });
  }

  _nextQuestion(ctx) {
    const { engine } = ctx;
    this._renderTracker(ctx);
    const prompt = engine.current();
    if (!prompt) { this._finishBattle(ctx); return; }
    ctx.feedbackEl.textContent = '';
    ctx.feedbackEl.className = 'cs-feedback';

    // Prompt header per type
    ctx.promptEl.innerHTML = '';
    if (prompt.type === 'ordered') {
      const anchor = prompt.index > 0 ? ctx.steps[prompt.index - 1].step : 'Start of the evolution.';
      ctx.promptEl.appendChild(this.el('div', 'cs-anchor', 'After: ' + anchor));
      ctx.promptEl.appendChild(this.el('div', 'cs-question', 'What is the next graded action?'));
    } else if (prompt.type === 'choice') {
      ctx.promptEl.appendChild(this.el('div', 'cs-question', prompt.step.step));
      ctx.promptEl.appendChild(this.el('div', 'cs-anchor', 'Knowledge check — pick the correct call.'));
    } else { // inspection
      ctx.promptEl.appendChild(this.el('div', 'cs-question', '✔ Final check: ' + prompt.step.step));
      ctx.promptEl.appendChild(this.el('div', 'cs-anchor', 'Confirm the standard is met.'));
    }
    if (prompt.critical) ctx.promptEl.appendChild(this.el('div', 'cs-critflag', '⚠ SAFETY-CRITICAL STEP'));

    // Command menu (options)
    ctx.menuEl.innerHTML = '';
    prompt.options.forEach(opt => {
      const b = this.button(opt.text, () => this._answer(ctx, opt.id, b), 'answer');
      ctx.menuEl.appendChild(b);
    });
  }

  _answer(ctx, optionId, btnEl) {
    const { engine } = ctx;
    const res = engine.answer(optionId);
    // disable menu
    Array.from(ctx.menuEl.querySelectorAll('button')).forEach(b => { b.disabled = true; b.classList.add('locked'); });
    // mark chosen + correct
    Array.from(ctx.menuEl.querySelectorAll('button')).forEach(b => {
      if (b.textContent === res.correctText) b.classList.add('is-correct');
    });
    if (!res.correct && btnEl) btnEl.classList.add('is-wrong');

    this._updateBars(ctx);

    // feedback
    let fb;
    if (res.correct) {
      fb = this.el('div', 'cs-feedback good', '✔ Correct.');
    } else {
      const lines = [];
      lines.push((res.critical ? '⚠ CRITICAL MISS. ' : '✗ Not quite. ') + 'Correct: ' + res.correctText);
      const why = (res.howto && res.howto.trim()) ? res.howto : (res.hint && res.hint.trim() ? res.hint : '');
      if (res.critical) lines.push(why ? ('WHY IT MATTERS: ' + why) : 'This step is safety-critical — a miss here fails a real evaluation.');
      else if (why) lines.push('Cue: ' + why);
      fb = this.el('div', 'cs-feedback ' + (res.critical ? 'crit' : 'bad'));
      lines.forEach(l => fb.appendChild(this.el('div', 'cs-line', l)));
    }
    ctx.feedbackEl.replaceWith(fb); ctx.feedbackEl = fb;

    const cont = this.el('div', 'cs-row');
    const proceed = () => {
      if (res.finished) this._finishBattle(ctx, res);
      else this._nextQuestion(ctx);
    };
    if (res.finished && (res.criticalFail || res.hpDepleted)) {
      cont.appendChild(this.button('See result', proceed, 'primary'));
    } else {
      cont.appendChild(this.button(res.finished ? 'See result' : 'Continue ›', proceed, 'primary'));
    }
    fb.appendChild(cont);
  }

  _finishBattle(ctx, lastRes) {
    this._stopTimer(ctx);
    const r = ctx.engine.result();
    let badgeAwarded = false;
    if (ctx.graded) {
      this.storage.recordScore(ctx.eventId, r.score);
      if (r.passed && !this.storage.hasBadge(ctx.eventId)) { this.storage.awardBadge(ctx.eventId, r.score); badgeAwarded = true; }
      else if (r.passed) { this.storage.awardBadge(ctx.eventId, r.score); badgeAwarded = true; }
    }

    const wrap = this.el('div', 'cs-result');
    const win = ctx.graded ? r.passed : true;
    wrap.appendChild(this.header(
      ctx.graded ? (r.passed ? '🏅 BADGE EARNED' : 'Attempt failed') : 'Drill complete',
      ctx.event.name));

    const reason = this.el('div', 'cs-result-reason');
    if (ctx.graded && !r.passed) {
      if (r.criticalFail) reason.textContent = 'A safety-critical step was missed — instant fail on a real evaluation.';
      else if (r.timedOut) reason.textContent = 'Time expired before completing the evolution.';
      else if (r.hpLeft <= 0) reason.textContent = 'Too many mistakes — run stopped.';
      else reason.textContent = 'Score ' + r.score + '% is below the ' + Math.round(r.passThreshold * 100) + '% standard.';
    } else if (ctx.graded) {
      reason.textContent = 'Score ' + r.score + '% — meets the ' + Math.round(r.passThreshold * 100) + '% standard. ' + ctx.event.badgeName + ' added to your case.';
    } else {
      reason.textContent = 'Score ' + r.score + '% · ' + r.correctCount + '/' + r.total + ' correct. Keep climbing the ramp.';
    }
    wrap.appendChild(reason);

    const stats = this.el('div', 'cs-result-stats');
    stats.appendChild(this.el('div', 'cs-line', 'Steps correct: ' + r.correctCount + '/' + r.total + '  (' + r.score + '%)'));
    if (r.mistakes.length) stats.appendChild(this.el('div', 'cs-line', 'Misses: ' + r.mistakes.length + (r.criticalFail ? ' (incl. critical)' : '')));
    wrap.appendChild(stats);

    const row = this.el('div', 'cs-menu');
    if (ctx.graded && !r.passed) row.appendChild(this.button('↻ Retry RTO run', () => { ctx.panel.close(); this.startBattle(ctx.eventId, ctx.variant, 'graded'); }, 'primary'));
    row.appendChild(this.button('Review steps', () => this.openReference(ctx.eventId, ctx.variant), 'ghost'));
    row.appendChild(this.button('Leave gym', () => ctx.panel.close(), 'ghost'));
    wrap.appendChild(row);

    ctx.panel.panel.innerHTML = '';
    ctx.panel.panel.appendChild(wrap);

    if (badgeAwarded) { this.toast('🏅 ' + ctx.event.badgeName + ' earned!', 'good'); this._checkAllBadges(); }
  }

  // ---- timer ----
  _startTimer(ctx) {
    if (!ctx.timeLimit) return;
    ctx.remaining = ctx.timeLimit;
    ctx.timer = setInterval(() => {
      ctx.remaining--;
      ctx.timerEl.textContent = formatTime(Math.max(0, ctx.remaining));
      ctx.timerEl.classList.toggle('low', ctx.remaining <= 10);
      if (ctx.remaining <= 0) {
        this._stopTimer(ctx);
        ctx.engine.timeUp();
        this._finishBattle(ctx);
      }
    }, 1000);
  }
  _stopTimer(ctx) { if (ctx.timer) { clearInterval(ctx.timer); ctx.timer = null; } }

  // ================= ORDERING DRILL =================
  startOrdering(eventId, variant) {
    const event = this.model.get(eventId);
    const steps = this.model.steps(eventId, variant);
    const order = steps.map((s, i) => i);
    const shuffled = shuffle(order.slice());
    const placed = []; // indices in chosen order

    const wrap = this.el('div', 'cs-ordering');
    wrap.appendChild(this.header('Ordering Drill', event.name + ' — tap steps in the correct sequence'));
    const pool = this.el('div', 'cs-pool');
    const seq = this.el('div', 'cs-seq');
    const seqLabel = this.el('div', 'cs-sub', 'Your sequence:');
    const result = this.el('div', 'cs-feedback');
    wrap.appendChild(pool);
    wrap.appendChild(seqLabel);
    wrap.appendChild(seq);
    wrap.appendChild(result);

    const renderPool = () => {
      pool.innerHTML = '';
      shuffled.forEach(idx => {
        if (placed.indexOf(idx) !== -1) return;
        const chip = this.button(steps[idx].step, () => { placed.push(idx); renderAll(); }, 'chip');
        pool.appendChild(chip);
      });
    };
    const renderSeq = () => {
      seq.innerHTML = '';
      placed.forEach((idx, pos) => {
        const row = this.el('div', 'cs-seq-row');
        row.appendChild(this.el('span', 'cs-seq-num', (pos + 1) + '.'));
        row.appendChild(this.el('span', 'cs-seq-text', steps[idx].step));
        const rm = this.button('✕', () => { placed.splice(pos, 1); renderAll(); }, 'mini');
        row.appendChild(rm);
        seq.appendChild(row);
      });
    };
    const renderAll = () => { renderPool(); renderSeq(); check(); };

    const check = () => {
      if (placed.length !== steps.length) { result.className = 'cs-feedback'; result.textContent = placed.length + '/' + steps.length + ' placed.'; return; }
      let correct = 0; const wrongPos = [];
      placed.forEach((idx, pos) => { if (idx === pos) correct++; else wrongPos.push(pos + 1); });
      if (correct === steps.length) { result.className = 'cs-feedback good'; result.textContent = '✔ Perfect sequence! All ' + steps.length + ' in order.'; }
      else { result.className = 'cs-feedback bad'; result.textContent = '✗ ' + correct + '/' + steps.length + ' in place. Off at position(s): ' + wrongPos.join(', ') + '. Tap ✕ to fix.'; }
    };

    const controls = this.el('div', 'cs-row');
    controls.appendChild(this.button('Reset', () => { placed.length = 0; renderAll(); }, 'ghost'));
    controls.appendChild(this.button('Reveal order', () => this.openReference(eventId, variant), 'ghost'));
    controls.appendChild(this.button('Done', () => panel.close(), 'primary'));
    wrap.appendChild(controls);

    renderAll();
    var panel = this._openPanel(wrap, { panelClass: 'battle-panel' });
  }

  // ================= REFERENCE (read/cram checklist) =================
  openReference(eventId, variant) {
    const event = this.model.get(eventId);
    const variants = this.model.variantsFor(eventId);
    let v = variant || variants[0];

    const wrap = this.el('div', 'cs-reference');
    const head = this.header(event.name, event.badgeName + ' · ' + event.standardRef + ' · limit ' + formatTime(event.timeLimitSeconds));
    wrap.appendChild(head);

    const list = this.el('div', 'cs-checklist');
    const renderList = () => {
      list.innerHTML = '';
      const steps = this.model.steps(eventId, v);
      steps.forEach(s => {
        const row = this.el('div', 'cs-check-row' + (s.critical ? ' crit' : ''));
        row.appendChild(this.el('span', 'cs-check-num', s.order + '.'));
        const txt = this.el('div', 'cs-check-body');
        txt.appendChild(this.el('div', 'cs-check-step', s.step + (s.critical ? '  ⚠' : '')));
        if (s.hint && s.hint.trim()) txt.appendChild(this.el('div', 'cs-check-hint', 'Cue: ' + s.hint));
        if (s.howto && s.howto.trim()) txt.appendChild(this.el('div', 'cs-check-howto', s.howto));
        row.appendChild(txt);
        list.appendChild(row);
      });
    };

    if (this.model.hasVariants(eventId)) {
      const vrow = this.el('div', 'cs-row');
      variants.forEach(vn => vrow.appendChild(this.button(prettyVariant(vn), () => { v = vn; renderList(); }, 'chip')));
      wrap.appendChild(vrow);
    }
    wrap.appendChild(list);
    wrap.appendChild(this.el('div', 'cs-legend', '⚠ = safety-critical: a miss in a graded run is an instant fail.'));
    const controls = this.el('div', 'cs-row');
    controls.appendChild(this.button('Close', () => panel.close(), 'primary'));
    wrap.appendChild(controls);
    renderList();
    var panel = this._openPanel(wrap, { panelClass: 'reference-panel' });
  }

  // ================= HUB (Pokémon-Center style) =================
  openHub() {
    const wrap = this.el('div');
    wrap.appendChild(this.header('Academy HUB', 'Phoenix Regional Training Academy'));
    const menu = this.el('div', 'cs-menu');
    menu.appendChild(this.button('🏅 Badge Case', () => this.openBadgeCase(), 'primary'));
    menu.appendChild(this.button('📋 Reference Library', () => this.openReferenceLibrary()));
    menu.appendChild(this.button('⚙ Settings', () => this.openSettings()));
    menu.appendChild(this.button('Leave', () => panel.close(), 'ghost'));
    wrap.appendChild(menu);
    var panel = this._openPanel(wrap, { dim: true });
  }

  openBadgeCase() {
    const wrap = this.el('div', 'cs-badgecase');
    const events = this.model.all();
    const earned = this.storage.earnedBadges();
    wrap.appendChild(this.header('Badge Case', earned.length + ' / ' + events.length + ' earned'));
    const grid = this.el('div', 'cs-badge-grid');
    events.forEach(e => {
      const got = this.storage.hasBadge(e.id);
      const cell = this.el('div', 'cs-badge ' + (got ? 'earned' : 'locked'));
      cell.appendChild(this.el('div', 'cs-badge-icon', got ? '🏅' : '🔒'));
      cell.appendChild(this.el('div', 'cs-badge-name', e.badgeName));
      cell.appendChild(this.el('div', 'cs-badge-meta', got ? ('best ' + this.storage.bestScore(e.id) + '%') : 'not earned'));
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    if (earned.length === events.length) {
      wrap.appendChild(this.el('div', 'cs-banner good', '✅ ALL SEVEN BADGES — cleared for the live fire-ground test!'));
    } else {
      wrap.appendChild(this.el('div', 'cs-banner', 'Collect all 7 to clear for the live fire-ground test.'));
    }
    wrap.appendChild(this.button('Close', () => panel.close(), 'primary'));
    var panel = this._openPanel(wrap, { panelClass: 'reference-panel' });
  }

  openReferenceLibrary() {
    const wrap = this.el('div');
    wrap.appendChild(this.header('Reference Library', 'Read / cram any evolution'));
    const menu = this.el('div', 'cs-menu');
    this.model.all().forEach(e => menu.appendChild(this.button(e.name + ' · ' + e.standardRef, () => this.openReference(e.id))));
    menu.appendChild(this.button('Back', () => panel.close(), 'ghost'));
    wrap.appendChild(menu);
    var panel = this._openPanel(wrap, { dim: true });
  }

  openSettings() {
    const wrap = this.el('div');
    wrap.appendChild(this.header('Settings', 'Saved on this device'));
    const menu = this.el('div', 'cs-menu');
    // theme toggle
    const themes = this.theme.names();
    menu.appendChild(this.el('div', 'cs-sub', 'Theme'));
    themes.forEach(tn => {
      const active = this.theme.name === tn;
      menu.appendChild(this.button((active ? '● ' : '○ ') + (this.config.themes[tn].name || tn), () => {
        this.theme.apply(tn); this.storage.setSetting('theme', tn); panel.close(); this.openSettings();
      }, active ? 'primary' : ''));
    });
    menu.appendChild(this.el('div', 'cs-sub', 'Progress'));
    menu.appendChild(this.button('🗑 Reset all progress', () => this._confirmReset(), 'danger'));
    menu.appendChild(this.button('Close', () => panel.close(), 'ghost'));
    wrap.appendChild(menu);
    var panel = this._openPanel(wrap, { dim: true });
  }

  _confirmReset() {
    const wrap = this.el('div');
    wrap.appendChild(this.header('Reset progress?', 'Clears all badges + settings on this device'));
    const menu = this.el('div', 'cs-menu');
    menu.appendChild(this.button('Yes, wipe everything', () => {
      this.storage.reset();
      const def = this.config.theme;
      this.theme.apply(def);
      panel.close();
      this.toast('Progress reset.', 'warn');
    }, 'danger'));
    menu.appendChild(this.button('Cancel', () => panel.close(), 'ghost'));
    wrap.appendChild(menu);
    var panel = this._openPanel(wrap, { dim: true });
  }

  _checkAllBadges() {
    if (this.storage.earnedBadges().length === this.model.all().length) {
      setTimeout(() => this.toast('✅ All 7 badges — cleared for the live fire-ground test!', 'good'), 600);
    }
  }

  // ================= WILD NPC QUIZ =================
  openWildQuiz(wildDef) {
    const seen = this.storage.seenEvents();
    const behavior = (this.data.wildNPCs && this.data.wildNPCs.behavior) || {};
    const flavor = (this.data.wildNPCs && this.data.wildNPCs.flavor) || {};
    if (!seen.length) {
      this._simpleDialogue(pick(flavor.greetings) || 'Hey recruit!', 'Visit a gym first — I quiz on what you\'ve studied.');
      return;
    }
    // pick a random seen event + a random step (prefer ordered/choice)
    const eventId = pick(seen);
    const variant = this.model.variantsFor(eventId)[0];
    const steps = this.model.steps(eventId, variant);
    const event = this.model.get(eventId);
    const idxs = steps.map((s, i) => i).filter(i => steps[i].type !== 'inspection');
    const idx = pick(idxs.length ? idxs : steps.map((s, i) => i));
    const step = steps[idx];

    // build a one-off engine just for this single step
    const engine = new BattleEngine({ steps, mode: 'free_recall', optionCount: behavior.optionCount || 4 });
    engine.i = idx; // jump to the chosen step
    const prompt = engine.current();

    const wrap = this.el('div', 'cs-wild');
    const greet = (pick(flavor.greetings) || 'Quick!') ;
    wrap.appendChild(this.el('div', 'cs-speaker', (wildDef.name || pick(flavor.names) || 'Recruit')));
    let qtext;
    if (prompt.type === 'ordered') {
      qtext = idx > 0
        ? (greet + ' What comes after “' + truncate(steps[idx - 1].step) + '”?')
        : (greet + ' What is the FIRST action of ' + event.name + '?');
    } else {
      qtext = greet + ' ' + step.step;
    }
    wrap.appendChild(this.el('div', 'cs-question', qtext));
    const menu = this.el('div', 'cs-command-menu');
    const fb = this.el('div', 'cs-feedback');
    prompt.options.forEach(opt => {
      const b = this.button(opt.text, () => {
        const res = engine.answer(opt.id);
        Array.from(menu.querySelectorAll('button')).forEach(x => { x.disabled = true; if (x.textContent === res.correctText) x.classList.add('is-correct'); });
        if (!res.correct) b.classList.add('is-wrong');
        fb.className = 'cs-feedback ' + (res.correct ? 'good' : 'bad');
        fb.textContent = res.correct
          ? (this.config.settings.wildRewardMessage || 'Nice recall!')
          : ((this.config.settings.wildWrongMessage || 'Review that one.') + '  →  ' + res.correctText);
        const row = this.el('div', 'cs-row');
        row.appendChild(this.button('Move on', () => panel.close(), 'primary'));
        fb.appendChild(row);
      }, 'answer');
      menu.appendChild(b);
    });
    wrap.appendChild(fb);
    wrap.appendChild(menu);
    var panel = this._openPanel(wrap, { panelClass: 'dialogue-panel' });
  }

  _simpleDialogue(speaker, text) {
    const wrap = this.el('div', 'cs-dialogue');
    wrap.appendChild(this.el('div', 'cs-speaker', speaker));
    wrap.appendChild(this.el('div', 'cs-dialogue-body', text));
    const row = this.el('div', 'cs-row');
    row.appendChild(this.button('OK', () => panel.close(), 'primary'));
    wrap.appendChild(row);
    var panel = this._openPanel(wrap, { panelClass: 'dialogue-panel' });
  }
}

// ---- generic helpers (no content) ----
function modeLabel(mode) {
  return ({ graded: 'GRADED · RTO', recognition: 'STUDY · Recognition', free_recall: 'STUDY · Free Recall', timed: 'STUDY · Timed' })[mode] || mode;
}
function prettyVariant(v) { return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function formatTime(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); }
function truncate(s, n) { n = n || 48; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function pick(a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; }
