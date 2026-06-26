// BootScene.js — builds textures for every key in the asset manifest.
// If a manifest entry has a non-empty "file", it is loaded as real art.
// Otherwise a GREYBOX texture is generated from the entry's spec + theme color.
// This is the art-swap layer: no engine code changes when real PNGs are added.

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.theme = this.registry.get('theme');
    this.assets = this.registry.get('data').assets;
    this.tileSize = this.registry.get('data').map.tileSize || 32;

    const base = ''; // relative
    const queueFile = (key, entry) => {
      if (entry.file && entry.file.trim()) {
        this._realKeys = this._realKeys || {};
        this._realKeys[key] = true;
        this.load.image(key, base + 'src/assets/' + entry.file);
      }
    };
    forEachAsset(this.assets, (key, entry) => queueFile(key, entry));

    // If a real file 404s, fall back to greybox for that key.
    this.load.on('loaderror', (file) => {
      if (this._realKeys) delete this._realKeys[file.key];
    });
  }

  create() {
    forEachAsset(this.assets, (key, entry, group) => {
      const haveReal = this._realKeys && this._realKeys[key] && this.textures.exists(key);
      if (!haveReal) this._greybox(key, entry, group);
    });
    this.scene.start('Overworld');
  }

  _greybox(key, entry, group) {
    const ts = this.tileSize;
    const g = this.add.graphics();
    const col = this.theme.num(entry.colorKey || 'ground');
    if (group === 'tiles') {
      g.fillStyle(col, 1).fillRect(0, 0, ts, ts);
      if (entry.border) { g.lineStyle(2, 0x000000, 0.35).strokeRect(1, 1, ts - 2, ts - 2); }
      if (entry.shape === 'doormark') {
        g.fillStyle(this.theme.num('pad'), 1).fillRect(0, 0, ts, ts);
        g.fillStyle(col, 1).fillRect(ts * 0.3, ts * 0.15, ts * 0.4, ts * 0.7);
      }
      g.generateTexture(key, ts, ts);
    } else {
      const w = entry.w || 26, h = entry.h || 26;
      g.fillStyle(0x000000, 0.25).fillRoundedRect(2, h - 5, w - 4, 5, 2); // shadow
      g.fillStyle(col, 1).fillRoundedRect(0, 0, w, h, 6);
      g.lineStyle(2, 0x000000, 0.4).strokeRoundedRect(1, 1, w - 2, h - 2, 6);
      g.generateTexture(key, w, h);
    }
    g.destroy();
  }
}

function forEachAsset(assets, fn) {
  ['tiles', 'sprites'].forEach(group => {
    const set = assets[group] || {};
    Object.keys(set).forEach(k => fn(k, set[k], group));
  });
}
