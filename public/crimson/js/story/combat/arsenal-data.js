export const LOADOUT = ['fists', 'pistol', 'goldenEagle', 'ak47', 'katana', 'baseballBat', 'bearSpray'];
export const GUNS = {
  pistol: { name: 'PISTOL', damage: 32, range: 65, magazine: 12, reserve: 96, interval: 0.3, reload: 1.35, recoil: 0.025, spread: 0.013 },
  goldenEagle: { name: 'GOLDEN EAGLE', damage: 75, range: 85, magazine: 7, reserve: 42, interval: 0.65, reload: 1.8, recoil: 0.06, spread: 0.017 },
  ak47: { name: 'AK-47', damage: 25, range: 95, magazine: 30, reserve: 180, interval: 0.11, reload: 2.1, recoil: 0.018, spread: 0.024, automatic: true },
  bearSpray: { name: 'BEAR SPRAY', damage: 0, range: 7, magazine: 40, reserve: 120, interval: 0.14, reload: 1.6, recoil: 0, spread: 0, automatic: true, spray: true },
};
export function raySphere(origin, direction, center, radius) {
  const offsetX = center.x - origin.x, offsetY = center.y - origin.y, offsetZ = center.z - origin.z;
  const along = offsetX * direction.x + offsetY * direction.y + offsetZ * direction.z;
  const closest = offsetX ** 2 + offsetY ** 2 + offsetZ ** 2 - along ** 2;
  if (closest > radius ** 2) return Infinity;
  const edge = Math.sqrt(Math.max(0, radius ** 2 - closest));
  return along + edge < 0 ? Infinity : Math.max(0, along - edge);
}
export function reloadMagazine(ammo, capacity) {
  const transfer = Math.min(capacity - ammo.loaded, ammo.reserve);
  ammo.loaded += transfer; ammo.reserve -= transfer;
}
