/* ============================================================
   PAD UP FOUNDATION - Gallery & Lightbox (Mobile-optimized)
   ============================================================ */

(function initGallery() {
  var lightbox = document.querySelector('.lightbox');
  var lightboxImg = document.querySelector('.lightbox-img');
  var closeBtn = document.querySelector('.lightbox-close');
  var prevBtn = document.querySelector('.lightbox-nav.prev');
  var nextBtn = document.querySelector('.lightbox-nav.next');

  if (!lightbox || !lightboxImg) return;

  var currentIndex = 0;
  var images = [];
  var touchStartX = 0;
  var touchDiff = 0;

  var counter = document.createElement('div');
  counter.className = 'lightbox-counter';
  lightbox.querySelector('.lightbox-content').appendChild(counter);

  function updateCounter() {
    counter.textContent = (currentIndex + 1) + ' / ' + images.length;
  }

  function openLightbox(index) {
    currentIndex = index;
    lightboxImg.src = images[index].src;
    lightboxImg.alt = images[index].alt || '';
    updateCounter();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { lightboxImg.src = ''; }, 300);
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
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

  function refreshGalleryItems() {
    var items = document.querySelectorAll('[data-lightbox]');
    images = [];
    items.forEach(function (item, i) {
      var img = item.querySelector('img') || item;
      images.push({ src: item.dataset.lightbox || img.src, alt: img.alt || '' });

      item.removeEventListener('click', item._lightboxHandler);
      item._lightboxHandler = function () { openLightbox(i); };
      item.addEventListener('click', item._lightboxHandler);
    });
  }

  refreshGalleryItems();

  var filterBtns = document.querySelectorAll('.filter-btn');
  var galleryItems = document.querySelectorAll('[data-category]');

  if (filterBtns.length && galleryItems.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        var filter = btn.dataset.filter;

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
      });
    });
  }
})();
