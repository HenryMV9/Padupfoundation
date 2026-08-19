/* ============================================================
   PAD UP FOUNDATION - Currency Selector & Flutterwave Hosted Checkout
   - Multi-currency support (NGN, USD, GBP, EUR, CAD)
   - Dynamic amount display per currency
   - Flutterwave hosted payment page (no inline SDK dependency)
   - Server-side verification and recording
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initCurrencyDonation() {
  const currencySelector = document.getElementById('currency-selector');
  const donateBtn = document.getElementById('donate-btn');
  if (!donateBtn) return;

  const CURRENCY_PRESETS = {
    NGN: { symbol: '\u20A6', amounts: [2500, 5000, 10000, 20000, 50000, 100000], min: 100 },
    USD: { symbol: '$', amounts: [10, 25, 50, 100, 250, 500], min: 1 },
    GBP: { symbol: '\u00A3', amounts: [10, 25, 50, 100, 200, 400], min: 1 },
    EUR: { symbol: '\u20AC', amounts: [10, 25, 50, 100, 250, 500], min: 1 },
    CAD: { symbol: 'C$', amounts: [15, 30, 60, 120, 300, 600], min: 1 }
  };

  const amountGrid = document.getElementById('amount-grid');
  const amountLabel = document.getElementById('amount-label');
  const customInput = document.getElementById('custom-amount');
  let selectedCurrency = 'NGN';
  let selectedAmount = 5000;

  const pendingTxRef = sessionStorage.getItem('pending_tx_ref');
  const pendingAmount = sessionStorage.getItem('pending_amount');
  const pendingCurrency = sessionStorage.getItem('pending_currency');
  const pendingName = sessionStorage.getItem('pending_name');
  const pendingEmail = sessionStorage.getItem('pending_email');
  const pendingPhone = sessionStorage.getItem('pending_phone');

  function formatAmount(amount, currency) {
    const preset = CURRENCY_PRESETS[currency] || CURRENCY_PRESETS.NGN;
    return preset.symbol + Number(amount).toLocaleString();
  }

  function updateAmountButtons() {
    if (!amountGrid) return;
    const preset = CURRENCY_PRESETS[selectedCurrency];
    amountGrid.innerHTML = '';
    preset.amounts.forEach(function (amt, i) {
      const btn = document.createElement('button');
      btn.className = 'amount-btn' + (i === 1 ? ' selected' : '');
      btn.dataset.amount = amt;
      btn.textContent = formatAmount(amt, selectedCurrency);
      btn.addEventListener('click', function () {
        amountGrid.querySelectorAll('.amount-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedAmount = amt;
        if (customInput) customInput.value = '';
      });
      amountGrid.appendChild(btn);
    });
    selectedAmount = preset.amounts[1];
    if (amountLabel) amountLabel.textContent = 'Select Amount (' + preset.symbol + ')';
    if (customInput) customInput.placeholder = 'Or enter custom amount (' + preset.symbol + ')';
  }

  if (currencySelector) {
    currencySelector.addEventListener('change', function () {
      selectedCurrency = this.value;
      updateAmountButtons();
    });
  }

  if (customInput) {
    customInput.addEventListener('input', function () {
      amountGrid.querySelectorAll('.amount-btn').forEach(function (b) { b.classList.remove('selected'); });
      selectedAmount = parseFloat(this.value) || 0;
    });
  }

  updateAmountButtons();

  function showFeedback(type, message) {
    var existing = document.getElementById('donation-feedback');
    if (existing) existing.remove();

    var div = document.createElement('div');
    div.id = 'donation-feedback';
    div.style.cssText = 'display:flex;align-items:flex-start;gap:var(--space-4);margin-top:var(--space-5);padding:var(--space-5);border-radius:var(--radius-md);' +
      (type === 'success'
        ? 'background:var(--success-light);color:#166534;'
        : 'background:rgba(220,38,38,0.1);color:#991B1B;');
    div.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle') + '" style="font-size:1.5rem;margin-top:2px;"></i><div>' + message + '</div>';
    donateBtn.insertAdjacentElement('afterend', div);
    if (type === 'error') {
      setTimeout(function () { if (div.parentNode) div.remove(); }, 8000);
    }
  }

  async function verifyAndRecord(transactionId, txRef, amount, currency, name, email, phone) {
    var apiUrl = (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/flutterwave-verify/verify';
    var res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '')
      },
      body: JSON.stringify({
        transaction_id: Number(transactionId),
        tx_ref: txRef,
        amount: Number(amount),
        currency: currency,
        donor_name: name,
        donor_email: email,
        donor_phone: phone
      })
    });

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Verification failed (' + res.status + ')');
    }
    return data;
  }

  async function initializePayment(amount, currency, name, email, phone) {
    var apiUrl = (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/flutterwave-verify/initialize';
    var txRef = 'padup-' + Date.now();

    sessionStorage.setItem('pending_tx_ref', txRef);
    sessionStorage.setItem('pending_amount', String(amount));
    sessionStorage.setItem('pending_currency', currency);
    sessionStorage.setItem('pending_name', name);
    sessionStorage.setItem('pending_email', email);
    sessionStorage.setItem('pending_phone', phone);

    var res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '')
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amount,
        currency: currency,
        donor_name: name,
        donor_email: email,
        donor_phone: phone,
        redirect_url: window.location.origin + '/donate.html'
      })
    });

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.link) {
      throw new Error(data.error || data.message || 'Could not start payment (' + res.status + ')');
    }
    return data.link;
  }

  // Handle redirect-back verification
  async function handleRedirectReturn() {
    if (!pendingTxRef) return;

    var urlParams = new URLSearchParams(window.location.search);
    var status = urlParams.get('status') || '';
    var txId = urlParams.get('transaction_id') || '';
    var txRef = urlParams.get('tx_ref') || pendingTxRef;

    // Clear pending data
    sessionStorage.removeItem('pending_tx_ref');
    sessionStorage.removeItem('pending_amount');
    sessionStorage.removeItem('pending_currency');
    sessionStorage.removeItem('pending_name');
    sessionStorage.removeItem('pending_email');
    sessionStorage.removeItem('pending_phone');

    // Clean URL
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (status === 'successful' || status === 'completed') {
      donateBtn.innerHTML = '<span class="spinner"></span> Verifying payment...';
      donateBtn.disabled = true;

      try {
        var result = await verifyAndRecord(
          txId, txRef,
          pendingAmount, pendingCurrency,
          pendingName, pendingEmail, pendingPhone
        );

        if (result.verified && result.success) {
          var successMsg = document.getElementById('donation-success');
          if (successMsg) {
            successMsg.style.display = 'flex';
            successMsg.querySelector('.donation-amount').textContent =
              formatAmount(result.amount || pendingAmount, result.currency || pendingCurrency);
          }
          showFeedback('success', '<strong>Payment verified!</strong> Your donation has been confirmed and recorded. Thank you for your generosity.');
        } else if (result.verified && !result.success) {
          showFeedback('error', '<strong>Payment not completed.</strong> ' + (result.message || 'The transaction was not successful. Please try again.'));
        } else {
          showFeedback('error', '<strong>Verification failed.</strong> ' + (result.message || 'We could not verify your payment. If you were charged, please contact us.'));
        }
      } catch (err) {
        console.error('[Donation] Verification error:', err.message);
        showFeedback('error', '<strong>Verification error.</strong> Your payment is being processed. If you were charged, your donation will appear shortly. Please contact us if you have concerns.');
      }

      donateBtn.innerHTML = '<i class="fas fa-lock"></i> Donate Securely via Flutterwave';
      donateBtn.disabled = false;
    } else if (status === 'cancelled') {
      showFeedback('error', '<strong>Payment cancelled.</strong> The transaction was not completed. Please try again.');
    }
  }

  const newDonateBtn = donateBtn.cloneNode(true);
  donateBtn.parentNode.replaceChild(newDonateBtn, donateBtn);

  newDonateBtn.addEventListener('click', async function () {
    const nameEl = document.getElementById('donor-name');
    const emailEl = document.getElementById('donor-email');
    const phoneEl = document.getElementById('donor-phone');

    const name = nameEl ? nameEl.value.trim() : 'Anonymous';
    const email = emailEl ? emailEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '08000000000';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailEl) {
        emailEl.focus();
        emailEl.classList.add('error');
        const group = emailEl.closest('.form-group');
        if (group) {
          group.classList.add('has-error');
          const msg = group.querySelector('.error-msg');
          if (msg) msg.textContent = 'Please enter a valid email address.';
        }
      }
      return;
    }

    const preset = CURRENCY_PRESETS[selectedCurrency];
    if (!selectedAmount || selectedAmount < preset.min) {
      alert('Please select or enter a donation amount of at least ' + formatAmount(preset.min, selectedCurrency) + '.');
      return;
    }

    var originalText = newDonateBtn.innerHTML;
    newDonateBtn.innerHTML = '<span class="spinner"></span> Redirecting to payment...';
    newDonateBtn.disabled = true;

    try {
      var link = await initializePayment(selectedAmount, selectedCurrency, name, email, phone);
      window.location.href = link;
    } catch (err) {
      console.error('[Donation] Payment init error:', err.message);
      showFeedback('error', '<strong>Could not start payment.</strong> ' + err.message);
      newDonateBtn.innerHTML = originalText;
      newDonateBtn.disabled = false;
    }
  });

  // Check if returning from Flutterwave redirect
  handleRedirectReturn();
})();
