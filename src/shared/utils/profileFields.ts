// ASSUMPTION (confirm kar lena): players table me ye column names hain.
// Agar alag hain to sirf yahan badal do - poore app me automatically reflect hoga.
export const FIELD = {
  rank: 'rank',
  power: 'power',
  avatar: 'avatar_url',
  avatarVersion: 'avatar_version',
  bio: 'bio',
  equipped: 'equipped_items',
  activeSkills: 'active_skills',
  verified: 'is_verified',
  elite: 'is_elite',
} as const;

export default FIELD;