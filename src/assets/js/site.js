/* ===========================
   CURSOR
=========================== */
const cur = document.getElementById('cur');
document.addEventListener('mousemove', e => {
  cur.style.left = e.clientX + 'px';
  cur.style.top = e.clientY + 'px';
});

/* ===========================
   ANALYTICS HELPERS
=========================== */
const ATTRIBUTION_STORAGE_KEY = 'scratchbox_campaign_attribution_v1';
const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'li_fat_id'];

function safeAttributionValue(value) {
  return typeof value === 'string' ? value.slice(0, 250) : '';
}

function readAttribution() {
  try { return JSON.parse(localStorage.getItem(ATTRIBUTION_STORAGE_KEY)) || {}; } catch (e) { return {}; }
}

function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const campaign = ATTRIBUTION_KEYS.reduce((result, key) => {
    const value = safeAttributionValue(params.get(key));
    if (value) result[key] = value;
    return result;
  }, {});
  const previous = readAttribution();
  const hasCampaignData = Object.keys(campaign).length > 0;
  const touch = {
    ...campaign,
    landing_page: window.location.href.slice(0, 1000),
    referrer: safeAttributionValue(document.referrer),
    captured_at: new Date().toISOString()
  };
  const attribution = {
    first_touch: previous.first_touch || touch,
    latest_touch: hasCampaignData ? touch : (previous.latest_touch || touch),
    latest_page: window.location.href.slice(0, 1000),
    form_page: ''
  };
  try { localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution)); } catch (e) {}
  return attribution;
}

function getAttributionForSubmission() {
  const attribution = readAttribution();
  attribution.form_page = window.location.href.slice(0, 1000);
  return attribution;
}

function trackEvent(name, params) {
  try {
    const eventParams = params || {};
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...eventParams });
    if(typeof gtag !== 'undefined') gtag('event', name, eventParams);
    if(typeof clarity !== 'undefined') clarity('event', name);
  } catch (e) {}
}
function trackPage() {
  if(typeof gtag !== 'undefined') {
    gtag('event', 'page_view', {
      page_title: document.title,
      page_path: window.location.pathname
    });
  }
}
function setActiveNav() {
  const page = document.body.dataset.page || '';
  document.querySelectorAll('[data-page]').forEach(a => {
    a.classList.toggle('active-link', a.getAttribute('data-page') === page);
  });
}
function initTrackingClicks() {
  document.querySelectorAll('[data-track]').forEach(el => {
    if(el._trackBound) return;
    el.addEventListener('click', () => {
      const name = el.getAttribute('data-track');
      const label = el.getAttribute('data-track-label');
      trackEvent(name || 'click', label ? {label} : {});
    });
    el._trackBound = true;
  });
  document.querySelectorAll('a[href^="tel:"]').forEach(el => {
    if(el._conversionBound) return;
    el.addEventListener('click', () => trackEvent('phone_click', { location: window.location.pathname }));
    el._conversionBound = true;
  });
  document.querySelectorAll('a[href*="whatsapp.com"]').forEach(el => {
    if(el._conversionBound) return;
    el.addEventListener('click', () => trackEvent('whatsapp_click', { location: window.location.pathname }));
    el._conversionBound = true;
  });
}

function initGrowthPlanTracking() {
  const form = document.querySelector('.growth-plan-form');
  if (!form || form._growthTrackingBound) return;
  form.addEventListener('focusin', () => trackEvent('growth_plan_form_start', {
    form_id: 'growth_plan',
    page_type: document.body.dataset.page || 'unknown'
  }), { once: true });
  form._growthTrackingBound = true;
}

function initLazyWorkCovers() {
  const covers = Array.from(document.querySelectorAll('.work-cover[data-cover]'));
  if(!covers.length) return;
  const loadCover = (cover) => {
    const src = cover.getAttribute('data-cover');
    if(!src) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    img.onload = () => {
      cover.style.backgroundImage = "url('" + src + "')";
      cover.classList.add('is-loaded');
      cover.removeAttribute('data-cover');
    };
  };
  if(!('IntersectionObserver' in window)) {
    covers.forEach(loadCover);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if(!entry.isIntersecting) return;
      loadCover(entry.target);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '300px 0px' });
  covers.forEach((cover) => io.observe(cover));
}

