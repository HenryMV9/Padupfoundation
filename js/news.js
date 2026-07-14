/* ============================================================
   PAD UP FOUNDATION - News & Updates
   Loads published news from Supabase and renders cards.
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initNews() {
  const newsGrid = document.getElementById('news-grid');
  const newsEmpty = document.getElementById('news-empty');
  if (!newsGrid) return;

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function createNewsCard(article) {
    const card = document.createElement('article');
    card.className = 'news-card';
    card.setAttribute('role', 'listitem');

    const imageHtml = article.featured_image
      ? `<div class="news-card-image"><img src="${article.featured_image}" alt="${article.title}" loading="lazy" /></div>`
      : `<div class="news-card-image" style="background: var(--gradient-primary); display: flex; align-items: center; justify-content: center;"><i class="fas fa-newspaper" style="font-size: 2rem; color: rgba(255,255,255,0.5);"></i></div>`;

    card.innerHTML = `
      ${imageHtml}
      <div class="news-card-body">
        <div class="news-card-date"><i class="far fa-calendar"></i> ${formatDate(article.published_at || article.created_at)}</div>
        <h3>${article.title}</h3>
        <p class="news-card-summary">${article.summary}</p>
        <a href="news.html?id=${article.id}" class="news-card-readmore">Read More <i class="fas fa-arrow-right"></i></a>
      </div>
    `;
    return card;
  }

  async function loadNews() {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      if (!data || data.length === 0) {
        if (newsEmpty) newsEmpty.style.display = 'block';
        return;
      }

      if (newsEmpty) newsEmpty.style.display = 'none';
      newsGrid.innerHTML = '';
      data.forEach(function (article) {
        newsGrid.appendChild(createNewsCard(article));
      });

      // Re-trigger scroll reveal for new elements
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      newsGrid.querySelectorAll('.news-card').forEach(function (el) { observer.observe(el); });
    } catch (err) {
      console.error('[News] Failed to load:', err.message);
      if (newsEmpty) {
        newsEmpty.innerHTML = '<i class="fas fa-exclamation-circle"></i><p>Unable to load news at this time. Please check back later.</p>';
        newsEmpty.style.display = 'block';
      }
    }
  }

  loadNews();
})();
