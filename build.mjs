// Bundles the game into dist/: index.html (markup + styles) and game.js (code + three.js).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2022', outfile: 'dist/game.js', legalComments: 'none' });
const css = readFileSync('src/style.css', 'utf8');
writeFileSync('dist/index.html', `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rogue Commit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
${css}</style>
</head>
<body>
<canvas id="scene"></canvas>
<div id="ui"></div>
<script src="game.js"></script>
</body>
</html>
`);
console.log('built dist/index.html + dist/game.js');
