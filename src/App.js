import { useState, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Worker ze stejného balíčku — React Scripts ho zkopíruje do public/
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

const SCALE = 1.5;

export default function App() {
  const [stampSrc, setStampSrc] = useState(null);
  const [stampPos, setStampPos] = useState({ x: 60, y: 60 });
  const [stampSize, setStampSize] = useState({ w: 80, h: 53 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [stampLoaded, setStampLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [pageCanvases, setPageCanvases] = useState([]);
  const [lastPageIndex, setLastPageIndex] = useState(0);
  const overlayRef = useRef(null);

  const handlePdfUpload = async (file) => {
    if (!file) return;
    setPdfLoaded(false);
    setPageCanvases([]);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const canvases = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      canvases.push(canvas);
    }
    setPageCanvases(canvases);
    setLastPageIndex(canvases.length - 1);
    setPdfLoaded(true);
    setExported(false);
    const lastCanvas = canvases[canvases.length - 1];
    setStampPos({
      x: 40,
      y: lastCanvas.height / SCALE - 210,
    });
  };

  const handleStampUpload = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setStampSrc(url);
    setStampLoaded(true);
    setExported(false);
    const img = new Image();
    img.onload = () => {
      const maxW = 90;
      const aspect = img.naturalWidth / img.naturalHeight;
      setStampSize({ w: maxW, h: Math.round(maxW / aspect) });
    };
    img.src = url;
  };

  const getClientXY = (e) => {
    if (e.touches && e.touches.length > 0) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length > 0) return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const onMouseDown = useCallback(
    (e) => {
      const { clientX, clientY } = getClientXY(e);
      if (e.target.dataset.resize) {
        setResizing(true);
        setResizeStart({ mouseX: clientX, mouseY: clientY, w: stampSize.w, h: stampSize.h });
        e.preventDefault();
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const lastCanvas = pageCanvases[lastPageIndex];
      const canvasW = lastCanvas.width / SCALE;
      const canvasH = lastCanvas.height / SCALE;
      const absX = ((clientX - rect.left) / rect.width) * canvasW;
      const absY = ((clientY - rect.top) / rect.height) * canvasH;
      if (absX >= stampPos.x && absX <= stampPos.x + stampSize.w && absY >= stampPos.y && absY <= stampPos.y + stampSize.h) {
        setDragging(true);
        setDragOffset({ x: absX - stampPos.x, y: absY - stampPos.y });
        e.preventDefault();
      }
    },
    [stampPos, stampSize, pageCanvases, lastPageIndex]
  );

  const onMouseMove = useCallback(
    (e) => {
      if (!dragging && !resizing) return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const { clientX, clientY } = getClientXY(e);
      if (resizing) {
        setStampSize({ w: Math.max(40, resizeStart.w + clientX - resizeStart.mouseX), h: Math.max(20, resizeStart.h + clientY - resizeStart.mouseY) });
        e.preventDefault();
        return;
      }
      const lastCanvas = pageCanvases[lastPageIndex];
      const canvasW = lastCanvas.width / SCALE;
      const canvasH = lastCanvas.height / SCALE;
      const absX = ((clientX - rect.left) / rect.width) * canvasW;
      const absY = ((clientY - rect.top) / rect.height) * canvasH;
      setStampPos({ x: Math.max(0, Math.min(canvasW - stampSize.w, absX - dragOffset.x)), y: Math.max(0, Math.min(canvasH - stampSize.h, absY - dragOffset.y)) });
      e.preventDefault();
    },
    [dragging, resizing, dragOffset, stampSize, pageCanvases, lastPageIndex, resizeStart]
  );

  const onMouseUp = useCallback(() => { setDragging(false); setResizing(false); }, []);

  const handleExport = async () => {
    if (!pdfLoaded || !stampLoaded) return;
    setExporting(true);
    const totalHeight = pageCanvases.reduce((sum, c) => sum + c.height, 0);
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = pageCanvases[0].width;
    finalCanvas.height = totalHeight;
    const ctx = finalCanvas.getContext("2d");
    let yOffset = 0;
    for (let i = 0; i < pageCanvases.length; i++) {
      ctx.drawImage(pageCanvases[i], 0, yOffset);
      if (i === lastPageIndex) {
        const stampImg = new Image();
        await new Promise((resolve) => { stampImg.onload = resolve; stampImg.src = stampSrc; });
        const boxW = stampSize.w * SCALE;
        const boxH = stampSize.h * SCALE;
        const imgAspect = stampImg.naturalWidth / stampImg.naturalHeight;
        const boxAspect = boxW / boxH;
        let drawW, drawH;
        if (imgAspect > boxAspect) {
          drawW = boxW;
          drawH = boxW / imgAspect;
        } else {
          drawH = boxH;
          drawW = boxH * imgAspect;
        }
        ctx.drawImage(
          stampImg,
          stampPos.x * SCALE + (boxW - drawW) / 2,
          yOffset + stampPos.y * SCALE + (boxH - drawH) / 2,
          drawW,
          drawH
        );
      }
      yOffset += pageCanvases[i].height;
    }
    finalCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "objednavka_razitko.jpg";
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
      setExported(true);
    }, "image/jpeg", 0.9);
  };

  const lastCanvas = pageCanvases[lastPageIndex];

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e8e3d8", fontFamily: "'DM Mono', 'Courier New', monospace", padding: "32px 24px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 780, margin: "0 auto 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #c8a96e, #e8d5a3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🖋</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "0.04em", color: "#e8d5a3" }}>Razítko na objednávku</h1>
        </div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#c0b8a8", lineHeight: 1.6 }}>Nahrajte PDF objednávku a podpis/razítko. Umístěte razítko přetažením na správné místo a exportujte.</p>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <UploadCard label="PDF Objednávka" accept=".pdf" icon="📄" loaded={pdfLoaded} hint={pdfLoaded ? `${pageCanvases.length} strana${pageCanvases.length > 1 ? "y" : ""}` : "Vyberte soubor .pdf"} onChange={(e) => { const f = e.target.files[0]; if (f) handlePdfUpload(f); }} />
        <UploadCard label="Podpis / Razítko" accept=".png,.jpg,.jpeg" icon="🔖" loaded={stampLoaded} hint={stampLoaded ? "Načteno" : "Vyberte soubor"} onChange={(e) => { const f = e.target.files[0]; if (f) handleStampUpload(f); }} />
      </div>

      {pdfLoaded && lastCanvas && (
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          {pageCanvases.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#a09888", marginBottom: 8 }}>Strany 1{pageCanvases.length > 2 ? `–${pageCanvases.length - 1}` : ""} (bez razítka):</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {pageCanvases.slice(0, -1).map((c, i) => (
                  <canvas key={i} ref={(el) => { if (el) { el.width = c.width; el.height = c.height; el.getContext("2d").drawImage(c, 0, 0); } }} style={{ width: Math.min(180, c.width / SCALE), height: "auto", border: "1px solid #2a2520", borderRadius: 4 }} />
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 14, fontWeight: 700, color: "#a09888", marginBottom: 8 }}>Poslední strana — umístěte razítko přetažením:</p>

          <div style={{ position: "relative", display: "inline-block", border: "1px solid #2a2520", borderRadius: 6, overflow: "hidden", width: "100%", maxWidth: lastCanvas.width / SCALE, userSelect: "none" }}>
            <canvas ref={(el) => { if (el) { el.width = lastCanvas.width; el.height = lastCanvas.height; el.getContext("2d").drawImage(lastCanvas, 0, 0); } }} style={{ display: "block", width: "100%", height: "auto" }} />

            {stampLoaded && (
              <div ref={overlayRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onTouchStart={onMouseDown} onTouchMove={onMouseMove} onTouchEnd={onMouseUp} style={{ position: "absolute", inset: 0, cursor: dragging ? "grabbing" : "default" }}>
                <div style={{ position: "absolute", left: `${(stampPos.x / (lastCanvas.width / SCALE)) * 100}%`, top: `${(stampPos.y / (lastCanvas.height / SCALE)) * 100}%`, width: `${(stampSize.w / (lastCanvas.width / SCALE)) * 100}%`, height: `${(stampSize.h / (lastCanvas.height / SCALE)) * 100}%`, cursor: "grab", border: "2px dashed #c8a96e88", boxSizing: "border-box", borderRadius: 3 }}>
                  <img src={stampSrc} alt="razítko" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                  <div data-resize="true" style={{ position: "absolute", right: -5, bottom: -5, width: 12, height: 12, background: "#c8a96e", borderRadius: 2, cursor: "nwse-resize" }} />
                </div>
              </div>
            )}
          </div>

          {!stampLoaded && <p style={{ fontSize: 14, fontWeight: 700, color: "#c89060", marginTop: 8 }}>↑ Nejprve nahrajte soubor razítka/podpisu</p>}
          {stampLoaded && <p style={{ fontSize: 13, fontWeight: 600, color: "#a09888", marginTop: 6 }}>Táhněte razítko na správné místo · rohová úchytka pro změnu velikosti</p>}

          <button onClick={handleExport} disabled={!stampLoaded || exporting} style={{ marginTop: 20, padding: "12px 28px", background: !stampLoaded || exporting ? "#2a2520" : "linear-gradient(135deg, #c8a96e, #e8c87a)", color: !stampLoaded || exporting ? "#5a5048" : "#1a1510", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", cursor: !stampLoaded || exporting ? "not-allowed" : "pointer" }}>
            {exporting ? "Exportuji…" : exported ? "✓ Staženo — exportovat znovu" : "⬇ Exportovat"}
          </button>
        </div>
      )}

      {!pdfLoaded && <div style={{ maxWidth: 780, margin: "40px auto", textAlign: "center", color: "#807060", fontSize: 15, fontWeight: 700 }}>Nejprve nahrajte PDF objednávku výše ↑</div>}
    </div>
  );
}

function UploadCard({ label, accept, icon, loaded, hint, onChange }) {
  const inputRef = useRef(null);
  return (
    <div onClick={() => inputRef.current?.click()} style={{ background: loaded ? "#141a0f" : "#16141a", border: `1.5px solid ${loaded ? "#4a7a2a" : "#2a2530"}`, borderRadius: 10, padding: "20px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: loaded ? "#2a4a1a" : "#201e28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{loaded ? "✓" : icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: loaded ? "#7aba4a" : "#c8c0b0", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#908880" }}>{hint}</div>
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={onChange} />
    </div>
  );
}
