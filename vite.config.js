import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 7000,
        host: true
    },
    base: './', // Ensure assets load correctly in any subdirectory (e.g. GitHub Pages)
    build: {
        outDir: 'docs', // Output to docs folder for GitHub Pages
    }
});
