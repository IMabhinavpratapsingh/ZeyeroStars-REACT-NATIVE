import React, { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import useWebSocket from '../../../shared/hooks/useWebSocket';
import { PersistentSlide } from '../../../shared/components/motion/ScreenTransition';
import useGameOverlays from '../../dashboard/hooks/useGameOverlays';
import { subscribeOpenGame, setGameActive, requestCloseAllForGame, subscribeCloseGameMenus } from '../../../shared/utils/gameOverlayBus';
import { setFullscreenOverlayOpen } from '../../../shared/utils/fullscreenOverlayBus';
import { showAlert } from '../../../shared/utils/alertBus';
import { getMyId } from '../../../shared/utils/auth';
import BattleGameSelectModal from './BattleGameSelectModal';
import BattlePage from './BattlePage';
import ChessFullScreenModal from '../../chess/components/ChessFullScreenModal';
import BluffModeSelectModal from '../../bluff/components/BluffModeSelectModal';
import BluffLobbyScreen from '../../bluff/components/BluffLobbyScreen';
import BluffLobbyMinimizedBar from '../../bluff/components/BluffLobbyMinimizedBar';
import BluffGamePage from '../../bluff/components/BluffGamePage';
import MatchFoundLoading from './MatchFoundLoading';

// GameOverlayScreen - "Game" bottom-nav tab. Rooms/DM ki tarah hi ek
// PERSISTENT, self-contained overlay - hamesha mounted rehta hai
// (`(tabs)/_layout.tsx` mein), apna poora Battle + Bluff Court state
// khud `useGameOverlays()` (Dashboard.jsx ke us section ka port) se
// rakhta hai. BottomNav ka "Game" icon route/prop se nahi, balki
// `gameOverlayBus` (navOverlayBus jaisa hi pattern) se isse "toggle karo"
// bolta hai - waisa hi indirection jaisa Rooms/DM ke liye navOverlayBus
// use hota hai, taaki BottomNav ko is state ka seedha maalik na hona pade.
export default function GameOverlayScreen() {
  // Game shuru hote hi Rooms/DM/Shop/Profile/Communities/Search/... sab band -
  // unka owner `(tabs)/_layout.tsx` hai, wahi gameOverlayBus se sunke band karta hai.
  const closeOtherScreensForGameStart = useCallback(() => {
    requestCloseAllForGame();
  }, []);

  const game = useGameOverlays({ showToast: (m) => showAlert(m, 'info'), closeOtherScreensForGameStart });
  useWebSocket(game.wsHandlers);

  // `game.openBattleGameSelect()` khud hi decide karta hai: agar select
  // screen already khuli hai to band karo, agar minimized Bluff lobby hai
  // to usi par wapas jaao, warna select screen kholo (bilkul Dashboard.jsx
  // ke handleBattleButtonClick jaisa) - GameOverlayScreen bas is decision
  // ko bus se trigger karwata hai.
  useEffect(() => subscribeOpenGame(() => {
    game.openBattleGameSelect();
  }), [game]);

  // Home/Rooms/DM/... dabane par game menus band.
  useEffect(() => subscribeCloseGameMenus(game.closeGameMenus), [game.closeGameMenus]);

  useEffect(() => {
    setGameActive(game.isGameActive);
  }, [game.isGameActive]);

  // Actual match/table full-screen hote hi Header/BottomNav dono chhupa do
  // (PostDetailModal jaisa hi fullscreenOverlayBus).
  useEffect(() => {
    const isFullscreenMatch = game.battleActive || game.showBluffGamePage || !!game.matchFound;
    setFullscreenOverlayOpen(isFullscreenMatch);
    return () => setFullscreenOverlayOpen(false);
  }, [game.battleActive, game.showBluffGamePage, game.matchFound]);

  return (
    <>
      <PersistentSlide show={game.showBattleGameSelect} style={styles.screen}>
        <BattleGameSelectModal
          show={game.showBattleGameSelect}
          onClose={game.closeBattleGameSelect}
          onSelectChess={game.selectChessFromBattle}
          onSelectRanked={game.selectRankedBattle}
          onSelectUnranked={game.selectUnrankedBattle}
          onSelectBluff={game.openBluffModeSelect}
          matchmakingSearching={game.matchmakingSearching}
          onCancelMatchmaking={() => game.toggleMatchmaking()}
        />
      </PersistentSlide>

      <ChessFullScreenModal show={game.showChessFullScreen} onClose={game.closeChessFullScreen} />

      <BluffModeSelectModal
        show={game.showBluffModeSelect}
        onClose={game.closeBluffModeSelect}
        onHost={game.bluffHostCreate}
        onJoinCode={game.bluffJoinByCode}
        onQuickJoin={game.bluffQuickJoin}
      />

      <BluffLobbyScreen
        show={game.showBluffLobbyScreen}
        lobby={game.bluffLobby}
        myId={getMyId()}
        onMinimize={game.minimizeBluffLobby}
        onLeave={game.leaveBluffLobby}
        onStart={game.startBluffLobby}
      />

      <BluffLobbyMinimizedBar
        show={!!game.bluffLobby && !game.showBluffLobbyScreen}
        lobby={game.bluffLobby}
        onReopen={game.reopenBluffLobby}
      />

      <BluffGamePage
        show={game.showBluffGamePage}
        match={game.bluffMatch}
        selfProfile={game.bluffSelfProfile}
        opponentAvatars={game.bluffOpponentAvatars}
        onClose={game.closeBluffGame}
        onPlayCards={game.bluffPlayCards}
        onAccuse={game.bluffAccuse}
      />

      <BattlePage
        show={game.battleActive}
        myProfile={game.myBattleProfile}
        opponentProfile={game.opponentBattleProfile}
        mySkillData={game.mySkillData}
        opponentSkillData={game.opponentSkillData}
        myHp={game.myHp}
        opponentHp={game.opponentHp}
        phase={game.battlePhase}
        selectionTime={game.selectionTime}
        roundKey={game.roundKey}
        roundResult={game.roundResult}
        matchEndData={game.matchEndData}
        mySkillCooldowns={game.mySkillCooldowns}
        onSubmitSkill={game.submitBattleSkill}
        onClose={game.closeBattle}
      />

      <MatchFoundLoading show={!!game.matchFound} kind={game.matchFound} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
});