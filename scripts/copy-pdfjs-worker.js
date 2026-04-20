#!/usr/bin/env node
// Tento skript zkopíruje PDF.js worker do public/ složky
// Spusťte ho jednou po npm install: node scripts/copy-pdfjs-worker.js

const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../node_modules/pdfjs-dist/build/pdf.worker.min.js");
const dest = path.join(__dirname, "../public/pdf.worker.min.js");

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log("✓ pdf.worker.min.js zkopírován do public/");
} else {
  console.error("✗ Soubor nenalezen:", src);
  console.error("  Spusťte nejprve: npm install");
  process.exit(1);
}
