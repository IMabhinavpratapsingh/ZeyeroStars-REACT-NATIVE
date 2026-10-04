import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';

type Id = number | string;

// NEW FILE (web mein yeh calls Dashboard.jsx / SearchModal.jsx ke andar
// inline axios se hoti thi) - ab ek jagah, taaki hooks (useFeedState waghera)
// aur SearchModal dono isi ko use karein.

const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

// Response: { posts, has_more }
// scope: 'global' (saari posts) ya 'joined' (sirf meri joined communities ki
// posts - backend khud community ids nikal ke sirf unhi ki posts deta hai).
export type FeedScope = 'global' | 'joined';

export const getFeedPosts = (offset = 0, limit = 10, scope: FeedScope = 'global') =>
  axios.get(`${API_BASE}/feed/posts`, {
    ...authConfig(),
    params: { offset, limit, ...(scope === 'joined' ? { scope } : {}) },
  });

// Profile ke Posts tab ke liye - kisi ek user ki posts, naye pehle.
// Response: { posts, has_more }
export const getUserPosts = (userId: Id, offset = 0, limit = 10) =>
  axios.get(`${API_BASE}/feed/user/${userId}/posts`, { ...authConfig(), params: { offset, limit } });

// Notification tap par sirf post_id milta hai - response: { post }
export const getPost = (postId: Id) => axios.get(`${API_BASE}/feed/post/${postId}`, authConfig());

// Post ki photo pehle alag upload hoti hai (backend compress + webp karta hai),
// response: { image_url } - phir wahi URL createPost ko dete hain.
// RN mein File/Blob nahi hota - { uri, name, type } object chahiye
// (imageCompress.ts ka toUploadFormPart() yehi banata hai).
// NOTE: Content-Type manually mat set karna - axios/RN boundary khud lagata hai.
export type PostImageFile = { uri: string; name: string; type: string };

export const uploadPostImage = (file: PostImageFile) => {
  const formData = new FormData();
  formData.append('file', file as any);
  return axios.post(`${API_BASE}/feed/upload-image`, formData, authConfig());
};

// /feed/create/post plain QUERY PARAMS leta hai (JSON body nahi) - body null.
export const createPost = ({
  content,
  communityId,
  hashtag,
  imageUrl,
}: {
  content: string;
  communityId: Id;
  hashtag?: string | null;
  imageUrl?: string | null;
}) =>
  axios.post(`${API_BASE}/feed/create/post`, null, {
    ...authConfig(),
    params: {
      content,
      community_id: communityId,
      hashtag: hashtag || undefined,
      image_url: imageUrl || undefined,
    },
  });

// Response: { liked, likes }
export const togglePostLike = (postId: Id) =>
  axios.post(`${API_BASE}/feed/toggle_like/post`, null, { ...authConfig(), params: { post_id: postId } });

// Apna khud ka post (author-only endpoint). Kisi aur ka post mod-power se
// hatana ho to communitiesApi.removeCommunityPost() use karo.
export const deletePost = (postId: Id) => axios.delete(`${API_BASE}/feed/post/${postId}`, authConfig());

// Response: { posts, has_more } - SearchModal 30 limit se, HashtagSearchModal 10 se call karta hai.
export const searchHashtagPosts = (query: string, offset = 0, limit = 10) =>
  axios.get(`${API_BASE}/feed/hashtag/search`, { ...authConfig(), params: { query, offset, limit } });

// Response: { comments, has_more }
// (web mein yeh call bina Authorization ke thi - ab token ke saath jaati hai, harmless.)
export const getComments = (postId: Id, offset = 0, limit = 30) =>
  axios.get(`${API_BASE}/feed/comments/${postId}`, { ...authConfig(), params: { offset, limit } });

// Comment like/unlike - Response: { liked, likes } (togglePostLike jaisa hi).
// Query param: comment_id.
export const toggleCommentLike = (commentId: Id) =>
  axios.post(`${API_BASE}/feed/toggle_like/comment`, null, { ...authConfig(), params: { comment_id: commentId } });

export const addComment = ({
  postId,
  content,
  parentCommentId,
}: {
  postId: Id;
  content: string;
  parentCommentId?: Id | null;
}) =>
  axios.post(`${API_BASE}/feed/comment`, null, {
    ...authConfig(),
    params: {
      post_id: postId,
      content,
      ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
    },
  });

// Comment delete par uske replies backend mein cascade delete ho jaate hain.
export const deleteComment = (commentId: Id) => axios.delete(`${API_BASE}/feed/comment/${commentId}`, authConfig());

// Post views - feed mein jab post screen par dikhe to batch mein bhejte hain
// (postViewTracker.ts). Body: { post_ids: [..] }. Backend har (user, post) ka
// view sirf EK baar count kare (unique viewer) - client bhi session mein dedupe karta hai.
export const recordPostViews = (postIds: Id[]) =>
  axios.post(`${API_BASE}/feed/posts/views`, { post_ids: postIds }, authConfig());