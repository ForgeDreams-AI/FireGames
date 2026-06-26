// InteriorScene.js — a walkable room for one gym. Built entirely from
// map.json (gym.interior): tile map, props, study NPC(s), the RTO, exit, and a
// signage board. Holds NO content — all geometry/labels/links come from data;
// the guided walk-through and RTO encounter are delegated to the UI layer.
//
// Interior tile codes: 0 floor (walkable), 1 wall (blocked), 2 exit (walkable).

const ITILE = { 0: 'ifloor', 1: 'iwall', 2: 'exit' };

export class InteriorScene extends Phaser.Scene {
  constructor() { super('Interior'); }

  init(data) { this.gymId = data.gymId; }

  create() {
    this.registry.set('activeScene', this);
    const dataAll = this.registry.get('data');
    this.theme = this.registry.get('theme');
    this.ui = this.registry.get('ui');
    this.model = this.registry.get('model');
    this.storage = this.registry.get('storage');
    this.config = dataAll.config;

    this.gym = dataAll.map.gyms.find(g => g.id === this.gymId);
    this.eventId = this.gym.eventId;
    this.room = this.gym.interior;
    this.ts = dataAll.map.tileSize || 32;
    this.event = this.model.get(this.eventId);

    this._drawRoom();
    this._placeObjects();
    this._spawnPlayer();

    const worldW = this.room.width * this.ts, worldH = this.room.height * this.ts;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    // Small rooms: center the room rather than follow the player.
    this.cameras.main.centerOn(worldW / 2, worldH / 2);
    this.cameras.main.setBackgroundColor(this.theme.hex('bgDeep'));
    const disp = this.storage.display();
    this.cameras.main.setZoom(disp.zoom || 1);
    this._fadeMs = disp.reducedMotion ? 0 : 180;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-ENTER', () => this.action());
    this.input.keyboard.on('keydown-SPACE', () => this.action());
    this.touchDir = null;
    this.facing = { x: 0, y: -1 };
    this.moving = false;

    this.cameras.main.fadeIn(this._fadeMs);
    this.ui.banner('Entering: ' + (this.gym.label || this.event.name));
  }

  _drawRoom() {
    const g = this.room.grid;
    for (let y = 0; y < this.room.height; y++) {
      for (let x = 0; x < this.room.width; x++) {
        if (g[y][x] !== 0) this.add.image(x * this.ts, y * this.ts, 'ifloor').setOrigin(0);
        this.add.image(x * this.ts, y * this.ts, ITILE[g[y][x]] || 'ifloor').setOrigin(0);
      }
    }
  }

  _placeObjects() {
    // props (greybox box + data label)
    (this.room.props || []).forEach(p => {
      this.add.image(this._cx(p.tile.x), this._cy(p.tile.y), p.spriteKey).setDepth(2);
      if (p.label) this._tag(p.tile.x, p.tile.y, p.label, 'sage');
    });

    // signage board — text composed from data (name / badge / time / threshold)
    const sg = this.room.signage;
    if (sg) {
      this.add.image(this._cx(sg.tile.x), this._cy(sg.tile.y), 'signage').setDepth(2);
      this._signLabel(sg.tile.x, sg.tile.y);
    }

    // study NPC(s)
    this.npcs = [];
    (this.room.studyNPCs || []).forEach(n => {
      this.add.image(this._cx(n.tile.x), this._cy(n.tile.y), n.spriteKey || 'npc').setDepth(3);
      this._tag(n.tile.x, n.tile.y, n.name || 'Instructor', 'sage');
      this.npcs.push(n);
    });

    // RTO
    this.rto = this.room.rto;
    this.add.image(this._cx(this.rto.tile.x), this._cy(this.rto.tile.y), this.rto.spriteKey || 'rto').setDepth(3);
    this._tag(this.rto.tile.x, this.rto.tile.y, this.rto.name || 'RTO Evaluator', 'rto');
  }

