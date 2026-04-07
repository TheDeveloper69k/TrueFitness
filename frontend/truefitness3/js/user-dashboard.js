// ── TRUE FITNESS — USER DASHBOARD JS ──
// Depends on: api.js + auth.js (loaded first)

// ─── GUARD ───
const currentUser = requireRole('user');

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────

let workouts = [
  { day: 'Mon', name: 'Chest & Triceps',  dur: '60 min' },
  { day: 'Tue', name: 'Back & Biceps',    dur: '60 min' },
  { day: 'Wed', name: 'Chest & Triceps',  dur: '60 min' },
  { day: 'Thu', name: 'Legs & Shoulders', dur: '75 min' },
];

const notifs = [
  { icon: '🔴', cls: 'red', title: 'Membership Reminder', msg: 'Your premium membership expires in 45 days', time: '2 hours ago', alert: true },
  { icon: '🔔', cls: '',    title: 'New Class Added',      msg: 'HIIT training class now available on weekends', time: '1 day ago' },
  { icon: '🏆', cls: '',    title: 'Achievement Unlocked', msg: "Congratulations! You've completed 100 workouts", time: '3 days ago' },
];

const offers = [
  { icon: '💪', featured: true,  name: '50% Off on Personal Training', desc: 'Get half price on your first month of personal training sessions', tag: 'Valid till March 31' },
  { icon: '🎁', featured: false, name: 'Free Diet Consultation',        desc: 'Complimentary nutrition planning with our expert dietitians',    tag: 'Limited time offer' },
  { icon: '👥', featured: false, name: 'Refer & Earn',                  desc: 'Get 1 month free membership for every friend you refer',         tag: 'Ongoing offer' },
];

let dietData = [];

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

async function init() {
  if (currentUser) {
    const firstName = (currentUser.name || 'User').split(' ')[0];
    document.getElementById('userFirstName').textContent  = firstName;
    document.getElementById('menuWelcome').textContent    = `Welcome, ${firstName}`;
    document.getElementById('menuUserName').textContent   = currentUser.name || 'User';
    document.getElementById('menuUserPhone').textContent  = currentUser.phone || '—';
    document.getElementById('menuAvatarInit').textContent = firstName[0].toUpperCase();

    document.getElementById('profileAvatarBig').textContent = firstName[0].toUpperCase();
    document.getElementById('profileNameBig').textContent   = currentUser.name || 'User';
    document.getElementById('profileEmail').textContent     = currentUser.email || 'user@truefitness.com';
    document.getElementById('profilePhone').textContent     = currentUser.phone || '—';
    document.getElementById('profilePlanBadge').textContent = 'Premium Member';

    document.getElementById('editName').value  = currentUser.name  || '';
    document.getElementById('editEmail').value = currentUser.email || '';
    document.getElementById('editPhone').value = currentUser.phone || '';
  }

  await loadMembership();
  await loadTrainer();
  await loadDiet();
  await loadGymPlan();

  renderWorkouts();
  await renderNotifs();
  renderOffers();
}

// ─────────────────────────────────────────────
// LOAD MEMBERSHIP
// ─────────────────────────────────────────────

async function loadMembership() {
  if (!currentUser) return;

  try {
    const res = await API.get(`/memberships/me`);
    console.log("Membership API response:", res);

    if (!res || !res.ok) {
      console.error("Membership API failed:", res);
      return;
    }

    const m = res.data?.data || res.data || null;
    if (!m) {
      console.warn("No membership found");
      return;
    }

    const planVal =
      m.membership_plan ||
      m.plan_type ||
      m.plan_name ||
      m.monthly_plan ||
      "Premium";

    document.getElementById("planType").textContent = planVal;
    document.getElementById("profilePlanType").textContent = planVal;

    const joinDate = m.joined_at || m.created_at || m.start_date;
    if (joinDate) {
      const d = new Date(joinDate);
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      document.getElementById("memberSince").textContent = label;
      document.getElementById("profileSince").textContent = label;
    }

    const expiryDate = m.expiry_date || m.renewal_date || m.end_date;
    if (expiryDate) {
      const exp = new Date(expiryDate);
      const daysLeft = Math.max(0, Math.ceil((exp - Date.now()) / 86400000));

      document.getElementById("renewalDate").textContent = exp.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      document.getElementById("daysLeft").textContent = `${daysLeft} Days`;

      const pct = Math.max(5, Math.min(100, Math.round((daysLeft / 365) * 100)));
      document.getElementById("membershipProgress").style.width = pct + "%";

      if (daysLeft <= 30) {
        document.getElementById("expiryWarn").classList.add("show");
      }
    }

    if (m.membership_status === "expired" || m.status === "expired") {
      const badge = document.getElementById("membershipBadge");
      badge.textContent = "Expired";
      badge.style.background = "rgba(232,40,26,0.15)";
      badge.style.color = "#f87171";
    }
  } catch (err) {
    console.error("loadMembership error:", err);
  }
}
// ─────────────────────────────────────────────
// LOAD TRAINER
// ─────────────────────────────────────────────

