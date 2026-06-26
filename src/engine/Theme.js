// Theme.js — applies a palette (from config.json) to CSS custom properties and
// exposes color lookups for the Phaser canvas. Base palettes live in
// config.json under "themes"; per-device user COLOR OVERRIDES (set in the
// Graphics settings) are merged on top. No colors are hardcoded here.

export class Theme {
  constructor(config) {
    this.config = config;
    this.themes = config.themes || {};
    this.current = null;        // merged colors+fonts for the active theme
    this.name = null;
    this.overrides = {};        // { [themeName]: { [colorKey]: hex } }
  }

  names() { return Object.keys(this.themes); }

  setOverrides(overrides) { this.overrides = overrides || {}; return this; }

  // Base palette for a theme (no user overrides) — used to show defaults/reset.
  baseColors(themeName) {
    const t = this.themes[themeName] || {};
    return Object.assign({}, t.colors || {});
  }

  apply(themeName) {
    const base = this.themes[themeName] || this.themes[this.config.theme] || this.themes[this.names()[0]];
    const name = this.themes[themeName] ? themeName : (this.config.theme || this.names()[0]);
    const ov = this.overrides[name] || {};
    const colors = Object.assign({}, base.colors || {}, ov);
    this.current = { colors, fonts: base.fonts || {}, zones: base.zones || {} };
    this.name = name;

    const root = document.documentElement;
    Object.keys(colors).forEach(k => root.style.setProperty('--c-' + kebab(k), colors[k]));
    const f = base.fonts || {};
    if (f.display) root.style.setProperty('--font-display', f.display);
    if (f.body) root.style.setProperty('--font-body', f.body);
    root.setAttribute('data-theme', name);
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

  // Zone (discipline) colors for color-coding the campus.
  zoneHex(zone) {
    const z = (this.current && this.current.zones) || {};
    return z[zone] || this.hex('accent');
  }
  zoneNum(zone) { return parseInt(this.zoneHex(zone).replace('#', '0x')); }

  // ordered list of color keys for the active theme (for the editor UI)
  colorKeys() { return Object.keys((this.current && this.current.colors) || {}); }
}

function kebab(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); }
