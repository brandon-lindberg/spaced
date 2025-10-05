import { audio } from '../systems/audio'
import { addAccessory, addWeapon, createInventory, describeAccessories, describeWeapons, evolveWeapon, MAX_ACCESSORY_LEVEL, MAX_WEAPON_LEVEL, type InventoryState } from '../systems/inventory'
import { applyAccessoryLevel, applyWeaponLevel, computeEvolution, defaultBaseStats } from '../systems/items'
import { runState } from '../systems/runState'
import Phaser from 'phaser'

export interface LevelUpChoice {
  key: string
  label: string
  color: string
}

export interface StatsSnapshot {
  fireRate: number
  bulletDamage: number
  multishot: number
  speedMultiplier: number
  magnetRadius: number
  spreadDeg: number
  inlineExtraProjectiles: number
  bonusLevelsUsed: number
  hpCur: number
  hpMax: number
  hurtCooldown: number
}

export interface ProgressEventHandlers {
  onLevelUpChoices: (choices: LevelUpChoice[]) => void
  onLevelUpApplied: (choiceKey: string) => void
  onStatsChanged: (stats: StatsSnapshot) => void
  onCheckpoint: (snapshot: unknown) => void
}

export class RunProgressManager {
  private scene: Phaser.Scene
  private events: ProgressEventHandlers
  private level = 1
  private xpToNext = 3
  private magnetRadius = 16
  private speedMultiplier = 1
  private fireRate = 0.8
  private bulletDamage = 1
  private multishot = 1
  private inlineExtraProjectiles = 0
  private spreadDeg = 10
  private bonusFireRateMul = 1
  private bonusDamage = 0
  private bonusMultishot = 0
  private bonusSpeedMul = 1
  private bonusMagnet = 0
  private bonusLevelsUsed = 0
  private hpMax = 10
  private hpCur = 10
  private hurtCooldown = 0
  private inventory: InventoryState = createInventory()

  private ensureHpIntegrity() {
    const fallbackMax = Number.isFinite(this.hpMax) && this.hpMax > 0 ? this.hpMax : 10
    this.hpMax = Math.max(1, Math.min(99, Math.floor(fallbackMax)))
    if (!Number.isFinite(this.hpCur)) {
      this.hpCur = this.hpMax
    }
    this.hpCur = Math.max(0, Math.min(this.hpMax, Math.floor(this.hpCur)))
  }

  private syncHpToRegistry() {
    this.ensureHpIntegrity()
    this.scene.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
  }

  constructor(scene: Phaser.Scene, events: ProgressEventHandlers) {
    this.scene = scene
    this.events = events
  }

  getStats(): StatsSnapshot {
    this.ensureHpIntegrity()
    return {
      fireRate: this.fireRate,
      bulletDamage: this.bulletDamage,
      multishot: this.multishot,
      speedMultiplier: this.speedMultiplier,
      magnetRadius: this.magnetRadius,
      spreadDeg: this.spreadDeg,
      inlineExtraProjectiles: this.inlineExtraProjectiles,
      bonusLevelsUsed: this.bonusLevelsUsed,
      hpCur: this.hpCur,
      hpMax: this.hpMax,
      hurtCooldown: this.hurtCooldown,
    }
  }

  getInventory() {
    return this.inventory
  }

  getFireRate() {
    return this.fireRate
  }

  getBulletDamage() {
    return this.bulletDamage
  }

  getMagnetRadius() {
    return this.magnetRadius
  }

  getSpeedMultiplier() {
    return this.speedMultiplier
  }

  getSpreadDeg() {
    return this.spreadDeg
  }

  getInlineExtraProjectiles() {
    return this.inlineExtraProjectiles
  }

  getLevel() {
    return this.level
  }

  getXPToNext() {
    return this.xpToNext
  }

  getHP() {
    this.ensureHpIntegrity()
    return { hpCur: this.hpCur, hpMax: this.hpMax }
  }

  setHurtCooldown(value: number) {
    this.hurtCooldown = value
  }

  tickHurtCooldown(dt: number) {
    const next = Math.max(0, this.hurtCooldown - dt)
    if (next === this.hurtCooldown) return
    this.hurtCooldown = next
    this.events.onStatsChanged(this.getStats())
  }

