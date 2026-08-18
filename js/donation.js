/* ============================================================
   PAD UP FOUNDATION - Currency Selector & Flutterwave Live Checkout
   - Multi-currency support (NGN, USD, GBP, EUR, CAD)
   - Dynamic amount display per currency
   - Flutterwave Live checkout with server-side verification
   - Donations saved only after server verifies the transaction
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initCurrencyDonation() {
  const currencySelector = document.getElementById('currency-selector');
  const donateBtn = document.getElementById('donate-btn');
  if (!donateBtn) return;

  const FLW_PUBLIC_KEY = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || '';

  // Currency presets (suggested donation amounts per currency)
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

  // Custom amount input
  if (customInput) {
    customInput.addEventListener('input', function () {
      amountGrid.querySelectorAll('.amount-btn').forEach(function (b) { b.classList.remove('selected'); });
      selectedAmount = parseFloat(this.value) || 0;
    });
  }

  updateAmountButtons();

  // Show inline feedback message (success or error)
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

  // Verify the transaction server-side and record the donation
  async function verifyAndRecord(payment, amount, currency, name, email, phone) {
    try {
      var apiUrl = (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/flutterwave-verify/verify';
      var res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '')
        },
        body: JSON.stringify({
          transaction_id: payment.transaction_id,
          tx_ref: payment.tx_ref,
          amount: amount,
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
    } catch (err) {
      console.error('[Donation] Verification error:', err.message);
      throw err;
    }
  }

  // Override the donate button click with enhanced version
  // Remove old listener by cloning the button
  const newDonateBtn = donateBtn.cloneNode(true);
  donateBtn.parentNode.replaceChild(newDonateBtn, donateBtn);

  newDonateBtn.addEventListener('click', function () {
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

    if (typeof FlutterwaveCheckout === 'undefined') {
      alert('Payment gateway is loading. Please try again in a moment.');
      return;
    }

    if (!FLW_PUBLIC_KEY) {
      alert('Payment is not configured. Please contact support.');
      return;
    }

    var originalText = newDonateBtn.innerHTML;
    newDonateBtn.innerHTML = '<span class="spinner"></span> Redirecting to payment...';
    newDonateBtn.disabled = true;

    var txRef = 'padup-' + Date.now();

    FlutterwaveCheckout({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: txRef,
      amount: selectedAmount,
      currency: selectedCurrency,
      payment_options: 'card, banktransfer, ussd, mobilemoney',
      customer: {
        email: email,
        phone_number: phone,
        name: name
      },
      customizations: {
        title: 'Pad Up Foundation',
        description: 'Donation \u2014 Ending Period Poverty',
        logo: window.location.origin + '/images/Padupfoundation-LOGO.jpg'
      },
      callback: async function (payment) {
        newDonateBtn.innerHTML = '<span class="spinner"></span> Verifying payment...';

        if (payment.status === 'successful' || payment.status === 'completed') {
          try {
            var result = await verifyAndRecord(payment, selectedAmount, selectedCurrency, name, email, phone);

            if (result.verified && result.success) {
              var successMsg = document.getElementById('donation-success');
              if (successMsg) {
                successMsg.style.display = 'flex';
                successMsg.querySelector('.donation-amount').textContent =
                  formatAmount(result.amount || selectedAmount, result.currency || selectedCurrency);
              }
              showFeedback('success', '<strong>Payment verified!</strong> Your donation has been confirmed and recorded. Thank you for your generosity.');
            } else if (result.verified && !result.success) {
              showFeedback('error', '<strong>Payment not completed.</strong> ' + (result.message || 'The transaction was not successful. Please try again.'));
            } else {
              showFeedback('error', '<strong>Verification failed.</strong> ' + (result.message || 'We could not verify your payment. If you were charged, please contact us.'));
            }
          } catch (err) {
            console.error('[Donation] Verification failed:', err.message);
            showFeedback('error', '<strong>Verification error.</strong> Your payment is being processed. If you were charged, your donation will appear shortly. Please contact us if you have concerns.');
          }
        } else {
          showFeedback('error', '<strong>Payment ' + (payment.status || 'cancelled') + '.</strong> The transaction was not completed. Please try again.');
        }

        newDonateBtn.innerHTML = originalText;
        newDonateBtn.disabled = false;
      },
      onclose: function () {
        newDonateBtn.innerHTML = originalText;
        newDonateBtn.disabled = false;
      }
    });
  });
})();
