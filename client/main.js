/***** Helpers UI *****/
const notice = document.getElementById('notice');
function showError(msg){ if(!notice) return; notice.textContent=msg; notice.classList.add('error'); notice.classList.remove('hidden'); }
function hideError(){ if(!notice) return; notice.textContent=''; notice.classList.remove('error'); notice.classList.add('hidden'); }

/***** Formats & DOM *****/
const totalEl=document.getElementById('total'), lastEl=document.getElementById('last'), progress=document.getElementById('progress');
const donateBtn=document.getElementById('donateBtn'), pseudoEl=document.getElementById('pseudo'), amountEl=document.getElementById('amount');
const fmtMoney = v => new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);

/***** Socket.io *****/
const socket = window.io ? io() : { on(){}, emit(){} };

/***** Audio + Anim assets *****/
const coinSound = document.getElementById('coinSound');
let audioUnlocked=false;
async function unlockAudio(){ if(audioUnlocked||!coinSound) return;
  try{ coinSound.muted=true; await coinSound.play(); await new Promise(r=>setTimeout(r,10)); coinSound.pause(); coinSound.currentTime=0; coinSound.muted=false; audioUnlocked=true; }catch{}
}
addEventListener('pointerdown',unlockAudio,{once:true}); addEventListener('keydown',unlockAudio,{once:true});

const animCanvas=document.getElementById('animationCanvas'), animCtx=animCanvas.getContext('2d');
function resizeAnim(){ animCanvas.width=innerWidth; animCanvas.height=innerHeight; } addEventListener('resize',resizeAnim); resizeAnim();
function loadImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('img '+src)); i.src=src; }); }
let coinsImg,billsImg,assetsReady=false;
Promise.all([ loadImage('/assets/coins.png').then(i=>coinsImg=i), loadImage('/assets/bills.png').then(i=>billsImg=i) ]).then(()=>assetsReady=true).catch(()=>{});
let particles=[];
function addParticles(amount){ if(!assetsReady) return;
  const coins=Math.min(Math.max(3,Math.floor(amount/5)),15), bills=amount>=20?Math.min(Math.floor(amount/20),8):0;
  for(let i=0;i<coins;i++) particles.push({img:coinsImg,x:Math.random()*animCanvas.width,y:-50,vx:(Math.random()-0.5)*1.6,vy:2+Math.random()*2.5,r:Math.random()*Math.PI*2,vr:(Math.random()-0.5)*0.25});
  for(let i=0;i<bills;i++) particles.push({img:billsImg,x:Math.random()*animCanvas.width,y:-50,vx:(Math.random()-0.5)*0.9,vy:1+Math.random()*1.5,r:Math.random()*Math.PI*2,vr:(Math.random()-0.5)*0.08});
}
(function loop(){ animCtx.clearRect(0,0,animCanvas.width,animCanvas.height);
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; animCtx.save(); animCtx.translate(p.x,p.y); animCtx.rotate(p.r); p.img&&animCtx.drawImage(p.img,-p.img.width/2,-p.img.height/2); animCtx.restore();
    p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; if(p.img===coinsImg && p.y+(p.img.height/2)>animCanvas.height){ p.vy*=-0.5; p.y=animCanvas.height-(p.img.height/2); p.vx*=0.7; }
    if(p.y>animCanvas.height+160) particles.splice(i,1); } requestAnimationFrame(loop); })();

/***** Photo SOUS le masque doré *****/
const GRID=1000, TOTAL=GRID*GRID;
const photoCanvas=document.getElementById('photoCanvas'), maskCanvas=document.getElementById('maskCanvas');
const photoCtx=photoCanvas.getContext('2d'); const maskCtx=maskCanvas.getContext('2d',{willReadFrequently:true});
let photoImg=null, maskImageData=null, revealedCount=0;

function drawPhotoCover(){
  const cw=photoCanvas.width, ch=photoCanvas.height; photoCtx.clearRect(0,0,cw,ch);
  if(!photoImg) return;
  const iw=photoImg.width, ih=photoImg.height, cr=cw/ch, ir=iw/ih;
  let sx,sy,sw,sh; if(ir>cr){ sh=ih; sw=ih*cr; sx=(iw-sw)/2; sy=0; } else { sw=iw; sh=iw/cr; sx=0; sy=(ih-sh)/2; }
  photoCtx.drawImage(photoImg, sx,sy,sw,sh, 0,0,cw,ch);
}

async function initRevealStage(){
  // Dimensions (photo haute résolution, masque 1000x1000)
  photoCanvas.width=1080; photoCanvas.height=1616;
  maskCanvas.width=GRID;  maskCanvas.height=GRID;

  // Charge la photo dessous
  try{ photoImg = await loadImage('/assets/me.jpg'); }catch{}
  if(!photoImg){ const g=photoCtx.createLinearGradient(0,0,photoCanvas.width,photoCanvas.height); g.addColorStop(0,'#111'); g.addColorStop(1,'#222'); photoCtx.fillStyle=g; photoCtx.fillRect(0,0,photoCanvas.width,photoCanvas.height); }
  else { drawPhotoCover(); }

  // Mosaïque dorée OPAQUE au-dessus
  const img=maskCtx.createImageData(GRID,GRID), a=img.data, PAL=[[201,173,67],[212,175,55],[184,134,11],[230,190,95],[255,215,0]];
  for(let i=0;i<TOTAL;i++){ const base=PAL[(Math.random()*PAL.length)|0], vr=(Math.random()*26-13), vg=(Math.random()*26-13), vb=(Math.random()*26-13);
    const r=Math.max(0,Math.min(255,base[0]+vr)), g=Math.max(0,Math.min(255,base[1]+vg)), b=Math.max(0,Math.min(255,base[2]+vb));
    const j=i*4; a[j]=r; a[j+1]=g; a[j+2]=b; a[j+3]=255; } // alpha 255 = opaque
  maskImageData=img; maskCtx.putImageData(maskImageData,0,0);
}

