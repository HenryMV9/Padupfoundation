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
      // Check for duplicate first
      const { data: existing } = await supabase
        .from('newsletter_subscribers')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        showFeedback('error-state', 'You\'re already subscribed! Thank you for being part of our community.');
        form.reset();
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ first_name: name, email: email }]);

      if (error) {
        if (error.code === '23505') {
          showFeedback('error-state', 'You\'re already subscribed! Thank you for being part of our community.');
        } else {
          throw error;
        }
      } else {
        showFeedback('success', 'Thank you for subscribing, ' + name + '! You\'ve joined our community of changemakers. Watch your inbox for inspiring stories and impact updates.');
        form.reset();
        nameInput.classList.remove('success', 'error');
        emailInput.classList.remove('success', 'error');
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
