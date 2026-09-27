// Rank 1-80, 8 tiers of 10. Rank ka shine color/animation yahin se decide
// hota hai - isliye rank ke naam/colors kahin bhi badalne ho to sirf yahan
// badlo, poore app me sab jagah automatically update ho jayega.
const TIERS = [
  // Bronze ko thoda aur soft/light brown diya hai taaki metallic lage
  { max: 10, name: 'Bronze', slug: 'bronze', color: '#A97142', glow: 'rgba(169,113,66,0.6)' },
  { max: 20, name: 'Emerald', slug: 'emerald', color: '#10b981', glow: 'rgba(16,185,129,0.7)' },
  { max: 30, name: 'Verdant', slug: 'verdant', color: '#84cc16', glow: 'rgba(132,204,22,0.65)' },
  { max: 40, name: 'Azure', slug: 'azure', color: '#3b82f6', glow: 'rgba(59,130,246,0.65)' },
  { max: 50, name: 'Aqua', slug: 'aqua', color: '#06b6d4', glow: 'rgba(6,182,212,0.65)' },
  { max: 60, name: 'Solar', slug: 'solar', color: '#facc15', glow: 'rgba(250,204,21,0.75)' },
  // Inferno ko deep orange/reddish rakha hai, Crimson ko bilkul bright red
  { max: 70, name: 'Inferno', slug: 'inferno', color: '#FF4500', glow: 'rgba(255,69,0,0.8)' },
  { max: 80, name: 'Crimson', slug: 'crimson', color: '#ff0000', glow: 'rgba(255,0,0,0.9)' },
] as const;

export interface RankStyle {
  color: string;
  glow: string;
  tierName: string;
  tierSlug: string;
}

export const getRankStyle = (rank: number | string): RankStyle => {
  const r = Number(rank);
  const tier = TIERS.find((t) => r <= t.max) || TIERS[TIERS.length - 1];
  return { color: tier.color, glow: tier.glow, tierName: tier.name, tierSlug: tier.slug };
};

export default getRankStyle;