/* ============================================================
   PAD UP FOUNDATION - Currency Selector & Donation Storage
   Enhances the existing Flutterwave donation with:
   - Multi-currency support (NGN, USD, GBP, EUR, CAD)
   - Dynamic amount display per currency
   - Saving successful donations to Supabase
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initCurrencyDonation() {
  const currencySelector = document.getElementById('currency-selector');
  const donateBtn = document.getElementById('donate-btn');
  if (!donateBtn) return;

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

  // Save donation to Supabase
  async function saveDonation(payment, amount, currency, name, email) {
    try {
      const { error } = await supabase
        .from('donations')
        .insert([{
          donor_name: name && name !== 'Anonymous' ? name : null,
          email: email && email !== 'donor@padupfoundation.org' ? email : null,
          amount: amount,
          currency: currency,
          flutterwave_tx_id: payment.tx_ref || payment.transaction_id || ('padup-' + Date.now()),
          payment_status: 'successful'
        }]);

      if (error) {
        // If duplicate tx_id, ignore — payment already recorded
        if (error.code !== '23505') {
          console.error('[Donation] Failed to save:', error.message);
        }
      }
    } catch (err) {
      console.error('[Donation] Save error:', err.message);
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

    FlutterwaveCheckout({
      public_key: 'FLWPUBK_TEST-XXXXXXXXXXXXXXXXXXXXXXXXXXXX-X',
      tx_ref: 'padup-' + Date.now(),
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
        if (payment.status === 'successful' || payment.status === 'completed') {
          // Save to Supabase
          await saveDonation(payment, selectedAmount, selectedCurrency, name, email);

          const successMsg = document.getElementById('donation-success');
          if (successMsg) {
            successMsg.style.display = 'flex';
            successMsg.querySelector('.donation-amount').textContent =
              formatAmount(selectedAmount, selectedCurrency);
          }
        }
      },
      onclose: function () {}
    });
  });
})();
