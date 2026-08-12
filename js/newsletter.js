/* ============================================================
   PAD UP FOUNDATION - Newsletter Signup
   Validates inputs, prevents duplicates, saves to Supabase.
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  const nameInput = document.getElementById('newsletter-name');
  const emailInput = document.getElementById('newsletter-email');
  const submitBtn = document.getElementById('newsletter-submit');
  const feedback = document.getElementById('newsletter-feedback');

  function setError(input, message) {
    const group = input.closest('.form-group');
    if (group) {
      group.classList.add('has-error');
      const msg = group.querySelector('.error-msg');
      if (msg) msg.textContent = message;
    }
    input.classList.add('error');
    input.classList.remove('success');
  }

  function clearError(input) {
    const group = input.closest('.form-group');
    if (group) group.classList.remove('has-error');
    input.classList.remove('error');
  }

  function showFeedback(type, message) {
    if (!feedback) return;
    feedback.className = 'newsletter-feedback ' + type;
    feedback.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle') + '"></i><span>' + message + '</span>';
  }

  function validate() {
    let valid = true;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name) {
      setError(nameInput, 'Please enter your first name.');
      valid = false;
    } else if (name.length < 2) {
      setError(nameInput, 'Name must be at least 2 characters.');
      valid = false;
    } else {
      clearError(nameInput);
      nameInput.classList.add('success');
    }

    if (!email) {
      setError(emailInput, 'Please enter your email address.');
      valid = false;
    } else if (!emailRe.test(email)) {
      setError(emailInput, 'Please enter a valid email address.');
      valid = false;
    } else {
      clearError(emailInput);
      emailInput.classList.add('success');
    }

    return valid;
  }

  // Live validation
  [nameInput, emailInput].forEach(function (input) {
    input.addEventListener('input', function () {
      if (input.closest('.form-group').classList.contains('has-error')) {
        validate();
      }
    });
  });

  // Sync subscriber to Brevo via edge function (fire-and-forget)
  async function syncToBrevo(email, firstName, subscriberId) {
    try {
      var apiUrl = (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/brevo-sync/sync';
      var res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '')
        },
        body: JSON.stringify({ email: email, first_name: firstName, subscriber_id: subscriberId })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        console.warn('[Newsletter] Brevo sync warning:', data.details || data.error || 'Unknown error');
      }
    } catch (err) {
      console.warn('[Newsletter] Brevo sync failed (non-blocking):', err.message);
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validate()) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = '<span class="spinner"></span> Subscribing...';
    submitBtn.disabled = true;
    feedback.className = '';
    feedback.style.display = 'none';

    try {
      const { data: insertData, error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ first_name: name, email: email }])
        .select('id');

      if (error) {
        if (error.code === '23505') {
          showFeedback('error-state', 'You\'re already subscribed! Thank you for being part of our community.');
        } else {
          console.error('[Newsletter] Insert error:', error.message, error.details, error.hint);
          throw error;
        }
      } else {
        showFeedback('success', 'Thank you for subscribing, ' + name + '! You\'ve joined our community of changemakers. Watch your inbox for inspiring stories and impact updates.');
        form.reset();
        nameInput.classList.remove('success', 'error');
        emailInput.classList.remove('success', 'error');

        // Sync to Brevo (fire-and-forget)
        syncToBrevo(email, name, insertData && insertData[0] ? insertData[0].id : null);
      }
    } catch (err) {
      console.error('[Newsletter] Error:', err.message);
      showFeedback('error-state', 'Something went wrong. Please try again in a moment.');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
})();