/* ===========================
   ADMIN DASHBOARD (FRONTEND)
=========================== */
async function adminLogin() {
  const user = document.getElementById('adminUser').value;
  const pass = document.getElementById('adminPass').value;
  const err = document.getElementById('adminErr');
  const button = document.getElementById('adminLoginButton');
  setCrmButtonLoading(button, 'Signing in…');
  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });
    if(res.ok) {
      err.textContent = '';
      await refreshCrmLeads();
      return;
    }
    if(res.status === 404) {
      err.textContent = 'Admin API not found. Run backend server and open this page on that server.';
      return;
    }
    if(res.status >= 500) {
      err.textContent = 'Admin credentials are not configured on server.';
      return;
    }
    err.textContent = 'Invalid credentials';
  } catch (e) {
    err.textContent = 'Login failed. Check if backend server is running.';
  } finally {
    clearCrmButtonLoading(button);
  }
}

async function loadAdminSubmissions() {
  const login = document.getElementById('adminLogin');
  const wrap = document.getElementById('adminTableWrap');
  const checking = document.getElementById('adminChecking');
  if (!login || !wrap) return;
  try {
    const res = await fetch('/api/admin/leads');
    if(!res.ok) {
      login.style.display = '';
      wrap.style.display = 'none';
      if (checking) checking.style.display = 'none';
      return false;
    }
    const data = await res.json();
    window.crmLeads = data.items || [];
    renderCrmStats(data.stats || {});
    populateCrmSourceFilter();
    filterCrmLeads();
    login.style.display = 'none';
    wrap.style.display = '';
    if (checking) checking.style.display = 'none';
    return true;
  } catch (e) {
    login.style.display = '';
    wrap.style.display = 'none';
    if (checking) checking.style.display = 'none';
    return false;
  }
}

