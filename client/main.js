// ===== UI helpers =====
const notice = document.getElementById('notice') || (() => {
  const n = document.createElement('div');
  n.id = 'notice'; n.className = 'notice hidden';
  document.querySelector('.container').prepend(n);
  return n;
})();
function showError(msg){ notice.className='notice error'; notice.textContent=msg; notice.classList.remove('hidden'); }
function clearError(){ notice.className='notice hidden'; notice.textContent=''; }

// DOM refs
const totalEl = document.getElementById('total');
const lastEl = document.getElementById('last');
const progressEl = document.getElementById('progress');
const donateBtn = document.getElementById('donateBtn');
const pseudoEl = document.getElementById('pseudo');
const amountEl = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

// Socket
const socket = io();

// ===== Mobile audio unlock =====
let audioUnlocked=false;
async function unlockAudio(){
  if(audioUnlocked||!coinSound) return;
  try{
    coinSound.muted=true; await coinSound.play(); await new Promise(r=>setTimeout(r,10));
    coinSound.pause(); coinSound.currentTime=0; coinSound.muted=false; audioUnlocked=true;
  }catch{}
}
addEventListener('touchstart', unlockAudio, {once:true, passive:true});
addEventListener('pointerdown', unlockAudio, {once:true});
addEventListener('keydown', unlockAudio, {once:true});

// ===== Confetti (coins/bills) =====
const animCanvas=document.getElementById('animationCanvas');
const animCtx=animCanvas.getContext('2d');
function resizeAnim(){ animCanvas.width=innerWidth; animCanvas.height=innerHeight; }
addEventListener('resize', resizeAnim); resizeAnim();
function loadImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('img '+src)); i.src=src;});}
let coinsImg,billsImg,assetsReady=false;
Promise.all([loadImage('/assets/coins.png').then(i=>coinsImg=i), loadImage('/assets/bills.png').then(i=>billsImg=i)])
  .then(()=>assetsReady=true).catch(()=>{});
let particles=[];
function createParticles(amount){
  if(!assetsReady) return;
  const maxCoins=Math.min(Math.max(3,Math.floor(amount/5)),10);
  const maxBills=amount>=20?Math.min(Math.floor(amount/20),5):0;
  for(let i=0;i<maxCoins;i++) particles.push({img:coinsImg,x:Math.random()*animCanvas.width,y:-50,vx:(Math.random()-0.5)*1.2,vy:2+Math.random()*2,r:Math.random()*Math.PI*2,vr:(Math.random()-0.5)*0.2});
  for(let i=0;i<maxBills;i++) particles.push({img:billsImg,x:Math.random()*animCanvas.width,y:-50,vx:(Math.random()-0.5)*0.6,vy:1+Math.random()*1.2,r:Math.random()*Math.PI*2,vr:(Math.random()-0.5)*0.05});
}
(function loop(){
  animCtx.clearRect(0,0,animCanvas.width,animCanvas.height);
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    animCtx.save(); animCtx.translate(p.x,p.y); animCtx.rotate(p.r);
    if(p.img) animCtx.drawImage(p.img,-p.img.width/2,-p.img.height/2);
    animCtx.restore();
    p.x+=p.vx; p.y+=p.vy; p.r+=p.vr;
    if(p.img===coinsImg && p.y + (p.img?.height||0)/2 > animCanvas.height){ p.vy*=-0.5; p.y=animCanvas.height - (p.img.height/2); p.vx*=0.7; }
    if(p.y>animCanvas.height+120) particles.splice(i,1);
  }
  requestAnimationFrame(loop);
})();

// ===== Reveal (1,000,000 pixels) =====
const GRID=1000, TOTAL_PIXELS=GRID*GRID;
const photoCanvas=document.getElementById('photoCanvas');
const maskCanvas=document.getElementById('maskCanvas');
const photoCtx=photoCanvas.getContext('2d');
const maskCtx=maskCanvas.getContext('2d',{ willReadFrequently:true });

let photoImg=null, maskImageData=null;
let covered=null, coveredLen=0, revealedCount=0;

