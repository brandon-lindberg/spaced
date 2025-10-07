import Phaser from 'phaser'
import { attachGamepad, ensureMobileGamepadInit } from '../systems/gamepad'

/**
 * Unified input navigation for menu systems
 * Handles keyboard, gamepad, and touch input simultaneously
 */

export interface NavigableItem {
  index: number
  isDisabled?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onActivate?: () => void
}

export interface MenuNavigatorConfig {
  scene: Phaser.Scene
  items: NavigableItem[]
  columns: number
  onNavigate?: (index: number) => void
  onActivate?: (index: number) => void
  onCancel?: () => void
  initialIndex?: number
}

export class MenuNavigator {
  private scene: Phaser.Scene
  private config: MenuNavigatorConfig
  private currentIndex: number
  private items: NavigableItem[]
  private columns: number

  constructor(config: MenuNavigatorConfig) {
    this.scene = config.scene
    this.config = config
    this.items = config.items
    this.columns = config.columns
    this.currentIndex = config.initialIndex || 0

    // Find first non-disabled item
    if (this.items[this.currentIndex]?.isDisabled) {
      this.currentIndex = this.findNextEnabledIndex(this.currentIndex, 1)
    }

    this.setupInputHandlers()
    this.focusItem(this.currentIndex)
  }

  private setupInputHandlers() {
    // Keyboard navigation
    this.scene.input.keyboard?.on('keydown-UP', () => this.navigate('up'))
    this.scene.input.keyboard?.on('keydown-DOWN', () => this.navigate('down'))
    this.scene.input.keyboard?.on('keydown-LEFT', () => this.navigate('left'))
    this.scene.input.keyboard?.on('keydown-RIGHT', () => this.navigate('right'))
    this.scene.input.keyboard?.on('keydown-ENTER', () => this.activate())
    this.scene.input.keyboard?.on('keydown-SPACE', () => this.activate())
    this.scene.input.keyboard?.on('keydown-ESC', () => this.cancel())

    // Gamepad navigation
    ensureMobileGamepadInit(this.scene)
    attachGamepad(this.scene, {
      up: () => this.navigate('up'),
      down: () => this.navigate('down'),
      left: () => this.navigate('left'),
      right: () => this.navigate('right'),
      confirm: () => this.activate(),
      cancel: () => this.cancel(),
    })
  }

  private navigate(direction: 'up' | 'down' | 'left' | 'right') {
    const oldIndex = this.currentIndex
    let newIndex = oldIndex

    switch (direction) {
      case 'up':
        newIndex = oldIndex - this.columns
        break
      case 'down':
        newIndex = oldIndex + this.columns
        break
      case 'left':
        newIndex = oldIndex - 1
        break
      case 'right':
        newIndex = oldIndex + 1
        break
    }

    // Wrap around or clamp
    if (newIndex < 0) {
      newIndex = 0
    } else if (newIndex >= this.items.length) {
      newIndex = this.items.length - 1
    }

    // Skip disabled items
    if (this.items[newIndex]?.isDisabled) {
      const step = newIndex > oldIndex ? 1 : -1
      newIndex = this.findNextEnabledIndex(newIndex, step)
    }

    if (newIndex !== oldIndex) {
      this.unfocusItem(oldIndex)
      this.focusItem(newIndex)
      this.currentIndex = newIndex
      this.config.onNavigate?.(newIndex)
    }
  }

  private findNextEnabledIndex(startIndex: number, step: number): number {
    let index = startIndex
    let attempts = 0
    const maxAttempts = this.items.length

    while (attempts < maxAttempts) {
      index += step

      if (index < 0) index = this.items.length - 1
      if (index >= this.items.length) index = 0

      if (!this.items[index]?.isDisabled) {
        return index
      }

      attempts++
    }

    return startIndex // Fallback
  }

  private focusItem(index: number) {
    const item = this.items[index]
    if (item && !item.isDisabled) {
      item.onFocus?.()
    }
  }

  private unfocusItem(index: number) {
    const item = this.items[index]
    if (item && !item.isDisabled) {
      item.onBlur?.()
    }
  }

  private activate() {
    const item = this.items[this.currentIndex]
    if (item && !item.isDisabled) {
      item.onActivate?.()
      this.config.onActivate?.(this.currentIndex)
    }
  }

  private cancel() {
    this.config.onCancel?.()
  }

  setItems(items: NavigableItem[], columns: number) {
    this.unfocusItem(this.currentIndex)
    this.items = items
    this.columns = columns

    // Reset to first enabled item
    this.currentIndex = 0
    if (this.items[this.currentIndex]?.isDisabled) {
      this.currentIndex = this.findNextEnabledIndex(this.currentIndex, 1)
    }

    this.focusItem(this.currentIndex)
  }

  getCurrentIndex(): number {
    return this.currentIndex
  }

  setIndex(index: number) {
    if (index >= 0 && index < this.items.length && !this.items[index]?.isDisabled) {
      this.unfocusItem(this.currentIndex)
      this.currentIndex = index
      this.focusItem(this.currentIndex)
      this.config.onNavigate?.(index)
    }
  }

  destroy() {
    this.scene.input.keyboard?.off('keydown-UP')
    this.scene.input.keyboard?.off('keydown-DOWN')
    this.scene.input.keyboard?.off('keydown-LEFT')
    this.scene.input.keyboard?.off('keydown-RIGHT')
    this.scene.input.keyboard?.off('keydown-ENTER')
    this.scene.input.keyboard?.off('keydown-SPACE')
    this.scene.input.keyboard?.off('keydown-ESC')
  }
}
