/* ============================================================
   PAD UP FOUNDATION - Gallery & Lightbox
   ============================================================ */

(function initGallery() {
  /* ----- Lightbox ----- */
  const lightbox = document.querySelector('.lightbox');
  const lightboxImg = document.querySelector('.lightbox-img');
  const closeBtn = document.querySelector('.lightbox-close');
  const prevBtn = document.querySelector('.lightbox-nav.prev');
  const nextBtn = document.querySelector('.lightbox-nav.next');

  if (!lightbox || !lightboxImg) return;

  let currentIndex = 0;
  let images = [];

  function openLightbox(index) {
    currentIndex = index;
    lightboxImg.src = images[index].src;
    lightboxImg.alt = images[index].alt || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { lightboxImg.src = ''; }, 350);
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    lightboxImg.style.opacity = '0';
    setTimeout(function () {
      lightboxImg.src = images[currentIndex].src;
      lightboxImg.style.opacity = '1';
    }, 200);
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % images.length;
    lightboxImg.style.opacity = '0';
    setTimeout(function () {
      lightboxImg.src = images[currentIndex].src;
      lightboxImg.style.opacity = '1';
    }, 200);
  }

  lightboxImg.style.transition = 'opacity 0.2s ease';

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', showPrev);
  if (nextBtn) nextBtn.addEventListener('click', showNext);

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });

  /* ----- Attach to gallery items ----- */
  function refreshGalleryItems() {
    const items = document.querySelectorAll('[data-lightbox]');
    images = [];
    items.forEach(function (item, i) {
      const img = item.querySelector('img') || item;
      images.push({ src: item.dataset.lightbox || img.src, alt: img.alt || '' });
      item.addEventListener('click', function () { openLightbox(i); });
    });
  }

  refreshGalleryItems();

  /* ----- Filter buttons ----- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('[data-category]');

  if (filterBtns.length && galleryItems.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        const filter = btn.dataset.filter;

        galleryItems.forEach(function (item) {
          if (filter === 'all' || item.dataset.category === filter) {
            item.style.display = '';
            item.style.opacity = '0';
            item.style.transform = 'scale(0.95)';
            requestAnimationFrame(function () {
              item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
              item.style.opacity = '1';
              item.style.transform = 'scale(1)';
            });
          } else {
            item.style.transition = 'opacity 0.3s ease';
            item.style.opacity = '0';
            setTimeout(function () { item.style.display = 'none'; }, 300);
          }
        });

        /* Refresh lightbox image array after filter */
        setTimeout(refreshGalleryItems, 400);
      });
    });
  }
})();
