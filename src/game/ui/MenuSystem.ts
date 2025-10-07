import Phaser from 'phaser'

/**
 * Modern, responsive menu system for Spaced
 * - Supports virtual scrolling for performance
 * - Responsive grid layouts
 * - Unified input (keyboard, gamepad, touch)
 * - Smooth animations and effects
 */

export interface MenuSystemConfig {
  scene: Phaser.Scene
  width: number
  height: number
  padding?: number
  backgroundColor?: number
  backgroundAlpha?: number
  borderColor?: number
  borderWidth?: number
}

export interface LayoutConfig {
  columns: number
  cardWidth: number
  cardHeight: number
  gap: number
  padding: number
}

export class MenuSystem {
  private scene: Phaser.Scene
  private config: MenuSystemConfig
  private container: Phaser.GameObjects.Container
  private background?: Phaser.GameObjects.Rectangle
  private border?: Phaser.GameObjects.Graphics
  private layout: LayoutConfig

  // Scrolling
  private scrollContainer: Phaser.GameObjects.Container
  private scrollMask?: Phaser.Display.Masks.GeometryMask
  private scrollY = 0
  private scrollVelocity = 0
  private scrollArea: Phaser.Geom.Rectangle
  private contentHeight = 0
  private isDragging = false
  private lastPointerY = 0
  private lastDragTime = 0

  // Scrollbar
  private scrollbarTrack?: Phaser.GameObjects.Rectangle
  private scrollbarThumb?: Phaser.GameObjects.Rectangle

  // Navigation
  private focusedIndex = 0
  private focusRect?: Phaser.GameObjects.Graphics

  constructor(config: MenuSystemConfig) {
    this.scene = config.scene
    this.config = {
      padding: 96,
      backgroundColor: 0x000000,
      backgroundAlpha: 0.85,
      borderColor: 0x3355ff,
      borderWidth: 12,
      ...config,
    }

    this.container = this.scene.add.container(0, 0).setDepth(1000)
    this.scrollContainer = this.scene.add.container(0, 0)
    this.container.add(this.scrollContainer)

    // Calculate responsive layout
    this.layout = this.calculateLayout(config.width)

    // Define scroll area (where content can scroll)
    const headerHeight = 288
    const footerHeight = 480
    this.scrollArea = new Phaser.Geom.Rectangle(
      this.config.padding!,
      headerHeight,
      config.width - this.config.padding! * 2,
      config.height - headerHeight - footerHeight
    )

    this.createBackground()
    this.createScrollMask()
    this.createScrollbar()
    this.setupInput()
  }

  private calculateLayout(width: number): LayoutConfig {
    // Responsive column calculation
    let columns = 1
    if (width >= 1440) columns = 4
    else if (width >= 1024) columns = 3
    else if (width >= 600) columns = 2
    else columns = 1

    const padding = width < 600 ? 72 : 96
    const gap = width < 600 ? 48 : 72

    const availableWidth = width - padding * 2 - gap * (columns - 1)
    const cardWidth = Math.floor(availableWidth / columns)
    const cardHeight = Math.min(720, cardWidth * 0.7)

    return { columns, cardWidth, cardHeight, gap, padding }
  }

  private createBackground() {
    const { width, height, backgroundColor, backgroundAlpha, borderColor, borderWidth } = this.config

    // Background overlay
    this.background = this.scene.add.rectangle(0, 0, width, height, backgroundColor!, backgroundAlpha!)
      .setOrigin(0, 0)
      .setDepth(999)

    // Border frame
    this.border = this.scene.add.graphics().setDepth(1001)
    this.border.lineStyle(borderWidth!, borderColor!, 1)
    this.border.strokeRoundedRect(36, 36, width - 72, height - 72, 48)
  }

  private createScrollMask() {
    const maskGraphics = this.scene.add.graphics()
    maskGraphics.fillStyle(0xffffff, 1)
    maskGraphics.fillRect(
      this.scrollArea.x,
      this.scrollArea.y,
      this.scrollArea.width,
      this.scrollArea.height
    )
    this.scrollMask = maskGraphics.createGeometryMask()
    this.scrollContainer.setMask(this.scrollMask)
    maskGraphics.setVisible(false)
  }