async function syncMetaLeads(triggerButton = document.querySelector('.crm-sync')) {
  const status = document.getElementById('crmImportStatus');
  const button = triggerButton;
  setCrmButtonLoading(button, 'Syncing leads…');
  if (status) status.textContent = '';
  try {
    const response = await fetch('/api/admin/imports/meta-leads', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Meta lead sync failed.');
    if (status) status.textContent = `${result.imported} Meta lead${result.imported === 1 ? '' : 's'} imported. ${result.skipped} already in CRM.`;
    await loadAdminSubmissions();
  } catch (error) {
    if (status) status.textContent = error.message || 'Meta lead sync failed.';
    await loadAdminSubmissions();
  } finally {
    clearCrmButtonLoading(button);
  }
}

async function refreshCrmLeads() {
  await syncMetaLeads(document.querySelector('.crm-refresh-leads'));
}

function setCrmButtonLoading(button, label) {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent.trim();
  button.disabled = true;
  button.innerHTML = `<span class="crm-loading-spinner" aria-hidden="true"></span>${escapeHtml(label)}`;
}
function clearCrmButtonLoading(button) {
  if (!button) return;
  button.disabled = false;
  button.textContent = button.dataset.defaultLabel || button.textContent;
}

async function initialiseCrm() {
  // Verify the current session before triggering the sheet sync, so reloads do not flash the login form.
  if (await loadAdminSubmissions()) await refreshCrmLeads();
}

async function adminLogout() {
  try {
    await fetch('/admin/logout', { method: 'POST' });
  } finally {
    window.crmLeads = [];
    closeCrmLead();
    document.getElementById('adminTableWrap').style.display = 'none';
    document.getElementById('adminLogin').style.display = '';
    document.getElementById('adminChecking').style.display = 'none';
    clearCrmButtonLoading(document.getElementById('adminLoginButton'));
    document.getElementById('adminPass').value = '';
    document.getElementById('adminUser').focus();
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
function humaniseCrmStatus(status) {
  return String(status || 'new').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatCrmDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function getLeadAttribution(lead) {
  const attribution = lead.data?.attribution || {};
  return attribution.latest_touch || attribution.first_touch || {};
}
function getLeadName(data) {
  return data.name || [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Unknown lead';
}
function getLeadObjective(data) {
  return data.objective || data.interest || '—';
}
function getLeadSource(lead) {
  const data = lead.data || {};
  const attribution = getLeadAttribution(lead);
  return attribution.utm_source || data.source || (data.first_name ? 'Legacy form' : 'Direct');
}
function getSelectedCrmStatuses() {
  return [...document.querySelectorAll('input[name="crmStatusFilter"]:checked')].map((input) => input.value);
}
function updateCrmStatusFilterLabel(statuses) {
  const label = document.getElementById('crmStatusFilterLabel');
  if (!label) return;
  label.textContent = !statuses.length ? 'All statuses' : statuses.length === 1 ? humaniseCrmStatus(statuses[0]) : `${statuses.length} statuses`;
}
function populateCrmSourceFilter() {
  const select = document.getElementById('crmSourceFilter');
  if (!select) return;
  const selected = select.value || 'all';
  const sources = [...new Set((window.crmLeads || []).map(getLeadSource).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = `<option value="all">All campaign sources</option>${sources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`).join('')}`;
  select.value = sources.includes(selected) ? selected : 'all';
}
function renderCrmStats(stats) {
  const target = document.getElementById('crmStats');
  if (!target) return;
  const cards = [['Total leads', stats.total || 0], ['Sales priority', stats.priority || 0], ['Active pipeline', stats.active || 0], ['Won', stats.won || 0]];
  target.innerHTML = cards.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('');
}
function filterCrmLeads() {
  const leads = window.crmLeads || [];
  const search = document.getElementById('crmSearch')?.value.trim().toLowerCase() || '';
  const statuses = getSelectedCrmStatuses();
  updateCrmStatusFilterLabel(statuses);
  const priority = document.getElementById('crmPriorityFilter')?.value || 'all';
  const source = document.getElementById('crmSourceFilter')?.value || 'all';
  const filtered = leads.filter((lead) => {
    const data = lead.data || {};
    const crm = lead.crm || {};
    const haystack = `${getLeadName(data)} ${data.email || ''} ${data.company || ''}`.toLowerCase();
    return (!search || haystack.includes(search)) && (!statuses.length || statuses.includes(crm.status || 'new')) && (priority === 'all' || data.lead_score?.priority === priority) && (source === 'all' || getLeadSource(lead) === source);
  });
  const tbody = document.getElementById('crmLeadTable');
  const empty = document.getElementById('crmEmpty');
  if (!tbody) return;
  tbody.innerHTML = filtered.map((lead) => {
    const data = lead.data || {};
    const crm = lead.crm || {};
    const attribution = getLeadAttribution(lead);
    const source = getLeadSource(lead);
    const campaign = attribution.utm_campaign || '—';
    const priorityLabel = data.lead_score?.priority ? humaniseCrmStatus(data.lead_score.priority) : 'Unscored';
    return `<tr><td><strong>${escapeHtml(getLeadName(data))}</strong><span>${escapeHtml(data.company || data.email || '—')}</span></td><td><span class="crm-priority ${escapeHtml(data.lead_score?.priority || 'unscored')}">${escapeHtml(priorityLabel)}</span><small>${escapeHtml(data.industry || '—')} · ${escapeHtml(getLeadObjective(data))}</small></td><td><strong>${escapeHtml(source)}</strong><span>${escapeHtml(campaign)}</span></td><td><span class="crm-status ${escapeHtml(crm.status || 'new')}">${escapeHtml(humaniseCrmStatus(crm.status))}</span></td><td>${escapeHtml(formatCrmDate(crm.followUpAt))}</td><td><button class="crm-open" type="button" onclick="openCrmLead('${lead._id}')">Open</button></td></tr>`;
  }).join('');
  if (empty) empty.hidden = Boolean(filtered.length);
}

function openCrmLead(id) {
  const lead = (window.crmLeads || []).find((item) => item._id === id);
  if (!lead) return;
  const data = lead.data || {};
  const crm = lead.crm || {};
  const attribution = getLeadAttribution(lead);
  document.getElementById('crmLeadName').textContent = getLeadName(data);
  const statuses = ['new', 'qualified', 'discovery-booked', 'proposal', 'negotiation', 'won', 'lost', 'rejected', 'nurture'];
  const statusOptions = statuses.map((status) => `<option value="${status}"${crm.status === status ? ' selected' : ''}>${humaniseCrmStatus(status)}</option>`).join('');
  const notes = (crm.notes || []).slice().reverse().map((note) => `<article class="crm-note"><p>${escapeHtml(note.body)}</p><small>${escapeHtml(formatCrmDate(note.createdAt))}</small></article>`).join('') || '<p class="crm-muted">No internal notes yet.</p>';
  document.getElementById('crmLeadBody').innerHTML = `
    <div class="crm-contact"><strong>${escapeHtml(data.company || 'Company not supplied')}</strong><a href="mailto:${escapeHtml(data.email || '')}">${escapeHtml(data.email || 'No email')}</a>${data.phone ? `<a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a>` : ''}${data.website ? `<a href="${escapeHtml(data.website)}" target="_blank" rel="noopener">${escapeHtml(data.website)}</a>` : ''}</div>
    <dl class="crm-detail-grid"><div><dt>Industry</dt><dd>${escapeHtml(data.industry || '—')}</dd></div><div><dt>Objective</dt><dd>${escapeHtml(getLeadObjective(data))}</dd></div><div><dt>Revenue</dt><dd>${escapeHtml(data.annual_revenue || '—')}</dd></div><div><dt>Investment</dt><dd>${escapeHtml(data.retainer_budget || data.project_budget || '—')}</dd></div><div><dt>Timeline</dt><dd>${escapeHtml(data.timeline || '—')}</dd></div><div><dt>Lead score</dt><dd>${escapeHtml(data.lead_score?.score ?? '—')} / 30</dd></div></dl>
    <section class="crm-attribution"><p class="v2-eyebrow">Campaign attribution</p><p><strong>${escapeHtml(attribution.utm_source || data.source || 'Direct')}</strong> · ${escapeHtml(attribution.utm_medium || '—')}</p><p>${escapeHtml(attribution.utm_campaign || 'No campaign recorded')}</p><small>Landing: ${escapeHtml(attribution.landing_page || data.landing_page || '—')}</small></section>
    <section class="crm-message"><p class="v2-eyebrow">Business context</p><p>${escapeHtml(data.message || 'No additional context supplied.')}</p></section>
    <form class="crm-update-form" onsubmit="saveCrmLead(event, '${id}')"><p class="v2-eyebrow">Pipeline update</p><label>Status<select name="status">${statusOptions}</select></label><label>Lead owner<input name="owner" value="${escapeHtml(crm.owner || '')}" placeholder="Assign a team member"/></label><label>Next follow-up<input name="followUpAt" type="date" value="${crm.followUpAt ? new Date(crm.followUpAt).toISOString().slice(0, 10) : ''}"/></label><label>Opportunity value (₹)<input name="opportunityValue" type="number" min="0" step="1" value="${crm.opportunityValue ?? ''}" placeholder="Expected value"/></label><label>Lost reason<input name="lostReason" value="${escapeHtml(crm.lostReason || '')}" placeholder="Only if marked lost"/></label><label>Add internal note<textarea name="note" placeholder="What happened? What should happen next?"></textarea></label><button type="submit">Save lead update</button><p class="crm-save-status" aria-live="polite"></p></form>
    <section class="crm-notes"><p class="v2-eyebrow">Activity notes</p>${notes}</section>`;
  document.getElementById('crmDrawer').classList.add('open');
  document.getElementById('crmDrawerBackdrop').classList.add('open');
  document.getElementById('crmDrawer').setAttribute('aria-hidden', 'false');
}

function closeCrmLead() {
  document.getElementById('crmDrawer')?.classList.remove('open');
  document.getElementById('crmDrawerBackdrop')?.classList.remove('open');
  document.getElementById('crmDrawer')?.setAttribute('aria-hidden', 'true');
}

async function saveCrmLead(event, id) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector('.crm-save-status');
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch(`/api/admin/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error('Unable to save');
    status.textContent = 'Saved.';
    await loadAdminSubmissions();
    openCrmLead(id);
  } catch (error) {
    status.textContent = 'Could not save this update. Please try again.';
  }
}

/* ===========================
   NAV SCROLL + PROGRESS BAR
=========================== */
const nav = document.getElementById('nav');
const progressBar = document.getElementById('progressBar');
window.addEventListener('scroll', () => {
  nav.classList.toggle('floated', window.scrollY > 60);
  if(progressBar) {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progressBar.style.width = pct + '%';
  }
}, {passive:true});

/* ===========================
   MOBILE MENU
=========================== */
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.add('open');
});
document.getElementById('mobileClose').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.remove('open');
});
document.querySelectorAll('#mobileMenu a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.remove('open');
  });
});