  canTakeDamage() {
    return this.hurtCooldown <= 0
  }

  initializeFromRegistry() {
    const hpReg = this.scene.registry.get('hp') as { cur?: unknown; max?: unknown } | undefined
    if (hpReg) {
      const rawMax = typeof hpReg.max === 'number' ? hpReg.max : Number(hpReg.max)
      const rawCur = typeof hpReg.cur === 'number' ? hpReg.cur : Number(hpReg.cur)
      if (Number.isFinite(rawMax) && rawMax > 0) {
        this.hpMax = rawMax
      }
      if (Number.isFinite(rawCur)) {
        this.hpCur = rawCur
      }
      if (Number.isFinite(rawCur) && Number.isFinite(rawMax) && rawMax > 0) {
        this.hpCur = Math.max(0, Math.min(rawCur, rawMax))
      }
    }
    this.syncHpToRegistry()

    const currentLevel = this.scene.registry.get('level')
    if (currentLevel === undefined || currentLevel === null) {
      this.scene.registry.set('level', 1)
      this.level = 1
    } else {
      this.level = currentLevel
    }

    if (this.scene.registry.get('xp') === undefined || this.scene.registry.get('xp') === null) this.scene.registry.set('xp', 0)
    const xp2 = this.scene.registry.get('xpToNext') as number | undefined
    this.xpToNext = typeof xp2 === 'number' ? xp2 : 3
    if (this.scene.registry.get('gold') === undefined || this.scene.registry.get('gold') === null) this.scene.registry.set('gold', 0)

    const bonuses = (this.scene.registry.get('bonuses') as any) || null
    if (bonuses) {
      this.bonusFireRateMul = bonuses.fireRateMul ?? this.bonusFireRateMul
      this.bonusDamage = bonuses.damage ?? this.bonusDamage
      this.bonusMultishot = bonuses.multishot ?? this.bonusMultishot
      this.bonusSpeedMul = bonuses.speedMul ?? this.bonusSpeedMul
      this.bonusMagnet = bonuses.magnet ?? this.bonusMagnet
      this.bonusLevelsUsed = bonuses.levelsUsed ?? this.bonusLevelsUsed
      this.inlineExtraProjectiles = bonuses.inlineExtra ?? this.inlineExtraProjectiles
    }

    const inv = (this.scene.registry.get('inv') as InventoryState) || createInventory()
    if (!inv.weapons || inv.weapons.length === 0) {
      addWeapon(inv, 'blaster')
      inv.accessories = []
    }
    this.inventory = inv
    this.scene.registry.set('inv', inv)
    this.scene.registry.set('inv-weapons', describeWeapons(inv))
    this.scene.registry.set('inv-accessories', describeAccessories(inv))

    this.recomputeEffectiveStats()

    const snapshot = {
      playerLevel: this.scene.registry.get('level'),
      xp: this.scene.registry.get('xp'),
      xpToNext: this.xpToNext,
      gold: this.scene.registry.get('gold'),
      inv: this.scene.registry.get('inv'),
      bonuses: {
        fireRateMul: this.bonusFireRateMul,
        damage: this.bonusDamage,
        multishot: this.bonusMultishot,
        speedMul: this.bonusSpeedMul,
        magnet: this.bonusMagnet,
        levelsUsed: this.bonusLevelsUsed,
        inlineExtra: this.inlineExtraProjectiles,
      },
    }
    runState.setCheckpoint((runState.state?.level ?? 1), snapshot)
    this.events.onCheckpoint(snapshot)
    this.events.onStatsChanged(this.getStats())
  }

  takeDamage(amount: number) {
    this.ensureHpIntegrity()
    if (!this.canTakeDamage()) return { hpCur: this.hpCur, hpMax: this.hpMax, died: false }
    this.hurtCooldown = 0.8
    this.hpCur = Math.max(0, this.hpCur - amount)
    this.syncHpToRegistry()
    return { hpCur: this.hpCur, hpMax: this.hpMax, died: this.hpCur <= 0 }
  }

  healByPercent(percent: number, min = 1) {
    this.ensureHpIntegrity()
    const heal = Math.max(min, Math.ceil(this.hpMax * percent))
    this.hpCur = Math.min(this.hpMax, this.hpCur + heal)
    this.syncHpToRegistry()
    this.events.onStatsChanged(this.getStats())
    return this.hpCur
  }

