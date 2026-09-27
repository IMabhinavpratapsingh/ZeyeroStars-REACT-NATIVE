# Run this from your project root, AFTER create-structure.ps1 has run
# Usage: .\create-files.ps1

$base = "src"

$files = @(
    # app/ (Expo Router screens)
    "$base\app\_layout.tsx"
    "$base\app\index.tsx"
    "$base\app\login.tsx"
    "$base\app\username-selection.tsx"
    "$base\app\(tabs)\_layout.tsx"
    "$base\app\(tabs)\dashboard.tsx"
    "$base\app\(tabs)\feed.tsx"
    "$base\app\(tabs)\rooms.tsx"
    "$base\app\(tabs)\profile.tsx"

    # features/dashboard (split from big Dashboard.jsx)
    "$base\features\dashboard\hooks\useDashboardBalance.ts"
    "$base\features\dashboard\hooks\useFeedState.ts"
    "$base\features\dashboard\hooks\useInboxState.ts"
    "$base\features\dashboard\hooks\useDMState.ts"
    "$base\features\dashboard\hooks\useCommunityState.ts"
    "$base\features\dashboard\hooks\useRoomState.ts"
    "$base\features\dashboard\hooks\useGameOverlays.ts"
    "$base\features\dashboard\hooks\useNotificationState.ts"
    "$base\features\dashboard\components\DashboardModals.tsx"

    # features/feed
    "$base\features\feed\components\FeedList.tsx"
    "$base\features\feed\components\CreatePostModal.tsx"
    "$base\features\feed\components\PostDetailModal.tsx"
    "$base\features\feed\components\HashtagSearchModal.tsx"
    "$base\features\feed\components\NativeAdCard.tsx"
    "$base\features\feed\components\RoomsStrip.tsx"
    "$base\features\feed\services\feedApi.ts"

    # features/rooms
    "$base\features\rooms\components\RoomFloorView.tsx"
    "$base\features\rooms\components\RoomChatWindow.tsx"
    "$base\features\rooms\components\RoomChessPanel.tsx"
    "$base\features\rooms\components\RoomNovelPanel.tsx"
    "$base\features\rooms\components\RoomRadioPlayer.tsx"
    "$base\features\rooms\components\RoomRadioModal.tsx"
    "$base\features\rooms\components\RoomItemShopModal.tsx"
    "$base\features\rooms\components\RoomInputOverlay.tsx"
    "$base\features\rooms\components\RoomsModal.tsx"
    "$base\features\rooms\components\CreateRoomModal.tsx"
    "$base\features\rooms\components\EditRoomModal.tsx"
    "$base\features\rooms\components\PlayerPreviewModal.tsx"
    "$base\features\rooms\services\roomsApi.ts"

    # features/bluff
    "$base\features\bluff\components\BluffGamePage.tsx"
    "$base\features\bluff\components\BluffLobbyScreen.tsx"
    "$base\features\bluff\components\BluffLobbyMinimizedBar.tsx"
    "$base\features\bluff\components\BluffModeSelectModal.tsx"
    "$base\features\bluff\components\BluffTableSeats.tsx"
    "$base\features\bluff\components\BluffHandTray.tsx"
    "$base\features\bluff\components\BluffActionBar.tsx"
    "$base\features\bluff\components\BluffCard.tsx"
    "$base\features\bluff\components\BluffRevealPanel.tsx"
    "$base\features\bluff\components\BluffGunDuel.tsx"
    "$base\features\bluff\hooks\useBluffLocalEngine.ts"
    "$base\features\bluff\theme\bluffTheme.ts"

    # features/chess
    "$base\features\chess\components\ChessBoard.tsx"
    "$base\features\chess\components\ChessFlow.tsx"
    "$base\features\chess\components\ChessFullScreenModal.tsx"

    # features/battle
    "$base\features\battle\components\BattlePage.tsx"
    "$base\features\battle\components\BattleGameSelectModal.tsx"
    "$base\features\battle\components\BattleMatchmakingOverlay.tsx"

    # features/communities
    "$base\features\communities\components\CommunityListScreen.tsx"
    "$base\features\communities\components\CommunityDetailScreen.tsx"
    "$base\features\communities\components\CommunityRoomScreen.tsx"
    "$base\features\communities\components\CommunityCard.tsx"
    "$base\features\communities\components\CommunityAvatar.tsx"
    "$base\features\communities\components\CommunityIconPicker.tsx"
    "$base\features\communities\components\CommunityMembersModal.tsx"
    "$base\features\communities\components\CreateCommunityModal.tsx"
    "$base\features\communities\components\EditCommunityModal.tsx"
    "$base\features\communities\components\EditCommunityRoomModal.tsx"
    "$base\features\communities\components\AdultWarningModal.tsx"
    "$base\features\communities\components\CommunityStoriesTab.tsx"
    "$base\features\communities\components\StoryCard.tsx"
    "$base\features\communities\components\StoryWriterScreen.tsx"
    "$base\features\communities\components\StoryReaderScreen.tsx"
    "$base\features\communities\components\MyStoriesScreen.tsx"
    "$base\features\communities\components\PendingStoriesScreen.tsx"
    "$base\features\communities\components\StoryModReviewScreen.tsx"
    "$base\features\communities\components\StoryModerationQueue.tsx"
    "$base\features\communities\services\communitiesApi.ts"
    "$base\features\communities\services\communityStoriesApi.ts"

    # features/novels
    "$base\features\novels\components\NovelExploreScreen.tsx"
    "$base\features\novels\components\NovelSurfScreen.tsx"
    "$base\features\novels\components\NovelWriterScreen.tsx"
    "$base\features\novels\mocks\mockNovels.ts"
    "$base\features\novels\services\novelsApi.ts"

    # features/dm
    "$base\features\dm\components\DMChatWindow.tsx"
    "$base\features\dm\components\WorldChatWindow.tsx"
    "$base\features\dm\components\InboxModal.tsx"
    "$base\features\dm\components\NotificationsModal.tsx"
    "$base\features\dm\components\SearchModal.tsx"
    "$base\features\dm\components\SettingsMenu.tsx"
    "$base\features\dm\components\ProfileViewModal.tsx"
    "$base\features\dm\components\AvatarCustomizeModal.tsx"
    "$base\features\dm\components\EditSkillsModal.tsx"
    "$base\features\dm\components\LeaderboardModal.tsx"
    "$base\features\dm\components\LimitedStoreModal.tsx"
    "$base\features\dm\components\ShopModal.tsx"
    "$base\features\dm\components\UserShopPanel.tsx"
    "$base\features\dm\components\ReportBlockModal.tsx"
    "$base\features\dm\services\dmMessagesCache.ts"

    # features/trade
    "$base\features\trade\components\TradeModal.tsx"
    "$base\features\trade\components\TradeRequestModal.tsx"
    "$base\features\trade\components\TradeItemPicker.tsx"

    # features/avatar
    "$base\features\avatar\components\AvatarBase.tsx"
    "$base\features\avatar\components\AvatarLayers.tsx"
    "$base\features\avatar\components\AvatarItemThumb.tsx"
    "$base\features\avatar\components\ZoomableAvatarView.tsx"
    "$base\features\avatar\components\EquippedItemsModal.tsx"
    "$base\features\avatar\hooks\useAvatarImage.ts"
    "$base\features\avatar\services\avatarCache.ts"
    "$base\features\avatar\utils\avatarAssets.ts"

    # features/missions
    "$base\features\missions\components\MissionsModal.tsx"
    "$base\features\missions\hooks\useMissions.ts"

    # features/legal
    "$base\features\legal\components\LegalDocModal.tsx"
    "$base\features\legal\content\privacyPolicyText.ts"
    "$base\features\legal\content\termsOfServiceText.ts"

    # shared/components
    "$base\shared\components\Header.tsx"
    "$base\shared\components\BottomNav.tsx"
    "$base\shared\components\ProfileCard.tsx"
    "$base\shared\components\RankBadge.tsx"
    "$base\shared\components\EliteBadge.tsx"
    "$base\shared\components\VerifiedBadge.tsx"
    "$base\shared\components\OnlineStatusDot.tsx"
    "$base\shared\components\RankRewardsScreen.tsx"
    "$base\shared\components\RewardedAdButton.tsx"
    "$base\shared\components\SwipeableBubble.tsx"
    "$base\shared\components\LongPressActionSheet.tsx"
    "$base\shared\components\QuickActionsSheet.tsx"
    "$base\shared\components\KebabMenu.tsx"
    "$base\shared\components\LoadingOverlay.tsx"
    "$base\shared\components\DisconnectedOverlay.tsx"
    "$base\shared\components\ErrorBoundary.tsx"
    "$base\shared\components\NotificationToast.tsx"
    "$base\shared\components\AlertPopupHost.tsx"
    "$base\shared\components\ConfirmPopupHost.tsx"
    "$base\shared\components\RulesWarningHost.tsx"
    "$base\shared\components\DailyRewardPopup.tsx"
    "$base\shared\components\EventPopupModal.tsx"
    "$base\shared\components\TipModal.tsx"
    "$base\shared\components\PopText.tsx"
    "$base\shared\components\motion\ScreenTransition.tsx"

    # shared/hooks
    "$base\shared\hooks\useWebSocket.ts"
    "$base\shared\hooks\usePresence.ts"
    "$base\shared\hooks\useNotification.ts"
    "$base\shared\hooks\useInventory.ts"
    "$base\shared\hooks\useItemsCatalog.ts"
    "$base\shared\hooks\useOwnedSkills.ts"
    "$base\shared\hooks\useSkillsCatalog.ts"
    "$base\shared\hooks\useRoomItemsCatalog.ts"
    "$base\shared\hooks\useRankCache.ts"
    "$base\shared\hooks\useRankRewards.ts"
    "$base\shared\hooks\useRewards.ts"
    "$base\shared\hooks\useUserCache.ts"
    "$base\shared\hooks\useCommunityIcon.ts"
    "$base\shared\hooks\useCachedResource.ts"
    "$base\shared\hooks\useStableCallback.ts"
    "$base\shared\hooks\useLongPress.ts"
    "$base\shared\hooks\useTopZIndex.ts"
    "$base\shared\hooks\useBackButtonHandler.ts"

    # shared/services
    "$base\shared\services\NetworkManager.ts"
    "$base\shared\services\authInterceptor.ts"
    "$base\shared\services\persistentCache.ts"
    "$base\shared\services\presenceApi.ts"
    "$base\shared\services\pushNotifications.ts"
    "$base\shared\services\adsService.ts"
    "$base\shared\services\worldChatCache.ts"
    "$base\shared\services\communityIconCache.ts"

    # shared/utils
    "$base\shared\utils\zmoney.ts"
    "$base\shared\utils\auth.ts"
    "$base\shared\utils\profileFields.ts"
    "$base\shared\utils\profileHelpers.ts"
    "$base\shared\utils\rankStyles.ts"
    "$base\shared\utils\communitySlug.ts"
    "$base\shared\utils\communityAvatarAssets.ts"
    "$base\shared\utils\roomItemAssets.ts"
    "$base\shared\utils\chessBot.ts"
    "$base\shared\utils\imageCompress.ts"
    "$base\shared\utils\renderMentions.tsx"
    "$base\shared\utils\richText.tsx"
    "$base\shared\utils\alertBus.ts"
    "$base\shared\utils\confirmBus.ts"
    "$base\shared\utils\rulesWarningBus.ts"
    "$base\shared\utils\zIndexManager.ts"
    "$base\shared\utils\svgBBox.ts"
    "$base\shared\utils\backButtonStack.ts"

    # shared/constants
    "$base\shared\constants\layout.ts"

    # shared/config
    "$base\shared\config\config.ts"
    "$base\shared\config\firebaseConfig.ts"
)

$created = 0
$skipped = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        $skipped++
    } else {
        New-Item -ItemType File -Force -Path $file | Out-Null
        $created++
    }
}

Write-Host "Files created: $created" -ForegroundColor Green
Write-Host "Already existed (skipped): $skipped" -ForegroundColor Yellow