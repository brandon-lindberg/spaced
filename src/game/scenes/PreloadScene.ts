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
    // Load player ship skins
    this.load.image('player-ship-1', 'assets/player/player_ship_1.png')
    this.load.image('player-ship-idle-1', 'assets/player/player_ship_idle_1.png')
    this.load.image('player-ship-2', 'assets/player/player_ship_2.png')
    this.load.image('player-ship-idle-2', 'assets/player/player_ship_idle_2.png')
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
    // HUD icons (all sized at 30x30 to match HUD requirements)
    makeIcon('icon-heart', (g)=>{ g.fillStyle(0xff5566,1); g.fillCircle(9,12,9); g.fillCircle(21,12,9); g.fillTriangle(3,15,27,15,15,30)}, 30,30)
    makeIcon('icon-coin', (g)=>{ g.fillStyle(0xffcc33,1); g.fillCircle(15,15,12)}, 30,30)
    makeIcon('icon-xp', (g)=>{ g.fillStyle(0x66ccff,1); g.fillTriangle(15,0,30,15,0,15); g.fillTriangle(0,15,30,15,15,30)}, 30,30)
    makeIcon('icon-timer', (g)=>{ g.lineStyle(6,0xffffff,1); g.strokeCircle(15,15,12); g.lineBetween(15,15,15,6); g.lineBetween(15,15,24,15)}, 30,30)
    // Load weapon icons
    this.load.image('icon-weapon', 'assets/icons/blaster_icon.png')
    this.load.image('icon-weapon-laser', 'assets/icons/laser_icon_one.png')
    this.load.image('icon-weapon-missiles', 'assets/icons/missile_icon.png')
    this.load.image('icon-weapon-orb', 'assets/icons/orb_icon.png')
    // Load accessory icons
    this.load.image('icon-acc-power-cell', 'assets/accessories/power_cell.png')
    this.load.image('icon-acc-thruster', 'assets/accessories/thruster.png')
    this.load.image('icon-acc-tractor-beam', 'assets/accessories/tractor_beam.png')
    this.load.image('icon-acc-splitter', 'assets/accessories/splitter.png')
    this.load.image('icon-acc-ammo-loader', 'assets/accessories/ammo_loader.png')
    // Load hull plating icon (for HP max boost in level-up)
    this.load.image('icon-hull-plating', 'assets/accessories/shield_plating.png')
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
    // Pickup textures - these are just fallbacks, real ones generated in TextureFactory at smaller sizes
    makeIcon('xp-gem', (g)=>{ g.fillStyle(0x66ccff,1); g.fillTriangle(3,0,6,3,0,3); g.fillTriangle(0,3,6,3,3,6)}, 6,6)
    makeIcon('gold-coin', (g)=>{ g.fillStyle(0xffcc33,1); g.fillCircle(3,3,3)}, 6,6)
    // Distinct health: red background with white cross
    makeIcon('health-pack', (g)=>{
      g.clear()
      // red background
      g.fillStyle(0xff3344,1)
      g.fillRect(0,0,7,7)
      // white cross
      g.fillStyle(0xffffff,1)
      g.fillRect(3,1,1,5)
      g.fillRect(1,3,5,1)
    }, 7,7)
    // Distinct power-up: neon chip with legs and center glyph
    makeIcon('powerup-chip', (g)=>{
      g.clear()
      // body
      g.fillStyle(0x14443a,1); g.fillRect(1,1,6,6)
      // legs (simplified at small size)
      g.fillStyle(0x22ddaa,1)
      g.fillRect(0,2,1,1); g.fillRect(0,4,1,1); g.fillRect(7,2,1,1); g.fillRect(7,4,1,1)
      g.fillRect(2,0,1,1); g.fillRect(4,0,1,1); g.fillRect(2,7,1,1); g.fillRect(4,7,1,1)
      // center glyph
      g.fillRect(2,3,3,1); g.fillRect(3,2,1,3)
    }, 8,8)
  }

  create() {
    // start moved to loader complete
  }
}

