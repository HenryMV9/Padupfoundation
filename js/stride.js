/* ============================================================
   PAD UP FOUNDATION — STRIDE 2026 Page
   - Flutterwave hosted checkout (campaign: STRIDE 2026)
   - Server-side verification and recording
   - Currency converter with live-ish static rates
   - Lightbox for gallery images
   ============================================================ */

(function initStride() {
  /* ---- Campaign constant ---- */
  var CAMPAIGN = 'STRIDE 2026';
  var CURRENCY = 'NGN';

  /* ---- Amount selection ---- */
  var selectedAmount = 25000;
  var amountGrid = document.getElementById('stride-amount-grid');
  var customInput = document.getElementById('stride-custom-amount');

  if (amountGrid) {
    amountGrid.querySelectorAll('.stride-amount-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        amountGrid.querySelectorAll('.stride-amount-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedAmount = parseFloat(btn.dataset.amount);
        if (customInput) customInput.value = '';
      });
    });
  }

  if (customInput) {
    customInput.addEventListener('input', function () {
      if (amountGrid) {
        amountGrid.querySelectorAll('.stride-amount-btn').forEach(function (b) { b.classList.remove('selected'); });
      }
      selectedAmount = parseFloat(customInput.value) || 0;
    });
  }

  /* ---- Feedback helpers ---- */
  function showFeedback(type, message) {
    var successEl = document.getElementById('stride-success-msg');
    var errorEl = document.getElementById('stride-error-msg');
    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';

    if (type === 'success') {
      if (successEl) {
        var amountSpan = successEl.querySelector('.stride-amount');
        if (amountSpan) amountSpan.textContent = '\u20A6' + Number(message.amount).toLocaleString();
        successEl.style.display = 'flex';
      }
    } else {
      if (errorEl) {
        var textSpan = errorEl.querySelector('.stride-error-text');
        if (textSpan) textSpan.textContent = message;
        errorEl.style.display = 'flex';
        setTimeout(function () { if (errorEl) errorEl.style.display = 'none'; }, 8000);
      }
    }
  }

  /* ---- Flutterwave payment flow ---- */
  function getApiUrl(action) {
    return (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/flutterwave-verify/' + action;
  }

  function getAuthHeader() {
    return 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  }

  async function initializePayment(amount, name, email, phone, message) {
    var txRef = 'stride-' + Date.now();

    sessionStorage.setItem('stride_pending_tx_ref', txRef);
    sessionStorage.setItem('stride_pending_amount', String(amount));
    sessionStorage.setItem('stride_pending_currency', CURRENCY);
    sessionStorage.setItem('stride_pending_name', name);
    sessionStorage.setItem('stride_pending_email', email);
    sessionStorage.setItem('stride_pending_phone', phone);
    sessionStorage.setItem('stride_pending_message', message);

    var res = await fetch(getApiUrl('initialize'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amount,
        currency: CURRENCY,
        donor_name: name,
        donor_email: email,
        donor_phone: phone,
        donor_message: message,
        campaign: CAMPAIGN,
        redirect_url: window.location.origin + '/stride.html'
      })
    });

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.link) {
      throw new Error(data.error || data.message || 'Could not start payment (' + res.status + ')');
    }
    return data.link;
  }

  async function verifyAndRecord(transactionId, txRef, amount, currency, name, email, phone, message) {
    var res = await fetch(getApiUrl('verify'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        transaction_id: Number(transactionId),
        tx_ref: txRef,
        amount: Number(amount),
        currency: currency,
        donor_name: name,
        donor_email: email,
        donor_phone: phone,
        donor_message: message,
        campaign: CAMPAIGN
      })
    });

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Verification failed (' + res.status + ')');
    }
    return data;
  }

  /* ---- Donate button ---- */
  var donateBtn = document.getElementById('stride-donate-btn');
  if (donateBtn) {
    donateBtn.addEventListener('click', async function () {
      var nameEl = document.getElementById('stride-donor-name');
      var emailEl = document.getElementById('stride-donor-email');
      var phoneEl = document.getElementById('stride-donor-phone');
      var messageEl = document.getElementById('stride-donor-message');

      var name = nameEl ? nameEl.value.trim() : 'Anonymous';
      var email = emailEl ? emailEl.value.trim() : '';
      var phone = phoneEl ? phoneEl.value.trim() : '';
      var message = messageEl ? messageEl.value.trim() : '';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailEl) emailEl.focus();
        showFeedback('error', 'Please enter a valid email address.');
        return;
      }

      if (!selectedAmount || selectedAmount < 1000) {
        showFeedback('error', 'Please select or enter a donation amount of at least \u20A61,000.');
        return;
      }

      var originalText = donateBtn.innerHTML;
      donateBtn.innerHTML = '<span class="spinner"></span> Redirecting to payment...';
      donateBtn.disabled = true;

      try {
        var link = await initializePayment(selectedAmount, name, email, phone, message);
        window.location.href = link;
      } catch (err) {
        console.error('[STRIDE] Payment init error:', err.message);
        showFeedback('error', err.message || 'Could not start payment. Please try again.');
        donateBtn.innerHTML = originalText;
        donateBtn.disabled = false;
      }
    });
  }

  /* ---- Handle redirect-back verification ---- */
  async function handleRedirectReturn() {
    var pendingTxRef = sessionStorage.getItem('stride_pending_tx_ref');
    if (!pendingTxRef) return;

    var pendingAmount = sessionStorage.getItem('stride_pending_amount');
    var pendingCurrency = sessionStorage.getItem('stride_pending_currency');
    var pendingName = sessionStorage.getItem('stride_pending_name');
    var pendingEmail = sessionStorage.getItem('stride_pending_email');
    var pendingPhone = sessionStorage.getItem('stride_pending_phone');
    var pendingMessage = sessionStorage.getItem('stride_pending_message');

    var urlParams = new URLSearchParams(window.location.search);
    var status = urlParams.get('status') || '';
    var txId = urlParams.get('transaction_id') || '';
    var txRef = urlParams.get('tx_ref') || pendingTxRef;

    sessionStorage.removeItem('stride_pending_tx_ref');
    sessionStorage.removeItem('stride_pending_amount');
    sessionStorage.removeItem('stride_pending_currency');
    sessionStorage.removeItem('stride_pending_name');
    sessionStorage.removeItem('stride_pending_email');
    sessionStorage.removeItem('stride_pending_phone');
    sessionStorage.removeItem('stride_pending_message');

    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (status === 'successful' || status === 'completed') {
      if (donateBtn) {
        donateBtn.innerHTML = '<span class="spinner"></span> Verifying payment...';
        donateBtn.disabled = true;
      }

      try {
        var result = await verifyAndRecord(
          txId, txRef, pendingAmount, pendingCurrency,
          pendingName, pendingEmail, pendingPhone, pendingMessage
        );

        if (result.verified && result.success) {
          showFeedback('success', { amount: result.amount || pendingAmount });
        } else if (result.verified && !result.success) {
          showFeedback('error', result.message || 'The transaction was not successful.');
        } else {
          showFeedback('error', result.message || 'We could not verify your payment. If you were charged, please contact us.');
        }
      } catch (err) {
        console.error('[STRIDE] Verification error:', err.message);
        showFeedback('error', 'Your payment is being processed. If you were charged, your donation will appear shortly.');
      }

      if (donateBtn) {
        donateBtn.innerHTML = '<i class="fas fa-heart"></i> Support STRIDE 2026';
        donateBtn.disabled = false;
      }
    } else if (status === 'cancelled') {
      showFeedback('error', 'Payment cancelled. Please try again.');
    }
  }

  handleRedirectReturn();

  /* ============================================================
     CURRENCY CONVERTER
     Uses approximate static rates (NGN as base).
     Rates are indicative — not for financial transactions.
     ============================================================ */
  var RATES_TO_NGN = {
    NGN: 1,
    USD: 1500,
    GBP: 1900,
    EUR: 1620,
    CAD: 1100
  };

  var SYMBOLS = {
    NGN: '\u20A6',
    USD: '$',
    GBP: '\u00A3',
    EUR: '\u20AC',
    CAD: 'C$'
  };

  var fromAmountEl = document.getElementById('converter-from-amount');
  var fromCurrencyEl = document.getElementById('converter-from-currency');
  var resultValueEl = document.getElementById('converter-result-value');
  var resultRateEl = document.getElementById('converter-rate');
  var swapBtn = document.getElementById('converter-swap-btn');

  function formatCurrency(amount, currency) {
    var sym = SYMBOLS[currency] || '';
    return sym + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function convert() {
    if (!fromAmountEl || !fromCurrencyEl || !resultValueEl) return;
    var amount = parseFloat(fromAmountEl.value) || 0;
    var fromCurrency = fromCurrencyEl.value;
    var rate = RATES_TO_NGN[fromCurrency] || 1;
    var ngnAmount = amount * rate;

    resultValueEl.textContent = formatCurrency(ngnAmount, 'NGN');

    if (resultRateEl) {
      if (fromCurrency === 'NGN') {
        resultRateEl.textContent = '1 NGN = 1.00 NGN';
      } else {
        resultRateEl.textContent = '1 ' + fromCurrency + ' = \u20A6' + rate.toLocaleString() + ' (approximate)';
      }
    }
  }

  if (fromAmountEl) fromAmountEl.addEventListener('input', convert);
  if (fromCurrencyEl) fromCurrencyEl.addEventListener('change', convert);
  if (swapBtn) {
    swapBtn.addEventListener('click', function () {
      if (!fromCurrencyEl || !resultValueEl) return;
      var currentCurrency = fromCurrencyEl.value;
      if (currentCurrency === 'NGN') {
        fromCurrencyEl.value = 'USD';
      } else {
        fromCurrencyEl.value = 'NGN';
      }
      convert();
    });
  }

  convert();

  /* ============================================================
     LIGHTBOX (minimal — reuses existing CSS classes)
     ============================================================ */
  var galleryItems = document.querySelectorAll('.stride-gallery-item[data-lightbox]');
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = lightbox ? lightbox.querySelector('.lightbox-img') : null;
  var lightboxClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;
  var currentLightboxIndex = 0;
  var lightboxImages = [];

  galleryItems.forEach(function (item, i) {
    lightboxImages.push(item.dataset.lightbox);
    item.addEventListener('click', function () { openLightbox(i); });
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i); }
    });
  });

  function openLightbox(index) {
    currentLightboxIndex = index;
    if (lightbox && lightboxImg) {
      lightboxImg.src = lightboxImages[index];
      lightbox.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeLightbox() {
    if (lightbox) {
      lightbox.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function navLightbox(dir) {
    currentLightboxIndex = (currentLightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    if (lightboxImg) lightboxImg.src = lightboxImages[currentLightboxIndex];
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    var prevBtn = lightbox.querySelector('.lightbox-nav.prev');
    var nextBtn = lightbox.querySelector('.lightbox-nav.next');
    if (prevBtn) prevBtn.addEventListener('click', function () { navLightbox(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { navLightbox(1); });
  }

  document.addEventListener('keydown', function (e) {
    if (!lightbox || lightbox.style.display === 'none') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
  });
})();
