import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadData() {
  const dataDir = process.env.CHRONICLE_DATA_DIR || path.join(__dirname, 'data');

  let raw = {
    campaigns: [],
    activeCampaignId: 'campaign-semien',
    characters: [],
    timeline: [],
    tomes: [],
    relationships: [],
    threads: [],
    houses: [],
  };

  const campaignsPath = path.join(dataDir, 'campaigns.json');
  const activePath = path.join(dataDir, 'active-campaign.json');
  const charsPath = path.join(dataDir, 'characters.json');
  const timelinePath = path.join(dataDir, 'timeline.json');
  const tomesPath = path.join(dataDir, 'tomes.json');
  const relsPath = path.join(dataDir, 'relationships.json');
  const threadsPath = path.join(dataDir, 'threads.json');
  const housesPath = path.join(dataDir, 'houses.json');

  if (fs.existsSync(campaignsPath)) raw.campaigns = JSON.parse(fs.readFileSync(campaignsPath, 'utf-8'));
  if (fs.existsSync(activePath)) {
    try {
      const act = JSON.parse(fs.readFileSync(activePath, 'utf-8'));
      if (act && act.activeCampaignId) raw.activeCampaignId = act.activeCampaignId;
    } catch (e) {}
  }
  if (fs.existsSync(charsPath)) raw.characters = JSON.parse(fs.readFileSync(charsPath, 'utf-8'));
  if (fs.existsSync(timelinePath)) raw.timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
  if (fs.existsSync(tomesPath)) raw.tomes = JSON.parse(fs.readFileSync(tomesPath, 'utf-8'));
  if (fs.existsSync(relsPath)) raw.relationships = JSON.parse(fs.readFileSync(relsPath, 'utf-8'));
  if (fs.existsSync(threadsPath)) raw.threads = JSON.parse(fs.readFileSync(threadsPath, 'utf-8'));
  if (fs.existsSync(housesPath)) raw.houses = JSON.parse(fs.readFileSync(housesPath, 'utf-8'));

  // Target campaign resolution from CLI argument
  const targetArg = process.argv[2] ? process.argv[2].trim().toLowerCase() : null;
  let targetCampaign = null;

  if (targetArg) {
    targetCampaign = raw.campaigns.find(
      (c) => c.id.toLowerCase() === targetArg || c.name.toLowerCase() === targetArg
    );
    if (!targetCampaign) {
      console.warn(`Warning: Campaign '${process.argv[2]}' not found in data/campaigns.json. Falling back to active campaign.`);
    }
  }

  if (!targetCampaign) {
    targetCampaign = raw.campaigns.find((c) => c.id === raw.activeCampaignId) || raw.campaigns[0] || {
      id: 'campaign-semien',
      name: 'Semien',
    };
  }

  const campaignId = targetCampaign.id;

  // Filter entity collections by target campaign ID
  const filtered = {
    campaign: targetCampaign,
    characters: raw.characters.filter((c) => c.campaignId === campaignId),
    timeline: raw.timeline.filter((e) => e.campaignId === campaignId),
    tomes: raw.tomes.filter((t) => t.campaignId === campaignId),
    relationships: raw.relationships.filter((r) => r.campaignId === campaignId),
    threads: raw.threads.filter((t) => t.campaignId === campaignId),
    houses: raw.houses.filter((h) => h.campaignId === campaignId),
  };

  return filtered;
}

