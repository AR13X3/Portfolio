type Theme = { fg: string; muted: string; accent: string };

/** How long the rail names a chapter after it becomes active, before it shrinks back to the bar. */
const ANNOUNCE_MS = 2200;

/**
 * The chapter rail: marks the active section, fills each segment with that
 * chapter's progress and recolours itself to stay legible on every palette.
 */
export function createNav() {
  const nav = document.querySelector<HTMLElement>('[data-progress]');
  const items = new Map<string, { link: HTMLAnchorElement; fill: HTMLElement | null }>();
  nav?.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((link) => {
    items.set(link.dataset.nav!, { link, fill: link.querySelector<HTMLElement>('[data-fill]') });
  });
  const label = nav?.querySelector<HTMLElement>('[data-nav-current]');
  const themes = new Map<string, Theme>();
  let active = '';
  let theme = '';
  let announced: number | undefined;

  const themeOf = (id: string): Theme | undefined => {
    if (themes.has(id)) return themes.get(id);
    const section = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!section) return;
    const cs = getComputedStyle(section);
    const theme = {
      fg: cs.getPropertyValue('--c-fg').trim(),
      muted: cs.getPropertyValue('--c-muted').trim(),
      accent: cs.getPropertyValue('--c-accent').trim(),
    };
    themes.set(id, theme);
    return theme;
  };

  return {
    /** Mark the section being read. Its name shows briefly, then only on hover and focus. */
    setActive(id: string) {
      if (!nav || id === active) return;
      active = id;
      items.forEach(({ link }, key) => {
        if (key === id) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
        link.classList.toggle('is-announced', key === id);
      });
      clearTimeout(announced);
      announced = window.setTimeout(() => items.get(id)?.link.classList.remove('is-announced'), ANNOUNCE_MS);
      if (label) label.textContent = items.get(id)?.link.dataset.name ?? '';
      nav.dataset.active = id;
    },
    /** Take the colours of the section whose ground is on screen. */
    setTheme(id: string) {
      if (!nav || id === theme) return;
      theme = id;
      const t = themeOf(id);
      nav.style.setProperty('--nav-fg', t?.fg ?? '');
      nav.style.setProperty('--nav-muted', t?.muted ?? '');
      nav.style.setProperty('--nav-accent', t?.accent ?? '');
    },
    setProgress(id: string, progress: number) {
      const fill = items.get(id)?.fill;
      fill?.style.setProperty('--p', String(Math.max(0, Math.min(1, progress))));
    },
    onSelect(handler: (id: string) => void) {
      items.forEach(({ link }, id) => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          handler(id);
        });
      });
    },
  };
}
