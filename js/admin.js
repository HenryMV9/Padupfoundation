/* ============================================================
   PAD UP FOUNDATION — Premium Admin Dashboard
   Auth, overview stats, CRUD for donations, news, gallery,
   and newsletter subscribers — with Supabase Realtime.
   ============================================================ */

import { supabase, STORAGE_BUCKET } from './supabase-client.js';

(function initAdmin() {
  // ============================================================
  // STATE
  // ============================================================
  let allDonations = [];
  let allSubscribers = [];
  let allNews = [];
  let allGallery = [];
  let pendingFile = null;
  let activePanel = 'overview';

  const PANEL_INFO = {
    overview:    { title: 'Dashboard Overview', subtitle: "Welcome back! Here's what's happening with your platform." },
    donations:   { title: 'Donation Management', subtitle: 'View and track all successful donations.' },
    news:        { title: 'News Management', subtitle: 'Create, edit, and publish news articles.' },
    gallery:     { title: 'Gallery Management', subtitle: 'Upload and organize gallery images.' },
    subscribers: { title: 'Newsletter Subscribers', subtitle: 'View and export your subscriber list.' }
  };

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  const toastContainer = document.getElementById('admin-toast-container');

  function showToast(type, title, msg) {
    if (!toastContainer) return;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    const toast = document.createElement('div');
    toast.className = 'admin-toast ' + type;
    toast.innerHTML =
      '<div class="admin-toast-icon"><i class="fas ' + icon + '"></i></div>' +
      '<div class="admin-toast-body"><p class="admin-toast-title">' + escapeHtml(title) + '</p>' +
      (msg ? '<p class="admin-toast-msg">' + escapeHtml(msg) + '</p>' : '') + '</div>';
    toastContainer.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('removing');
      setTimeout(function () { toast.remove(); }, 300);
    }, 4000);
  }

  // ============================================================
  // CONFIRM DIALOG (replaces native confirm)
  // ============================================================
  const confirmOverlay = document.getElementById('admin-confirm-overlay');
  const confirmTitle = document.getElementById('admin-confirm-title');
  const confirmMsg = document.getElementById('admin-confirm-message');
  const confirmDeleteBtn = document.getElementById('admin-confirm-delete');
  const confirmCancelBtn = document.getElementById('admin-confirm-cancel');
  let confirmResolve = null;

  function showConfirm(title, message, confirmText) {
    confirmTitle.textContent = title;
    confirmMsg.textContent = message;
    confirmDeleteBtn.innerHTML = '<i class="fas fa-trash"></i> ' + (confirmText || 'Delete');
    confirmOverlay.classList.add('open');
    confirmDeleteBtn.disabled = false;
    return new Promise(function (resolve) {
      confirmResolve = resolve;
    });
  }

  function closeConfirm(result) {
    confirmOverlay.classList.remove('open');
    if (confirmResolve) {
      confirmResolve(result);
      confirmResolve = null;
    }
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', function () {
      confirmDeleteBtn.disabled = true;
      closeConfirm(true);
    });
  }
  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', function () { closeConfirm(false); });
  }
  if (confirmOverlay) {
    confirmOverlay.addEventListener('click', function (e) {
      if (e.target === confirmOverlay) closeConfirm(false);
    });
  }

  // ============================================================
  // DOM ELEMENTS
  // ============================================================
  const loginView = document.getElementById('admin-login-view');
  const dashboardView = document.getElementById('admin-dashboard-view');
  const loginForm = document.getElementById('admin-login-form');
  const loginFeedback = document.getElementById('login-feedback');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const userEmailEl = document.getElementById('admin-user-email');
  const navItems = document.querySelectorAll('.admin-nav-item');
  const panels = document.querySelectorAll('.admin-panel');
  const panelTitle = document.getElementById('panel-title');
  const panelSubtitle = document.getElementById('panel-subtitle');
  const mobileToggle = document.getElementById('admin-mobile-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  const sidebarBackdrop = document.getElementById('admin-sidebar-backdrop');

  // ============================================================
  // AUTH
  // ============================================================
  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        showDashboard(session.user);
      } else {
        showLogin();
      }
    } catch (err) {
      console.error('[Admin] Session check error:', err);
      showLogin();
    }
  }

  function showLogin() {
    if (loginView) loginView.style.display = 'flex';
    if (dashboardView) dashboardView.style.display = 'none';
  }

  function showDashboard(user) {
    if (loginView) loginView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'block';
    if (user && user.email && userEmailEl) {
      userEmailEl.innerHTML = '<i class="fas fa-user-circle"></i> ' + escapeHtml(user.email);
    }
    loadOverview();
    setupRealtime();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;

      if (!email || !password) {
        showLoginFeedback('error-state', 'Please enter your email and password.');
        return;
      }

      const originalText = loginBtn.innerHTML;
      loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
      loginBtn.disabled = true;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showDashboard(data.user);
        loginForm.reset();
      } catch (err) {
        var msg = err && err.message ? err.message : '';
        console.error('[Admin] Auth error:', err);
        if (err && err.status) console.error('[Admin] Auth status:', err.status);
        var display;
        if (msg.indexOf('Invalid login credentials') !== -1) {
          display = 'Invalid email or password. Please verify your credentials and try again.';
        } else if (msg.indexOf('Email not confirmed') !== -1) {
          display = 'Your email has not been confirmed. Please contact your administrator.';
        } else if (msg.indexOf('over_request_rate_limit') !== -1 || msg.indexOf('rate limit') !== -1) {
          display = 'Too many login attempts. Please wait a moment and try again.';
        } else if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1) {
          display = 'Network error. Please check your internet connection and try again.';
        } else if (msg) {
          display = 'Login failed: ' + msg;
        } else {
          display = 'Invalid credentials. Please check your email and password.';
        }
        showLoginFeedback('error-state', display);
      } finally {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
      }
    });
  }

  function showLoginFeedback(type, message) {
    if (!loginFeedback) return;
    loginFeedback.className = 'admin-login-feedback ' + type;
    loginFeedback.innerHTML = '<i class="fas ' + (type === 'error-state' ? 'fa-exclamation-circle' : 'fa-check-circle') + '"></i> ' + message;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('[Admin] Sign out error:', err.message);
      }
      showLogin();
    });
  }

  supabase.auth.onAuthStateChange(function (event, session) {
    (async () => {
      if (event === 'SIGNED_OUT' || !session) {
        showLogin();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (dashboardView && dashboardView.style.display === 'none') {
          showDashboard(session.user);
        }
      }
    })();
  });

  // ============================================================
  // NAVIGATION
  // ============================================================
  navItems.forEach(function (item) {
    item.addEventListener('click', function () {
      const panel = item.dataset.panel;
      activePanel = panel;
      navItems.forEach(function (n) { n.classList.remove('active'); });
      item.classList.add('active');
      panels.forEach(function (p) { p.classList.remove('active'); });
      var targetPanel = document.getElementById('panel-' + panel);
      if (targetPanel) targetPanel.classList.add('active');
      if (panelTitle) panelTitle.textContent = PANEL_INFO[panel].title;
      if (panelSubtitle) panelSubtitle.textContent = PANEL_INFO[panel].subtitle;

      closeSidebar();

      if (panel === 'overview') loadOverview();
      else if (panel === 'donations') loadDonations();
      else if (panel === 'news') loadNews();
      else if (panel === 'gallery') loadGallery();
      else if (panel === 'subscribers') loadSubscribers();
    });
  });

  if (mobileToggle) {
    mobileToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      sidebarBackdrop.classList.toggle('show');
    });
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeSidebar);
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
  }

  // ============================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================
  let realtimeSetup = false;

  function setupRealtime() {
    if (realtimeSetup) return;
    realtimeSetup = true;

    // News articles — refresh admin table + overview on any change
    supabase
      .channel('admin-news')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_articles' }, function () {
        console.log('[Realtime] News article changed');
        if (activePanel === 'news') loadNews();
        loadOverview();
      })
      .subscribe();

    // Gallery images — refresh admin grid + overview on any change
    supabase
      .channel('admin-gallery')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_images' }, function () {
        console.log('[Realtime] Gallery image changed');
        if (activePanel === 'gallery') loadGallery();
        loadOverview();
      })
      .subscribe();

    // Newsletter subscribers — refresh admin table + overview on any change
    supabase
      .channel('admin-subscribers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_subscribers' }, function () {
        console.log('[Realtime] Subscriber changed');
        if (activePanel === 'subscribers') loadSubscribers();
        loadOverview();
      })
      .subscribe();

    // Donations — refresh admin table + overview on any change
    supabase
      .channel('admin-donations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, function () {
        console.log('[Realtime] Donation changed');
        if (activePanel === 'donations') loadDonations();
        loadOverview();
      })
      .subscribe();
  }

  // ============================================================
  // OVERVIEW
  // ============================================================
  async function loadOverview() {
    showSkeletonStats();
    try {
      const [donationsRes, subscribersRes, galleryRes, newsRes] = await Promise.all([
        supabase.from('donations').select('*', { count: 'exact' }),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
        supabase.from('gallery_images').select('id', { count: 'exact', head: true }),
        supabase.from('news_articles').select('id', { count: 'exact', head: true })
      ]);

      const donationsData = donationsRes.data || [];
      const donationCount = donationsRes.count !== null ? donationsRes.count : donationsData.length;
      const uniqueDonors = new Set(donationsData.map(function (d) { return d.email || d.donor_name; }).filter(Boolean)).size;

      setStat('stat-donations', donationCount);
      setStat('stat-donors', uniqueDonors);
      setStat('stat-subscribers', subscribersRes.count || 0);
      setStat('stat-gallery', galleryRes.count || 0);
      setStat('stat-news', newsRes.count || 0);

      const recent = donationsData.slice().sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      }).slice(0, 5);

      const tbody = document.getElementById('overview-recent-donations');
      if (!tbody) return;
      if (!recent.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="admin-empty-state"><i class="fas fa-inbox"></i><p>No donations yet</p></td></tr>';
      } else {
        tbody.innerHTML = recent.map(function (d) {
          return '<tr><td>' + escapeHtml(d.donor_name || 'Anonymous') + '</td><td>' + Number(d.amount).toLocaleString() + '</td><td>' + d.currency + '</td><td>' + formatDate(d.created_at) + '</td></tr>';
        }).join('');
      }
    } catch (err) {
      console.error('[Admin] Overview fetch error:', err.message, err.details || '', err.hint || '', err);
      showToast('error', 'Failed to load', 'Could not load overview data. ' + err.message);
    }
  }

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = Number(value).toLocaleString();
  }

  function showSkeletonStats() {
    var vals = ['stat-donations', 'stat-donors', 'stat-subscribers', 'stat-gallery', 'stat-news'];
    vals.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }

  // ============================================================
  // DONATIONS
  // ============================================================
  async function loadDonations() {
    const tbody = document.getElementById('donations-table-body');
    if (!tbody) return;
    tbody.innerHTML = skeletonRows(6, 6);
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allDonations = data || [];
      renderDonations();
      updateDonationSummary();
    } catch (err) {
      console.error('[Admin] Donations fetch error:', err.message, err.details || '', err.hint || '', err);
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load donations: ' + err.message + '</p></td></tr>';
    }
  }

  function updateDonationSummary() {
    const total = allDonations.reduce(function (sum, d) { return sum + parseFloat(d.amount); }, 0);
    const uniqueDonors = new Set(allDonations.map(function (d) { return d.email || d.donor_name; }).filter(Boolean)).size;
    setStat('donations-total', total.toLocaleString(undefined, { maximumFractionDigits: 2 }));
    setStat('donors-total', uniqueDonors);
  }

  function renderDonations() {
    const searchEl = document.getElementById('donations-search');
    const currencyEl = document.getElementById('donations-currency-filter');
    const sortEl = document.getElementById('donations-sort');
    const search = (searchEl ? searchEl.value : '').toLowerCase();
    const currencyFilter = currencyEl ? currencyEl.value : '';
    const sortBy = sortEl ? sortEl.value : 'recent';

    let filtered = allDonations.filter(function (d) {
      const matchesSearch = !search ||
        (d.donor_name && d.donor_name.toLowerCase().includes(search)) ||
        (d.email && d.email.toLowerCase().includes(search));
      const matchesCurrency = !currencyFilter || d.currency === currencyFilter;
      return matchesSearch && matchesCurrency;
    });

    if (sortBy === 'highest') {
      filtered.sort(function (a, b) { return parseFloat(b.amount) - parseFloat(a.amount); });
    } else if (sortBy === 'lowest') {
      filtered.sort(function (a, b) { return parseFloat(a.amount) - parseFloat(b.amount); });
    } else if (sortBy === 'oldest') {
      filtered.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    }

    const tbody = document.getElementById('donations-table-body');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-state"><i class="fas fa-inbox"></i><p>No donations found</p></td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (d) {
      return '<tr>' +
        '<td><strong>' + escapeHtml(d.donor_name || 'Anonymous') + '</strong></td>' +
        '<td>' + escapeHtml(d.email || '\u2014') + '</td>' +
        '<td>' + Number(d.amount).toLocaleString() + '</td>' +
        '<td>' + d.currency + '</td>' +
        '<td><span class="status-badge status-successful">' + escapeHtml(d.payment_status) + '</span></td>' +
        '<td>' + formatDate(d.created_at) + '</td>' +
        '</tr>';
    }).join('');
  }

  var donationsSearchEl = document.getElementById('donations-search');
  if (donationsSearchEl) donationsSearchEl.addEventListener('input', renderDonations);
  var donationsCurrencyEl = document.getElementById('donations-currency-filter');
  if (donationsCurrencyEl) donationsCurrencyEl.addEventListener('change', renderDonations);
  var donationsSortEl = document.getElementById('donations-sort');
  if (donationsSortEl) donationsSortEl.addEventListener('change', renderDonations);

  var donationsExportBtn = document.getElementById('donations-export-btn');
  if (donationsExportBtn) {
    donationsExportBtn.addEventListener('click', function () {
      if (!allDonations.length) {
        showToast('info', 'No data', 'There are no donations to export.');
        return;
      }
      var csv = ['Donor Name,Email,Amount,Currency,Payment Status,Transaction Date'];
      allDonations.forEach(function (d) {
        csv.push([
          csvEscape(d.donor_name || 'Anonymous'),
          csvEscape(d.email || ''),
          d.amount,
          d.currency,
          csvEscape(d.payment_status),
          new Date(d.created_at).toISOString()
        ].join(','));
      });
      downloadCSV(csv.join('\n'), 'donations');
    });
  }

  // ============================================================
  // NEWS
  // ============================================================
  async function loadNews() {
    const tbody = document.getElementById('news-table-body');
    if (!tbody) return;
    tbody.innerHTML = skeletonRows(3, 4);
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allNews = data || [];
      renderNews();
    } catch (err) {
      console.error('[Admin] News fetch error:', err.message, err.details || '', err.hint || '', err);
      tbody.innerHTML = '<tr><td colspan="4" class="admin-empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load articles: ' + err.message + '</p></td></tr>';
    }
  }

  function renderNews() {
    const tbody = document.getElementById('news-table-body');
    if (!tbody) return;
    if (!allNews.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="admin-empty-state"><i class="fas fa-newspaper"></i><p>No articles yet. Click "Add Article" to create one.</p></td></tr>';
      return;
    }

    tbody.innerHTML = allNews.map(function (article) {
      var toggleIcon = article.status === 'published' ? 'fa-toggle-on' : 'fa-toggle-off';
      var toggleTitle = article.status === 'published' ? 'Unpublish' : 'Publish';
      return '<tr>' +
        '<td><strong>' + escapeHtml(article.title) + '</strong><br><span style="font-size:0.75rem;color:var(--gray-400);">' + escapeHtml(truncateText(article.summary, 60)) + '</span></td>' +
        '<td><span class="status-badge status-' + article.status + '">' + article.status + '</span></td>' +
        '<td>' + (article.published_at ? formatDate(article.published_at) : '\u2014') + '</td>' +
        '<td>' +
          '<button class="admin-action-btn" data-edit-news="' + article.id + '" title="Edit"><i class="fas fa-edit"></i></button>' +
          '<button class="admin-action-btn toggle" data-toggle-news="' + article.id + '" title="' + toggleTitle + '"><i class="fas ' + toggleIcon + '"></i></button>' +
          '<button class="admin-action-btn delete" data-delete-news="' + article.id + '" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-edit-news]').forEach(function (btn) {
      btn.addEventListener('click', function () { openNewsModal(btn.dataset.editNews); });
    });
    tbody.querySelectorAll('[data-toggle-news]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleNewsPublish(btn.dataset.toggleNews); });
    });
    tbody.querySelectorAll('[data-delete-news]').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteNews(btn.dataset.deleteNews); });
    });
  }

  const newsModal = document.getElementById('news-modal');
  const newsAddBtn = document.getElementById('news-add-btn');

  if (newsAddBtn) {
    newsAddBtn.addEventListener('click', function () { openNewsModal(null); });
  }

  function openNewsModal(id) {
    const form = document.getElementById('news-form');
    const feedback = document.getElementById('news-form-feedback');
    if (feedback) {
      feedback.className = '';
      feedback.style.display = 'none';
    }
    if (form) form.reset();

    if (id) {
      const article = allNews.find(function (a) { return a.id === id; });
      if (!article) return;
      document.getElementById('news-modal-title').textContent = 'Edit Article';
      document.getElementById('news-id').value = article.id;
      document.getElementById('news-title-input').value = article.title;
      document.getElementById('news-summary-input').value = article.summary;
      document.getElementById('news-content-input').value = article.content;
      document.getElementById('news-status-input').value = article.status;
    } else {
      document.getElementById('news-modal-title').textContent = 'Add Article';
      document.getElementById('news-id').value = '';
    }

    if (newsModal) newsModal.classList.add('open');
  }

  var newsSaveBtn = document.getElementById('news-save-btn');
  if (newsSaveBtn) {
    newsSaveBtn.addEventListener('click', async function () {
      const id = document.getElementById('news-id').value;
      const title = document.getElementById('news-title-input').value.trim();
      const summary = document.getElementById('news-summary-input').value.trim();
      const content = document.getElementById('news-content-input').value.trim();
      const status = document.getElementById('news-status-input').value;
      const feedback = document.getElementById('news-form-feedback');
      const saveBtn = document.getElementById('news-save-btn');

      if (!title || !summary || !content) {
        if (feedback) {
          feedback.className = 'admin-login-feedback error-state';
          feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> Title, preview, and content are all required.';
        }
        return;
      }

      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
      saveBtn.disabled = true;

      try {
        if (id) {
          // EDIT: only set published_at if publishing for the first time
          var existing = allNews.find(function (a) { return a.id === id; });
          var payload = {
            title: title,
            summary: summary,
            content: content,
            status: status
          };
          if (status === 'published' && !existing.published_at) {
            payload.published_at = new Date().toISOString();
          } else if (status === 'draft') {
            payload.published_at = null;
          }

          const { error } = await supabase.from('news_articles').update(payload).eq('id', id);
          if (error) throw error;
          showToast('success', 'Article updated', '"' + title + '" has been saved.');
        } else {
          var newPayload = {
            title: title,
            summary: summary,
            content: content,
            status: status,
            published_at: status === 'published' ? new Date().toISOString() : null
          };
          const { error } = await supabase.from('news_articles').insert([newPayload]);
          if (error) throw error;
          showToast('success', 'Article created', '"' + title + '" has been added.');
        }
        if (newsModal) newsModal.classList.remove('open');
        // Realtime will trigger loadNews, but also call directly for immediate feedback
        loadNews();
        loadOverview();
      } catch (err) {
        console.error('[Admin] News save error:', err.message, err.details || '', err.hint || '', err);
        if (feedback) {
          feedback.className = 'admin-login-feedback error-state';
          feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to save: ' + err.message;
        }
      } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }
    });
  }

  async function toggleNewsPublish(id) {
    const article = allNews.find(function (a) { return a.id === id; });
    if (!article) return;
    const newStatus = article.status === 'published' ? 'draft' : 'published';
    try {
      var payload = {
        status: newStatus,
        published_at: newStatus === 'published' ? (article.published_at || new Date().toISOString()) : null
      };
      const { error } = await supabase.from('news_articles').update(payload).eq('id', id);
      if (error) throw error;
      showToast('success', newStatus === 'published' ? 'Article published' : 'Article unpublished', '"' + article.title + '" is now ' + newStatus + '.');
      loadNews();
      loadOverview();
    } catch (err) {
      console.error('[Admin] News toggle error:', err.message, err.details || '', err.hint || '', err);
      showToast('error', 'Update failed', err.message);
    }
  }

  async function deleteNews(id) {
    const article = allNews.find(function (a) { return a.id === id; });
    if (!article) return;
    const confirmed = await showConfirm('Delete Article', 'Are you sure you want to delete "' + article.title + '"? This cannot be undone.', 'Delete Article');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('news_articles').delete().eq('id', id);
      if (error) throw error;
      showToast('success', 'Article deleted', '"' + article.title + '" has been removed.');
      loadNews();
      loadOverview();
    } catch (err) {
      console.error('[Admin] News delete error:', err.message, err.details || '', err.hint || '', err);
      showToast('error', 'Delete failed', err.message);
    }
  }

  // ============================================================
  // GALLERY
  // ============================================================
  async function loadGallery() {
    const grid = document.getElementById('admin-gallery-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="admin-empty-state" style="grid-column: 1/-1;"><p>Loading gallery...</p></div>';
    try {
      const { data, error } = await supabase
        .from('gallery_images')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      allGallery = data || [];
      renderGallery();
    } catch (err) {
      console.error('[Admin] Gallery fetch error:', err.message, err.details || '', err.hint || '', err);
      grid.innerHTML = '<div class="admin-empty-state" style="grid-column: 1/-1;"><i class="fas fa-exclamation-circle"></i><p>Failed to load gallery: ' + err.message + '</p></div>';
    }
  }

  function renderGallery() {
    const grid = document.getElementById('admin-gallery-grid');
    if (!grid) return;
    if (!allGallery.length) {
      grid.innerHTML = '<div class="admin-empty-state" style="grid-column: 1/-1;"><i class="fas fa-images"></i><p>No images yet. Click "Upload Image" to add one.</p></div>';
      return;
    }

    grid.innerHTML = allGallery.map(function (img) {
      return '<div class="admin-gallery-item">' +
        '<img src="' + img.image_url + '" alt="' + escapeHtml(img.caption || 'Gallery image') + '" loading="lazy" />' +
        '<div class="admin-gallery-item-overlay">' +
          '<span class="admin-gallery-item-caption">' + escapeHtml(img.caption || img.category) + '</span>' +
          '<button class="admin-action-btn delete" data-delete-gallery="' + img.id + '" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('[data-delete-gallery]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const id = btn.dataset.deleteGallery;
        const img = allGallery.find(function (g) { return g.id === id; });
        if (!img) return;
        const confirmed = await showConfirm('Delete Image', 'Are you sure you want to delete this image? It will be permanently removed.', 'Delete Image');
        if (!confirmed) return;
        try {
          // Only attempt storage delete for Supabase-hosted images (not local /images/ paths)
          if (img.image_url && img.image_url.indexOf('/storage/v1/object/public/') !== -1) {
            var parts = img.image_url.split('/' + STORAGE_BUCKET + '/');
            if (parts.length > 1 && parts[1]) {
              var path = parts[1];
              const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
              if (storageError) {
                console.error('[Admin] Storage delete error:', storageError.message, '| path:', path);
              }
            }
          }
          // Delete from database
          const { error } = await supabase.from('gallery_images').delete().eq('id', id);
          if (error) {
            console.error('[Admin] Gallery DB delete error:', error.message, error.details, error.hint);
            throw error;
          }
          showToast('success', 'Image deleted', 'The image has been removed from gallery and storage.');
          loadGallery();
          loadOverview();
        } catch (err) {
          console.error('[Admin] Gallery delete failed:', err.message, err);
          showToast('error', 'Delete failed', err.message);
        }
      });
    });
  }

  // Gallery upload modal
  const galleryModal = document.getElementById('gallery-modal');
  const galleryUploadBtn = document.getElementById('gallery-upload-btn');
  const galleryDropArea = document.getElementById('gallery-drop-area');
  const galleryFileInput = document.getElementById('gallery-file-input');
  const galleryPreview = document.getElementById('gallery-preview');

  if (galleryUploadBtn) {
    galleryUploadBtn.addEventListener('click', function () {
      pendingFile = null;
      if (galleryPreview) {
        galleryPreview.style.display = 'none';
        galleryPreview.src = '';
      }
      var gForm = document.getElementById('gallery-form');
      if (gForm) gForm.reset();
      var gFeedback = document.getElementById('gallery-form-feedback');
      if (gFeedback) {
        gFeedback.className = '';
        gFeedback.style.display = 'none';
      }
      var gProgress = document.getElementById('gallery-progress');
      if (gProgress) gProgress.style.display = 'none';
      var gProgressBar = document.getElementById('gallery-progress-bar');
      if (gProgressBar) gProgressBar.style.width = '0';
      if (galleryModal) galleryModal.classList.add('open');
    });
  }

  if (galleryDropArea && galleryFileInput) {
    galleryDropArea.addEventListener('click', function () { galleryFileInput.click(); });
    galleryDropArea.addEventListener('dragover', function (e) {
      e.preventDefault();
      galleryDropArea.classList.add('dragover');
    });
    galleryDropArea.addEventListener('dragleave', function () { galleryDropArea.classList.remove('dragover'); });
    galleryDropArea.addEventListener('drop', function (e) {
      e.preventDefault();
      galleryDropArea.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    });
  }

  if (galleryFileInput) {
    galleryFileInput.addEventListener('change', function () {
      if (this.files.length) handleFileSelect(this.files[0]);
    });
  }

  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      showGalleryFeedback('error-state', 'Please select an image file (PNG, JPG, or WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showGalleryFeedback('error-state', 'Image must be under 5MB.');
      return;
    }
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = function (e) {
      if (galleryPreview) {
        galleryPreview.src = e.target.result;
        galleryPreview.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }

  function showGalleryFeedback(type, message) {
    const fb = document.getElementById('gallery-form-feedback');
    if (!fb) return;
    fb.className = 'admin-login-feedback ' + type;
    fb.innerHTML = '<i class="fas ' + (type === 'error-state' ? 'fa-exclamation-circle' : 'fa-check-circle') + '"></i> ' + message;
  }

  var galleryUploadConfirm = document.getElementById('gallery-upload-confirm');
  if (galleryUploadConfirm) {
    galleryUploadConfirm.addEventListener('click', async function () {
      if (!pendingFile) {
        showGalleryFeedback('error-state', 'Please select an image to upload.');
        return;
      }

      const caption = document.getElementById('gallery-caption').value.trim();
      const category = document.getElementById('gallery-category').value;
      const uploadBtn = document.getElementById('gallery-upload-confirm');

      const filePath = Date.now() + '-' + pendingFile.name.replace(/[^a-zA-Z0-9.\-]/g, '_');

      uploadBtn.innerHTML = '<span class="spinner"></span> Uploading...';
      uploadBtn.disabled = true;
      var gProgress = document.getElementById('gallery-progress');
      if (gProgress) gProgress.style.display = 'block';

      try {
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, pendingFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: pendingFile.type
          });

        if (uploadError) {
          console.error('[Admin] Storage upload error:', uploadError.message, uploadError.statusCode, uploadError);
          throw new Error('Storage error: ' + uploadError.message);
        }

        var gProgressBar = document.getElementById('gallery-progress-bar');
        if (gProgressBar) gProgressBar.style.width = '80%';

        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
        const imageUrl = urlData.publicUrl;

        const { error: dbError } = await supabase.from('gallery_images').insert([{
          image_url: imageUrl,
          caption: caption || null,
          category: category
        }]);

        if (dbError) {
          console.error('[Admin] Gallery DB insert error:', dbError.message, dbError.details, dbError.hint, dbError);
          // Clean up orphaned storage file since DB insert failed
          await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
          throw new Error('Insert error: ' + dbError.message);
        }

        if (gProgressBar) gProgressBar.style.width = '100%';

        showToast('success', 'Image uploaded', 'The image has been added to the gallery.');
        if (galleryModal) galleryModal.classList.remove('open');
        loadGallery();
        loadOverview();
      } catch (err) {
        console.error('[Admin] Gallery upload failed:', err.message, err);
        showGalleryFeedback('error-state', err.message || 'Upload failed');
      } finally {
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload';
        uploadBtn.disabled = false;
      }
    });
  }

  // ============================================================
  // SUBSCRIBERS
  // ============================================================
  async function loadSubscribers() {
    const tbody = document.getElementById('subscribers-table-body');
    if (!tbody) return;
    tbody.innerHTML = skeletonRows(3, 3);
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });

      if (error) throw error;
      allSubscribers = data || [];
      renderSubscribers();
    } catch (err) {
      console.error('[Admin] Subscribers fetch error:', err.message, err.details || '', err.hint || '', err);
      tbody.innerHTML = '<tr><td colspan="3" class="admin-empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load subscribers: ' + err.message + '</p></td></tr>';
    }
  }

  function renderSubscribers() {
    const searchEl = document.getElementById('subscribers-search');
    const tbody = document.getElementById('subscribers-table-body');
    if (!tbody) return;
    const search = (searchEl ? searchEl.value : '').toLowerCase();

    const filtered = allSubscribers.filter(function (s) {
      return !search ||
        (s.first_name && s.first_name.toLowerCase().includes(search)) ||
        (s.email && s.email.toLowerCase().includes(search));
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="admin-empty-state"><i class="fas fa-users"></i><p>No subscribers found</p></td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (s) {
      return '<tr><td><strong>' + escapeHtml(s.first_name) + '</strong></td><td>' + escapeHtml(s.email) + '</td><td>' + formatDate(s.subscribed_at) + '</td></tr>';
    }).join('');
  }

  var subscribersSearchEl = document.getElementById('subscribers-search');
  if (subscribersSearchEl) subscribersSearchEl.addEventListener('input', renderSubscribers);

  var exportCsvBtn = document.getElementById('export-csv-btn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', function () {
      if (!allSubscribers.length) {
        showToast('info', 'No data', 'There are no subscribers to export.');
        return;
      }
      var csv = ['First Name,Email,Date Joined'];
      allSubscribers.forEach(function (s) {
        csv.push([
          csvEscape(s.first_name),
          csvEscape(s.email),
          new Date(s.subscribed_at).toISOString()
        ].join(','));
      });
      downloadCSV(csv.join('\n'), 'newsletter-subscribers');
    });
  }

  // ============================================================
  // MODAL CLOSE HANDLERS
  // ============================================================
  document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var modal = document.getElementById(btn.dataset.closeModal);
      if (modal) modal.classList.remove('open');
    });
  });

  document.querySelectorAll('.admin-modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.admin-modal-overlay.open').forEach(function (m) { m.classList.remove('open'); });
      if (confirmOverlay && confirmOverlay.classList.contains('open')) closeConfirm(false);
    }
  });

  // ============================================================
  // UTILITIES
  // ============================================================
  function formatDate(dateStr) {
    if (!dateStr) return '\u2014';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      console.error('[Admin] formatDate received invalid date:', dateStr);
      return '\u2014';
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncateText(str, n) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '...' : str;
  }

  function csvEscape(str) {
    if (!str) return '';
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function downloadCSV(content, prefix) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = prefix + '-' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Export complete', 'CSV file has been downloaded.');
  }

  function skeletonRows(count, cols) {
    var rows = [];
    for (var i = 0; i < count; i++) {
      rows.push('<tr><td colspan="' + cols + '"><div class="skeleton skeleton-row"></div></td></tr>');
    }
    return rows.join('');
  }

  // ============================================================
  // INIT
  // ============================================================
  checkAuth();
})();