/* ===========================
   SCROLL REVEAL
=========================== */
function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.on)');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target); }
    });
  }, {threshold:0.08});
  els.forEach(el => obs.observe(el));
}
initReveal();
document.addEventListener('DOMContentLoaded', () => {
  captureAttribution();
  setActiveNav();
  trackPage();
  initGrowthPlanTracking();
  if(document.body.dataset.page === 'admin') setTimeout(initialiseCrm, 100);
});

/* ===========================
   HERO BADGE STICKY
=========================== */
function initHeroBadge() {
  const badge = document.getElementById('heroBadge');
  const who = document.getElementById('whoSection');
  if(!badge || !who) return;
  const hideAt = () => {
    const trigger = who.offsetTop - 80;
    if(window.scrollY >= trigger) {
      badge.classList.add('badge-hide');
    } else {
      badge.classList.remove('badge-hide');
    }
  };
  hideAt();
  window.addEventListener('scroll', hideAt, {passive:true});
  window.addEventListener('resize', hideAt);
}
document.addEventListener('DOMContentLoaded', initHeroBadge);

/* ===========================
   CALENDLY MODAL
=========================== */
function openCalendly() {
  document.getElementById('calendlyModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  trackEvent('calendly_open');
  if(typeof gtag !== 'undefined') gtag('event','book_call_clicked',{event_category:'CTA',event_label:'Calendly Modal'});
  if(typeof fbq !== 'undefined') fbq('track','Lead');
}
function closeCalendly() {
  document.getElementById('calendlyModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('calendlyModal').addEventListener('click', function(e) {
  if(e.target === this) closeCalendly();
});

/* ===========================
   VIDEO MODAL
=========================== */
function openVideoModal() {
  document.getElementById('videoModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  trackEvent('founder_video_open');
  const frame = document.getElementById('videoFrame');
  if(frame && !frame.dataset.loaded) {
    frame.innerHTML = '<video src="/videos/videoHome.mp4" poster="/videos/videoHome-poster.jpg" preload="none" autoplay playsinline controls></video>';
    frame.dataset.loaded = '1';
  }
  if(typeof gtag !== 'undefined') gtag('event','founder_video_viewed',{event_category:'Engagement'});
}
function closeVideoModal() {
  document.getElementById('videoModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('videoModal').addEventListener('click', function(e) {
  if(e.target === this) closeVideoModal();
})

/* ===========================
   PROJECT FORM MODAL
=========================== */
function openProjectForm() {
  document.getElementById('projectModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  trackEvent('project_form_open');
  if(typeof gtag !== 'undefined') gtag('event','project_form_opened',{event_category:'Lead'});
}
function closeProjectForm() {
  document.getElementById('projectModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('projectModal').addEventListener('click', function(e) {
  if(e.target === this) closeProjectForm();
});

/* ===========================
   PROJECT PLANNER / QUIZ
=========================== */
let currentStep = 1;
const totalSteps = 4;
const quizAnswers = {};

function openPlanner() {
  document.getElementById('plannerModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  trackEvent('quiz_open');
  resetQuiz();
}
function closePlanner() {
  document.getElementById('plannerModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('plannerModal').addEventListener('click', function(e) {
  if(e.target === this) closePlanner();
});

function resetQuiz() {
  currentStep = 1;
  Object.keys(quizAnswers).forEach(k => delete quizAnswers[k]);
  document.querySelectorAll('.quiz-step').forEach(s => s.classList.remove('active'));
  document.getElementById('qstep-1').classList.add('active');
  document.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
  document.getElementById('quizNext').disabled = true;
  document.getElementById('quizBack').style.display = 'none';
  document.getElementById('stepCounter').textContent = 'Step 1 of 4';
  document.getElementById('plannerProgress').style.width = '20%';
  document.getElementById('quizNav').style.display = '';
}

function selectOption(btn, key, val) {
  const step = btn.closest('.quiz-step');
  step.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
  btn.classList.add('selected');
  quizAnswers[key] = val;
  trackEvent('quiz_option_select', { question: key, answer: val, step: currentStep });
  document.getElementById('quizNext').disabled = false;
  // little bounce feedback
  btn.style.transform = 'translateX(8px)';
  setTimeout(() => btn.style.transform = '', 200);
}

function quizNext() {
  trackEvent('quiz_next', { step: currentStep });
  if(currentStep < totalSteps) {
    document.getElementById('qstep-' + currentStep).classList.remove('active');
    currentStep++;
    document.getElementById('qstep-' + currentStep).classList.add('active');
    document.getElementById('quizNext').disabled = true;
    document.getElementById('quizBack').style.display = 'block';
    document.getElementById('stepCounter').textContent = 'Step ' + currentStep + ' of 4';
    document.getElementById('plannerProgress').style.width = (currentStep / (totalSteps+1) * 100) + '%';
    // re-check if already answered
    if(document.querySelector('#qstep-' + currentStep + ' .quiz-option.selected')) {
      document.getElementById('quizNext').disabled = false;
    }
  } else {
    // Show result
    document.getElementById('qstep-' + currentStep).classList.remove('active');
    document.getElementById('qstep-result').classList.add('active');
    document.getElementById('plannerProgress').style.width = '100%';
    document.getElementById('quizNav').style.display = 'none';
    trackEvent('quiz_complete', {
      stage: quizAnswers.stage || '',
      goal: quizAnswers.goal || '',
      budget: quizAnswers.budget || '',
      timeline: quizAnswers.timeline || ''
    });
    buildResult();
  }
}

function quizBack() {
  trackEvent('quiz_back', { step: currentStep });
  document.getElementById('qstep-' + currentStep).classList.remove('active');
  currentStep--;
  document.getElementById('qstep-' + currentStep).classList.add('active');
  document.getElementById('quizNext').disabled = false;
  if(currentStep === 1) document.getElementById('quizBack').style.display = 'none';
  document.getElementById('stepCounter').textContent = 'Step ' + currentStep + ' of 4';
  document.getElementById('plannerProgress').style.width = (currentStep / (totalSteps+1) * 100) + '%';
}

function buildResult() {
  const {stage, goal, budget, timeline} = quizAnswers;
  let title, desc, tags;

  if(budget === 'small' || stage === 'idea') {
    title = "You're a great fit for our Launch plan!";
    desc = "Based on your answers, we recommend starting with our Launch package. We'll get your brand and web presence solid first, so you have a strong foundation to grow from.";
    tags = ['Brand Identity', 'Website', 'Social Media Starter'];
  } else if(budget === 'large' || stage === 'established') {
    title = "You need our full Partner programme!";
    desc = "You're at the stage where you need a full creative partner, not just a vendor. Let's talk about a bespoke engagement that covers everything from strategy to execution at scale.";
    tags = ['Full-Service', 'Media Production', 'Growth Marketing', 'Product Strategy'];
  } else {
    title = "You're a perfect fit for our Scale plan!";
    desc = "Based on your answers, our Growth/Scale plan is your sweet spot. You get brand, website, content and marketing working together — with a dedicated team aligned on your results.";
    tags = ['Branding', 'Website', 'Content', 'Paid Marketing'];
  }
  if(goal === 'web') tags = ['High-Converting Website', 'SEO', 'Performance Optimisation'];
  if(goal === 'content') tags = ['Video Production', 'Social Media', 'Content Strategy'];

  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultDesc').textContent = desc;
  const tagContainer = document.getElementById('resultTags');
  tagContainer.innerHTML = tags.map(t => `<span class="quiz-result-tag">${t}</span>`).join('');
}

/* ===========================
   PRICING TOGGLE
=========================== */
const prices = {
  monthly: ['?29,999', '?59,999', 'Custom'],
  quarterly: ['?25,499', '?50,999', 'Custom']
};
function setPricingPeriod(period, btn) {
  document.querySelectorAll('.ptoggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const p = prices[period];
  const amts = ['p1amt','p2amt','p3amt'];
  amts.forEach((id,i) => {
    const el = document.getElementById(id);
    if(el) {
      el.style.transform = 'translateY(-8px)';
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = p[i];
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
      }, 200);
    }
  });
}

/* ===========================
   SERVICE ACCORDION
=========================== */
function toggleCard(header) {
  const body = header.nextElementSibling;
  const isOpen = body.classList.contains('open');
  document.querySelectorAll('.svc-card-body').forEach(b => b.classList.remove('open'));
  if (!isOpen) body.classList.add('open');
}

/* ===========================
   FAQ ACCORDION
=========================== */
function toggleFaq(item) {
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

/* ===========================
   WORK FILTER
=========================== */
function filterWork(btn, cat) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  trackEvent('work_filter', {label: cat});
  const caseTags = [
    ['launch', 'content', 'brand'], ['d2c', 'brand'], ['saas', 'healthcare', 'growth'],
    ['d2c', 'growth', 'content'], ['d2c', 'content'], ['healthcare', 'launch', 'content'],
    ['brand'], ['d2c', 'growth'], ['content'], ['growth', 'content'], ['content'],
    ['launch', 'content'], ['saas', 'growth'], ['d2c', 'brand'], ['content'], ['growth'], ['healthcare', 'content']
  ];
  document.querySelectorAll('.work-masonry-item').forEach((item, index) => {
    if (cat === 'all' || (caseTags[index] || []).includes(cat)) {
      item.style.display = '';
      setTimeout(() => item.style.opacity = '1', 10);
    } else {
      item.style.opacity = '0';
      setTimeout(() => { item.style.display = 'none'; }, 300);
    }
  });
}

/* ===========================
   WORK MODAL
=========================== */
function openWorkModal(item) {
  const modal = document.getElementById('workModal');
  const body = document.getElementById('workModalBody');
  const title = document.getElementById('workModalTitle');
  const meta = document.getElementById('workModalMeta');
  const badge = document.getElementById('workModalBadge');
  const link = document.getElementById('workModalLink');
  if(!modal || !body) return;
  const type = item.getAttribute('data-type');
  const src = item.getAttribute('data-src');
  const href = item.getAttribute('data-link');
  const t = item.getAttribute('data-title') || 'Project Preview';
  const m = item.getAttribute('data-meta') || '';
  title.textContent = t;
  meta.textContent = m;
  badge.textContent = type === 'video' ? 'Video' : (type === 'image' ? 'Image' : (type === 'web' ? 'Website' : 'Slides'));
  trackEvent('work_open', {label: t, type: type});
  if(link) {
    if(href) {
      link.href = href;
      link.setAttribute('data-track-label', href);
      link.style.display = '';
    } else {
      link.style.display = 'none';
      link.href = '#';
    }
  }
  initTrackingClicks();
  body.innerHTML = '';
  const isDirectVideoFile = (url) => {
    if(!url) return false;
    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
  };
  if(type === 'video') {
    if(isDirectVideoFile(src)) {
      const v = document.createElement('video');
      v.src = src;
      v.controls = true;
      v.autoplay = true;
      v.muted = false;
      v.playsInline = true;
      body.appendChild(v);
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.title = t;
      iframe.setAttribute('allowfullscreen','');
      iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture');
      body.appendChild(iframe);
    }
  } else if(type === 'image') {
    const img = document.createElement('img');
    img.src = src;
    img.alt = t;
    body.appendChild(img);
  } else {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = t;
    iframe.setAttribute('allowfullscreen','');
    body.appendChild(iframe);
  }
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeWorkModal() {
  const modal = document.getElementById('workModal');
  const body = document.getElementById('workModalBody');
  if(modal) modal.classList.remove('open');
  if(body) body.innerHTML = '';
  document.body.style.overflow = '';
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.work-masonry-item').forEach(item => {
    item.addEventListener('click', () => openWorkModal(item));
  });
  const modal = document.getElementById('workModal');
  if(modal) {
    modal.addEventListener('click', (e) => {
      if(e.target === modal) closeWorkModal();
    });
  }
});

/* ===========================
   CONTACT FORM
=========================== */
async function handleGrowthPlanSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.form-submit');
  const form = e.target;
  const status = form.querySelector('.growth-plan-status');
  const original = btn.innerHTML;
  if (!form.checkValidity()) { form.reportValidity(); return; }
  btn.disabled = true;
  btn.textContent = 'Sending your brief…';
  if (status) status.textContent = '';
  const payload = {
    name: form.querySelector('[name=\"name\"]')?.value.trim() || '',
    email: form.querySelector('[name=\"email\"]')?.value || '',
    company: form.querySelector('[name=\"company\"]')?.value.trim() || '',
    website: form.querySelector('[name=\"website\"]')?.value.trim() || '',
    role: form.querySelector('[name=\"role\"]')?.value || '',
    phone: form.querySelector('[name=\"phone\"]')?.value || '',
    industry: form.querySelector('[name=\"industry\"]')?.value || '',
    objective: form.querySelector('[name=\"objective\"]')?.value || '',
    annual_revenue: form.querySelector('[name=\"annual_revenue\"]')?.value || '',
    project_budget: form.querySelector('[name=\"project_budget\"]')?.value || '',
    retainer_budget: form.querySelector('[name=\"retainer_budget\"]')?.value || '',
    timeline: form.querySelector('[name=\"timeline\"]')?.value || '',
    message: form.querySelector('[name=\"message\"]')?.value.trim() || '',
    source: form.querySelector('[name=\"source\"]')?.value || 'website',
    landing_page: window.location.href,
    attribution: getAttributionForSubmission(),
  };
  payload.source = payload.attribution.latest_touch?.utm_source || payload.attribution.first_touch?.utm_source || payload.source;
  try {
    const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Page': window.location.pathname, 'X-Lead-Form': 'growth-plan' }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Submission failed');
    }
    btn.textContent = 'Growth Plan received';
    btn.style.background = '#1a5a1a';
    if (status) status.textContent = 'Thanks — we have your brief and will be in touch shortly.';
    trackEvent('generate_lead', {
      form_id: 'growth_plan',
      lead_source: payload.source,
      industry: payload.industry,
      objective: payload.objective,
      page_type: document.body.dataset.page || 'contact'
    });
    if(typeof fbq !== 'undefined') fbq('track', 'Lead');
    form.reset();
  } catch (error) {
    btn.innerHTML = original;
    if (status) status.textContent = error.message || 'We could not send your brief. Please try again or contact us directly.';
  } finally { btn.disabled = false; }
}

