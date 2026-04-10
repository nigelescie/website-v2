document.addEventListener('DOMContentLoaded', () => {
  const dropdown = document.querySelector('.dropdown');
  const toggle = document.querySelector('.dropdown-toggle');
  const menu = document.querySelector('.dropdown-menu');
  
  if (!dropdown || !toggle || !menu) return;

  let isOpen = false;

  function openDropdown() {
    isOpen = true;
    dropdown.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    menu.removeAttribute('hidden');
  }

  function closeDropdown() {
    isOpen = false;
    dropdown.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.setAttribute('hidden', '');
  }

  // Initialize closed
  closeDropdown();

  // Toggle on click
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      closeDropdown();
    }
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDropdown();
    }
  });
});