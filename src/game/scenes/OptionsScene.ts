import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'
import { MenuNavigator, type NavigableItem } from '../ui/MenuNavigator'

export default class OptionsScene extends Phaser.Scene {
  private toggles: {
    widget: Phaser.GameObjects.Text
    action: () => void
  }[] = []
  private navigator?: MenuNavigator

  constructor() {
    super('Options')
  }

  create() {
    const { width, height } = this.scale

    // Background overlay
    this.add.rectangle(0, 0, width, height, 0x0a0d1f, 1).setOrigin(0, 0).setDepth(1000)

    // Panel background
    const panelWidth = Math.min(2400, width - 240)
    const panelHeight = Math.min(2400, height - 480)
    const panelX = width / 2
    const panelY = height / 2

    const panel = this.add.graphics().setDepth(1001)
    panel.fillStyle(0x0b0e20, 0.95)
    panel.fillRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      48
    )
    panel.lineStyle(12, 0x3355ff, 1)
    panel.strokeRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      48
    )

    // Title
    this.add.text(panelX, panelY - panelHeight / 2 + 144, '⚙ OPTIONS', {
      fontFamily: 'monospace',
      fontSize: '108px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1010)

    // Options start position
    const startY = panelY - panelHeight / 2 + 420
    let currentY = startY

    // Volume section
    this.add.text(panelX, currentY, '🔊 Audio', {
      fontFamily: 'monospace',
      fontSize: '78px',
      color: '#ffffcc',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1010)
    currentY += 168

    const volumeInfo = () => `Music ${Math.round(getOptions().musicVolume * 100)}% | SFX ${Math.round(getOptions().sfxVolume * 100)}%`
    const volText = this.add.text(panelX, currentY, volumeInfo(), {
      fontFamily: 'monospace',
      fontSize: '66px',
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5).setDepth(1010)
    currentY += 144

    // Music controls
    const musicDown = this.add.text(panelX - 480, currentY, '◄ Music', {
      fontFamily: 'monospace',
      fontSize: '66px',
      color: '#ffffff',
      backgroundColor: '#222244',
      padding: { x: 60, y: 30 },
    }).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    const musicUp = this.add.text(panelX + 480, currentY, 'Music ►', {
      fontFamily: 'monospace',
      fontSize: '66px',
      color: '#ffffff',
      backgroundColor: '#222244',
      padding: { x: 60, y: 30 },
    }).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    currentY += 168

    // SFX controls
    const sfxDown = this.add.text(panelX - 480, currentY, '◄ SFX', {
      fontFamily: 'monospace',
      fontSize: '66px',
      color: '#ffffff',
      backgroundColor: '#222244',
      padding: { x: 60, y: 30 },
    }).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    const sfxUp = this.add.text(panelX + 480, currentY, 'SFX ►', {
      fontFamily: 'monospace',
      fontSize: '66px',
      color: '#ffffff',
      backgroundColor: '#222244',
      padding: { x: 60, y: 30 },
    }).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    currentY += 240

    const applyVolume = (musicDelta: number, sfxDelta: number) => {
      const o = getOptions()
      const newMusic = Math.max(0, Math.min(1, o.musicVolume + musicDelta))
      const newSfx = Math.max(0, Math.min(1, o.sfxVolume + sfxDelta))
      setOptions({ musicVolume: newMusic, sfxVolume: newSfx })
      volText.setText(volumeInfo())
      this.game.events.emit('options-updated')
    }

    musicDown.on('pointerdown', () => applyVolume(-0.1, 0))
    musicUp.on('pointerdown', () => applyVolume(0.1, 0))
    sfxDown.on('pointerdown', () => applyVolume(0, -0.1))
    sfxUp.on('pointerdown', () => applyVolume(0, 0.1))

    musicDown.on('pointerover', () => musicDown.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' }))
    musicDown.on('pointerout', () => musicDown.setStyle({ backgroundColor: '#222244', color: '#ffffff' }))
    musicUp.on('pointerover', () => musicUp.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' }))
    musicUp.on('pointerout', () => musicUp.setStyle({ backgroundColor: '#222244', color: '#ffffff' }))
    sfxDown.on('pointerover', () => sfxDown.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' }))
    sfxDown.on('pointerout', () => sfxDown.setStyle({ backgroundColor: '#222244', color: '#ffffff' }))
    sfxUp.on('pointerover', () => sfxUp.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' }))
    sfxUp.on('pointerout', () => sfxUp.setStyle({ backgroundColor: '#222244', color: '#ffffff' }))

    this.toggles.push(
      { widget: musicDown, action: () => applyVolume(-0.1, 0) },
      { widget: musicUp, action: () => applyVolume(0.1, 0) },
      { widget: sfxDown, action: () => applyVolume(0, -0.1) },
      { widget: sfxUp, action: () => applyVolume(0, 0.1) }
    )

    // Gamepad section
    this.add.text(panelX, currentY, '🎮 Gamepad', {
      fontFamily: 'monospace',
      fontSize: '78px',
      color: '#ffffcc',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1010)
    currentY += 168

    // Invert controls
    const invertXBtn = this.add.text(
      panelX - 420,
      currentY,
      `Invert X: ${getOptions().gamepad?.invertX ? 'ON' : 'OFF'}`,
      {
        fontFamily: 'monospace',
        fontSize: '66px',
        color: '#ffffff',
        backgroundColor: '#222244',
        padding: { x: 60, y: 30 },
      }
    ).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    const invertYBtn = this.add.text(
      panelX + 420,
      currentY,
      `Invert Y: ${getOptions().gamepad?.invertY ? 'ON' : 'OFF'}`,
      {
        fontFamily: 'monospace',
        fontSize: '66px',
        color: '#ffffff',
        backgroundColor: '#222244',
        padding: { x: 60, y: 30 },
      }
    ).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    currentY += 192

    const toggleInvertX = () => {
      const cur = getOptions().gamepad || { confirm: 0, cancel: 1, pauseStart: 9, pauseSelect: 8, invertX: false, invertY: false }
      const gp = { ...cur, invertX: !cur.invertX }
      setOptions({ gamepad: gp })
      this.game.events.emit('options-updated')
      invertXBtn.setText(`Invert X: ${gp.invertX ? 'ON' : 'OFF'}`)
    }

    const toggleInvertY = () => {
      const cur = getOptions().gamepad || { confirm: 0, cancel: 1, pauseStart: 9, pauseSelect: 8, invertX: false, invertY: false }
      const gp = { ...cur, invertY: !cur.invertY }
      setOptions({ gamepad: gp })
      this.game.events.emit('options-updated')
      invertYBtn.setText(`Invert Y: ${gp.invertY ? 'ON' : 'OFF'}`)
    }

    invertXBtn.on('pointerdown', toggleInvertX)
    invertYBtn.on('pointerdown', toggleInvertY)

    invertXBtn.on('pointerover', () => invertXBtn.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' }))
    invertXBtn.on('pointerout', () => invertXBtn.setStyle({ backgroundColor: '#222244', color: '#ffffff' }))
    invertYBtn.on('pointerover', () => invertYBtn.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' }))
    invertYBtn.on('pointerout', () => invertYBtn.setStyle({ backgroundColor: '#222244', color: '#ffffff' }))

    this.toggles.push(
      { widget: invertXBtn, action: toggleInvertX },
      { widget: invertYBtn, action: toggleInvertY }
    )

    // Gamepad mapping button
    const mapBtn = this.add.text(panelX, currentY, 'Configure Controls', {
      fontFamily: 'monospace',
      fontSize: '66px',
      color: '#ffffff',
      backgroundColor: '#222244',
      padding: { x: 72, y: 30 },
    }).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    mapBtn.on('pointerdown', () => this.scene.start('OptionsGamepad'))
    mapBtn.on('pointerover', () => mapBtn.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' }))
    mapBtn.on('pointerout', () => mapBtn.setStyle({ backgroundColor: '#222244', color: '#ffffff' }))

    this.toggles.push({ widget: mapBtn, action: () => this.scene.start('OptionsGamepad') })

    currentY += 240

    // Back button
    const backBtn = this.add.text(panelX, currentY, '← Back to Menu', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: '#ffffff',
      backgroundColor: '#2a3a2a',
      padding: { x: 96, y: 36 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    backBtn.on('pointerdown', () => this.scene.start('Menu'))
    backBtn.on('pointerover', () => backBtn.setStyle({ backgroundColor: '#3c5a3c', color: '#ffffcc' }))
    backBtn.on('pointerout', () => backBtn.setStyle({ backgroundColor: '#2a3a2a', color: '#ffffff' }))

    this.toggles.push({ widget: backBtn, action: () => this.scene.start('Menu') })

    // Setup navigation
    const navigableItems: NavigableItem[] = this.toggles.map((toggle, index) => ({
      index,
      onFocus: () => {
        toggle.widget.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' })
      },
      onBlur: () => {
        const isBackButton = index === this.toggles.length - 1
        toggle.widget.setStyle({
          backgroundColor: isBackButton ? '#2a3a2a' : '#222244',
          color: '#ffffff'
        })
      },
      onActivate: () => toggle.action(),
    }))

    this.navigator = new MenuNavigator({
      scene: this,
      items: navigableItems,
      columns: 2, // Two columns for music/sfx controls and invert X/Y
      onCancel: () => this.scene.start('Menu'),
    })
  }

  private cleanup() {
    this.navigator?.destroy()
    this.toggles = []
  }

  shutdown() {
    this.cleanup()
  }
}
