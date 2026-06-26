// Theme.js — applies a palette (from config.json) to CSS custom properties and
// exposes color lookups for the Phaser canvas. Palettes themselves live in
// config.json under "themes"; this file only wires them, no colors hardcoded.

export class Theme {
  constructor(config) {
    this.config = config;
    this.themes = config.themes || {};
    this.current = null;
    this.name = null;
  }

  names() { return Object.keys(this.themes); }

  apply(themeName) {
    const t = this.themes[themeName] || this.themes[this.config.theme] || this.themes[this.names()[0]];
    this.current = t;
    this.name = themeName;
    const root = document.documentElement;
    const c = t.colors || {};
    Object.keys(c).forEach(k => root.style.setProperty('--c-' + kebab(k), c[k]));
    const f = t.fonts || {};
    if (f.display) root.style.setProperty('--font-display', f.display);
    if (f.body) root.style.setProperty('--font-body', f.body);
    root.setAttribute('data-theme', themeName);
    return this;
  }

  // hex number for Phaser fills, e.g. theme.num('ground')
  num(colorKey) {
    const c = (this.current && this.current.colors) || {};
    const hex = c[colorKey] || '#888888';
    return parseInt(hex.replace('#', '0x'));
  }

  hex(colorKey) {
    const c = (this.current && this.current.colors) || {};
    return c[colorKey] || '#888888';
  }
}

function kebab(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); }