const data = loadData();
const campaignName = data.campaign.name || 'Chronicle';
const slug = (data.campaign.name || 'chronicle').toLowerCase().replace(/[^a-z0-9]/g, '-');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Chronicle — ${campaignName}</title>
<style>
  :root{
    --vellum: #ECE1C4;
    --vellum-deep: #DFCFA3;
    --vellum-card: #F3E9CC;
    --ink: #2B2115;
    --ink-soft: #5C4C36;
    --seal: #7C2A25;
    --seal-dark: #5E1F1B;
    --gold: #A9812C;
    --forest: #3B4A32;
    --line: rgba(43,33,21,0.18);
    --shadow: rgba(43,33,21,0.25);
    --font-display: "Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,serif;
    --font-body: Georgia,"Palatino Linotype","Book Antiqua",serif;
    --font-utility: "Courier New",Courier,monospace;
  }

  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;height:100%;}
  body{
    background:
      radial-gradient(ellipse at top left, rgba(169,129,44,0.10), transparent 45%),
      radial-gradient(ellipse at bottom right, rgba(124,42,37,0.08), transparent 50%),
      var(--vellum);
    color:var(--ink);
    font-family:var(--font-body);
    -webkit-font-smoothing:antialiased;
    height:100vh;
    overflow:hidden;
  }

  #app{ display:flex; flex-direction:column; height:100%; }

  /* ---------- HEADER ---------- */
  header{
    display:flex; align-items:center; gap:16px;
    padding:14px 22px;
    border-bottom:2px solid var(--line);
    background:linear-gradient(180deg, rgba(255,255,255,0.15), transparent);
    flex-shrink:0;
  }
  .seal-badge{
    width:38px;height:38px;border-radius:50%;
    background:radial-gradient(circle at 35% 30%, #9a3a34, var(--seal) 60%, var(--seal-dark) 100%);
    display:flex;align-items:center;justify-content:center;
    color:var(--vellum-card);
    font-family:var(--font-display);
    font-weight:700;
    font-size:16px;
    box-shadow:0 2px 4px var(--shadow), inset 0 1px 1px rgba(255,255,255,0.3);
    flex-shrink:0;
  }
  .title-block{ flex:1; min-width:0; }
  h1{
    margin:0; font-family:var(--font-display);
    font-size:22px; font-weight:700; letter-spacing:0.04em;
    color:var(--ink);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .subtitle{ font-family:var(--font-utility); font-size:11px; letter-spacing:0.08em; color:var(--ink-soft); text-transform:uppercase; }

  .search-wrap{ position:relative; }
  #search{
    background:var(--vellum-card);
    border:1px solid var(--line);
    border-radius:3px;
    padding:8px 12px 8px 30px;
    font-family:var(--font-body);
    font-size:13px;
    color:var(--ink);
    width:220px;
    transition:width 0.2s ease, box-shadow 0.2s ease;
  }
  #search:focus{ width:280px; outline:none; box-shadow:0 0 0 2px rgba(169,129,44,0.3); }
  .search-icon{ position:absolute; left:9px; top:50%; transform:translateY(-50%); font-size:12px; color:var(--ink-soft); pointer-events:none; }

  /* ---------- LAYOUT ---------- */
  #body-wrap{ flex:1; display:flex; min-height:0; }

  nav#sections{
    width:170px; flex-shrink:0;
    border-right:1px solid var(--line);
    padding:16px 0;
    display:flex; flex-direction:column; gap:2px;
    background:rgba(223,207,163,0.35);
  }
  .section-btn{
    background:none; border:none; text-align:left;
    padding:11px 18px; cursor:pointer;
    font-family:var(--font-display); font-size:13px; color:var(--ink-soft);
    border-left:3px solid transparent;
    display:flex; align-items:center; gap:8px;
  }
  .section-btn .count{
    margin-left:auto; font-family:var(--font-utility); font-size:10px; color:var(--ink-soft); opacity:0.75;
  }
  .section-btn:hover{ background:rgba(43,33,21,0.05); color:var(--ink); }
  .section-btn.active{ border-left-color:var(--seal); color:var(--ink); font-weight:700; background:rgba(43,33,21,0.05); }
  .section-btn .glyph{ font-size:14px; width:16px; text-align:center; }

  #list-pane{
    width:320px; flex-shrink:0;
    border-right:1px solid var(--line);
    overflow-y:auto;
    padding:14px;
  }
  #detail-pane{
    flex:1; overflow-y:auto; padding:34px 44px;
    min-width:0;
  }

  .entry-card{
    background:var(--vellum-card);
    border:1px solid var(--line);
    border-radius:3px;
    padding:12px 13px;
    margin-bottom:9px;
    cursor:pointer;
    transition:box-shadow 0.15s ease, border-color 0.15s ease;
  }
  .entry-card:hover{ box-shadow:0 2px 6px var(--shadow); border-color:var(--gold); }
  .entry-card.selected{ border-color:var(--seal); box-shadow:0 0 0 1px var(--seal) inset; }
  .entry-card .ec-title{ font-family:var(--font-display); font-weight:700; font-size:15px; margin-bottom:3px; }
  .entry-card .ec-title.is-dead{ text-decoration:line-through; text-decoration-color:var(--seal); opacity:0.8; }
  .entry-card .ec-meta{ font-family:var(--font-utility); font-size:10px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:0.04em; }
  .entry-card .ec-snippet{ font-size:12px; color:var(--ink-soft); margin-top:5px; line-height:1.4; max-height:2.6em; overflow:hidden; }
  
  .tag-pill{
    display:inline-block; font-family:var(--font-utility); font-size:9.5px;
    background:rgba(59,74,50,0.14); color:var(--forest);
    padding:2px 6px; border-radius:8px; margin:4px 4px 0 0; letter-spacing:0.03em;
  }

  /* ---------- EMPTY STATES ---------- */
  .empty-state{
    text-align:center; padding:70px 20px; color:var(--ink-soft);
  }
  .empty-state .glyph-big{ font-size:34px; margin-bottom:14px; opacity:0.6; }
  .empty-state p{ font-family:var(--font-display); font-size:16px; margin:0 0 16px; }

  /* ---------- DETAIL VIEW ---------- */
  .detail-header{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; gap:16px;}
  .detail-title{ font-family:var(--font-display); font-size:30px; font-weight:700; margin:0; line-height:1.15; color:var(--ink); }
  .detail-title.is-dead{ text-decoration:line-through; text-decoration-color:var(--seal); text-decoration-thickness:2px; color:var(--seal-dark); }
  .detail-meta-row{ font-family:var(--font-utility); font-size:11px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:18px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }
  
  .status-dot{ width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:5px; }
  .status-alive, .status-ruling, .status-open{ background:var(--forest); }
  .status-dead, .status-extinct, .status-resolved{ background:var(--seal); }
  .status-unknown, .status-dormant, .status-vassal, .status-rival{ background:var(--gold); }

  .field-block{ margin-bottom:22px; }
  .field-label{ font-family:var(--font-utility); font-size:10.5px; text-transform:uppercase; letter-spacing:0.08em; color:var(--gold); margin-bottom:6px; font-weight:700; }
  .field-value{ font-size:15.5px; line-height:1.65; white-space:pre-wrap; }

  .dropcap{
    float:left; font-family:var(--font-display); font-size:58px; line-height:0.8;
    padding:8px 8px 0 0; font-weight:700; color:var(--seal);
    text-shadow:1px 1px 0 rgba(169,129,44,0.35);
  }

  hr.divider{ border:none; border-top:1px solid var(--line); margin:26px 0; position:relative; }
  hr.divider::after{ content:"\\2766"; position:absolute; left:50%; top:-9px; transform:translateX(-50%); background:var(--vellum); padding:0 10px; color:var(--gold); font-size:13px; }

  /* ---------- SCROLLBARS ---------- */
  ::-webkit-scrollbar{ width:9px; }
  ::-webkit-scrollbar-track{ background:transparent; }
  ::-webkit-scrollbar-thumb{ background:rgba(43,33,21,0.22); border-radius:5px; }

  /* ---------- MOBILE ---------- */
  #mobile-back{ display:none; }
  @media (max-width: 820px){
    header{ flex-wrap:wrap; }
    #search{ width:140px; }
    #search:focus{ width:170px; }
    #body-wrap{ position:relative; }
    nav#sections{ width:64px; padding:10px 0; }
    .section-btn{ padding:12px 0; justify-content:center; flex-direction:column; gap:3px; font-size:9px; }
    .section-btn .glyph{ font-size:17px; }
    .section-btn .count{ margin-left:0; }
    #list-pane{ width:100%; position:absolute; left:0; top:0; bottom:0; background:var(--vellum); z-index:2; }
    #detail-pane{ width:100%; position:absolute; left:0; top:0; bottom:0; background:var(--vellum); z-index:3; padding:22px; display:none; }
    body.mobile-detail-open #list-pane{ display:none; }
    body.mobile-detail-open #detail-pane{ display:block; }
    #mobile-back{ display:inline-flex; margin-bottom:14px; }
    .detail-title{ font-size:24px; }
  }
