import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from './NetworkManager';

const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

// Google Play purchase token backend ko bhejta hai verify karne ke liye
export const verifyVerifiedSubscription = (purchaseToken: string) =>
  axios.post(
    `${API_BASE}/api/verify-verified-subscription`,
    { purchase_token: purchaseToken },
    authConfig()
  );