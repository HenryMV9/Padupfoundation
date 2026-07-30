/* ============================================================
   PAD UP FOUNDATION - Dynamic Gallery Loader
   Loads images from Supabase and appends them to the existing
   static gallery items on gallery.html.
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initDynamicGallery() {
  const grid = document.getElementById('masonry-grid');
  if (!grid) return;

  async function loadDynamicImages() {
    try {
      const { data, error } = await supabase
        .from('gallery_images')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return;

      // Append dynamically loaded images
      data.forEach(function (img) {
        const item = document.createElement('div');
        item.className = 'masonry-item reveal';
        item.dataset.category = img.category || 'outreach';
        item.dataset.lightbox = img.image_url;
        item.setAttribute('role', 'listitem');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', 'View: ' + (img.caption || 'Gallery image'));
        item.innerHTML = '<img src="' + img.image_url + '" alt="' + escapeAttr(img.caption || 'Gallery image') + '" loading="lazy" /><div class="masonry-item-overlay"><i class="fas fa-expand" aria-hidden="true"></i></div>';
        grid.appendChild(item);
      });

      // Re-trigger scroll reveal
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      grid.querySelectorAll('.masonry-item:not(.revealed)').forEach(function (el) { observer.observe(el); });

      // Refresh lightbox items
      window.dispatchEvent(new CustomEvent('gallery:refresh'));
    } catch (err) {
      console.error('[Gallery] Failed to load dynamic images:', err.message);
    }
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  loadDynamicImages();
})();
