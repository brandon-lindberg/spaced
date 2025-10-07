import Phaser from 'phaser'

/**
 * Reusable menu components with consistent styling and animations
 */

export interface MenuCardConfig {
  scene: Phaser.Scene
  x: number
  y: number
  width: number
  height: number
  title: string
  description?: string
  price?: number
  icon?: string
  color?: number
  disabled?: boolean
  onClick?: () => void
  onHover?: () => void
  onHoverOut?: () => void
}

export class MenuCard {
  private scene: Phaser.Scene
  private config: MenuCardConfig
  private container: Phaser.GameObjects.Container
  private background: Phaser.GameObjects.Graphics
  private titleText!: Phaser.GameObjects.Text
  private descriptionText?: Phaser.GameObjects.Text
  private priceText?: Phaser.GameObjects.Text
  private iconImage?: Phaser.GameObjects.Image
  private isHovered = false
  private isDisabled = false
  private baseColor: number
  private hoverColor: number

  constructor(config: MenuCardConfig) {
    this.scene = config.scene
    this.config = config
    this.isDisabled = config.disabled || false

    this.baseColor = config.color || 0x222244
    this.hoverColor = this.lightenColor(this.baseColor, 0.3)

    this.container = this.scene.add.container(config.x, config.y)
    this.background = this.scene.add.graphics()
    this.container.add(this.background)

    this.createCard()
    this.setupInteractivity()
  }

  private createCard() {
    const { width, height, title, description, price, icon } = this.config

    // Background with rounded corners and gradient effect
    this.drawBackground(this.baseColor)

    // Icon (if provided)
    const iconSize = 144
    const iconX = 72
    const iconY = height / 2
    const contentStartX = icon ? iconX + iconSize + 48 : 72

    if (icon && this.scene.textures.exists(icon)) {
      this.iconImage = this.scene.add.image(iconX + iconSize / 2, iconY, icon)
        .setDisplaySize(iconSize, iconSize)
        .setOrigin(0.5)
      this.container.add(this.iconImage)
    }

    // Title
    this.titleText = this.scene.add.text(contentStartX, 72, title, {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: this.isDisabled ? '#888888' : '#ffffff',
      fontStyle: 'bold',
    })
    this.container.add(this.titleText)

    // Description
    if (description) {
      this.descriptionText = this.scene.add.text(contentStartX, 168, description, {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: this.isDisabled ? '#666666' : '#cccccc',
        wordWrap: { width: width - contentStartX - 72 },
      })
      this.container.add(this.descriptionText)
    }

    // Price badge (bottom right)
    if (price !== undefined) {
      const priceX = width - 72
      const priceY = height - 72

      const priceBg = this.scene.add.graphics()
      priceBg.fillStyle(0xffcc33, 0.2)
      priceBg.fillRoundedRect(priceX - 300, priceY - 96, 300, 96, 24)
      priceBg.lineStyle(6, 0xffcc33, 0.6)
      priceBg.strokeRoundedRect(priceX - 300, priceY - 96, 300, 96, 24)
      this.container.add(priceBg)

      this.priceText = this.scene.add.text(priceX - 150, priceY - 48, `${price}g`, {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: this.isDisabled ? '#666666' : '#ffcc33',
        fontStyle: 'bold',
      }).setOrigin(0.5)
      this.container.add(this.priceText)
    }

    // Disabled overlay
    if (this.isDisabled) {
      const overlay = this.scene.add.graphics()
      overlay.fillStyle(0x000000, 0.4)
      overlay.fillRoundedRect(0, 0, width, height, 48)
      this.container.add(overlay)
    }
  }

