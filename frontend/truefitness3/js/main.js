// ── TRUE FITNESS — Main Page Logic ──
// FILE LOCATION: truefitness 3/js/main.js
// Load order: api.js → auth.js → main.js

// ─────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────

function showToast(msg, type = 'error') {
  const existing = document.getElementById('tf-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'tf-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#16a34a' : '#dc2626'};
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 99999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    transition: opacity 0.3s;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ─────────────────────────────────────────────
// AUTO-REDIRECT IF ALREADY LOGGED IN
// ─────────────────────────────────────────────

(function () {
  const u = getSession();
  if (u) {
    // ✅ FIX: was 'dashboard.html' — now correctly 'dashboardd.html'
    if (u.role === 'admin') location.href = 'pages/admin/dashboard.html';
    else location.href = 'pages/user/dashboardd.html';
  }
})();

// ─────────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) o.classList.remove('open');
  });
});

// ─────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

document.querySelectorAll('#navLinks a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('open');
  });
});

// ─────────────────────────────────────────────
// MODAL SWITCHES
// ─────────────────────────────────────────────

function switchToSignup() {
  closeModal('loginModal');
  openModal('signupModal');
}

function switchToLogin() {
  closeModal('signupModal');
  openModal('loginModal');
}

// ─────────────────────────────────────────────
// RESET PASSWORD FORM TOGGLE
// ─────────────────────────────────────────────

function showReset() {
  document.getElementById('loginForm').style.display  = 'none';
  document.getElementById('resetForm').style.display  = 'block';
}

function hideReset() {
  document.getElementById('loginForm').style.display  = 'block';
  document.getElementById('resetForm').style.display  = 'none';
}

// ─────────────────────────────────────────────
// OTP BUTTONS
// ─────────────────────────────────────────────

async function sendOtp() {
  const phone = document.getElementById('resetPhone').value.trim();
  if (!phone) { showToast('Enter your phone number first.'); return; }
  const btn = document.querySelector('#resetForm .otp-btn');
  btn.textContent = 'Sending…';
  btn.disabled    = true;
  const res = await sendForgotPasswordOTP(phone);
  btn.textContent = 'Send OTP';
  btn.disabled    = false;
  showToast(res.msg, res.ok ? 'success' : 'error');
}

async function sendOtpSignup() {
  const phone    = document.getElementById('signupPhone').value.trim();
  const name     = document.getElementById('signupName').value.trim();
  const password = document.getElementById('signupPass').value.trim();

  if (!name)     { showToast('Enter your full name first.');    return; }
  if (!phone)    { showToast('Enter your phone number first.'); return; }
  if (!password) { showToast('Enter your password first.');     return; }

  const btn = document.querySelector('#signupModal .otp-btn');
  btn.textContent = 'Sending…';
  btn.disabled    = true;
  const res = await sendRegisterOTP(phone, name, password);
  btn.textContent = 'Send OTP';
  btn.disabled    = false;
  showToast(res.msg, res.ok ? 'success' : 'error');
}

// ─────────────────────────────────────────────
// LOGIN HANDLER
// ─────────────────────────────────────────────

async function handleLogin() {
  const phone = document.getElementById('loginPhone').value;
  const pass  = document.getElementById('loginPass').value;
  const err   = document.getElementById('loginErr');
  const btn   = document.querySelector('#loginForm .modal-submit');

  err.style.display = 'none';
  btn.textContent   = 'Logging in…';
  btn.disabled      = true;

  const res = await login(phone, pass);

  btn.textContent = 'Login';
  btn.disabled    = false;

  if (res.ok) {
    closeModal('loginModal');
    showToast('Login successful!', 'success');
    setTimeout(() => {
      // ✅ FIX: was 'dashboard.html' — now correctly 'dashboardd.html'
      if (res.role === 'admin') location.href = 'pages/admin/dashboard.html';
      else location.href = 'pages/user/dashboardd.html';
    }, 600);
  } else {
    err.textContent   = res.msg;
    err.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ['loginPhone', 'loginPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { 
      if (e.key === 'Enter') handleLogin(); 
    });
  });

  // ✅ ADD THIS LINE
  loadPlans();
});

// ─────────────────────────────────────────────
// SIGNUP HANDLER
// ─────────────────────────────────────────────

async function handleSignup() {
  const name    = document.getElementById('signupName').value;
  const phone   = document.getElementById('signupPhone').value;
  const pass    = document.getElementById('signupPass').value;
  const confirm = document.getElementById('signupConfirm').value;
  const err     = document.getElementById('signupErr');

  err.style.display = 'none';

  if (pass !== confirm) {
    err.textContent   = 'Passwords do not match.';
    err.style.display = 'block';
    return;
  }

  const btn = document.querySelector('#signupModal .modal-submit');
  btn.textContent = 'Creating account…';
  btn.disabled    = true;

 const planId = localStorage.getItem("selectedPlan");

const res = await signup(name, phone, pass, planId);

  btn.textContent = 'Sign Up';
  btn.disabled    = false;

  if (res.ok) {
    closeModal('signupModal');
    showToast('Account created! Welcome!', 'success');
    setTimeout(() => {
      // ✅ FIX: was 'dashboard.html' — now correctly 'dashboardd.html'
      if (res.role === 'admin') location.href = 'pages/admin/dashboard.html';
      else location.href = 'pages/user/dashboardd.html';
    }, 600);
  } else {
    err.textContent   = res.msg;
    err.style.display = 'block';
  }
}

// ─────────────────────────────────────────────
// RESET PASSWORD HANDLER
// ─────────────────────────────────────────────

async function handleReset() {
  const phone = document.getElementById('resetPhone').value;
  const otp   = document.getElementById('resetOtp') ? document.getElementById('resetOtp').value : '';
  const np    = document.getElementById('newPass').value;
  const cp    = document.getElementById('confirmPass').value;

  if (!np || np !== cp) {
    showToast('Passwords do not match.');
    return;
  }

  const res = await resetPassword(phone, otp, np);
  if (res.ok) {
    showToast('Password reset successfully!', 'success');
    hideReset();
  } else {
    showToast(res.msg);
  }
}

// ─────────────────────────────────────────────
// ACTIVE NAV LINK ON SCROLL
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// LOAD MEMBERSHIP PLANS (FRONTEND)
// ─────────────────────────────────────────────

async function loadPlans() {
  const res = await API.get('/plans');

  if (!res || !res.ok) return;

  const plans = res.data.data;

  const container = document.getElementById("plansContainer");
  if (!container) return;

  container.innerHTML = "";

  plans.forEach(plan => {
    const div = document.createElement("div");
    div.className = "plan-card";

    div.innerHTML = `
      <div class="plan-name">${plan.name}</div>

      <div class="plan-price">
        <sup>₹</sup>${plan.price}
      </div>

      <div class="plan-period">${plan.duration_days} days</div>

      <ul class="plan-features">
        ${(plan.features || []).map(f => `<li>✓ ${f}</li>`).join("")}
      </ul>

      <button class="plan-btn" onclick="selectPlan('${plan.id}')">
        Get Started
      </button>
    `;

    container.appendChild(div);
  });
}
function selectPlan(planId) {
  localStorage.setItem("selectedPlan", planId);
  openModal("signupModal");
}
window.addEventListener('scroll', () => {
  const sections = ['home', 'about', 'trainers', 'plans', 'contact'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);
    if (!link) return;
    if (rect.top <= 80 && rect.bottom > 80) {
      document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
    }
  });
});