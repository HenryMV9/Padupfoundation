/* ============================================================
   PAD UP FOUNDATION - News Page (Listing + Detail)
   Handles /news.html (listing) and /news.html?id=<uuid> (detail)
   Text-only cards — no featured images.
   Uses Supabase Realtime to live-update when articles change.
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initNewsPage() {
  const grid = document.getElementById('news-grid-full');
  const empty = document.getElementById('news-empty-full');
  const listingSection = document.getElementById('news-listing');
  const detailSection = document.getElementById('news-detail-section');
  if (!grid) return;

  let currentDetailId = null;
  let realtimeSetup = false;

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'long', month: 'long', day: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function createNewsCard(article) {
    const card = document.createElement('article');
    card.className = 'news-card news-card-text reveal';
    card.setAttribute('role', 'listitem');

    card.innerHTML =
      '<div class="news-card-body">' +
        '<div class="news-card-date"><i class="far fa-calendar"></i> ' + formatDate(article.published_at || article.created_at) + '</div>' +
        '<h3>' + escapeHtml(article.title) + '</h3>' +
        '<p class="news-card-summary">' + escapeHtml(article.summary) + '</p>' +
        '<a href="news.html?id=' + article.id + '" class="news-card-readmore">Read More <i class="fas fa-arrow-right"></i></a>' +
      '</div>';
    return card;
  }

  async function loadListing() {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        if (empty) empty.style.display = 'block';
        grid.innerHTML = '';
        return;
      }

      if (empty) empty.style.display = 'none';
      grid.innerHTML = '';
      data.forEach(function (article) {
        grid.appendChild(createNewsCard(article));
      });

      triggerReveal();
    } catch (err) {
      console.error('[News Page] Failed to load:', err.message);
      if (empty) {
        empty.innerHTML = '<i class="fas fa-exclamation-circle"></i><p>Unable to load news at this time. Please check back later.</p>';
        empty.style.display = 'block';
      }
    }
  }

  async function loadDetail(id) {
    currentDetailId = id;
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Article deleted or unpublished — go back to listing
        window.history.replaceState({}, document.title, 'news.html');
        if (listingSection) listingSection.style.display = 'block';
        if (detailSection) detailSection.style.display = 'none';
        currentDetailId = null;
        loadListing();
        return;
      }

      if (listingSection) listingSection.style.display = 'none';
      if (detailSection) detailSection.style.display = 'block';

      var titleEl = document.getElementById('news-detail-title');
      var dateEl = document.getElementById('news-detail-date');
      var bodyEl = document.getElementById('news-detail-body');
      if (titleEl) titleEl.textContent = data.title;
      if (dateEl) dateEl.textContent = formatDate(data.published_at || data.created_at);
      if (bodyEl) bodyEl.innerHTML = data.content;
      document.title = data.title + ' \u2014 Pad Up Foundation';
    } catch (err) {
      console.error('[News Detail] Failed to load:', err.message);
      window.history.replaceState({}, document.title, 'news.html');
      if (listingSection) listingSection.style.display = 'block';
      if (detailSection) detailSection.style.display = 'none';
      currentDetailId = null;
      loadListing();
    }
  }

  function triggerReveal() {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    grid.querySelectorAll('.news-card').forEach(function (el) { observer.observe(el); });
  }

  // ============================================================
  // REALTIME — live-update listing when articles change
  // ============================================================
  function setupRealtime() {
    if (realtimeSetup) return;
    realtimeSetup = true;

    supabase
      .channel('news-page-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_articles' }, function (payload) {
        console.log('[Realtime] News article changed on frontend:', payload.eventType);

        // If viewing detail and the article was deleted or unpublished, go back to listing
        if (currentDetailId && (payload.eventType === 'DELETE' || payload.eventType === 'UPDATE')) {
          if (payload.eventType === 'DELETE' && payload.old && payload.old.id === currentDetailId) {
            window.history.replaceState({}, document.title, 'news.html');
            if (listingSection) listingSection.style.display = 'block';
            if (detailSection) detailSection.style.display = 'none';
            currentDetailId = null;
            loadListing();
            return;
          }
          if (payload.eventType === 'UPDATE' && payload.new && payload.new.id === currentDetailId) {
            if (payload.new.status !== 'published') {
              window.history.replaceState({}, document.title, 'news.html');
              if (listingSection) listingSection.style.display = 'block';
              if (detailSection) detailSection.style.display = 'none';
              currentDetailId = null;
              loadListing();
              return;
            }
            // Content was edited — refresh detail view
            var titleEl = document.getElementById('news-detail-title');
            var dateEl = document.getElementById('news-detail-date');
            var bodyEl = document.getElementById('news-detail-body');
            if (titleEl) titleEl.textContent = payload.new.title;
            if (dateEl) dateEl.textContent = formatDate(payload.new.published_at || payload.new.created_at);
            if (bodyEl) bodyEl.innerHTML = payload.new.content;
            return;
          }
        }

        // Always reload the listing to reflect changes
        if (!currentDetailId) {
          loadListing();
        }
      })
      .subscribe();
  }

  // ============================================================
  // INIT
  // ============================================================
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('id');

  if (articleId) {
    loadDetail(articleId);
  } else {
    loadListing();
  }

  setupRealtime();
})();
