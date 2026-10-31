import { buzz, sfx } from './sound';

/**
 * Every email link (the intros' top bars, Contact) also copies the address, and says so for a
 * moment under the link: a mailto: link does nothing where no mail app is set up, which is most
 * desktops that use webmail. The link still opens the mail app where there is one.
 */

const SHOW = 1600;
let tag: HTMLElement | null = null;
let said: HTMLElement | null = null;
let hide = 0;

function mount() {
  tag = document.createElement('div');
  tag.className = 'copied';
  tag.setAttribute('aria-hidden', 'true');
  tag.textContent = 'Copied';
  said = document.createElement('p');
  said.className = 'visually-hidden';
  said.setAttribute('aria-live', 'polite');
  document.body.append(tag, said);
}

function show(link: HTMLElement) {
  if (!tag) mount();
  const r = link.getBoundingClientRect();
  const w = tag!.offsetWidth;
  const x = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
  // Under the link, or over it when it sits low on the screen.
  const below = r.bottom + 8 + 32 < innerHeight;
  Object.assign(tag!.style, { left: `${x}px`, top: below ? `${r.bottom + 8}px` : `${r.top - 8 - tag!.offsetHeight}px` });
  tag!.classList.remove('is-on');
  void tag!.offsetWidth; // restart the fade on a second click
  tag!.classList.add('is-on');
  said!.textContent = '';
  setTimeout(() => (said!.textContent = 'Email address copied'), 60);
  clearTimeout(hide);
  hide = window.setTimeout(() => tag!.classList.remove('is-on'), SHOW);
}

document.addEventListener('click', (e) => {
  const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="mailto:"]');
  if (!link || !navigator.clipboard) return;
  const address = decodeURIComponent(link.href.slice('mailto:'.length).split('?')[0]);
  navigator.clipboard.writeText(address).then(
    () => {
      show(link);
      sfx.press();
      buzz('press');
    },
    () => {},
  );
});
