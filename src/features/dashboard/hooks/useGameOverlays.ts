import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import networkManager, { getToken } from '../../../shared/services/NetworkManager';
import { getMyId } from '../../../shared/utils/auth';
import { FIELD } from '../../../shared/utils/profileFields';
import { getEquippedByCategory } from '../../../shared/utils/profileHelpers';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';
import type { WebSocketHandlers } from '../../../shared/hooks/useWebSocket';

// WEB -> RN: Dashboard.jsx ke "Battle state" + "Bluff Court state" block
// (aur unke saare handlers) ka port - ek dedicated hook mein, taaki
// GameOverlayScreen (naya persistent overlay, (tabs)/_layout.tsx se
// khulta hai) isse seedha consume kar sake, bilkul useDMState/
// useCommunityState jaisa hi pattern. `wsHandlers` GameOverlayScreen
// khud `useWebSocket()` ko pass karta hai.
//
// `showToast`/`showScreenLoading` yahan simple no-op-able optional
// callbacks hain - GameOverlayScreen apna chhota local toast/loading state
// pass karta hai (Dashboard.jsx ke showTradeToast/showScreenLoading jaisa).

interface UseGameOverlaysArgs {
  showToast: (message: string) => void;
  closeOtherScreensForGameStart: () => void;
}

