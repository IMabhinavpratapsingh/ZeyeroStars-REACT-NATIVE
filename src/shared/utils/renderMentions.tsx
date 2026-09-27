import React from 'react';
import { Text } from 'react-native';
import { slugifyCommunityName } from './communitySlug';

const MENTION_REGEX = /@(\w+)/g;
// Reddit's "r/name" but with our own marker: Z(community name) - name is
// whatever's between the parens (spaces allowed, no nested parens), shown
// exactly as typed; slug (for the actual lookup/navigation) is derived
// from it the same way the backend derives it at creation time.
const COMMUNITY_REGEX = /Z\(([^()\n]{1,50})\)/g;

type Match = { type: 'mention' | 'community'; index: number; end: number; text: string };

// RN CHANGE: web version returned raw <span> nodes (block-level ok inside
// any container). RN has no <span> - every piece of text, including the
// plain segments, must be wrapped in <Text>. Caller must render the
// returned array INSIDE a parent <Text> (RN allows nesting <Text> inside
// <Text>), e.g.: <Text>{renderWithMentions(content, myUsername, onPress)}</Text>
//
// Merges both marker types into a single ordered scan so overlapping/
// adjacent matches don't fight each other, then renders each as plain
// text or a highlighted <Text> span.
export function renderWithMentions(
  content: string | null | undefined,
  myUsername: string | null | undefined,
  onCommunityPress?: (slug: string, communityName: string) => void
): React.ReactNode {
  if (!content) return content;

  const matches: Match[] = [];
  let m: RegExpExecArray | null;

  const mentionRe = new RegExp(MENTION_REGEX);
  while ((m = mentionRe.exec(content)) !== null) {
    matches.push({ type: 'mention', index: m.index, end: mentionRe.lastIndex, text: m[1] });
  }

  const communityRe = new RegExp(COMMUNITY_REGEX);
  while ((m = communityRe.exec(content)) !== null) {
    matches.push({ type: 'community', index: m.index, end: communityRe.lastIndex, text: m[1].trim() });
  }

  if (!matches.length) return content;

  // Sort by position; on overlap (shouldn't normally happen given the
  // two patterns are disjoint) keep the earlier/longer match.
  matches.sort((a, b) => a.index - b.index || (b.end - b.index) - (a.end - a.index));

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of matches) {
    if (match.index < lastIndex) continue; // skip overlaps
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    if (match.type === 'mention') {
      const mentionedName = match.text;
      const isMe = !!myUsername && mentionedName.toLowerCase() === myUsername.toLowerCase();
      parts.push(
        <Text
          key={`mention-${key++}`}
          style={
            isMe
              ? { fontWeight: 'bold', color: '#fde68a', backgroundColor: 'rgba(234,179,8,0.1)' }
              : { fontWeight: 'bold', color: '#818cf8' }
          }
        >
          @{mentionedName}
        </Text>
      );
    } else {
      const communityName = match.text;
      const slug = slugifyCommunityName(communityName);
      parts.push(
        <Text
          key={`community-${key++}`}
          onPress={onCommunityPress ? () => onCommunityPress(slug, communityName) : undefined}
          style={{ fontWeight: '600', color: '#ffb37a', backgroundColor: 'rgba(255, 179, 122, 0.12)' }}
        >
          Z({communityName})
        </Text>
      );
    }

    lastIndex = match.end;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

export default renderWithMentions;