/**
 * RIDDLOVA Telegram Bot + channel scheduler + Stars unlock
 * Node 24, node:sqlite, zero runtime packages, long-polling.
 * No unsolicited messages: only channel opted in by owner + /notify subscribers.
 */
import {createServer} from "node:http";
import {createHmac, timingSafeEqual} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {readFileSync, mkdirSync, existsSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const TOKEN=process.env.TELEGRAM_BOT_TOKEN||"";
const WEB_URL=process.env.RIDDLOVA_WEB_URL||"https://kitz-labs.github.io/riddlova-arena/";
const CHANNEL=process.env.RIDDLOVA_CHANNEL_ID||"";
const ADMIN=process.env.RIDDLOVA_ADMIN_CHAT_ID||"";
const SHOP=process.env.RIDDLOVA_ENABLE_STARS==="1"&&!!TOKEN&&!!ADMIN;
const DB_PATH=process.env.RIDDLOVA_DB||resolve(HERE,"private","riddlova.sqlite");
const PORT=Number(process.env.RIDDLOVA_HEALTH_PORT)||4327;
const STARS=25;
mkdirSync(dirname(DB_PATH),{recursive:true});
const db=new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;"+
"CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, language TEXT NOT NULL DEFAULT 'en', notify INTEGER NOT NULL DEFAULT 0, premium INTEGER NOT NULL DEFAULT 0, referred_by TEXT DEFAULT '', joined_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);"+
"CREATE TABLE IF NOT EXISTS payments(charge TEXT PRIMARY KEY, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, paid_at INTEGER NOT NULL);"+
"CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);"+
"CREATE TABLE IF NOT EXISTS support(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, resolved INTEGER DEFAULT 0);"+
"CREATE TABLE IF NOT EXISTS referrals(code TEXT PRIMARY KEY, owner INTEGER NOT NULL);"+
"CREATE INDEX IF NOT EXISTS idx_users_notify ON users(notify);");
const now=()=>Math.floor(Date.now()/1000);
const utc=()=>new Date().toISOString().slice(0,10);
const locales=new Set(["en","de","es","fr","it","pt","tr","ru","ar","hi","ja"]);
const copy={
en:{welcome:"Welcome to RIDDLOVA 🌍\nPlay four free brain games, challenge friends and follow the daily mission. No account required to play.",open:"🎮 PLAY RIDDLOVA",daily:"🧠 Today's challenge",help:"Commands: /play /daily /shop /premium /stats /lang /invite /notify /stop /paysupport /forget",shop:"RIDDLOVA+ unlocks ten additional expert puzzles in Telegram. One-time 25 Stars. No recurring subscription.",locked:"Premium is not available until Telegram Stars payments and support are activated.",paid:"Payment confirmed! ⭐ Your Expert Challenge Pack is now unlocked. Use /premium any time.",proOnly:"To unlock the Expert Challenge Pack, use /shop.",support:"Payment support: reply with /support followed by your issue. A human operator reviews tickets. Never send passwords or card details.",optin:"Daily reminders enabled. Use /stop to disable.",optout:"Notifications disabled.",privacy:"Your Telegram ID, opt-in flag and purchases are stored to operate the bot. Use /forget to delete your gameplay profile; payment records legally required for accounting may be retained.",forget:"Your game profile and reminder preferences were removed. Accounting-related payment records must be retained if legally required.",stats:"Your RIDDLOVA profile",invite:"Invite friends by sharing this link:",unknown:"Try /help to see available commands.",hi:"Select your language:",proTitle:"EXPERT MODE",proDone:"Expert session complete! Use /premium to try another set.",proCorrect:"Correct! ✦",proWrong:"Not quite. The answer was",proRound:"Expert challenge",unavailable:"The service is temporarily unavailable.",ticket:"Your ticket has been stored. We will follow up in this chat when possible.",reminder:"🧠 A fresh RIDDLOVA daily challenge awaits. Play your free mission!"},
de:{welcome:"Willkommen bei RIDDLOVA 🌍\nVier kostenlose Denkspiele, tägliche Missionen und Freundes-Challenges – direkt in Telegram.",open:"🎮 RIDDLOVA SPIELEN",daily:"🧠 Tagesmission",help:"Befehle: /play /daily /shop /premium /stats /lang /invite /notify /stop /paysupport /forget",shop:"RIDDLOVA+ schaltet zehn zusätzliche Expertenrätsel direkt in Telegram frei. Einmalig 25 Stars, kein Abo.",locked:"Premium bleibt gesperrt, bis Telegram Stars und der Kundensupport betriebsbereit sind.",paid:"Zahlung bestätigt! ⭐ Das Experten-Paket ist freigeschaltet. Nutze /premium.",proOnly:"Nutze /shop für das Experten-Paket.",support:"Zahlungssupport: Sende /support gefolgt von deiner Nachricht. Bitte keine Passwörter oder Kartendaten.",optin:"Tägliche Erinnerung aktiviert. Mit /stop beenden.",optout:"Benachrichtigungen deaktiviert.",privacy:"Deine Telegram-ID, optionalen Erinnerungen und Käufe werden zur Bereitstellung gespeichert. /forget löscht dein Spielprofil; gesetzlich erforderliche Buchungen können bestehen bleiben.",forget:"Spielprofil und Erinnerungen gelöscht. Steuerlich notwendige Zahlungsbelege können aufbewahrt werden.",stats:"Deine RIDDLOVA-Statistik",invite:"Lade Freunde mit diesem Link ein:",unknown:"Mit /help siehst du alle Befehle.",hi:"Wähle die Sprache:",proTitle:"EXPERTENMODUS",proDone:"Expertenrunde abgeschlossen! Mit /premium erneut spielen.",proCorrect:"Richtig! ✦",proWrong:"Leider falsch. Richtige Lösung:",proRound:"Expertenrunde",unavailable:"Dienst vorübergehend nicht verfügbar.",ticket:"Anfrage gespeichert. Wir melden uns bei Bedarf hier im Chat.",reminder:"🧠 Die neue RIDDLOVA-Mission ist da. Jetzt gratis spielen!"},
es:{welcome:"¡Bienvenido a RIDDLOVA! 🌍 Cuatro juegos gratis y un nuevo desafío diario.",open:"🎮 JUGAR",daily:"🧠 Desafío diario",shop:"RIDDLOVA+ ofrece diez acertijos expertos por 25 Stars, pago único.",locked:"La tienda aún no está disponible.",paid:"¡Pago confirmado! Usa /premium.",proOnly:"Usa /shop para desbloquear.",reminder:"🧠 ¡Nuevo desafío diario!"},
fr:{welcome:"Bienvenue sur RIDDLOVA ! 🌍 Quatre jeux gratuits et un défi par jour.",open:"🎮 JOUER",daily:"🧠 Défi du jour",shop:"Dix énigmes expert avec RIDDLOVA+ pour 25 Stars, achat unique.",locked:"Boutique indisponible pour le moment.",paid:"Paiement confirmé ! Utilise /premium.",proOnly:"Utilise /shop pour débloquer.",reminder:"🧠 Nouveau défi du jour !"},
it:{welcome:"Benvenuto su RIDDLOVA! 🌍 Quattro giochi gratis e una sfida quotidiana.",open:"🎮 GIOCA",daily:"🧠 Sfida del giorno",reminder:"🧠 Nuova sfida quotidiana!"},pt:{welcome:"Bem-vindo ao RIDDLOVA! 🌍 Quatro jogos grátis e desafios diários.",open:"🎮 JOGAR",daily:"🧠 Desafio diário",reminder:"🧠 Novo desafio diário!"},tr:{welcome:"RIDDLOVA'ya hoş geldin! 🌍 Dört ücretsiz oyun ve günlük görev.",open:"🎮 OYNA",daily:"🧠 Günlük görev",reminder:"🧠 Yeni günlük görev!"},ru:{welcome:"Добро пожаловать в RIDDLOVA! 🌍 Четыре бесплатные игры и ежедневные задания.",open:"🎮 ИГРАТЬ",daily:"🧠 Задание дня",reminder:"🧠 Новое задание дня!"},ar:{welcome:"أهلًا بك في RIDDLOVA! 🌍 أربع ألعاب مجانية وتحديات يومية.",open:"🎮 العب",daily:"🧠 تحدي اليوم",reminder:"🧠 تحدٍ جديد!"},hi:{welcome:"RIDDLOVA में आपका स्वागत है! 🌍 चार मुफ़्त खेल और रोज़ नई चुनौती।",open:"🎮 खेलें",daily:"🧠 आज की चुनौती",reminder:"🧠 नई दैनिक चुनौती!"},ja:{welcome:"RIDDLOVAへようこそ！🌍 4つの無料ゲームと毎日の挑戦。",open:"🎮 プレイ",daily:"🧠 今日のチャレンジ",reminder:"🧠 今日の新しいチャレンジ！"}};
const t=(lang,key)=>copy[lang]?.[key]||copy.en[key]||key;
function userLang(user){const row=db.prepare("SELECT language FROM users WHERE id=?").get(user.id);return row?.language||((user.language_code||"en").slice(0,2) in copy?(user.language_code||"en").slice(0,2):"en")}
function upsert(user){const l=userLang(user);db.prepare("INSERT INTO users(id,language,joined_at,last_seen) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen").run(user.id,l,now(),now());return l;}
function randHash(s){return parseInt(createHmac("sha256","riddlova-pro-v1").update(s).digest("hex").slice(0,8),16)>>>0}
function proPuzzle(user,round){const seed=randHash(user+"|"+utc()+"|"+round);const a=7+seed%18,b=3+(seed>>>6)%12,c=2+(seed>>>12)%4;const correct=a+b*c;const opts=[correct,correct+3,Math.max(0,correct-4),correct+7].sort((x,y)=>(((x*131+seed)%11)-((y*131+seed)%11)));return {question:a+" + "+b+" × "+c+" = ?",correct,options:opts}}
const proSessions=new Map();const recent=new Map();
const throttle=(id)=>{const ms=Date.now();const k=String(id);const prev=recent.get(k)||0;if(ms-prev<350)return false;recent.set(k,ms);if(recent.size>10000)recent.clear();return true;}
async function api(method,args={},timeout=40000){
 if(!TOKEN)throw new Error("Bot token not configured");
 const url="https://api.telegram.org/bot"+TOKEN+"/"+method;
 let response;try{response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(args),signal:AbortSignal.timeout(timeout)})}catch(e){throw new Error("Telegram request failed: "+method)}
 const data=await response.json().catch(()=>({ok:false,description:"invalid json"}));
 if(!data.ok){const msg=String(data.description||"error").replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g,"[REDACTED]");throw new Error("Telegram "+method+" "+response.status+": "+msg.slice(0,120))}
 return data.result;
}
const say=(chat,text,markup)=>api("sendMessage",{chat_id:chat,text,disable_web_page_preview:true,...(markup?{reply_markup:markup}:{})});
const playMarkup=()=>({inline_keyboard:[[{text:"🎮 OPEN RIDDLOVA",web_app:{url:WEB_URL}}],[{text:"↗ SHARE CHALLENGE",url:"https://t.me/share/url?url="+encodeURIComponent(WEB_URL)+"&text="+encodeURIComponent("RIDDLOVA – Play my daily brain challenge!")}]]});
async function onboard(bot){await api("setMyName",{name:"RIDDLOVA | Brain Arena"});await api("setMyShortDescription",{short_description:"Daily brain games, logic, memory & speed. Free worldwide challenges. 🌍"});await api("setMyDescription",{description:"RIDDLOVA is a global brain arena with four fast, free mini games. Play in 11 languages, challenge friends and beat your personal record. No gambling, no cash rewards. Use /play to start, /help for commands."});await api("setMyCommands",{commands:[{command:"play",description:"Open the brain games"},{command:"daily",description:"Today's mission"},{command:"premium",description:"Play expert puzzles (if unlocked)"},{command:"shop",description:"Explore Stars challenge packs"},{command:"stats",description:"My game stats"},{command:"invite",description:"Invite friends"},{command:"lang",description:"Choose language"},{command:"notify",description:"Opt in to daily reminder"},{command:"stop",description:"Stop reminders"},{command:"paysupport",description:"Payment support"},{command:"forget",description:"Delete profile"}]});
 await api("setChatMenuButton",{menu_button:{type:"web_app",text:"PLAY 🎮",web_app:{url:WEB_URL}}});
 // Bot API 10.3: profile photo may be set by the bot itself; failure here is nonfatal.
 try{const p=resolve(HERE,"assets","riddlova-avatar.png");if(existsSync(p)){const form=new FormData();form.append("photo",JSON.stringify({type:"static",photo:"attach://avatar"}));form.append("avatar",new Blob([readFileSync(p)],{type:"image/png"}),"avatar.png");const r=await fetch("https://api.telegram.org/bot"+TOKEN+"/setMyProfilePhoto",{method:"POST",body:form,signal:AbortSignal.timeout(15000)});if(!r.ok)console.log("Profile image not updated; use BotFather as fallback");}}catch{console.log("Profile image not updated; use BotFather as fallback")}
}
function referralCode(user){return createHmac("sha256",TOKEN).update("riddlova-ref-"+user).digest("hex").slice(0,12)}
async function start(user,chat,ref=""){const lang=upsert(user);const own=referralCode(user.id);db.prepare("INSERT OR IGNORE INTO referrals(code,owner) VALUES(?,?)").run(own,user.id);
 if(ref&&ref!==own){const sponsor=db.prepare("SELECT owner FROM referrals WHERE code=?").get(ref);if(sponsor?.owner!==user.id&&sponsor?.owner){db.prepare("UPDATE users SET referred_by=? WHERE id=? AND referred_by=''").run(ref,user.id)}}
 await say(chat,t(lang,"welcome"),playMarkup())}
