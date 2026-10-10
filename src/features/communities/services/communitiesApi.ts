import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { createCachedResource } from '../../../shared/services/persistentCache';

type Id = number | string;
// RN mein web ka File/Blob nahi hota - { uri, name, type } object chahiye
// (imageCompress.ts ka toUploadFormPart()).
type UploadFile = { uri: string; name: string; type: string };

const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const buildFormData = (file: UploadFile) => {
  const formData = new FormData();
  formData.append('file', file as any);
  return formData;
};

// === Icon upload (Verified/Elite only - backend re-checks this every time) ===
export const uploadCommunityIcon = (file: UploadFile) =>
  axios.post(`${API_BASE}/communities/icon/upload`, buildFormData(file), authConfig());

// === CRUD / discovery ===
export const createCommunity = ({
  name,
  description,
  category,
  icon_id,
  icon_url,
}: {
  name: string;
  description?: string;
  category?: string;
  icon_id?: string | number | null;
  icon_url?: string | null;
}) => axios.post(`${API_BASE}/communities/create`, { name, description, category, icon_id, icon_url }, authConfig());

export const updateCommunity = (
  communityId: Id,
  {
    description,
    category,
    icon_id,
    icon_url,
  }: {
    description?: string;
    category?: string;
    icon_id?: string | number | null;
    icon_url?: string | null;
  }
) =>
  axios.post(`${API_BASE}/communities/${communityId}/update`, { description, category, icon_id, icon_url }, authConfig());

export const listCommunities = (offset = 0, limit = 20, category: string | null = null) =>
  axios.get(`${API_BASE}/communities/list`, {
    ...authConfig(),
    params: { offset, limit, category: category || undefined },
  });

// Communities the current user has already joined - used to populate
// the "New Post" composer's community picker as soon as the app loads
// (not just ones joined live during this session).
export const listMyCommunities = () => axios.get(`${API_BASE}/communities/mine`, authConfig());

export const searchCommunities = (query: string, offset = 0, limit = 20) =>
  axios.get(`${API_BASE}/communities/search`, { ...authConfig(), params: { query, offset, limit } });

export const getCommunity = (communityId: Id) => axios.get(`${API_BASE}/communities/${communityId}`, authConfig());

// Z(community-name) mentions resolve through this - slug client-side wahi
// derive hota hai jaise backend create par karta hai (lowercase, non-alnum
// -> "-"), dekho shared/utils/communitySlug.ts.
export const getCommunityBySlug = (slug: string) =>
  axios.get(`${API_BASE}/communities/by-slug/${encodeURIComponent(slug)}`, authConfig());

// === Membership ===
export const joinCommunity = (communityId: Id) =>
  axios.post(`${API_BASE}/communities/${communityId}/join`, {}, authConfig());

export const leaveCommunity = (communityId: Id) =>
  axios.post(`${API_BASE}/communities/${communityId}/leave`, {}, authConfig());

export const listCommunityMembers = (communityId: Id, offset = 0, limit = 30) =>
  axios.get(`${API_BASE}/communities/${communityId}/members`, { ...authConfig(), params: { offset, limit } });

// === Community feed ===
export const getCommunityFeed = (communityId: Id, offset = 0, limit = 10) =>
  axios.get(`${API_BASE}/communities/${communityId}/feed`, { ...authConfig(), params: { offset, limit } });

// === Mod-only actions ===
export const removeCommunityPost = (postId: Id) =>
  axios.delete(`${API_BASE}/communities/posts/${postId}`, authConfig());

export const banCommunityMember = (communityId: Id, targetUserId: Id) =>
  axios.post(`${API_BASE}/communities/${communityId}/ban/${targetUserId}`, {}, authConfig());

export const promoteToMod = (communityId: Id, targetUserId: Id) =>
  axios.post(`${API_BASE}/communities/${communityId}/promote/${targetUserId}`, {}, authConfig());

export const demoteMod = (communityId: Id, targetUserId: Id) =>
  axios.post(`${API_BASE}/communities/${communityId}/demote/${targetUserId}`, {}, authConfig());


// === Cached resources (feed/inbox jaisa hi AsyncStorage-backed cache) ===
// CommunityListScreen har baar khulne par purana data turant dikhata hai
// (agar hydrate ho chuka hai), background me silently revalidate hota hai.
const COMMUNITIES_PAGE_SIZE = 20;
const COMMUNITIES_CACHE_TTL_MS = 45_000;

// "All" tab ki sirf FIRST page cache hoti hai (search results kabhi cache
// nahi hote) - sab users ke liye same data hai, isliye userScoped nahi.
function fetchCommunitiesFirstPage() {
  return listCommunities(0, COMMUNITIES_PAGE_SIZE).then((res) => ({
    list: res.data?.communities || [],
    hasMore: !!res.data?.has_more,
  }));
}

export const communitiesResource = createCachedResource({
  key: 'communities',
  fetchFn: fetchCommunitiesFirstPage,
  ttlMs: COMMUNITIES_CACHE_TTL_MS,
});

// "My Communities" - per-account (userScoped: true, logout par clear).
function fetchMyCommunitiesFirstPage() {
  return listMyCommunities().then((res) => ({
    list: res.data?.communities || [],
  }));
}

export const myCommunitiesResource = createCachedResource({
  key: 'my_communities',
  fetchFn: fetchMyCommunitiesFirstPage,
  userScoped: true,
  ttlMs: COMMUNITIES_CACHE_TTL_MS,
});