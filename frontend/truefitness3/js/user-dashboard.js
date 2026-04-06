// ── TRUE FITNESS — USER DASHBOARD JS ──
// Depends on: api.js + auth.js (loaded first)

// ─── GUARD ───
const currentUser = requireRole('user');

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────

let workouts = [
  { day: 'Mon', name: 'Chest & Triceps', dur: '60 min' },
  { day: 'Tue', name: 'Back & Biceps',   dur: '60 min' },
  { day: 'Wed', name: 'Chest & Triceps', dur: '60 min' },
  { day: 'Thu', name: 'Legs & Shoulders',dur: '75 min' },
];

const classes = [
  { name: 'HIIT Training',       trainer: 'Mike Thompson',  time: '6:00 PM – 7:00 PM', spots: '12/15', status: 'live',     statusLabel: 'In Progress' },
  { name: 'Yoga & Flexibility',  trainer: 'Emma Davis',     time: '7:30 PM – 8:30 PM', spots: '8/12',  status: 'upcoming', statusLabel: 'Upcoming'    },
  { name: 'Strength Training',   trainer: 'Sarah Johnson',  time: '6:00 AM – 7:00 AM', spots: '5/10',  status: 'tomorrow', statusLabel: 'Tomorrow'    },
];

async function loadDiet() {
  if (!currentUser) return;

  const res = await API.get(`/diet/${currentUser.id}`);

  if (!res?.ok) {
    console.log("Failed to load diet");
    return;
  }

  const dietList = document.getElementById("dietList");
  dietList.innerHTML = "";

  let totalCalories = 0;

  const dietData = res.data?.data || res.data || [];
console.log("DIET DATA:", dietData);
dietData.forEach((item) => {
    dietList.innerHTML += `
      <div class="diet-item">
        <strong>${item.meal_type}</strong>: 
        ${item.food_name}
        <div>${item.calories}</div>
        <small>${item.day}</small>
      </div>
    `;

    // optional: extract calories number
    const calMatch = item.calories?.match(/\d+/);
    if (calMatch) totalCalories += parseInt(calMatch[0]);
  });

  const totalEl = document.getElementById("totalCals");
if (totalEl) totalEl.textContent = totalCalories + " kcal";
}

const goals = [
  { name: 'Workouts Completed', current: 4,  target: 5,  unit: 'sessions' },
  { name: 'Calories Burned',    current: 1800, target: 2500, unit: 'kcal' },
  { name: 'Water Intake',       current: 6,  target: 8,  unit: 'glasses' },
  { name: 'Sleep Hours',        current: 7,  target: 8,  unit: 'hrs/night' },
];

const notifs = [
  { icon: '🔴', cls: 'red', title: 'Membership Reminder', msg: 'Your premium membership expires in 45 days', time: '2 hours ago', alert: true },
  { icon: '🔔', cls: '',    title: 'New Class Added',     msg: 'HIIT training class now available on weekends', time: '1 day ago' },
  { icon: '🏆', cls: '',    title: 'Achievement Unlocked', msg: "Congratulations! You've completed 100 workouts", time: '3 days ago' },
];

const offers = [
  { icon: '💪', featured: true,  name: '50% Off on Personal Training', desc: 'Get half price on your first month of personal training sessions', tag: 'Valid till March 31' },
  { icon: '🎁', featured: false, name: 'Free Diet Consultation',       desc: 'Complimentary nutrition planning with our expert dietitians',     tag: 'Limited time offer' },
  { icon: '👥', featured: false, name: 'Refer & Earn',                 desc: 'Get 1 month free membership for every friend you refer',          tag: 'Ongoing offer' },
];

// ─────────────────────────────────────────────
// INIT — load user data from session + API
// ─────────────────────────────────────────────

