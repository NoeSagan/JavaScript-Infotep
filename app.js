const CFG = {
  cheapshark: 'https://www.cheapshark.com/api/1.0',
  steamStore: 'https://store.steampowered.com/api/appdetails',
  corsProxy:  'https://corsproxy.io/?',
  ocBase:     'https://opencritic-api.p.rapidapi.com',
  ocHost:     'opencritic-api.p.rapidapi.com',
  rapidKey:   '860fa2a626msh8bfefe5e57cfe4bp12037fjsn3ea432dc86a3',
};

const STORE_NAMES = {
  '1':'Steam','2':'GamersGate','3':'GreenManGaming','7':'GOG',
  '8':'Origin','11':'Humble Bundle','13':'Fanatical','14':'Blizzard',
  '15':'GameBillet','21':'WinGameStore','23':'GamesPlanet',
  '25':'Epic Games','27':'IndieGala','29':'Razer Game Store',
};

const state = {
  dealsPage:   0,
  sortBy:      'DealRating',
  storeFilter: '',
  debounce:    null,
};

const $ = id => document.getElementById(id);

function storeName(id) {
  return STORE_NAMES[String(id)] || 'Tienda ' + id;
}

function mcClass(n) {
  n = parseInt(n, 10);
  return n >= 75 ? 'mc-good' : n >= 50 ? 'mc-ok' : 'mc-bad';
}

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(li|p|div|tr)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');
  return (d.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function formatPrice(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 'Ver precio' : n === 0 ? 'GRATIS' : '$' + n.toFixed(2);
}

function setLoading(container, msg) {
  container.innerHTML = '<div class="loading-state">' + msg + '<div class="spinner"></div></div>';
}

function setEmpty(container, msg) {
  container.innerHTML = '<div class="empty-state">' + msg + '</div>';
}

function setMode(mode) {
  $('grid-title').textContent    = mode === 'deals' ? 'Mejores Ofertas' : 'Resultados';
  $('filters-bar').style.display = mode === 'deals' ? '' : 'none';
  $('load-more-btn').classList.toggle('hidden', mode !== 'deals');
  $('back-btn').classList.toggle('hidden', mode !== 'search');
}

const api = {

  async getDeals({ sortBy = 'DealRating', storeID = '', pageNumber = 0, pageSize = 12 } = {}) {
    const p = new URLSearchParams({ sortBy, pageNumber, pageSize });
    if (storeID) p.set('storeID', storeID);
    const r = await fetch(CFG.cheapshark + '/deals?' + p);
    if (!r.ok) throw new Error('Error al obtener ofertas');
    return r.json();
  },

  async searchGames(title, limit = 12) {
    const p = new URLSearchParams({ title, limit });
    const r = await fetch(CFG.cheapshark + '/games?' + p);
    if (!r.ok) throw new Error('Error en la busqueda');
    return r.json();
  },

  async getGameDetails(gameID) {
    const r = await fetch(CFG.cheapshark + '/games?id=' + gameID);
    if (!r.ok) throw new Error('No se pudo cargar el juego');
    return r.json();
  },

  async getSteamData(appId) {
    if (!appId || appId === '0') return null;
    try {
      const url = CFG.corsProxy + CFG.steamStore + '?appids=' + appId + '&l=spanish';
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      return data[String(appId)]?.success ? data[String(appId)].data : null;
    } catch { return null; }
  },

  async getDealsByTitle(title) {
    if (!title) return [];
    try {
      const p = new URLSearchParams({ title, pageSize: 60, exact: 1 });
      const r = await fetch(CFG.cheapshark + '/deals?' + p);
      if (!r.ok) return [];
      return r.json();
    } catch { return []; }
  },

  async getOpenCritic(title) {
    if (!title) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const headers = { 'x-rapidapi-key': CFG.rapidKey, 'x-rapidapi-host': CFG.ocHost };
      const sr = await fetch(CFG.ocBase + '/game/search?criteria=' + encodeURIComponent(title), { headers, signal: ctrl.signal });
      if (!sr.ok) return null;
      const results = await sr.json();
      if (!results?.length) return null;
      const id = results[0].id;
      const gr = await fetch(CFG.ocBase + '/game/' + id, { headers, signal: ctrl.signal });
      if (!gr.ok) return null;
      return gr.json();
    } catch { return null; }
    finally { clearTimeout(timer); }
  },
};

