# Razítko na objednávku

Webová aplikace pro vložení podpisu/razítka do PDF objednávky a export jako JPG.

## Instalace a spuštění

### 1. Nainstalujte závislosti
```bash
npm install
```

### 2. Zkopírujte PDF.js worker (nutné!)
```bash
node scripts/copy-pdfjs-worker.js
```

### 3. Spusťte lokálně
```bash
npm start
```
Aplikace se otevře na http://localhost:3000

---

## Nasazení na GitHub Pages

### 1. Upravte homepage v package.json
Otevřete `package.json` a změňte:
```json
"homepage": "https://VASE_JMENO.github.io/razitko"
```
Nahraďte `VASE_JMENO` vaším GitHub uživatelským jménem.

### 2. Vytvořte GitHub repozitář
- Jděte na github.com → New repository
- Název: `razitkovac`
- Veřejný repozitář

### 3. Propojte a pushněte
```bash
git init
git add .
git commit -m "První verze"
git remote add origin https://github.com/VASE_JMENO/razitko.git
git branch -M main
git push -u origin main
```

### 4. Nasaďte
```bash
npm run deploy
```

### 5. Povolte GitHub Pages
- Jděte na Settings → Pages v repozitáři
- Source: `gh-pages` branch
- Po pár minutách bude dostupné na: `https://VASE_JMENO.github.io/razitko`

---

## Jak aplikace funguje

1. Nahrajte PDF objednávku
2. Nahrajte JPG podpis/razítko  
3. Přetáhněte razítko na správné místo na poslední stránce
4. Rohovou úchytkou změňte velikost razítka
5. Klikněte "Exportovat jako JPG"

Výsledný soubor obsahuje všechny strany sloučené do jednoho JPG s razítkem na poslední straně.
