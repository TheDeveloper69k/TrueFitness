// ── TRUE FITNESS — AUTH ──
// FILE LOCATION: truefitness 3/js/auth.js
// Requires: api.js loaded before this

function requireRole(role) {
  const u = getSession();
  const token = getAccessToken();

  if (!u || !token) {
    goTo("index.html");
    return null;
  }

  if (u.role !== role) {
    goTo(u.role === "admin" ? "pages/admin/dashboard.html" : "pages/user/dashboardd.html");
    return null;
  }

  return u;
}

async function login(phone, password) {
  phone = (phone || "").trim();
  password = (password || "").trim();

  if (!phone || !password) {
    return { ok: false, msg: "Phone and password are required." };
  }

  const r = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });

  if (!r) return { ok: false, msg: "Something went wrong. Check your connection." };
  if (!r.ok) return { ok: false, msg: r.data?.message || "Invalid phone or password." };

  setAccessToken(r.data.accessToken);
  setSession(r.data.data);

  return { ok: true, role: r.data.data.role };
}

async function signup(name, phone, pass, planId){
  name = (name || "").trim();
  phone = (phone || "").trim();
  password = (password || "").trim();

  if (!name || !phone || !password) {
    return { ok: false, msg: "All fields are required." };
  }
  if (phone.length < 10) {
    return { ok: false, msg: "Enter a valid 10-digit phone number." };
  }
  if (password.length < 6) {
    return { ok: false, msg: "Password must be at least 6 characters." };
  }

  const r = await apiFetch("/auth/register", {
    method: "POST",
   body: JSON.stringify({
  name,
  phone,
  password: pass,
  plan_id: planId
}),
  });

  if (!r) return { ok: false, msg: "Something went wrong. Check your connection." };
  if (!r.ok) return { ok: false, msg: r.data?.message || "Registration failed. Try again." };

  setAccessToken(r.data.accessToken);
  setSession(r.data.data);

  return { ok: true, role: r.data.data.role };
}

async function logout() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch { }

  clearAccessToken();
  clearSession();
  location.href = rootPath() + "index.html";
}

async function sendForgotPasswordOTP(phone) {
  phone = (phone || "").trim();
  if (!phone) return { ok: false, msg: "Phone number is required." };

  const r = await apiFetch("/auth/otp/forgot-password", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });

  if (!r) return { ok: false, msg: "Something went wrong." };

  return r.ok
    ? { ok: true, msg: r.data?.message || "OTP sent to your phone!" }
    : { ok: false, msg: r.data?.message || "Failed to send OTP." };
}

async function resetPassword(phone, otp, newPassword) {
  phone = (phone || "").trim();
  otp = (otp || "").trim();
  newPassword = (newPassword || "").trim();

  if (!phone || !otp || !newPassword) {
    return { ok: false, msg: "All fields are required." };
  }

  const r = await apiFetch("/auth/otp/reset-password", {
    method: "POST",
    body: JSON.stringify({ phone, otp, new_password: newPassword }),
  });

  if (!r) return { ok: false, msg: "Something went wrong." };

  return r.ok
    ? { ok: true, msg: r.data?.message || "Password reset successfully." }
    : { ok: false, msg: r.data?.message || "Invalid OTP or request failed." };
}

async function sendRegisterOTP(phone, name, password) {
  phone = (phone || "").trim();
  name = (name || "").trim();
  password = (password || "").trim();

  if (!phone) return { ok: false, msg: "Phone number is required." };

  const r = await apiFetch("/auth/otp/send-register", {
    method: "POST",
    body: JSON.stringify({ phone, name, password }),
  });

  if (!r) return { ok: false, msg: "Something went wrong." };

  return r.ok
    ? { ok: true, msg: r.data?.message || "OTP sent!" }
    : { ok: false, msg: r.data?.message || "Failed to send OTP." };
}

// ══════════════════════════════════════════════════
//  SIGNUP MODAL UI HANDLERS
// ══════════════════════════════════════════════════

let otpVerified = false;
let otpResendTimer = null;

