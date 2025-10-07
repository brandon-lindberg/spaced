import Phaser from 'phaser'

/**
 * Generates placeholder icon graphics for menu items
 */

export class IconGenerator {
  static generateIcons(scene: Phaser.Scene) {
    // Weapon icons
    this.generateWeaponIcon(scene, 'icon-weapon', 0x88ff88)
    this.generateLaserIcon(scene, 'icon-weapon-laser', 0xff66ff)
    this.generateMissileIcon(scene, 'icon-weapon-missiles', 0xffaa33)
    this.generateOrbIcon(scene, 'icon-weapon-orb', 0x66ccff)

    // Accessory icons
    this.generateAccessoryIcon(scene, 'icon-acc', 0x33ff99)
    this.generateShieldIcon(scene, 'icon-shield', 0x66aaff)
    this.generateSpeedIcon(scene, 'icon-speed', 0xffcc33)

    // Utility icons
    this.generateGoldIcon(scene, 'icon-gold', 0xffcc33)
    this.generateHealthIcon(scene, 'icon-health', 0xff6666)
    this.generateRerollIcon(scene, 'icon-reroll', 0xaa88ff)
  }

  private static generateWeaponIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      // Draw a simple blaster/gun shape
      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Barrel
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.fillRect(12, 8, 12, 4)

      // Body
      ctx.fillRect(8, 12, 12, 8)

      // Grip
      ctx.fillRect(10, 20, 6, 8)

      // Highlight
      ctx.fillStyle = `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.6)`
      ctx.fillRect(14, 9, 8, 2)

      canvas.refresh()
    }
  }

  private static generateLaserIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Beam base
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.beginPath()
      ctx.moveTo(8, 16)
      ctx.lineTo(28, 12)
      ctx.lineTo(28, 20)
      ctx.closePath()
      ctx.fill()

      // Glow effect
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`
      ctx.beginPath()
      ctx.moveTo(6, 16)
      ctx.lineTo(28, 10)
      ctx.lineTo(28, 22)
      ctx.closePath()
      ctx.fill()

      canvas.refresh()
    }
  }

  private static generateMissileIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Missile body
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.fillRect(12, 12, 12, 6)

      // Nose cone
      ctx.beginPath()
      ctx.moveTo(24, 12)
      ctx.lineTo(28, 15)
      ctx.lineTo(24, 18)
      ctx.closePath()
      ctx.fill()

      // Fins
      ctx.fillRect(12, 10, 2, 3)
      ctx.fillRect(12, 19, 2, 3)

      // Highlight
      ctx.fillStyle = `rgba(255, 255, 255, 0.4)`
      ctx.fillRect(14, 13, 8, 2)

      canvas.refresh()
    }
  }

  private static generateOrbIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Outer glow
      const grad = ctx.createRadialGradient(16, 16, 4, 16, 16, 12)
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
      grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.6)`)
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(16, 16, 12, 0, Math.PI * 2)
      ctx.fill()

      // Core
      ctx.fillStyle = `rgba(255, 255, 255, 0.8)`
      ctx.beginPath()
      ctx.arc(16, 16, 4, 0, Math.PI * 2)
      ctx.fill()

      canvas.refresh()
    }
  }

  private static generateAccessoryIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Gear/cog shape
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`

      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6
        ctx.save()
        ctx.translate(16, 16)
        ctx.rotate(angle)
        ctx.fillRect(-2, -12, 4, 6)
        ctx.restore()
      }

      // Center circle
      ctx.beginPath()
      ctx.arc(16, 16, 6, 0, Math.PI * 2)
      ctx.fill()

      // Inner hole
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.beginPath()
      ctx.arc(16, 16, 3, 0, Math.PI * 2)
      ctx.fill()

      canvas.refresh()
    }
  }

  private static generateShieldIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Shield shape
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.beginPath()
      ctx.moveTo(16, 6)
      ctx.lineTo(24, 10)
      ctx.lineTo(24, 18)
      ctx.lineTo(16, 26)
      ctx.lineTo(8, 18)
      ctx.lineTo(8, 10)
      ctx.closePath()
      ctx.fill()

      // Highlight
      ctx.fillStyle = `rgba(255, 255, 255, 0.3)`
      ctx.beginPath()
      ctx.moveTo(16, 8)
      ctx.lineTo(22, 11)
      ctx.lineTo(22, 16)
      ctx.lineTo(16, 12)
      ctx.closePath()
      ctx.fill()

      canvas.refresh()
    }
  }

  private static generateSpeedIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Speed lines
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.fillRect(6, 10, 16, 3)
      ctx.fillRect(8, 15, 18, 3)
      ctx.fillRect(6, 20, 14, 3)

      // Arrow
      ctx.beginPath()
      ctx.moveTo(22, 16)
      ctx.lineTo(28, 16)
      ctx.lineTo(25, 12)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(22, 16)
      ctx.lineTo(28, 16)
      ctx.lineTo(25, 20)
      ctx.closePath()
      ctx.fill()

      canvas.refresh()
    }
  }

  private static generateGoldIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Coin shape
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.beginPath()
      ctx.arc(16, 16, 10, 0, Math.PI * 2)
      ctx.fill()

      // Inner circle
      ctx.strokeStyle = `rgba(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)}, 1)`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(16, 16, 7, 0, Math.PI * 2)
      ctx.stroke()

      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.beginPath()
      ctx.arc(14, 14, 3, 0, Math.PI * 2)
      ctx.fill()

      canvas.refresh()
    }
  }

  private static generateHealthIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Heart shape
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.beginPath()
      ctx.moveTo(16, 26)
      ctx.lineTo(8, 18)
      ctx.lineTo(8, 14)
      ctx.arc(10, 12, 4, 0, Math.PI * 2)
      ctx.lineTo(16, 10)
      ctx.arc(22, 12, 4, 0, Math.PI * 2)
      ctx.lineTo(24, 14)
      ctx.lineTo(24, 18)
      ctx.closePath()
      ctx.fill()

      canvas.refresh()
    }
  }

  private static generateRerollIcon(scene: Phaser.Scene, key: string, color: number) {
    if (scene.textures.exists(key)) return

    const size = 32
    const canvas = scene.textures.createCanvas(key, size, size)
    const ctx = canvas?.getContext()

    if (ctx && canvas) {
      ctx.clearRect(0, 0, size, size)

      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff

      // Circular arrow
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(16, 16, 8, 0, Math.PI * 1.7)
      ctx.stroke()

      // Arrow head
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.beginPath()
      ctx.moveTo(16, 8)
      ctx.lineTo(12, 12)
      ctx.lineTo(16, 12)
      ctx.closePath()
      ctx.fill()

      canvas.refresh()
    }
  }
}
