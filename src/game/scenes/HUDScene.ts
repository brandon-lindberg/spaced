import Phaser from 'phaser'

export default class HUDScene extends Phaser.Scene {
  private heartIcon?: Phaser.GameObjects.Image
  private hpText?: Phaser.GameObjects.Text
  private coinIcon?: Phaser.GameObjects.Image
  private goldText?: Phaser.GameObjects.Text
  private xpIcon?: Phaser.GameObjects.Image
  private xpText?: Phaser.GameObjects.Text
  private lvlText?: Phaser.GameObjects.Text
  private timerIcon?: Phaser.GameObjects.Image
  private timeText?: Phaser.GameObjects.Text
  private bossBar?: Phaser.GameObjects.Graphics
  private bossLabel?: Phaser.GameObjects.Text

  constructor() {
    super('HUD')
  }

  create() {
    this.scene.bringToTop()

    // Minimal icon set
    const ensureIcon = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics()
      draw(g)
      g.generateTexture(key, 10, 10)
      g.destroy()
    }
    ensureIcon('icon-heart', (g) => { g.clear(); g.fillStyle(0xff5566, 1); g.fillCircle(3, 4, 3); g.fillCircle(7, 4, 3); g.fillTriangle(1, 5, 9, 5, 5, 10) })
    ensureIcon('icon-coin', (g) => { g.clear(); g.fillStyle(0xffcc33, 1); g.fillCircle(5, 5, 4) })
    ensureIcon('icon-xp', (g) => { g.clear(); g.fillStyle(0x66ccff, 1); g.fillTriangle(5, 0, 10, 5, 0, 5); g.fillTriangle(0, 5, 10, 5, 5, 10) })
    ensureIcon('icon-timer', (g) => { g.clear(); g.lineStyle(2, 0xffffff, 1); g.strokeCircle(5, 5, 4); g.lineBetween(5, 5, 5, 2); g.lineBetween(5, 5, 8, 5) })

    // UI elements (compact)
    this.heartIcon = this.add.image(6, 6, 'icon-heart').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.hpText = this.add.text(12, 2, '0/0', { fontFamily: 'monospace', fontSize: '8px', color: '#ffdddd' }).setScrollFactor(0).setDepth(1500)

    this.coinIcon = this.add.image(6, 16, 'icon-coin').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.goldText = this.add.text(12, 12, '0', { fontFamily: 'monospace', fontSize: '8px', color: '#ffdd66' }).setScrollFactor(0).setDepth(1500)

