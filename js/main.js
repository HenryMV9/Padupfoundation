/* ============================================================
   PAD UP FOUNDATION - Main JavaScript
   ============================================================ */

/* --- Navigation --- */
(function initNav() {
  const navbar = document.querySelector('.navbar');
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.navbar-nav');

  if (!navbar) return;

  let ticking = false;

  function updateNav() {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
      navbar.classList.remove('transparent');
    } else {
      navbar.classList.remove('scrolled');
      navbar.classList.add('transparent');
    }
    ticking = false;
  }

  updateNav();

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(updateNav);
      ticking = true;
    }
  }, { passive: true });

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      navToggle.classList.toggle('open');
      navMenu.classList.toggle('open');
      document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
    });

    document.addEventListener('click', function (e) {
      if (!navbar.contains(e.target)) {
        navToggle.classList.remove('open');
        navMenu.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  const links = navbar.querySelectorAll('.nav-link:not(.nav-donate)');
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  links.forEach(function (link) {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
})();

/* --- Hero Slideshow --- */
(function initHeroSlideshow() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;

  let current = 0;
  let timer;
  let transitioning = false;

  function goToSlide(index) {
    if (transitioning) return;
    if (index === current) return;
    transitioning = true;

    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');

    current = (index + slides.length) % slides.length;

    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');

    setTimeout(function () { transitioning = false; }, 1500);
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(function () { goToSlide(current + 1); }, 5000);
  }

  function stopAutoplay() { clearInterval(timer); }

  slides[0].classList.add('active');
  if (dots[0]) dots[0].classList.add('active');
  startAutoplay();

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      stopAutoplay();
      goToSlide(i);
      startAutoplay();
    });
  });

  var hero = document.querySelector('.hero');
  if (hero) {
    var touchStartX = 0;
    hero.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
      stopAutoplay();
    }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      var diff = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(diff) > 50) {
        goToSlide(diff > 0 ? current - 1 : current + 1);
      }
      startAutoplay();
    }, { passive: true });
    hero.addEventListener('mouseenter', stopAutoplay);
    hero.addEventListener('mouseleave', startAutoplay);
  }
})();

/* --- Scroll Reveal (IntersectionObserver — no scroll cost) --- */
(function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal, .stagger');
  if (!reveals.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(function (el) { observer.observe(el); });
})();

/* --- Impact Counters --- */
(function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';
    const duration = 2000;
    const startTime = performance.now();

    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      el.textContent = prefix + Math.round(easeOutQuart(progress) * target).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(function (c) { observer.observe(c); });
})();

/* --- Back to Top (throttled) --- */
(function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  let ticking = false;

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        btn.classList.toggle('visible', window.scrollY > 500);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* --- Lazy load images --- */
(function initLazyLoad() {
  const imgs = document.querySelectorAll('img[data-src]');
  if (!imgs.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });

  imgs.forEach(function (img) { observer.observe(img); });
})();

document.body.classList.add('page-enter');
