/* Copy-to-clipboard for bank account numbers */
(function initCopyClipboard() {
  function showToast(message) {
    var existing = document.querySelector('.copy-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
    }, 2000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(textarea);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;

    var text = btn.getAttribute('data-copy');
    if (!text) return;

    copyText(text);

    var originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.classList.add('copied');
    showToast('Account number copied: ' + text);

    setTimeout(function () {
      btn.innerHTML = originalHTML;
      btn.classList.remove('copied');
    }, 2000);
  });

  document.addEventListener('click', function (e) {
    var account = e.target.closest('.copyable-account');
    if (!account) return;
    var range = document.createRange();
    range.selectNodeContents(account);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
})();
