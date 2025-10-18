#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Creating portable single HTML file...');

// Paths
const buildDir = './dist/angular-app/browser';
const indexPath = path.join(buildDir, 'index.html');
const outputPath = './real-timeDisplay-portable.html';

// Read the index.html file
let html = fs.readFileSync(indexPath, 'utf-8');

// Find all JavaScript files in the build directory
const jsFiles = fs.readdirSync(buildDir).filter(file => file.endsWith('.js'));
console.log('📦 Found JS files:', jsFiles);

// Find all CSS files in the build directory
const cssFiles = fs.readdirSync(buildDir).filter(file => file.endsWith('.css'));
console.log('🎨 Found CSS files:', cssFiles);

// Remove the base href to make it work from any location
html = html.replace(/<base href="[^"]*">/, '<base href="./">');

// Inline all CSS files
cssFiles.forEach(cssFile => {
  const cssPath = path.join(buildDir, cssFile);
  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  
  // Replace the link tag with inline styles
  const linkRegex = new RegExp(`<link rel="stylesheet" href="[^"]*${cssFile}">`, 'g');
  html = html.replace(linkRegex, `<style>\n${cssContent}\n</style>`);
  
  console.log(`✅ Inlined CSS: ${cssFile}`);
});

// Inline all JavaScript files
jsFiles.forEach(jsFile => {
  const jsPath = path.join(buildDir, jsFile);
  const jsContent = fs.readFileSync(jsPath, 'utf-8');
  
  // Replace the script tag with inline script
  const scriptRegex = new RegExp(`<script src="[^"]*${jsFile}"[^>]*></script>`, 'g');
  html = html.replace(scriptRegex, `<script type="module">\n${jsContent}\n</script>`);
  
  console.log(`✅ Inlined JS: ${jsFile}`);
});

// Add metadata and comments
const metadata = `<!-- 
Real-Time Display System - Portable Version
Generated: ${new Date().toISOString()}
Original Angular App Size: ${jsFiles.length} JS files + ${cssFiles.length} CSS files
All assets inlined for offline/portable use

Features included:
- Admin interface for schedule management
- Real-time display with countdown
- Sunday/Friday auto-loading
- Manual activity controls
- Announcement system
- Fullscreen display support
- Multi-window sync via localStorage

Usage: Simply open this HTML file in any modern browser
No server or network connection required
-->

`;

html = html.replace('<!doctype html>', `<!doctype html>\n${metadata}`);

// Write the portable file
fs.writeFileSync(outputPath, html);

// Get file size
const stats = fs.statSync(outputPath);
const fileSizeKB = Math.round(stats.size / 1024);

console.log('🎉 Portable HTML file created successfully!');
console.log(`📁 Output: ${outputPath}`);
console.log(`📊 File size: ${fileSizeKB} KB`);
console.log('');
console.log('✨ Your app is now fully portable and offline-ready!');
console.log('📋 To use: Open the HTML file in any browser');
console.log('🔗 No network connection required');
console.log('💾 All functionality preserved');