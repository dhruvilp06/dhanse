// Dmatx backend — DhanHQ v2 (Market Quote API) + SQLite snapshots
const express=require('express'),Db=require('better-sqlite3');
const CID=process.env.DHAN_CLIENT_ID,PORT=process.env.PORT||3000;
let TOKEN=process.env.DHAN_ACCESS_TOKEN||'',MAP={},lastQ={},lastSlot='',lastErr='';
const db=new Db(process.env.DB_PATH||'dmatx.db');
db.exec('create table if not exists snap(day text,slot text,data text,primary key(day,slot))');
const IST=()=>new Date(Date.now()+19800000),dayStr=t=>t.toISOString().slice(0,10);
const HD=()=>({'access-token':TOKEN,'client-id':CID,'Content-Type':'application/json',Accept:'application/json'});
// optional: auto token (needs TOTP enabled on Dhan) — set DHAN_PIN + DHAN_TOTP_SECRET
async function autoToken(){if(!process.env.DHAN_PIN||!process.env.DHAN_TOTP_SECRET)return false;
 const{authenticator}=require('otplib');const code=authenticator.generate(process.env.DHAN_TOTP_SECRET);
 const r=await fetch(`https://auth.dhan.co/app/generateAccessToken?dhanClientId=${CID}&pin=${process.env.DHAN_PIN}&totp=${code}`,{method:'POST'});
 const j=await r.json();if(j.accessToken){TOKEN=j.accessToken;console.log('token refreshed');return true}console.error('token fail',j);return false}
// F&O stock list = underlyings of NSE stock futures (FUTSTK) from Dhan scrip master
async function loadFNO(){const txt=await(await fetch('https://images.dhan.co/api-data/api-scrip-master-detailed.csv')).text();
 const L=txt.split(/\r?\n/),H=L[0].split(',').map(x=>x.trim()),ix=n=>H.indexOf(n),sp=l=>l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
 const iE=ix('EXCH_ID'),iI=ix('INSTRUMENT'),iU=ix('UNDERLYING_SECURITY_ID'),iS=ix('UNDERLYING_SYMBOL');const m={};
 for(const l of L){if(!l.includes('FUTSTK'))continue;const c=sp(l);if(c[iE]==='NSE'&&c[iI]==='FUTSTK'){const id=parseInt(c[iU]);if(id)m[id]=c[iS].trim()}}
 MAP=m;console.log('F&O stocks:',Object.keys(m).length)}
async function pull(){const r=await fetch('https://api.dhan.co/v2/marketfeed/quote',{method:'POST',headers:HD(),body:JSON.stringify({NSE_EQ:Object.keys(MAP).map(Number)})});
 const j=await r.json();if(j.status!=='success')throw new Error(JSON.stringify(j).slice(0,200));
 const out={},d=j.data.NSE_EQ||{};for(const id in d){const v=d[id],s=MAP[id];if(s)out['NSE:'+s]={last_price:v.last_price,volume:v.volume,ohlc:v.ohlc}}lastQ=out;lastErr=''}
async function safePull(){try{await pull()}catch(e){lastErr=e.message;if(await autoToken())await pull().catch(x=>lastErr=x.message)}}
function save(day,slot){const rows=Object.entries(lastQ).map(([k,v])=>[k.slice(4),+(((v.last_price-v.ohlc.close)/v.ohlc.close)*100).toFixed(2),v.last_price,v.ohlc.open,v.ohlc.high,v.ohlc.low,v.ohlc.close,v.volume]);
 if(rows.length)db.prepare('insert or replace into snap values(?,?,?)').run(day,slot,JSON.stringify(rows))}
async function tick(){const t=IST(),d=t.getUTCDay(),h=t.getUTCHours(),mi=t.getUTCMinutes(),m=h*60+mi;
 if(m===510&&d>0&&d<6&&process.env.DHAN_PIN)await autoToken().catch(()=>0); // 8:30 IST token refresh
 if(!TOKEN||d===0||d===6||m<555||m>931)return;
 const slot=String(h).padStart(2,'0')+':'+String(Math.floor(mi/5)*5).padStart(2,'0');if(slot===lastSlot)return;
 await safePull();if(!lastErr){save(dayStr(t),slot);lastSlot=slot}else console.error('tick',lastErr)}
const app=express();app.use(express.static('public'));
app.get('/api/status',(q,r)=>r.json({fno:Object.keys(MAP).length,hasToken:!!TOKEN,lastErr,lastSlot}));
app.get('/api/quotes',async(q,r)=>{if(!TOKEN)return r.status(401).json({error:'DHAN_ACCESS_TOKEN not set'});
 try{await safePull();if(lastErr)throw new Error(lastErr);r.json(lastQ)}catch(e){r.status(500).json({error:e.message})}});
app.get('/api/history',(q,r)=>{const o={};db.prepare('select distinct day from snap order by day desc limit 30').all().forEach(({day})=>{o[day]={};db.prepare('select slot,data from snap where day=?').all(day).forEach(x=>o[day][x.slot]=JSON.parse(x.data))});r.json(o)});
app.listen(PORT,async()=>{console.log('http://localhost:'+PORT);try{await loadFNO()}catch(e){console.error('scrip master',e.message)}
 if(!TOKEN)await autoToken().catch(()=>0);setInterval(()=>tick().catch(e=>console.error(e.message)),20000)});
