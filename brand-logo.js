(() => {
  function scaleBrandLogo(logo) {
    const top = logo.querySelector('.brand-logo-top');
    const bottom = logo.querySelector('.brand-logo-bottom');
    if (!top || !bottom) return;

    bottom.style.transform = 'scaleX(1)';
    const topWidth = top.offsetWidth;
    const bottomWidth = bottom.offsetWidth;
    if (!topWidth || !bottomWidth) return;

    bottom.style.transform = `scaleX(${topWidth / bottomWidth})`;
  }

  function scaleAllBrandLogos() {
    document.querySelectorAll('.brand-logo').forEach(scaleBrandLogo);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scaleAllBrandLogos, { once: true });
  } else {
    scaleAllBrandLogos();
  }

  window.addEventListener('resize', scaleAllBrandLogos);
})();