  fullHeal() {
    this.ensureHpIntegrity()
    this.hpCur = this.hpMax
    this.syncHpToRegistry()
    this.events.onStatsChanged(this.getStats())
  }

  handlePickupXP(elite = false, customValue?: number) {
    const cur = (this.scene.registry.get('xp') as number) || 0
    const award = customValue !== undefined ? customValue : (elite ? Math.max(1, Math.ceil(cur * 0.2)) : 1)
    const next = cur + award
    this.scene.registry.set('xp', next)
    this.checkLevelProgress(next)
    audio.sfxPickupXP(elite)
  }

  handlePickupGold(elite = false) {
    const cur = (this.scene.registry.get('gold') as number) || 0
    const add = elite ? 1 : 1
    this.scene.registry.set('gold', cur + add)
    audio.sfxPickupGold(elite)
  }

  handlePickupHealth() {
    this.healByPercent(0.2, 1)
    audio.sfxPickupHealth()
  }

  handlePowerupPickup(): string | null {
    const label = this.applyPowerupReward()
    if (label) this.scene.registry.set('toast', `Power-up: ${label}`)
    audio.sfxPowerup()
    return label
  }

  addGold(amount: number) {
    const cur = (this.scene.registry.get('gold') as number) || 0
    this.scene.registry.set('gold', cur + amount)
  }

  recomputeEffectiveStats() {
    const inv = this.inventory
    const s = { ...defaultBaseStats }
    for (const w of inv.weapons) applyWeaponLevel(s as any, w.key as any, w.level)
    for (const a of inv.accessories) applyAccessoryLevel(s as any, a.key as any, a.level)
    this.fireRate = Math.min(8, s.fireRate * this.bonusFireRateMul)
    this.bulletDamage = Math.max(1, s.bulletDamage + this.bonusDamage)
    this.multishot = Math.min(7, Math.max(1, Math.floor(s.multishot + this.bonusMultishot)))
    this.speedMultiplier = Math.max(0.5, Math.min(2.5, s.speedMultiplier * this.bonusSpeedMul))
    this.magnetRadius = Math.max(16, Math.min(280, s.magnetRadius + this.bonusMagnet))
    this.spreadDeg = Math.max(4, Math.min(30, s.spreadDeg ?? 10))

    const has = (k: string, lvl = 1) => inv.accessories.some((a) => a.key === k && a.level >= lvl)
    const sets: string[] = []
    if (has('power-cell') && has('magnet-core')) {
      this.bulletDamage += 1
      sets.push('Core')
    }
    if (has('ammo-loader') && has('thrusters') && has('splitter')) {
      this.fireRate = Math.min(8, this.fireRate * 1.1)
      this.spreadDeg = Math.max(this.spreadDeg, 12)
      sets.push('Rapid')
    }
    this.scene.registry.set('sets-summary', sets.join(', '))
    this.events.onStatsChanged(this.getStats())
  }

  tryEvolveWeapons() {
    const inv = this.inventory
    const evolved = computeEvolution(inv.weapons, inv.accessories)
    if (evolved) {
      const base = inv.weapons.find((w) => computeEvolution([w], inv.accessories) === evolved)
      if (base && evolveWeapon(inv, base.key as any, evolved as any)) {
        this.scene.registry.set('inv', inv)
        this.scene.registry.set('inv-weapons', describeWeapons(inv))
        this.recomputeEffectiveStats()
        this.scene.registry.set('toast', `Evolved: ${evolved}!`)
      }
    }
  }

