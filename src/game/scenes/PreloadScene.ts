import Phaser from 'phaser'

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload() {
    // Simple loading UI
    const { width, height } = this.scale
    this.add.text(width/2, height/2 - 96, 'Loading…', { fontFamily:'monospace', fontSize:'72px', color:'#ffffff' }).setOrigin(0.5)
    const barW = 960, barH = 48
    this.add.rectangle(width/2, height/2 + 24, barW, barH, 0x111144).setOrigin(0.5)
    const bar = this.add.rectangle(width/2 - barW/2, height/2 + 24, 1, barH, 0x3355ff).setOrigin(0,0.5)
    const pct = this.add.text(width/2, height/2 + 108, '0%', { fontFamily:'monospace', fontSize:'60px', color:'#cccccc' }).setOrigin(0.5)
    this.load.on('progress', (v: number) => {
      const w = Math.max(1, Math.floor(barW * v))
      bar.width = w
      pct.setText(`${Math.round(v*100)}%`)
    })
    this.load.once('complete', () => {
      // brief delay so users can perceive completion
      this.time.delayedCall(100, () => { this.scene.start('Menu') })
    })
    // Load placeholder music from public/ so Netlify serves directly
    this.load.audio('bgm', 'audio/Nikkei.mp3')
    // Load cutscene videos
    this.load.video('cutscene_level_one', 'assets/cutscenes/cutscene_level_one.MP4')
    // Load player ship skin
    this.load.image('player-ship-1', 'assets/player/player_ship_1.png')
    this.load.image('player-ship-idle-1', 'assets/player/player_ship_idle_1.png')
    // Load boss sprites
    this.load.image('boss-1', 'assets/bosses/boss_1.png')
    // Load enemy sprites
    this.load.image('enemy-chaser', 'assets/level_one_enemies/enemy_one_chaser.png')
    this.load.image('enemy-fodder', 'assets/level_one_enemies/enemy_one_fodder.png')
    this.load.image('enemy-tank', 'assets/level_one_enemies/enemy_one_tank.png')
    // Generate placeholder textures for all icons and common sprites
    const makeRect = (key: string, w: number, h: number, color: number) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics(); g.fillStyle(color, 1); g.fillRect(0,0,w,h); g.generateTexture(key,w,h); g.destroy()
    }
    const makeCircle = (key: string, r: number, color: number) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics(); g.fillStyle(color, 1); g.fillCircle(r, r, r); g.generateTexture(key, r*2, r*2); g.destroy()
    }
    const makeIcon = (key: string, draw: (g: Phaser.GameObjects.Graphics)=>void, w=10, h=10) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics(); draw(g); g.generateTexture(key,w,h); g.destroy()
    }
    // HUD icons
    makeIcon('icon-heart', (g)=>{ g.fillStyle(0xff5566,1); g.fillCircle(108,144,108); g.fillCircle(252,144,108); g.fillTriangle(36,180,324,180,180,360)}, 360,360)
    makeIcon('icon-coin', (g)=>{ g.fillStyle(0xffcc33,1); g.fillCircle(180,180,144)}, 360,360)
    makeIcon('icon-xp', (g)=>{ g.fillStyle(0x66ccff,1); g.fillTriangle(180,0,360,180,0,180); g.fillTriangle(0,180,360,180,180,360)}, 360,360)
    makeIcon('icon-timer', (g)=>{ g.lineStyle(72,0xffffff,1); g.strokeCircle(180,180,144); g.lineBetween(180,180,180,72); g.lineBetween(180,180,288,180)}, 360,360)
    // Load weapon icons
    this.load.image('icon-weapon', 'assets/icons/blaster_icon.png')
    this.load.image('icon-weapon-laser', 'assets/icons/laser_icon_one.png')
    this.load.image('icon-weapon-missiles', 'assets/icons/missile_icon.png')
    this.load.image('icon-weapon-orb', 'assets/icons/orb_icon.png')
    // Load explosion sprites
    this.load.image('explosion-small', 'assets/effects/explosions/explosion_small.png')
    this.load.image('explosion-medium', 'assets/effects/explosions/explosion_medium.png')
    // Load projectile sprites
    this.load.image('blaster-projectile', 'assets/projectiles/blaster_one.png')
    this.load.image('missile-projectile', 'assets/projectiles/missile_one.png')
    this.load.image('orb-projectile', 'assets/projectiles/orb_one.png')
    this.load.image('enemy-projectile', 'assets/projectiles/enemy_projectile_one.png')
    makeRect('icon-acc',360,360,0x226644)
    // Game sprites
    makeRect('blaster-tex',108,108,0xffffff)
    makeRect('laser-shot-tex',72,72,0xff66ff)
    makeRect('missile-tex',108,180,0xffaa33)
    makeCircle('orb-tex',144,0x66ccff)
    makeRect('beam-tex',288,72,0xff66ff)
    makeIcon('explosion-tex', (g)=>{ g.fillStyle(0xffaa55,1); g.fillCircle(576,576,576)}, 1152,1152)
    makeRect('enemy-square',288,288,0xff4444)
    makeRect('player-square',288,288,0xffffff)
    makeIcon('xp-gem', (g)=>{ g.fillStyle(0x66ccff,1); g.fillTriangle(108,0,216,108,0,108); g.fillTriangle(0,108,216,108,108,216)}, 216,216)
    makeIcon('gold-coin', (g)=>{ g.fillStyle(0xffcc33,1); g.fillCircle(108,108,108)}, 216,216)
    // Distinct health: red background with white cross
    makeIcon('health-pack', (g)=>{
      g.clear()
      // red background
      g.fillStyle(0xff3344,1)
      g.fillRect(0,0,252,252)
      // white cross
      g.fillStyle(0xffffff,1)
      g.fillRect(108,36,36,180)
      g.fillRect(36,108,180,36)
    }, 252,252)
    // Distinct power-up: neon chip with legs and center glyph
    makeIcon('powerup-chip', (g)=>{
      g.clear()
      // body
      g.fillStyle(0x14443a,1); g.fillRect(36,36,216,216)
      // legs
      g.fillStyle(0x22ddaa,1)
      g.fillRect(0,72,36,36); g.fillRect(0,144,36,36); g.fillRect(252,72,36,36); g.fillRect(252,144,36,36)
      g.fillRect(72,0,36,36); g.fillRect(144,0,36,36); g.fillRect(72,252,36,36); g.fillRect(144,252,36,36)
      // center glyph
      g.fillRect(72,108,108,36); g.fillRect(108,72,36,108)
      // outline glow hint
      g.lineStyle(36,0x22ddaa,1); g.strokeRect(54,54,180,180)
    }, 288,288)
  }

  create() {
    // start moved to loader complete
  }
}

