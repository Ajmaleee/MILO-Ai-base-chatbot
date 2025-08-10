/* ============================
   script.js — Milo logic
   Save in same folder as index.html & style.css
   ============================ */

/* -------- CONFIG --------
   - Optional: Set your OpenWeatherMap key here (for weather queries)
     const OPENWEATHER_API_KEY = 'YOUR_KEY_HERE';
   - For production TTS (ElevenLabs/Google) create a server endpoint; see speakExternal() stub.
*/
const OPENWEATHER_API_KEY = ''; // <-- optional

/* -------- elements -------- */
const appEl = document.getElementById('app');
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const diceBtn = document.getElementById('diceBtn');
const micBtn = document.getElementById('micBtn');
const ttsToggle = document.getElementById('ttsToggle');
const statusEl = document.getElementById('status');
const rulesListEl = document.getElementById('rulesList');
const addRuleBtn = document.getElementById('addRuleBtn');
const newKeyEl = document.getElementById('newKey');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const quickEls = document.querySelectorAll('.chip');
const bgTilt = document.getElementById('bgTilt');

/* -------- state -------- */
let ttsEnabled = false;
ttsToggle.addEventListener('change', ()=> ttsEnabled = ttsToggle.checked);

/* simple audio pop */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playPop(freq=700, time=0.02, gain=0.06){
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
  setTimeout(()=> o.stop(), time*1000+60);
}

/* random questions */
const RANDOM_QUESTIONS = [
  "What's a small goal you can achieve today?",
  "If you could learn any skill right now, what would it be?",
  "What's a movie you love and why?",
  "What's a fact you recently learned?",
  "If you could travel tomorrow, where would you go?"
];

