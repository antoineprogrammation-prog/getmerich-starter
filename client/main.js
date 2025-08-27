async function loadStats() {
  try {
    const res = await fetch('/api/stats', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const goal = Number(data.goal || 1000000);
    const raised = Number(data.totalRaised || 0);

    const pct = Math.max(0, Math.min(100, (raised / goal) * 100));
    const gaugeFill = document.getElementById('gaugeFill');
    const raisedLabel = document.getElementById('raisedLabel');
    const noticeText = document.getElementById('noticeText');

    gaugeFill.style.width = `${pct}%`;
    raisedLabel.textContent = `$${raised.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (data.pixelsEnabled === false) {
      noticeText.textContent = data.message || 'Pixels désactivés temporairement.';
    } else {
      noticeText.textContent = 'Affichage des pixels actif.';
    }
  } catch (err) {
    console.error(err);
    document.getElementById('noticeText').textContent = 'Impossible de charger les stats.';
  }
}

loadStats();
