// Resolve Playwright from the project, or from a global install (some CI images and cloud sandboxes ship one).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function loadChromium() {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id).chromium;
    } catch {
      // try the next one
    }
  }
  console.error('Playwright not found. Install it with: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}
