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
function trackEvent(name, params) {
  try {
    if(typeof gtag !== 'undefined') gtag('event', name, params || {});
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
}

/* ===========================
   ADMIN DASHBOARD (FRONTEND)
=========================== */
async function adminLogin() {
  const user = document.getElementById('adminUser').value;
  const pass = document.getElementById('adminPass').value;
  const err = document.getElementById('adminErr');
  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });
    if(res.ok) {
      err.textContent = '';
      await loadAdminSubmissions();
      return;
    }
    err.textContent = 'Invalid credentials';
  } catch (e) {
    err.textContent = 'Login failed';
  }
}

async function loadAdminSubmissions() {
  const login = document.getElementById('adminLogin');
  const wrap = document.getElementById('adminTableWrap');
  const tbody = document.querySelector('#adminTable tbody');
  try {
    const res = await fetch('/api/admin/submissions');
    if(!res.ok) {
      login.style.display = '';
      wrap.style.display = 'none';
      return;
    }
    const data = await res.json();
    tbody.innerHTML = data.items.map(i => (
      '<tr>' +
        '<td><span class=\"admin-pill\">'+i.type+'</span></td>' +
        '<td>'+new Date(i.createdAt).toLocaleString()+'</td>' +
        '<td class=\"admin-row\">'+JSON.stringify(i.data, null, 2)+'</td>' +
      '</tr>'
    )).join('');
    login.style.display = 'none';
    wrap.style.display = '';
  } catch (e) {
    login.style.display = '';
    wrap.style.display = 'none';
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
  setActiveNav();
  trackPage();
  if(document.body.dataset.page === 'admin') setTimeout(loadAdminSubmissions, 100);
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
    frame.innerHTML = '<video src="/videos/videoHome.mp4" poster="/videos/videoHome-poster.jpg" autoplay playsinline controls></video>';
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
  document.getElementById('quizNext').disabled = false;
  // little bounce feedback
  btn.style.transform = 'translateX(8px)';
  setTimeout(() => btn.style.transform = '', 200);
}

function quizNext() {
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
    buildResult();
  }
}

function quizBack() {
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
  document.querySelectorAll('.work-masonry-item').forEach(item => {
    if (cat === 'all' || item.getAttribute('data-cat') === cat) {
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
  if(type === 'video') {
    const v = document.createElement('video');
    v.src = src;
    v.controls = true;
    v.autoplay = true;
    v.muted = false;
    v.playsInline = true;
    body.appendChild(v);
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
function handleSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.form-submit');
  btn.innerHTML = '? Message Sent! We\'ll be in touch soon.';
  btn.style.background = '#1a5a1a';
  trackEvent('contact_form_submit');
  if(typeof gtag !== 'undefined') gtag('event','form_submitted',{event_category:'Lead'});
  if(typeof fbq !== 'undefined') fbq('track','CompleteRegistration');
  const form = e.target;
  const payload = {
    first_name: form.querySelector('[name=\"first_name\"]')?.value || '',
    last_name: form.querySelector('[name=\"last_name\"]')?.value || '',
    email: form.querySelector('[name=\"email\"]')?.value || '',
    phone: form.querySelector('[name=\"phone\"]')?.value || '',
    interest: form.querySelector('[name=\"interest\"]')?.value || '',
    message: form.querySelector('[name=\"message\"]')?.value || '',
  };
  fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Page': 'contact' },
    body: JSON.stringify(payload)
  }).catch(() => {});
  setTimeout(() => {
    btn.innerHTML = 'Send Message <span class="arr">?</span>';
    btn.style.background = '';
    e.target.reset();
  }, 4000);
}


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
    video.preload = 'metadata';
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
