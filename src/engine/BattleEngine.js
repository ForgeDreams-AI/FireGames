// BattleEngine.js — pure, content-free battle/quiz state machine.
// It is handed a flat list of step objects (from EventModel) plus rules, and
// drives the step-by-step "produce the next graded action" loop used by both
// STUDY sub-modes (recognition/free_recall/timed) and GRADED mode.
// It generates a question per step based on the step's "type", evaluates the
// answer, and tracks HP / score / critical-fail / completion. The UI owns the
// clock and the rendering; this file owns the rules.
//
// MODES:
//   'recognition' — multiple choice, full sequence/progress visible (study)
//   'free_recall' — multiple choice, no list shown (study)
//   'timed'       — free recall against a clock (study)
//   'graded'      — no list, real time limit, criticals hard-fail (badge run)
// (The whole-sequence "ordering" drill is a separate UI interaction that uses
//  EventModel directly; it does not run through this loop.)

const GRADED = 'graded';

export class BattleEngine {
  constructor(opts) {
    this.steps = opts.steps || [];
    this.mode = opts.mode || GRADED;
    this.optionCount = opts.optionCount || 4;
    this.maxHP = opts.startingHP != null ? opts.startingHP : 5;
    this.nonCriticalHPLoss = opts.nonCriticalHPLoss != null ? opts.nonCriticalHPLoss : 1;
    this.passThreshold = opts.passThreshold != null ? opts.passThreshold : 0.65;
    this.rng = opts.rng || Math.random;

    this.total = this.steps.length;
    this.i = 0;
    this.hp = this.maxHP;
    this.correctCount = 0;
    this.mistakes = [];          // [{ index, critical }]
    this.criticalFail = false;
    this.timedOut = false;
    this.finished = false;
    this._currentPrompt = null;
  }

  get isGraded() { return this.mode === GRADED; }
  get showSequence() { return this.mode === 'recognition'; }

  // Returns the current question descriptor, or null when finished.
  current() {
    if (this.finished || this.i >= this.total) return null;
    if (this._currentPrompt && this._currentPrompt.index === this.i) return this._currentPrompt;
    this._currentPrompt = this._buildPrompt(this.i);
    return this._currentPrompt;
  }

  _buildPrompt(idx) {
    const step = this.steps[idx];
    const type = step.type || 'ordered';
    let options;
    if (type === 'ordered') {
      options = this._orderedOptions(idx);
    } else {
      // 'choice' / 'inspection' — options come from data, correct is element 0.
      const raw = (step.options && step.options.length) ? step.options : [step.step];
      options = this._labelOptions(raw[0], raw.slice(1));
    }
    return {
      index: idx,
      order: idx + 1,
      total: this.total,
      type,
      step,
      critical: !!step.critical,
      options,                    // [{ id, text, _correct }]
      correctId: options.find(o => o._correct).id
    };
  }

  // For "ordered" steps, build the choice set from the correct next step plus
  // distractors drawn from OTHER steps of the same event.
  _orderedOptions(idx) {
    const correct = this.steps[idx].step;
    const pool = this.steps
      .filter((s, j) => j !== idx && s.step && s.step !== correct)
      .map(s => s.step);
    const distractors = this._sample(this._unique(pool), Math.max(0, this.optionCount - 1));
    return this._labelOptions(correct, distractors);
  }

  _labelOptions(correct, distractors) {
    const arr = [{ text: correct, _correct: true }].concat(distractors.map(t => ({ text: t, _correct: false })));
    this._shuffle(arr);
    return arr.map((o, k) => ({ id: 'opt' + k, text: o.text, _correct: o._correct }));
  }

  // Evaluate an answer by option id. Returns a result descriptor the UI renders.
  answer(optionId) {
    const prompt = this.current();
    if (!prompt) return { finished: true };
    const chosen = prompt.options.find(o => o.id === optionId);
    const correct = !!(chosen && chosen._correct);
    const critical = prompt.critical;
    const correctOption = prompt.options.find(o => o._correct);

    const res = {
      correct,
      critical,
      index: prompt.index,
      step: prompt.step,
      correctText: correctOption.text,
      hint: prompt.step.hint || '',
      howto: prompt.step.howto || '',
      criticalFail: false,
      hpLoss: 0,
      hp: this.hp,
      finished: false
    };

    if (correct) {
      this.correctCount++;
    } else {
      this.mistakes.push({ index: prompt.index, critical });
      if (this.isGraded && critical) {
        // Safety-critical miss in a graded run = immediate KO.
        this.criticalFail = true;
        res.criticalFail = true;
      } else {
        // Non-critical miss (any mode) or any miss in study = chip damage.
        const loss = this.nonCriticalHPLoss;
        this.hp = Math.max(0, this.hp - loss);
        res.hpLoss = loss;
      }
    }
    res.hp = this.hp;

    // Decide whether the run ends here.
    if (res.criticalFail) {
      this.finished = true;
      res.finished = true;
    } else if (this.hp <= 0) {
      this.finished = true;
      res.finished = true;
      res.hpDepleted = true;
    } else {
      // Advance to the next step (correct OR revealed non-critical miss).
      this.i++;
      this._currentPrompt = null;
      if (this.i >= this.total) { this.finished = true; res.finished = true; }
    }
    res.advanced = !res.criticalFail && !res.hpDepleted;
    return res;
  }

  // The UI calls this when the clock hits zero (graded / timed).
  timeUp() {
    if (this.finished) return;
    this.timedOut = true;
    this.finished = true;
  }

  // Final scored result.
  result() {
    const proportion = this.total ? this.correctCount / this.total : 0;
    const survived = !this.criticalFail && !this.timedOut && this.hp > 0;
    const completedAll = this.correctCount + this.mistakes.length >= this.total || this.i >= this.total;
    const passed = this.isGraded
      ? (survived && proportion >= this.passThreshold && (completedAll || this.correctCount === this.total))
      : true; // study mode is never pass/fail
    return {
      mode: this.mode,
      passed,
      proportion,
      score: Math.round(proportion * 100),
      correctCount: this.correctCount,
      total: this.total,
      mistakes: this.mistakes.slice(),
      criticalFail: this.criticalFail,
      timedOut: this.timedOut,
      hpLeft: this.hp,
      maxHP: this.maxHP,
      passThreshold: this.passThreshold
    };
  }

  // --- helpers ---
  _unique(arr) { return Array.from(new Set(arr)); }
  _sample(arr, n) {
    const copy = arr.slice();
    this._shuffle(copy);
    return copy.slice(0, n);
  }
  _shuffle(arr) {
    for (let k = arr.length - 1; k > 0; k--) {
      const j = Math.floor(this.rng() * (k + 1));
      const t = arr[k]; arr[k] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}
