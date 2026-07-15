import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const projectDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(async () => {
  // Tailwind 4.3 registers a Node 22 resolve hook that can deadlock Vite 8/Rolldown.
  // This project has no JS Tailwind config, so the hook is unnecessary.
  const versions = process.versions as typeof process.versions & { bun?: string };
  const hadBunVersion = Boolean(versions.bun);
  if (!hadBunVersion) Object.defineProperty(versions, 'bun', { value: 'compat', configurable: true });
  const { default: tailwindcss } = await import('@tailwindcss/vite');
  if (!hadBunVersion) delete versions.bun;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(projectDir, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
  };
});
