# Spaced Game Asset Checklist

## Backgrounds
- [ ] **Level 1 - Starfield Background** (512x512px)
  - Far layer (stars-far): 60 stars
  - Mid layer (stars-mid): 100 stars  
  - Near layer (stars-near): 160 stars
- [ ] **Level 2 - Asteroid Field Background** (512x512px)
  - Far layer (asteroids-far): 60 asteroids
  - Mid layer (asteroids-mid): 100 asteroids
  - Near layer (asteroids-near): 160 asteroids
- [ ] **Level 3 - Planet Surface Background** (256x256px)
  - Planet tile with soil texture and green river
- [ ] **Level 4 - City Background** (256x256px)
  - City tile with grid roads and buildings
- [ ] **Level 5 - Space with Sun** (256x256px)
  - Starfield layers + sun texture with radial gradient

## Player Ships
- [X] **Basic Player Ship** (8x8px)
  - White square placeholder (currently generated)
  - Should be replaced with actual ship sprite

## Enemies
- [ ] **Basic Enemy** (8x8px)
  - Red square placeholder (currently generated)
  - Should be replaced with actual enemy sprite
- [ ] **Elite Enemy Variant** (8x8px)
  - Same as basic but with different color/tint
- [ ] **Boss Enemy** (16x16px)
  - Larger version of enemy sprite
  - Used for level bosses (5 different types)

## Asteroids (Level 2 Obstacles)
- [ ] **Static Asteroid** (16x16px)
  - Gray rock with highlight
  - Immovable obstacles
- [ ] **Moving Asteroid** (16x16px)
  - Same as static but moves toward center
  - Rotates while moving

## Weapons & Projectiles
- [ ] **Blaster Bullet** (3x3px)
  - White square projectile
- [ ] **Laser Shot** (2x2px)
  - Pink/magenta square
- [ ] **Missile** (3x5px)
  - Orange/yellow rectangle
- [ ] **Orb** (8x8px)
  - Blue circle projectile
- [ ] **Beam Texture** (8x2px)
  - Pink/magenta rectangle for laser beams
- [ ] **Explosion Effect** (32x32px)
  - Radial gradient explosion

## Pickups & Items
- [ ] **XP Gem** (6x6px)
  - Blue diamond shape
- [ ] **Elite XP Gem** (6x6px)
  - Purple diamond with white glint
- [ ] **Gold Coin** (6x6px)
  - Yellow circle
- [ ] **Elite Gold Coin** (8x8px)
  - Yellow circle with star glint
- [ ] **Health Pack** (7x7px)
  - Red background with white cross
- [ ] **Power-up Chip** (8x8px)
  - Green chip with legs and center glyph

## UI Icons (10x10px each)
- [ ] **Heart Icon** - Health display
- [ ] **Coin Icon** - Gold display
- [ ] **XP Icon** - Experience display
- [ ] **Timer Icon** - Time display
- [ ] **Weapon Icon** - Generic weapon
- [ ] **Laser Weapon Icon** - Laser weapons
- [ ] **Missile Weapon Icon** - Missile weapons
- [ ] **Orb Weapon Icon** - Orb weapons
- [ ] **Accessory Icon** - Generic accessory

## Weapon Types (Need Sprites)
Based on the inventory system, these weapons need visual representations:
- [ ] **Blaster** - Basic weapon
- [ ] **Scatter Blaster** - Evolved blaster
- [ ] **Pulse Blaster** - Evolved blaster
- [ ] **Laser** - Spinning beam weapon
- [ ] **Beam Laser** - Enhanced laser
- [ ] **Missiles** - Homing projectiles
- [ ] **Cluster Missiles** - Evolved missiles
- [ ] **Orb** - Explosive orb
- [ ] **Nova Orb** - Evolved orb
- [ ] **Railgun** - High damage weapon
- [ ] **Flamethrower** - Spread fire weapon
- [ ] **Beam Arc** - Evolved railgun
- [ ] **Drones** - Companion weapons
- [ ] **Mines** - Deployable weapons
- [ ] **Boomerang** - Returning weapon
- [ ] **Shock Coil** - Electric weapon
- [ ] **Chain Lightning** - Electric chain
- [ ] **Sawblade** - Spinning weapon
- [ ] **Shotgun** - Spread shot weapon

## Accessory Types (Need Sprites)
- [ ] **Thrusters** - Speed boost
- [ ] **Magnet Core** - Pickup radius
- [ ] **Ammo Loader** - Fire rate boost
- [ ] **Power Cell** - Damage boost
- [ ] **Splitter** - Multishot boost
- [ ] **Plating** - Defense boost
- [ ] **Overclock** - Fire rate boost
- [ ] **Coolant** - Fire rate boost
- [ ] **Autoloader** - Fire rate boost
- [ ] **Targeting** - Accuracy boost

## Audio Assets
- [ ] **Background Music** - Nikkei.mp3 (already exists)
- [ ] **Weapon Sound Effects**
  - [ ] Blaster shot sounds (multiple levels)
  - [ ] Laser beam sounds
  - [ ] Missile launch sounds
  - [ ] Orb explosion sounds
- [ ] **Pickup Sound Effects**
  - [ ] XP pickup sound
  - [ ] Gold pickup sound
  - [ ] Health pickup sound
  - [ ] Power-up pickup sound
- [ ] **Game Event Sounds**
  - [ ] Level up sound
  - [ ] Boss spawn sound
  - [ ] Explosion sound
  - [ ] Player hurt sound
  - [ ] Victory sound

## Additional Visual Effects
- [ ] **Hit Sparks** (3x3px)
  - White flash on enemy hit
- [ ] **Telegraph Lines** - Boss attack indicators
- [ ] **Telegraph Circles** - Boss attack indicators
- [ ] **Screen Shake Effects** - Impact feedback
- [ ] **Particle Effects** - Various visual enhancements

## Notes
- All current assets are procedurally generated placeholders
- Player ship and enemy sprites are currently 8x8px squares
- Most UI elements are 10x10px icons
- Background tiles are 256x256px or 512x512px
- Projectiles range from 2x2px to 8x8px
- The game supports 5 levels with different themes
- Boss enemies are scaled 2x larger than regular enemies
- Elite enemies are scaled 1.15x larger than regular enemies

## Priority Order
1. **Player Ship** - Core gameplay element
2. **Basic Enemy** - Core gameplay element  
3. **Weapon Projectiles** - Core gameplay feedback
4. **Backgrounds** - Visual atmosphere
5. **Pickups** - Game progression
6. **UI Icons** - Interface clarity
7. **Boss Sprites** - Level completion
8. **Audio Effects** - Game feel
9. **Visual Effects** - Polish