// Step 1 — User clicks "Send OTP"
async function sendOtpSignup() {
  showSignupErr("");

  const name = document.getElementById("signupName").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const pass = document.getElementById("signupPass").value.trim();
  const confirm = document.getElementById("signupConfirm").value.trim();

  if (!name) return showSignupErr("Please enter your full name.");
  if (!phone || phone.length < 10) return showSignupErr("Enter a valid 10-digit phone number.");
  if (pass.length < 6) return showSignupErr("Password must be at least 6 characters.");
  if (pass !== confirm) return showSignupErr("Passwords do not match.");

  const btn = document.getElementById("sendOtpBtn");
  btn.textContent = "Sending…";
  btn.disabled = true;

  // ✅ SHOW OTP BOX IMMEDIATELY — before API call, nuclear method
  forceShowOtpBox();

  const res = await sendRegisterOTP(phone, name, pass);

  if (!res.ok) {
    showSignupErr(res.msg);
    btn.textContent = "Retry";
    btn.disabled = false;
    return;
  }

  btn.textContent = "OTP Sent ✓";
  document.getElementById("signupOtp").value = "";
  document.getElementById("otpVerifiedBadge").style.display = "none";
  startOtpCountdown(30);
}

// Nuclear helper — removes ALL inline styles then force-shows the OTP box
function forceShowOtpBox() {
  const otpBox = document.getElementById("otpVerifyGroup");
  if (!otpBox) { console.error("otpVerifyGroup element NOT FOUND in DOM"); return; }

  // Nuke every possible inline style hiding it
  otpBox.removeAttribute("style");
  otpBox.style.setProperty("display", "block", "important");
  otpBox.style.setProperty("visibility", "visible", "important");
  otpBox.style.setProperty("opacity", "1", "important");
  otpBox.style.setProperty("height", "auto", "important");
  otpBox.style.setProperty("overflow", "visible", "important");

  // Focus the OTP input & scroll it into view
  setTimeout(() => {
    const inp = document.getElementById("signupOtp");
    if (inp) inp.focus();
    otpBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 80);
}

// Step 2 — User clicks "Verify OTP"
async function verifyOtpSignup() {
  const phone = document.getElementById("signupPhone")?.value.trim() || "";
  const otp = document.getElementById("signupOtp")?.value.trim() || "";
  const name = document.getElementById("signupName")?.value.trim() || "";
  const pass = document.getElementById("signupPass")?.value.trim() || "";

  if (!otp || otp.length < 4) {
    showSignupErr("Please enter the OTP sent to your phone.");
    return;
  }

  const verifyBtn = document.getElementById("verifyOtpBtn");
  const badge = document.getElementById("otpVerifiedBadge");
  const signupBtn = document.getElementById("signupBtn");

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Verifying…";

  const r = await apiFetch("/auth/otp/verify-register", {
    method: "POST",
    body: JSON.stringify({ phone, otp, name, password: pass }),
  });

  if (!r || !r.ok) {
    showSignupErr(r?.data?.message || "Invalid OTP. Please try again.");
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify OTP";
    return;
  }

  setAccessToken(r.data.accessToken);
  setSession(r.data.data);

  otpVerified = true;
  if (otpResendTimer) clearInterval(otpResendTimer);

  // Show verified badge
  badge.removeAttribute("style");
  badge.style.setProperty("display", "flex", "important");

  verifyBtn.textContent = "Verified ✓";
  verifyBtn.classList.add("verified");
  verifyBtn.disabled = true;

  document.getElementById("signupPhone").readOnly = true;
  document.getElementById("sendOtpBtn").disabled = true;

  if (signupBtn) {
    signupBtn.disabled = false;
    signupBtn.style.opacity = "1";
  }

  setTimeout(() => {
    window.location.href = "pages/payment.html";
  }, 900);
}

// Fallback — Sign Up button
async function handleSignup() {
  if (!otpVerified) {
    showSignupErr("Please verify your phone number with OTP first.");
    return;
  }
  window.location.href = "pages/payment.html";
}

// ══════════════════════════════════════════════════
//  LOGIN MODAL HANDLER
// ══════════════════════════════════════════════════
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

async function handleLogin() {
  const phone = document.getElementById("loginPhone").value.trim();
  const pass = document.getElementById("loginPass").value.trim();
  const errEl = document.getElementById("loginErr");

  errEl.style.display = "none";

  const result = await login(phone, pass);

  if (!result.ok) {
    errEl.textContent = result.msg;
    errEl.style.display = "block";
    return;
  }

  window.location.href = result.role === "admin"
    ? "pages/admin/dashboard.html"
    : "pages/user/dashboardd.html";
}

// ══════════════════════════════════════════════════
//  RESET PASSWORD MODAL HANDLERS
// ══════════════════════════════════════════════════

async function sendOtp() {
  const phone = document.getElementById("resetPhone").value.trim();
  const result = await sendForgotPasswordOTP(phone);
  alert(result.msg);
}

async function handleReset() {
  const phone = document.getElementById("resetPhone").value.trim();
  const otp = document.getElementById("resetOtp")?.value.trim() || "";
  const newPass = document.getElementById("newPass").value.trim();
  const confirm = document.getElementById("confirmPass").value.trim();

  if (newPass !== confirm) { alert("Passwords do not match."); return; }

  const result = await resetPassword(phone, otp, newPass);
  alert(result.msg);
  if (result.ok) { hideReset(); closeModal("loginModal"); }
}

// ══════════════════════════════════════════════════
//  MODAL OPEN / CLOSE HELPERS
// ══════════════════════════════════════════════════

function openModal(id) {
  document.getElementById(id).style.display = "flex";
  document.body.style.overflow = "hidden";
  if (id === "signupModal") resetSignupModal();
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
  document.body.style.overflow = "";
}

function switchToSignup() {
  closeModal("loginModal");
  openModal("signupModal");
}

function switchToLogin() {
  closeModal("signupModal");
  openModal("loginModal");
}

function showReset() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("resetForm").style.display = "block";
}

