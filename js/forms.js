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

/* --- Donations ---
   The donation flow lives entirely in js/donation.js, which records the
   donation server-side and only confirms it once the payment has been verified
   with the payment provider. The earlier handler that lived here trusted the
   browser's own "successful" callback and carried a placeholder payment key, so
   it has been removed rather than left shipping alongside the real one. */