</style>
</head>
<body>
<div id="app">
  <header>
    <div class="seal-badge">${campaignName[0] || 'C'}</div>
    <div class="title-block">
      <h1 id="realm-title">The Chronicle — ${campaignName}</h1>
      <div class="subtitle">campaign chronicle record</div>
    </div>
    <div class="search-wrap">
      <span class="search-icon">&#9906;</span>
      <input id="search" type="text" placeholder="Search this campaign...">
    </div>
  </header>

  <div id="body-wrap">
    <nav id="sections">
      <button class="section-btn" data-section="timeline"><span class="glyph">&#9776;</span><span class="label">Timeline</span><span class="count" id="count-timeline"></span></button>
      <button class="section-btn" data-section="characters"><span class="glyph">&#9820;</span><span class="label">Dramatis</span><span class="count" id="count-characters"></span></button>
      <button class="section-btn" data-section="houses"><span class="glyph">&#9819;</span><span class="label">Houses</span><span class="count" id="count-houses"></span></button>
      <button class="section-btn" data-section="threads"><span class="glyph">&#9875;</span><span class="label">Plots</span><span class="count" id="count-threads"></span></button>
      <button class="section-btn" data-section="tomes"><span class="glyph">&#10047;</span><span class="label">Tomes</span><span class="count" id="count-tomes"></span></button>
    </nav>

    <div id="list-pane"></div>
    <div id="detail-pane"></div>
  </div>
