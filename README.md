# RIDDLOVA Telegram Runtime

Standalone Telegram bot backend for the independent RIDDLOVA game brand. No other existing Telegram bot accounts, models or services are overwritten.

## Verified features
- Telegram Bot API long polling; no public webhook or paid API required
- 11 UI language preferences and translated essential bot onboarding
- /start, /play, /daily, /lang, /stats, /invite, /notify, /stop, /privacy, /forget, /paysupport, /support
- Profile name, description, command menu, public Mini App launcher, avatar via Telegram Bot API 10.3
- One-time RIDDLOVA+ pack: 10 expert games unlocked by 25 Telegram Stars (XTR)
- Verified pre_checkout_query, successful_payment charge-id deduplication, SQLite entitlement
- Channel post only when configured with an owned channel whose title includes RIDDLOVA; at most once a day
- Voluntary daily opt-in alerts, no unsolicited messages
- Localhost-only /health status; no customer database made public

## BotFather activation: required account-owner registration
Telegram's official API cannot create a NEW bot account or owner channel on its own. The Telegram account owner must register a new bot using the verified @BotFather and choose a unique username ending in bot. Suggested display name: RIDDLOVA | Brain Arena. Suggested username: RiddlovaBot, if available. Do not paste the bot token into chats or Git repositories.

The bot token must be stored in a protected VPS runtime environment under the sole operator's control. RIDDLOVA_ENABLE_STARS must remain 0 until the test invoice, support path, successful-payment fulfillment and Stars redemption requirements are checked.

## Channel setup
- Title: RIDDLOVA | Daily Brain Arena
- Description: One new brain mission every day. Logic, numbers, memory, reflex and community highlights. Play free. No fake news, no spam. 🌍🎮
- Avatar: assets/riddlova-avatar.png
- Only an authorized Telegram account can create the channel. Add the new RIDDLOVA bot as a channel administrator with posting rights. Store its @username or chat ID in RIDDLOVA_CHANNEL_ID.

## Security and operation
Run with Node 24 or newer and an isolated PM2 process. The bot and channel must remain disconnected until valid credentials have been installed. No sensitive logs. Use HTTPS for the public game UI, Telegram polling for bot updates, SQLite for purchases and opt-in reminders. Never run under an account belonging to another project. Payments for digital goods inside Telegram use only Stars (XTR); there is no guarantee of EUR conversion or payouts. Users can submit /paysupport requests and exercise /forget; legally required transaction data may need to be retained.

## Current public Mini App
https://kitz-labs.github.io/riddlova-arena/

## Start and tests
npm test
npm start

## Environment variables
See .env.example for variables. The example does not contain live credentials.
