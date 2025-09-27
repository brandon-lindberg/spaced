export type WeaponKey =
  | 'blaster'
  | 'scatter-blaster'
  | 'pulse-blaster'
  | 'laser'
  | 'beam-laser'
  | 'missiles'
  | 'cluster-missiles'
  | 'orb'
  | 'nova-orb'
export type AccessoryKey = 'thrusters' | 'magnet-core' | 'ammo-loader' | 'power-cell' | 'splitter'

export interface BaseStats {
  fireRate: number
  bulletDamage: number
  multishot: number
  speedMultiplier: number
  magnetRadius: number
  spreadDeg?: number
}

export interface EffectiveStats extends BaseStats {}

export const defaultBaseStats: BaseStats = {
  fireRate: 1.2,
  bulletDamage: 1,
  multishot: 1,
  speedMultiplier: 1,
  magnetRadius: 16,
  spreadDeg: 10,
}

export function applyWeaponLevel(stats: EffectiveStats, weaponKey: WeaponKey, level: number) {
  if (weaponKey === 'blaster') {
    stats.bulletDamage += Math.max(0, level - 1) // +1 per level after Lv1
    if (level >= 3) stats.multishot += 1
    if (level >= 5) stats.multishot += 1
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 10)
  }
  if (weaponKey === 'scatter-blaster') {
    stats.bulletDamage += Math.max(0, level - 1)
    stats.multishot += 2 // baseline extra spread fire
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 18)
  }
  if (weaponKey === 'pulse-blaster') {
    stats.bulletDamage += Math.max(0, level - 1)
    stats.fireRate *= 1.5
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 8)
  }
  if (weaponKey === 'laser') {
    stats.bulletDamage += Math.max(0, level)
    stats.fireRate *= 1.35
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 6)
  }
  if (weaponKey === 'beam-laser') {
    stats.bulletDamage += Math.max(0, level + 1)
    stats.fireRate *= 1.75
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 4)
  }
  if (weaponKey === 'missiles') {
    stats.bulletDamage += Math.max(0, level + 1)
    stats.fireRate *= 0.75
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 12)
  }
  if (weaponKey === 'cluster-missiles') {
    stats.bulletDamage += Math.max(0, level + 1)
    stats.multishot += 1
    stats.fireRate *= 0.85
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 14)
  }
  if (weaponKey === 'orb') {
    stats.bulletDamage += Math.max(0, level)
    stats.fireRate *= 0.85
  }
  if (weaponKey === 'nova-orb') {
    stats.bulletDamage += Math.max(0, level + 1)
    stats.fireRate *= 1.0
  }
}

export function applyAccessoryLevel(stats: EffectiveStats, accKey: AccessoryKey, level: number) {
  switch (accKey) {
    case 'thrusters':
      stats.speedMultiplier += 0.1 * level
      break
    case 'magnet-core':
      stats.magnetRadius += 24 * level
      break
    case 'ammo-loader':
      stats.fireRate *= Math.pow(1.15, level)
      break
    case 'power-cell':
      stats.bulletDamage += 1 * level
      break
    case 'splitter':
      stats.multishot += 1 * level
      break
  }
}


