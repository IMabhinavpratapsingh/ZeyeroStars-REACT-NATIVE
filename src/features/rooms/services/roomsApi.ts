import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';

// RN mein web ka File/Blob nahi hota - upload ke liye { uri, name, type }
// object chahiye (imageCompress.ts ka toUploadFormPart() yehi banata hai).
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

export const createRoom = (roomName: string) =>
  axios.post(`${API_BASE}/rooms/create`, { room_name: roomName }, authConfig());

export const getMyRoom = () => axios.get(`${API_BASE}/rooms/my`, authConfig());

// === Room card edit (pencil button - custom image + name) ===
// Icon upload Verified/Elite-only hai (backend re-checks), naam change
// sabke liye free hai (jaisa create ke waqt tha).
// NOTE: Content-Type manually mat set karna - axios/RN boundary khud lagata hai.
export const uploadRoomIcon = (file: UploadFile) =>
  axios.post(`${API_BASE}/rooms/icon/upload`, buildFormData(file), authConfig());

export const updateRoomIcon = (iconUrl: string) =>
  axios.post(`${API_BASE}/rooms/icon/update`, { icon_url: iconUrl }, authConfig());

// === Room floor BACKGROUND (Verified/Elite only, same gated pattern as
// the icon above) - poore room floor ka background, room card ke chhote
// icon se alag. ===
export const uploadRoomBackground = (file: UploadFile) =>
  axios.post(`${API_BASE}/rooms/background/upload`, buildFormData(file), authConfig());

export const updateRoomBackground = (bgUrl: string) =>
  axios.post(`${API_BASE}/rooms/background/update`, { bg_url: bgUrl }, authConfig());

export const updateRoomName = (roomName: string) =>
  axios.post(`${API_BASE}/rooms/name/update`, { room_name: roomName }, authConfig());

// === Chat-only mode (owner-only) - floor/avatar-grid hide karke room ko
// ek plain group-chat jaisa bana deta hai. ===
export const updateChatOnly = (chatOnly: boolean) =>
  axios.post(`${API_BASE}/rooms/chat-only/update`, { chat_only: chatOnly }, authConfig());

export const getActiveRooms = () => axios.get(`${API_BASE}/rooms/active`, authConfig());

export const getAllRooms = () => axios.get(`${API_BASE}/rooms/all`, authConfig());

export const searchRadioStations = (name: string) =>
  axios.get(`${API_BASE}/rooms/radio/search`, { ...authConfig(), params: { name } });


