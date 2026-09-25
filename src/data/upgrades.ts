/** Permanent upgrades bought in the HANGAR; they only apply to rogue runs. */
export type UpgradeId = 'hull' | 'cannon' | 'coolant' | 'thrusters' | 'deflector' | 'salvage' | 'insight';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** Short effect per level, shown in the hangar (fits the menu width). */
  desc: string;
  /** Price of each level; the number of levels is `costs.length`. */
  costs: readonly number[];
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'hull', name: 'HULL', desc: '+1 STARTING SHIP', costs: [600, 1800] },
  { id: 'cannon', name: 'CANNON', desc: '+1 BOLT ON SCREEN', costs: [400, 1200] },
  { id: 'coolant', name: 'COOLANT', desc: 'FIRE RATE +10%', costs: [300, 900, 2000] },
  { id: 'thrusters', name: 'THRUSTERS', desc: 'SPEED +8%', costs: [250, 750] },
  { id: 'deflector', name: 'DEFLECTOR', desc: 'SHIELD EACH WORLD', costs: [1500] },
  { id: 'salvage', name: 'SALVAGE', desc: 'CREDITS +15%', costs: [500, 1500, 3000] },
  { id: 'insight', name: 'INSIGHT', desc: '+1 DRAFT REROLL', costs: [1000, 2500] },
];

export const UPGRADE_EFFECT = {
  coolantPerLevel: 0.1,
  thrustersPerLevel: 0.08,
  salvagePerLevel: 0.15,
} as const;
