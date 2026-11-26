import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@services': path.resolve(__dirname, './src/services'),
      '@shared': path.resolve(__dirname, '../shared'),
      '@frostLord': path.resolve(__dirname, '../shared/units/frostLord'),
      '@ashTyrant': path.resolve(__dirname, '../shared/units/ashTyrant'),
      '@glacialMage': path.resolve(__dirname, '../shared/units/glacialMage'),
      '@soulLinker': path.resolve(__dirname, '../shared/units/soulLinker'),
      '@magmaShaper': path.resolve(__dirname, '../shared/units/magmaShaper'),
      '@ashReaper': path.resolve(__dirname, '../shared/units/ashReaper'),
      '@iceWisp': path.resolve(__dirname, '../shared/units/iceWisp'),
      '@frostLordClient': path.resolve(__dirname, './src/units/frostLord'),
      '@ashTyrantClient': path.resolve(__dirname, './src/units/ashTyrant'),
      '@glacialMageClient': path.resolve(__dirname, './src/units/glacialMage'),
      '@soulLinkerClient': path.resolve(__dirname, './src/units/soulLinker'),
      '@magmaShaperClient': path.resolve(__dirname, './src/units/magmaShaper'),
      '@ashReaperClient': path.resolve(__dirname, './src/units/ashReaper'),
      '@iceWispClient': path.resolve(__dirname, './src/units/iceWisp'),
      'lucide-react/dist/esm/icons': path.resolve(__dirname, './node_modules/lucide-react/dist/esm/icons'),
    },
  },
  optimizeDeps: {
    include: ['lucide-react'],
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
    modulePreload: {
      resolveDependencies(filename, deps, { hostId, hostType }) {
        // Only preload critical core runtime dependencies, deferring on-demand multiplayer chunks
        return deps.filter(dep => !dep.includes('multiplayer'));
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('node_modules/react') || normalizedId.includes('node_modules/react-dom') || normalizedId.includes('node_modules/scheduler')) {
              return 'vendor-react';
            }
              if (normalizedId.includes('node_modules/gsap')) {
                return 'vendor-gsap';
              }
                if (normalizedId.includes('node_modules/firebase') || normalizedId.includes('node_modules/@firebase')) {
                  return 'vendor-firebase';
                }
                  if (normalizedId.includes('src/services/multiplayer')) {
                    return 'multiplayer';
                  }
                }
              }
            }
          },
          server: {
            port: 5173
          }
        });
