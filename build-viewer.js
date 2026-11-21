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
    secrets: [],
  };

  const campaignsPath = path.join(dataDir, 'campaigns.json');
  const activePath = path.join(dataDir, 'active-campaign.json');
  const charsPath = path.join(dataDir, 'characters.json');
  const timelinePath = path.join(dataDir, 'timeline.json');
  const tomesPath = path.join(dataDir, 'tomes.json');
  const relsPath = path.join(dataDir, 'relationships.json');
  const threadsPath = path.join(dataDir, 'threads.json');
  const housesPath = path.join(dataDir, 'houses.json');
  const secretsPath = path.join(dataDir, 'secrets.json');

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
  if (fs.existsSync(secretsPath)) raw.secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));

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
    secrets: raw.secrets.filter((s) => s.campaignId === campaignId),
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
    --crimson: #9B1C1C;
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
    padding:12px 22px;
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
    padding:7px 12px 7px 30px;
    font-family:var(--font-body);
    font-size:13px;
    color:var(--ink);
    width:200px;
    transition:width 0.2s ease, box-shadow 0.2s ease;
  }
  #search:focus{ width:250px; outline:none; box-shadow:0 0 0 2px rgba(169,129,44,0.3); }
  .search-icon{ position:absolute; left:9px; top:50%; transform:translateY(-50%); font-size:12px; color:var(--ink-soft); pointer-events:none; }

  /* Mode Toggle */
  .mode-toggle-wrap { display:flex; align-items:center; }
  .mode-btn {
    background:var(--vellum-card);
    border:1px solid var(--line);
    border-radius:3px;
    padding:6px 12px;
    font-family:var(--font-display);
    font-size:12px;
    color:var(--ink);
    cursor:pointer;
    display:flex;
    align-items:center;
    gap:6px;
    transition:all 0.2s ease;
    white-space:nowrap;
  }
  .mode-btn:hover { border-color:var(--gold); box-shadow:0 1px 4px var(--shadow); }
  .mode-btn.omniscient {
    background:#2A181C;
    color:#FCD8D8;
    border-color:var(--seal);
    box-shadow:0 0 6px rgba(124,42,37,0.3);
  }

  /* ---------- REALM PULSE BANNER ---------- */
  #realm-banner {
    background:linear-gradient(90deg, rgba(169,129,44,0.14), rgba(124,42,37,0.12));
    border-bottom:1px solid var(--line);
    padding:6px 22px;
    font-size:12px;
    display:flex;
    align-items:center;
    gap:14px;
    flex-shrink:0;
    overflow-x:auto;
  }
  .banner-meta { font-family:var(--font-display); font-weight:700; color:var(--ink); white-space:nowrap; }
  .banner-badge {
    font-family:var(--font-utility);
    font-size:9.5px;
    text-transform:uppercase;
    padding:2px 7px;
    border-radius:3px;
    font-weight:700;
    letter-spacing:0.06em;
    white-space:nowrap;
  }
  .stability-stable { background:rgba(59,74,50,0.18); color:var(--forest); border:1px solid var(--forest); }
  .stability-uneasy { background:rgba(169,129,44,0.20); color:var(--gold); border:1px solid var(--gold); }
  .stability-volatile { background:rgba(194,65,12,0.20); color:#c2410c; border:1px solid #c2410c; }
  .stability-fracturing { background:rgba(124,42,37,0.25); color:var(--seal); border:1px solid var(--seal); }
  .banner-atmosphere { font-style:italic; color:var(--ink-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:120px; }
  .banner-whispers { font-family:var(--font-utility); font-size:10px; color:var(--ink-soft); display:flex; gap:6px; align-items:center; white-space:nowrap; }
  .whisper-item { background:rgba(43,33,21,0.06); padding:1px 6px; border-radius:3px; border:1px solid rgba(43,33,21,0.08); }

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
  .section-btn#nav-secrets { color:var(--seal); }
  .section-btn#nav-secrets.active { border-left-color:var(--seal); font-weight:700; }

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

  /* Severity badges */
  .severity-pill { display:inline-block; font-family:var(--font-utility); font-size:9.5px; padding:2px 7px; border-radius:3px; text-transform:uppercase; font-weight:700; margin-right:6px; }
  .severity-gossip { background:rgba(59,74,50,0.2); color:var(--forest); }
  .severity-scandal { background:rgba(169,129,44,0.22); color:var(--gold); }
  .severity-treason { background:rgba(194,65,12,0.22); color:#c2410c; }
  .severity-dynasty_ending { background:rgba(124,42,37,0.3); color:var(--seal); font-weight:700; }

  /* Primary source styling */
  .source-type-pill {
    display:inline-block; font-family:var(--font-utility); font-size:9.5px;
    background:rgba(124,42,37,0.15); color:var(--seal);
    padding:2px 7px; border-radius:3px; text-transform:uppercase; font-weight:700; margin-right:6px;
  }
  .reliability-pill {
    display:inline-block; font-family:var(--font-utility); font-size:9.5px;
    padding:2px 7px; border-radius:3px; text-transform:uppercase; font-weight:600; margin-right:6px;
  }
  .rel-true { background:rgba(59,74,50,0.18); color:var(--forest); }
  .rel-biased { background:rgba(169,129,44,0.20); color:var(--gold); }
  .rel-propaganda { background:rgba(194,65,12,0.22); color:#c2410c; }
  .rel-myth { background:rgba(109,40,217,0.18); color:#6d28d9; }
  .rel-forged { background:rgba(124,42,37,0.22); color:var(--seal); border:1px dashed var(--seal); }

  .primary-source-box {
    border-left:3px solid var(--seal);
    background:rgba(124,42,37,0.05);
    padding:16px 20px;
    margin:14px 0 20px;
    border-radius:2px;
  }
  .ballad-box {
    font-family:var(--font-display);
    font-style:italic;
    border-left:3px solid var(--gold);
    background:rgba(169,129,44,0.07);
    padding:16px 22px;
    margin:14px 0 20px;
    line-height:1.8;
  }

  /* House headers */
  .house-words-banner {
    font-family:var(--font-display);
    font-style:italic;
    font-size:19px;
    color:var(--seal);
    margin:8px 0 16px;
    padding:6px 14px;
    background:rgba(124,42,37,0.07);
    border-left:3px solid var(--seal);
    border-radius:2px;
    display:inline-block;
  }
  .house-sigil-box {
    display:flex;
    align-items:center;
    gap:8px;
    font-size:13.5px;
    color:var(--ink-soft);
    margin-bottom:16px;
    background:rgba(43,33,21,0.04);
    padding:8px 12px;
    border-radius:3px;
  }

  /* Relationships */
  .relationship-card {
    background:rgba(43,33,21,0.04);
    border:1px solid var(--line);
    border-radius:3px;
    padding:8px 12px;
    margin-bottom:8px;
  }
  .rel-secret {
    border-left:3px dashed var(--seal) !important;
    background:rgba(124,42,37,0.06);
  }

  /* Secrets detail */
  .secret-truth-box {
    background:#2A181C;
    color:#FCEAEA;
    border:1px solid var(--seal);
    border-radius:3px;
    padding:16px 20px;
    margin-bottom:18px;
  }
  .secret-truth-box .field-label { color:#FFA2A2; }

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
    #search{ width:130px; }
    #search:focus{ width:160px; }
    #realm-banner { font-size:11px; padding:6px 14px; }
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
    <div class="mode-toggle-wrap">
      <button id="mode-toggle" class="mode-btn" title="Toggle Maester (Public) vs Omniscient (GM) Mode">
        <span class="mode-icon">&#128366;</span>
        <span id="mode-label">Maester Mode</span>
      </button>
    </div>
  </header>

  <div id="realm-banner"></div>

  <div id="body-wrap">
    <nav id="sections">
      <button class="section-btn" data-section="timeline"><span class="glyph">&#9776;</span><span class="label">Timeline</span><span class="count" id="count-timeline"></span></button>
      <button class="section-btn" data-section="characters"><span class="glyph">&#9820;</span><span class="label">Dramatis</span><span class="count" id="count-characters"></span></button>
      <button class="section-btn" data-section="houses"><span class="glyph">&#9819;</span><span class="label">Houses</span><span class="count" id="count-houses"></span></button>
      <button class="section-btn" data-section="threads"><span class="glyph">&#9875;</span><span class="label">Plots</span><span class="count" id="count-threads"></span></button>
      <button class="section-btn" data-section="tomes"><span class="glyph">&#10047;</span><span class="label">Tomes</span><span class="count" id="count-tomes"></span></button>
      <button class="section-btn" data-section="secrets" id="nav-secrets" style="display:none;"><span class="glyph">&#128369;</span><span class="label">Secrets</span><span class="count" id="count-secrets"></span></button>
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
    secrets: CHRONICLE_DATA.secrets || [],
    currentSection: 'timeline',
    selectedId: null,
    searchTerm: '',
    omniscientMode: false
  };

  const SECTION_CONFIG = {
    timeline:   { label:'Timeline', glyph:'&#9776;', singular:'Chronicle Entry', primaryField:'narrative', dateField:'date' },
    characters: { label:'Dramatis Personae', glyph:'&#9820;', singular:'Character', primaryField:'coreDrive', dateField:null },
    houses:     { label:'Noble Houses', glyph:'&#9819;', singular:'House', primaryField:'status', dateField:null },
    threads:    { label:'Plot Threads', glyph:'&#9875;', singular:'Plot Thread', primaryField:'summary', dateField:'status' },
    tomes:      { label:'Tomes & Primary Sources', glyph:'&#10047;', singular:'Tome', primaryField:'content', dateField:'sourceType' },
    secrets:    { label:'Secrets & Conspiracies', glyph:'&#128369;', singular:'Secret', primaryField:'truth', dateField:'severity' },
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

  function currentArray(){
    if(state.currentSection === 'secrets'){
      return state.omniscientMode ? state.secrets : state.secrets.filter(s => s.status === 'exposed');
    }
    return state[state.currentSection] || [];
  }

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
        (e.truth || '') + ' ' +
        (e.publicCoverStory || '') + ' ' +
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
    
    // Toggle nav-secrets button display
    const secretsNav = document.getElementById('nav-secrets');
    if(secretsNav) {
      secretsNav.style.display = state.omniscientMode ? 'flex' : 'none';
    }

    // Update counts
    ['characters','timeline','tomes','threads','houses'].forEach(s => {
      const el = document.getElementById('count-'+s);
      if(el) el.textContent = state[s].length || '';
    });
    const secretsCountEl = document.getElementById('count-secrets');
    if(secretsCountEl) {
      secretsCountEl.textContent = state.secrets.length || '';
    }

    // Update mode button label
    const modeLabel = document.getElementById('mode-label');
    const modeBtn = document.getElementById('mode-toggle');
    if(modeLabel && modeBtn) {
      if(state.omniscientMode) {
        modeLabel.textContent = 'Omniscient (GM)';
        modeBtn.classList.add('omniscient');
        modeBtn.title = 'Omniscient Mode active: All secrets and covert ties visible. Click to switch to Maester (Public) Mode.';
      } else {
        modeLabel.textContent = 'Maester Mode';
        modeBtn.classList.remove('omniscient');
        modeBtn.title = 'Maester Mode active: Only public record visible. Click to switch to Omniscient (GM) Mode.';
      }
    }
  }

  function renderRealmBanner(){
    const banner = document.getElementById('realm-banner');
    if(!banner) return;

    const camp = state.campaign || {};
    const mood = camp.realmMood;

    let parts = [];
    if(camp.currentDate) {
      parts.push(\`<span class="banner-meta">&#9876; \${escapeHtml(camp.currentDate)}</span>\`);
    }
    if(camp.currentEra) {
      parts.push(\`<span class="banner-meta" style="color:var(--gold);">&middot; \${escapeHtml(camp.currentEra)}</span>\`);
    }

    if(mood) {
      if(mood.stability) {
        const cls = 'stability-' + mood.stability;
        parts.push(\`<span class="banner-badge \${cls}">\${escapeHtml(mood.stability)}</span>\`);
      }
      if(mood.atmosphere) {
        parts.push(\`<span class="banner-atmosphere" title="\${escapeHtml(mood.atmosphere)}">\${escapeHtml(mood.atmosphere)}</span>\`);
      }
      if(mood.smallfolkWhispers && mood.smallfolkWhispers.length > 0) {
        const whispersHtml = mood.smallfolkWhispers.slice(0, 3).map(w => \`<span class="whisper-item">&ldquo;\${escapeHtml(w)}&rdquo;</span>\`).join(' ');
        parts.push(\`<span class="banner-whispers"><strong>Whispers:</strong> \${whispersHtml}</span>\`);
      }
    } else if(parts.length === 0) {
      parts.push(\`<span class="banner-meta">&#9876; \${escapeHtml(camp.name || 'Chronicle Realm')}</span>\`);
      parts.push(\`<span class="banner-atmosphere">Chronicle archive established.</span>\`);
    }

    banner.innerHTML = parts.join(' ');
  }

  function cardSnippet(entry, cfg){
    const src = entry[cfg.primaryField] || entry.summary || entry.narrative || entry.content || entry.truth || entry.coreDrive || '';
    return escapeHtml(src).slice(0, 110);
  }

  function renderList(){
    const cfg = SECTION_CONFIG[state.currentSection] || SECTION_CONFIG.timeline;
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
        if(state.currentSection === 'tomes') {
          if(entry.sourceType) metaBits.push(escapeHtml(entry.sourceType));
          if(entry.reliability && entry.reliability !== 'true') metaBits.push(escapeHtml(entry.reliability));
        }
        if(state.currentSection === 'secrets') {
          if(entry.severity) metaBits.push(escapeHtml(entry.severity));
          if(entry.status) metaBits.push(escapeHtml(entry.status));
        } else if(entry.status) {
          metaBits.push(entry.status);
        }

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

  function resolveCharName(id){
    const c = state.characters.find(ch => ch.id === id);
    if(c) return c.name;
    const h = state.houses.find(ho => ho.id === id);
    if(h) return 'House ' + h.name;
    return id;
  }

  function renderDetail(){
    const pane = document.getElementById('detail-pane');
    const cfg = SECTION_CONFIG[state.currentSection] || SECTION_CONFIG.timeline;
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
      const metaRow = [];
      metaRow.push(statusDot(entry.status) + escapeHtml(entry.status||'unknown'));
      if(entry.house) metaRow.push(escapeHtml(entry.house));
      if(typeof entry.computedAge === 'number') metaRow.push('Age ' + entry.computedAge);
      else if(typeof entry.ageAtDeath === 'number') metaRow.push('Died at Age ' + entry.ageAtDeath);
      if(entry.culture) metaRow.push(escapeHtml(entry.culture));
      if(entry.religion) metaRow.push(escapeHtml(entry.religion));

      html += \`<div class="detail-meta-row">\${metaRow.join(' &nbsp;&middot;&nbsp; ')}</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;

      if(entry.epithet) {
        html += \`<div class="house-words-banner" style="font-size:16px;">&ldquo;\${escapeHtml(entry.epithet)}&rdquo;</div>\`;
      }
      if(entry.titles && entry.titles.length > 0) {
        html += \`<div class="field-block"><div class="field-label">Titles & Honours</div><div class="field-value">\${entry.titles.map(t => \`<span class="tag-pill" style="background:rgba(169,129,44,0.18); color:var(--gold);">\${escapeHtml(t)}</span>\`).join('')}</div></div>\`;
      }

      if(entry.currentObsession) {
        html += \`<div class="field-block" style="padding:10px 14px; background:rgba(169,129,44,0.1); border-left:3px solid var(--gold); border-radius:2px;"><div class="field-label">Current Obsession</div><div class="field-value" style="font-style:italic;">\${escapeHtml(entry.currentObsession)}</div></div>\`;
      }

      const fields = [
        ['coreDrive','Core Drive'], ['flaw','Fatal Flaw'], ['face','Face & Bearing'],
        ['voice','Voice'], ['speechTells','Speech Tells'], ['modernAnalogue','Modern Analogue'],
        ['trajectory','Likely Trajectory']
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

      // Formative Scars
      if(entry.formativeScars && entry.formativeScars.length > 0) {
        const scarsHtml = entry.formativeScars.map(s => \`<div style="margin-bottom:6px; padding-left:8px; border-left:2px solid var(--seal);">&#9876; \${escapeHtml(s.summary)}</div>\`).join('');
        html += \`<div class="field-block"><div class="field-label">Formative Scars</div><div class="field-value">\${scarsHtml}</div></div>\`;
      }

      // Active Grudges
      if(entry.activeGrudges && entry.activeGrudges.length > 0) {
        const grudgesHtml = entry.activeGrudges.map(g => {
          const targetName = resolveCharName(g.targetId);
          const intensityBadge = \`<span class="severity-pill severity-scandal">\${escapeHtml(g.intensity || 'bitter')}</span>\`;
          return \`<div style="margin-bottom:6px; padding-left:8px; border-left:2px solid #c2410c;">\${intensityBadge}<strong>Against \${escapeHtml(targetName)}:</strong> \${escapeHtml(g.reason)} \${g.date ? \`(\${escapeHtml(g.date)})\` : ''}</div>\`;
        }).join('');
        html += \`<div class="field-block"><div class="field-label">Active Grudges</div><div class="field-value">\${grudgesHtml}</div></div>\`;
      }

      // Relationships
      const charRels = state.relationships.filter(r => r.fromId === entry.id || r.toId === entry.id);
      const visibleRels = state.omniscientMode ? charRels : charRels.filter(r => !r.isSecret);
      if(visibleRels.length > 0) {
        const relsHtml = visibleRels.map(r => {
          const otherId = r.fromId === entry.id ? r.toId : r.fromId;
          const otherName = resolveCharName(otherId);
          const isForward = r.fromId === entry.id;
          const secretBadge = r.isSecret ? '<span class="severity-pill severity-dynasty_ending">[Covert]</span> ' : '';
          const sentimentBadge = (r.sentiment !== undefined) ? \`<span class="tag-pill" style="background:rgba(43,33,21,0.08);">Sentiment: \${r.sentiment > 0 ? '+' : ''}\${r.sentiment}</span>\` : '';
          const facadeStr = r.publicFacade ? \`<span style="font-style:italic; color:var(--ink-soft);"> (Facade: "\${escapeHtml(r.publicFacade)}")</span>\` : '';
          const noteStr = r.note ? \`<div style="font-size:13px; color:var(--ink-soft); margin-top:3px;">\${escapeHtml(r.note)}</div>\` : '';

          return \`<div class="relationship-card \${r.isSecret ? 'rel-secret' : ''}">
            \${secretBadge}<strong>\${escapeHtml(r.type)}</strong> \${isForward ? 'towards' : 'from'} <strong>\${escapeHtml(otherName)}</strong> \${sentimentBadge}\${facadeStr}
            \${noteStr}
          </div>\`;
        }).join('');
        html += \`<div class="field-block"><div class="field-label">Directed Relationships (\${visibleRels.length})</div><div class="field-value">\${relsHtml}</div></div>\`;
      }

      if (entry.historyLog && entry.historyLog.length > 0) {
        let historyLogHtml = entry.historyLog.map(h => {
          const dateStr = h.date ? \`<span class="tag-pill" style="margin-right:6px; background:rgba(245,158,11,0.15); color:var(--gold);">\${escapeHtml(h.date)}</span>\` : '';
          return \`<div style="margin-bottom:8px; padding-left:10px; border-left:2px solid var(--gold);">\${dateStr}\${escapeHtml(h.note)}</div>\`;
        }).join('');
        html += \`<div class="field-block"><div class="field-label">Personal History Log (\${entry.historyLog.length})</div><div class="field-value">\${historyLogHtml}</div></div>\`;
      }

    } else if(state.currentSection === 'houses'){
      const metaRow = [];
      metaRow.push(statusDot(entry.status) + escapeHtml(entry.status||'unknown') + ' house');
      if(entry.seat) metaRow.push('Seat: ' + escapeHtml(entry.seat));
      if(entry.culture) metaRow.push(escapeHtml(entry.culture));
      if(entry.religion) metaRow.push(escapeHtml(entry.religion));
      if(entry.prestige) metaRow.push(entry.prestige + ' prestige');

      html += \`<div class="detail-meta-row">\${metaRow.join(' &nbsp;&middot;&nbsp; ')}</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;

      if(entry.words) {
        html += \`<div class="house-words-banner">&laquo; &ldquo;\${escapeHtml(entry.words)}&rdquo; &raquo;</div>\`;
      }
      if(entry.sigil) {
        html += \`<div class="house-sigil-box">&#9876; <strong>Sigil & Arms:</strong> \${escapeHtml(entry.sigil)}</div>\`;
      }
      if(entry.reputation) {
        html += \`<div class="field-block"><div class="field-label">Realm Reputation</div><div class="field-value" style="font-style:italic;">\${escapeHtml(entry.reputation)}</div></div>\`;
      }
      if(entry.holdings && entry.holdings.length > 0) {
        html += \`<div class="field-block"><div class="field-label">Holdings</div><div class="field-value">\${entry.holdings.map(h => \`<span class="tag-pill">\${escapeHtml(h)}</span>\`).join('')}</div></div>\`;
      }
      if (entry.historyLog && entry.historyLog.length > 0) {
        let historyLogHtml = entry.historyLog.map(h => {
          const dateStr = h.date ? \`<span class="tag-pill" style="margin-right:6px;">\${escapeHtml(h.date)}</span>\` : '';
          return \`<div style="margin-bottom:8px; padding-left:10px; border-left:2px solid var(--gold);">\${dateStr}\${escapeHtml(h.note)}</div>\`;
        }).join('');
        html += \`<div class="field-block"><div class="field-label">House Chronicle Log</div><div class="field-value">\${historyLogHtml}</div></div>\`;
      }

    } else if(state.currentSection === 'threads'){
      html += \`<div class="detail-meta-row">\${statusDot(entry.status)}\${escapeHtml(entry.status||'open')} plot thread</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;
      html += \`<div class="field-block"><div class="field-label">Summary & Plot Dynamics</div><div class="field-value">\${illuminate(entry.summary||'')}</div></div>\`;

    } else if(state.currentSection === 'timeline'){
      html += \`<div class="detail-meta-row">\${entry.date ? '&#8987; '+escapeHtml(entry.date) : ''}</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;
      html += \`<div class="field-value">\${illuminate(entry.narrative||'')}</div>\`;
      if(entry.mechanicalOutcome) {
        html += \`<div class="field-block" style="margin-top:20px; padding:12px; background:rgba(43,33,21,0.06); border-radius:4px;"><div class="field-label">Mechanical Outcome</div><div class="field-value" style="font-size:14px;"><strong>\${escapeHtml(entry.mechanicalOutcome.summary)}</strong></div></div>\`;
      }

    } else if(state.currentSection === 'tomes'){
      const srcType = entry.sourceType || 'chronicle';
      const rel = entry.reliability || 'true';
      const relCls = 'rel-' + rel;

      const metaRow = [];
      metaRow.push(\`<span class="source-type-pill">\${escapeHtml(srcType)}</span>\`);
      metaRow.push(\`<span class="reliability-pill \${relCls}">\${escapeHtml(rel)} reliability</span>\`);
      if(entry.inWorldAuthor) metaRow.push('Author: ' + escapeHtml(entry.inWorldAuthor));
      if(entry.inGameDate) metaRow.push('Dated: ' + escapeHtml(entry.inGameDate));
      if(entry.category) metaRow.push(escapeHtml(entry.category));

      html += \`<div class="detail-meta-row">\${metaRow.join(' &nbsp;&middot;&nbsp; ')}</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;

      const boxCls = (srcType === 'ballad') ? 'ballad-box' : (srcType === 'letter' || srcType === 'decree' || srcType === 'treatise' ? 'primary-source-box' : '');
      if(boxCls) {
        html += \`<div class="\${boxCls}"><div class="field-value">\${illuminate(entry.content||'')}</div></div>\`;
      } else {
        html += \`<div class="field-value">\${illuminate(entry.content||'')}</div>\`;
      }

    } else if(state.currentSection === 'secrets'){
      const sevCls = 'severity-' + (entry.severity || 'scandal');
      const metaRow = [];
      metaRow.push(\`<span class="severity-pill \${sevCls}">\${escapeHtml(entry.severity || 'scandal')}</span>\`);
      metaRow.push(\`Status: \${escapeHtml(entry.status || 'buried')}\`);

      html += \`<div class="detail-meta-row">\${metaRow.join(' &nbsp;&middot;&nbsp; ')}</div>\`;
      if(tagsHtml) html += \`<div style="margin-bottom:20px;">\${tagsHtml}</div>\`;

      // Ground Truth [OMNISCIENT]
      html += \`<div class="secret-truth-box">
        <div class="field-label">&#128369; Objective Ground Truth [GM ONLY]</div>
        <div class="field-value" style="font-size:16px;">\${escapeHtml(entry.truth || '')}</div>
      </div>\`;

      if(entry.publicCoverStory) {
        html += \`<div class="field-block" style="padding:12px 16px; background:rgba(43,33,21,0.06); border-radius:3px;">
          <div class="field-label">Official Public Cover Story (Believed by the Realm)</div>
          <div class="field-value" style="font-style:italic;">&ldquo;\${escapeHtml(entry.publicCoverStory)}&rdquo;</div>
        </div>\`;
      }

      if(entry.leverageNote) {
        html += \`<div class="field-block" style="padding:12px 16px; background:rgba(169,129,44,0.1); border-left:3px solid var(--gold); border-radius:2px;">
          <div class="field-label">Potential Leverage & Fallout</div>
          <div class="field-value">\${escapeHtml(entry.leverageNote)}</div>
        </div>\`;
      }

      // Subject IDs
      if(entry.subjectIds && entry.subjectIds.length > 0) {
        const subjectsHtml = entry.subjectIds.map(id => \`<span class="tag-pill" style="background:rgba(124,42,37,0.15); color:var(--seal); font-weight:700;">\${escapeHtml(resolveCharName(id))}</span>\`).join('');
        html += \`<div class="field-block"><div class="field-label">Subjects Implicated</div><div class="field-value">\${subjectsHtml}</div></div>\`;
      }

      // Known By
      if(entry.knownByCharacterIds && entry.knownByCharacterIds.length > 0) {
        const knownHtml = entry.knownByCharacterIds.map(id => \`<span class="tag-pill" style="background:rgba(59,74,50,0.18); color:var(--forest); font-weight:700;">&#10004; \${escapeHtml(resolveCharName(id))}</span>\`).join('');
        html += \`<div class="field-block"><div class="field-label">Direct Knowledge (Holds Definitive Proof)</div><div class="field-value">\${knownHtml}</div></div>\`;
      }

      // Suspected By
      if(entry.suspectedByCharacterIds && entry.suspectedByCharacterIds.length > 0) {
        const suspectedHtml = entry.suspectedByCharacterIds.map(id => \`<span class="tag-pill" style="background:rgba(169,129,44,0.18); color:var(--gold);">? \${escapeHtml(resolveCharName(id))}</span>\`).join('');
        html += \`<div class="field-block"><div class="field-label">Suspecting (Partial Clues, Lacks Proof)</div><div class="field-value">\${suspectedHtml}</div></div>\`;
      }

      // History Log
      if(entry.historyLog && entry.historyLog.length > 0) {
        let historyLogHtml = entry.historyLog.map(h => {
          const dateStr = h.date ? \`<span class="tag-pill" style="margin-right:6px;">\${escapeHtml(h.date)}</span>\` : '';
          return \`<div style="margin-bottom:8px; padding-left:10px; border-left:2px solid var(--seal);">\${dateStr}\${escapeHtml(h.note)}</div>\`;
        }).join('');
        html += \`<div class="field-block"><div class="field-label">Intrigue History Log (\${entry.historyLog.length})</div><div class="field-value">\${historyLogHtml}</div></div>\`;
      }
    }

    pane.innerHTML = html;
    const mb = document.getElementById('mobile-back');
    if(mb) mb.onclick = () => { document.body.classList.remove('mobile-detail-open'); };
  }

  function renderAll(){
    renderNav();
    renderRealmBanner();
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

  // Mode toggle button
  const modeBtn = document.getElementById('mode-toggle');
  if(modeBtn) {
    modeBtn.onclick = () => {
      state.omniscientMode = !state.omniscientMode;
      if(!state.omniscientMode && state.currentSection === 'secrets') {
        state.currentSection = 'timeline';
      }
      const arr = currentArray();
      state.selectedId = arr.length > 0 ? arr[0].id : null;
      renderAll();
    };
  }

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
console.log(`- Injected ${data.secrets.length} secrets`);
