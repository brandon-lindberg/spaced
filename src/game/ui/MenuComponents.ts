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

    // Use darker base background for better text contrast, accent color for borders
    this.baseColor = 0x1a1a2e
    this.hoverColor = config.color || 0x2d2d44

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

    // Icon (if provided) - centered at top of card with responsive size
    const iconSize = Math.max(40, Math.min(80, height * 0.25))
    const iconY = Math.max(30, height * 0.25)

    if (icon && this.scene.textures.exists(icon)) {
      this.iconImage = this.scene.add.image(width / 2, iconY, icon)
        .setDisplaySize(iconSize, iconSize)
        .setOrigin(0.5)
      this.container.add(this.iconImage)
    }

    // Title (centered below icon)
    const titleFontSize = Math.max(12, Math.min(20, height * 0.11))
    const titleY = icon ? iconY + iconSize / 2 + Math.max(15, height * 0.08) : height * 0.35
    this.titleText = this.scene.add.text(width / 2, titleY, title, {
      fontFamily: 'monospace',
      fontSize: `${titleFontSize}px`,
      color: this.isDisabled ? '#888888' : '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: width * 0.9, useAdvancedWrap: true },
      align: 'center',
    }).setOrigin(0.5, 0)
    this.container.add(this.titleText)

    // Description (responsive font size)
    if (description) {
      const descFontSize = Math.max(10, Math.min(16, height * 0.08))
      const descY = height * 0.65
      this.descriptionText = this.scene.add.text(width / 2, descY, description, {
        fontFamily: 'monospace',
        fontSize: `${descFontSize}px`,
        color: this.isDisabled ? '#666666' : '#e0e0e0',
        wordWrap: { width: width * 0.85, useAdvancedWrap: true },
        align: 'center',
      }).setOrigin(0.5, 0)
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

  private drawBackground(_color: number, glowIntensity = 0) {
    const { width, height } = this.config
    const accentColor = this.config.color || 0x2d2d44
    const borderRadius = Math.min(48, height * 0.15)
    const borderWidth = Math.max(3, Math.min(6, height * 0.02))

    this.background.clear()

    // Outer glow (when hovered)
    if (glowIntensity > 0) {
      const glowWidth = Math.max(6, Math.min(12, height * 0.04))
      const glowRadius = Math.min(60, height * 0.19)
      this.background.lineStyle(glowWidth, accentColor, glowIntensity * 0.6)
      this.background.strokeRoundedRect(-glowWidth/2, -glowWidth/2, width + glowWidth, height + glowWidth, glowRadius)
    }

    // Main card background (always dark for good contrast)
    this.background.fillStyle(this.baseColor, 0.95)
    this.background.fillRoundedRect(0, 0, width, height, borderRadius)

    // Border using accent color for distinction
    this.background.lineStyle(borderWidth, accentColor, 0.9)
    this.background.strokeRoundedRect(0, 0, width, height, borderRadius)

    // Subtle gradient effect (top highlight)
    this.background.fillStyle(accentColor, 0.15)
    this.background.fillRoundedRect(0, 0, width, height * 0.3, { tl: borderRadius, tr: borderRadius, bl: 0, br: 0 })
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
      this.titleText.setColor('#ffff66')
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
      if (this.descriptionText) this.descriptionText.setColor('#e0e0e0')
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

    // Text (responsive font size based on button height with better mobile support)
    const fontSize = Math.max(14, Math.min(42, height * 0.55))
    this.text = this.scene.add.text(width / 2, height / 2, text, {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: width * 0.9, useAdvancedWrap: true },
    }).setOrigin(0.5)
    this.container.add(this.text)
  }

  private drawBackground(color: number) {
    const { width, height } = this.config
    this.background.clear()

    // Calculate appropriate border radius based on button height (max 30% of height)
    const borderRadius = Math.min(48, height * 0.3)
    const strokeWidth = Math.max(6, height * 0.1)

    this.background.fillStyle(color, 1)
    this.background.fillRoundedRect(0, 0, width, height, borderRadius)

    this.background.lineStyle(strokeWidth, this.lightenColor(color, 0.3), 1)
    this.background.strokeRoundedRect(0, 0, width, height, borderRadius)

    // Highlight effect (use same border radius as background)
    this.background.fillStyle(0xffffff, 0.1)
    this.background.fillRoundedRect(0, 0, width, height * 0.4, { tl: borderRadius, tr: borderRadius, bl: 0, br: 0 })
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

  setText(text: string) {
    this.text.setText(text)
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
