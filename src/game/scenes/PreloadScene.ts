import Phaser from 'phaser'

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload() {
    // Simple loading UI
    const { width, height } = this.scale
    this.add.text(width/2, height/2 - 16, 'Loading…', { fontFamily:'monospace', fontSize:'12px', color:'#ffffff' }).setOrigin(0.5)
    const barW = 160, barH = 8
    this.add.rectangle(width/2, height/2 + 4, barW, barH, 0x111144).setOrigin(0.5)
    const bar = this.add.rectangle(width/2 - barW/2, height/2 + 4, 1, barH, 0x3355ff).setOrigin(0,0.5)
    const pct = this.add.text(width/2, height/2 + 18, '0%', { fontFamily:'monospace', fontSize:'10px', color:'#cccccc' }).setOrigin(0.5)
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
    makeIcon('icon-heart', (g)=>{ g.fillStyle(0xff5566,1); g.fillCircle(3,4,3); g.fillCircle(7,4,3); g.fillTriangle(1,5,9,5,5,10)}, 10,10)
    makeIcon('icon-coin', (g)=>{ g.fillStyle(0xffcc33,1); g.fillCircle(5,5,4)}, 10,10)
    makeIcon('icon-xp', (g)=>{ g.fillStyle(0x66ccff,1); g.fillTriangle(5,0,10,5,0,5); g.fillTriangle(0,5,10,5,5,10)}, 10,10)
    makeIcon('icon-timer', (g)=>{ g.lineStyle(2,0xffffff,1); g.strokeCircle(5,5,4); g.lineBetween(5,5,5,2); g.lineBetween(5,5,8,5)}, 10,10)
    makeRect('icon-weapon',10,10,0x4444aa)
    makeRect('icon-weapon-laser',10,10,0xaa44aa)
    makeRect('icon-weapon-missiles',10,10,0xffaa33)
    makeRect('icon-weapon-orb',10,10,0x66ccff)
    makeRect('icon-acc',10,10,0x226644)
    // Game sprites
    makeRect('blaster-tex',3,3,0xffffff)
    makeRect('laser-shot-tex',2,2,0xff66ff)
    makeRect('missile-tex',3,5,0xffaa33)
    makeCircle('orb-tex',4,0x66ccff)
    makeRect('beam-tex',8,2,0xff66ff)
    makeIcon('explosion-tex', (g)=>{ g.fillStyle(0xffaa55,1); g.fillCircle(16,16,16)}, 32,32)
    makeRect('enemy-square',8,8,0xff4444)
    makeRect('player-square',8,8,0xffffff)
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
      // legs
      g.fillStyle(0x22ddaa,1)
      g.fillRect(0,2,1,1); g.fillRect(0,4,1,1); g.fillRect(7,2,1,1); g.fillRect(7,4,1,1)
      g.fillRect(2,0,1,1); g.fillRect(4,0,1,1); g.fillRect(2,7,1,1); g.fillRect(4,7,1,1)
      // center glyph
      g.fillRect(2,3,3,1); g.fillRect(3,2,1,3)
      // outline glow hint
      g.lineStyle(1,0x22ddaa,1); g.strokeRect(1.5,1.5,5,5)
    }, 8,8)
  }

  create() {
    // start moved to loader complete
  }
}


