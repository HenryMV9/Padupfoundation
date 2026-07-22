/* ============================================================
   PAD UP FOUNDATION - Custom Cursor
   Premium trailing dot + ring cursor with easing.
   Auto-disabled on touch devices.
   ============================================================ */

(function initCustomCursor() {
  // Skip on touch devices / small screens
  if (window.matchMedia('(hover: none)').matches || window.matchMedia('(max-width: 1024px)').matches) {
    return;
  }

  var dot = document.createElement('div');
  dot.className = 'cursor-dot';
  var ring = document.createElement('div');
  ring.className = 'cursor-ring';

  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.body.classList.add('cursor-hidden');

  var mouseX = 0, mouseY = 0;
  var ringX = 0, ringY = 0;
  var dotX = 0, dotY = 0;
  var rafId = null;

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  function animate() {
    // Dot follows quickly
    dotX += (mouseX - dotX) * 0.5;
    dotY += (mouseY - dotY) * 0.5;
    dot.style.left = dotX + 'px';
    dot.style.top = dotY + 'px';

    // Ring follows with easing
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';

    rafId = requestAnimationFrame(animate);
  }

  animate();

  // Hover detection on interactive elements
  var hoverSelector = 'a, button, input, textarea, select, .mission-card, .value-card, .testimonial-card, .involvement-card, .gallery-item, .masonry-item, .instagram-item, .news-card, .nav-link, .social-link, .filter-btn, .amount-btn, .impact-card-sm, [data-lightbox]';

  document.addEventListener('mouseover', function (e) {
    if (e.target.closest(hoverSelector)) {
      dot.classList.add('hovering');
      ring.classList.add('hovering');
    }
  }, { passive: true });

  document.addEventListener('mouseout', function (e) {
    if (e.target.closest(hoverSelector)) {
      dot.classList.remove('hovering');
      ring.classList.remove('hovering');
    }
  }, { passive: true });

  // Hide cursor when leaving window
  document.addEventListener('mouseleave', function () {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });

  document.addEventListener('mouseenter', function () {
    dot.style.opacity = '1';
    ring.style.opacity = '0.5';
  });

  // Cursor down state
  document.addEventListener('mousedown', function () {
    ring.style.transform = 'translate(-50%, -50%) scale(0.85)';
  });

  document.addEventListener('mouseup', function () {
    ring.style.transform = 'translate(-50%, -50%) scale(1)';
  });
})();