function prefillGrowthPlan() {
  const form = document.querySelector('.growth-plan-form');
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  const industry = params.get('industry');
  const solution = params.get('solution');
  const objectiveMap = { build: 'brand-engine', launch: 'launch-engine', grow: 'growth-engine', scale: 'scale-partnership' };
  const industrySelect = form.querySelector('[name="industry"]');
  const objectiveSelect = form.querySelector('[name="objective"]');
  if (industry && industrySelect && [...industrySelect.options].some(option => option.value === industry)) industrySelect.value = industry;
  const selectedObjective = solution || objectiveMap[params.get('objective')] || params.get('objective');
  if (selectedObjective && objectiveSelect && [...objectiveSelect.options].some(option => option.value === selectedObjective)) objectiveSelect.value = selectedObjective;
}
document.addEventListener('DOMContentLoaded', prefillGrowthPlan);


function handleProjectSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.form-submit');
  const original = btn.innerHTML;
  btn.innerHTML = 'Project received! We will reach out soon.';
  btn.style.background = '#1a5a1a';
  trackEvent('project_form_submit');
  if(typeof gtag !== 'undefined') gtag('event','project_form_submitted',{event_category:'Lead'});
  if(typeof fbq !== 'undefined') fbq('track','CompleteRegistration');
  const form = e.target;
  const payload = {
    name: form.querySelector('[name=\"name\"]')?.value || '',
    email: form.querySelector('[name=\"email\"]')?.value || '',
    phone: form.querySelector('[name=\"phone\"]')?.value || '',
    company: form.querySelector('[name=\"company\"]')?.value || '',
    budget: form.querySelector('[name=\"budget\"]')?.value || '',
    timeline: form.querySelector('[name=\"timeline\"]')?.value || '',
    details: form.querySelector('[name=\"details\"]')?.value || '',
  };
  fetch('/api/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Page': 'project' },
    body: JSON.stringify(payload)
  }).catch(() => {});
  setTimeout(() => {
    btn.innerHTML = original;
    btn.style.background = '';
    e.target.reset();
    closeProjectForm();
  }, 3500);
}