async function init() {
  // Populate from session
  if (currentUser) {
    const firstName = (currentUser.name || 'User').split(' ')[0];
    document.getElementById('userFirstName').textContent = firstName;
    document.getElementById('menuWelcome').textContent   = `Welcome, ${firstName}`;
    document.getElementById('menuUserName').textContent  = currentUser.name || 'User';
    document.getElementById('menuUserPhone').textContent = currentUser.phone || '—';
    document.getElementById('menuAvatarInit').textContent = firstName[0].toUpperCase();

    // Profile modal
    document.getElementById('profileAvatarBig').textContent = firstName[0].toUpperCase();
    document.getElementById('profileNameBig').textContent   = currentUser.name || 'User';
    document.getElementById('profileEmail').textContent     = currentUser.email || 'user@truefitness.com';
    document.getElementById('profilePhone').textContent     = currentUser.phone || '—';
    document.getElementById('profilePlanBadge').textContent = 'Premium Member';

    // Edit profile prefill
    document.getElementById('editName').value  = currentUser.name  || '';
    document.getElementById('editEmail').value = currentUser.email || '';
    document.getElementById('editPhone').value = currentUser.phone || '';
  }

  // Try to load membership from backend
  await loadMembership();

  // Render all static sections
  renderWorkouts();
  renderClasses();
  await loadDiet();
  renderGoals();
  renderNotifs();
  renderOffers();
}

// ─────────────────────────────────────────────
// LOAD MEMBERSHIP FROM BACKEND
// ─────────────────────────────────────────────

async function loadMembership() {
  if (!currentUser) return;
  const res = await API.get(`/gym/members/${currentUser.id}`);
  if (res && res.ok && res.data) {
    const m = res.data;
    if (m.membership_plan || m.plan_type) {
      document.getElementById('planType').textContent = m.membership_plan || m.plan_type || 'Premium';
    }
    if (m.joined_at || m.created_at) {
      const d = new Date(m.joined_at || m.created_at);
      document.getElementById('memberSince').textContent = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      document.getElementById('profileSince').textContent = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    }
    if (m.expiry_date || m.renewal_date) {
      const exp = new Date(m.expiry_date || m.renewal_date);
      document.getElementById('renewalDate').textContent = exp.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const daysLeft = Math.max(0, Math.ceil((exp - Date.now()) / 86400000));
      document.getElementById('daysLeft').textContent = daysLeft + ' Days';
      // progress bar: remaining / total (assume 365 day plan)
      const pct = Math.max(5, Math.round((daysLeft / 365) * 100));
      document.getElementById('membershipProgress').style.width = pct + '%';
    }
    if (m.trainer_name) {
      document.getElementById('trainerName').textContent    = m.trainer_name;
      document.getElementById('trainerInitial').textContent = m.trainer_name[0].toUpperCase();
    }
    if (m.membership_status === 'expired') {
      document.getElementById('membershipBadge').textContent = 'Expired';
      document.getElementById('membershipBadge').style.background = 'rgba(232,40,26,0.15)';
      document.getElementById('membershipBadge').style.color      = '#f87171';
    }
  }
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

// function addExercise() {
  // const day  = document.getElementById('exDay').value;
  const name = document.getElementById('exName').value.trim();
  const dur  = document.getElementById('exDur').value.trim();
  if (!day || !name) { showToast('Please select a day and enter exercise name'); return; }
  workouts.push({ day, name, dur: dur || '—' });
  renderWorkouts();
  document.getElementById('exDay').value  = '';
  document.getElementById('exName').value = '';
  document.getElementById('exDur').value  = '';
  showToast('Exercise added!', 'success');
// }

function deleteWorkout(i) {
  workouts.splice(i, 1);
  renderWorkouts();
  showToast('Exercise removed', 'success');
}

let workout = [];

async function loadGymPlans() {
  const res = await API.get("/gym-plans?user_id=123");

  if (res?.ok) {
    console.log("API DATA:", res.data);

    const plans = res.data.data || res.data;

    workouts = [];

    plans.forEach(plan => {
      const days = plan.days || {};

      Object.keys(days).forEach(day => {
        days[day].forEach(ex => {
          workouts.push({
            day: day,
            name: ex.name,
            dur: ex.reps || ex.sets || "-"
          });
        });
      });
    });

    renderWorkouts();
  }
}
// ─────────────────────────────────────────────
// RENDER CLASSES
// ─────────────────────────────────────────────

function renderClasses() {
  const el = document.getElementById('classesList');
  if (!el) return;
  el.innerHTML = classes.map(c => `
    <div class="class-item">
      <div>
        <div class="class-name">${c.name}</div>
        <div class="class-meta">
          <span>👤 ${c.trainer}</span>
          <span>🕐 ${c.time}</span>
          <span>👥 ${c.spots}</span>
        </div>
      </div>
      <span class="class-status cs-${c.status}">${c.statusLabel}</span>
    </div>`).join('');
}

// ─────────────────────────────────────────────
// RENDER DIET
// ─────────────────────────────────────────────



// ─────────────────────────────────────────────
// RENDER GOALS
// ─────────────────────────────────────────────

function renderGoals() {
  const el = document.getElementById('goalsList');
  if (!el) return;
  el.innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    return `
    <div class="goal-item">
      <div class="goal-top">
        <span class="goal-name">${g.name}</span>
        <span class="goal-val">${g.current}/${g.target} ${g.unit}</span>
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// RENDER NOTIFICATIONS
// ─────────────────────────────────────────────

async function renderNotifs() {
  // Try to load from backend first
  const res = await API.get('/notifications');
  if (res && res.ok && res.data.length) {
    const el = document.getElementById('notifBody');
    if (el) {
      el.innerHTML = res.data.map((n, i) => `
        <div class="notif-item ${i === 0 ? 'alert' : ''}">
          <div class="notif-dot-icon ${i === 0 ? 'red' : ''}">🔔</div>
          <div>
            <div class="notif-title">${n.title}</div>
            <div class="notif-msg">${n.message || n.body || ''}</div>
            <div class="notif-time">${n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}</div>
          </div>
        </div>`).join('');
    }
    return;
  }
  // Fallback to local
  const el = document.getElementById('notifBody');
  if (!el) return;
  el.innerHTML = notifs.map((n, i) => `
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

function openPanel(id) {
  document.getElementById('panelOverlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closePanel(id) {
  document.getElementById(id).classList.remove('open');
  // Hide overlay only if no panels open
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

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) o.classList.remove('open');
  });
});