  _signLabel(tx, ty) {
    const earned = this.storage.hasBadge(this.eventId);
    const pct = Math.round((this.config.passThreshold || 0.65) * 100);
    const lines = [
      this.event.name,
      (earned ? '🏅 Badge earned' : '🔒 Badge not earned'),
      'Time: ' + formatTime(this.event.timeLimitSeconds),
      'Pass: ' + pct + '%'
    ];
    this.add.text(this._cx(tx) + this.ts * 0.7, this._cy(ty) - this.ts * 0.5, lines.join('\n'), {
      fontFamily: 'monospace', fontSize: '9px', color: this.theme.hex('text'),
      backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 4, y: 3 }, lineSpacing: 2
    }).setOrigin(0, 0).setDepth(4);
  }

  _tag(tx, ty, text, colorKey) {
    this.add.text(this._cx(tx), this._cy(ty) - this.ts * 0.6, text, {
      fontFamily: 'monospace', fontSize: '9px', color: this.theme.hex(colorKey || 'text'),
      align: 'center', backgroundColor: 'rgba(0,0,0,0.35)', padding: { x: 2, y: 1 }
    }).setOrigin(0.5, 1).setDepth(4);
  }

  _spawnPlayer() {
    const s = this.room.entryTile;
    this.tile = { x: s.x, y: s.y };
    this.player = this.physics.add.image(this._cx(s.x), this._cy(s.y), 'player').setDepth(5);
  }

  _cx(tx) { return tx * this.ts + this.ts / 2; }
  _cy(ty) { return ty * this.ts + this.ts / 2; }

  setDir(dir) { this.touchDir = dir; }
  clearDir(dir) { if (this.touchDir === dir || !dir) this.touchDir = null; }

  update() {
    if (this.ui.isModalOpen() || this.moving) return;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.touchDir === 'left') dx = -1;
    else if (this.cursors.right.isDown || this.touchDir === 'right') dx = 1;
    else if (this.cursors.up.isDown || this.touchDir === 'up') dy = -1;
    else if (this.cursors.down.isDown || this.touchDir === 'down') dy = 1;
    if (dx || dy) { this.facing = { x: dx, y: dy }; this._tryStep(dx, dy); }
  }

  _tryStep(dx, dy) {
    const nx = this.tile.x + dx, ny = this.tile.y + dy;
    if (this._objectAt(nx, ny)) return;          // NPC/RTO/prop block; interact via A
    if (!this._walkable(nx, ny)) return;
    this.moving = true;
    this.tile = { x: nx, y: ny };
    this.tweens.add({
      targets: this.player, x: this._cx(nx), y: this._cy(ny), duration: 120,
      onComplete: () => { this.moving = false; this._onArrive(); }
    });
  }

  _onArrive() {
    const e = this.room.exitTile;
    if (this.tile.x === e.x && this.tile.y === e.y) this._exit();
  }

  action() {
    if (this.ui.isModalOpen() || this.moving) return;
    const fx = this.tile.x + this.facing.x, fy = this.tile.y + this.facing.y;
    if (this.rto.tile.x === fx && this.rto.tile.y === fy) { this.ui.openRTOEncounter(this.eventId); return; }
    const npc = (this.npcs || []).find(n => n.tile.x === fx && n.tile.y === fy);
    if (npc) { this.ui.openWalkthrough(this.eventId, npc.name); return; }
    // facing the exit tile? allow A to leave too
    const e = this.room.exitTile;
    if (e.x === fx && e.y === fy) this._exit();
  }

  _objectAt(x, y) {
    if (this.rto.tile.x === x && this.rto.tile.y === y) return true;
    if ((this.npcs || []).some(n => n.tile.x === x && n.tile.y === y)) return true;
    if ((this.room.props || []).some(p => p.tile.x === x && p.tile.y === y)) return true;
    if (this.room.signage && this.room.signage.tile.x === x && this.room.signage.tile.y === y) return true;
    return false;
  }

  _walkable(x, y) {
    if (x < 0 || y < 0 || x >= this.room.width || y >= this.room.height) return false;
    return this.room.walkable.indexOf(this.room.grid[y][x]) !== -1;
  }

  _exit() {
    this.input.enabled = false;
    this.ui.banner('Returning to the fire-ground');
    const go = () => { this.scene.stop(); this.scene.wake('Overworld'); };
    if (this._fadeMs <= 0) { go(); return; }
    this.cameras.main.fadeOut(this._fadeMs);
    this.cameras.main.once('camerafadeoutcomplete', go);
  }
}

function formatTime(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); }
