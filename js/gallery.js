/* ============================================================
   PAD UP FOUNDATION - Gallery (Lightbox, Filters, Dynamic Loader)
   Single source of truth: all images come from Supabase.
   Uses Realtime to live-update when images are added or deleted.
   ============================================================ */

import { supabase } from './supabase-client.js';

(function initGallery() {
  var lightbox = document.querySelector('.lightbox');
  var lightboxImg = document.querySelector('.lightbox-img');
  var closeBtn = document.querySelector('.lightbox-close');
  var prevBtn = document.querySelector('.lightbox-nav.prev');
  var nextBtn = document.querySelector('.lightbox-nav.next');
  var grid = document.getElementById('masonry-grid');

  if (!grid) return;

  // ============================================================
  // LIGHTBOX STATE (hoisted to IIFE scope so refreshGalleryItems can access)
  // ============================================================
  var currentIndex = 0;
  var images = [];
  var touchStartX = 0;
  var touchDiff = 0;
  var counter = null;

  if (lightbox && lightboxImg) {
    var contentEl = lightbox.querySelector('.lightbox-content');
    if (contentEl) {
      counter = document.createElement('div');
      counter.className = 'lightbox-counter';
      contentEl.appendChild(counter);
    }
  }

  function updateCounter() {
    if (counter) counter.textContent = (currentIndex + 1) + ' / ' + images.length;
  }

  function openLightbox(index) {
    if (!lightbox || !lightboxImg) return;
    currentIndex = index;
    lightboxImg.src = images[index].src;
    lightboxImg.alt = images[index].alt || '';
    updateCounter();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { if (lightboxImg) lightboxImg.src = ''; }, 300);
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    if (!lightboxImg) return;
    lightboxImg.style.opacity = '0';
    lightboxImg.style.transform = 'scale(0.96) translateX(20px)';
    setTimeout(function () {
      lightboxImg.src = images[currentIndex].src;
      lightboxImg.alt = images[currentIndex].alt || '';
      lightboxImg.style.opacity = '1';
      lightboxImg.style.transform = 'scale(1) translateX(0)';
      updateCounter();
    }, 180);
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % images.length;
    if (!lightboxImg) return;
    lightboxImg.style.opacity = '0';
    lightboxImg.style.transform = 'scale(0.96) translateX(-20px)';
    setTimeout(function () {
      lightboxImg.src = images[currentIndex].src;
      lightboxImg.alt = images[currentIndex].alt || '';
      lightboxImg.style.opacity = '1';
      lightboxImg.style.transform = 'scale(1) translateX(0)';
      updateCounter();
    }, 180);
  }

  if (lightbox && lightboxImg) {
    lightboxImg.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', showPrev);
    if (nextBtn) nextBtn.addEventListener('click', showNext);

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target === lightbox.querySelector('.lightbox-content')) closeLightbox();
    });

    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    });

    lightbox.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (e) {
      touchDiff = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(touchDiff) > 50) {
        if (touchDiff > 0) showPrev();
        else showNext();
      }
    }, { passive: true });
  }

  // ============================================================
  // LIGHTBOX ITEM BINDING
  // ============================================================
  function refreshGalleryItems() {
    var items = document.querySelectorAll('[data-lightbox]');
    images = [];
    items.forEach(function (item, i) {
      var img = item.querySelector('img') || item;
      images.push({ src: item.dataset.lightbox || img.src, alt: img.alt || '' });

      item.removeEventListener('click', item._lightboxHandler);
      item._lightboxHandler = function () { openLightbox(i); };
      item.addEventListener('click', item._lightboxHandler);

      item.removeEventListener('keydown', item._lightboxKeyHandler);
      item._lightboxKeyHandler = function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i); }
      };
      item.addEventListener('keydown', item._lightboxKeyHandler);
    });
  }

  refreshGalleryItems();
  window.addEventListener('gallery:refresh', refreshGalleryItems);

  // ============================================================
  // CATEGORY FILTERS
  // ============================================================
  var filterBtns = document.querySelectorAll('.filter-btn');
  var activeFilter = 'all';

  function applyFilter(filter) {
    var galleryItems = document.querySelectorAll('[data-category]');
    galleryItems.forEach(function (item) {
      if (filter === 'all' || item.dataset.category === filter) {
        item.style.display = '';
        item.style.opacity = '0';
        item.style.transform = 'scale(0.96)';
        requestAnimationFrame(function () {
          item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
          item.style.opacity = '1';
          item.style.transform = 'scale(1)';
        });
      } else {
        item.style.transition = 'opacity 0.25s ease';
        item.style.opacity = '0';
        setTimeout(function () { item.style.display = 'none'; }, 250);
      }
    });
    setTimeout(refreshGalleryItems, 350);
  }

  if (filterBtns.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        activeFilter = btn.dataset.filter;
        applyFilter(activeFilter);
      });
    });
  }

  window.addEventListener('gallery:refresh', function () {
    if (activeFilter && activeFilter !== 'all') {
      applyFilter(activeFilter);
    }
  });

  // ============================================================
  // DYNAMIC IMAGE LOADER (from Supabase)
  // ============================================================
  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function loadDynamicImages() {
    try {
      const { data, error } = await supabase
        .from('gallery_images')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      grid.innerHTML = '';

      if (!data || data.length === 0) {
        grid.innerHTML = '<div class="admin-empty-state" style="grid-column: 1/-1;"><i class="fas fa-images" style="font-size:2.5rem;color:var(--gray-300);margin-bottom:1rem;"></i><p>No images in the gallery yet.</p></div>';
        window.dispatchEvent(new CustomEvent('gallery:refresh'));
        return;
      }

      data.forEach(function (img) {
        const item = document.createElement('div');
        item.className = 'masonry-item reveal';
        item.dataset.category = img.category || 'outreach';
        item.dataset.lightbox = img.image_url;
        item.setAttribute('role', 'listitem');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', 'View: ' + (img.caption || 'Gallery image'));
        item.innerHTML =
          '<img src="' + img.image_url + '" alt="' + escapeAttr(img.caption || 'Gallery image') + '" loading="lazy" />' +
          '<div class="masonry-item-overlay"><i class="fas fa-expand" aria-hidden="true"></i></div>';
        grid.appendChild(item);
      });

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      grid.querySelectorAll('.masonry-item:not(.revealed)').forEach(function (el) { observer.observe(el); });

      window.dispatchEvent(new CustomEvent('gallery:refresh'));
    } catch (err) {
      console.error('[Gallery] Failed to load images:', err.message);
      grid.innerHTML = '<div class="admin-empty-state" style="grid-column: 1/-1;"><i class="fas fa-exclamation-circle" style="font-size:2.5rem;color:var(--gray-300);margin-bottom:1rem;"></i><p>Unable to load gallery images. Please check back later.</p></div>';
    }
  }

  // ============================================================
  // REALTIME
  // ============================================================
  supabase
    .channel('gallery-page-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_images' }, function (payload) {
      console.log('[Realtime] Gallery image changed on frontend:', payload.eventType);
      loadDynamicImages();
    })
    .subscribe();

  loadDynamicImages();
})();
