// All DOM/UI behaviour: header state, nav, reveal, modal, form, card glow.

import { PROJECTS } from './data.js';
import { $, $$, escapeHtml, prefersReducedMotion } from './utils.js';

let dialog, modalTitle, modalKicker, modalBody, modalActions;
let lastFocused = null;

export function initUI() {
  initYear();
  initHeaderScroll();
  initActiveNav();
  initReveal();
  initModal();
  initCardGlow();
  initContactForm();

  // scene.js dispatches this when a 3D node is clicked.
  window.addEventListener('scene:open-project', (e) => {
    openProject(e.detail?.index);
  });
}

/* ---------- footer year ---------- */
function initYear() {
  const el = $('#year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ---------- header shadow on scroll ---------- */
function initHeaderScroll() {
  const header = $('#header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- active nav link via IntersectionObserver ---------- */
function initActiveNav() {
  const navLinks = $$('.nav-list a');
  const sections = navLinks
    .map(a => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);

  if (!('IntersectionObserver' in window) || !sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(a => {
        a.setAttribute(
          'aria-current',
          a.getAttribute('href') === `#${entry.target.id}` ? 'true' : 'false'
        );
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  sections.forEach(el => observer.observe(el));
}

/* ---------- scroll reveal ---------- */
function initReveal() {
  const els = $$('[data-reveal]');
  if (!els.length) return;

  // Respect reduced motion or missing IO: show everything immediately.
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      entry.target.style.transitionDelay = `${Math.min(i * 70, 280)}ms`;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  els.forEach(el => observer.observe(el));
}

/* ---------- project modal (uses native <dialog>) ---------- */
function initModal() {
  dialog       = $('#project-dialog');
  modalTitle   = $('#modal-title');
  modalKicker  = $('#modal-kicker');
  modalBody    = $('#modal-content');
  modalActions = $('#modal-actions');

  if (!dialog) return;

  $$('[data-project]').forEach(card => {
    card.addEventListener('click', () => openProject(Number(card.dataset.project)));
  });

  $$('[data-close]', dialog).forEach(btn => {
    btn.addEventListener('click', closeProject);
  });

  // Click outside the visible panel closes the dialog.
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top  && e.clientY <= r.bottom;
    if (!inside) closeProject();
  });

  dialog.addEventListener('close', () => {
    if (lastFocused) lastFocused.focus();
  });
}

function openProject(index) {
  const p = PROJECTS[index];
  if (!p || !dialog) return;

  lastFocused = document.activeElement;

  modalKicker.textContent = p.kicker;
  modalTitle.textContent  = p.title;

  modalBody.innerHTML =
    p.body.map(par => `<p>${escapeHtml(par)}</p>`).join('') +
    `<ul class="tag-row">${p.tags.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;

  modalActions.innerHTML = (p.links || [])
    .map(l => `<a class="btn" href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`)
    .join('');

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  $('[data-close]', dialog)?.focus();
}

function closeProject() {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  if (lastFocused) lastFocused.focus();
}

/* ---------- cursor-following glow on project cards ---------- */
function initCardGlow() {
  $$('.project-card').forEach(card => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

/* ---------- contact form (Formspree) ---------- */
function initContactForm() {
  const form   = $('#contact-form');
  const status = $('#form-status');
  if (!form || !status) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.textContent = '';
    status.removeAttribute('data-state');

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      form.reset();
      status.textContent = "Thanks — your message is on its way. I'll reply soon.";
      status.dataset.state = 'ok';
    } catch (err) {
      console.error(err);
      status.textContent = 'Something went wrong. Email me directly at hello@example.com.';
      status.dataset.state = 'err';
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}