    this.xpIcon = this.add.image(6, 26, 'icon-xp').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.xpText = this.add.text(12, 22, '0', { fontFamily: 'monospace', fontSize: '8px', color: '#88ddff' }).setScrollFactor(0).setDepth(1500)
    this.lvlText = this.add.text(40, 2, 'Lv 1', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' }).setScrollFactor(0).setDepth(1500)

    this.timerIcon = this.add.image(this.scale.width - 40, 6, 'icon-timer').setOrigin(0, 0).setScrollFactor(0).setDepth(1500)
    this.timeText = this.add.text(this.scale.width - 28, 2, '00:00', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' }).setScrollFactor(0).setDepth(1500)

    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(1500)
    this.bossLabel = this.add.text(this.scale.width / 2, 12, '', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1500)

    // Simple icons for weapons/accessories with level pips (no text labels)
    const iconLayer = this.add.layer().setDepth(1499)
    const ensureBlockIcon = (key: string, color: number) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics(); g.fillStyle(color, 1); g.fillRect(0,0,10,10); g.generateTexture(key,10,10); g.destroy()
    }
    ensureBlockIcon('icon-weapon', 0x4444aa)
    ensureBlockIcon('icon-weapon-laser', 0xaa44aa)
    ensureBlockIcon('icon-weapon-missiles', 0xffaa33)
    ensureBlockIcon('icon-weapon-orb', 0x66ccff)
    ensureBlockIcon('icon-acc', 0x226644)
    const drawIcons = () => {
      iconLayer.removeAll(true)
      const weaponsStr = (this.registry.get('inv-weapons') as string) || ''
      const accStr = (this.registry.get('inv-accessories') as string) || ''
      const items: string[] = []
      if (weaponsStr) items.push(...weaponsStr.split(', '))
      let x = 2, y = 40
      for (const item of items) {
        const match = /(.*) Lv(\d+)/.exec(item)
        const name = match ? match[1] : item
        const lvl = match ? parseInt(match[2], 10) : 1
        let key = 'icon-weapon'
        if (/Laser/i.test(name)) key = 'icon-weapon-laser'
        if (/Missiles/i.test(name)) key = 'icon-weapon-missiles'
        if (/Orb/i.test(name)) key = 'icon-weapon-orb'
        const img = this.add.image(x + 6, y + 6, key).setOrigin(0.5).setScrollFactor(0)
        iconLayer.add(img)
        // pips under icon
        for (let i = 0; i < Math.min(6, lvl); i++) {
          const pip = this.add.rectangle(x + 2 + i * 3, y + 12, 2, 2, 0x00ff88).setScrollFactor(0)
          iconLayer.add(pip)
        }
        x += 14
        if (x > this.scale.width - 14) { x = 2; y += 16 }
      }
      // accessories row(s)
      if (accStr) {
        x = 2; y += 2
        for (const item of accStr.split(', ')) {
          const match = /(.*) Lv(\d+)/.exec(item)
          const lvl = match ? parseInt(match[2], 10) : 1
          const img = this.add.image(x + 6, y + 6, 'icon-acc').setOrigin(0.5).setScrollFactor(0)
          iconLayer.add(img)
          for (let i = 0; i < Math.min(6, lvl); i++) {
            const pip = this.add.rectangle(x + 2 + i * 3, y + 12, 2, 2, 0x88ccff).setScrollFactor(0)
            iconLayer.add(pip)
          }
          x += 14
          if (x > this.scale.width - 14) { x = 2; y += 16 }
        }
      }
    }

    const refreshIcons = () => drawIcons()
    // Initial sync from existing registry values so HUD doesn't start at 0/0
    const initHp = this.registry.get('hp') as { cur: number; max: number } | undefined
    if (initHp) this.hpText?.setText(`${initHp.cur}/${initHp.max}`)
    const initGold = this.registry.get('gold') as number | undefined
    if (typeof initGold === 'number') this.goldText?.setText(`${initGold}`)
    const initXp = this.registry.get('xp') as number | undefined
    if (typeof initXp === 'number') this.xpText?.setText(`${initXp}`)
    const initLvl = this.registry.get('level') as number | undefined
    if (typeof initLvl === 'number') this.lvlText?.setText(`Lv ${initLvl}`)
    const initTime = this.registry.get('time-left') as number | undefined
    if (typeof initTime === 'number') {
      const m = Math.floor(initTime / 60)
      const s = initTime % 60
      this.timeText?.setText(`${m}:${s.toString().padStart(2, '0')}`)
    }
    const initBoss = this.registry.get('boss-hp') as { cur: number; max: number } | null
    if (initBoss && initBoss.max > 0) {
      this.bossBar?.clear()
      const w = this.scale.width * 0.5
      const h = 5
      const x = (this.scale.width - w) / 2
      const y = 2
      this.bossBar?.fillStyle(0x000000, 0.4)
      this.bossBar?.fillRect(x, y, w, h)
      const fill = Math.max(0, Math.min(1, initBoss.cur / initBoss.max))
      this.bossBar?.fillStyle(0xff4444, 0.9)
      this.bossBar?.fillRect(x, y, w * fill, h)
      this.bossLabel?.setText('BOSS')
      this.bossLabel?.setVisible(true)
    }
    this.registry.events.on('changedata', (_parent: unknown, key: string, value: unknown) => {
      if (key === 'toast') {
        const msg = (value as string) || ''
        if (!msg) return
        const t = this.add.text(this.scale.width / 2, this.scale.height - 30, msg, {
          fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000099', padding: { x: 4, y: 2 }
        }).setScrollFactor(0).setOrigin(0.5).setDepth(2000)
        this.tweens.add({ targets: t, alpha: 0, duration: 900, ease: 'Sine.easeIn', onComplete: () => t.destroy() })
        this.registry.set('toast', '')
      }
      if (key === 'xp') this.xpText?.setText(`${value as number}`)
      if (key === 'level') this.lvlText?.setText(`Lv ${(value as number) || 1}`)
      if (key === 'gold') this.goldText?.setText(`${value as number}`)
      if (key === 'hp') {
        const hp = value as { cur: number; max: number }
        this.hpText?.setText(`${hp.cur}/${hp.max}`)
      }
      if (key === 'time-left') {
        const t = (value as number) || 0
        const m = Math.floor(t / 60)
        const s = t % 60
        this.timeText?.setText(`${m}:${s.toString().padStart(2, '0')}`)
      }
      if (key === 'boss-hp') {
        const hp = value as { cur: number; max: number } | null
        this.bossBar?.clear()
        if (hp && hp.max > 0) {
          const w = this.scale.width * 0.5
          const h = 5
          const x = (this.scale.width - w) / 2
          const y = 2
          this.bossBar?.fillStyle(0x000000, 0.4)
          this.bossBar?.fillRect(x, y, w, h)
          const fill = Math.max(0, Math.min(1, hp.cur / hp.max))
          this.bossBar?.fillStyle(0xff4444, 0.9)
          this.bossBar?.fillRect(x, y, w * fill, h)
          this.bossLabel?.setText('BOSS')
          this.bossLabel?.setVisible(true)
        } else {
          this.bossLabel?.setVisible(false)
        }
      }
      if (key === 'inv-weapons' || key === 'inv-accessories') {
        refreshIcons()
      }
    })
    refreshIcons()
    if ((import.meta as any)?.env?.DEV) {
      const fpsText = this.add.text(2, this.scale.height - 10, 'FPS', { fontFamily: 'monospace', fontSize: '8px', color: '#00ff88' }).setScrollFactor(0)
      this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          const fps = Math.round(this.game.loop.actualFps)
          fpsText.setText(`FPS: ${fps}`)
        },
      })
    }
  }
}


