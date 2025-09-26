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

    const invText = this.add.text(2, 34, 'Weapons: —\nAcc: —', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#cccccc',
    })
    invText.setScrollFactor(0)

    this.registry.events.on('changedata', (_parent: unknown, key: string, value: unknown) => {
      if (key === 'xp') xpText.setText(`XP: ${value as number}`)
      if (key === 'level') lvlText.setText(`LVL ${(value as number) || 1}`)
      if (key === 'gold') goldText.setText(`Gold: ${value as number}`)
      if (key === 'hp') {
        const hp = value as { cur: number; max: number }
        hpText.setText(`HP ${hp.cur}/${hp.max}`)
      }
      if (key === 'inv-weapons' || key === 'inv-accessories') {
        const weapons = (this.registry.get('inv-weapons') as string) || '—'
        const acc = (this.registry.get('inv-accessories') as string) || '—'
        invText.setText(`Weapons: ${weapons}\nAcc: ${acc}`)
      }
    })

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


