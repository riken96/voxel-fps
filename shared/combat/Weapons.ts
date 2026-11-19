export enum WeaponId {
  ASSAULT_RIFLE = 1,
  SNIPER_RIFLE = 2,
  SHOTGUN = 3,
  PISTOL = 4
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  category: 'primary' | 'secondary';
  fireRateMs: number;       // Min delay between shots in ms
  magazineSize: number;     // Ammo per clip
  reserveAmmo: number;      // Total reserve ammo
  reloadTimeMs: number;     // Duration of reload in ms
  damageBody: number;       // Damage per bullet hitting body
  damageHead: number;       // Damage per bullet hitting head
  headshotMultiplier: number; // Headshot multiplier (e.g. 1.5x)
  pelletCount: number;      // Number of raycast pellets (1 for rifle, 8 for shotgun)
  spread: number;           // Base cone spread in radians
  recoilPitch: number;      // Visual & aim camera pitch kick in radians
  recoilYaw: number;        // Random horizontal recoil
  range: number;            // Max raycast range in meters
  isAutomatic: boolean;     // Can hold mouse button to fire continuously
  adsZoom: number;          // FOV multiplier when aiming down sights (e.g. 0.6 for zoom)
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  [WeaponId.ASSAULT_RIFLE]: {
    id: WeaponId.ASSAULT_RIFLE,
    name: 'Assault Rifle',
    category: 'primary',
    fireRateMs: 110,         // ~545 RPM
    magazineSize: 30,
    reserveAmmo: 120,
    reloadTimeMs: 1800,
    damageBody: 24,
    damageHead: 38,
    headshotMultiplier: 1.58,
    pelletCount: 1,
    spread: 0.015,
    recoilPitch: 0.024,
    recoilYaw: 0.012,
    range: 120,
    isAutomatic: true,
    adsZoom: 0.75
  },

  [WeaponId.SNIPER_RIFLE]: {
    id: WeaponId.SNIPER_RIFLE,
    name: 'Sniper Rifle',
    category: 'primary',
    fireRateMs: 950,
    magazineSize: 3,
    reserveAmmo: 15,
    reloadTimeMs: 2400,
    damageBody: 85,
    damageHead: 160,        // One-shot kill on headshot!
    headshotMultiplier: 1.88,
    pelletCount: 1,
    spread: 0.002,          // Pinpoint accuracy
    recoilPitch: 0.09,
    recoilYaw: 0.02,
    range: 250,
    isAutomatic: false,
    adsZoom: 0.35           // High-powered scope zoom
  },

  [WeaponId.SHOTGUN]: {
    id: WeaponId.SHOTGUN,
    name: 'Voxel Shotgun',
    category: 'primary',
    fireRateMs: 750,
    magazineSize: 5,
    reserveAmmo: 25,
    reloadTimeMs: 2200,
    damageBody: 14,         // 8 pellets * 14 = 112 dmg if all hit body
    damageHead: 20,
    headshotMultiplier: 1.42,
    pelletCount: 8,
    spread: 0.075,          // Wide spread
    recoilPitch: 0.08,
    recoilYaw: 0.035,
    range: 45,
    isAutomatic: false,
    adsZoom: 0.85
  },

  [WeaponId.PISTOL]: {
    id: WeaponId.PISTOL,
    name: 'Sidearm Pistol',
    category: 'secondary',
    fireRateMs: 180,
    magazineSize: 10,
    reserveAmmo: 40,
    reloadTimeMs: 1200,
    damageBody: 18,
    damageHead: 30,
    headshotMultiplier: 1.66,
    pelletCount: 1,
    spread: 0.02,
    recoilPitch: 0.03,
    recoilYaw: 0.015,
    range: 80,
    isAutomatic: false,
    adsZoom: 0.82
  }
};

export function getWeaponDef(id: WeaponId): WeaponDefinition {
  return WEAPON_DEFINITIONS[id] || WEAPON_DEFINITIONS[WeaponId.ASSAULT_RIFLE];
}