</div>

<script>
(function(){
  // Embedded Static Campaign Data
  const CHRONICLE_DATA = ${JSON.stringify(data, null, 2)};

  let state = {
    campaign: CHRONICLE_DATA.campaign,
    characters: CHRONICLE_DATA.characters || [],
    timeline: CHRONICLE_DATA.timeline || [],
    tomes: CHRONICLE_DATA.tomes || [],
    relationships: CHRONICLE_DATA.relationships || [],
    threads: CHRONICLE_DATA.threads || [],
    houses: CHRONICLE_DATA.houses || [],
    currentSection: 'timeline',
    selectedId: null,
    searchTerm: ''
  };

  const SECTION_CONFIG = {
    timeline:   { label:'Timeline', glyph:'&#9776;', singular:'Chronicle Entry', primaryField:'narrative', dateField:'date' },
    characters: { label:'Dramatis Personae', glyph:'&#9820;', singular:'Character', primaryField:'coreDrive', dateField:null },
    houses:     { label:'Noble Houses', glyph:'&#9819;', singular:'House', primaryField:'status', dateField:null },
    threads:    { label:'Plot Threads', glyph:'&#9875;', singular:'Plot Thread', primaryField:'summary', dateField:'status' },
    tomes:      { label:'Tomes', glyph:'&#10047;', singular:'Tome', primaryField:'content', dateField:'category' },
  };

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function illuminate(text){
    if(!text) return '';
    const t = text.trim();
    if(!t) return '';
    const first = escapeHtml(t[0]).toUpperCase();
    const rest = escapeHtml(t.slice(1));
    return \`<span class="dropcap">\${first}</span>\${rest.replace(/\\n/g,'<br>')}\`;
  }

  function getTags(rawTags){
    if(Array.isArray(rawTags)) return rawTags;
    if(typeof rawTags === 'string') return rawTags.split(',').map(t => t.trim()).filter(Boolean);
    return [];
  }

  function currentArray(){ return state[state.currentSection]; }

  function filtered(){
    const arr = currentArray();
    if(!state.searchTerm) return arr;
    const q = state.searchTerm.toLowerCase();
    return arr.filter(e => {
      const hay = (
        (e.title || '') + ' ' + 
        (e.name || '') + ' ' + 
        (e.house || '') + ' ' + 
        (e.summary || '') + ' ' +
        (e.narrative || '') + ' ' + 
        (e.content || '') + ' ' + 
        (e.coreDrive || '') + ' ' + 
        (e.flaw || '') + ' ' + 
        (e.relationships || '') + ' ' + 
        (getTags(e.tags).join(' '))
      ).toLowerCase();
      return hay.includes(q);
    });
  }

  function renderNav(){
    document.querySelectorAll('.section-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === state.currentSection);
    });
    ['characters','timeline','tomes','threads','houses'].forEach(s => {
      const el = document.getElementById('count-'+s);
      if(el) el.textContent = state[s].length || '';
    });
  }

  function cardSnippet(entry, cfg){
    const src = entry[cfg.primaryField] || entry.summary || entry.narrative || entry.content || entry.coreDrive || '';
    return escapeHtml(src).slice(0, 110);
  }

  function renderList(){
    const cfg = SECTION_CONFIG[state.currentSection];
    const pane = document.getElementById('list-pane');
    const items = filtered().slice().sort((a,b) => (b.createdAt||0) - (a.createdAt||0));

    let html = '';

    if(items.length === 0){
      html += \`<div class="empty-state" style="padding:30px 10px;">
        <div class="glyph-big">\${cfg.glyph}</div>
        <p>\${state.searchTerm ? 'No entries match your search.' : 'This section is empty.'}</p>
      </div>\`;
    } else {
      items.forEach(entry => {
        const title = entry.title || entry.name || 'Untitled';
        const isDead = (entry.status || '').toLowerCase() === 'dead' || (entry.status || '').toLowerCase() === 'extinct';
        const metaBits = [];
        if(state.currentSection === 'timeline' && entry.date) metaBits.push(escapeHtml(entry.date));
        if(state.currentSection === 'characters' && entry.house) metaBits.push(escapeHtml(entry.house));
        if(entry.status) metaBits.push(entry.status);
        if(state.currentSection === 'tomes' && entry.category) metaBits.push(escapeHtml(entry.category));

        const tags = getTags(entry.tags);
        const tagsHtml = tags.slice(0, 3).map(t => \`<span class="tag-pill">\${escapeHtml(t)}</span>\`).join('');

        html += \`<div class="entry-card \${entry.id===state.selectedId?'selected':''}" data-id="\${entry.id}">
          <div class="ec-title \${isDead ? 'is-dead' : ''}">\${escapeHtml(title)}</div>
          \${metaBits.length ? \`<div class="ec-meta">\${metaBits.join(' &middot; ')}</div>\` : ''}
          <div class="ec-snippet">\${cardSnippet(entry, cfg)}</div>
          \${tagsHtml ? \`<div style="margin-top:4px;">\${tagsHtml}</div>\` : ''}
        </div>\`;
      });
    }
    pane.innerHTML = html;

    pane.querySelectorAll('.entry-card').forEach(card => {
      card.onclick = () => { 
        state.selectedId = card.dataset.id; 
        document.body.classList.add('mobile-detail-open'); 
        renderAll(); 
      };
    });
  }

  function statusDot(status){
    const s = (status || '').toLowerCase();
    const cls = (s === 'dead' || s === 'extinct' || s === 'resolved') ? 'status-dead' : ((s === 'alive' || s === 'ruling' || s === 'open') ? 'status-alive' : 'status-unknown');
    return \`<span class="status-dot \${cls}"></span>\`;
  }

  function renderDetail(){
    const pane = document.getElementById('detail-pane');
    const cfg = SECTION_CONFIG[state.currentSection];
    const arr = currentArray();

    if(!state.selectedId && arr.length > 0) {
      state.selectedId = arr[0].id;
    }

    const entry = arr.find(e => e.id === state.selectedId);
    const backBtn = \`<button class="btn btn-ghost" id="mobile-back">&larr; Back</button>\`;

    if(!entry){
      pane.innerHTML = backBtn + \`<div class="empty-state">
        <div class="glyph-big">\${cfg.glyph}</div>
        <p>Select an entry from the list to view details.</p>
      </div>\`;
      return;
    }

    const isDead = (entry.status || '').toLowerCase() === 'dead' || (entry.status || '').toLowerCase() === 'extinct';
    let html = backBtn;
    html += \`<div class="detail-header">
      <h2 class="detail-title \${isDead ? 'is-dead' : ''}">\${escapeHtml(entry.title || entry.name || 'Untitled')}</h2>
    </div>\`;

    const tags = getTags(entry.tags);
    const tagsHtml = tags.map(t=>\`<span class="tag-pill">\${escapeHtml(t)}</span>\`).join('');

    if(state.currentSection === 'characters'){
      html += \`<div class="detail-meta-row">\${statusDot(entry.status)}\${escapeHtml(entry.status||'unknown')} &nbsp;&middot;&nbsp; \${escapeHtml(entry.house||'House unknown')}</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;
      
      const fields = [
        ['coreDrive','Core Drive'], ['flaw','Fatal Flaw'], ['face','Face & Bearing'],
        ['voice','Voice'], ['modernAnalogue','Modern Analogue'],
        ['relationships','Relationship Notes'], ['trajectory','Likely Trajectory']
      ];
      let hasIlluminated = false;
      fields.forEach(([key,label]) => {
        if(!entry[key]) return;
        const value = entry[key];
        let contentHtml = '';
        if(!hasIlluminated) {
          contentHtml = illuminate(value);
          hasIlluminated = true;
        } else {
          contentHtml = escapeHtml(value).replace(/\\n/g,'<br>');
        }
        html += \`<div class="field-block"><div class="field-label">\${label}</div><div class="field-value">\${contentHtml}</div></div>\`;
      });

      if (entry.historyLog && entry.historyLog.length > 0) {
        let historyLogHtml = entry.historyLog.map(h => {
          const dateStr = h.date ? \`<span class="tag-pill" style="margin-right:6px; background:rgba(245,158,11,0.15); color:var(--gold);">\${escapeHtml(h.date)}</span>\` : '';
          return \`<div style="margin-bottom:8px; padding-left:10px; border-left:2px solid var(--gold);">\${dateStr}\${escapeHtml(h.note)}</div>\`;
        }).join('');
        html += \`<div class="field-block"><div class="field-label">History Log (\${entry.historyLog.length})</div><div class="field-value">\${historyLogHtml}</div></div>\`;
      }

    } else if(state.currentSection === 'houses'){
      html += \`<div class="detail-meta-row">\${statusDot(entry.status)}\${escapeHtml(entry.status||'unknown')} status</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;
      if(entry.holdings && entry.holdings.length > 0) {
        html += \`<div class="field-block"><div class="field-label">Holdings</div><div class="field-value">\${entry.holdings.map(h => \`<span class="tag-pill">\${escapeHtml(h)}</span>\`).join('')}</div></div>\`;
      }
      if(entry.prestige) {
        html += \`<div class="field-block"><div class="field-label">Prestige</div><div class="field-value">\${entry.prestige}</div></div>\`;
      }
      if (entry.historyLog && entry.historyLog.length > 0) {
        let historyLogHtml = entry.historyLog.map(h => {
          const dateStr = h.date ? \`<span class="tag-pill" style="margin-right:6px;">\${escapeHtml(h.date)}</span>\` : '';
          return \`<div style="margin-bottom:8px; padding-left:10px; border-left:2px solid var(--gold);">\${dateStr}\${escapeHtml(h.note)}</div>\`;
        }).join('');
        html += \`<div class="field-block"><div class="field-label">House History Log</div><div class="field-value">\${historyLogHtml}</div></div>\`;
      }

    } else if(state.currentSection === 'threads'){
      html += \`<div class="detail-meta-row">\${statusDot(entry.status)}\${escapeHtml(entry.status||'open')} plot thread</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;
      html += \`<div class="field-block"><div class="field-label">Summary & Resolution</div><div class="field-value">\${illuminate(entry.summary||'')}</div></div>\`;

    } else if(state.currentSection === 'timeline'){
      html += \`<div class="detail-meta-row">\${entry.date ? '&#8987; '+escapeHtml(entry.date) : ''}</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;
      html += \`<div class="field-value">\${illuminate(entry.narrative||'')}</div>\`;
      if(entry.mechanicalOutcome) {
        html += \`<div class="field-block" style="margin-top:20px; padding:12px; background:rgba(43,33,21,0.06); border-radius:4px;"><div class="field-label">Mechanical Outcome</div><div class="field-value" style="font-size:14px;"><strong>\${escapeHtml(entry.mechanicalOutcome.summary)}</strong></div></div>\`;
      }

    } else if(state.currentSection === 'tomes'){
      html += \`<div class="detail-meta-row">\${entry.category ? escapeHtml(entry.category) : ''}</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;
      html += \`<div class="field-value">\${illuminate(entry.content||'')}</div>\`;
    }

    pane.innerHTML = html;
    const mb = document.getElementById('mobile-back');
    if(mb) mb.onclick = () => { document.body.classList.remove('mobile-detail-open'); };
  }

  function renderAll(){
    renderNav();
    renderList();
    renderDetail();
  }

  document.querySelectorAll('.section-btn').forEach(btn => {
    btn.onclick = () => {
      state.currentSection = btn.dataset.section;
      const arr = currentArray();
      state.selectedId = arr.length > 0 ? arr[0].id : null;
      state.searchTerm = '';
      document.getElementById('search').value = '';
      document.body.classList.remove('mobile-detail-open');
      renderAll();
    };
  });

  let searchDebounce;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { 
      state.searchTerm = e.target.value.trim(); 
      const items = filtered();
      if(items.length > 0) {
        state.selectedId = items[0].id;
      } else {
        state.selectedId = null;
      }
      renderAll();
    }, 120);
  });

  renderAll();
})();
</script>
</body>
</html>
`;

const defaultOutputPath = path.join(__dirname, 'chronicle-viewer.html');
const campaignOutputPath = path.join(__dirname, `chronicle-viewer-${slug}.html`);

fs.writeFileSync(defaultOutputPath, htmlContent, 'utf-8');
fs.writeFileSync(campaignOutputPath, htmlContent, 'utf-8');

console.log(`Successfully generated campaign viewer for '${campaignName}' (${data.campaign.id}):`);
console.log(`- Default file: ${defaultOutputPath}`);
console.log(`- Campaign file: ${campaignOutputPath}`);
console.log(`- Injected ${data.characters.length} characters`);
console.log(`- Injected ${data.timeline.length} timeline events`);
console.log(`- Injected ${data.tomes.length} tomes`);
console.log(`- Injected ${data.relationships.length} relationship edges`);
console.log(`- Injected ${data.threads.length} plot threads`);
console.log(`- Injected ${data.houses.length} noble houses`);
