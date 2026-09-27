// JS twin of backend's community_service._slugify - same rule
// (lowercase, non-alphanumeric runs collapsed to a single "-", trimmed),
// so a slug built here always matches what the server generated at
// community creation time. Used both by the Z(name) mention parser
// (renderMentions.tsx) and by the community search box.
export function slugifyCommunityName(name: string | null | undefined): string {
  return (
    String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'community'
  );
}

export default slugifyCommunityName;