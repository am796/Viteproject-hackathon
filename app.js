// Frontend behaviour for dashboard
(function(){
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; }

  const authFetch = (url, opts={}) => fetch(url, { ...opts, headers: { ...(opts.headers||{}), Authorization: 'Bearer '+token } });

  const el = (sel)=>document.querySelector(sel);
  const cardsEl = el('#cards');
  const lastUpdatedEl = el('#lastUpdated');
  const roleBadge = el('#roleBadge');
  const filterArea = el('#filterArea');
  const categoryFilter = el('#categoryFilter');

  el('#logout').addEventListener('click', ()=>{ localStorage.removeItem('token'); window.location.href='/'; });

  // Indian currency formatter
  const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  let chartInstance = null;

  async function loadProfileAndSetup() {
    // JWT is not decoded on backend here; decode in frontend just to show role
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      roleBadge.textContent = payload.role || '';
      if (payload.role === 'analyst') filterArea.style.display = 'inline-block';
      if (payload.role === 'admin') {
        // show admin products link
        const a = document.getElementById('adminLink');
        if (a) a.style.display = 'inline-block';
      }
    } catch(e){}
  }

  function showCards(summary){
    cardsEl.innerHTML = '';
    const items = [
      {key:'sales', title:'Total Sales', value: inrFmt.format(summary.totalSales), icon:'�', color:'linear-gradient(135deg,#4f46e5,#06b6d4)'},
      {key:'orders', title:'Total Orders', value:summary.totalOrders, icon:'🧾', color:'linear-gradient(135deg,#fb7185,#f59e0b)'},
      {key:'inventory', title:'Inventory', value:summary.inventoryCount, icon:'📦', color:'linear-gradient(135deg,#10b981,#06b6d4)'}
    ];
    items.forEach(it=>{
      const div = document.createElement('div'); div.className='card';
      const icon = document.createElement('div'); icon.className='icon'; icon.style.background = it.color; icon.textContent = it.icon;
      const body = document.createElement('div'); body.className='card-body';
      body.innerHTML = `<div class="card-title">${it.title}</div><div class="card-value">${it.value}</div>`;
      div.appendChild(icon); div.appendChild(body);
      cardsEl.appendChild(div);
    });
  }

  async function loadSummary(){
    const res = await authFetch('/api/summary');
    if (!res.ok) return;
    const j = await res.json();
    showCards(j);
  }

  async function loadChart(){
    const res = await authFetch('/api/chart');
    if (!res.ok) return;
    const j = await res.json();
    const ctx = document.getElementById('chart').getContext('2d');
    if (chartInstance) {
      chartInstance.data.labels = j.months;
      chartInstance.data.datasets[0].data = j.values;
      chartInstance.update();
    } else {
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: j.months, datasets: [{ label: 'Sales', data: j.values, backgroundColor:'rgba(33,150,243,0.85)', borderRadius:6 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              ticks: {
                callback: function(value){ return inrFmt.format(value); }
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(ctx){ return inrFmt.format(ctx.parsed.y); }
              }
            },
            legend: { display: false }
          }
        }
      });
    }
  }

  function renderTable(rows){
    const wrap = document.getElementById('tableWrap');
    if (!rows || rows.length===0) { wrap.innerHTML = '<div class="muted">No records found</div>'; return; }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Product</th><th>Category</th><th>Amount</th></tr></thead>';
    const tb = document.createElement('tbody');
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.product)}</td><td>${escapeHtml(r.category)}</td><td>${inrFmt.format(r.amount)}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    wrap.innerHTML = '';
    wrap.appendChild(table);
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

  async function loadRows(){
    const q = categoryFilter.value ? `?category=${encodeURIComponent(categoryFilter.value)}` : '';
    const res = await authFetch('/api/rows'+q);
    if (!res.ok) {
      document.getElementById('tableWrap').innerHTML = '<div class="muted">Failed to load rows</div>';
      return;
    }
    const j = await res.json();
    renderTable(j.rows);
    // populate filter list if empty
    const cats = [...new Set((j.rows||[]).map(r=>r.category).filter(Boolean))];
    if (categoryFilter.children.length<=1 && cats.length) {
      cats.forEach(c=>{ const o = document.createElement('option'); o.value=c; o.textContent=c; categoryFilter.appendChild(o); });
    }
  }

  categoryFilter.addEventListener('change', ()=>{ loadRows(); loadChart(); });

  async function refreshAll(){
    await loadSummary();
    await loadChart();
    await loadRows();
    lastUpdatedEl.textContent = 'Last updated: '+(new Date()).toLocaleTimeString();
  }

  // optional polling to simulate live updates
  setInterval(async ()=>{
    try { await fetch('/api/simulate', { method: 'POST' }); } catch(e){}
    await refreshAll();
  }, 15000);

  (async function init(){
    await loadProfileAndSetup();
    await refreshAll();
  })();

})();
