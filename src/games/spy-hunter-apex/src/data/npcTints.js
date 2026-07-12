export const NPC_TINTS = [
  0xe53935,
  0xfb8c00,
  0xfdd835,
  0x43a047,
  0x00acc1,
  0x1e88e5,
  0x8e24aa,
  0xd81b60,
  0x6d4c41,
];

export const NPC_TINT_BY_ROLE = {
  civilian: NPC_TINTS,
  enemy: [0xe53935, 0xd81b60, 0x8e24aa],
  support: [0x1e88e5, 0x00acc1, 0x43a047],
  decoy: [0x8e24aa, 0xd81b60, 0xfb8c00],
};

export function pickNpcTint(role, index = 0) {
  const palette = NPC_TINT_BY_ROLE[role] ?? NPC_TINTS;
  return palette[index % palette.length];
}
