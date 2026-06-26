// OverworldScene.js — the walkable fire-ground. Renders the grid from map.json,
// moves the recruit tile-by-tile (keyboard + injected touch direction), handles
// fence/building collision, and fires triggers (enter gym / talk NPC / hub /
// wild quiz). It holds NO content — all geometry, labels and links come from
// map.json; all dialogue/quiz UI is delegated to the UI layer.

const TILE_KEY = { 0: 'ground', 1: 'road', 2: 'fence', 3: 'building', 4: 'pad', 5: 'padwall' };

export class OverworldScene extends Phaser.Scene {
  constructor() { super('Overworld'); }

  create() {
    this.registry.set('overworld', this);
    this.registry.set('activeScene', this);
    const data = this.registry.get('data');
    this.theme = this.registry.get('theme');
    this.ui = this.registry.get('ui');
    this.model = this.registry.get('model');
    this.map = data.map;
    this.wildCfg = data.wildNPCs;
    this.ts = this.map.tileSize || 32;

    this._drawGrid();
    this._placeMarkers();
    this._spawnNPCs();
    this._spawnWild();
    this._spawnPlayer();

    const worldW = this.map.width * this.ts, worldH = this.map.height * this.ts;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setBackgroundColor(this.theme.hex('bgDeep'));
    this._applyDisplay();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyAction = this.input.keyboard.addKeys({ enter: Phaser.Input.Keyboard.KeyCodes.ENTER, space: Phaser.Input.Keyboard.KeyCodes.SPACE });
    this.input.keyboard.on('keydown-ENTER', () => this.action());
    this.input.keyboard.on('keydown-SPACE', () => this.action());

    this.touchDir = null;    // set by DOM d-pad
    this.facing = { x: 0, y: 1 };
    this.moving = false;
    this._wildTimer = 0;

    // When we return from an interior, this scene is woken (not re-created):
    // restore control + fade the camera back in.
    this.events.on('wake', () => {
      this.registry.set('activeScene', this);
      this.touchDir = null; this.moving = false;
      this.input.enabled = true;
      this._applyDisplay();
      this.cameras.main.fadeIn(this._fadeMs);
    });

    this.ui.onOverworldReady && this.ui.onOverworldReady();
  }

  // Camera zoom + reduced-motion from the Graphics display settings.
  _applyDisplay() {
    const d = this.registry.get('storage').display();
    this.cameras.main.setZoom(d.zoom || 1);
    this._fadeMs = d.reducedMotion ? 0 : 170;
  }