async function initRevealStage(){
  photoCanvas.width=1080; photoCanvas.height=1616;
  maskCanvas.width=GRID; maskCanvas.height=GRID;

  try{ photoImg=await loadImage('/assets/me.jpg'); }
  catch{ const g=photoCtx.createLinearGradient(0,0,photoCanvas.width,photoCanvas.height); g.addColorStop(0,'#111'); g.addColorStop(1,'#222'); photoCtx.fillStyle=g; photoCtx.fillRect(0,0,photoCanvas.width,photoCanvas.height); }

  drawPhotoCover(); generateGoldMaskOpaque();

  covered=new Uint32Array(TOTAL_PIXELS);
  for(let i=0;i<TOTAL_PIXELS;i++) covered[i]=i;
  coveredLen=TOTAL_PIXELS; revealedCount=0;
}
function drawPhotoCover(){
  const cw=photoCanvas.width, ch=photoCanvas.height;
  photoCtx.clearRect(0,0,cw,ch);
  if(!photoImg) return;
  const iw=photoImg.width, ih=photoImg.height, cr=cw/ch, ir=iw/ih;
  let sx,sy,sw,sh;
  if(ir>cr){ sh=ih; sw=ih*cr; sx=(iw-sw)/2; sy=0; }
  else { sw=iw; sh=iw/cr; sx=0; sy=(ih-sh)/2; }
  photoCtx.drawImage(photoImg,sx,sy,sw,sh,0,0,cw,ch);
}
function generateGoldMaskOpaque(){
  const d=maskCtx.createImageData(GRID,GRID), arr=d.data;
  for(let i=0;i<TOTAL_PIXELS;i++){
    const pal=[[201,173,67],[212,175,55],[184,134,11],[230,190,95],[255,215,0]];
    const base=pal[(Math.random()*pal.length)|0];
    const r=Math.max(0,Math.min(255,base[0]+(Math.random()*22-11)));
    const g=Math.max(0,Math.min(255,base[1]+(Math.random()*22-11)));
    const b=Math.max(0,Math.min(255,base[2]+(Math.random()*22-11)));
    const j=i*4; arr[j]=r; arr[j+1]=g; arr[j+2]=b; arr[j+3]=255;
  }
  maskImageData=d; maskCtx.putImageData(maskImageData,0,0);
}
// reveal N random (persist)
function revealPixels(count){
  if(!maskImageData || coveredLen<=0 || count<=0) return;
  const data=maskImageData.data, BATCH=10000;
  let remaining=Math.min(count,coveredLen);
  while(remaining>0){
    const step=Math.min(remaining,BATCH);
    for(let i=0;i<step;i++){
      const r=(Math.random()*coveredLen)|0;
      const idx=covered[r];
      covered[r]=covered[coveredLen-1];
      coveredLen--;
      const p=idx*4; data[p+3]=0; revealedCount++;
      if(coveredLen===0) break;
    }
    maskCtx.putImageData(maskImageData,0,0);
    remaining-=step;
    if(coveredLen===0) break;
  }
}
function revealToTarget(targetPixels){
  const t=Math.max(0,Math.min(TOTAL_PIXELS,Math.floor(targetPixels)));
  const need=t - revealedCount;
  if(need>0) revealPixels(need);
}

// ===== Stripe (Payment Element) =====
let stripe,elements,paymentElement;
async function fetchConfig(){ const r=await fetch('/api/config'); const d=await r.json(); if(!d.publishableKey) throw new Error('Stripe key missing'); return d; }
async function createPaymentIntent(amount,pseudo){
  const r=await fetch('/api/create-payment-intent',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({amount,pseudo}) });
  const d=await r.json(); if(!r.ok||!d.clientSecret) throw new Error(d.error||'PI failed'); return d.clientSecret;
}
async function mountPaymentElement(){
  try{
    const { publishableKey }=await fetchConfig(); stripe=Stripe(publishableKey);
    const amount=Math.max(1,Math.floor(Number(amountEl.value||1)));
    const pseudo=(pseudoEl.value||'Anonymous').slice(0,50);
    const clientSecret=await createPaymentIntent(amount,pseudo);
    if(paymentElement) paymentElement.destroy();
    elements=stripe.elements({clientSecret}); paymentElement=elements.create('payment');
    paymentElement.mount('#payment-element'); donateBtn.disabled=false;
  }catch(e){ showError('Stripe init error: '+(e.message||e)); }
}
async function confirmAndRecord(){
  const { error }=await stripe.confirmPayment({ elements, redirect:'if_required' });
  if(error) throw new Error(error.message||'Payment failed');
  try{ coinSound.currentTime=0; await coinSound.play(); }catch{}
  const amount=Math.max(1,Math.floor(Number(amountEl.value||1)));
  const pseudo=(pseudoEl.value||'Anonymous').slice(0,50);
  const r=await fetch('/api/donate',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pseudo,amount}) });
  const data=await r.json(); if(!r.ok||!data.success) throw new Error(data.error||'Donation save failed');
  applyTotalsNet(data.totalNet, data.last); createParticles(amount); await mountPaymentElement();
}

