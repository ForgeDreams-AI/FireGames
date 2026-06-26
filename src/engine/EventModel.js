// EventModel.js — interprets events.json. Resolves an event + variant into a
// single flat, correctly-ordered list of steps. No content strings here; it
// only reshapes whatever data events.json provides.

export class EventModel {
  constructor(events) {
    this.events = events;
    this.byId = {};
    events.forEach(e => { this.byId[e.id] = e; });
  }

  get(eventId) { return this.byId[eventId]; }
  all() { return this.events; }

  variantsFor(eventId) {
    const e = this.byId[eventId];
    if (!e) return ['default'];
    return (e.variants && e.variants.length) ? e.variants : ['default'];
  }

  hasVariants(eventId) {
    const v = this.variantsFor(eventId);
    return !(v.length === 1 && v[0] === 'default');
  }

  // Flat ordered step list for a given variant. Concatenates:
  // sharedSteps -> variantSteps[variant] (if present) -> commonTail.
  steps(eventId, variant) {
    const e = this.byId[eventId];
    if (!e) return [];
    const v = variant || this.variantsFor(eventId)[0];
    const out = [];
    (e.sharedSteps || []).forEach(s => out.push(s));
    if (e.variantSteps && e.variantSteps[v]) e.variantSteps[v].forEach(s => out.push(s));
    (e.commonTail || []).forEach(s => out.push(s));
    // Normalize: assign a sequential global index + resolve per-variant how-to.
    return out.map((s, i) => this._normalize(s, i, v));
  }

  _normalize(s, globalIndex, variant) {
    let howto = '';
    if (s.howto) {
      howto = (variant && s.howto[variant]) ? s.howto[variant] : (s.howto.default || '');
    }
    return {
      index: globalIndex,
      order: globalIndex + 1,
      type: s.type || 'ordered',
      step: s.step,
      critical: !!s.critical,
      hint: s.hint || '',
      howto: howto,
      options: s.options ? s.options.slice() : null
    };
  }

  // The graded answer-key length (for scoring proportion).
  stepCount(eventId, variant) { return this.steps(eventId, variant).length; }

  timeLimit(eventId) {
    const e = this.byId[eventId];
    return e ? e.timeLimitSeconds : 60;
  }
}