  // ----- rendering -----
  _drawGrid() {
    const g = this.map.grid;
    this.tileLayer = this.add.group();
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const key = TILE_KEY[g[y][x]] || 'ground';
        // draw ground under everything for nicer edges
        if (g[y][x] !== 0) this.add.image(x * this.ts, y * this.ts, 'ground').setOrigin(0);
        this.add.image(x * this.ts, y * this.ts, key).setOrigin(0);
      }
    }
  }

  _placeMarkers() {
    this.doorTiles = {}; // "x,y" -> { type:'gym'|'hub', eventId, gym }
    this.map.gyms.forEach(gym => {
      const d = gym.door;
      this.doorTiles[d.x + ',' + d.y] = { type: 'gym', eventId: gym.eventId, gym };
      this.add.image(d.x * this.ts, d.y * this.ts, 'door').setOrigin(0).setDepth(1);
      this._label(d.x, d.y - 0.0, gym.label || gym.eventId, 'accent');
    });
    const hd = this.map.hub.door;
    this.doorTiles[hd.x + ',' + hd.y] = { type: 'hub' };
    this.add.image(hd.x * this.ts, hd.y * this.ts, 'door').setOrigin(0).setDepth(1);
    this._label(this.map.hub.building.x0 + 1.5, this.map.hub.building.y0 + 1.3, this.map.hub.label || 'HUB', 'accent', 14);
  }

  _label(tx, ty, text, colorKey, size) {
    const t = this.add.text(tx * this.ts + this.ts / 2, ty * this.ts - 6, text, {
      fontFamily: 'monospace', fontSize: (size || 9) + 'px', color: this.theme.hex(colorKey || 'text'),
      align: 'center', backgroundColor: 'rgba(0,0,0,0.35)', padding: { x: 2, y: 1 }
    }).setOrigin(0.5, 1).setDepth(2);
    return t;
  }

  _spawnNPCs() {
    this.npcs = [];
    (this.map.npcs || []).forEach(n => {
      const img = this.add.image(n.tile.x * this.ts + this.ts / 2, n.tile.y * this.ts + this.ts / 2, n.spriteKey || 'npc').setDepth(3);
      this._label(n.tile.x, n.tile.y, n.name || 'NPC', 'sage');
      this.npcs.push({ def: n, img });
    });
  }

  _spawnWild() {
    this.wild = [];
    (this.map.wildNPCs || []).forEach(w => {
      const start = w.patrol && w.patrol[0] ? w.patrol[0] : { x: 1, y: 1 };
      const img = this.add.image(start.x * this.ts + this.ts / 2, start.y * this.ts + this.ts / 2, w.spriteKey || 'wild').setDepth(3);
      this.wild.push({ def: w, img, tile: { x: start.x, y: start.y }, pi: 0 });
    });
  }

  _spawnPlayer() {
    const s = this.map.playerStart;
    this.tile = { x: s.x, y: s.y };
    this.player = this.physics.add.image(this._cx(s.x), this._cy(s.y), 'player').setDepth(5);
  }

  _cx(tx) { return tx * this.ts + this.ts / 2; }
  _cy(ty) { return ty * this.ts + this.ts / 2; }

  // ----- input from DOM d-pad -----
  setDir(dir) { this.touchDir = dir; }
  clearDir(dir) { if (this.touchDir === dir || !dir) this.touchDir = null; }

  update(time, delta) {
    this._moveWild(delta);
    if (this.ui.isModalOpen()) { return; }
    if (this.moving) return;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.touchDir === 'left') dx = -1;
    else if (this.cursors.right.isDown || this.touchDir === 'right') dx = 1;
    else if (this.cursors.up.isDown || this.touchDir === 'up') dy = -1;
    else if (this.cursors.down.isDown || this.touchDir === 'down') dy = 1;

    if (dx !== 0 || dy !== 0) {
      this.facing = { x: dx, y: dy };
      this._tryStep(dx, dy);
    }
  }

  _tryStep(dx, dy) {
    const nx = this.tile.x + dx, ny = this.tile.y + dy;
    // wild NPC in the way? -> quiz instead of moving
    const w = this._wildAt(nx, ny);
    if (w) { this._triggerWild(w); return; }
    // NPC in the way? -> they block; face them (interact via action button)
    if (this._npcAt(nx, ny)) return;
    if (!this._walkable(nx, ny)) return;

    this.moving = true;
    this.tile = { x: nx, y: ny };
    this.tweens.add({
      targets: this.player, x: this._cx(nx), y: this._cy(ny), duration: 130, ease: 'Linear',
      onComplete: () => { this.moving = false; this._onArrive(); }
    });
  }

  _onArrive() {
    const key = this.tile.x + ',' + this.tile.y;
    const door = this.doorTiles[key];
    if (door) {
      if (door.type === 'hub') this.ui.openHub();
      else this._enterGym(door);
    }
  }

  _enterGym(door) {
    const unlocked = this.isGymUnlocked(door.gym);
    if (!unlocked) { this.ui.toast(this.ui.lockedMessage(door.gym), 'warn'); return; }
    this._enterInterior(door.gym);
  }

  // Enter transition: fade out + banner, then sleep this scene and launch the
  // gym's interior. Returning wakes this scene (see the 'wake' handler).
  _enterInterior(gym) {
    if (this._transitioning) return;
    this._transitioning = true;
    this.input.enabled = false;
    this.touchDir = null;
    const go = () => {
      this._transitioning = false;
      this.scene.launch('Interior', { gymId: gym.id });
      this.scene.sleep();
    };
    if (this._fadeMs <= 0) { go(); return; }
    this.cameras.main.fadeOut(this._fadeMs);
    this.cameras.main.once('camerafadeoutcomplete', go);
  }

  isGymUnlocked(gym) {
    const idx = gym.unlockIndex || 0;
    if (idx <= 0) return true;
    // unlocked if the gym immediately before it (by unlockIndex) has a badge
    const prev = this.map.gyms.find(g => (g.unlockIndex || 0) === idx - 1);
    if (!prev) return true;
    return this.registry.get('storage').hasBadge(prev.eventId);
  }

  // Action button / Enter: interact with a facing NPC, door, or hub.
  action() {
    if (this.ui.isModalOpen() || this.moving) return;
    const fx = this.tile.x + this.facing.x, fy = this.tile.y + this.facing.y;
    const npc = this._npcAt(fx, fy);
    if (npc) { this.ui.openDialogue(npc.def); return; }
    const here = this.doorTiles[this.tile.x + ',' + this.tile.y];
    if (here) { here.type === 'hub' ? this.ui.openHub() : this._enterGym(here); return; }
    const w = this._wildAt(fx, fy);
    if (w) { this._triggerWild(w); }
  }

  _npcAt(x, y) { return this.npcs.find(n => n.def.tile.x === x && n.def.tile.y === y); }
  _wildAt(x, y) { return this.wild.find(w => w.tile.x === x && w.tile.y === y); }

  _walkable(x, y) {
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return false;
    return this.map.walkable.indexOf(this.map.grid[y][x]) !== -1;
  }

  _triggerWild(w) { this.ui.openWildQuiz(w.def); }

  _moveWild(delta) {
    if (this.ui.isModalOpen()) return;
    const interval = (this.wildCfg && this.wildCfg.behavior && this.wildCfg.behavior.moveEveryMs) || 700;
    this._wildTimer += delta;
    if (this._wildTimer < interval) return;
    this._wildTimer = 0;
    this.wild.forEach(w => {
      const path = w.def.patrol || [];
      if (path.length < 2) return;
      w.pi = (w.pi + 1) % path.length;
      const t = path[w.pi];
      w.tile = { x: t.x, y: t.y };
      this.tweens.add({ targets: w.img, x: this._cx(t.x), y: this._cy(t.y), duration: 300 });
    });
  }
}
