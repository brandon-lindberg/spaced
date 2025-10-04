import Phaser from 'phaser'

/**
 * Caches texture generation so scenes avoid redundant canvas work. Callers should
 * request the assets they need before creating sprites or tile sprites.
 */
export class TextureFactory {
  static ensureEnemyTexture(scene: Phaser.Scene, key: string) {
    if (scene.textures.exists(key)) return
    const size = 8
    const gfx = scene.add.graphics()
    gfx.fillStyle(0xff4444, 1)
    gfx.fillRect(0, 0, size, size)
    gfx.generateTexture(key, size, size)
    gfx.destroy()
  }

  static ensureStarField(scene: Phaser.Scene, key: string, size = 512, count = 120) {
    if (scene.textures.exists(key)) return
    const tex = scene.textures.createCanvas(key, size, size)
    const ctx = tex?.getContext()
    if (!ctx) return
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < count; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = Math.random() < 0.85 ? 0.5 + Math.random() * 0.8 : 1 + Math.random() * 1.2
      const a = 0.3 + Math.random() * 0.7
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`
      ctx.fill()
    }
    tex?.refresh()
  }

  static ensureAsteroidField(scene: Phaser.Scene, key: string, size = 512, count = 100) {
    if (scene.textures.exists(key)) return
    const tex = scene.textures.createCanvas(key, size, size)
    const c = tex?.getContext()
    if (!c) return
    c.fillStyle = '#000'
    c.fillRect(0, 0, size, size)
    for (let i = 0; i < count; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 3 + Math.random() * 10
      const tilt = Math.random() * Math.PI
      const rx = r * (0.6 + Math.random() * 0.8)
      const ry = r
      c.save()
      c.translate(x, y)
      c.rotate(tilt)
      c.fillStyle = '#666a72'
      c.beginPath()
      c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#8a9099'
      c.beginPath()
      c.arc(-rx * 0.3, -ry * 0.2, Math.max(1, rx * 0.3), 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
    tex?.refresh()
  }

  static ensurePlanetTile(scene: Phaser.Scene, key: string) {
    if (scene.textures.exists(key)) return
    const s = 256
    const tex = scene.textures.createCanvas(key, s, s)
    const c = tex?.getContext()
    if (!c) return
    c.fillStyle = '#3b2f22'
    c.fillRect(0, 0, s, s)
    for (let i = 0; i < 1200; i++) {
      c.fillStyle = Math.random() < 0.5 ? '#46382a' : '#2e241a'
      c.fillRect(Math.random() * s, Math.random() * s, 1, 1)
    }
    c.strokeStyle = '#1fa84a'
    c.lineWidth = 12
    c.beginPath()
    for (let x = -16; x <= s + 16; x += 8) {
      const y = s * 0.5 + Math.sin((x / s) * Math.PI * 2) * 24
      if (x === -16) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
    tex?.refresh()
  }

  static ensureCityTile(scene: Phaser.Scene, key: string) {
    if (scene.textures.exists(key)) return
    const s = 256
    const tex = scene.textures.createCanvas(key, s, s)
    const c = tex?.getContext()
    if (!c) return
    c.fillStyle = '#0b0e12'
    c.fillRect(0, 0, s, s)
    c.strokeStyle = '#1a2030'
    c.lineWidth = 3
    for (let i = 0; i <= s; i += 32) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.stroke()
      c.beginPath(); c.moveTo(0, i); c.lineTo(s, i); c.stroke()
    }
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(Math.random() * s)
      const y = Math.floor(Math.random() * s)
      const w = 6 + Math.random() * 18
      const h = 6 + Math.random() * 18
      c.fillStyle = '#2a3a55'
      c.fillRect(x, y, w, h)
      c.fillStyle = Math.random() < 0.3 ? '#ffd966' : '#334a6b'
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        for (let wy = y + 2; wy < y + h - 2; wy += 4) {
          if (Math.random() < 0.4) c.fillRect(wx, wy, 2, 2)
        }
      }
    }
    tex?.refresh()
  }

  static ensureSun(scene: Phaser.Scene, key: string) {
    if (scene.textures.exists(key)) return
    const s = 256
    const tex = scene.textures.createCanvas(key, s, s)
    const c = tex?.getContext()
    if (!c) return
    const cx = s / 2
    const cy = s / 2
    const r = s / 2
    const grad = c.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, '#fff4a3')
    grad.addColorStop(0.5, '#ffcc44')
    grad.addColorStop(1, 'rgba(255,180,0,0)')
    c.fillStyle = grad
    c.fillRect(0, 0, s, s)
    tex?.refresh()
  }

  static ensureProjectileTextures(scene: Phaser.Scene) {
    const ensure = (key: string, width: number, height: number, draw: (gfx: Phaser.GameObjects.Graphics) => void) => {
      if (scene.textures.exists(key)) return
      const g = scene.add.graphics()
      draw(g)
      g.generateTexture(key, width, height)
      g.destroy()
    }

    ensure('missile-tex', 3, 5, (g) => {
      g.fillStyle(0xffaa33, 1)
      g.fillRect(0, 0, 3, 5)
    })

    ensure('orb-tex', 8, 8, (g) => {
      g.fillStyle(0x66ccff, 1)
      g.fillCircle(4, 4, 4)
    })

    ensure('beam-tex', 8, 2, (g) => {
      g.fillStyle(0xff66ff, 1)
      g.fillRect(0, 0, 8, 2)
    })

    ensure('blaster-tex', 3, 3, (g) => {
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 3, 3)
    })

    ensure('laser-shot-tex', 2, 2, (g) => {
      g.fillStyle(0xff66ff, 1)
      g.fillRect(0, 0, 2, 2)
    })

    if (!scene.textures.exists('explosion-tex')) {
      const s = 32
      const can = scene.textures.createCanvas('explosion-tex', s, s)
      const ctx = can?.getContext()
      if (ctx && can) {
        const cx = s / 2
        const cy = s / 2
        const r = s / 2
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, 'rgba(255,220,120,1)')
        grad.addColorStop(0.5, 'rgba(255,120,60,0.6)')
        grad.addColorStop(1, 'rgba(255,120,60,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, s, s)
        can.refresh()
      }
    }
  }

  static ensurePickupTextures(scene: Phaser.Scene) {
    if (!scene.textures.exists('xp-gem')) {
      const size = 6
      const gfx = scene.add.graphics()
      gfx.fillStyle(0x66ccff, 1)
      gfx.fillTriangle(3, 0, 6, 3, 0, 3)
      gfx.fillTriangle(0, 3, 6, 3, 3, 6)
      gfx.generateTexture('xp-gem', size, size)
      gfx.destroy()
    }
    if (!scene.textures.exists('xp-gem-elite')) {
      const size = 6
      const g = scene.add.graphics()
      g.fillStyle(0xaa66ff, 1)
      g.fillTriangle(3, 0, 6, 3, 0, 3)
      g.fillTriangle(0, 3, 6, 3, 3, 6)
      g.fillStyle(0xffffff, 0.9)
      g.fillRect(2, 1, 1, 1)
      g.generateTexture('xp-gem-elite', size, size)
      g.destroy()
    }
    if (!scene.textures.exists('gold-coin')) {
      const size = 6
      const gfx = scene.add.graphics()
      gfx.fillStyle(0xffcc33, 1)
      gfx.fillCircle(size / 2, size / 2, size / 2)
      gfx.generateTexture('gold-coin', size, size)
      gfx.destroy()
    }
    if (!scene.textures.exists('gold-coin-elite')) {
      const size = 8
      const g = scene.add.graphics()
      g.fillStyle(0xffcc33, 1)
      g.fillCircle(size / 2, size / 2, size / 2 - 1)
      const cx = size / 2
      const cy = size / 2
      g.fillStyle(0xffffff, 0.95)
      g.fillTriangle(cx, cy - 2, cx - 1, cy, cx + 1, cy)
      g.fillTriangle(cx, cy + 2, cx - 1, cy, cx + 1, cy)
      g.fillTriangle(cx - 2, cy, cx, cy - 1, cx, cy + 1)
      g.fillTriangle(cx + 2, cy, cx, cy - 1, cx, cy + 1)
      g.generateTexture('gold-coin-elite', size, size)
      g.destroy()
    }
    if (!scene.textures.exists('powerup-chip')) {
      const size = 8
      const gfx = scene.add.graphics()
      gfx.fillStyle(0x99ffcc, 1)
      gfx.fillRect(0, 0, size, size)
      gfx.fillStyle(0x006644, 1)
      gfx.fillRect(2, 2, size - 4, size - 4)
      gfx.generateTexture('powerup-chip', size, size)
      gfx.destroy()
    }
    if (!scene.textures.exists('health-pack')) {
      const size = 7
      const gfx = scene.add.graphics()
      gfx.fillStyle(0x33ff66, 1)
      gfx.fillRect(0, 0, size, size)
      gfx.fillStyle(0xffffff, 1)
      gfx.fillRect(size / 2 - 1, 1, 2, size - 2)
      gfx.fillRect(1, size / 2 - 1, size - 2, 2)
      gfx.generateTexture('health-pack', size, size)
      gfx.destroy()
    }
  }
}
