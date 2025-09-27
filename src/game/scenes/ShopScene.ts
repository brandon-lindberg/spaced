import Phaser from 'phaser'
import { addAccessory, addWeapon, createInventory, describeAccessories, describeWeapons, MAX_ACCESSORY_LEVEL, MAX_WEAPON_LEVEL } from '../systems/inventory'
import type { InventoryState } from '../systems/inventory'
import { runState } from '../systems/runState'

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop')
  }

  create() {
    const { width, height } = this.scale
    this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0,0)
    const frame = this.add.graphics()
    frame.lineStyle(2, 0x444466, 1)
    frame.strokeRect(6, 6, width - 12, height - 12)
    this.add.text(width / 2, 12, 'Between-level Shop', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' }).setOrigin(0.5,0)

    const rowYStart = 40
    const colXLeft = 20
    const colXRight = width - 20

    const goldText = this.add.text(colXRight, 16, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffcc66' }).setOrigin(1,0)
    const invText = this.add.text(colXLeft, height - 36, '', { fontFamily: 'monospace', fontSize: '10px', color: '#cccccc' })

    const getGold = () => (this.registry.get('gold') as number) || 0
    const setGold = (n: number) => this.registry.set('gold', Math.max(0, Math.floor(n)))
    const updateHUD = () => {
      goldText.setText(`Gold: ${getGold()}`)
      const inv = (this.registry.get('inv') as InventoryState) || createInventory()
      invText.setText(`W: ${describeWeapons(inv)}\nA: ${describeAccessories(inv)}`)
    }
    updateHUD()

    // Pricing curves
    const price = {
      weapon: (level: number) => 30 + level * 20, // 30,50,70,90,110
      accessory: (level: number) => 25 + level * 15, // 25,40,55,70,85
      healFull: 60,
      reroll: 25,
    }

    const button = (x: number, y: number, label: string, onClick: () => void, tooltip?: string, iconKey?: string) => {
      const r = this.add.rectangle(x, y, 160, 16, 0x222233, 1).setOrigin(0,0).setInteractive({ useHandCursor: true })
      const t = this.add.text(x + 20, y + 3, label, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      if (iconKey) this.add.rectangle(x + 8, y + 8, 8, 8, 0x9999cc, 1).setOrigin(0.5) // placeholder icon block; replace with preloaded sprites
      let tip: Phaser.GameObjects.Text | null = null
      r.on('pointerover', () => r.setFillStyle(0x333355, 1))
      r.on('pointerout', () => r.setFillStyle(0x222233, 1))
      if (tooltip) {
        r.on('pointerover', () => { tip = this.add.text(x + 144, y, tooltip!, { fontFamily: 'monospace', fontSize: '9px', color: '#cccccc', backgroundColor: '#000000', padding: { x: 3, y: 1 } }) })
        r.on('pointerout', () => { tip?.destroy(); tip = null })
      }
      r.on('pointerdown', () => { onClick(); updateHUD() })
      return { r, t }
    }

    // Offer 3 random upgrades among owned items each visit
    const offerUpgrades = () => {
      const inv = (this.registry.get('inv') as InventoryState) || createInventory()
      const owned: { kind: 'w' | 'a'; key: string; level: number }[] = []
      for (const w of inv.weapons) if (w.level < MAX_WEAPON_LEVEL) owned.push({ kind: 'w', key: w.key, level: w.level })
      for (const a of inv.accessories) if (a.level < MAX_ACCESSORY_LEVEL) owned.push({ kind: 'a', key: a.key, level: a.level })
      Phaser.Utils.Array.Shuffle(owned)
      const picks = owned.slice(0, 3)
      let y = rowYStart
      picks.forEach((p) => {
        const cost = p.kind === 'w' ? price.weapon(p.level) : price.accessory(p.level)
        const label = `${p.kind === 'w' ? 'Upgrade Weapon' : 'Upgrade Acc'} ${p.key} (Lv${p.level}->${p.level + 1}) - ${cost}`
        const tip = p.kind === 'w' ? 'Increase damage/rate based on weapon type' : 'Boost passive stats'
        const icon = p.kind === 'w' ? 'icon-weapon' : 'icon-acc'
        button(colXLeft, y, label, () => {
          if (getGold() < cost) return
          setGold(getGold() - cost)
          if (p.kind === 'w') addWeapon(inv, p.key as any)
          else addAccessory(inv, p.key)
          this.registry.set('inv', inv)
          updateHUD()
        }, tip, icon)
        y += 20
      })
    }
    offerUpgrades()

    // Utility: Full heal and reroll
    button(colXRight - 140, rowYStart, `Full Heal (${price.healFull})`, () => {
      if (getGold() < price.healFull) return
      setGold(getGold() - price.healFull)
      const game = this.scene.get('Game') as any
      if (game) {
        game.hpCur = game.hpMax
        this.registry.set('hp', { cur: game.hpCur, max: game.hpMax })
      }
    })
    button(colXRight - 140, rowYStart + 22, `Reroll (${price.reroll})`, () => {
      if (getGold() < price.reroll) return
      setGold(getGold() - price.reroll)
      this.scene.restart()
    })

    // Continue to next level
    button(width / 2 - 70, height - 18, 'Continue', () => {
      const next = (runState.state?.level ?? 1) + 1
      runState.startLevel(next, this.time.now)
      this.scene.start('Game')
      this.scene.launch('HUD')
    })

    // If slots open, offer to buy new random item
    const inv = (this.registry.get('inv') as InventoryState) || createInventory()
    if (inv.weapons.length < 5) {
      button(colXLeft, height - 42, 'Buy new weapon (80)', () => {
        if (getGold() < 80) return
        setGold(getGold() - 80)
        // Placeholder new weapon pool
        const pool = ['laser','missiles','orb','railgun','shotgun']
        const key = Phaser.Utils.Array.GetRandom(pool) as any
        addWeapon(inv, key)
        this.registry.set('inv', inv)
        updateHUD()
      }, 'Add a new weapon up to 5 max', 'icon-weapon')
    }
    if (inv.accessories.length < 5) {
      button(colXLeft + 170, height - 42, 'Buy new accessory (60)', () => {
        if (getGold() < 60) return
        setGold(getGold() - 60)
        const pool = ['thrusters','magnet-core','ammo-loader','power-cell','splitter','overclock','coolant','autoloader','targeting']
        const key = Phaser.Utils.Array.GetRandom(pool)
        addAccessory(inv, key)
        this.registry.set('inv', inv)
        updateHUD()
      }, 'Add a new accessory up to 5 max', 'icon-acc')
    }
  }
}


