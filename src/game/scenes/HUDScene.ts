import Phaser from 'phaser'

export default class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD')
  }

  create() {
    this.scene.bringToTop()
    const fpsText = this.add.text(2, 2, 'FPS', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#00ff88',
    })
    fpsText.setScrollFactor(0)

    const xpText = this.add.text(2, 12, 'XP: 0', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#66ccff',
    })
    xpText.setScrollFactor(0)

    const lvlText = this.add.text(80, 2, 'LVL 1', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffffff',
    })
    lvlText.setScrollFactor(0)

    const goldText = this.add.text(2, 22, 'Gold: 0', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffcc33',
    })
    goldText.setScrollFactor(0)

    const hpText = this.add.text(150, 2, 'HP 10/10', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ff8888',
    })
    hpText.setScrollFactor(0)

    const timeText = this.add.text(220, 2, '15:00', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffffff',
    })
    timeText.setScrollFactor(0)

    const bossText = this.add.text(this.scale.width / 2, 2, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ff6666',
      backgroundColor: '#220000',
      padding: { x: 3, y: 1 },
    })
    bossText.setOrigin(0.5, 0)
    bossText.setScrollFactor(0)

    const invText = this.add.text(2, 34, 'Weapons: —\nAcc: —', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#cccccc',
    })
    invText.setScrollFactor(0)

    // Simple icons (drawn squares) for weapons/accessories with level pips
    const iconLayer = this.add.layer().setDepth(1500)
    // Generate placeholder icon textures
    const ensureIcon = (key: string, color: number) => {
      if (this.textures.exists(key)) return
      const g = this.add.graphics(); g.fillStyle(color, 1); g.fillRect(0,0,12,12); g.generateTexture(key,12,12); g.destroy()
    }
    ensureIcon('icon-weapon', 0x4444aa)
    ensureIcon('icon-weapon-laser', 0xaa44aa)
    ensureIcon('icon-weapon-missiles', 0xffaa33)
    ensureIcon('icon-weapon-orb', 0x66ccff)
    ensureIcon('icon-acc', 0x226644)
    const drawIcons = () => {
      iconLayer.removeAll(true)
      const weaponsStr = (this.registry.get('inv-weapons') as string) || ''
      const accStr = (this.registry.get('inv-accessories') as string) || ''
      const items: string[] = []
      if (weaponsStr) items.push(...weaponsStr.split(', '))
      let x = 2, y = 54
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
        const txt = this.add.text(x + 12 + 4, y, name, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' }).setScrollFactor(0)
        iconLayer.add(txt)
        // level pips
        for (let i = 0; i < lvl; i++) {
          const pip = this.add.rectangle(x + 3 + i * 3, y + 14, 2, 2, 0x00ff88).setScrollFactor(0)
          iconLayer.add(pip)
        }
        y += 16
      }
      // accessory header
      if (accStr) {
        const hdr = this.add.text(x, y, 'Accessories', { fontFamily: 'monospace', fontSize: '8px', color: '#cccccc' }).setScrollFactor(0)
        iconLayer.add(hdr)
        y += 10
        for (const item of accStr.split(', ')) {
          const match = /(.*) Lv(\d+)/.exec(item)
          const name = match ? match[1] : item
          const lvl = match ? parseInt(match[2], 10) : 1
          const img = this.add.image(x + 6, y + 6, 'icon-acc').setOrigin(0.5).setScrollFactor(0)
          iconLayer.add(img)
          const txt = this.add.text(x + 12 + 4, y, name, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' }).setScrollFactor(0)
          iconLayer.add(txt)
          for (let i = 0; i < lvl; i++) {
            const pip = this.add.rectangle(x + 3 + i * 3, y + 14, 2, 2, 0x88ccff).setScrollFactor(0)
            iconLayer.add(pip)
          }
          y += 16
        }
      }
      const sets = (this.registry.get('sets-summary') as string) || ''
      if (sets) {
        const s = this.add.text(x, y + 4, `Sets: ${sets}`, { fontFamily: 'monospace', fontSize: '8px', color: '#ffaa00' }).setScrollFactor(0)
        iconLayer.add(s)
      }
    }

    const refreshIcons = () => drawIcons()
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
      if (key === 'xp') xpText.setText(`XP: ${value as number}`)
      if (key === 'level') lvlText.setText(`LVL ${(value as number) || 1}`)
      if (key === 'gold') goldText.setText(`Gold: ${value as number}`)
      if (key === 'hp') {
        const hp = value as { cur: number; max: number }
        hpText.setText(`HP ${hp.cur}/${hp.max}`)
      }
      if (key === 'time-left') {
        const t = (value as number) || 0
        const m = Math.floor(t / 60)
        const s = t % 60
        timeText.setText(`${m}:${s.toString().padStart(2, '0')}`)
      }
      if (key === 'boss-hp') {
        const hp = value as { cur: number; max: number } | null
        if (hp && hp.max > 0) {
          bossText.setText(`BOSS ${hp.cur}/${hp.max}`)
          bossText.setVisible(true)
        } else {
          bossText.setVisible(false)
        }
      }
      if (key === 'inv-weapons' || key === 'inv-accessories') {
        const weapons = (this.registry.get('inv-weapons') as string) || '—'
        const acc = (this.registry.get('inv-accessories') as string) || '—'
        invText.setText(`Weapons: ${weapons}\nAcc: ${acc}`)
        refreshIcons()
      }
    })
    refreshIcons()

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const fps = Math.round(this.game.loop.actualFps)
        const arcade = (this.scene.get('Game') as any)?.physics?.world
        const bodies = arcade ? arcade.bodies?.entries?.size || arcade.bodies?.entries?.length || 0 : 0
        fpsText.setText(`FPS: ${fps} | bodies:${bodies}`)
      },
    })
  }
}


