// Privacy Policy content - ZeyeroStars
// IMPORTANT: Yeh ek starting draft hai, legal review ke baad hi final publish karna.
// PRIVACY_LAST_UPDATED yahan se badlo jab bhi policy update karo.
//
// Pure data file - web se koi behavior change nahi, sirf .js -> .ts
// (LegalSection type add kiya taaki LegalDocModal ke sections prop se
// type-match ho).

export interface LegalSection {
  heading: string;
  body: string;
}

export const PRIVACY_LAST_UPDATED = 'October 8, 2026';

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Introduction',
    body: `ZeyeroStars ("we", "us", "our", "the Game") is a social avatar app where you can chat, customize your avatar, join rooms and communities, play mini-games, and trade virtual items with other players. This Privacy Policy explains what information we collect, how we use it, and what choices you have. By creating an account or using ZeyeroStars, you agree to this Privacy Policy.`,
  },
  {
    heading: '2. Information We Collect',
    body: `We collect the following types of information:

• Account Information: When you create an account, we collect your email address and the password you choose. Sign-in is handled through Firebase Authentication (a Google service). Your password is stored securely by Firebase - we never see or store it in readable form. We also receive a unique account identifier.

• Profile Information: Your chosen username, avatar appearance, equipped items, verified/elite status, and any bio or profile details you add.

• User Content: Messages you send in public rooms, World Chat, direct messages (DMs), message requests, feed posts, comments, and any other content you create or share inside the Game.

• Communities & Rooms Activity: Communities you create or join, your role in them (member/mod/owner), the personal room you're currently in, and your position/activity within a room.

• In-Game Activity: Your virtual currency (Z Money, Coins) balance, owned items, trade history, tips sent/received, purchases made in your personal shop listings, room activity, and mission/leaderboard progress.

• Game & Match Data: Activity and results from in-app mini-games (e.g. Bluff, Battle) you take part in, including who you played with.

• Moderation Data: Reports you file or that are filed against you (for posts, comments, messages, or users), blocks you place, and any bans, mutes, or warnings issued to your account. Messages sent in public spaces (posts, World Chat, Rooms) are automatically checked by an on-device/server filter for abusive or inappropriate language before being shown to others; this filtering is automated and does not involve a human reading your message unless it is separately reported.

• Presence Information: Whether you're currently online, and which room (if any) you're active in - shown to other players as an online-status indicator.

• Push Notification Token: If you enable notifications, we store a device push token (via Firebase Cloud Messaging) so we can deliver notifications for things like new messages, mentions, comments, and trade/tip activity. You can disable this anytime from your device settings.

• Uploaded Images & Photos: Profile pictures, room/community custom icons, photos you send in direct messages (DMs), and other images you upload are stored using Cloudflare R2 (an object storage provider). Photos sent in DMs are resized/compressed on your device before upload and are kept in private (non-public) storage; they are shown to the person you send them to through temporary secure links. We keep these files as long as your account, room/community or the related message exists, or until you replace or remove them.

• Camera & Photo Access: If you choose "Take a photo" when sending a DM photo, the app asks for camera permission and uses the camera only to capture that photo. If you choose "Photo from gallery", you pick a specific photo and only that photo is uploaded. We do not access your camera or your other photos in the background.

• Purchase Information: If you buy virtual currency or items using real money, the purchase is processed by Google Play, the Apple App Store, or another payment provider. We receive confirmation of the purchase (item, amount, transaction ID) but we do not see or store your card, UPI, or bank details — those are handled entirely by the payment provider/app store.

• Device & Usage Data: IP address, device type, operating system, app version, log/crash data, and approximate location (derived from IP) — collected automatically for security, fraud prevention, and to keep the Game running properly.

• Advertising Data: ZeyeroStars shows ads, including optional rewarded video ads where you watch an ad to earn Z Money, using Google AdMob. AdMob may collect and use your device's advertising ID (Android Advertising ID), IP address, device and app information, and information about the ads you view or interact with, to deliver, measure, and personalize ads and to prevent ad fraud. We also record how many rewarded ads you have watched each day so we can apply daily limits and give you the reward.

• Cookies & Local Storage: We use local storage on your device (e.g. to keep you logged in, and to remember choices like dismissing an in-app notice) rather than traditional browser cookies.`,
  },
  {
    heading: '3. How We Use Your Information',
    body: `We use the information above to:

• Create and manage your account, and let you sign in
• Provide core Game features - chat, Rooms, Communities, World Chat, mini-games, avatar customization, trading, shop, leaderboards
• Deliver push notifications you've opted into
• Show ads (including rewarded ads) and give you the reward for watching them, within the daily limits
• Process purchases and grant you the virtual currency/items you bought
• Automatically filter messages and posts for abusive language, and review reports filed by players
• Keep the Game safe - detect cheating, fraud, abuse, and enforce our Terms of Service, including suspending or banning accounts that violate our community guidelines
• Respond to support requests sent to us
• Improve and maintain the Game, and fix bugs
• Send you important notices about your account or the Game (e.g. policy changes, moderation actions)`,
  },
  {
    heading: '4. How We Share Your Information',
    body: `We do not sell your personal information. We only share it with:

• Service providers who help us run the Game - for example our database/hosting provider (Supabase), our file/image storage provider (Cloudflare R2, for profile pictures and other uploaded images), Google (Firebase Authentication for sign-in, Firebase Cloud Messaging for push notifications, and Google AdMob for advertising), and payment processors/app stores (for purchases). These providers only get the data needed to do their job.

• Advertising partners - Google AdMob receives device and ad-interaction data (such as your advertising ID and IP address) so it can show and measure ads. Google's use of this data is described in Google's Privacy Policy (https://policies.google.com/privacy). You can reset your advertising ID or opt out of ads personalization in your Android device settings (usually under Settings > Privacy > Ads; the exact path varies by device).

• Other players - your username, avatar, online/presence status, and anything you post or send in public spaces (Feed, World Chat, Rooms) and in DMs (including photos) is visible to the players you interact with. Please note that anyone who receives a photo from you can save it or take a screenshot, so only send photos you are comfortable sharing. Community mods/owners can also see activity and reports within their own community. Please don't share personal information with strangers in chat.

• Law enforcement or authorities - if required by law, or to protect the safety, rights, or property of ZeyeroStars, our players, or the public.

• A successor entity - if ZeyeroStars is acquired, merged, or its assets transferred, your information may be transferred as part of that deal, subject to this Privacy Policy (or a policy at least as protective).`,
  },
  {
    heading: '5. Content Moderation & Community Guidelines',
    body: `ZeyeroStars is meant to be a respectful community. Abusive language, harassment, and harmful behavior are not allowed anywhere in the Game - including posts, comments, World Chat, and Rooms. To enforce this, we:

• Automatically filter known abusive/offensive words out of messages and posts before they're shown to other players
• Allow players to report posts, comments, messages (including DM photos), or other users for review
• May suspend or permanently ban, without prior warning, any account found to violate these guidelines

Sexually explicit, nude, graphically violent, or otherwise illegal images are not allowed, including in DMs. Reported photos may be reviewed by our moderation team. Reports and moderation actions are logged against your account and may be reviewed by our moderation team.`,
  },
  {
    heading: "6. Children's Privacy",
    body: `ZeyeroStars is not directed at children under 13 (or the minimum age required in your country, if higher). We do not knowingly collect personal information from children under this age. If you believe a child has created an account or given us personal information, please contact us at the email below and we will take appropriate action, including deleting the account.`,
  },
  {
    heading: '7. Data Retention',
    body: `We keep your account and in-game data - including chat history, reports, and moderation records - for as long as your account is active. If you ask us to delete your account, we will delete or anonymize your personal information within a reasonable time, except where we are required to keep certain records (e.g. transaction records, moderation/ban records to prevent repeat abuse) for legal, accounting, or fraud-prevention purposes.`,
  },
  {
    heading: '8. Data Security',
    body: `We use reasonable technical and organizational measures to protect your information (e.g. encrypted connections, access controls). However, no system is 100% secure, and we cannot guarantee absolute security of your data.`,
  },
  {
    heading: '9. Your Rights & Choices',
    body: `Depending on where you live, you may have rights to access, correct, or delete your personal information, or to object to certain uses. You can:

• Change your username, avatar, and profile details anytime from the Game
• Block other players, and control who can send you message requests
• Turn push notifications on or off from your device settings
• Delete your account yourself from inside the Game: Settings > Delete Account
• Request a copy of your data, or ask us to delete your account if you cannot access the Game, by contacting us at the email below
• Note: deleting your account does not entitle you to a refund of any virtual currency or purchases - see our Terms of Service`,
  },
  {
    heading: '10. International Data Transfer',
    body: `Our service providers may store and process data outside your home country. By using ZeyeroStars, you consent to your information being transferred to and processed in such locations, which may have different data protection laws than your own country.`,
  },
  {
    heading: '11. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time as we add new features to the Game. If we make material changes, we will notify you in-app or by updating the "Last updated" date above. Continuing to use ZeyeroStars after changes take effect means you accept the updated policy.`,
  },
  {
    heading: '12. Contact Us',
    body: `If you have questions about this Privacy Policy or your data, contact us at:
zeyerotech@gmail.com`,
  },
];