async function loadTrainer() {
  if (!currentUser) return;

  try {
    const res = await API.get(`/trainers/user/${currentUser.id}`);
    console.log("Trainer API response:", res);

    if (!res || !res.ok) {
      console.error("Trainer API failed:", res);
      return;
    }

    const raw = res.data?.data || res.data;
    const trainer = Array.isArray(raw) ? raw[0] : raw;

    if (!trainer) {
      console.warn("No trainer assigned");
      return;
    }

    const tName =
      trainer.name ||
      trainer.full_name ||
      trainer.trainer_name ||
      "Not Assigned";

    document.getElementById("trainerInitial").textContent = tName[0]?.toUpperCase() || "—";
    document.getElementById("trainerName").textContent = tName;
    document.getElementById("trainerSpec").textContent = trainer.specialization || "—";
    document.getElementById("trainerExp").textContent = trainer.experience
      ? `${trainer.experience}${String(trainer.experience).includes("year") ? "" : " years experience"}`
      : "—";

    document.getElementById("trainerSpecInfo").textContent = trainer.specialization || "—";
    document.getElementById("trainerExpInfo").textContent = trainer.experience
      ? `${trainer.experience}${String(trainer.experience).includes("year") ? "" : " yrs"}`
      : "—";

    document.getElementById("trainerSessions").textContent = trainer.sessions_per_week
      ? `${trainer.sessions_per_week}/week`
      : "—";

    document.getElementById("trainerPhone").textContent =
      trainer.phone || trainer.contact || "—";
  } catch (err) {
    console.error("loadTrainer error:", err);
  }
}

// ─────────────────────────────────────────────
// LOAD DIET PLAN  (tabbed by day)
// ─────────────────────────────────────────────

const SLOT_ICONS = {
  breakfast:      '🌅',
  lunch:          '☀️',
  dinner:         '🌙',
  snack:          '🍎',
  'pre-workout':  '⚡',
  'post-workout': '🥤',
};

async function loadDiet() {
  if (!currentUser) return;

  const res = await API.get(`/diet/${currentUser.id}`);
  if (!res?.ok) {
    document.getElementById('dietSlots').innerHTML = '<div class="diet-empty">No diet plan assigned yet.</div>';
    return;
  }

  dietData = res.data?.data || [];

  if (!Array.isArray(dietData) || !dietData.length) {
    document.getElementById('dietSlots').innerHTML = '<div class="diet-empty">No diet plan assigned yet.</div>';
    return;
  }

  // Sort diet days in week order
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  dietData.sort((a, b) => {
    const aNorm = (a.day || '').charAt(0).toUpperCase() + (a.day || '').slice(1).toLowerCase().trim();
    const bNorm = (b.day || '').charAt(0).toUpperCase() + (b.day || '').slice(1).toLowerCase().trim();
    return dayOrder.indexOf(aNorm) - dayOrder.indexOf(bNorm);
  });

  const tabsEl = document.getElementById('dietTabs');
  tabsEl.innerHTML = dietData.map((plan, i) => `
    <button class="diet-tab ${i === 0 ? 'active' : ''}"
            onclick="switchDietDay(${i}, this)">
      ${plan.day}
    </button>`).join('');

  renderDietSlots(0);
}

