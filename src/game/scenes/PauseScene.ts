import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'
import { MenuNavigator, type NavigableItem } from '../ui/MenuNavigator'

export default class PauseScene extends Phaser.Scene {
  private toggles: {
    widget: Phaser.GameObjects.Text
    toggle: () => void
  }[] = []
  private navigator?: MenuNavigator

  constructor() {
    super('Pause')
  }

  create() {
    // Notify game that pause started
    this.game.events.emit('pause-opened')

    const { width, height } = this.scale

    // Semi-transparent overlay
    this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0, 0)
      .setDepth(1000)

    // Panel background
    const panelWidth = Math.min(1800, width - 240)
    const panelHeight = Math.min(1560, height - 480)
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
    this.add.text(panelX, panelY - panelHeight / 2 + 144, '⏸ PAUSED', {
      fontFamily: 'monospace',
      fontSize: '108px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1010)

    // Toggle buttons
    const startY = panelY - panelHeight / 2 + 384
    const gap = 240

    const mkToggle = (label: string, getVal: () => boolean, setVal: (b: boolean) => void, y: number) => {
      const widget = this.add.text(
        panelX,
        y,
        `${label}: ${getVal() ? 'ON' : 'OFF'}`,
        {
          fontFamily: 'monospace',
          fontSize: '72px',
          color: '#ffffff',
          backgroundColor: '#222244',
          padding: { x: 72, y: 36 },
        }
      ).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

      const toggle = () => {
        setVal(!getVal())
        widget.setText(`${label}: ${getVal() ? 'ON' : 'OFF'}`)
        this.game.events.emit('options-updated')
      }

      widget.on('pointerdown', toggle)
      widget.on('pointerover', () => {
        widget.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' })
      })
      widget.on('pointerout', () => {
        widget.setStyle({ backgroundColor: '#222244', color: '#ffffff' })
      })

      return { widget, toggle }
    }

    const screenShake = mkToggle(
      'Screen Shake',
      () => getOptions().screenShake,
      (b) => setOptions({ screenShake: b }),
      startY
    )
    this.toggles.push(screenShake)

    const crtFilter = mkToggle(
      'CRT Filter',
      () => getOptions().crtFilter,
      (b) => setOptions({ crtFilter: b }),
      startY + gap
    )
    this.toggles.push(crtFilter)

    const showFPS = mkToggle(
      'Show FPS',
      () => getOptions().showFPS,
      (b) => setOptions({ showFPS: b }),
      startY + gap * 2
    )
    this.toggles.push(showFPS)

    // Volume control
    const volumeWidget = this.add.text(
      panelX,
      startY + gap * 3,
      `Volume: ${Math.round(getOptions().musicVolume * 100)}%`,
      {
        fontFamily: 'monospace',
        fontSize: '72px',
        color: '#ffffff',
        backgroundColor: '#222244',
        padding: { x: 72, y: 36 },
      }
    ).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor: true })

    const updateVolume = (delta: number) => {
      const o = getOptions()
      const newMusic = Math.max(0, Math.min(1, o.musicVolume + delta))
      const newSfx = Math.max(0, Math.min(1, o.sfxVolume + delta))
      setOptions({ musicVolume: newMusic, sfxVolume: newSfx })
      volumeWidget.setText(`Volume: ${Math.round(newMusic * 100)}%`)
      this.game.events.emit('options-updated')
    }

    volumeWidget.on('pointerdown', () => updateVolume(0.1))
    volumeWidget.on('pointerover', () => {
      volumeWidget.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' })
    })
    volumeWidget.on('pointerout', () => {
      volumeWidget.setStyle({ backgroundColor: '#222244', color: '#ffffff' })
    })

    this.toggles.push({
      widget: volumeWidget,
      toggle: () => updateVolume(0.1),
    })

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
    const widgets = this.toggles.map((t) => t.widget)
    const navigableItems: NavigableItem[] = widgets.map((widget, index) => ({
      index,
      onFocus: () => {
        widget.setStyle({ backgroundColor: '#3355ff', color: '#ffffcc' })
      },
      onBlur: () => {
        widget.setStyle({ backgroundColor: '#222244', color: '#ffffff' })
      },
      onActivate: () => {
        if (index < 3) {
          this.toggles[index].toggle()
        } else {
          updateVolume(0.1)
        }
      },
    }))

    this.navigator = new MenuNavigator({
      scene: this,
      items: navigableItems,
      columns: 1,
      onCancel: close,
    })

    // Add custom left/right for volume
    this.input.keyboard?.on('keydown-LEFT', () => {
      const currentIndex = this.navigator?.getCurrentIndex() ?? 0
      if (currentIndex === 3) {
        updateVolume(-0.1)
      }
    })

    this.input.keyboard?.on('keydown-RIGHT', () => {
      const currentIndex = this.navigator?.getCurrentIndex() ?? 0
      if (currentIndex === 3) {
        updateVolume(0.1)
      }
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