// Révèle t pixels au total (alpha→0 donc on voit la photo dessous)
function revealTo(target){ target=Math.max(0,Math.min(TOTAL,Math.floor(target))); if(!maskImageData) return; const data=maskImageData.data;
  while(revealedCount<target){ const idx=(Math.random()*TOTAL)|0; const p=idx*4; if(data[p+3]===0) continue; data[p+3]=0; revealedCount++; if((revealedCount & 8191)===0) maskCtx.putImageData(maskImageData,0,0); }
  maskCtx.putImageData(maskImageData,0,0);
}

/***** Jauge + binding *****/
let prevTotal=0;
function applyTotalsNet(totalNet,last){
  const t=Number(totalNet)||0;
  if(totalEl) totalEl.textContent=fmtMoney(t);
  const pct=Math.max(0,Math.min(100,(t/1_000_000)*100));
  if(progress){ progress.style.width=`${pct}%`; if(pct>0) progress.classList.add('nonzero'); else progress.classList.remove('nonzero'); }
  if(lastEl) lastEl.textContent=last?`Thanks to the last donor : ${last.pseudo} ($${last.amount})`:'Thanks to the last donor : -';
  revealTo(t);
  // feedback
  const d = Math.floor(t - prevTotal);
  if (d>0){ try{ coinSound.currentTime=0; coinSound.play().catch(()=>{});}catch{} addParticles(d); }
  prevTotal=t;
}

/***** Chargement initial + socket *****/
async function loadInitialTotals(){ let serverTotal=null,last=null; const urls=['/api/summary','/api/donations/summary','/api/total'];
  for(const u of urls){ try{ const r=await fetch(u,{cache:'no-store'}); if(!r.ok) continue; const d=await r.json();
      if(typeof d.totalNet!=='undefined'){ serverTotal=Number(d.totalNet)||0; last=d.last||null; break; }
      if(typeof d.total!=='undefined'){ serverTotal=Number(d.total)||0; last=d.last||null; break; } }catch{} }
  applyTotalsNet(serverTotal ?? 7219.54, last);
}
socket.on('update',({ totalNet, last }) => applyTotalsNet(totalNet, last));

/***** Stripe Payment Element *****/
let stripe,elements,paymentElement;
function waitStripe(){ return new Promise((ok,ko)=>{ const t=setTimeout(()=>ko(new Error('Stripe.js not loaded')),10000); (function c(){ if(window.Stripe){ clearTimeout(t); ok(); } else setTimeout(c,50); })(); }); }
async function fetchConfig(){ const r=await fetch('/api/config',{cache:'no-store'}); const d=await r.json(); if(!d.publishableKey) throw new Error('Missing STRIPE_PUBLISHABLE_KEY on server'); return d; }
async function createPI(amount,pseudo){ const r=await fetch('/api/create-payment-intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,pseudo})}); const d=await r.json(); if(!r.ok||!d.clientSecret) throw new Error(d.error||'PaymentIntent failed'); return d.clientSecret; }
async function mountPaymentElement(){
  hideError(); const errBox=document.getElementById('payment-error'); if(errBox){ errBox.textContent=''; errBox.classList.add('hidden'); }
  try{
    await waitStripe(); const { publishableKey } = await fetchConfig(); stripe = Stripe(publishableKey);
    const amount = Math.max(1, Math.floor(Number(amountEl?.value || 1))), pseudo = (pseudoEl?.value || 'Anonymous').slice(0,50);
    const clientSecret = await createPI(amount, pseudo);
    if(paymentElement) paymentElement.destroy(); elements = stripe.elements({ clientSecret }); paymentElement = elements.create('payment'); paymentElement.mount('#payment-element');
    if(donateBtn) donateBtn.disabled=false; const diag=document.getElementById('stripe-diag'); if(diag) diag.classList.add('hidden');
  }catch(e){
    const msg='Stripe init error: '+(e.message||e); showError(msg);
    const errBox=document.getElementById('payment-error'); if(errBox){ errBox.textContent=msg; errBox.classList.remove('hidden'); }
  }
}
async function confirmAndRecord(){
  const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' }); if(error) throw new Error(error.message||'Payment failed');
  const amt=Math.max(1,Math.floor(Number(amountEl?.value||1))); try{ coinSound.currentTime=0; await coinSound.play(); }catch{} addParticles(amt);
  const pseudo=(pseudoEl?.value||'Anonymous').slice(0,50);
  const r=await fetch('/api/donate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pseudo,amount:amt})});
  const data=await r.json(); if(!r.ok||!data.success) throw new Error(data.error||'Donation save failed');
  applyTotalsNet(data.totalNet,data.last); await mountPaymentElement();
}

/***** Boot *****/
document.addEventListener('DOMContentLoaded', async () => { await initRevealStage(); await loadInitialTotals(); mountPaymentElement().catch(()=>{}); });
amountEl?.addEventListener('change', ()=>{ mountPaymentElement().catch(()=>{}); });
donateBtn?.addEventListener('click', async () => { await unlockAudio(); donateBtn.disabled=true; hideError(); try{ await confirmAndRecord(); }catch(e){ showError(e.message||String(e)); } finally{ donateBtn.disabled=false; } });
