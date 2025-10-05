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
  | 'railgun'
  | 'flamethrower'
  | 'beam-arc'
  | 'drones'
  | 'mines'
  | 'boomerang'
  | 'shock-coil'
  | 'chain-lightning'
  | 'sawblade'
  | 'shotgun'
export type AccessoryKey =
  | 'thrusters'
  | 'magnet-core'
  | 'ammo-loader'
  | 'power-cell'
  | 'splitter'
  | 'plating'
  | 'overclock'
  | 'coolant'
  | 'autoloader'
  | 'targeting'

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
    if (level >= 3) stats.inlineExtraProjectiles += 1
    if (level >= 5) stats.inlineExtraProjectiles += 1
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
  if (weaponKey === 'railgun') {
    stats.bulletDamage += 2 + level
    stats.fireRate *= 0.7
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 4)
  }
  if (weaponKey === 'flamethrower') {
    stats.bulletDamage += Math.max(0, level)
    stats.fireRate *= 1.6
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 18)
  }
  if (weaponKey === 'beam-arc') {
    stats.bulletDamage += 1 + level
    stats.fireRate *= 1.2
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 8)
  }
  if (weaponKey === 'drones') {
    stats.bulletDamage += Math.max(0, level)
    stats.fireRate *= 1.1
  }
  if (weaponKey === 'mines') {
    stats.bulletDamage += 1 + level
    stats.fireRate *= 0.9
  }
  if (weaponKey === 'boomerang') {
    stats.bulletDamage += Math.max(0, level)
    stats.fireRate *= 1.0
  }
  if (weaponKey === 'shock-coil') {
    stats.bulletDamage += Math.max(0, level)
    stats.fireRate *= 1.2
  }
  if (weaponKey === 'chain-lightning') {
    stats.bulletDamage += 1 + level
    stats.fireRate *= 1.0
  }
  if (weaponKey === 'sawblade') {
    stats.bulletDamage += 1 + level
    stats.fireRate *= 0.95
  }
  if (weaponKey === 'shotgun') {
    stats.bulletDamage += Math.max(0, level)
    stats.multishot += 2
    stats.spreadDeg = Math.max(stats.spreadDeg ?? 10, 20)
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
      stats.multishot += 1 * level  // +1 projectile per level for spread pattern
      break
    case 'plating':
      // handled indirectly by HP elsewhere (placeholder)
      break
    case 'overclock':
      stats.fireRate *= Math.pow(1.07, level)
      break
    case 'coolant':
      stats.fireRate *= Math.pow(1.05, level)
      break
    case 'autoloader':
      stats.fireRate *= Math.pow(1.06, level)
      break
    case 'targeting':
      stats.spreadDeg = Math.max((stats.spreadDeg ?? 10) - 1 * level, 4)
      break
    // Armor-like accessory: plating — reduce incoming damage by 1 at key thresholds (handled in scene)
  }
}

export type SynergyRule = {
  base: WeaponKey
  requires: { accessories?: { key: AccessoryKey; level: number }[]; weaponLevel?: number }
  evolvesTo: WeaponKey
}

export const synergyMatrix: SynergyRule[] = [
  {
    base: 'blaster',
    requires: { weaponLevel: 5, accessories: [{ key: 'splitter', level: 5 }, { key: 'power-cell', level: 5 }] },
    evolvesTo: 'scatter-blaster',
  },
  {
    base: 'blaster',
    requires: { weaponLevel: 5, accessories: [{ key: 'ammo-loader', level: 5 }, { key: 'thrusters', level: 5 }] },
    evolvesTo: 'pulse-blaster',
  },
  {
    base: 'laser',
    requires: { weaponLevel: 5, accessories: [{ key: 'magnet-core', level: 5 }] },
    evolvesTo: 'beam-laser',
  },
  {
    base: 'missiles',
    requires: { weaponLevel: 5, accessories: [{ key: 'splitter', level: 5 }] },
    evolvesTo: 'cluster-missiles',
  },
  {
    base: 'orb',
    requires: { weaponLevel: 5, accessories: [{ key: 'power-cell', level: 5 }] },
    evolvesTo: 'nova-orb',
  },
  {
    base: 'railgun',
    requires: { weaponLevel: 5, accessories: [{ key: 'targeting', level: 5 }] },
    evolvesTo: 'beam-arc',
  },
  {
    base: 'shotgun',
    requires: { weaponLevel: 5, accessories: [{ key: 'splitter', level: 5 }, { key: 'autoloader', level: 5 }] },
    evolvesTo: 'scatter-blaster',
  },
  {
    base: 'missiles',
    requires: { weaponLevel: 5, accessories: [{ key: 'targeting', level: 5 }, { key: 'overclock', level: 5 }] },
    evolvesTo: 'cluster-missiles',
  },
]

export function computeEvolution(
  weapons: { key: WeaponKey; level: number }[],
  accessories: { key: string; level: number }[]
): WeaponKey | null {
  for (const rule of synergyMatrix) {
    const w = weapons.find((x) => x.key === rule.base)
    if (!w) continue
    if (rule.requires.weaponLevel && w.level < rule.requires.weaponLevel) continue
    const need = rule.requires.accessories ?? []
    const ok = need.every((req) => accessories.some((a) => a.key === req.key && a.level >= req.level))
    if (!ok) continue
    return rule.evolvesTo
  }
  return null
}


