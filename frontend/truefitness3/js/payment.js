/* ================================================
   TRUE FITNESS — PAYMENT GATEWAY JS
   ================================================ */
 
// ── State ──────────────────────────────────────
let currentStep = 1;
let selectedPlan = { name: 'Premium Plan', price: 2999, period: 'Quarterly' };
let appliedDiscount = 0;
const GST_RATE = 0.18;
const VALID_COUPONS = {
  'TFFIT10': 0.10,
  'WELCOME15': 0.15,
  'FIRST20': 0.20,
};
 
// ── Step Navigation ─────────────────────────────
function goToStep(step) {
  if (step > currentStep && !validateStep(currentStep)) return;
 
  // Update dots
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`step${i}Dot`);
    dot.classList.remove('active', 'done');
    if (i === step) dot.classList.add('active');
    else if (i < step) dot.classList.add('done');
  }
 
  // Update panels
  document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel${step}`).classList.add('active');
 
  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
 
function validateStep(step) {
  if (step === 2) {
    const name  = document.getElementById('payName').value.trim();
    const phone = document.getElementById('payPhone').value.trim();
    const email = document.getElementById('payEmail').value.trim();
    const errEl = document.getElementById('detailsErr');
 
    if (!name) { showErr(errEl, 'Please enter your full name.'); return false; }
    if (!phone || phone.length < 10) { showErr(errEl, 'Please enter a valid 10-digit phone number.'); return false; }
    if (!email || !email.includes('@')) { showErr(errEl, 'Please enter a valid email address.'); return false; }
    errEl.style.display = 'none';
  }
  return true;
}
 
function showErr(el, msg) {
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}
 
// ── Plan Selection ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Init plan selection from radio state
  document.querySelectorAll('.plan-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const card = radio.closest('.plan-option');
      selectedPlan = {
        name: card.dataset.plan.charAt(0).toUpperCase() + card.dataset.plan.slice(1) + ' Plan',
        price: parseInt(card.dataset.price),
        period: card.dataset.period,
      };
      updateSummary();
    });
  });
 
  // Default: premium is checked
  const defaultCard = document.querySelector('.plan-option input[value="premium"]');
  if (defaultCard) {
    defaultCard.checked = true;
    const card = defaultCard.closest('.plan-option');
    selectedPlan = { name: 'Premium Plan', price: parseInt(card.dataset.price), period: card.dataset.period };
  }
 
  updateSummary();
});
 
// ── Summary Update ──────────────────────────────
function updateSummary() {
  const base    = selectedPlan.price;
  const discount = Math.round(base * appliedDiscount);
  const taxable  = base - discount;
  const gst      = Math.round(taxable * GST_RATE);
  const total    = taxable + gst;
 
  document.getElementById('summaryPlanName').textContent   = selectedPlan.name;
  document.getElementById('summaryPlanPeriod').textContent = selectedPlan.period;
  document.getElementById('summaryBase').textContent       = `₹${base.toLocaleString('en-IN')}`;
  document.getElementById('summaryGst').textContent        = `₹${gst.toLocaleString('en-IN')}`;
  document.getElementById('summaryTotal').textContent      = `₹${total.toLocaleString('en-IN')}`;
  document.getElementById('payBtnAmount').textContent      = `₹${total.toLocaleString('en-IN')}`;
 
  const discLine = document.getElementById('summaryDiscountLine');
  if (discount > 0) {
    discLine.style.display = 'flex';
    document.getElementById('summaryDiscount').textContent = `-₹${discount.toLocaleString('en-IN')}`;
  } else {
    discLine.style.display = 'none';
  }
}
 
// ── Coupon ──────────────────────────────────────
function applyCoupon() {
  const code   = document.getElementById('couponInput').value.trim().toUpperCase();
  const msgEl  = document.getElementById('couponMsg');
 
  if (!code) {
    msgEl.textContent = 'Please enter a coupon code.';
    msgEl.style.color = '#f87171';
    msgEl.style.display = 'block';
    return;
  }
 
  if (VALID_COUPONS[code]) {
    appliedDiscount = VALID_COUPONS[code];
    const pct = Math.round(appliedDiscount * 100);
    msgEl.textContent = `✓ Coupon applied! ${pct}% discount`;
    msgEl.style.color = '#4ade80';
  } else {
    appliedDiscount = 0;
    msgEl.textContent = '✗ Invalid coupon code.';
    msgEl.style.color = '#f87171';
  }
  msgEl.style.display = 'block';
  updateSummary();
}
 
// ── Payment Tabs ────────────────────────────────
function switchPayTab(btn, tabId) {
  document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pay-tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');
}
 
// ── Card Preview ────────────────────────────────
function formatCard(input) {
  let val = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = val.replace(/(.{4})/g, '$1 ').trim();
}
 
function formatExpiry(input) {
  let val = input.value.replace(/\D/g, '').substring(0, 4);
  if (val.length >= 2) val = val.substring(0, 2) + '/' + val.substring(2);
  input.value = val;
}
 
function updateCardPreview() {
  const num  = (document.getElementById('cardNum')?.value || '').replace(/\s/g, '');
  const name = document.getElementById('cardName')?.value || '';
  const exp  = document.getElementById('cardExp')?.value  || '';
 
  // Format number display
  const padded = num.padEnd(16, '•');
  const formatted = padded.match(/.{1,4}/g).join(' ');
  document.getElementById('cardNumDisplay').textContent = formatted;
 
  // Name
  document.getElementById('cardNameDisplay').textContent = name.toUpperCase() || 'YOUR NAME';
 
  // Expiry
  document.getElementById('cardExpDisplay').textContent = exp || 'MM/YY';
 
  // Network detection
  const netEl = document.getElementById('cardNetwork');
  if (/^4/.test(num))      netEl.textContent = 'VISA';
  else if (/^5[1-5]/.test(num)) netEl.textContent = 'MC';
  else if (/^3[47]/.test(num))  netEl.textContent = 'AMEX';
  else if (/^6/.test(num))      netEl.textContent = 'RUPAY';
  else                           netEl.textContent = 'CARD';
}
 
// ── Process Payment ─────────────────────────────
function processPayment() {
  const errEl = document.getElementById('paymentErr');
  const activeTab = document.querySelector('.pay-tab.active')?.textContent?.trim();
 
  // Basic validation per tab
  if (activeTab === 'UPI') {
    const upiId = document.getElementById('upiId').value.trim();
    if (!upiId || !upiId.includes('@')) {
      showErr(errEl, 'Please enter a valid UPI ID (e.g. name@upi).'); return;
    }
  }
  if (activeTab === 'Card') {
    const num = document.getElementById('cardNum').value.replace(/\s/g, '');
    const exp = document.getElementById('cardExp').value;
    const cvv = document.getElementById('cardCvv').value;
    if (num.length < 16)  { showErr(errEl, 'Please enter a valid 16-digit card number.'); return; }
    if (exp.length < 5)   { showErr(errEl, 'Please enter a valid expiry date.'); return; }
    if (cvv.length < 3)   { showErr(errEl, 'Please enter a valid CVV.'); return; }
  }
  if (activeTab === 'Net Banking') {
    const bank = document.querySelector('input[name="bank"]:checked');
    if (!bank) { showErr(errEl, 'Please select your bank.'); return; }
  }
 
  // Show loading state
  const btn = document.getElementById('payNowBtn');
  const btnText = document.getElementById('payBtnText');
  btn.disabled = true;
  btnText.textContent = 'Processing…';
 
  // TODO: POST to backend /api/payment/initiate
  // For now simulate 2s processing
  setTimeout(showSuccess, 2000);
}
 
// ── Success ─────────────────────────────────────
function showSuccess() {
  const ref = 'TF-' + Date.now().toString().slice(-6);
  const name  = document.getElementById('payName').value;
  const phone = document.getElementById('payPhone').value;
 
  const base    = selectedPlan.price;
  const discount = Math.round(base * appliedDiscount);
  const gst      = Math.round((base - discount) * GST_RATE);
  const total    = (base - discount) + gst;
 
  document.getElementById('successRef').textContent = `REF: ${ref}`;
  document.getElementById('successDetails').innerHTML =
    `${name} &nbsp;|&nbsp; ${phone}<br>
     <strong>${selectedPlan.name}</strong> — ${selectedPlan.period}<br>
     Total Paid: <strong>₹${total.toLocaleString('en-IN')}</strong>`;
 
  document.getElementById('successOverlay').classList.add('show');
}