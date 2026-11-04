const fs = require('fs');
const path = require('path');

const file = path.resolve('apps/web/src/index.css');
let content = fs.readFileSync(file, 'utf8');
const isCrlf = content.includes('\r\n');
let norm = content.replace(/\r\n/g, '\n');

// 1. First block
const target1 = `  .sidebar, .top-header, .btn, .no-print {
    display: none !important;
  }`;
const rep1 = `  .sidebar, .top-header, .btn, .no-print,
  [class*="netlify"], [id*="netlify"], [data-netlify], a[href*="netlify.com"], iframe[src*="netlify"], .netlify-badge, #netlify-drawer {
    display: none !important;
    visibility: hidden !important;
  }`;

// 2. Second block
const target2 = `  .sidebar, 
  .header, 
  .page-container, 
  .no-print, 
  button, 
  .card-header,
  .pagination-container {
    display: none !important;
  }`;
const rep2 = `  .sidebar, 
  .header, 
  .page-container, 
  .no-print, 
  button, 
  .card-header,
  .pagination-container,
  [class*="netlify"],
  [id*="netlify"],
  [data-netlify],
  [data-netlify-drawer],
  a[href*="netlify.com"],
  iframe[src*="netlify"],
  .netlify-badge,
  #netlify-badge,
  #netlify-drawer,
  netlify-drawer {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    width: 0 !important;
    opacity: 0 !important;
  }`;

if (norm.includes(target1) && norm.includes(target2)) {
  norm = norm.replace(target1, rep1);
  norm = norm.replace(target2, rep2);
  fs.writeFileSync(file, isCrlf ? norm.replace(/\n/g, '\r\n') : norm, 'utf8');
  console.log('Successfully updated index.css to suppress Netlify badges and injected elements!');
} else {
  console.error('Targets not found');
  process.exit(1);
}

