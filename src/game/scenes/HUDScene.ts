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

    const { width, height } = this.scale

    // Responsive sizing
    const iconSize = Math.max(20, Math.min(30, width * 0.016))
    const fontSize = Math.max(14, Math.min(24, width * 0.0125))
    const spacing = Math.max(20, Math.min(30, height * 0.028))
    const padding = Math.max(10, Math.min(15, width * 0.008))

    // Minimal icon set
    const ensureIcon = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics()
      draw(g)
      g.generateTexture(key, iconSize, iconSize)
      g.destroy()
    }
    ensureIcon('icon-heart', (g) => { g.clear(); g.fillStyle(0xff5566, 1); g.fillCircle(9, 12, 9); g.fillCircle(21, 12, 9); g.fillTriangle(3, 15, 27, 15, 15, 30) })
    ensureIcon('icon-coin', (g) => { g.clear(); g.fillStyle(0xffcc33, 1); g.fillCircle(15, 15, 12) })
    ensureIcon('icon-xp', (g) => { g.clear(); g.fillStyle(0x66ccff, 1); g.fillTriangle(15, 0, 30, 15, 0, 15); g.fillTriangle(0, 15, 30, 15, 15, 30) })
    ensureIcon('icon-timer', (g) => { g.clear(); g.lineStyle(6, 0xffffff, 1); g.strokeCircle(15, 15, 12); g.lineBetween(15, 15, 15, 6); g.lineBetween(15, 15, 24, 15) })

    // UI elements (responsive)
    const iconX = padding
    const textX = padding + iconSize + 5

    this.add.image(iconX, padding, 'icon-heart').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.hpText = this.add.text(textX, padding - fontSize/2, '0/0', { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#ffdddd' }).setScrollFactor(0).setDepth(1500)

    this.add.image(iconX, padding + spacing, 'icon-coin').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.goldText = this.add.text(textX, padding + spacing - fontSize/2, '0', { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#ffdd66' }).setScrollFactor(0).setDepth(1500)

    this.add.image(iconX, padding + spacing * 2, 'icon-xp').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.xpText = this.add.text(textX, padding + spacing * 2 - fontSize/2, '0', { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#88ddff' }).setScrollFactor(0).setDepth(1500)

    const lvlX = Math.max(100, Math.min(120, width * 0.0625))
    this.lvlText = this.add.text(lvlX, padding - fontSize/2, 'Lv 1', { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#ffffff' }).setScrollFactor(0).setDepth(1500)

    const timerIconX = width - Math.max(100, Math.min(120, width * 0.0625))
    const timerTextX = width - Math.max(70, Math.min(84, width * 0.044))
    this.add.image(timerIconX, padding, 'icon-timer').setOrigin(0.5).setScrollFactor(0).setDepth(1500)
    this.timeText = this.add.text(timerTextX, padding - fontSize/2, '00:00', { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#ffffff' }).setScrollFactor(0).setDepth(1500)

    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(1500)
    this.bossLabel = this.add.text(width / 2, Math.max(30, spacing + padding), '', { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#ffffff' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1500)

    // Simple icons for weapons/accessories with level pips (responsive)
    const iconLayer = this.add.layer().setDepth(1499)
    const itemIconSize = Math.max(30, Math.min(48, width * 0.025))
    const pipSize = Math.max(4, Math.min(6, width * 0.003))
    const pipSpacing = Math.max(6, Math.min(9, width * 0.005))
    const itemSpacing = Math.max(30, Math.min(42, width * 0.022))
    const itemStartY = Math.max(90, Math.min(120, height * 0.11))

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
      let x = padding, y = itemStartY
      for (const item of items) {
        const match = /(.*) Lv(\d+)/.exec(item)
        const name = match ? match[1] : item
        const lvl = match ? parseInt(match[2], 10) : 1
        let key = 'icon-weapon'
        if (/Laser/i.test(name)) key = 'icon-weapon-laser'
        if (/Missiles/i.test(name)) key = 'icon-weapon-missiles'
        if (/Orb/i.test(name)) key = 'icon-weapon-orb'
        if (this.textures.exists(key)) {
          const img = this.add.image(x + itemIconSize/2, y + itemIconSize/2, key).setOrigin(0.5).setScrollFactor(0)
          img.setDisplaySize(itemIconSize, itemIconSize)
          iconLayer.add(img)
        }
        // pips under icon
        for (let i = 0; i < Math.min(6, lvl); i++) {
          const pip = this.add.rectangle(x + pipSize + i * pipSpacing, y + itemIconSize, pipSize, pipSize, 0x00ff88).setScrollFactor(0)
          iconLayer.add(pip)
        }
        x += itemSpacing
        if (x > width - itemSpacing) { x = padding; y += itemSpacing + pipSize + 5 }
      }
      // accessories row(s)
      if (accStr && accStr.trim() !== '—' && accStr.trim() !== '') {
        x = padding; y += itemSpacing + pipSize + 5
        for (const item of accStr.split(', ')) {
          const match = /(.*) Lv(\d+)/.exec(item)
          const lvl = match ? parseInt(match[2], 10) : 1
          if (this.textures.exists('icon-acc')) {
            const img = this.add.image(x + itemIconSize/2, y + itemIconSize/2, 'icon-acc').setOrigin(0.5).setScrollFactor(0)
            img.setDisplaySize(itemIconSize, itemIconSize)
            iconLayer.add(img)
          }
          for (let i = 0; i < Math.min(6, lvl); i++) {
            const pip = this.add.rectangle(x + pipSize + i * pipSpacing, y + itemIconSize, pipSize, pipSize, 0x88ccff).setScrollFactor(0)
            iconLayer.add(pip)
          }
          x += itemSpacing
          if (x > width - itemSpacing) { x = padding; y += itemSpacing + pipSize + 5 }
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
        const toastFontSize = Math.max(16, Math.min(30, width * 0.016))
        const toastPadding = { x: Math.max(8, Math.min(12, width * 0.006)), y: Math.max(4, Math.min(6, height * 0.006)) }
        const toastY = height - Math.max(60, Math.min(90, height * 0.083))
        const t = this.add.text(width / 2, toastY, msg, {
          fontFamily: 'monospace', fontSize: `${toastFontSize}px`, color: '#ffffff', backgroundColor: '#00000099', padding: toastPadding
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
    const fpsFontSize = Math.max(12, Math.min(24, width * 0.0125))
    const fpsY = height - Math.max(20, Math.min(30, height * 0.028))
    const fpsText = this.add.text(padding, fpsY, 'FPS', { fontFamily: 'monospace', fontSize: `${fpsFontSize}px`, color: '#00ff88' }).setScrollFactor(0)
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


