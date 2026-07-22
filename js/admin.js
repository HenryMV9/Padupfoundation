/* ============================================================
   PAD UP FOUNDATION - Admin Dashboard
   Handles authentication, overview stats, and CRUD for
   donations, news, gallery, and subscribers.
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

  const PANEL_INFO = {
    overview: { title: 'Dashboard Overview', subtitle: "Welcome back! Here's what's happening with your platform." },
    donations: { title: 'Donation Management', subtitle: 'View and track all successful donations.' },
    news: { title: 'News Management', subtitle: 'Create, edit, and publish news articles.' },
    gallery: { title: 'Gallery Management', subtitle: 'Upload and organize gallery images.' },
    subscribers: { title: 'Newsletter Subscribers', subtitle: 'View and export subscriber list.' }
  };

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
    } catch {
      showLogin();
    }
  }

  function showLogin() {
    loginView.style.display = 'flex';
    dashboardView.style.display = 'none';
  }

  function showDashboard(user) {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    if (user && user.email) {
      userEmailEl.textContent = user.email;
    }
    loadOverview();
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
    loginFeedback.className = 'admin-login-feedback ' + type;
    loginFeedback.innerHTML = '<i class="fas ' + (type === 'error-state' ? 'fa-exclamation-circle' : 'fa-check-circle') + '"></i> ' + message;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      await supabase.auth.signOut();
      showLogin();
    });
  }

  supabase.auth.onAuthStateChange(function (event, session) {
    (async () => {
      if (event === 'SIGNED_OUT' || !session) {
        showLogin();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (dashboardView.style.display === 'none') {
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
      navItems.forEach(function (n) { n.classList.remove('active'); });
      item.classList.add('active');
      panels.forEach(function (p) { p.classList.remove('active'); });
      document.getElementById('panel-' + panel).classList.add('active');
      panelTitle.textContent = PANEL_INFO[panel].title;
      panelSubtitle.textContent = PANEL_INFO[panel].subtitle;

      // Close sidebar on mobile
      sidebar.classList.remove('open');

      // Load panel data
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
    });
  }

  // ============================================================
  // OVERVIEW
  // ============================================================
  async function loadOverview() {
    try {
      const [donationsRes, subscribersRes, galleryRes, newsRes] = await Promise.all([
        supabase.from('donations').select('id', { count: 'exact', head: true }),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
        supabase.from('gallery_images').select('id', { count: 'exact', head: true }),
        supabase.from('news_articles').select('id', { count: 'exact', head: true })
      ]);

      document.getElementById('stat-donations').textContent = donationsRes.count || 0;
      document.getElementById('stat-subscribers').textContent = subscribersRes.count || 0;
      document.getElementById('stat-gallery').textContent = galleryRes.count || 0;
      document.getElementById('stat-news').textContent = newsRes.count || 0;

      // Load recent donations
      const { data: recent } = await supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      const tbody = document.getElementById('overview-recent-donations');
      if (!recent || recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="admin-empty-state"><i class="fas fa-inbox"></i><br>No donations yet</td></tr>';
      } else {
        tbody.innerHTML = recent.map(function (d) {
          return '<tr><td>' + escapeHtml(d.donor_name || 'Anonymous') + '</td><td>' + Number(d.amount).toLocaleString() + '</td><td>' + d.currency + '</td><td>' + formatDate(d.created_at) + '</td></tr>';
        }).join('');
      }
    } catch (err) {
      console.error('[Admin] Overview error:', err.message);
    }
  }

  // ============================================================
  // DONATIONS
  // ============================================================
  async function loadDonations() {
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
      console.error('[Admin] Donations error:', err.message);
    }
  }

  function updateDonationSummary() {
    const total = allDonations.reduce(function (sum, d) { return sum + parseFloat(d.amount); }, 0);
    const uniqueDonors = new Set(allDonations.map(function (d) { return d.email || d.donor_name; }).filter(Boolean)).size;
    document.getElementById('donations-total').textContent = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
    document.getElementById('donors-total').textContent = uniqueDonors;
  }

  function renderDonations() {
    const search = (document.getElementById('donations-search')?.value || '').toLowerCase();
    const currencyFilter = document.getElementById('donations-currency-filter')?.value || '';
    const sortBy = document.getElementById('donations-sort')?.value || 'recent';

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
    }

    const tbody = document.getElementById('donations-table-body');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-state"><i class="fas fa-inbox"></i><br>No donations found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (d) {
      return '<tr>' +
        '<td>' + escapeHtml(d.donor_name || 'Anonymous') + '</td>' +
        '<td>' + escapeHtml(d.email || '\u2014') + '</td>' +
        '<td>' + Number(d.amount).toLocaleString() + '</td>' +
        '<td>' + d.currency + '</td>' +
        '<td><span class="status-badge status-successful">' + d.payment_status + '</span></td>' +
        '<td>' + formatDate(d.created_at) + '</td>' +
        '</tr>';
    }).join('');
  }

  document.getElementById('donations-search')?.addEventListener('input', renderDonations);
  document.getElementById('donations-currency-filter')?.addEventListener('change', renderDonations);
  document.getElementById('donations-sort')?.addEventListener('change', renderDonations);

  // ============================================================
  // NEWS
  // ============================================================
  async function loadNews() {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allNews = data || [];
      renderNews();
    } catch (err) {
      console.error('[Admin] News error:', err.message);
    }
  }

  function renderNews() {
    const tbody = document.getElementById('news-table-body');
    if (!allNews.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="admin-empty-state"><i class="fas fa-newspaper"></i><br>No articles yet. Click "Add Article" to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = allNews.map(function (article) {
      return '<tr>' +
        '<td>' + escapeHtml(article.title) + '</td>' +
        '<td><span class="status-badge status-' + article.status + '">' + article.status + '</span></td>' +
        '<td>' + (article.published_at ? formatDate(article.published_at) : '\u2014') + '</td>' +
        '<td>' +
          '<button class="admin-action-btn" data-edit-news="' + article.id + '" title="Edit"><i class="fas fa-edit"></i></button> ' +
          '<button class="admin-action-btn" data-toggle-news="' + article.id + '" title="Toggle publish"><i class="fas fa-toggle-on"></i></button> ' +
          '<button class="admin-action-btn delete" data-delete-news="' + article.id + '" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</td>' +
        '</tr>';
    }).join('');

    // Attach handlers
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
    feedback.className = '';
    feedback.style.display = 'none';
    form.reset();

    if (id) {
      const article = allNews.find(function (a) { return a.id === id; });
      if (!article) return;
      document.getElementById('news-modal-title').textContent = 'Edit Article';
      document.getElementById('news-id').value = article.id;
      document.getElementById('news-title-input').value = article.title;
      document.getElementById('news-summary-input').value = article.summary;
      document.getElementById('news-content-input').value = article.content;
      document.getElementById('news-image-url').value = article.featured_image || '';
      document.getElementById('news-status-input').value = article.status;
    } else {
      document.getElementById('news-modal-title').textContent = 'Add Article';
      document.getElementById('news-id').value = '';
    }

    newsModal.classList.add('open');
  }

  document.getElementById('news-save-btn')?.addEventListener('click', async function () {
    const id = document.getElementById('news-id').value;
    const title = document.getElementById('news-title-input').value.trim();
    const summary = document.getElementById('news-summary-input').value.trim();
    const content = document.getElementById('news-content-input').value.trim();
    const imageUrl = document.getElementById('news-image-url').value.trim();
    const status = document.getElementById('news-status-input').value;
    const feedback = document.getElementById('news-form-feedback');

    if (!title || !summary || !content) {
      feedback.className = 'admin-login-feedback error-state';
      feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> Title, summary, and content are required.';
      return;
    }

    const payload = {
      title: title,
      summary: summary,
      content: content,
      featured_image: imageUrl || null,
      status: status,
      published_at: status === 'published' ? new Date().toISOString() : null
    };

    try {
      if (id) {
        const { error } = await supabase.from('news_articles').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('news_articles').insert([payload]);
        if (error) throw error;
      }
      newsModal.classList.remove('open');
      loadNews();
    } catch (err) {
      feedback.className = 'admin-login-feedback error-state';
      feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to save: ' + err.message;
    }
  });

  async function toggleNewsPublish(id) {
    const article = allNews.find(function (a) { return a.id === id; });
    if (!article) return;
    const newStatus = article.status === 'published' ? 'draft' : 'published';
    try {
      const { error } = await supabase.from('news_articles').update({
        status: newStatus,
        published_at: newStatus === 'published' ? new Date().toISOString() : null
      }).eq('id', id);
      if (error) throw error;
      loadNews();
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  }

  async function deleteNews(id) {
    if (!confirm('Are you sure you want to delete this article? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('news_articles').delete().eq('id', id);
      if (error) throw error;
      loadNews();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  // ============================================================
  // GALLERY
  // ============================================================
  async function loadGallery() {
    try {
      const { data, error } = await supabase
        .from('gallery_images')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      allGallery = data || [];
      renderGallery();
    } catch (err) {
      console.error('[Admin] Gallery error:', err.message);
    }
  }

  function renderGallery() {
    const grid = document.getElementById('admin-gallery-grid');
    if (!allGallery.length) {
      grid.innerHTML = '<div class="admin-empty-state" style="grid-column: 1/-1;"><i class="fas fa-images"></i><br>No images yet. Click "Upload Image" to add one.</div>';
      return;
    }

    grid.innerHTML = allGallery.map(function (img) {
      return '<div class="admin-gallery-item">' +
        '<img src="' + img.image_url + '" alt="' + escapeHtml(img.caption || '') + '" loading="lazy" />' +
        '<div class="admin-gallery-item-overlay">' +
          '<button class="delete" data-delete-gallery="' + img.id + '" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('[data-delete-gallery]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this image?')) return;
        const id = btn.dataset.deleteGallery;
        const img = allGallery.find(function (g) { return g.id === id; });
        try {
          // Delete from storage if it's in our bucket
          if (img && img.image_url && img.image_url.includes(STORAGE_BUCKET)) {
            const path = img.image_url.split('/' + STORAGE_BUCKET + '/')[1];
            if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
          }
          const { error } = await supabase.from('gallery_images').delete().eq('id', id);
          if (error) throw error;
          loadGallery();
        } catch (err) {
          alert('Failed to delete: ' + err.message);
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
      galleryPreview.style.display = 'none';
      galleryPreview.src = '';
      document.getElementById('gallery-form').reset();
      document.getElementById('gallery-form-feedback').className = '';
      document.getElementById('gallery-form-feedback').style.display = 'none';
      galleryModal.classList.add('open');
    });
  }

  if (galleryDropArea) {
    galleryDropArea.addEventListener('click', function () { galleryFileInput.click(); });
    galleryDropArea.addEventListener('dragover', function (e) {
      e.preventDefault();
      galleryDropArea.classList.add('dragover');
    });
    galleryDropArea.addEventListener('dragleave', function () { galleryDropArea.classList.remove('dragover'); });
    galleryDropArea.addEventListener('drop', function (e) {
      e.preventDefault();
      galleryDropArea.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  if (galleryFileInput) {
    galleryFileInput.addEventListener('change', function () {
      if (this.files.length) handleFileSelect(this.files[0]);
    });
  }

  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      showGalleryFeedback('error-state', 'Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showGalleryFeedback('error-state', 'Image must be under 5MB.');
      return;
    }
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = function (e) {
      galleryPreview.src = e.target.result;
      galleryPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  function showGalleryFeedback(type, message) {
    const fb = document.getElementById('gallery-form-feedback');
    fb.className = 'admin-login-feedback ' + type;
    fb.innerHTML = '<i class="fas ' + (type === 'error-state' ? 'fa-exclamation-circle' : 'fa-check-circle') + '"></i> ' + message;
  }

  document.getElementById('gallery-upload-confirm')?.addEventListener('click', async function () {
    if (!pendingFile) {
      showGalleryFeedback('error-state', 'Please select an image to upload.');
      return;
    }

    const caption = document.getElementById('gallery-caption').value.trim();
    const category = document.getElementById('gallery-category').value;

    const filePath = 'gallery/' + Date.now() + '-' + pendingFile.name.replace(/[^a-zA-Z0-9.\-]/g, '_');

    try {
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, pendingFile, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      const imageUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from('gallery_images').insert([{
        image_url: imageUrl,
        caption: caption || null,
        category: category
      }]);

      if (dbError) throw dbError;

      galleryModal.classList.remove('open');
      loadGallery();
    } catch (err) {
      showGalleryFeedback('error-state', 'Upload failed: ' + err.message);
    }
  });

  // ============================================================
  // SUBSCRIBERS
  // ============================================================
  async function loadSubscribers() {
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });

      if (error) throw error;
      allSubscribers = data || [];
      renderSubscribers();
    } catch (err) {
      console.error('[Admin] Subscribers error:', err.message);
    }
  }

  function renderSubscribers() {
    const search = (document.getElementById('subscribers-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('subscribers-table-body');

    const filtered = allSubscribers.filter(function (s) {
      return !search ||
        s.first_name.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search);
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="admin-empty-state"><i class="fas fa-users"></i><br>No subscribers found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (s) {
      return '<tr><td>' + escapeHtml(s.first_name) + '</td><td>' + escapeHtml(s.email) + '</td><td>' + formatDate(s.subscribed_at) + '</td></tr>';
    }).join('');
  }

  document.getElementById('subscribers-search')?.addEventListener('input', renderSubscribers);

  // CSV Export
  document.getElementById('export-csv-btn')?.addEventListener('click', function () {
    if (!allSubscribers.length) {
      alert('No subscribers to export.');
      return;
    }

    const csv = ['First Name,Email,Date Joined'];
    allSubscribers.forEach(function (s) {
      const name = csvEscape(s.first_name);
      const email = csvEscape(s.email);
      const date = new Date(s.subscribed_at).toISOString();
      csv.push(name + ',' + email + ',' + date);
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newsletter-subscribers-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ============================================================
  // MODAL CLOSE HANDLERS
  // ============================================================
  document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.getElementById(btn.dataset.closeModal).classList.remove('open');
    });
  });

  document.querySelectorAll('.admin-modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // ============================================================
  // UTILITIES
  // ============================================================
  function formatDate(dateStr) {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function csvEscape(str) {
    if (!str) return '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // ============================================================
  // INIT
  // ============================================================
  checkAuth();
})();
