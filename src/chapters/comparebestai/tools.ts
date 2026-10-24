/**
 * The tools the chapter shows, by their own icons (public/shots/comparebestai/logos): each
 * vendor's site icon, except Grammarly (Simple Icons, CC0) and QuillBot and Kavout, whose site
 * icons are too small and are redrawn as SVG from them. `inset` is the padding inside the tile,
 * as a fraction of its size, for marks drawn edge to edge; icons with their own ground fill it.
 * `zoom` enlarges an icon whose mark is drawn small inside its own ground.
 */
export type Tool = { name: string; file: string; inset: number; zoom?: number };

export const tools = {
  grammarly: { name: 'Grammarly', file: 'grammarly.svg', inset: 0.17 },
  quillbot: { name: 'QuillBot', file: 'quillbot.svg', inset: 0 },
  semrush: { name: 'Semrush', file: 'semrush.webp', inset: 0 },
  elevenlabs: { name: 'ElevenLabs', file: 'elevenlabs.webp', inset: 0, zoom: 1.7 },
  notion: { name: 'Notion AI', file: 'notion.webp', inset: 0 },
  frase: { name: 'Frase', file: 'frase.webp', inset: 0.06 },
  pictory: { name: 'Pictory', file: 'pictory.webp', inset: 0.1 },
  fireflies: { name: 'Fireflies.ai', file: 'fireflies.webp', inset: 0 },
  xero: { name: 'Xero', file: 'xero.webp', inset: 0 },
  beehiiv: { name: 'Beehiiv', file: 'beehiiv.webp', inset: 0.12 },
  kavout: { name: 'Kavout', file: 'kavout.svg', inset: 0.1 },
} satisfies Record<string, Tool>;

export type ToolId = keyof typeof tools;
