import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from './NetworkManager';

const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

// Ek saath kai user_ids ka online/offline status - {status: {user_id: bool}}
export const getPresenceStatus = (userIds: (string | number)[]) =>
  axios.get(`${API_BASE}/presence/status`, {
    ...authConfig(),
    params: { ids: userIds.join(',') },
  });