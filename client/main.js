const socket = io('http://localhost:3000');

const totalEl = document.getElementById('total');
const lastEl = document.getElementById('last');
const progressEl = document.getElementById('progress');
const donateBtn = document.getElementById('donateBtn');
const pseudoEl = document.getElementById('pseudo');
const amountEl = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

const canvas = document.getElementById('animationCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let total = 0;
let lastDonation = { pseudo: '-', amount: 0 };
let particles = [];

const coinsImg = new Image(); coinsImg.src='assets/coins.png';
const billsImg = new Image(); billsImg.src='assets/bills.png';

// WebSocket update
socket.on('update', ({ total: t, last }) => {
  total = t;
  totalEl.textContent = total;
  lastEl.textContent = last ? `Last donor: ${last.pseudo} ($${last.amount})` : '-';
  progressEl.style.width = `${Math.min(total / 1000000 * 100, 100)}%`;
});

// Animation
function createParticles(amount) {
  const maxCoins = Math.min(amount, 10);
  const maxBills = amount >= 20 ? Math.min(amount/2, 5) : 0;

  for(let i=0;i<maxCoins;i++){
    particles.push({ x:Math.random()*canvas.width, y:-50, vy:2+Math.random()*2, vx:Math.random()-0.5, rotation:Math.random()*Math.PI*2, rotationSpeed:(Math.random()-0.5)*0.2, img:coinsImg });
  }
  for(let i=0;i<maxBills;i++){
    particles.push({ x:Math.random()*canvas.width, y:-50, vy:1+Math.random()*1.5, vx:Math.random()*0.5-0.25, rotation:Math.random()*Math.PI*2, rotationSpeed:(Math.random()-0.5)*0.05, img:billsImg });
  }
}

function animate(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  particles.forEach((p,i)=>{
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rotation); ctx.drawImage(p.img,-p.img.width/2,-p.img.height/2); ctx.restore();
    p.y+=p.vy; p.x+=p.vx; p.rotation+=p.rotationSpeed;
    if(p.img===coinsImg && p.y+p.img.height/2>canvas.height){p.vy*=-0.5; p.y=canvas.height-p.img.height/2; p.vx*=0.7;}
    if(p.y>canvas.height+100) particles.splice(i,1);
  });
  requestAnimationFrame(animate);
}
animate();

// Stripe Payment Element
const stripe = Stripe('pk_live_51RzitcB4wKbmyg8LFlaAQ403wWaMaijHAzOJnNihnru0NEVJY9kkzkYzqwHSt2yTBVrsM4G16qFLbXqPpXqrxk8O00yiFIgwWN'); 
let elements, paymentElement;

async function initPayment() {
  const pseudo = pseudoEl.value || 'Anonymous';
  const amount = parseFloat(amountEl.value) || 1;

  const { clientSecret } = await fetch('http://localhost:3000/api/create-payment-intent', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ pseudo, amount })
  }).then(r=>r.json());

  elements = stripe.elements({ clientSecret });
  paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');

  donateBtn.disabled = false;
}

initPayment();

donateBtn.addEventListener('click', async ()=>{
  donateBtn.disabled = true;
  const pseudo = pseudoEl.value || 'Anonymous';
  const amount = parseFloat(amountEl.value) || 1;

  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: { return_url: window.location.href }
  });

  if(error){
    alert(error.message);
    donateBtn.disabled = false;
    return;
  }

  // Jouer son et animations
  coinSound.currentTime=0; coinSound.play().catch(()=>console.log('Sound bloqué'));
  createParticles(amount);

  // Enregistrer le don dans la base
  await fetch('http://localhost:3000/api/donate', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ pseudo, amount })
  });

  // Re-initialiser Payment Element pour un nouveau paiement
  initPayment();
});
