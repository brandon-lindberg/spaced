import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'
import { MenuNavigator, type NavigableItem } from '../ui/MenuNavigator'
import { MenuButton } from '../ui/MenuComponents'

export default class PauseScene extends Phaser.Scene {
  private buttons: MenuButton[] = []
  private navigator?: MenuNavigator

  constructor() {
    super('Pause')
  }

  create() {
    // Clear any previous state
    this.buttons = []
    this.navigator?.destroy()
    this.navigator = undefined

    // Notify game that pause started
    this.game.events.emit('pause-opened')

    const { width, height } = this.scale

    // Semi-transparent overlay
    this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0, 0)
      .setDepth(1000)

    // Panel background (responsive with mobile support)
    const panelWidth = Math.max(280, Math.min(600, width * 0.85))
    const panelHeight = Math.max(350, Math.min(520, height * 0.85))
    const panelX = width / 2
    const panelY = height / 2
    const borderRadius = Math.max(8, Math.min(16, width * 0.008))
    const borderWidth = Math.max(2, Math.min(4, width * 0.002))

    const panel = this.add.graphics().setDepth(1001)
    panel.fillStyle(0x0b0e20, 0.95)
    panel.fillRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      borderRadius
    )
    panel.lineStyle(borderWidth, 0x3355ff, 1)
    panel.strokeRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      borderRadius
    )

    // Title (responsive with mobile support)
    const titleFontSize = Math.max(20, Math.min(32, width * 0.04))
    const titleOffset = Math.max(25, Math.min(40, panelHeight * 0.077))
    this.add.text(panelX, panelY - panelHeight / 2 + titleOffset, '⏸ PAUSED', {
      fontFamily: 'monospace',
      fontSize: `${titleFontSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1010)

    // Menu buttons (responsive with mobile support)
    const startOffset = Math.max(50, Math.min(80, panelHeight * 0.15))
    const startY = panelY - panelHeight / 2 + startOffset
    const gap = Math.max(40, Math.min(60, panelHeight * 0.115))

    const buttonWidth = Math.max(220, Math.min(500, panelWidth * 0.85))
    const buttonHeight = Math.max(36, Math.min(50, panelHeight * 0.096))

    // Screen Shake button
    const screenShakeButton = new MenuButton({
      scene: this,
      x: panelX - buttonWidth / 2,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: `Screen Shake: ${getOptions().screenShake ? 'ON' : 'OFF'}`,
      onClick: () => {
        const current = getOptions().screenShake
        setOptions({ screenShake: !current })
        screenShakeButton.setText(`Screen Shake: ${!current ? 'ON' : 'OFF'}`)
        this.game.events.emit('options-updated')
      },
    })
    screenShakeButton.getContainer().setDepth(1010)
    this.buttons.push(screenShakeButton)

    // CRT Filter button
    const crtFilterButton = new MenuButton({
      scene: this,
      x: panelX - buttonWidth / 2,
      y: startY + gap,
      width: buttonWidth,
      height: buttonHeight,
      text: `CRT Filter: ${getOptions().crtFilter ? 'ON' : 'OFF'}`,
      onClick: () => {
        const current = getOptions().crtFilter
        setOptions({ crtFilter: !current })
        crtFilterButton.setText(`CRT Filter: ${!current ? 'ON' : 'OFF'}`)
        this.game.events.emit('options-updated')
      },
    })
    crtFilterButton.getContainer().setDepth(1010)
    this.buttons.push(crtFilterButton)

    // Show FPS button
    const showFPSButton = new MenuButton({
      scene: this,
      x: panelX - buttonWidth / 2,
      y: startY + gap * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: `Show FPS: ${getOptions().showFPS ? 'ON' : 'OFF'}`,
      onClick: () => {
        const current = getOptions().showFPS
        setOptions({ showFPS: !current })
        showFPSButton.setText(`Show FPS: ${!current ? 'ON' : 'OFF'}`)
        this.game.events.emit('options-updated')
      },
    })
    showFPSButton.getContainer().setDepth(1010)
    this.buttons.push(showFPSButton)

    // Music Volume buttons (left/right controls)
    const smallButtonWidth = Math.max(55, Math.min(75, buttonWidth * 0.3))
    const musicDownButton = new MenuButton({
      scene: this,
      x: panelX - buttonWidth / 2,
      y: startY + gap * 3,
      width: smallButtonWidth,
      height: buttonHeight,
      text: '◄',
      onClick: () => {
        const o = getOptions()
        const newMusic = Math.max(0, o.musicVolume - 0.1)
        setOptions({ musicVolume: newMusic })
        musicLabel.setText(`Music: ${Math.round(newMusic * 100)}%`)
        this.game.events.emit('options-updated')
      },
    })
    musicDownButton.getContainer().setDepth(1010)
    this.buttons.push(musicDownButton)

    const musicLabel = this.add.text(
      panelX,
      startY + gap * 3,
      `Music: ${Math.round(getOptions().musicVolume * 100)}%`,
      {
        fontFamily: 'monospace',
        fontSize: `${Math.max(10, Math.min(14, width * 0.012))}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(1010)

    const musicUpButton = new MenuButton({
      scene: this,
      x: panelX + buttonWidth / 2 - smallButtonWidth,
      y: startY + gap * 3,
      width: smallButtonWidth,
      height: buttonHeight,
      text: '►',
      onClick: () => {
        const o = getOptions()
        const newMusic = Math.min(1, o.musicVolume + 0.1)
        setOptions({ musicVolume: newMusic })
        musicLabel.setText(`Music: ${Math.round(newMusic * 100)}%`)
        this.game.events.emit('options-updated')
      },
    })
    musicUpButton.getContainer().setDepth(1010)
    this.buttons.push(musicUpButton)

    // SFX Volume buttons (left/right controls)
    const sfxDownButton = new MenuButton({
      scene: this,
      x: panelX - buttonWidth / 2,
      y: startY + gap * 4,
      width: smallButtonWidth,
      height: buttonHeight,
      text: '◄',
      onClick: () => {
        const o = getOptions()
        const newSfx = Math.max(0, o.sfxVolume - 0.1)
        setOptions({ sfxVolume: newSfx })
        sfxLabel.setText(`SFX: ${Math.round(newSfx * 100)}%`)
        this.game.events.emit('options-updated')
      },
    })
    sfxDownButton.getContainer().setDepth(1010)
    this.buttons.push(sfxDownButton)

    const sfxLabel = this.add.text(
      panelX,
      startY + gap * 4,
      `SFX: ${Math.round(getOptions().sfxVolume * 100)}%`,
      {
        fontFamily: 'monospace',
        fontSize: `${Math.max(10, Math.min(14, width * 0.012))}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(1010)

    const sfxUpButton = new MenuButton({
      scene: this,
      x: panelX + buttonWidth / 2 - smallButtonWidth,
      y: startY + gap * 4,
      width: smallButtonWidth,
      height: buttonHeight,
      text: '►',
      onClick: () => {
        const o = getOptions()
        const newSfx = Math.min(1, o.sfxVolume + 0.1)
        setOptions({ sfxVolume: newSfx })
        sfxLabel.setText(`SFX: ${Math.round(newSfx * 100)}%`)
        this.game.events.emit('options-updated')
      },
    })
    sfxUpButton.getContainer().setDepth(1010)
    this.buttons.push(sfxUpButton)

    // Resume button
    const resumeButton = new MenuButton({
      scene: this,
      x: panelX - buttonWidth / 2,
      y: startY + gap * 5,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Resume',
      primary: true,
      onClick: () => {
        this.game.events.emit('pause-closed')
        this.cleanup()
        this.scene.stop()
        this.scene.resume('Game')
      },
    })
    resumeButton.getContainer().setDepth(1010)
    this.buttons.push(resumeButton)

    // Close handler
    const close = () => {
      this.game.events.emit('pause-closed')
      this.cleanup()
      this.scene.stop()
      this.scene.resume('Game')
    }

    // Keyboard close
    this.input.keyboard?.once('keydown-P', close)
    this.input.keyboard?.once('keydown-ESC', close)

    // Click outside to close
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const panelBounds = new Phaser.Geom.Rectangle(
        panelX - panelWidth / 2,
        panelY - panelHeight / 2,
        panelWidth,
        panelHeight
      )
      if (!Phaser.Geom.Rectangle.Contains(panelBounds, pointer.x, pointer.y)) {
        close()
      }
    })

    // Setup navigation
    const navigableItems: NavigableItem[] = this.buttons.map((_button, index) => ({
      index,
      onFocus: () => {},
      onBlur: () => {},
      onActivate: () => {
        if (index === 0) {
          // Screen Shake
          const current = getOptions().screenShake
          setOptions({ screenShake: !current })
          this.buttons[0].setText(`Screen Shake: ${!current ? 'ON' : 'OFF'}`)
          this.game.events.emit('options-updated')
        } else if (index === 1) {
          // CRT Filter
          const current = getOptions().crtFilter
          setOptions({ crtFilter: !current })
          this.buttons[1].setText(`CRT Filter: ${!current ? 'ON' : 'OFF'}`)
          this.game.events.emit('options-updated')
        } else if (index === 2) {
          // Show FPS
          const current = getOptions().showFPS
          setOptions({ showFPS: !current })
          this.buttons[2].setText(`Show FPS: ${!current ? 'ON' : 'OFF'}`)
          this.game.events.emit('options-updated')
        } else if (index === 3) {
          // Music Down
          const o = getOptions()
          const newMusic = Math.max(0, o.musicVolume - 0.1)
          setOptions({ musicVolume: newMusic })
          musicLabel.setText(`Music: ${Math.round(newMusic * 100)}%`)
          this.game.events.emit('options-updated')
        } else if (index === 4) {
          // Music Up
          const o = getOptions()
          const newMusic = Math.min(1, o.musicVolume + 0.1)
          setOptions({ musicVolume: newMusic })
          musicLabel.setText(`Music: ${Math.round(newMusic * 100)}%`)
          this.game.events.emit('options-updated')
        } else if (index === 5) {
          // SFX Down
          const o = getOptions()
          const newSfx = Math.max(0, o.sfxVolume - 0.1)
          setOptions({ sfxVolume: newSfx })
          sfxLabel.setText(`SFX: ${Math.round(newSfx * 100)}%`)
          this.game.events.emit('options-updated')
        } else if (index === 6) {
          // SFX Up
          const o = getOptions()
          const newSfx = Math.min(1, o.sfxVolume + 0.1)
          setOptions({ sfxVolume: newSfx })
          sfxLabel.setText(`SFX: ${Math.round(newSfx * 100)}%`)
          this.game.events.emit('options-updated')
        } else {
          // Resume
          close()
        }
      },
    }))

    this.navigator = new MenuNavigator({
      scene: this,
      items: navigableItems,
      columns: 1,
      onCancel: close,
    })

    // Add custom left/right for volume controls
    this.input.keyboard?.on('keydown-LEFT', () => {
      const currentIndex = this.navigator?.getCurrentIndex() ?? 0
      if (currentIndex === 3 || currentIndex === 4) {
        // Music volume
        const o = getOptions()
        const newMusic = Math.max(0, o.musicVolume - 0.1)
        setOptions({ musicVolume: newMusic })
        musicLabel.setText(`Music: ${Math.round(newMusic * 100)}%`)
        this.game.events.emit('options-updated')
      } else if (currentIndex === 5 || currentIndex === 6) {
        // SFX volume
        const o = getOptions()
        const newSfx = Math.max(0, o.sfxVolume - 0.1)
        setOptions({ sfxVolume: newSfx })
        sfxLabel.setText(`SFX: ${Math.round(newSfx * 100)}%`)
        this.game.events.emit('options-updated')
      }
    })

    this.input.keyboard?.on('keydown-RIGHT', () => {
      const currentIndex = this.navigator?.getCurrentIndex() ?? 0
      if (currentIndex === 3 || currentIndex === 4) {
        // Music volume
        const o = getOptions()
        const newMusic = Math.min(1, o.musicVolume + 0.1)
        setOptions({ musicVolume: newMusic })
        musicLabel.setText(`Music: ${Math.round(newMusic * 100)}%`)
        this.game.events.emit('options-updated')
      } else if (currentIndex === 5 || currentIndex === 6) {
        // SFX volume
        const o = getOptions()
        const newSfx = Math.min(1, o.sfxVolume + 0.1)
        setOptions({ sfxVolume: newSfx })
        sfxLabel.setText(`SFX: ${Math.round(newSfx * 100)}%`)
        this.game.events.emit('options-updated')
      }
    })
  }

  private cleanup() {
    this.navigator?.destroy()
    this.buttons.forEach((btn) => btn.destroy())
    this.buttons = []
  }

  shutdown() {
    this.cleanup()
  }
}
