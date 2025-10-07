import Phaser from 'phaser'
import { getOptions } from '../systems/options'

export default class HUDScene extends Phaser.Scene {
  private hpText?: Phaser.GameObjects.Text
  private goldText?: Phaser.GameObjects.Text
  private xpText?: Phaser.GameObjects.Text
  private lvlText?: Phaser.GameObjects.Text
  private timeText?: Phaser.GameObjects.Text
  private bossBar?: Phaser.GameObjects.Graphics
  private bossLabel?: Phaser.GameObjects.Text

  constructor() {
    super('HUD')
  }

  create() {
    // Controller detected toast
    this.input.gamepad?.once('connected', () => {
      this.registry.set('toast', 'Controller detected')
    })
    this.scene.bringToTop()

    // Minimal icon set
    const ensureIcon = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics()
      draw(g)
      g.generateTexture(key, 30, 30)
      g.destroy()
    }
    ensureIcon('icon-heart', (g) => { g.clear(); g.fillStyle(0xff5566, 1); g.fillCircle(9, 12, 9); g.fillCircle(21, 12, 9); g.fillTriangle(3, 15, 27, 15, 15, 30) })
    ensureIcon('icon-coin', (g) => { g.clear(); g.fillStyle(0xffcc33, 1); g.fillCircle(15, 15, 12) })
    ensureIcon('icon-xp', (g) => { g.clear(); g.fillStyle(0x66ccff, 1); g.fillTriangle(15, 0, 30, 15, 0, 15); g.fillTriangle(0, 15, 30, 15, 15, 30) })
    ensureIcon('icon-timer', (g) => { g.clear(); g.lineStyle(6, 0xffffff, 1); g.strokeCircle(15, 15, 12); g.lineBetween(15, 15, 15, 6); g.lineBetween(15, 15, 24, 15) })

    // UI elements (compact)
    this.add.image(15, 15, 'icon-heart').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.hpText = this.add.text(30, 6, '0/0', { fontFamily: 'monospace', fontSize: '24px', color: '#ffdddd' }).setScrollFactor(0).setDepth(1500)

    this.add.image(15, 45, 'icon-coin').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.goldText = this.add.text(30, 36, '0', { fontFamily: 'monospace', fontSize: '24px', color: '#ffdd66' }).setScrollFactor(0).setDepth(1500)

    this.add.image(15, 75, 'icon-xp').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.xpText = this.add.text(30, 66, '0', { fontFamily: 'monospace', fontSize: '24px', color: '#88ddff' }).setScrollFactor(0).setDepth(1500)
    this.lvlText = this.add.text(120, 6, 'Lv 1', { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff' }).setScrollFactor(0).setDepth(1500)

    this.add.image(this.scale.width - 120, 15, 'icon-timer').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.timeText = this.add.text(this.scale.width - 84, 6, '00:00', { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff' }).setScrollFactor(0).setDepth(1500)

    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(1500)
    this.bossLabel = this.add.text(this.scale.width / 2, 36, '', { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1500)

    // Simple icons for weapons/accessories with level pips (no text labels)
    const iconLayer = this.add.layer().setDepth(1499)
    const ensureBlockIcon = (key: string, color: number) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics(); g.fillStyle(color, 1); g.fillRect(0,0,30,30); g.generateTexture(key,30,30); g.destroy()
    }
    // Only ensure accessory icon as fallback
    ensureBlockIcon('icon-acc', 0x226644)
    const drawIcons = () => {
      iconLayer.removeAll(true)
      // Only ensure accessory icon as fallback
      ensureBlockIcon('icon-acc', 0x226644)
      const weaponsStr = (this.registry.get('inv-weapons') as string) || ''
      const accStr = (this.registry.get('inv-accessories') as string) || ''
      const items: string[] = []
      if (weaponsStr) items.push(...weaponsStr.split(', '))
      let x = 6, y = 120
      for (const item of items) {
        const match = /(.*) Lv(\d+)/.exec(item)
        const name = match ? match[1] : item
        const lvl = match ? parseInt(match[2], 10) : 1
        let key = 'icon-weapon'
        if (/Laser/i.test(name)) key = 'icon-weapon-laser'
        if (/Missiles/i.test(name)) key = 'icon-weapon-missiles'
        if (/Orb/i.test(name)) key = 'icon-weapon-orb'
        if (this.textures.exists(key)) {
          const img = this.add.image(x + 18, y + 18, key).setOrigin(0.5).setScrollFactor(0)
          img.setDisplaySize(48, 48)
          iconLayer.add(img)
        }
        // pips under icon
        for (let i = 0; i < Math.min(6, lvl); i++) {
          const pip = this.add.rectangle(x + 6 + i * 9, y + 36, 6, 6, 0x00ff88).setScrollFactor(0)
          iconLayer.add(pip)
        }
        x += 42
        if (x > this.scale.width - 42) { x = 6; y += 48 }
      }
      // accessories row(s)
      if (accStr && accStr.trim() !== '—' && accStr.trim() !== '') {
        x = 6; y += 48
        for (const item of accStr.split(', ')) {
          const match = /(.*) Lv(\d+)/.exec(item)
          const lvl = match ? parseInt(match[2], 10) : 1
          if (this.textures.exists('icon-acc')) {
            const img = this.add.image(x + 18, y + 18, 'icon-acc').setOrigin(0.5).setScrollFactor(0)
            img.setDisplaySize(48, 48)
            iconLayer.add(img)
          }
          for (let i = 0; i < Math.min(6, lvl); i++) {
            const pip = this.add.rectangle(x + 6 + i * 9, y + 36, 6, 6, 0x88ccff).setScrollFactor(0)
            iconLayer.add(pip)
          }
          x += 42
          if (x > this.scale.width - 42) { x = 6; y += 48 }
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
      const h = 15
      const x = (this.scale.width - w) / 2
      const y = 6
      this.bossBar?.fillStyle(0x000000, 0.4)
      this.bossBar?.fillRect(x, y, w, h)
      const fill = Math.max(0, Math.min(1, initBoss.cur / initBoss.max))
      this.bossBar?.fillStyle(0xff4444, 0.9)
      this.bossBar?.fillRect(x, y, w * fill, h)
      this.bossLabel?.setText('BOSS')
      this.bossLabel?.setVisible(true)
    }
    const onData = (_parent: unknown, key: string, value: unknown) => {
      if (key === 'toast') {
        const msg = (value as string) || ''
        if (!msg) return
        const t = this.add.text(this.scale.width / 2, this.scale.height - 90, msg, {
          fontFamily: 'monospace', fontSize: '30px', color: '#ffffff', backgroundColor: '#00000099', padding: { x: 12, y: 6 }
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
          const h = 15
          const x = (this.scale.width - w) / 2
          const y = 6
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
    }
    this.registry.events.on('changedata', onData)
    this.events.once('shutdown', () => this.registry.events.off('changedata', onData))
    this.events.once('destroy', () => this.registry.events.off('changedata', onData))
    refreshIcons()
    const fpsText = this.add.text(6, this.scale.height - 30, 'FPS', { fontFamily: 'monospace', fontSize: '24px', color: '#00ff88' }).setScrollFactor(0)
    fpsText.setVisible(!!getOptions().showFPS)
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const fps = Math.round(this.game.loop.actualFps)
        fpsText.setText(`FPS: ${fps}`)
        fpsText.setVisible(!!getOptions().showFPS)
      },
    })
    // React to options updates from PauseScene
    this.game.events.on('options-updated', () => {
      fpsText.setVisible(!!getOptions().showFPS)
    })
  }
}


