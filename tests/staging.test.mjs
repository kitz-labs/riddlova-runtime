import test from "node:test";import assert from "node:assert/strict";import {spawn} from "node:child_process";import {mkdtempSync,rmSync,readFileSync} from "node:fs";import {tmpdir} from "node:os";import {join} from "node:path";import {setTimeout as wait} from "node:timers/promises";
test("Bot boots in safe staging without secrets, Stars disabled, local health only",async()=>{
const folder=mkdtempSync(join(tmpdir(),"riddlova-"));const port=48000+Math.floor(Math.random()*8000);
const env={...process.env,TELEGRAM_BOT_TOKEN:"",RIDDLOVA_CHANNEL_ID:"",RIDDLOVA_ENABLE_STARS:"0",RIDDLOVA_DB:join(folder,"db.sqlite"),RIDDLOVA_HEALTH_PORT:String(port)};
const cp=spawn(process.execPath,["main.mjs"],{cwd:new URL("..",import.meta.url),env,stdio:"ignore"});
try{let data=null;for(let i=0;i<40;i++){try{const r=await fetch("http://127.0.0.1:"+port+"/health");data=await r.json();break}catch{await wait(130)}}assert.ok(data,"health reachable");assert.equal(data.botConnected,false);assert.equal(data.monetizationEnabled,false);assert.equal(data.channelConfigured,false);assert.equal(data.service,"riddlova");
const unknown=await fetch("http://127.0.0.1:"+port+"/unexpected");assert.equal(unknown.status,404)}
finally{cp.kill("SIGTERM");await wait(150);rmSync(folder,{force:true,recursive:true})}
});
test("Stars compliance gates exist in runtime source",()=>{
const src=readFileSync(new URL("../main.mjs",import.meta.url),"utf8");
for(const s of ['currency:"XTR"','provider_token:""','answerPreCheckoutQuery','successful_payment','INSERT OR IGNORE INTO payments','RIDDLOVA_ENABLE_STARS','/paysupport','/forget'])assert.ok(src.includes(s),s);
});