function hideReset() {
  document.getElementById("resetForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
}

// ══════════════════════════════════════════════════
//  RESET SIGNUP MODAL TO CLEAN STATE
// ══════════════════════════════════════════════════

function resetSignupModal() {
  otpVerified = false;
  if (otpResendTimer) { clearInterval(otpResendTimer); otpResendTimer = null; }

  // Clear all inputs
  ["signupName", "signupPhone", "signupPass", "signupConfirm", "signupOtp"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ""; el.readOnly = false; }
    });

  // Hide OTP box
  const otpBox = document.getElementById("otpVerifyGroup");
  if (otpBox) {
    otpBox.removeAttribute("style");
    otpBox.style.display = "none";
  }

  // Hide verified badge
  const badge = document.getElementById("otpVerifiedBadge");
  if (badge) {
    badge.removeAttribute("style");
    badge.style.display = "none";
  }

  // Reset Send OTP button
  const sendBtn = document.getElementById("sendOtpBtn");
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "Send OTP"; }

  // Reset Verify OTP button
  const verifyBtn = document.getElementById("verifyOtpBtn");
  if (verifyBtn) {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify OTP";
    verifyBtn.classList.remove("verified");
  }

  // Disable Sign Up button
  const signupBtn = document.getElementById("signupBtn");
  if (signupBtn) { signupBtn.disabled = true; signupBtn.style.opacity = "0.5"; }

  // Clear error & timer
  showSignupErr("");
  const timerEl = document.getElementById("otpTimer");
  if (timerEl) { timerEl.textContent = ""; timerEl.classList.remove("running"); }
}

// ══════════════════════════════════════════════════
//  SHARED UI UTILITIES
// ══════════════════════════════════════════════════

function startOtpCountdown(seconds) {
  const timerEl = document.getElementById("otpTimer");
  const sendBtn = document.getElementById("sendOtpBtn");
  if (!timerEl || !sendBtn) return;

  if (otpResendTimer) clearInterval(otpResendTimer);

  timerEl.classList.add("running");
  let remaining = seconds;
  timerEl.textContent = `Resend OTP in ${remaining}s`;

  otpResendTimer = setInterval(() => {
    remaining--;
    timerEl.textContent = `Resend OTP in ${remaining}s`;

    if (remaining <= 0) {
      clearInterval(otpResendTimer);
      otpResendTimer = null;
      timerEl.classList.remove("running");
      timerEl.textContent = "";
      sendBtn.disabled = false;
      sendBtn.textContent = "Resend OTP";
    }
  }, 1000);
}

function showSignupErr(msg) {
  const el = document.getElementById("signupErr");
  if (!el) { if (msg) alert(msg); return; }

  if (!msg) { el.style.display = "none"; el.textContent = ""; return; }

  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3500);
}

// Close modal on backdrop click
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.style.display = "none";
        document.body.style.overflow = "";
      }
    });
  });

  // Set initial disabled opacity on signup button
  const signupBtn = document.getElementById("signupBtn");
  if (signupBtn) signupBtn.style.opacity = "0.5";
});