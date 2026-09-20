const hero = document.querySelector(matchMedia('(max-width: 600px)').matches ? '#mobile-hero-cta' : '#hero-cta');
const sticky = document.querySelector('.mobile-cta');
if (hero && sticky && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => { sticky.hidden = entry.isIntersecting; }).observe(hero);
}
