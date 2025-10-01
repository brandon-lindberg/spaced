import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { getBankGold } from '../systems/storage'
import { attachGamepad, attachGamepadDebug, ensureGamepadProbe, ensureMobileGamepadInit } from '../systems/gamepad'
//

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create() {
    const { width, height } = this.scale
    const title = this.add.text(width / 2, height / 2 - 70, 'Spaced', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
    })
    title.setOrigin(0.5).setScrollFactor(0)

    // Panel container
    const panel = this.add.rectangle(width / 2, height / 2 + 24, 220, 130, 0x0b0e20, 0.85).setOrigin(0.5)
    panel.setStrokeStyle(1, 0x3355ff, 1).setScrollFactor(0)

    // Buttons: Start Game, Level Select, Options (vertical list)
    const startBtn = this.add.rectangle(width / 2, height / 2 - 6, 180, 18, 0x222233, 1).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0)
    const startTxt = this.add.text(startBtn.x, startBtn.y, 'Start Game', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)
    const levelBtn = this.add.rectangle(width / 2, height / 2 + 18, 180, 18, 0x222233, 1).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0)
    const levelTxt = this.add.text(levelBtn.x, levelBtn.y, 'Level Select', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)
    const optBtn = this.add.rectangle(width / 2, height / 2 + 42, 180, 18, 0x222233, 1).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0)
    const optTxt = this.add.text(optBtn.x, optBtn.y, 'Options', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)

    const bank = this.add.text(6, height - 14, `Bank: ${getBankGold()}g`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffcc33',
    })
    bank.setScrollFactor(0)

    // Ensure input is enabled after returning from other scenes
    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true

    const start = () => {
      runState.newRun()
      this.scene.start('Game')
      this.scene.launch('HUD')
    }
    
    const showLevelSelect = () => {
      this.showLevelSelectMenu()
    }
    
    startBtn.on('pointerdown', start)
    levelBtn.on('pointerdown', showLevelSelect)
    optBtn.on('pointerdown', () => this.scene.start('Options'))
    
    // Keyboard navigation
    this.input.keyboard?.on('keydown-UP', () => { sel = (sel + 2) % 3; highlight() })
    this.input.keyboard?.on('keydown-DOWN', () => { sel = (sel + 1) % 3; highlight() })
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (sel === 0) start()
      else if (sel === 1) showLevelSelect()
      else this.scene.start('Options')
    })

    // Gamepad: confirm to start; down/up to navigate; cancel no-op
    let sel = 0
    const highlight = () => {
      const on = (r: Phaser.GameObjects.Rectangle, t: Phaser.GameObjects.Text, active: boolean) => {
        r.setFillStyle(active ? 0x333355 : 0x222233, 1)
        t.setColor(active ? '#ffffcc' : '#ffffff')
      }
      on(startBtn, startTxt, sel === 0)
      on(levelBtn, levelTxt, sel === 1)
      on(optBtn, optTxt, sel === 2)
    }
    highlight()
    const focus = this.add.graphics().setDepth(999).setScrollFactor(0)
    const updateFocus = () => {
      const w = sel===0?startTxt:sel===1?levelTxt:optTxt
      const b = w.getBounds()
      focus.clear(); focus.lineStyle(1, 0xffff66, 1); focus.strokeRect(b.x-3, b.y-3, b.width+6, b.height+6)
    }
    updateFocus()
    attachGamepad(this, {
      up: () => { sel = (sel + 2) % 3; highlight(); updateFocus() },
      down: () => { sel = (sel + 1) % 3; highlight(); updateFocus() },
      confirm: () => {
        if (sel === 0) start()
        else if (sel === 1) showLevelSelect()
        else this.scene.start('Options')
      },
    })
    attachGamepadDebug(this)
    ensureMobileGamepadInit(this)
    ensureGamepadProbe(this)

    // Show toast when a controller connects
    this.input.gamepad?.once('connected', () => {
      this.registry.set('toast', 'Controller detected')
    })
  }

  private showLevelSelectMenu() {
    const { width, height } = this.scale
    
    // Clear existing menu elements
    this.children.removeAll()
    
    // Background overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setOrigin(0.5).setScrollFactor(0)
    
    // Title
    this.add.text(width / 2, height / 2 - 80, 'Select Level', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0)
    
    // Level buttons container
    const levels = [1, 2, 3, 4, 5]
    const levelButtons: Phaser.GameObjects.Rectangle[] = []
    const levelTexts: Phaser.GameObjects.Text[] = []
    
    levels.forEach((level, index) => {
      const x = width / 2 - 60 + (index % 3) * 60
      const y = height / 2 - 20 + Math.floor(index / 3) * 30
      
      const btn = this.add.rectangle(x, y, 50, 20, 0x222233, 1)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
      
      const txt = this.add.text(x, y, `Level ${level}`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0)
      
      levelButtons.push(btn)
      levelTexts.push(txt)
      
      // Level button click handler
      btn.on('pointerdown', () => {
        this.startLevel(level)
      })
    })
    
    // Back button
    const backBtn = this.add.rectangle(width / 2, height / 2 + 60, 100, 18, 0x333344, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
    
    this.add.text(backBtn.x, backBtn.y, 'Back', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0)
    
    backBtn.on('pointerdown', () => {
      this.scene.restart()
    })
    
    // Keyboard navigation for level select
    let selectedLevel = 0
    const updateLevelHighlight = () => {
      levelButtons.forEach((btn, index) => {
        const isSelected = index === selectedLevel
        btn.setFillStyle(isSelected ? 0x333355 : 0x222233, 1)
        levelTexts[index].setColor(isSelected ? '#ffffcc' : '#ffffff')
      })
    }
    
    this.input.keyboard?.on('keydown-LEFT', () => {
      selectedLevel = Math.max(0, selectedLevel - 1)
      updateLevelHighlight()
    })
    
    this.input.keyboard?.on('keydown-RIGHT', () => {
      selectedLevel = Math.min(levels.length - 1, selectedLevel + 1)
      updateLevelHighlight()
    })
    
    this.input.keyboard?.on('keydown-UP', () => {
      selectedLevel = Math.max(0, selectedLevel - 3)
      updateLevelHighlight()
    })
    
    this.input.keyboard?.on('keydown-DOWN', () => {
      selectedLevel = Math.min(levels.length - 1, selectedLevel + 3)
      updateLevelHighlight()
    })
    
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.startLevel(levels[selectedLevel])
    })
    
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.restart()
    })
    
    updateLevelHighlight()
  }
  
  private startLevel(level: number) {
    runState.newRun()
    runState.startLevel(level, this.time.now)
    this.scene.start('Game')
    this.scene.launch('HUD')
  }
}


