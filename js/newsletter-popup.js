import { supabase } from './supabase-client.js';

(function initNewsletterPopup() {
  const overlay = document.getElementById('newsletter-popup-overlay');
  const closeBtn = document.getElementById('newsletter-popup-close');
  const form = document.getElementById('newsletter-popup-form');
  if (!overlay || !form) return;

  const STORAGE_KEY = 'padup_newsletter_popup_dismissed';

  if (localStorage.getItem(STORAGE_KEY)) return;

  function showPopup() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePopup() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    localStorage.setItem(STORAGE_KEY, '1');
  }

  setTimeout(showPopup, 100);

  closeBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePopup();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closePopup();
  });

  const nameInput = document.getElementById('popup-name');
  const emailInput = document.getElementById('popup-email');
  const submitBtn = document.getElementById('popup-submit');
  const feedback = document.getElementById('popup-feedback');

  function setError(input, message) {
    const group = input.closest('.form-group');
    if (group) {
      group.classList.add('has-error');
      const msg = group.querySelector('.error-msg');
      if (msg) msg.textContent = message;
    }
  }

  function clearError(input) {
    const group = input.closest('.form-group');
    if (group) {
      group.classList.remove('has-error');
      const msg = group.querySelector('.error-msg');
      if (msg) msg.textContent = '';
    }
  }

  function validate() {
    let valid = true;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || name.length < 2) {
      setError(nameInput, 'Please enter your first name.');
      valid = false;
    } else {
      clearError(nameInput);
    }

    if (!email || !emailRe.test(email)) {
      setError(emailInput, 'Please enter a valid email address.');
      valid = false;
    } else {
      clearError(emailInput);
    }
    return valid;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validate()) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = '<span class="spinner"></span> Subscribing...';
    submitBtn.disabled = true;

    async function syncToBrevo(emailAddr, firstName, subscriberId) {
      try {
        var apiUrl = (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/brevo-sync/sync';
        var res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '')
          },
          body: JSON.stringify({ email: emailAddr, first_name: firstName, subscriber_id: subscriberId })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          console.warn('[Newsletter Popup] Brevo sync warning:', data.details || data.error || 'Unknown error');
        }
      } catch (err) {
        console.warn('[Newsletter Popup] Brevo sync failed (non-blocking):', err.message);
      }
    }


    try {
      const { data: insertData, error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ first_name: name, email: email }])
        .select('id');

      if (error && error.code !== '23505') {
        console.error('[Newsletter Popup] Insert error:', error.message, error.details, error.hint);
        throw error;
      }

      if (error && error.code === '23505') {
        feedback.className = 'newsletter-popup-feedback success';
        feedback.innerHTML = '<i class="fas fa-check-circle"></i> You\'re already subscribed! Thank you.';
        setTimeout(closePopup, 2000);
        return;
      }

      // Sync to Brevo (fire-and-forget)
      syncToBrevo(email, name, insertData && insertData[0] ? insertData[0].id : null);

      feedback.className = 'newsletter-popup-feedback success';
      feedback.innerHTML = '<i class="fas fa-check-circle"></i> Welcome aboard, ' + name + '! Check your inbox for updates.';
      form.style.display = 'none';
      localStorage.setItem(STORAGE_KEY, '1');
      setTimeout(closePopup, 3000);
    } catch (err) {
      feedback.className = 'newsletter-popup-feedback error-state';
      feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> Something went wrong. Please try again.';
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
})();