/* default RULES */
let RULES = {
  'hello': ["Hey! Milo here 😄","Hi there! What can I do for you?","Hello — Milo at your service."],
  'hi': ["Hey!","Hi! 🙂","👋 Hello!"],
  'who made you': [ ()=>`I was created by Ajmal Ali . A — Insta: @ajmaleee__ • Email: ajmalsworkshop@gmail.com`, ()=>`My creator is Ajmal Ali . A. Say hi at @ajmaleee__` ],
  'creator': [ ()=>`I was built by Ajmal Ali . A — instagram: @ajmaleee__`, ()=>`The one behind me: Ajmal Ali . A — ajmalsworkshop@gmail.com` ],
  'owner': [ ()=>`Ajmal Ali . A created me — @ajmaleee__`, ()=>`Creator: Ajmal Ali . A (Instagram: @ajmaleee__)` ],
  'milo': ["That's me — Milo!","Milo at your service.","You’re talking to Milo 🙂"],
  'time': [ ()=>`Local time: ${new Date().toLocaleString()}` ],
  'joke': ["Why did the developer go broke? Because he used up all his cache. 😄", "I would tell a UDP joke but you might not get it. 😂"],
  'thanks': ["Anytime!","Glad to help!","You're welcome!"],
  'weather': [
    async (text)=>{
      if(!OPENWEATHER_API_KEY) return "I can fetch weather if you add an OpenWeatherMap API key in the script.";
      const match = text.match(/weather (in )?([a-zA-Z\s]+)/i);
      const city = match ? match[2].trim() : 'Kochi';
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OPENWEATHER_API_KEY}`;
      try{
        const r = await fetch(url);
        if(!r.ok) throw new Error('weather failed');
        const data = await r.json();
        return `Weather in ${data.name}: ${Math.round(data.main.temp)}°C, ${data.weather[0].description}.`;
      }catch(e){ return "Couldn't fetch weather — check API key or network."; }
    }
  ],
  'help': ["I can answer keywords, fetch weather (with API key), speak replies, and learn rules via the editor.", "Try asking 'who made you', 'weather in <city>', press 🎲 for a random question, or enable TTS."],
  'bye': ["Goodbye! 👋","See you soon!","Take care!"]
};

/* -------- persistence -------- */
const STORAGE_KEY = 'milo_chat_v1';
const RULES_KEY = 'milo_rules_v1';

function saveConversation(){
  const arr = Array.from(messagesEl.querySelectorAll('.msg')).map(m => {
    return { who: m.classList.contains('user') ? 'user' : 'ai', text: m.querySelector('.content')?.textContent || '' };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
function loadConversation(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return;
  try{
    const arr = JSON.parse(raw);
    arr.forEach(it => appendMessage(it.text, it.who, false));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }catch(e){ console.warn('load convo failed', e); }
}
function saveRules(){
  try{ localStorage.setItem(RULES_KEY, JSON.stringify(RULES)); }catch(e){}
}
function loadRules(){
  const raw = localStorage.getItem(RULES_KEY);
  if(!raw) return;
  try{ RULES = JSON.parse(raw); }catch(e){}
}
loadRules();
loadConversation();

/* -------- Live rules UI -------- */
function renderRules(){
  rulesListEl.innerHTML = '';
  Object.keys(RULES).forEach(k=>{
    const box = document.createElement('div'); box.className='rule-item';
    const left = document.createElement('div'); left.style.flex='1';
    left.innerHTML = `<strong>${k}</strong><div style="font-size:12px;opacity:.9;margin-top:6px">${RULES[k].slice(0,3).map(x=> typeof x==='function' ? '[fn]' : x ).join(' • ')}</div>`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px';
    const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit';
    const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.style.background='linear-gradient(90deg,#ff8a8a,#ff5f8d)';
    right.appendChild(edit); right.appendChild(del);
    box.appendChild(left); box.appendChild(right);
    rulesListEl.appendChild(box);

    edit.addEventListener('click', ()=> {
      const cur = RULES[k].map(x=> typeof x==='function' ? '{fn}' : x).join(', ');
      const val = prompt(`Edit responses for "${k}" (comma separated). Use {fn} to keep functions unchanged.`, cur);
      if(val===null) return;
      const arr = val.split(',').map(s=>s.trim()).filter(Boolean).map(s=> s === '{fn}' ? (()=>'[fn]') : s );
      RULES[k] = arr;
      saveRules(); renderRules();
    });

    del.addEventListener('click', ()=> {
      if(!confirm(`Delete rule "${k}"?`)) return;
      delete RULES[k]; saveRules(); renderRules();
    });
  });
}
renderRules();

/* add new rule */
addRuleBtn.addEventListener('click', ()=>{
  const key = newKeyEl.value.trim();
  if(!key) return alert('Enter a keyword');
  if(RULES[key]) return alert('Rule exists');
  RULES[key] = [`New reply for ${key}`]; newKeyEl.value=''; renderRules(); saveRules();
});

/* export rules */
exportBtn.addEventListener('click', ()=>{
  const data = JSON.stringify(RULES, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'milo_rules.json'; a.click(); URL.revokeObjectURL(url);
});

/* clear conversation */
clearBtn.addEventListener('click', ()=>{
  if(!confirm('Clear conversation?')) return;
  messagesEl.innerHTML = ''; localStorage.removeItem(STORAGE_KEY);
});

/* quick chips */
quickEls.forEach(chip => chip.addEventListener('click', ()=> {
  const action = chip.dataset.action;
  if(action==='joke') processInput('joke');
  if(action==='fact') processInput('tell me a fact');
  if(action==='weather') processInput('weather in Kochi');
}));

/* dice */
diceBtn.addEventListener('click', ()=> {
  const q = RANDOM_QUESTIONS[Math.floor(Math.random()*RANDOM_QUESTIONS.length)];
  inputEl.value = q; inputEl.focus();
});

/* voice input */
let recognition = null;
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  micBtn.addEventListener('click', ()=> {
    try{ recognition.start(); statusEl.textContent='Listening...'; }catch(e){}
  });
  recognition.addEventListener('result', (ev)=> {
    const t = ev.results[0][0].transcript;
    inputEl.value = t; processInput(t); statusEl.textContent='Ready';
  });
  recognition.addEventListener('error', ()=> statusEl.textContent='Ready');
  recognition.addEventListener('end', ()=> statusEl.textContent='Ready');
} else {
  micBtn.style.opacity = 0.6; micBtn.title = 'Voice not supported';
}

/* Levenshtein */
function levenshtein(a,b){
  a=a.toLowerCase(); b=b.toLowerCase();
  const m=a.length,n=b.length; if(m===0) return n; if(n===0) return m;
  const dp = Array.from({length:m+1}, ()=> new Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : Math.min(dp[i-1][j-1]+1, dp[i][j-1]+1, dp[i-1][j]+1);
  }}
  return dp[m][n];
}

/* match rule (fuzzy) */
function matchRule(input){
  const text = input.toLowerCase();
  for(const key of Object.keys(RULES)){
    if(text.includes(key)) return key;
  }
  const words = text.split(/\s+/);
  let best=null, bestScore=Infinity;
  for(const key of Object.keys(RULES)){
    for(const w of words){
      const d = levenshtein(w, key);
      if(d < bestScore){ bestScore=d; best=key; }
    }
    const d2 = levenshtein(text, key);
    if(d2 < bestScore){ bestScore=d2; best=key; }
  }
  if(best && bestScore <= Math.max(1, Math.floor(best.length * 0.35))) return best;
  return null;
}

/* append message with avatars */
function appendMessage(text, who='ai', meta='', save=true){
  const row = document.createElement('div'); row.className='bubble-row';
  const avatar = document.createElement('div'); avatar.className='avatar ' + (who==='user' ? 'user' : 'milo'); avatar.textContent = who==='user' ? 'U' : 'M';
  const bubble = document.createElement('div'); bubble.className='msg ' + (who==='user' ? 'user' : 'ai');
  const content = document.createElement('div'); content.className='content'; content.textContent = text;
  bubble.appendChild(content);
  if(meta){ const metaEl = document.createElement('div'); metaEl.className='meta'; metaEl.textContent = meta; bubble.appendChild(metaEl); }
  if(who==='user'){ row.appendChild(bubble); row.appendChild(avatar); } else { row.appendChild(avatar); row.appendChild(bubble); }
  messagesEl.appendChild(row); messagesEl.scrollTop = messagesEl.scrollHeight;
  playPop(900,0.02,0.04);
  if(save) saveConversation();
}

/* typing indicator */
function showTyping(){ const t = document.createElement('div'); t.className='bubble-row typing-row'; t.id='typingRow'; const av=document.createElement('div'); av.className='avatar milo'; av.textContent='M'; const bub=document.createElement('div'); bub.className='msg ai typing'; const dots=document.createElement('div'); dots.className='typing'; dots.innerHTML='<span></span><span></span><span></span>'; bub.appendChild(dots); t.appendChild(av); t.appendChild(bub); messagesEl.appendChild(t); messagesEl.scrollTop = messagesEl.scrollHeight; }
function hideTyping(){ const r=document.getElementById('typingRow'); if(r) r.remove(); }

/* TTS (browser) */
function speakBrowser(text){
  if(!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const ut = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  let chosen = voices.find(v=>/female|woman|samantha|alloy/i.test((v.name||'').toLowerCase())) || voices.find(v=>/en(-|_)us/i.test(v.lang)) || voices[0];
  if(chosen) ut.voice = chosen;
  ut.rate = 1; ut.pitch = 1;
  window.speechSynthesis.speak(ut);
}

/* optional external TTS (server required) - stub
async function speakExternal(text){
  // POST /api/tts { text } -> audio blob
  // const res = await fetch('/api/tts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text}) });
  // if(!res.ok) return speakBrowser(text);
  // const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = new Audio(url); await a.play();
}
*/

/* process input */
async function processInput(raw){
  const text = (raw||'').trim(); if(!text) return;
  appendMessage(text, 'user', 'You');
  inputEl.value=''; saveConversation();

  statusEl.textContent = 'Milo is thinking...'; showTyping();
  await new Promise(r=>setTimeout(r, 200 + Math.random()*300));

  const key = matchRule(text);
  let reply = null;
  if(key){
    const arr = RULES[key];
    const pick = arr[Math.floor(Math.random()*arr.length)];
    try{ reply = typeof pick==='function' ? await pick(text) : pick; } catch(e){ reply = "Sorry — error generating reply."; }
  } else {
    const words = text.toLowerCase();
    if(words.includes('weather') || words.includes('temp')){
      if(RULES['weather'] && RULES['weather'][0]) {
        try{ reply = await RULES['weather'][0](text); } catch(e){ reply = "Weather fetch failed."; }
      } else reply = "I can fetch weather if you set the OpenWeatherMap key in the script.";
    } else {
      const fallback = ["I didn't catch that — could you rephrase?","Hmm, try another phrasing — I'm learning.","Not sure I understand. Try 'who made you' or 'tell a joke'."];
      reply = fallback[Math.floor(Math.random()*fallback.length)];
    }
  }

  hideTyping(); appendMessage(reply, 'ai', 'Milo');
  if(ttsEnabled) speakBrowser(reply);
  statusEl.textContent = 'Ready';
}

/* events */
sendBtn.addEventListener('click', ()=> { const v = inputEl.value.trim(); if(!v) return; processInput(v); });
inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendBtn.click(); } });

diceBtn.addEventListener('click', ()=> { const q = RANDOM_QUESTIONS[Math.floor(Math.random()*RANDOM_QUESTIONS.length)]; inputEl.value = q; inputEl.focus(); });

document.addEventListener('click', (e)=>{ const chip = e.target.closest('.chip'); if(!chip) return; const action = chip.dataset.action; if(action==='joke') processInput('joke'); if(action==='fact') processInput('tell me a fact'); if(action==='weather') processInput('weather in Kochi'); });

/* 3D tilt */
document.addEventListener('mousemove', (e)=>{
  const rect = appEl.getBoundingClientRect();
  const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
  const dx = e.clientX - cx, dy = e.clientY - cy;
  const rx = (-dy / rect.height) * 4; const ry = (dx / rect.width) * 6;
  appEl.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
});

/* save on unload */
window.addEventListener('beforeunload', saveConversation);

/* seed welcome */
if(!messagesEl.children.length) setTimeout(()=> appendMessage("Hello — I'm Milo. Try: 'who made you', 'weather in Kochi', press 🎲 for a random question, enable TTS, or use the Rules Editor.", 'ai', 'Milo'), 400);

/* expose API for debugging */
window.Milo = { RULES, processInput, appendMessage, matchRule };
