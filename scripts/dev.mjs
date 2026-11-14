// Dev server: rebuilds src/app.jsx on change and serves the project at :5500.
import * as esbuild from 'esbuild';

const ctx = await esbuild.context({
  entryPoints: ['src/app.jsx'],
  bundle: true,
  outfile: 'app.js',
  format: 'iife',
  jsx: 'automatic',
  loader: { '.jsx': 'jsx' },
  external: ['fs', 'path', 'crypto'],
  sourcemap: true,
  logLevel: 'info',
});

await ctx.watch();
const { port } = await ctx.serve({ servedir: '.', host: '127.0.0.1', port: 5500 });
console.log(`\n  kevin.es (dev, watching src/) → http://127.0.0.1:${port}/\n  Ctrl+C to stop.\n`);