function createGameCard(deal, gameID) {
  const card = document.createElement('div');
  card.className = 'game-card';

  const sale   = parseFloat(deal.salePrice  || 0);
  const normal = parseFloat(deal.normalPrice || 0);
  const savings = parseFloat(deal.savings || 0);
  const mc      = deal.metacriticScore && deal.metacriticScore !== '0' ? deal.metacriticScore : null;

  card.innerHTML =
    (mc ? '<span class="mc-badge ' + mcClass(mc) + '" title="Metacritic">' + mc + '</span>' : '') +
    (deal.thumb
      ? '<img class="game-thumb" src="' + deal.thumb + '" alt="' + deal.title + '" loading="lazy" onerror="this.nextElementSibling.style.display=\'block\';this.remove()">'
      : '') +
    '<div class="game-thumb-placeholder"' + (deal.thumb ? ' style="display:none"' : '') + '></div>' +
    '<div class="card-body">' +
      '<div class="card-title" title="' + deal.title + '">' + deal.title + '</div>' +
      '<div class="card-prices">' +
        '<span class="price-sale">' + formatPrice(sale) + '</span>' +
        (normal > sale ? '<span class="price-normal">$' + normal.toFixed(2) + '</span>' : '') +
        (savings > 4   ? '<span class="discount-tag">-' + Math.round(savings) + '%</span>' : '') +
      '</div>' +
      (deal.storeID        ? '<span class="store-name">'  + storeName(deal.storeID) + '</span>' : '') +
      (deal.steamRatingText ? '<div class="steam-rating">' + deal.steamRatingText + (deal.steamRatingPercent ? ' (' + deal.steamRatingPercent + '%)' : '') + '</div>' : '') +
    '</div>';

  card.addEventListener('click', () =>
    openGameModal(gameID || deal.gameID, deal.title, deal.thumb, deal.steamAppID)
  );
  return card;
}

async function loadDeals(append = false) {
  const grid = $('main-grid');
  setMode('deals');

  if (!append) {
    state.dealsPage = 0;
    setLoading(grid, 'Cargando ofertas...');
  } else {
    state.dealsPage++;
  }

  try {
    const deals = await api.getDeals({
      sortBy:     state.sortBy,
      storeID:    state.storeFilter,
      pageNumber: state.dealsPage,
    });
    if (!append) grid.innerHTML = '';
    if (!deals.length && !append) { setEmpty(grid, 'No hay ofertas con estos filtros.'); return; }
    deals.forEach(d => grid.appendChild(createGameCard(d)));
  } catch (err) {
    setEmpty(grid, err.message);
  }
}

async function runSearch(query) {
  if (!query) return;
  const grid = $('main-grid');
  setMode('search');
  $('grid-title').textContent = 'Resultados: "' + query + '"';
  setLoading(grid, 'Buscando "' + query + '"...');

  try {
    const games = await api.searchGames(query, 20);
    grid.innerHTML = '';
    if (!games.length) { setEmpty(grid, 'Sin resultados. Intenta con otro nombre.'); return; }
    games.forEach(g => {
      const deal = {
        title: g.external, salePrice: g.cheapest, normalPrice: g.cheapest,
        savings: 0, thumb: g.thumb, storeID: '', steamAppID: g.steamAppID,
      };
      grid.appendChild(createGameCard(deal, g.gameID));
    });
  } catch (err) {
    setEmpty(grid, err.message);
  }
}

async function updateSuggestions(query) {
  const box = $('search-suggestions');
  if (!query || query.length < 2) { box.classList.add('hidden'); return; }

  try {
    const games = await api.searchGames(query, 5);
    box.innerHTML = '';
    if (!games.length) { box.classList.add('hidden'); return; }
    games.forEach(g => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML =
        (g.thumb ? '<img src="' + g.thumb + '" alt="">' : '') +
        '<span class="sug-name">' + g.external + '</span>' +
        (g.cheapest ? '<span class="sug-price">desde $' + parseFloat(g.cheapest).toFixed(2) + '</span>' : '');
      item.addEventListener('click', () => {
        $('search-input').value = g.external;
        box.classList.add('hidden');
        runSearch(g.external);
      });
      box.appendChild(item);
    });
    box.classList.remove('hidden');
  } catch {
    box.classList.add('hidden');
  }
}

