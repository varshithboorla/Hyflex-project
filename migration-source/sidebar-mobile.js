(function () {
  'use strict';

  function initMobileSidebars() {
    document.querySelectorAll('.dashboard').forEach((dashboard) => {
      const sidebar = dashboard.querySelector(':scope > .sidebar');
      if (!sidebar || sidebar.dataset.mobileSidebarReady === 'true') return;
      sidebar.dataset.mobileSidebarReady = 'true';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'sidebar-mobile-toggle';
      toggle.setAttribute('aria-label', 'Open navigation menu');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', sidebar.id || 'mobile-navigation');
      if (!sidebar.id) sidebar.id = 'mobile-navigation-' + Math.random().toString(36).slice(2, 8);
      toggle.innerHTML = window.ELIcon ? window.ELIcon('menu') :
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

      const backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.className = 'sidebar-mobile-backdrop';
      backdrop.setAttribute('aria-label', 'Close navigation menu');
      backdrop.tabIndex = -1;

      dashboard.appendChild(toggle);
      dashboard.appendChild(backdrop);

      let previousFocus = null;

      const isMobile = () => window.matchMedia('(max-width: 800px)').matches;

      const setIcon = (name) => {
        toggle.innerHTML = window.ELIcon ? window.ELIcon(name) :
          (name === 'close'
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>');
      };

      const close = ({ restoreFocus = true } = {}) => {
        dashboard.classList.remove('sidebar-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation menu');
        setIcon('menu');
        document.body.classList.remove('sidebar-menu-open');
        if (restoreFocus && previousFocus && typeof previousFocus.focus === 'function') {
          requestAnimationFrame(() => previousFocus.focus({ preventScroll: true }));
        }
        previousFocus = null;
      };

      const open = () => {
        if (!isMobile()) return;
        previousFocus = document.activeElement;
        dashboard.classList.add('sidebar-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close navigation menu');
        setIcon('close');
        document.body.classList.add('sidebar-menu-open');

        // Focus the first usable navigation control after the drawer is painted.
        requestAnimationFrame(() => {
          const first = sidebar.querySelector('.nav-btn, .logout-btn');
          if (first) first.focus({ preventScroll: true });
        });
      };

      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dashboard.classList.contains('sidebar-open') ? close() : open();
      });

      backdrop.addEventListener('click', (event) => {
        event.preventDefault();
        close();
      });

      sidebar.querySelectorAll('.nav-btn, .logout-btn').forEach((button) => {
        button.addEventListener('click', () => {
          if (isMobile()) close({ restoreFocus: false });
        });
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && dashboard.classList.contains('sidebar-open')) {
          event.preventDefault();
          close();
        }
      });

      window.addEventListener('resize', () => {
        if (!isMobile() && dashboard.classList.contains('sidebar-open')) {
          close({ restoreFocus: false });
        }
      });

      // Ensure the drawer is closed whenever a page starts/reloads.
      close({ restoreFocus: false });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileSidebars, { once: true });
  } else {
    initMobileSidebars();
  }
})();