  private checkLevelProgress(currentXP: number) {
    if (currentXP < this.xpToNext) return
    this.level += 1
    this.scene.registry.set('level', this.level)
    this.scene.registry.set('xp', 0)
    this.xpToNext = Math.floor(this.xpToNext * 1.5 + 3)
    this.tryEvolveWeapons()

    const pool: LevelUpChoice[] = [
      { key: 'gold', label: 'Bounty +5 gold now', color: '#88ff88' },
      { key: 'hpmax', label: 'Hull plating +15% Max HP', color: '#66ff66' },
      { key: 'w-blaster', label: 'Upgrade Blaster', color: '#ffffff' },
      { key: 'acc-thrusters', label: 'Accessory: Thrusters', color: '#66ccff' },
      { key: 'acc-magnet-core', label: 'Accessory: Tractor Beam', color: '#33ff99' },
      { key: 'acc-ammo-loader', label: 'Accessory: Ammo Loader', color: '#ffaa66' },
      { key: 'acc-power-cell', label: 'Accessory: Power Cell', color: '#ff8866' },
      { key: 'acc-splitter', label: 'Accessory: Splitter', color: '#ccccff' },
      { key: 'w-laser', label: 'Weapon: Laser', color: '#ff66ff' },
      { key: 'w-missiles', label: 'Weapon: Missiles', color: '#ffcc66' },
      { key: 'w-orb', label: 'Weapon: Orb', color: '#66ccff' },
    ]
    Phaser.Utils.Array.Shuffle(pool)
    const choices = pool.slice(0, 3)
    this.events.onLevelUpChoices(choices)
  }

  applyLevelUpChoice(choiceKey: string) {
    if (choiceKey === 'gold') {
      this.addGold(5)
    } else if (choiceKey === 'hpmax') {
      this.ensureHpIntegrity()
      const inc = Math.max(1, Math.floor(this.hpMax * 0.15))
      this.hpMax = Math.min(99, this.hpMax + inc)
      this.hpCur = Math.min(this.hpMax, this.hpCur + inc)
      this.syncHpToRegistry()
    } else if (choiceKey.startsWith('acc-')) {
      const cleanKey = choiceKey.replace('acc-', '')
      addAccessory(this.inventory, cleanKey)
      this.scene.registry.set('inv', this.inventory)
      this.scene.registry.set('inv-accessories', describeAccessories(this.inventory))
    } else if (choiceKey.startsWith('w-')) {
      const wKey = choiceKey.replace('w-', '')
      addWeapon(this.inventory, wKey as any)
      this.scene.registry.set('inv', this.inventory)
      this.scene.registry.set('inv-weapons', describeWeapons(this.inventory))
    }
    this.recomputeEffectiveStats()
    this.events.onLevelUpApplied(choiceKey)
  }

  applyPowerupReward(): string | null {
    const owned: { kind: 'w' | 'a'; key: string; level: number }[] = []
    for (const w of this.inventory.weapons) owned.push({ kind: 'w', key: w.key, level: w.level })
    for (const a of this.inventory.accessories) owned.push({ kind: 'a', key: a.key, level: a.level })
    if (owned.length === 0) {
      this.addGold(25)
      return 'Gold +25'
    }
    const pick = Phaser.Utils.Array.GetRandom(owned)
    const isMax = pick.kind === 'w' ? pick.level >= MAX_WEAPON_LEVEL : pick.level >= MAX_ACCESSORY_LEVEL
    if (isMax) {
      if (Math.random() < 0.5) {
        this.addGold(50)
        return 'Gold +50'
      }
      this.fullHeal()
      return 'Full Heal'
    }
    if (pick.kind === 'w') {
      const w = this.inventory.weapons.find((x) => x.key === pick.key)
      if (w) w.level = Math.min(MAX_WEAPON_LEVEL, w.level + 1)
      this.scene.registry.set('inv', this.inventory)
      this.scene.registry.set('inv-weapons', describeWeapons(this.inventory))
      this.recomputeEffectiveStats()
      return `${pick.key} Lv${w?.level}`
    }
    const a = this.inventory.accessories.find((x) => x.key === pick.key)
    if (a) a.level = Math.min(MAX_ACCESSORY_LEVEL, a.level + 1)
    this.scene.registry.set('inv', this.inventory)
    this.scene.registry.set('inv-accessories', describeAccessories(this.inventory))
    this.recomputeEffectiveStats()
    return `${pick.key} Lv${a?.level}`
  }

  exportBonuses() {
    return {
      fireRateMul: this.bonusFireRateMul,
      damage: this.bonusDamage,
      multishot: this.bonusMultishot,
      speedMul: this.bonusSpeedMul,
      magnet: this.bonusMagnet,
      levelsUsed: this.bonusLevelsUsed,
      inlineExtra: this.inlineExtraProjectiles,
    }
  }

  saveBonuses() {
    this.scene.registry.set('bonuses', this.exportBonuses())
  }
}
