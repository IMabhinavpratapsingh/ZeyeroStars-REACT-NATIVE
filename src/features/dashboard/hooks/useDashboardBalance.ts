import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { showAlert } from '../../../shared/utils/alertBus';

// Dashboard.jsx (web) se nikala gaya balance slice - coins + z_money aur
// unhe update karne wale saare jagah (fetch on mount, websocket balance_update
// event, ad-reward credit, trade completion).
//
// WEB -> RN CHANGE: web version mein fetchBalance(token) ko token explicitly
// pass karna padta tha (Dashboard.jsx ke andar hi token variable available
// tha). RN mein getToken() (NetworkManager in-memory cache) seedha yahin se
// use kar rahe hain, isliye caller ko token pass karne ki zaroorat nahi.
export interface Balance {
  coins: number;
  z_money: number;
}

export interface UseDashboardBalanceResult {
  balance: Balance;
  setBalance: Dispatch<SetStateAction<Balance>>;
  fetchBalance: () => Promise<void>;
  handleBalanceUpdate: (data: { z_money: number }) => void;
  handleAdRewardCredited: (newZMoney: number | null | undefined, zMoneyEarned?: number) => void;
  applyTradeBalance: (newBalance: Partial<Balance> | null | undefined) => void;
}

export default function useDashboardBalance(): UseDashboardBalanceResult {
  const [balance, setBalance] = useState<Balance>({ coins: 0, z_money: 0 });

  // App mount / login ke baad ek baar - coins aur z_money dono parallel
  // fetch karte hain.
  const fetchBalance = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [coinRes, zRes] = await Promise.all([
        axios.get(`${API_BASE}/coin/get-coin`, config),
        axios.get(`${API_BASE}/coin/get-zmoney`, config),
      ]);
      setBalance({ coins: coinRes.data.coins, z_money: zRes.data.z_money });
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, []);

  // useWebSocket ke `onBalanceUpdate` event se - sirf z_money aata hai
  // (coins websocket se update nahi hote), isliye merge karo.
  const handleBalanceUpdate = useCallback((data: { z_money: number }) => {
    setBalance((prev) => ({ ...prev, z_money: data.z_money }));
  }, []);

  // Header ke "Watch Ads" button se - rewarded ad ka reward backend claim
  // ho jaane ke baad local z_money turant update (backend hi source of
  // truth hai, yeh sirf UI reflect karta hai) + optional success toast.
  const handleAdRewardCredited = useCallback(
    (newZMoney: number | null | undefined, zMoneyEarned?: number) => {
      if (newZMoney == null) return;
      setBalance((prev) => ({ ...prev, z_money: newZMoney }));
      if (zMoneyEarned) showAlert(`You got +${zMoneyEarned} Z Money! \u{1F389}`, 'success');
    },
    []
  );

  // Trade complete hone par - new_balance sirf z_money bhejta hai (coins
  // trade mein hote hi nahi) isliye MERGE karo, poora object replace mat
  // karo warna coins undefined ho jayenge.
  const applyTradeBalance = useCallback((newBalance: Partial<Balance> | null | undefined) => {
    if (!newBalance) return;
    setBalance((prev) => ({ ...prev, ...newBalance }));
  }, []);

  return { balance, setBalance, fetchBalance, handleBalanceUpdate, handleAdRewardCredited, applyTradeBalance };
}