function switchDietDay(index, btn) {
  document.querySelectorAll('.diet-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderDietSlots(index);
}

function renderDietSlots(index) {
  const plan  = dietData[index];
  const slots = plan?.slots || [];
  const el    = document.getElementById('dietSlots');

  if (!slots.length) {
    el.innerHTML = '<div class="diet-empty">No meals for this day.</div>';
    document.getElementById('totalCals').textContent = '— kcal';
    return;
  }

  let totalCals = 0;
  el.innerHTML = slots.map(slot => {
    const cals  = parseInt(slot.calories || slot.kcal || 0);
    totalCals  += cals;
    const icon  = SLOT_ICONS[slot.label?.toLowerCase()] || '🍽️';
    const label = slot.label    || 'Meal';
    const time  = slot.time     || '';
    const food  = slot.food_name || slot.food || '—';
    return `
      <div class="diet-slot">
        <div class="diet-slot-icon">${icon}</div>
        <div style="flex:1">
          <div class="diet-slot-label">${label}</div>
          ${time ? `<div class="diet-slot-time">🕐 ${time}</div>` : ''}
          <div class="diet-slot-food">${food}</div>
        </div>
        ${cals ? `<div class="diet-slot-cals">${cals} kcal</div>` : ''}
      </div>`;
  }).join('');

  document.getElementById('totalCals').textContent = totalCals ? totalCals + ' kcal' : '— kcal';
}

// ─────────────────────────────────────────────
// LOAD GYM PLAN  (collapsible days)
// ─────────────────────────────────────────────

async function loadGymPlan() {
  if (!currentUser) return;
  const el = document.getElementById('gymPlanBody');
  if (!el) return;

  const res = await API.get(`/gym-plans/user/${currentUser.id}`);
  console.log("Gym plan API response:", res);

  if (!res?.ok) {
    el.innerHTML = '<div class="gym-plan-empty">No gym plan assigned yet.</div>';
    return;
  }

  const plans = res.data?.data || res.data || [];
  if (!Array.isArray(plans) || !plans.length) {
    el.innerHTML = '<div class="gym-plan-empty">No gym plan assigned yet.</div>';
    return;
  }

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const allDays = {};

  plans.forEach(plan => {
    let days = plan.days || {};

    // Fix: if backend sends JSON string
    if (typeof days === "string") {
      try {
        days = JSON.parse(days);
      } catch (e) {
        console.error("Invalid days JSON:", days);
        days = {};
      }
    }

    Object.keys(days).forEach(day => {
      const normalized =
        day.charAt(0).toUpperCase() + day.slice(1).toLowerCase().trim();

      if (!allDays[normalized]) allDays[normalized] = [];

      const exercises = Array.isArray(days[day]) ? days[day] : [];
      allDays[normalized].push(...exercises);
    });
  });

  const sortedDays = Object.keys(allDays).sort(
    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
  );

  if (!sortedDays.length) {
    el.innerHTML = '<div class="gym-plan-empty">No exercises found in your plan.</div>';
    return;
  }

  el.innerHTML = "";

  sortedDays.forEach((day, i) => {
    const exercises = allDays[day];

    const exHtml = exercises.map(ex => {
      const sets = ex.sets ? `<span class="gym-ex-pill sets">${ex.sets} sets</span>` : '';
      const reps = ex.reps ? `<span class="gym-ex-pill reps">${ex.reps} reps</span>` : '';
      const rest = ex.rest ? `<span class="gym-ex-pill rest">Rest ${ex.rest}</span>` : '';
      const dur  = ex.duration ? `<span class="gym-ex-pill">${ex.duration}</span>` : '';

      return `
        <div class="gym-ex-row">
          <div class="gym-ex-name">${ex.name || ex.exercise || '—'}</div>
          ${sets}${reps}${rest}${dur}
        </div>
      `;
    }).join('');

    el.insertAdjacentHTML('beforeend', `
      <div class="gym-plan-card">
        <div class="gym-day-header ${i === 0 ? 'open' : ''}" onclick="toggleGymDay(this)">
          <span class="day-badge">${day}</span>
          <span>${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gym-exercises ${i === 0 ? 'open' : ''}">
          ${exHtml}
        </div>
      </div>
    `);
  });
}
function toggleGymDay(header) {
  header.classList.toggle('open');
  const body = header.nextElementSibling;
  if (body) body.classList.toggle('open');
}

// ─────────────────────────────────────────────
// RENDER WORKOUTS
// ─────────────────────────────────────────────

function renderWorkouts() {
  const el = document.getElementById('workoutList');
  if (!el) return;
  el.innerHTML = workouts.map((w, i) => `
    <div class="workout-item">
      <div class="day-tag">${w.day}</div>
      <div class="workout-info">
        <div class="workout-name">${w.name}</div>
        <div class="workout-dur">${w.dur}</div>
      </div>
      <button class="workout-del" onclick="deleteWorkout(${i})" title="Remove">🗑</button>
    </div>`).join('');
}

function addExercise() {
  const day  = document.getElementById('exDay').value;
  const name = document.getElementById('exName').value.trim();
  const dur  = document.getElementById('exDur').value.trim();
  if (!day || !name) { showToast('Please select a day and enter exercise name'); return; }
  workouts.push({ day, name, dur: dur || '—' });
  renderWorkouts();
  document.getElementById('exDay').value  = '';
  document.getElementById('exName').value = '';
  document.getElementById('exDur').value  = '';
  showToast('Exercise added!', 'success');
}

function deleteWorkout(i) {
  workouts.splice(i, 1);
  renderWorkouts();
  showToast('Exercise removed', 'success');
}

// ─────────────────────────────────────────────
// RENDER NOTIFICATIONS
// ─────────────────────────────────────────────

async function renderNotifs() {
  const res = await API.get('/notifications');
  const el  = document.getElementById('notifBody');
  if (!el) return;

  // FIX: notifications response is { ok, data: [...] } — unwrap correctly
  const list = res?.data?.data || res?.data || [];
  if (res && res.ok && Array.isArray(list) && list.length) {
    el.innerHTML = list.map((n, i) => `
      <div class="notif-item ${i === 0 ? 'alert' : ''}">
        <div class="notif-dot-icon ${i === 0 ? 'red' : ''}">🔔</div>
        <div>
          <div class="notif-title">${n.title}</div>
          <div class="notif-msg">${n.message || n.body || ''}</div>
          <div class="notif-time">${n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}</div>
        </div>
      </div>`).join('');
    return;
  }

  // Fallback to static notifications
  el.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.alert ? 'alert' : ''}">
      <div class="notif-dot-icon ${n.cls}">${n.icon}</div>
      <div>
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.msg}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────
// RENDER OFFERS
// ─────────────────────────────────────────────