// ─────────────────────────────────────────────
// SAVE PROFILE
// ─────────────────────────────────────────────

async function saveProfile() {
  const name  = document.getElementById('editName').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  if (!name) { showToast('Name is required'); return; }

  // Try to update via backend
  const res = await API.put(`/auth/profile`, { name, email, phone });
  if (res && res.ok) {
    // Update session
    const session = JSON.parse(localStorage.getItem('tf_user') || '{}');
    session.name  = name;
    session.email = email;
    session.phone = phone;
    localStorage.setItem('tf_user', JSON.stringify(session));
  }

  // Update UI regardless
  const firstName = name.split(' ')[0];
  document.getElementById('userFirstName').textContent  = firstName;
  document.getElementById('profileNameBig').textContent = name;
  document.getElementById('profileAvatarBig').textContent = firstName[0].toUpperCase();
  document.getElementById('menuUserName').textContent   = name;
  document.getElementById('menuAvatarInit').textContent = firstName[0].toUpperCase();
  document.getElementById('profileEmail').textContent   = email || 'user@truefitness.com';
  document.getElementById('profilePhone').textContent   = phone || '—';
  document.getElementById('menuUserPhone').textContent  = phone || '—';

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
  localStorage.setItem('tf_accent', color);
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
async function loadUserPlan() {
  const userRes = await API.get('/users/me');
  if (!userRes || !userRes.ok) return;

  const user = userRes.data.data;
  if (!user.plan_id) return;

  const plansRes = await API.get('/plans');
  const plans = plansRes.data.data;

  const plan = plans.find(p => p.id == user.plan_id);
  if (!plan) return;

  document.getElementById("userPlanName").innerText = plan.name;
  document.getElementById("userPlanPrice").innerText = "₹" + plan.price;
  document.getElementById("userPlanDuration").innerText = plan.duration_days + " days";

  const featuresList = document.getElementById("userPlanFeatures");
  featuresList.innerHTML = (plan.features || [])
    .map(f => `<li>✓ ${f}</li>`)
    .join("");
}
document.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  init();

  // ✅ ADD THIS
  loadUserPlan();
});

applySavedTheme();
init();