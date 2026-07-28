/* ============================================================
   PAD UP FOUNDATION - News Page (Listing + Detail)
   Handles /news.html (listing) and /news.html?id=<uuid> (detail)
   Text-only cards — no featured images.
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initNewsPage() {
  const grid = document.getElementById('news-grid-full');
  const empty = document.getElementById('news-empty-full');
  const listingSection = document.getElementById('news-listing');
  const detailSection = document.getElementById('news-detail-section');
  if (!grid) return;

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

    card.innerHTML = `
      <div class="news-card-body">
        <div class="news-card-date"><i class="far fa-calendar"></i> ${formatDate(article.published_at || article.created_at)}</div>
        <h3>${escapeHtml(article.title)}</h3>
        <p class="news-card-summary">${escapeHtml(article.summary)}</p>
        <a href="news.html?id=${article.id}" class="news-card-readmore">Read More <i class="fas fa-arrow-right"></i></a>
      </div>
    `;
    return card;
  }

  async function loadListing() {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        if (empty) empty.style.display = 'block';
        return;
      }

      if (empty) empty.style.display = 'none';
      grid.innerHTML = '';
      data.forEach(function (article) {
        grid.appendChild(createNewsCard(article));
      });

      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      grid.querySelectorAll('.news-card').forEach(function (el) { observer.observe(el); });
    } catch (err) {
      console.error('[News Page] Failed to load:', err.message);
      if (empty) {
        empty.innerHTML = '<i class="fas fa-exclamation-circle"></i><p>Unable to load news at this time. Please check back later.</p>';
        empty.style.display = 'block';
      }
    }
  }

  async function loadDetail(id) {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        loadListing();
        return;
      }

      listingSection.style.display = 'none';
      detailSection.style.display = 'block';

      document.getElementById('news-detail-title').textContent = data.title;
      document.getElementById('news-detail-date').textContent = formatDate(data.published_at || data.created_at);
      document.getElementById('news-detail-body').innerHTML = data.content;
      document.title = data.title + ' \u2014 Pad Up Foundation';
    } catch (err) {
      console.error('[News Detail] Failed to load:', err.message);
      loadListing();
    }
  }

  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('id');

  if (articleId) {
    loadDetail(articleId);
  } else {
    loadListing();
  }
})();
