import Phaser from 'phaser'
import { getOptions } from './options'

class AudioManager {
  private context: AudioContext | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private musicSource: AudioBufferSourceNode | null = null
  private musicMedia: HTMLAudioElement | null = null
  private musicPhaserSound: Phaser.Sound.BaseSound | null = null
  // removed tone generation fallback
  // private musicBuffer: AudioBuffer | null = null
  private attached = false

  init(scene: Phaser.Scene) {
    if (this.attached) return
    const sndAny: any = scene.sound as any
    this.context = (sndAny && sndAny.context ? (sndAny.context as AudioContext) : (typeof AudioContext !== 'undefined' ? new AudioContext() : null))
    if (!this.context) return
    this.musicGain = this.context.createGain()
    this.sfxGain = this.context.createGain()
    const dest = this.context.destination
    this.musicGain.connect(dest)
    this.sfxGain.connect(dest)
    this.setVolumesFromOptions()
    scene.game.events.on('options-updated', () => this.setVolumesFromOptions())
    scene.game.events.on('pause-opened', () => this.pauseMusic())
    scene.game.events.on('pause-closed', () => this.resumeMusic())
    // Try to resume on first user input (mobile autoplay policies)
    const resume = () => { this.context && this.context.resume && this.context.resume() }
    scene.input.once('pointerdown', resume)
    scene.input.keyboard?.once('keydown', resume as any)
    scene.input.gamepad?.once('down', resume as any)
    this.attached = true
  }

  // private ensureMusicBuffer() { /* removed: silence fallback only */ }

  setVolumesFromOptions() {
    const o = getOptions()
    const mv = Math.max(0, Math.min(1, o.musicVolume))
    const sv = Math.max(0, Math.min(1, o.sfxVolume))
    if (this.musicGain) this.musicGain.gain.value = mv
    if (this.sfxGain) this.sfxGain.gain.value = sv
    // If using HTML5 audio via Phaser Sound, also set volume there
    try {
      if (this.musicMedia) { (this.musicMedia as any).volume = mv }
      if (this.musicPhaserSound) { (this.musicPhaserSound as any).setVolume?.(mv) }
    } catch {}
  }

  startMusic(scene?: Phaser.Scene) {
    if (!this.context || !this.musicGain) return
    // Prefer decoded asset 'bgm' if available
    const cacheKey = 'bgm'
    if (scene && (scene.cache as any)?.audio?.exists?.(cacheKey)) {
      try {
        if (this.musicPhaserSound && (this.musicPhaserSound as any).isPlaying) return
        const snd = scene.sound.add(cacheKey, { loop: true, volume: Math.max(0, Math.min(1, getOptions().musicVolume)) })
        snd.play()
        this.musicPhaserSound = snd
        this.musicMedia = null
        return
      } catch {
        /* fallback to WebAudio tone loop below */
      }
    }
    // no fallback generation: silence if no asset
  }

  stopMusic() {
    if (this.musicSource) {
      try { this.musicSource.stop(0) } catch {}
      this.musicSource.disconnect()
      this.musicSource = null
    }
    if (this.musicMedia) {
      try { (this.musicMedia as any).stop?.(); (this.musicMedia as any).pause?.() } catch {}
      this.musicMedia = null
    }
    if (this.musicPhaserSound) {
      try { this.musicPhaserSound.stop(); this.musicPhaserSound.destroy() } catch {}
      this.musicPhaserSound = null
    }
  }

  pauseMusic() {
    try {
      if (this.musicPhaserSound && (this.musicPhaserSound as any).pause) (this.musicPhaserSound as any).pause()
      if (this.musicSource) this.context?.suspend?.()
      if (this.musicMedia) (this.musicMedia as any).pause?.()
    } catch {}
  }

  resumeMusic() {
    try {
      if (this.musicPhaserSound && (this.musicPhaserSound as any).resume) (this.musicPhaserSound as any).resume()
      if (this.musicSource) this.context?.resume?.()
      if (this.musicMedia) (this.musicMedia as any).play?.()
    } catch {}
  }

  private beep(freq: number, ms: number, type: OscillatorType = 'sine', amp = 0.4) {
    if (!this.context || !this.sfxGain) return
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = type
    osc.frequency.value = freq
    // Short attack/decay envelope
    const now = this.context.currentTime
    const g = gain.gain
    g.setValueAtTime(0.0001, now)
    g.exponentialRampToValueAtTime(Math.max(0.05, amp), now + 0.01)
    g.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + ms / 1000 + 0.02)
    osc.onended = () => { try { osc.disconnect(); gain.disconnect() } catch {} }
  }

  sfxShotBlaster(level?: number) {
    const lvl = Math.max(1, Math.min(7, level || 1))
    const freq = 600 + (lvl - 1) * 40
    const dur = 32 + (lvl - 1) * 4
    this.beep(freq, dur, 'square', 0.35 + (lvl - 1) * 0.02)
  }
  sfxShotMissile(level?: number) {
    const lvl = Math.max(1, Math.min(7, level || 1))
    const freq = 380 + (lvl - 1) * 18
    const dur = 60 + (lvl - 1) * 6
    this.beep(freq, dur, 'sawtooth', 0.38 + (lvl - 1) * 0.02)
  }
  sfxShotOrb(level?: number) {
    const lvl = Math.max(1, Math.min(7, level || 1))
    const freq = 500 + (lvl - 1) * 28
    const dur = 50 + (lvl - 1) * 5
    this.beep(freq, dur, 'triangle', 0.32 + (lvl - 1) * 0.02)
  }
  sfxPickupXP(isElite?: boolean) {
    if (isElite) {
      this.beep(760, 45, 'sine', 0.28)
      setTimeout(() => this.beep(980, 55, 'sine', 0.32), 30)
    } else {
      this.beep(880, 45, 'sine', 0.25)
    }
  }
  sfxPickupGold(isElite?: boolean) {
    if (isElite) {
      this.beep(700, 40, 'triangle', 0.3)
      setTimeout(() => this.beep(1100, 50, 'triangle', 0.3), 25)
    } else {
      this.beep(660, 55, 'triangle', 0.24)
    }
  }
  sfxPickupHealth() { this.beep(500, 80, 'sine') }
  sfxPowerup() { this.beep(990, 100, 'square') }
  sfxExplosion() { this.beep(180, 140, 'sawtooth') }
  sfxLevelUp() { this.beep(1200, 120, 'square') }
  sfxHurt() { this.beep(240, 90, 'sawtooth') }
  sfxBossSpawn() { this.beep(320, 200, 'triangle') }
}

export const audio = new AudioManager()