// ===== Totals/Progress/Reveal binding =====
function applyTotalsNet(totalNet,last){
  const t=Number(totalNet)||0;
  totalEl.textContent=t.toFixed(2).replace(/\.00$/,'');
  progressEl.style.width=`${Math.min((t/1_000_000)*100,100)}%`;
  lastEl.textContent= last ? `Thanks to the last donor : ${last.pseudo} ($${last.amount})` : 'Thanks to the last donor : -';
  revealToTarget(Math.floor(t));
}
socket.on('update', ({ totalNet, last }) => applyTotalsNet(totalNet,last));

async function loadInitialTotals(){
  const endpoints=['/api/summary','/api/donations/summary','/api/total'];
  for(const url of endpoints){
    try{ const r=await fetch(url); if(!r.ok) continue; const d=await r.json();
      if(typeof d.totalNet!=='undefined'){ applyTotalsNet(d.totalNet,d.last||null); return; }
      if(typeof d.total!=='undefined'){ applyTotalsNet(d.total,d.last||null); return; }
    }catch{}
  }
}

// ===== Test Simulator (client-only) =====
const isTestMode = new URLSearchParams(location.search).has('test');
const testPanel = document.getElementById('test-panel');
const simIntervalEl = document.getElementById('sim-interval');
const simMinEl = document.getElementById('sim-min');
const simMaxEl = document.getElementById('sim-max');
const simStartBtn = document.getElementById('sim-start');
const simStopBtn  = document.getElementById('sim-stop');

let simTimer=null;
let simTotalNet=null; // on part de la valeur réelle affichée

const pseudos = ['Alice','Bob','Charlie','Dana','Eve','Frank','Grace','Heidi','Ivan','Judy','Kim','Leo','Mina','Nico','Oli','Pat','Quinn','Rex','Sam','Tara'];

function getUiTotal(){
  const txt=(totalEl.textContent||'0').replace(/[^0-9.]/g,'');
  const num=parseFloat(txt); return isNaN(num)?0:num;
}
function simulateOnce(){
  const min = Math.max(1, parseInt(simMinEl.value || '1',10));
  const max = Math.max(min, parseInt(simMaxEl.value || '25',10));
  const amount = Math.floor(Math.random()*(max-min+1))+min;
  const pseudo = pseudos[(Math.random()*pseudos.length)|0];

  // son + anims
  unlockAudio().then(async()=>{ try{ coinSound.currentTime=0; await coinSound.play(); }catch{} });
  createParticles(amount);

  // avancer le total côté client uniquement
  if(simTotalNet===null) simTotalNet = getUiTotal();
  simTotalNet = Math.min(1_000_000, simTotalNet + amount);

  applyTotalsNet(simTotalNet, { pseudo, amount });
}

function startSim(){
  if(simTimer) return;
  const sec = Math.max(1, parseInt(simIntervalEl.value||'10',10));
  simulateOnce(); // tir immédiat
  simTimer = setInterval(simulateOnce, sec*1000);
  simStartBtn.disabled=true; simStopBtn.disabled=false;
}
function stopSim(){
  if(simTimer){ clearInterval(simTimer); simTimer=null; }
  simStartBtn.disabled=false; simStopBtn.disabled=true;
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async ()=>{
  try{ await initRevealStage(); }catch(e){ showError('Reveal init error: '+(e.message||e)); }
  await loadInitialTotals();
  mountPaymentElement();

  if(isTestMode && testPanel){
    testPanel.classList.remove('hidden');
    simStartBtn?.addEventListener('click', startSim);
    simStopBtn?.addEventListener('click', stopSim);
  }
});

// Payment element refresh on amount change
amountEl.addEventListener('change', ()=> mountPaymentElement());
// Donate
donateBtn.addEventListener('click', async ()=>{
  await unlockAudio(); donateBtn.disabled=true; clearError();
  try{ await confirmAndRecord(); }catch(e){ showError(e.message||String(e)); } finally { donateBtn.disabled=false; }
});
