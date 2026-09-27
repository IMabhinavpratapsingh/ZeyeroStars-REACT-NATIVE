import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from './NetworkManager';

const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

// Google Play purchase token backend ko bhejta hai verify + z_money credit karne ke liye
export const verifyZMoneyPurchase = (productId: string, purchaseToken: string) =>
  axios.post(
    `${API_BASE}/api/verify-purchase`,
    { product_id: productId, purchase_token: purchaseToken },
    authConfig()
  );