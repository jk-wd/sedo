import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default function globalSetup() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const result = spawnSync(process.execPath, ['scripts/generate-blocker-scripts.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('Blocker script generation failed');
  }
}
