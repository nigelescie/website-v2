document.addEventListener('DOMContentLoaded', () => {
  const mobileToggle = document.querySelector('.nav-mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  
  if (!mobileToggle || !navLinks) return;

  let isOpen = false;

  function toggleMobileNav() {
    isOpen = !isOpen;
    
    if (isOpen) {
      navLinks.classList.add('active');
      mobileToggle.classList.add('active');
      mobileToggle.setAttribute('aria-expanded', 'true');
    } else {
      navLinks.classList.remove('active');
      mobileToggle.classList.remove('active');
      mobileToggle.setAttribute('aria-expanded', 'false');
    }
  }

  // Toggle on hamburger click
  mobileToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMobileNav();
  });

  // Close when clicking nav links
  navLinks.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && !e.target.closest('.dropdown')) {
      isOpen = true; // Set to true so toggle will close it
      toggleMobileNav();
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !e.target.closest('.nav-container')) {
      isOpen = true; // Set to true so toggle will close it
      toggleMobileNav();
    }
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      isOpen = true; // Set to true so toggle will close it
      toggleMobileNav();
    }
  });

  // Close on window resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 991 && isOpen) {
      isOpen = true; // Set to true so toggle will close it
      toggleMobileNav();
    }
  });
});