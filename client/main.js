async function loadStats() {
  try {
    const res = await fetch('/api/stats', { cache: 'no-store' });
    const data = res.ok ? await res.json() : { goal: 1000000, totalRaised: 7219.53, pixelsEnabled: false };
    const goal = Number(data.goal || 1000000);
    const raised = Number(data.totalRaised || 7219.53);

    const pct = Math.max(0, Math.min(100, (raised / goal) * 100));
    document.getElementById('gaugeFill').style.width = `${pct}%`;
    document.getElementById('raisedLabel').textContent =
      `$${raised.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    document.getElementById('noticeText').textContent =
      data.pixelsEnabled === false
        ? 'Pixels désactivés temporairement.'
        : 'Affichage des pixels actif.';
  } catch {
    document.getElementById('noticeText').textContent = 'Impossible de charger les stats.';
  }
}
loadStats();
