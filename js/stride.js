/* ============================================================
   PAD UP FOUNDATION — STRIDE 2026 Page
   - Same currency selector + dynamic presets as donate page
   - Flutterwave hosted checkout (campaign: STRIDE 2026)
   - Server-side verification and recording
   - Lightbox for gallery images (uses .open class, not display)
   ============================================================ */

(function initStride() {
  var CAMPAIGN = 'STRIDE 2026';

  // ============================================================
  // CURRENCY PRESETS (same as donate page)
  // ============================================================
  var CURRENCY_PRESETS = {
    NGN: { symbol: '\u20A6', amounts: [10000, 25000, 50000, 100000, 250000, 500000], min: 1000 },
    USD: { symbol: '$', amounts: [10, 25, 50, 100, 250, 500], min: 1 },
    GBP: { symbol: '\u00A3', amounts: [10, 25, 50, 100, 200, 400], min: 1 },
    EUR: { symbol: '\u20AC', amounts: [10, 25, 50, 100, 250, 500], min: 1 },
    CAD: { symbol: 'C$', amounts: [15, 30, 60, 120, 300, 600], min: 1 }
  };

  var currencySelector = document.getElementById('stride-currency-selector');
  var amountGrid = document.getElementById('stride-amount-grid');
  var amountLabel = document.getElementById('stride-amount-label');
  var customInput = document.getElementById('stride-custom-amount');
  var donateBtn = document.getElementById('stride-donate-btn');
  var selectedCurrency = 'NGN';
  var selectedAmount = 25000;

  function formatAmount(amount, currency) {
    var preset = CURRENCY_PRESETS[currency] || CURRENCY_PRESETS.NGN;
    return preset.symbol + Number(amount).toLocaleString();
  }

  function updateAmountButtons() {
    if (!amountGrid) return;
    var preset = CURRENCY_PRESETS[selectedCurrency];
    amountGrid.innerHTML = '';
    preset.amounts.forEach(function (amt, i) {
      var btn = document.createElement('button');
      btn.className = 'stride-amount-btn' + (i === 1 ? ' selected' : '');
      btn.dataset.amount = amt;
      btn.textContent = formatAmount(amt, selectedCurrency);
      btn.addEventListener('click', function () {
        amountGrid.querySelectorAll('.stride-amount-btn').forEach(function (b) { b.classList.remove('selected'); });
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
      if (amountGrid) {
        amountGrid.querySelectorAll('.stride-amount-btn').forEach(function (b) { b.classList.remove('selected'); });
      }
      selectedAmount = parseFloat(this.value) || 0;
    });
  }

  updateAmountButtons();

  // ============================================================
  // FEEDBACK
  // ============================================================
  function showFeedback(type, message) {
    var successEl = document.getElementById('stride-success-msg');
    var errorEl = document.getElementById('stride-error-msg');
    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';

    if (type === 'success') {
      if (successEl) {
        var amountSpan = successEl.querySelector('.stride-amount');
        if (amountSpan) amountSpan.textContent = formatAmount(message.amount, message.currency || selectedCurrency);
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

  // ============================================================
  // FLUTTERWAVE PAYMENT
  // ============================================================
  function getApiUrl(action) {
    return (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/flutterwave-verify/' + action;
  }

  function getAuthHeader() {
    return 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  }

  async function initializePayment(amount, currency, name, email, phone, message) {
    var txRef = 'stride-' + Date.now();

    sessionStorage.setItem('stride_pending_tx_ref', txRef);
    sessionStorage.setItem('stride_pending_amount', String(amount));
    sessionStorage.setItem('stride_pending_currency', currency);
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
        currency: currency,
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

  // ============================================================
  // DONATE BUTTON
  // ============================================================
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

      var preset = CURRENCY_PRESETS[selectedCurrency];
      if (!selectedAmount || selectedAmount < preset.min) {
        showFeedback('error', 'Please select or enter a donation amount of at least ' + formatAmount(preset.min, selectedCurrency) + '.');
        return;
      }

      var originalText = donateBtn.innerHTML;
      donateBtn.innerHTML = '<span class="spinner"></span> Redirecting to payment...';
      donateBtn.disabled = true;

      try {
        var link = await initializePayment(selectedAmount, selectedCurrency, name, email, phone, message);
        window.location.href = link;
      } catch (err) {
        console.error('[STRIDE] Payment init error:', err.message);
        showFeedback('error', err.message || 'Could not start payment. Please try again.');
        donateBtn.innerHTML = originalText;
        donateBtn.disabled = false;
      }
    });
  }

  // ============================================================
  // HANDLE REDIRECT-BACK VERIFICATION
  // ============================================================
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
          showFeedback('success', { amount: result.amount || pendingAmount, currency: result.currency || pendingCurrency });
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

  // ============================================================
  // LIGHTBOX (uses .open class — same as gallery page)
  // ============================================================
  var galleryItems = document.querySelectorAll('.stride-gallery-item[data-lightbox]');
  var lightbox = document.getElementById('stride-lightbox');
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
    if (!lightbox || !lightboxImg) return;
    currentLightboxIndex = index;
    lightboxImg.src = lightboxImages[index];
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { if (lightboxImg) lightboxImg.src = ''; }, 300);
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
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
  });
})();