function renderOffers() {
  const el = document.getElementById('offersBody');
  if (!el) return;
  el.innerHTML = offers.map(o => `
    <div class="offer-item ${o.featured ? 'featured' : ''}">
      <div class="offer-icon">${o.icon}</div>
      <div class="offer-name">${o.name}</div>
      <div class="offer-desc">${o.desc}</div>
      <div class="offer-tag">${o.tag}</div>
    </div>`).join('');
}

// ─────────────────────────────────────────────
// PANEL HELPERS
// ─────────────────────────────────────────────

window.openPanel = function(id) {
  document.getElementById('panelOverlay').classList.add('open');
  document.getElementById(id).classList.add('open');
};

function closePanel(id) {
  document.getElementById(id).classList.remove('open');
  const anyOpen = document.querySelectorAll('.panel.open').length > 0;
  if (!anyOpen) document.getElementById('panelOverlay').classList.remove('open');
}

function closeAllPanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  document.getElementById('panelOverlay').classList.remove('open');
}

// ─────────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

// ─────────────────────────────────────────────
// SAVE PROFILE
// ─────────────────────────────────────────────

async function saveProfile() {
  const name  = document.getElementById('editName').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  if (!name) { showToast('Name is required'); return; }

  const res = await API.put(`/auth/profile`, { name, email, phone });
  if (res && res.ok) {
    const session = JSON.parse(localStorage.getItem('tf_user') || '{}');
    session.name  = name;
    session.email = email;
    session.phone = phone;
    localStorage.setItem('tf_user', JSON.stringify(session));
  }

  const firstName = name.split(' ')[0];
  document.getElementById('userFirstName').textContent    = firstName;
  document.getElementById('profileNameBig').textContent   = name;
  document.getElementById('profileAvatarBig').textContent = firstName[0].toUpperCase();
  document.getElementById('menuUserName').textContent     = name;
  document.getElementById('menuAvatarInit').textContent   = firstName[0].toUpperCase();
  document.getElementById('profileEmail').textContent     = email || 'user@truefitness.com';
  document.getElementById('profilePhone').textContent     = phone || '—';
  document.getElementById('menuUserPhone').textContent    = phone || '—';

  closeModal('editProfileModal');
  showToast('Profile updated!', 'success');
}

// ─────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────

function setTheme(mode) {
  document.body.classList.toggle('light-mode', mode === 'light');
  document.getElementById('darkModeBtn').classList.toggle('selected',  mode === 'dark');
  document.getElementById('lightModeBtn').classList.toggle('selected', mode === 'light');
  localStorage.setItem('tf_theme', mode);
}

function setAccent(color, dark, btn) {
  document.documentElement.style.setProperty('--accent',      color);
  document.documentElement.style.setProperty('--accent-dark', dark);
  document.documentElement.style.setProperty('--accent-dim',  color + '1f');
  document.getElementById('previewBtn').style.background = color;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  localStorage.setItem('tf_accent',      color);
  localStorage.setItem('tf_accent_dark', dark);
}

function resetTheme() {
  setTheme('dark');
  setAccent('#e8281a', '#b81f14', document.querySelector('.color-btn'));
  localStorage.removeItem('tf_accent');
  localStorage.removeItem('tf_accent_dark');
  showToast('Theme reset to default', 'success');
}

function applySavedTheme() {
  const theme  = localStorage.getItem('tf_theme');
  const accent = localStorage.getItem('tf_accent');
  const dark   = localStorage.getItem('tf_accent_dark');
  if (theme)  setTheme(theme);
  if (accent) {
    document.documentElement.style.setProperty('--accent',      accent);
    document.documentElement.style.setProperty('--accent-dark', dark || accent);
    document.documentElement.style.setProperty('--accent-dim',  accent + '1f');
  }
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────

function showToast(msg, type = 'error') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.background = type === 'success' ? '#16a34a' : '#c0392b';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.remove(), 3000);
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  applySavedTheme();
  init();
});