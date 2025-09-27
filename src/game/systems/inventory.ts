export const MAX_WEAPONS = 5
export const MAX_ACCESSORIES = 5

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

export interface WeaponInstance {
  key: WeaponKey
  level: number
}

export interface AccessoryInstance {
  key: string
  level: number
}

export interface InventoryState {
  weapons: WeaponInstance[]
  accessories: AccessoryInstance[]
}

export function createInventory(): InventoryState {
  return { weapons: [], accessories: [] }
}

export function addWeapon(inv: InventoryState, key: WeaponKey): boolean {
  const found = inv.weapons.find((w) => w.key === key)
  if (found) {
    found.level += 1
    return true
  }
  if (inv.weapons.length >= MAX_WEAPONS) return false
  inv.weapons.push({ key, level: 1 })
  return true
}

export function evolveWeapon(inv: InventoryState, fromKey: WeaponKey, toKey: WeaponKey): boolean {
  const idx = inv.weapons.findIndex((w) => w.key === fromKey)
  if (idx === -1) return false
  inv.weapons.splice(idx, 1)
  inv.weapons.push({ key: toKey, level: 1 })
  return true
}

export function addAccessory(inv: InventoryState, key: string): boolean {
  const found = inv.accessories.find((a) => a.key === key)
  if (found) {
    found.level += 1
    return true
  }
  if (inv.accessories.length >= MAX_ACCESSORIES) return false
  inv.accessories.push({ key, level: 1 })
  return true
}

export function describeWeapons(inv: InventoryState): string {
  if (inv.weapons.length === 0) return '—'
  return inv.weapons.map((w) => `${capitalize(w.key)} Lv${w.level}`).join(', ')
}

export function describeAccessories(inv: InventoryState): string {
  if (inv.accessories.length === 0) return '—'
  return inv.accessories.map((a) => `${capitalize(a.key)} Lv${a.level}`).join(', ')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