function handleContactVideoClick(e) {
  const card = document.getElementById('contactVideoCard');
  const thumb = document.getElementById('contactVideoThumb');
  if(!card || !thumb) return;
  let video = thumb.querySelector('video');
  if(!video) {
    video = document.createElement('video');
    video.src = '/videos/videoContact.mp4';
    video.poster = '/videos/videoContact-poster.jpg';
    video.setAttribute('playsinline','');
    video.playsInline = true;
    video.preload = 'none';
    video.controls = false;
    video.muted = false;
    thumb.prepend(video);
    const emoji = thumb.querySelector('.founder-video-thumb-emoji');
    if(emoji) emoji.style.display = 'none';
    video.addEventListener('pause', () => card.classList.remove('is-playing'));
    video.addEventListener('ended', () => card.classList.remove('is-playing'));
  }
  if(video.paused) {
    video.play();
    card.classList.add('is-playing');
    trackEvent('contact_video_play');
  } else {
    video.pause();
    card.classList.remove('is-playing');
    trackEvent('contact_video_pause');
  }
}

/* ===========================
   GLOBAL ESCAPE KEY
=========================== */
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') {
    closeCalendly();
    closeVideoModal();
    closePlanner();
    closeProjectForm();
  }
});

/* ===========================
   CURSOR HOVER TARGETS
=========================== */
function refreshCursorTargets() {
  document.querySelectorAll('a,button,.svc-row,.wh-item,.work-masonry-item,.founder-card,.value-card,.team-card,.hero-card,.faq-q,.svc-card-header,.filter-btn,.testi-cta-block,.founder-video-card,.contact-info-item,.blog-card,.blog-feat-card,.blog-side-card,.tw-card,.pricing-card,.quiz-option').forEach(el => {
    if(!el._cursorBound) {
      el.addEventListener('mouseenter', () => cur.classList.add('big'));
      el.addEventListener('mouseleave', () => cur.classList.remove('big'));
      el._cursorBound = true;
    }
  });
}
function initDarkCursorZones() {
  document.querySelectorAll('.dark-section').forEach(el => {
    if(!el._darkCursorBound) {
      el.addEventListener('mouseenter', () => cur.classList.add('on-dark'));
      el.addEventListener('mouseleave', () => cur.classList.remove('on-dark'));
      el._darkCursorBound = true;
    }
  });
}
document.addEventListener('DOMContentLoaded', refreshCursorTargets);
document.addEventListener('DOMContentLoaded', initDarkCursorZones);
document.addEventListener('DOMContentLoaded', initTrackingClicks);
document.addEventListener('DOMContentLoaded', initGrowthPlanTracking);
document.addEventListener('DOMContentLoaded', initLazyWorkCovers);
setTimeout(refreshCursorTargets, 500);
setTimeout(initDarkCursorZones, 500);
setTimeout(initTrackingClicks, 500);

/* ===========================
   HERO PARALLAX
=========================== */
window.addEventListener('scroll', () => {
  if(document.body.dataset.page !== 'home') return;
  const hero = document.querySelector('.hero-left');
  if(hero) {
    hero.style.transform = 'translateY(' + (window.scrollY * 0.07) + 'px)';
  }
}, {passive:true});

/* ===========================
   VIDEO (add your link here)
=========================== */
// To set founder video, uncomment and replace YOUR_VIDEO_ID:
// document.getElementById('videoFrame').innerHTML =
//   '<iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1&rel=0" allow="autoplay; fullscreen" style="width:100%;height:100%;border:none;"></iframe>';