  private drawBackground(color: number, glowIntensity = 0) {
    const { width, height } = this.config
    this.background.clear()

    // Outer glow (when hovered)
    if (glowIntensity > 0) {
      this.background.lineStyle(18, this.hoverColor, glowIntensity * 0.5)
      this.background.strokeRoundedRect(-12, -12, width + 24, height + 24, 60)
    }

    // Main card background
    this.background.fillStyle(color, 1)
    this.background.fillRoundedRect(0, 0, width, height, 48)

    // Border
    this.background.lineStyle(6, this.lightenColor(color, 0.2), 0.8)
    this.background.strokeRoundedRect(0, 0, width, height, 48)

    // Subtle gradient effect (top highlight)
    this.background.fillStyle(0xffffff, 0.05)
    this.background.fillRoundedRect(0, 0, width, height * 0.3, { tl: 48, tr: 48, bl: 0, br: 0 })
  }

  private setupInteractivity() {
    if (this.isDisabled) return

    const { width, height } = this.config

    // Create invisible interactive zone
    const zone = this.scene.add.zone(width / 2, height / 2, width, height)
      .setInteractive({ useHandCursor: true })
    this.container.add(zone)

    zone.on('pointerover', () => {
      this.isHovered = true
      this.animateHover(true)
      this.config.onHover?.()
    })

    zone.on('pointerout', () => {
      this.isHovered = false
      this.animateHover(false)
      this.config.onHoverOut?.()
    })

    zone.on('pointerdown', () => {
      this.animateClick()
      this.config.onClick?.()
    })
  }

  private animateHover(hovered: boolean) {
    if (hovered) {
      // Scale up slightly and glow
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 150,
        ease: 'Quad.easeOut',
      })

      // Animate glow
      this.scene.tweens.add({
        targets: { glow: 0 },
        glow: 1,
        duration: 150,
        onUpdate: (tween) => {
          const value = tween.getValue() as number
          this.drawBackground(this.hoverColor, value)
        },
      })

      // Brighten text
      this.titleText.setColor('#ffffcc')
      if (this.descriptionText) this.descriptionText.setColor('#ffffff')
    } else {
      // Scale back to normal
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
        ease: 'Quad.easeOut',
      })

      // Remove glow
      this.scene.tweens.add({
        targets: { glow: 1 },
        glow: 0,
        duration: 150,
        onUpdate: (tween) => {
          const value = tween.getValue() as number
          this.drawBackground(this.baseColor, value)
        },
      })

      // Restore text color
      this.titleText.setColor('#ffffff')
      if (this.descriptionText) this.descriptionText.setColor('#cccccc')
    }
  }

  private animateClick() {
    // Quick scale down and up
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.98,
      scaleY: 0.98,
      duration: 50,
      yoyo: true,
      ease: 'Quad.easeInOut',
    })

    // Particle burst effect
    this.createParticleBurst()
  }

  private createParticleBurst() {
    const { width, height } = this.config
    const particleCount = 8

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const distance = 120

      const particle = this.scene.add.rectangle(
        width / 2,
        height / 2,
        24,
        24,
        this.hoverColor,
        0.8
      )
      this.container.add(particle)

      this.scene.tweens.add({
        targets: particle,
        x: width / 2 + Math.cos(angle) * distance,
        y: height / 2 + Math.sin(angle) * distance,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      })
    }
  }

  private lightenColor(color: number, amount: number): number {
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff

    const newR = Math.min(255, r + Math.floor(amount * 255))
    const newG = Math.min(255, g + Math.floor(amount * 255))
    const newB = Math.min(255, b + Math.floor(amount * 255))

    return (newR << 16) | (newG << 8) | newB
  }

  setDisabled(disabled: boolean) {
    this.isDisabled = disabled
    this.container.destroy()
    this.container = this.scene.add.container(this.config.x, this.config.y)
    this.background = this.scene.add.graphics()
    this.container.add(this.background)
    this.createCard()
    if (!disabled) {
      this.setupInteractivity()
    }
  }

  setFocused(focused: boolean) {
    if (focused && !this.isHovered && !this.isDisabled) {
      this.animateHover(true)
    } else if (!focused && !this.isHovered) {
      this.animateHover(false)
    }
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  destroy() {
    this.container.destroy()
  }
}