export default function useGameOverlays({ showToast, closeOtherScreensForGameStart }: UseGameOverlaysArgs) {
  const { itemsById } = useItemsCatalog();

  // ---- Battle state ----
  const [matchmakingSearching, setMatchmakingSearching] = useState(false);
  const [showBattleGameSelect, setShowBattleGameSelect] = useState(false);
  const [showChessFullScreen, setShowChessFullScreen] = useState(false);
  const [battleActive, setBattleActive] = useState(false);
  const [battlePhase, setBattlePhase] = useState<'selecting' | 'locked' | 'round_over' | 'result' | 'ended'>('selecting');
  const [myBattleProfile, setMyBattleProfile] = useState<any>(null);
  const [opponentBattleProfile, setOpponentBattleProfile] = useState<any>(null);
  const [mySkillData, setMySkillData] = useState<any[]>([]);
  const [opponentSkillData, setOpponentSkillData] = useState<any[]>([]);
  const [myHp, setMyHp] = useState(300);
  const [opponentHp, setOpponentHp] = useState(300);
  const [selectionTime, setSelectionTime] = useState(20);
  const [roundKey, setRoundKey] = useState(0);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [mySkillCooldowns, setMySkillCooldowns] = useState<Record<string, number>>({});
  const [matchEndData, setMatchEndData] = useState<any>(null);

  // ---- Bluff Court state ----
  const [showBluffModeSelect, setShowBluffModeSelect] = useState(false);
  const [bluffLobby, setBluffLobby] = useState<any>(null);
  const [showBluffLobbyScreen, setShowBluffLobbyScreen] = useState(false);
  const [showBluffGamePage, setShowBluffGamePage] = useState(false);
  const [bluffMatch, setBluffMatch] = useState<any>(null);
  const [bluffSelfProfile, setBluffSelfProfile] = useState<any>(null);
  const [bluffOpponentAvatars, setBluffOpponentAvatars] = useState<Record<string, any>>({});
  const bluffAvatarPendingRef = useRef<Set<string>>(new Set());

  const ensureBluffOpponentAvatar = useCallback(
    (userId: string | number | null | undefined) => {
      if (!userId || String(userId) === String(getMyId())) return;
      const key = String(userId);
      if (bluffOpponentAvatars[key] || bluffAvatarPendingRef.current.has(key)) return;
      bluffAvatarPendingRef.current.add(key);
      const token = getToken();
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      axios
        .get(`${API_BASE}/profile/${userId}`, config)
        .then((res) => {
          setBluffOpponentAvatars((prev) => ({
            ...prev,
            [key]: {
              equippedByCategory: getEquippedByCategory(res.data?.[FIELD.equipped], itemsById),
              photoUrl: res.data?.[FIELD.avatar],
            },
          }));
        })
        .catch(() => {})
        .finally(() => {
          bluffAvatarPendingRef.current.delete(key);
        });
    },
    [bluffOpponentAvatars, itemsById]
  );

  const applyBluffState = useCallback(
    (data: any) => {
      (data.players || []).forEach((p: any) => {
        const pid = p.user_id ?? p.id ?? p.userId;
        ensureBluffOpponentAvatar(pid);
      });

      setBluffMatch((prev: any) => ({
        tableId: data.table_id,
        yourSeat: data.your_seat,
        yourHand: data.your_hand,
        callSigil: data.call_sigil,
        currentTurnSeat: data.current_turn_seat,
        pileCount: data.pile_count,
        phase: data.phase,
        round: data.round,
        players: data.players,
        settings: data.settings,
        lastActorSeat: data.last_actor_seat !== undefined ? data.last_actor_seat : (prev ? prev.lastActorSeat : null),
        timedOut: !!data.timed_out,
        reveal: data.reveal || null,
        gameOver: prev ? prev.gameOver : null,
      }));
    },
    [ensureBluffOpponentAvatar]
  );

  const fetchBluffSelfProfile = useCallback(() => {
    const token = getToken();
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    axios
      .get(`${API_BASE}/profile/${getMyId()}`, config)
      .then((res) => {
        setBluffSelfProfile({
          username: res.data?.username,
          equippedByCategory: getEquippedByCategory(res.data?.[FIELD.equipped], itemsById),
          photoUrl: res.data?.[FIELD.avatar],
        });
      })
      .catch(() => {});
  }, [itemsById]);

  // ---- Battle handlers ----
  const handleMatchmakingError = useCallback(
    (data: any) => {
      setMatchmakingSearching(false);
      showToast(data.message || 'Could not join battle.');
    },
    [showToast]
  );

  const handleMatchFound = useCallback((data: any) => {
    setMatchmakingSearching(false);
    setBattleActive(false);
    setBattlePhase('selecting');
    setRoundResult(null);
    setMatchEndData(null);
    setMySkillCooldowns({});
    networkManager.send({ type: 'ready', room_id: data.room_id });
  }, []);

  const handleSetupRoom = useCallback(
    (data: any) => {
      setMyBattleProfile(data.my_profile);
      setOpponentBattleProfile(data.opponent_profile);
      setMySkillData(data.my_skill_data || []);
      setOpponentSkillData(data.opponent_skill_data || []);
      setMyHp(300);
      setOpponentHp(300);
      setRoundResult(null);
      setMatchEndData(null);
      setMySkillCooldowns({});
      setBattlePhase('selecting');
      setBattleActive(true);
      closeOtherScreensForGameStart();
      networkManager.send({ type: 'setup_complete' });
    },
    [closeOtherScreensForGameStart]
  );

  const handleBattleStart = useCallback((data: any) => {
    setSelectionTime(data.selection_time || 20);
    setRoundKey((k) => k + 1);
    setRoundResult(null);
    setBattlePhase('selecting');
  }, []);

  const handleRoundOver = useCallback(() => {
    setBattlePhase((prev) => (prev === 'ended' ? prev : 'round_over'));
  }, []);

  const handleRoundResult = useCallback((data: any) => {
    setMyHp(data.my_hp);
    setOpponentHp(data.opponent_hp);
    setRoundResult({
      round: data.round,
      my_action: data.my_action,
      opponent_action: data.opponent_action,
      my_effect: data.my_effect,
      opponent_effect: data.opponent_effect ?? data.oppoenent_effect,
    });
    setMySkillCooldowns(data.my_cooldowns || {});
    setBattlePhase('result');
  }, []);

  const handleSkillOnCooldown = useCallback(
    (data: any) => {
      showToast(`This skill is on cooldown for ${data.rounds_left} more round(s).`);
    },
    [showToast]
  );

  const handleMatchEnd = useCallback((data: any) => {
    setMatchEndData(data);
    setBattlePhase('ended');
  }, []);

  const toggleMatchmaking = useCallback(
    (mode: 'ranked' | 'unranked' = 'ranked') => {
      if (!networkManager.isConnected()) {
        showToast('No connection, reconnecting...');
        networkManager.reconnect();
        return;
      }
      if (matchmakingSearching) {
        networkManager.send({ type: 'cancel_matchmaking' });
        setMatchmakingSearching(false);
      } else {
        networkManager.send({ type: 'matchmaking', mode });
        setMatchmakingSearching(true);
      }
    },
    [matchmakingSearching, showToast]
  );

  const submitBattleSkill = useCallback(
    (skillId: string | number | null) => {
      const sent = networkManager.send({ type: 'submit_skill', skill_id: skillId });
      if (!sent) showToast('Could not submit skill - check your connection.');
      setBattlePhase('locked');
    },
    [showToast]
  );

  const closeBattle = useCallback(() => {
    setBattleActive(false);
    setBattlePhase('selecting');
    setMyBattleProfile(null);
    setOpponentBattleProfile(null);
    setMySkillData([]);
    setOpponentSkillData([]);
    setMyHp(300);
    setOpponentHp(300);
    setRoundResult(null);
    setMatchEndData(null);
    setMySkillCooldowns({});
  }, []);

  // ---- Game button (BottomNav "Game") ----
  const openBattleGameSelect = useCallback(() => {
    if (showBattleGameSelect) {
      setShowBattleGameSelect(false);
      return true;
    }
    if (bluffLobby) {
      setShowBluffLobbyScreen((prev) => !prev);
      return true;
    }
    setShowBattleGameSelect(true);
    return false;
  }, [showBattleGameSelect, bluffLobby]);

  const closeBattleGameSelect = useCallback(() => setShowBattleGameSelect(false), []);

  const selectChessFromBattle = useCallback(() => {
    setShowBattleGameSelect(false);
    closeOtherScreensForGameStart();
    setShowChessFullScreen(true);
  }, [closeOtherScreensForGameStart]);

  const closeChessFullScreen = useCallback(() => setShowChessFullScreen(false), []);

  const selectRankedBattle = useCallback(() => {
    setShowBattleGameSelect(false);
    toggleMatchmaking('ranked');
  }, [toggleMatchmaking]);

  const selectUnrankedBattle = useCallback(() => {
    setShowBattleGameSelect(false);
    toggleMatchmaking('unranked');
  }, [toggleMatchmaking]);

  // ---- Bluff Court (Host/Join-by-code lobby -> live table) ----
  const openBluffModeSelect = useCallback(() => {
    setShowBattleGameSelect(false);
    if (bluffLobby) {
      setShowBluffLobbyScreen(true);
      return;
    }
    if (!networkManager.isConnected()) {
      showToast('No connection, reconnecting...');
      networkManager.reconnect();
      return;
    }
    fetchBluffSelfProfile();
    setShowBluffModeSelect(true);
  }, [bluffLobby, fetchBluffSelfProfile, showToast]);

  const closeBluffModeSelect = useCallback(() => setShowBluffModeSelect(false), []);

  const bluffHostCreate = useCallback((isPublicLobby: boolean) => {
    networkManager.send({ type: 'bluff_host_create', is_public: isPublicLobby });
  }, []);

  const bluffJoinByCode = useCallback((code: string) => {
    networkManager.send({ type: 'bluff_join_by_code', code });
  }, []);

  const bluffQuickJoin = useCallback(() => {
    networkManager.send({ type: 'bluff_quick_join' });
  }, []);

  const leaveBluffLobby = useCallback(() => {
    networkManager.send({ type: 'bluff_lobby_leave' });
  }, []);

  const startBluffLobby = useCallback(() => {
    networkManager.send({ type: 'bluff_lobby_start' });
  }, []);

  const minimizeBluffLobby = useCallback(() => setShowBluffLobbyScreen(false), []);
  const reopenBluffLobby = useCallback(() => setShowBluffLobbyScreen(true), []);

  const handleBluffLobbyCreated = useCallback((data: any) => {
    setBluffLobby(data);
    setShowBluffModeSelect(false);
    setShowBluffLobbyScreen(true);
  }, []);

  const handleBluffLobbyUpdate = useCallback(
    (data: any) => {
      setBluffLobby((prev: any) => {
        const justJoined = !prev;
        if (justJoined) {
          setShowBluffModeSelect(false);
          setShowBluffLobbyScreen(true);
        }
        return data;
      });
    },
    []
  );

  const handleBluffLobbyLeft = useCallback(() => {
    setBluffLobby(null);
    setShowBluffLobbyScreen(false);
  }, []);

  const handleBluffMatchFound = useCallback(
    (data: any) => {
      setBluffLobby(null);
      setShowBluffLobbyScreen(false);
      setShowBluffModeSelect(false);
      applyBluffState(data);
      closeOtherScreensForGameStart();
      setShowBluffGamePage(true);
    },
    [applyBluffState, closeOtherScreensForGameStart]
  );

  const handleBluffGameOver = useCallback((data: any) => {
    setBluffMatch((prev: any) => (prev ? { ...prev, gameOver: data } : prev));
  }, []);

  const handleBluffError = useCallback(
    (data: any) => {
      showToast(data.message || 'Bluff Court error.');
    },
    [showToast]
  );

  const bluffPlayCards = useCallback((indexes: number[]) => {
    networkManager.send({ type: 'bluff_play', indexes });
  }, []);

  const bluffAccuse = useCallback(() => {
    networkManager.send({ type: 'bluff_accuse' });
  }, []);

  const closeBluffGame = useCallback(() => {
    networkManager.send({ type: 'bluff_leave_table' });
    setShowBluffGamePage(false);
    setBluffMatch(null);
  }, []);

  const wsHandlers: WebSocketHandlers = {
    onMatchFound: handleMatchFound,
    onMatchmakingError: handleMatchmakingError,
    onSetupRoom: handleSetupRoom,
    onBattleStart: handleBattleStart,
    onRoundOver: handleRoundOver,
    onRoundResult: handleRoundResult,
    onMatchEnd: handleMatchEnd,
    onSkillOnCooldown: handleSkillOnCooldown,
    onBluffMatchFound: handleBluffMatchFound,
    onBluffPlayUpdate: applyBluffState,
    onBluffTurnSkipped: applyBluffState,
    onBluffReveal: applyBluffState,
    onBluffNewRound: applyBluffState,
    onBluffPlayerLeft: applyBluffState,
    onBluffGameOver: handleBluffGameOver,
    onBluffError: handleBluffError,
    onBluffLobbyCreated: handleBluffLobbyCreated,
    onBluffLobbyUpdate: handleBluffLobbyUpdate,
    onBluffLobbyLeft: handleBluffLobbyLeft,
  };

  return {
    // Battle
    matchmakingSearching,
    showBattleGameSelect,
    showChessFullScreen,
    battleActive,
    battlePhase,
    myBattleProfile,
    opponentBattleProfile,
    mySkillData,
    opponentSkillData,
    myHp,
    opponentHp,
    selectionTime,
    roundKey,
    roundResult,
    mySkillCooldowns,
    matchEndData,
    openBattleGameSelect,
    closeBattleGameSelect,
    selectChessFromBattle,
    closeChessFullScreen,
    selectRankedBattle,
    selectUnrankedBattle,
    toggleMatchmaking,
    submitBattleSkill,
    closeBattle,

    // Bluff
    showBluffModeSelect,
    bluffLobby,
    showBluffLobbyScreen,
    showBluffGamePage,
    bluffMatch,
    bluffSelfProfile,
    bluffOpponentAvatars,
    openBluffModeSelect,
    closeBluffModeSelect,
    bluffHostCreate,
    bluffJoinByCode,
    bluffQuickJoin,
    leaveBluffLobby,
    startBluffLobby,
    minimizeBluffLobby,
    reopenBluffLobby,
    bluffPlayCards,
    bluffAccuse,
    closeBluffGame,

    // combined
    isGameActive: showBattleGameSelect || showChessFullScreen || battleActive || showBluffModeSelect || showBluffLobbyScreen || showBluffGamePage,
    wsHandlers,
  };
}
