/* ============================================================
   PAD UP FOUNDATION - Forms & Validation
   ============================================================ */

(function initForms() {
  /* --- Generic validator --- */
  function validate(field) {
    const group = field.closest('.form-group');
    if (!group) return true;

    const errorMsg = group.querySelector('.error-msg');
    const value = field.value.trim();
    let valid = true;
    let message = '';

    if (field.hasAttribute('required') && !value) {
      valid = false;
      message = 'This field is required.';
    } else if (field.type === 'email' && value) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(value)) {
        valid = false;
        message = 'Please enter a valid email address.';
      }
    } else if (field.type === 'tel' && value) {
      const telRe = /^[+\d\s\-()]{7,20}$/;
      if (!telRe.test(value)) {
        valid = false;
        message = 'Please enter a valid phone number.';
      }
    } else if (field.dataset.minlength && value.length < parseInt(field.dataset.minlength)) {
      valid = false;
      message = 'Minimum ' + field.dataset.minlength + ' characters required.';
    }

    if (errorMsg) errorMsg.textContent = message;
    group.classList.toggle('has-error', !valid);
    field.classList.toggle('error', !valid);
    field.classList.toggle('success', valid && value !== '');

    return valid;
  }

  function validateForm(form) {
    const fields = form.querySelectorAll('[required], [data-minlength]');
    let allValid = true;
    fields.forEach(function (f) {
      if (!validate(f)) allValid = false;
    });
    return allValid;
  }

  /* --- Attach live validation --- */
  document.querySelectorAll('.form-control').forEach(function (field) {
    field.addEventListener('blur', function () { validate(this); });
    field.addEventListener('input', function () {
      if (this.closest('.form-group').classList.contains('has-error')) {
        validate(this);
      }
    });
  });

  /* --- Contact Form --- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const feedback = contactForm.querySelector('.form-submit-feedback');
      if (!validateForm(contactForm)) return;

      const btn = contactForm.querySelector('[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Sending...';
      btn.disabled = true;

      /* Simulate submission (replace with real backend call) */
      setTimeout(function () {
        btn.innerHTML = originalText;
        btn.disabled = false;
        if (feedback) {
          feedback.className = 'form-submit-feedback success';
          feedback.innerHTML = '<i class="fas fa-check-circle"></i> Thank you! Your message has been sent. We\'ll respond within 24 hours.';
          feedback.style.display = 'flex';
        }
        contactForm.reset();
        contactForm.querySelectorAll('.form-control').forEach(function (f) {
          f.classList.remove('success', 'error');
        });
      }, 1500);
    });
  }

  /* --- Get Involved / Partnership Form --- */
  const partnerForm = document.getElementById('partner-form');
  if (partnerForm) {
    partnerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const feedback = partnerForm.querySelector('.form-submit-feedback');
      if (!validateForm(partnerForm)) return;

      const btn = partnerForm.querySelector('[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Submitting...';
      btn.disabled = true;

      setTimeout(function () {
        btn.innerHTML = originalText;
        btn.disabled = false;
        if (feedback) {
          feedback.className = 'form-submit-feedback success';
          feedback.innerHTML = '<i class="fas fa-check-circle"></i> Thank you for your interest! Our partnerships team will reach out shortly at <strong>partnerships@padupfoundation.org</strong>.';
          feedback.style.display = 'flex';
        }
        partnerForm.reset();
        partnerForm.querySelectorAll('.form-control').forEach(function (f) {
          f.classList.remove('success', 'error');
        });
      }, 1500);
    });
  }
})();

/* --- Flutterwave Donation --- */
(function initDonation() {
  const amountBtns = document.querySelectorAll('.amount-btn');
  const customInput = document.getElementById('custom-amount');
  const donateBtn = document.getElementById('donate-btn');

  if (!donateBtn) return;

  let selectedAmount = 5000;

  amountBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      amountBtns.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      selectedAmount = parseInt(btn.dataset.amount, 10);
      if (customInput) customInput.value = '';
    });
  });

  if (customInput) {
    customInput.addEventListener('input', function () {
      amountBtns.forEach(function (b) { b.classList.remove('selected'); });
      selectedAmount = parseInt(this.value, 10) || 0;
    });
  }

  donateBtn.addEventListener('click', function () {
    const nameEl = document.getElementById('donor-name');
    const emailEl = document.getElementById('donor-email');
    const phoneEl = document.getElementById('donor-phone');

    const name = nameEl ? nameEl.value.trim() : 'Anonymous';
    const email = emailEl ? emailEl.value.trim() : 'donor@padupfoundation.org';
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

    if (!selectedAmount || selectedAmount < 100) {
      alert('Please select or enter a donation amount of at least ₦100.');
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
      currency: 'NGN',
      payment_options: 'card, banktransfer, ussd, mobilemoney',
      customer: {
        email: email,
        phone_number: phone,
        name: name
      },
      customizations: {
        title: 'Pad Up Foundation',
        description: 'Donation — Ending Period Poverty',
        logo: window.location.origin + '/images/Padupfoundation-LOGO.jpg'
      },
      callback: function (payment) {
        if (payment.status === 'successful' || payment.status === 'completed') {
          const successMsg = document.getElementById('donation-success');
          if (successMsg) {
            successMsg.style.display = 'flex';
            successMsg.querySelector('.donation-amount').textContent =
              '₦' + selectedAmount.toLocaleString();
          }
        }
      },
      onclose: function () {}
    });
  });
})();
