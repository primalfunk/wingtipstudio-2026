import { WEAPON_DEFINITIONS, WEAPON_TIERS, getWeaponDefinition } from './weapons/weaponDefinitions.js';

export { WEAPON_TIERS };

export const WEAPON_TYPES = WEAPON_DEFINITIONS;

export function getWeapon(weaponType) {
  return getWeaponDefinition(weaponType);
}
