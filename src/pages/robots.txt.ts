import type { APIRoute } from 'astro';

// Only the sitemap pointer: Cloudflare's managed robots.txt adds its own content on top of this file.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(`${import.meta.env.BASE_URL}sitemap.xml`, site);
  return new Response(`Sitemap: ${sitemap}\n`, { headers: { 'Content-Type': 'text/plain' } });
};