  private createScrollbar() {
    const x = this.scrollArea.x + this.scrollArea.width + 48
    const y = this.scrollArea.y
    const height = this.scrollArea.height

    this.scrollbarTrack = this.scene.add.rectangle(x, y, 36, height, 0x111122, 0.45)
      .setOrigin(0, 0)
      .setDepth(1002)
      .setVisible(false)

    this.scrollbarThumb = this.scene.add.rectangle(x + 6, y, 24, 144, 0x666688, 0.9)
      .setOrigin(0, 0)
      .setDepth(1003)
      .setVisible(false)
  }

  private updateScrollbar() {
    if (!this.scrollbarTrack || !this.scrollbarThumb) return

    const maxScroll = this.getMaxScroll()
    if (maxScroll <= 0) {
      this.scrollbarTrack.setVisible(false)
      this.scrollbarThumb.setVisible(false)
      return
    }

    this.scrollbarTrack.setVisible(true)
    this.scrollbarThumb.setVisible(true)

    const ratio = this.scrollArea.height / this.contentHeight
    const thumbHeight = Phaser.Math.Clamp(this.scrollArea.height * ratio, 120, this.scrollArea.height)
    this.scrollbarThumb.height = thumbHeight

    const progress = this.scrollY / maxScroll
    this.scrollbarThumb.y = this.scrollArea.y + progress * (this.scrollArea.height - thumbHeight)
  }

  private setupInput() {
    // Mouse wheel scrolling
    this.scene.input.on('wheel', (_pointer: any, _objects: any, _dx: number, dy: number) => {
      this.scrollVelocity = dy * 0.5
    })

    // Touch/drag scrolling
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!Phaser.Geom.Rectangle.Contains(this.scrollArea, pointer.x, pointer.y)) return

      this.isDragging = true
      this.lastPointerY = pointer.y
      this.lastDragTime = this.scene.time.now
      this.scrollVelocity = 0
    })

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return

      const deltaY = pointer.y - this.lastPointerY
      const deltaTime = this.scene.time.now - this.lastDragTime

      this.scrollY -= deltaY
      this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.getMaxScroll())

      // Calculate velocity for momentum scrolling
      if (deltaTime > 0) {
        this.scrollVelocity = -deltaY / deltaTime * 16
      }

      this.lastPointerY = pointer.y
      this.lastDragTime = this.scene.time.now
    })

    this.scene.input.on('pointerup', () => {
      this.isDragging = false
    })
  }

  update() {
    // Apply momentum scrolling with physics
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.1) {
      this.scrollY += this.scrollVelocity
      this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.getMaxScroll())

      // Deceleration
      this.scrollVelocity *= 0.92

      if (Math.abs(this.scrollVelocity) < 0.1) {
        this.scrollVelocity = 0
      }
    }

    // Update scroll container position
    this.scrollContainer.y = this.scrollArea.y - this.scrollY
    this.updateScrollbar()
  }

  private getMaxScroll(): number {
    return Math.max(0, this.contentHeight - this.scrollArea.height)
  }

  setContentHeight(height: number) {
    this.contentHeight = height
  }

  getLayout(): LayoutConfig {
    return this.layout
  }

  getScrollContainer(): Phaser.GameObjects.Container {
    return this.scrollContainer
  }

  getScrollArea(): Phaser.Geom.Rectangle {
    return this.scrollArea
  }

  scrollToItem(index: number) {
    const { columns, cardHeight, gap } = this.layout
    const row = Math.floor(index / columns)
    const itemY = row * (cardHeight + gap)

    // Scroll to make item visible
    if (itemY < this.scrollY) {
      this.scrollY = itemY
    } else if (itemY + cardHeight > this.scrollY + this.scrollArea.height) {
      this.scrollY = itemY + cardHeight - this.scrollArea.height
    }

    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.getMaxScroll())
    this.scrollVelocity = 0
  }

  setFocusedIndex(index: number) {
    this.focusedIndex = index
  }

  getFocusedIndex(): number {
    return this.focusedIndex
  }

  destroy() {
    this.container.destroy()
    this.background?.destroy()
    this.border?.destroy()
    this.scrollbarTrack?.destroy()
    this.scrollbarThumb?.destroy()
    this.focusRect?.destroy()
  }
}