async function premium(user,chat){const l=upsert(user),row=db.prepare("SELECT premium FROM users WHERE id=?").get(user.id);if(!row?.premium){await say(chat,t(l,"proOnly"));return;}proSessions.set(user.id,{round:0,correct:0,created:Date.now()});await askPremium(user.id,chat,l);}
async function askPremium(user,chat,l){let s=proSessions.get(user);if(!s)return;if(s.round>=10){await say(chat,t(l,"proDone")+" ✦ "+s.correct+"/10");proSessions.delete(user);return}
 const q=proPuzzle(user,s.round);const buttons=q.options.map((v,i)=>({text:String(v),callback_data:"pro:"+s.round+":"+i}));await say(chat,"✦ "+t(l,"proRound")+" "+(s.round+1)+"/10\n\n"+q.question,{inline_keyboard:[buttons]});}
async function handleMessage(msg){const user=msg.from,chat=msg.chat?.id;if(!user||!chat||msg.chat.type!=="private")return;const lang=upsert(user);if(msg.successful_payment){const payment=msg.successful_payment;if(payment.currency==="XTR"&&payment.total_amount===STARS&&payment.invoice_payload==="riddlova_pro_once_v1"&&payment.telegram_payment_charge_id){const c=db.prepare("INSERT OR IGNORE INTO payments(charge,user_id,amount,paid_at) VALUES(?,?,?,?)").run(payment.telegram_payment_charge_id,user.id,STARS,now());if(c.changes){db.prepare("UPDATE users SET premium=1 WHERE id=?").run(user.id);}await say(chat,t(lang,"paid"));}return;}
 const text=String(msg.text||"").trim().slice(0,1500),[cmd,...rest]=text.split(/\s+/);const c=(cmd||"").split("@")[0].toLowerCase();
 switch(c){
 case"/start":return start(user,chat,rest[0]?.replace(/^ref_/,"")||"");
 case"/play":case"/daily":return say(chat,t(lang,c==="/play"?"welcome":"daily"),playMarkup());
 case"/help":return say(chat,t(lang,"help"));
 case"/shop":if(!SHOP)return say(chat,t(lang,"locked"));await say(chat,t(lang,"shop"));return api("sendInvoice",{chat_id:chat,title:"RIDDLOVA+ Expert Challenge Pack",description:"10 exclusive expert puzzles delivered inside Telegram. One-time unlock, no subscription, no gambling.",payload:"riddlova_pro_once_v1",currency:"XTR",provider_token:"",prices:[{label:"Expert Challenge Pack",amount:STARS}],start_parameter:"riddlova-pro"});
 case"/premium":return premium(user,chat);
 case"/stats":{const x=db.prepare("SELECT premium,notify FROM users WHERE id=?").get(user.id);const count=db.prepare("SELECT COUNT(*) AS n FROM payments WHERE user_id=?").get(user.id).n;return say(chat,t(lang,"stats")+"\n⭐ Premium: "+(x?.premium?"YES":"NO")+"\n🔔 Reminders: "+(x?.notify?"ON":"OFF")+"\nPurchases: "+count)}
 case"/lang":return say(chat,t(lang,"hi"),{inline_keyboard:[["en","de","es","fr"],["it","pt","tr","ru"],["ar","hi","ja"]].map(group=>group.map(code=>({text:code.toUpperCase(),callback_data:"lang:"+code})))});
 case"/invite":{const own=referralCode(user.id);db.prepare("INSERT OR IGNORE INTO referrals(code,owner) VALUES(?,?)").run(own,user.id);const botName=process.env.RIDDLOVA_BOT_USERNAME||"RiddlovaBot";return say(chat,t(lang,"invite")+"\nhttps://t.me/"+botName+"?start=ref_"+own)}
 case"/notify":db.prepare("UPDATE users SET notify=1 WHERE id=?").run(user.id);return say(chat,t(lang,"optin"));
 case"/stop":db.prepare("UPDATE users SET notify=0 WHERE id=?").run(user.id);return say(chat,t(lang,"optout"));
 case"/paysupport":return say(chat,t(lang,"support"));
 case"/support":{const body=rest.join(" ").trim();if(body.length<10)return say(chat,t(lang,"support"));db.prepare("INSERT INTO support(user_id,body,created) VALUES(?,?,?)").run(user.id,body.slice(0,1000),now());if(ADMIN)await say(ADMIN,"🛟 RIDDLOVA payment support ticket received. Review the private support database; do not request card details.");return say(chat,t(lang,"ticket"));}
 case"/privacy":return say(chat,t(lang,"privacy"));
 case"/forget":db.prepare("DELETE FROM referrals WHERE owner=?").run(user.id);db.prepare("DELETE FROM users WHERE id=?").run(user.id);proSessions.delete(user.id);return say(chat,t(lang,"forget"));
 default:if(text.startsWith("/"))return say(chat,t(lang,"unknown"));return;
 }
}
async function handleCallback(q){const user=q.from;if(!user)return;const l=upsert(user),data=String(q.data||"");const chat=q.message?.chat?.id;await api("answerCallbackQuery",{callback_query_id:q.id});if(!chat)return;
 if(data.startsWith("lang:")){const choice=data.slice(5);if(locales.has(choice)){db.prepare("UPDATE users SET language=? WHERE id=?").run(choice,user.id);await say(chat,"🌐 "+choice.toUpperCase()+" ✓");}return;}
 if(!data.startsWith("pro:"))return;
 const match=/^pro:(\d{1,2}):([0-3])$/.exec(data),s=proSessions.get(user.id);if(!match||!s||Date.now()-s.created>3600000||s.round!==Number(match[1]))return;
 const qn=proPuzzle(user.id,s.round),chosen=qn.options[Number(match[2])];if(chosen===qn.correct)s.correct++;
 await say(chat,chosen===qn.correct?t(l,"proCorrect"):t(l,"proWrong")+" "+qn.correct);
 s.round++;await askPremium(user.id,chat,l);
}
async function handlePrecheck(q){const valid=SHOP&&q.currency==="XTR"&&q.total_amount===STARS&&q.invoice_payload==="riddlova_pro_once_v1";await api("answerPreCheckoutQuery",{pre_checkout_query_id:q.id,ok:!!valid,...(!valid?{error_message:"This pack is currently unavailable."}:{})})}
async function tickChannel(){if(!CHANNEL||!TOKEN)return;const last=db.prepare("SELECT value FROM meta WHERE key='channel_day'").get()?.value;if(last===utc())return;const hour=new Date().getUTCHours();if(hour<9)return;
 const chat=await api("getChat",{chat_id:CHANNEL});if(chat.type!=="channel"||!String(chat.title||"").toLowerCase().includes("riddlova")){console.log("Channel does not match RIDDLOVA, no posts sent");return;}
 const msg="🧠 RIDDLOVA — DAILY BRAIN ARENA\n\n🌍 New global challenge for "+utc()+" (UTC)\n⚡ Logic · Numbers · Memory · Reflex\n\nPlay for free and share your score with a friend. No downloads needed.\n\n"+WEB_URL;
 await say(CHANNEL,msg,{inline_keyboard:[[{text:"🎮 PLAY THE DAILY CHALLENGE",url:WEB_URL}]]});db.prepare("INSERT INTO meta(key,value) VALUES('channel_day',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(utc());
}
async function tickNotify(){if(!TOKEN)return;const day=utc();if(new Date().getUTCHours()<10)return;const last=db.prepare("SELECT value FROM meta WHERE key='notify_day'").get()?.value;if(last===day)return;
 const users=db.prepare("SELECT id,language FROM users WHERE notify=1 ORDER BY id LIMIT 300").all();
 for(const u of users){try{await say(u.id,t(u.language,"reminder"),playMarkup())}catch(e){if(/403|blocked|chat not found/i.test(String(e)))db.prepare("UPDATE users SET notify=0 WHERE id=?").run(u.id);}await new Promise(r=>setTimeout(r,100))}
 db.prepare("INSERT INTO meta(key,value) VALUES('notify_day',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(day);
}
let botOK=false;
const server=createServer((req,res)=>{if(req.url!=="/health"){res.writeHead(404,{"Content-Type":"application/json"});res.end('{"error":"not-found"}');return}
 res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify({service:"riddlova",live:true,botConnected:botOK,monetizationEnabled:SHOP,channelConfigured:!!CHANNEL,utc:utc()}))});
server.listen(PORT,"127.0.0.1",()=>console.log("RIDDLOVA health listener on 127.0.0.1:"+PORT));
async function poll(){let offset=0,backoff=1000;
 while(TOKEN){try{const updates=await api("getUpdates",{offset,timeout:25,limit:50,allowed_updates:["message","callback_query","pre_checkout_query"]},36000);botOK=true;backoff=1000;
 for(const upd of updates){offset=Math.max(offset,Number(upd.update_id)+1);try{if(upd.pre_checkout_query)await handlePrecheck(upd.pre_checkout_query);else if(upd.message)await handleMessage(upd.message);else if(upd.callback_query)await handleCallback(upd.callback_query)}catch(e){console.error("Handler error:",String(e).slice(0,145))}}}
 catch(e){botOK=false;console.error("Polling issue:",String(e).slice(0,145));await new Promise(r=>setTimeout(r,backoff));backoff=Math.min(30000,backoff*2)}}
}
if(TOKEN){try{const self=await api("getMe");if(!self.is_bot)throw new Error("Invalid bot identity");process.env.RIDDLOVA_BOT_USERNAME=self.username||"";await onboard(self);console.log("RIDDLOVA bot connected: "+self.username);poll();}catch(e){console.error("Bot inactive until valid BotFather credentials: "+String(e).slice(0,110))}}
else console.log("Staging mode: BotFather token not configured; no Telegram messages or payments.");
setInterval(()=>tickChannel().catch(e=>console.error("Channel scheduler:",String(e).slice(0,100))),5*60*1000);
setInterval(()=>tickNotify().catch(e=>console.error("Reminder scheduler:",String(e).slice(0,100))),15*60*1000);
setTimeout(()=>{tickChannel().catch(()=>{});tickNotify().catch(()=>{})},30000);
process.on("SIGINT",()=>{db.close();server.close();process.exit(0)});process.on("SIGTERM",()=>{db.close();server.close();process.exit(0)});