async function openGameModal(gameID, title, thumb, steamAppID) {
  const modal = $('game-modal');
  const body  = $('modal-body');
  modal.classList.remove('hidden');
  setLoading(body, 'Cargando ' + title + '...');

  try {
    const [csRes, steamRes, ocRes, titleDealsRes] = await Promise.allSettled([
      api.getGameDetails(gameID),
      api.getSteamData(steamAppID),
      api.getOpenCritic(title),
      api.getDealsByTitle(title),
    ]);

    const cs         = csRes.status         === 'fulfilled' ? csRes.value         : null;
    const steam      = steamRes.status      === 'fulfilled' ? steamRes.value      : null;
    const oc         = ocRes.status         === 'fulfilled' ? ocRes.value         : null;
    const titleDeals = titleDealsRes.status === 'fulfilled' ? titleDealsRes.value : [];

    const info     = cs?.info              || {};
    const cheapest = cs?.cheapestPriceEver || {};

    const normalize = d => ({
      storeID: d.storeID, dealID: d.dealID,
      price: d.price ?? d.salePrice,
      retailPrice: d.retailPrice ?? d.normalPrice,
      savings: d.savings,
    });
    const dealsMap = new Map();
    titleDeals.forEach(d => dealsMap.set(d.storeID, normalize(d)));
    (cs?.deals || []).forEach(d => dealsMap.set(d.storeID, normalize(d)));
    const deals = [...dealsMap.values()];

    const gameTitle = steam?.name || title;
    const mc        = info.metacriticScore && info.metacriticScore !== '0' ? info.metacriticScore : null;
    const cover     = steam?.header_image || thumb || '';

    let html = '<div class="game-detail-header">';
    if (cover) html += '<img class="game-detail-cover" src="' + cover + '" alt="' + gameTitle + '">';
    html += '<div class="game-detail-info"><h2>' + gameTitle + '</h2>';
    if (mc) {
      const bg = parseInt(mc, 10) >= 75 ? '#4ade80' : parseInt(mc, 10) >= 50 ? '#facc15' : '#ef4444';
      html += '<span class="mc-pill" style="background:' + bg + '">Metacritic: ' + mc + '</span>';
    }
    if (oc?.topCriticScore != null && oc.topCriticScore > 0) {
      const ocScore = Math.round(oc.topCriticScore);
      const ocBg = ocScore >= 75 ? '#4ade80' : ocScore >= 50 ? '#facc15' : '#ef4444';
      html += '<span class="mc-pill" style="background:' + ocBg + ';margin-left:.4rem">OpenCritic: ' + ocScore + '</span>';
    }
    if (cheapest.price) html += '<p class="muted" style="margin-top:.4rem">Minimo historico: <strong style="color:#22c55e">$' + parseFloat(cheapest.price).toFixed(2) + '</strong></p>';
    if (info.reviewText) html += '<p class="muted" style="font-size:.78rem;margin-top:.2rem">Steam: ' + info.reviewText + '</p>';
    if (steam?.short_description) html += '<p class="game-detail-desc">' + stripHtml(steam.short_description) + '</p>';
    html += '</div></div>';

    html += '<div class="sec-label">Comparacion de precios</div>';
    if (deals.length) {
      html += '<div class="table-scroll"><table class="prices-table"><thead><tr>';
      html += '<th>Tienda</th><th>Precio oferta</th><th>Precio normal</th><th>Descuento</th><th>Enlace</th>';
      html += '</tr></thead><tbody>';
      deals.forEach(d => {
        html += '<tr><td>' + storeName(d.storeID) + '</td>';
        html += '<td class="price-col">'  + formatPrice(d.price) + '</td>';
        html += '<td class="retail-col">$' + parseFloat(d.retailPrice || 0).toFixed(2) + '</td>';
        html += '<td>' + (parseFloat(d.savings || 0) > 0 ? '<span class="discount-tag">-' + Math.round(d.savings) + '%</span>' : '—') + '</td>';
        html += '<td><a href="https://www.cheapshark.com/redirect?dealID=' + d.dealID + '" target="_blank" rel="noopener">Ver oferta</a></td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<p class="muted">Sin ofertas activas ahora mismo.</p>';
    }

    const steamShots = (steam?.screenshots || []).map(s => s.path_full).filter(Boolean);
    const ocShots    = (oc?.Medias || []).filter(m => m.screenshotUrl).map(m => m.screenshotUrl);
    const shots      = (steamShots.length ? steamShots : ocShots).slice(0, 8);

    if (shots.length) {
      html += '<div class="sec-label">Imagenes</div>';
      html += '<div class="slideshow" data-index="0">';
      shots.forEach((src, i) =>
        html += '<div class="slide' + (i === 0 ? ' active' : '') + '"><img src="' + src + '" alt="screenshot" loading="lazy"></div>'
      );
      if (shots.length > 1) {
        html += '<button class="slide-btn slide-prev">&#10094;</button>';
        html += '<button class="slide-btn slide-next">&#10095;</button>';
        html += '<div class="slide-dots">';
        shots.forEach((_, i) =>
          html += '<span class="dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></span>'
        );
        html += '</div>';
      }
      html += '</div>';
    }

    if (steam?.pc_requirements) html += buildReqsSection(steam.pc_requirements);

    if (steam?.genres?.length) {
      html += '<div class="sec-label">Generos</div><div class="tags">';
      steam.genres.forEach(g => { html += '<span class="tag">' + g.description + '</span>'; });
      html += '</div>';
    }

    if (steam?.release_date?.date) {
      html += '<p class="muted" style="margin-top:.9rem">Lanzamiento: ' + steam.release_date.date + '</p>';
    }

    body.innerHTML = html;

  } catch (err) {
    setEmpty(body, err.message);
  }
}

function buildReqsSection(reqs) {
  const min = reqs.minimum     ? stripHtml(reqs.minimum)     : null;
  const rec = reqs.recommended ? stripHtml(reqs.recommended) : null;
  if (!min && !rec) return '';

  let html = '<div class="sec-label">Requisitos del sistema</div>';
  html += '<div class="req-tabs">';
  if (min) html += '<button class="req-tab active" data-target="req-min">Minimos</button>';
  if (rec) html += '<button class="req-tab' + (min ? '' : ' active') + '" data-target="req-rec">Recomendados</button>';
  html += '</div>';
  if (min) html += '<div id="req-min" class="req-block">' + min + '</div>';
  if (rec) html += '<div id="req-rec" class="req-block' + (min ? ' hidden' : '') + '">' + rec + '</div>';
  return html;
}

$('modal-body').addEventListener('click', e => {
  const tab = e.target.closest('.req-tab');
  if (tab) {
    const box = tab.closest('.modal-box');
    box.querySelectorAll('.req-tab').forEach(t => t.classList.remove('active'));
    box.querySelectorAll('.req-block').forEach(b => b.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target)?.classList.remove('hidden');
    return;
  }

  const btn = e.target.closest('.slide-prev, .slide-next');
  if (btn) {
    const sw     = btn.closest('.slideshow');
    const slides = sw.querySelectorAll('.slide');
    const dots   = sw.querySelectorAll('.dot');
    let idx = parseInt(sw.dataset.index, 10);
    slides[idx].classList.remove('active');
    if (dots[idx]) dots[idx].classList.remove('active');
    idx = btn.classList.contains('slide-prev')
      ? (idx - 1 + slides.length) % slides.length
      : (idx + 1) % slides.length;
    slides[idx].classList.add('active');
    if (dots[idx]) dots[idx].classList.add('active');
    sw.dataset.index = idx;
    return;
  }

  const dot = e.target.closest('.dot');
  if (dot) {
    const sw     = dot.closest('.slideshow');
    const slides = sw.querySelectorAll('.slide');
    const dots   = sw.querySelectorAll('.dot');
    const cur    = parseInt(sw.dataset.index, 10);
    const newIdx = parseInt(dot.dataset.idx, 10);
    if (cur === newIdx) return;
    slides[cur].classList.remove('active');
    dots[cur].classList.remove('active');
    slides[newIdx].classList.add('active');
    dots[newIdx].classList.add('active');
    sw.dataset.index = newIdx;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  $('search-btn').addEventListener('click', () => {
    $('search-suggestions').classList.add('hidden');
    runSearch($('search-input').value.trim());
  });

  $('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      $('search-suggestions').classList.add('hidden');
      runSearch($('search-input').value.trim());
    }
  });

  $('search-input').addEventListener('input', e => {
    clearTimeout(state.debounce);
    state.debounce = setTimeout(() => updateSuggestions(e.target.value.trim()), 320);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper'))
      $('search-suggestions').classList.add('hidden');
  });

  $('sort-deals').addEventListener('change',   e => { state.sortBy = e.target.value; loadDeals(); });
  $('store-filter').addEventListener('change', e => { state.storeFilter = e.target.value; loadDeals(); });

  $('load-more-btn').addEventListener('click', () => loadDeals(true));
  $('back-btn').addEventListener('click', () => {
    $('search-input').value = '';
    loadDeals();
  });

  $('brand-link').addEventListener('click', () => {
    $('search-input').value = '';
    loadDeals();
  });

  const modal = $('game-modal');
  modal.querySelector('.modal-close').addEventListener('click',   () => modal.classList.add('hidden'));
  modal.querySelector('.modal-overlay').addEventListener('click', () => modal.classList.add('hidden'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') modal.classList.add('hidden');
  });

  loadDeals();
});
