import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function lucideIconFile(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .toLowerCase();
}

// Rewrite `lucide-react` barrel imports to per-icon files. The published
// barrel re-exports every icon, which makes Vite parse the whole set in dev.
function lucideDirectIconImports(): Plugin {
  const importPattern = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]lucide-react['"]\s*;?/g;

  return {
    name: 'lucide-direct-icon-imports',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replace(/\\/g, '/');
      if (!normalized.includes('/src/') || normalized.includes('/node_modules/')) return null;
      if (!code.includes('lucide-react')) return null;

      importPattern.lastIndex = 0;
      let changed = false;
      const next = code.replace(importPattern, (full, typeOnly: string | undefined, specifiers: string) => {
        if (typeOnly) return full;
        const lines: string[] = [];
        const typeNames: string[] = [];
        for (const part of specifiers.split(',').map((item) => item.trim()).filter(Boolean)) {
          if (part.startsWith('type ')) {
            typeNames.push(part.slice(5).trim());
            continue;
          }
          const [exportedRaw, localRaw] = part.split(/\s+as\s+/);
          const exported = exportedRaw.trim();
          const local = (localRaw || exported).trim();
          if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(exported) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(local)) {
            return full;
          }
          lines.push(`import ${local} from 'lucide-react/dist/esm/icons/${lucideIconFile(exported)}.mjs';`);
        }
        changed = true;
        const typeImport = typeNames.length > 0
          ? `import type { ${typeNames.join(', ')} } from 'lucide-react';\n`
          : '';
        return typeImport + lines.join('\n');
      });

      if (!changed || next === code) return null;
      return { code: next, map: null };
    },
  };
}

const appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version as string;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    lucideDirectIconImports(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'Dispatch Fleet & Employee Operations',
        short_name: 'DispatchHub',
        description: 'Fleet operations and master employee dispatch system for office personnel',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//, /^\/driver(\/|$)/, /^\/parent(\/|$)/]
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('vite/preload-helper') ||
            id.includes('vite/modulepreload-polyfill') ||
            id.includes('commonjsHelpers')
          ) {
            return 'vendor';
          }
          if (!id.includes('node_modules')) return;
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('leaflet')) return 'leaflet';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
          if (id.includes('exceljs') || id.includes('xlsx')) return 'excel';
          return 'vendor';
        }
      }
    }
  }
});
