import Phaser from 'phaser'

export function safeGroupChildren(group?: Phaser.GameObjects.Group | Phaser.Physics.Arcade.Group) {
  const anyGroup = group as { children?: { entries?: Phaser.GameObjects.GameObject[] } } | undefined
  if (!anyGroup || !anyGroup.children || !anyGroup.children.entries) return []
  return anyGroup.children.entries as Phaser.GameObjects.GameObject[]
}

export function setCircleHitbox(sprite: Phaser.Physics.Arcade.Sprite, radius: number) {
  const body = sprite.body as Phaser.Physics.Arcade.Body | null
  if (!body) return
  const scaleX = Math.abs(sprite.scaleX) > 0 ? Math.abs(sprite.scaleX) : 1
  const scaleY = Math.abs(sprite.scaleY) > 0 ? Math.abs(sprite.scaleY) : 1
  const effectiveScale = Math.min(scaleX, scaleY)
  const sourceRadius = radius / effectiveScale
  const frameWidth = sprite.frame?.realWidth ?? sourceRadius * 2
  const frameHeight = sprite.frame?.realHeight ?? sourceRadius * 2
  const offsetX = frameWidth / 2 - sourceRadius
  const offsetY = frameHeight / 2 - sourceRadius
  body.setCircle(sourceRadius, offsetX, offsetY)
}
