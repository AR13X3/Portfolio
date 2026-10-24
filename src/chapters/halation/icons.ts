// Halation's inline icons (halation/js/ui/icons.js, AGPL-3.0, by AR13X3): 20×20, stroke = currentColor.
// Only the ones the chapter's recreated editor shows.
const dots = (pts: number[][]) =>
  `<g fill="currentColor" stroke="none">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;

export const ICONS: Record<string, string> = {
  silk: '<path d="M2 13c3-6 6 2 9-4s5-4 7-6"/><path d="M2 17.5c3-6 6 2 9-4s5-4 7-6" opacity=".55"/>',
  none: '<circle cx="10" cy="10" r="7"/><path d="M5 15L15 5"/>',
  bands: '<path d="M3 17L17 3" stroke-width="3" opacity=".35"/><path d="M3 11L11 3M9 17l8-8"/>',
  mesh: '<circle cx="7" cy="8" r="4.2"/><circle cx="13" cy="12.5" r="4.8" opacity=".6"/>',
  ribbons: '<path d="M2 6c4-3 8 3 16 0M2 10c4-3 8 3 16 0M2 14c4-3 8 3 16 0"/>',
  threads: '<path d="M2 3.5C7 8.5 13 8.5 18 3.5M2 10h16M2 16.5c5-5 11-5 16 0"/><path d="M2 6.8c5 3 11 3 16 0M2 13.2c5-3 11-3 16 0" stroke-width="1" opacity=".55"/>',
  fluid: '<path d="M10 2.5c3 4 5.5 6.6 5.5 9.8a5.5 5.5 0 0 1-11 0C4.5 9.1 7 6.5 10 2.5z"/><path d="M7.5 12.5a2.6 2.6 0 0 0 2.5 2.6" opacity=".6"/>',
  image: '<rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="M3 14l4-4 3 3 3-3 4 4"/><circle cx="13" cy="8" r="1.3"/>',
  reeded: '<path d="M4 3v14M8 3v14M12 3v14M16 3v14"/>',
  wavy: '<path d="M4 3c-2 3 2 4 0 7s2 4 0 7M10 3c-2 3 2 4 0 7s2 4 0 7M16 3c-2 3 2 4 0 7s2 4 0 7"/>',
  rings: '<circle cx="10" cy="10" r="2.2"/><circle cx="10" cy="10" r="5.2"/><circle cx="10" cy="10" r="8.2"/>',
  tiles:
    '<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>',
  hammered: '<circle cx="6" cy="6" r="3"/><circle cx="14" cy="6.5" r="3.4"/><circle cx="6.5" cy="14" r="3.4"/><circle cx="14.5" cy="14.5" r="2.6"/>',
  water: '<path d="M2 6.5c2-2 4-2 6 0s4 2 6 0 3-1.5 4-1M2 11c2-2 4-2 6 0s4 2 6 0 3-1.5 4-1M2 15.5c2-2 4-2 6 0s4 2 6 0 3-1.5 4-1"/>',
  crystal: '<path d="M10 2.5l6.5 5-2.5 9.5h-8L3.5 7.5z"/><path d="M3.5 7.5h13M10 2.5L7.5 7.5 10 17M10 2.5l2.5 5L10 17" opacity=".6"/>',
  pyramid: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 3l14 14M17 3L3 17M10 3v14M3 10h14" opacity=".55"/>',
  rain: '<path d="M6.5 3.5c1.5 2 2.5 3.3 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1.3 1-2.6 2.5-4.6zM13.5 9c1.5 2 2.5 3.3 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1.3 1-2.6 2.5-4.6z"/><circle cx="6" cy="15.5" r="1.2"/><circle cx="15" cy="4.5" r="0.9"/>',
  sphere: '<circle cx="10" cy="10" r="6.5"/><path d="M6.2 8.2a4.2 4.2 0 0 1 3-2.6" opacity=".6"/>',
  glassObject: '<rect x="3.5" y="3.5" width="9" height="9" rx="1.5" opacity=".55"/><rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/>',
  halftone: dots([[4, 4, 0.8], [10, 4, 1.3], [16, 4, 1.9], [4, 10, 1.3], [10, 10, 1.9], [16, 10, 2.4], [4, 16, 1.9], [10, 16, 2.4], [16, 16, 2.8]]),
  dither:
    '<g fill="currentColor" stroke="none">' +
    [0, 1, 2, 3]
      .flatMap((y) => [0, 1, 2, 3].filter((x) => (x + y) % 2 === 0).map((x) => `<rect x="${3 + x * 3.5}" y="${3 + y * 3.5}" width="3.5" height="3.5"/>`))
      .join('') +
    '</g>',
  dice: '<rect x="3" y="3" width="14" height="14" rx="3"/><g fill="currentColor" stroke="none"><circle cx="7" cy="7" r="1.1"/><circle cx="13" cy="13" r="1.1"/><circle cx="10" cy="10" r="1.1"/></g>',
  reset: '<path d="M4 10a6 6 0 1 0 2-4.5"/><path d="M4 4v3h3"/>',
  play: '<path d="M6 4l10 6-10 6z" fill="currentColor"/>',
  undo: '<path d="M7 5L3.5 8.5 7 12"/><path d="M4 8.5h8a4.5 4.5 0 0 1 0 9H9"/>',
  redo: '<path d="M13 5l3.5 3.5L13 12"/><path d="M16 8.5H8a4.5 4.5 0 0 0 0 9h3"/>',
  loop: '<path d="M15 7.5A6 6 0 0 0 4.5 6.5M5 12.5a6 6 0 0 0 10.5 1"/><path d="M15.5 3.5v4h-4M4.5 16.5v-4h4"/>',
  chevron: '<path d="M6 8l4 4 4-4"/>',
  download: '<path d="M10 3v10M6 9l4 4 4-4"/><path d="M3.5 13v2.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V13"/>',
  eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
  github:
    '<path d="M10 2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.6 4 .3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 10 2z" fill="currentColor" stroke="none"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>',
  search: '<circle cx="8.75" cy="8.75" r="5.25"/><path d="M12.6 12.6L17 17"/>',
  grid: '<rect x="3" y="3" width="5.5" height="5.5" rx="1.2"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1.2"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1.2"/><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.2"/>',
  canvas: '<rect x="5" y="2.5" width="10" height="15" rx="1.8"/>',
  sun: '<circle cx="10" cy="10" r="3.4"/><path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3L6 14M14 6l1.3-1.3"/>',
  motion: '<path d="M2.5 7h6M4.5 10.5h5M2.5 14h6"/><circle cx="13.5" cy="10.5" r="3.8"/>',
  // Not in Halation's set: an "opens elsewhere" arrow for the portfolio's link button, drawn in the same 20×20 stroke style.
  external: '<path d="M7 13L14 6M8 6h6v6"/>',
};