export interface MenuButtonConfig {
  scene: Phaser.Scene
  x: number
  y: number
  width: number
  height: number
  text: string
  onClick?: () => void
  color?: number
  primary?: boolean
}

export class MenuButton {
  private scene: Phaser.Scene
  private config: MenuButtonConfig
  private container: Phaser.GameObjects.Container
  private background: Phaser.GameObjects.Graphics
  private text!: Phaser.GameObjects.Text
  private baseColor: number
  private hoverColor: number

  constructor(config: MenuButtonConfig) {
    this.scene = config.scene
    this.config = config

    this.baseColor = config.primary ? 0x3355ff : config.color || 0x2a3a2a
    this.hoverColor = config.primary ? 0x4466ff : 0x3c5a3c

    this.container = this.scene.add.container(config.x, config.y)
    this.background = this.scene.add.graphics()
    this.container.add(this.background)

    this.createButton()
    this.setupInteractivity()
  }

  private createButton() {
    const { width, height, text } = this.config

    // Background
    this.drawBackground(this.baseColor)

    // Text
    this.text = this.scene.add.text(width / 2, height / 2, text, {
      fontFamily: 'monospace',
      fontSize: '42px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.container.add(this.text)
  }

  private drawBackground(color: number) {
    const { width, height } = this.config
    this.background.clear()

    this.background.fillStyle(color, 1)
    this.background.fillRoundedRect(0, 0, width, height, 48)

    this.background.lineStyle(12, this.lightenColor(color, 0.3), 1)
    this.background.strokeRoundedRect(0, 0, width, height, 48)

    // Highlight effect
    this.background.fillStyle(0xffffff, 0.1)
    this.background.fillRoundedRect(0, 0, width, height * 0.4, { tl: 48, tr: 48, bl: 0, br: 0 })
  }

  private setupInteractivity() {
    const { width, height } = this.config

    const zone = this.scene.add.zone(width / 2, height / 2, width, height)
      .setInteractive({ useHandCursor: true })
    this.container.add(zone)

    zone.on('pointerover', () => {
      this.drawBackground(this.hoverColor)
      this.text.setColor('#ffffcc')
    })

    zone.on('pointerout', () => {
      this.drawBackground(this.baseColor)
      this.text.setColor('#ffffff')
    })

    zone.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        ease: 'Quad.easeInOut',
      })
      this.config.onClick?.()
    })
  }

  private lightenColor(color: number, amount: number): number {
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff

    const newR = Math.min(255, r + Math.floor(amount * 255))
    const newG = Math.min(255, g + Math.floor(amount * 255))
    const newB = Math.min(255, b + Math.floor(amount * 255))

    return (newR << 16) | (newG << 8) | newB
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  destroy() {
    this.container.destroy()
  }
}

export interface MenuSectionConfig {
  scene: Phaser.Scene
  title: string
  x: number
  y: number
  width: number
  collapsible?: boolean
  collapsed?: boolean
}

export class MenuSection {
  private scene: Phaser.Scene
  private config: MenuSectionConfig
  private container: Phaser.GameObjects.Container
  private titleText!: Phaser.GameObjects.Text
  private divider!: Phaser.GameObjects.Graphics

  constructor(config: MenuSectionConfig) {
    this.scene = config.scene
    this.config = config

    this.container = this.scene.add.container(config.x, config.y)
    this.createSection()
  }

  private createSection() {
    const { title, width } = this.config

    // Title
    this.titleText = this.scene.add.text(0, 0, title, {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#ffffcc',
      fontStyle: 'bold',
    })
    this.container.add(this.titleText)

    // Divider line
    this.divider = this.scene.add.graphics()
    this.divider.lineStyle(6, 0x444466, 0.6)
    this.divider.lineBetween(0, 60, width, 60)
    this.container.add(this.divider)
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  getHeight(): number {
    return 84
  }

  destroy() {
    this.container.destroy()
  }
}
