/**
 * Drawings and photographs for the small gallery before Contact.
 * Put images in public/gallery/ (WebP, about 1600px on the long edge) and list them here.
 * Entries without `src` render as labelled placeholders.
 */
export interface GalleryItem {
  kind: 'Drawing' | 'Photograph';
  /** Path inside public/, e.g. "gallery/harbour-at-dusk.webp". */
  src?: string;
  width?: number;
  height?: number;
  alt: string;
  caption?: string;
}

export const gallery: GalleryItem[] = [
  { kind: 'Drawing', alt: '[PLACEHOLDER: drawing 1]' },
  { kind: 'Photograph', alt: '[PLACEHOLDER: photograph 1]' },
  { kind: 'Drawing', alt: '[PLACEHOLDER: drawing 2]' },
  { kind: 'Photograph', alt: '[PLACEHOLDER: photograph 2]' },
  { kind: 'Photograph', alt: '[PLACEHOLDER: photograph 3]' },
  { kind: 'Drawing', alt: '[PLACEHOLDER: drawing 3]' },
];
