// Client-side image compression for base64 uploads.
//
// Why client-side: Render disk is 1 GB and Bataa frequently uploads phone
// photos/passport scans. Resizing to max 1600px and re-encoding as JPEG q=0.82
// typically shrinks 4-8 MB phone photos to ~150-400 KB without visible quality
// loss. Single-page PDFs (passports / receipts / IDs) are rasterized to JPEG
// via pdf.js — a 4 MB scan becomes ~150 KB. Multi-page PDFs are passed through
// unchanged (we'd lose pages). DOC is also passed through.
//
// Usage:
//   const compressed = await window.CompressUpload.image(file);
//   // → "data:image/jpeg;base64,..." (a data URL)
//
// Or for a base64 data URL already in hand:
//   const smaller = await window.CompressUpload.dataUrl(dataUrl);

(function () {
  const MAX_DIMENSION = 1600;
  const JPEG_QUALITY = 0.82;
  // Don't bother re-encoding tiny images — risk losing quality for no gain.
  const SKIP_IF_UNDER_BYTES = 200 * 1024; // 200 KB

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = dataUrl;
    });
  }

  async function compressDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return dataUrl;
    if (!dataUrl.startsWith("data:image/")) return dataUrl;
    // Skip animated GIFs (canvas would freeze them to a single frame).
    if (dataUrl.startsWith("data:image/gif")) return dataUrl;

    // Approximate decoded size from base64 length.
    const commaIdx = dataUrl.indexOf(",");
    const base64Len = commaIdx >= 0 ? dataUrl.length - commaIdx - 1 : 0;
    const approxBytes = Math.floor(base64Len * 0.75);
    if (approxBytes < SKIP_IF_UNDER_BYTES) return dataUrl;

    let img;
    try {
      img = await loadImage(dataUrl);
    } catch {
      return dataUrl;
    }
    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    let compressed;
    try {
      compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    } catch {
      return dataUrl;
    }
    // Sanity: only return the compressed version if it's actually smaller.
    return compressed.length < dataUrl.length ? compressed : dataUrl;
  }

  // ── PDF → JPEG rasterizer ──
  // Single-page PDFs (passports, receipts, IDs) get rendered to a
  // canvas at ≤ MAX_DIMENSION px and encoded as JPEG so the rest of
  // the compress flow can take over. Multi-page PDFs return null
  // (we don't want to silently lose pages on contracts etc).
  let pdfJsPromise = null;
  function ensurePdfJs() {
    if (window.pdfjsLib && window.pdfjsLib.getDocument) return Promise.resolve(window.pdfjsLib);
    if (!pdfJsPromise) {
      pdfJsPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => {
          try {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          } catch (_) {}
          resolve(window.pdfjsLib);
        };
        s.onerror = () => { pdfJsPromise = null; reject(new Error("pdf.js load failed")); };
        document.head.appendChild(s);
      });
    }
    return pdfJsPromise;
  }

  async function rasterizePdfFirstPage(file) {
    if (!file || file.type !== "application/pdf") return null;
    let lib;
    try { lib = await ensurePdfJs(); } catch { return null; }
    let pdf;
    try {
      const arrayBuf = await file.arrayBuffer();
      pdf = await lib.getDocument({ data: arrayBuf, disableWorker: false }).promise;
    } catch { return null; }
    // Multi-page PDF → keep original (we don't want to lose pages).
    if (pdf.numPages !== 1) return null;
    let blob;
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      // Render at enough resolution to keep the longer side ≤ MAX_DIMENSION
      // but never below the page's native size — small docs stay sharp.
      const longSide = Math.max(base.width, base.height);
      const scale = Math.max(1, Math.min(MAX_DIMENSION / longSide * 1.5, 2.5));
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      // toBlob → Promise wrapper.
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    } catch { return null; }
    if (!blob || blob.size >= file.size) return null;
    const newName = (file.name || "scan.pdf").replace(/\.pdf$/i, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  }

  async function compressFile(file) {
    if (!file) return null;
    if (file.type === "application/pdf") {
      const jpg = await rasterizePdfFirstPage(file);
      if (jpg) return readFileAsDataUrl(jpg);
    }
    const dataUrl = await readFileAsDataUrl(file);
    if (!file.type || !file.type.startsWith("image/")) return dataUrl;
    return compressDataUrl(dataUrl);
  }

  // Returns a Blob/File for FormData upload paths. Non-images and small images
  // are passed through unchanged. Single-page PDFs are rasterized to JPEG
  // first, then run through the regular image-compress path so they end up
  // identical in shape to a normal JPEG upload.
  async function compressToFile(file) {
    if (!file) return file;
    if (file.type === "application/pdf") {
      const jpg = await rasterizePdfFirstPage(file);
      if (jpg) {
        // Recurse on the JPEG so the standard 1600px resize + JPEG quality
        // re-encode applies. Returns the smaller of the two.
        return await compressToFile(jpg);
      }
      return file;
    }
    if (!file.type || !file.type.startsWith("image/")) return file;
    if (file.type === "image/gif") return file;
    if (file.size < SKIP_IF_UNDER_BYTES) return file;
    let dataUrl;
    try {
      dataUrl = await readFileAsDataUrl(file);
      dataUrl = await compressDataUrl(dataUrl);
    } catch {
      return file;
    }
    if (!dataUrl || !dataUrl.startsWith("data:image/")) return file;
    // Decode the data URL into a Blob.
    const commaIdx = dataUrl.indexOf(",");
    const meta = dataUrl.slice(5, commaIdx);
    const mime = meta.split(";")[0] || "image/jpeg";
    const b64 = dataUrl.slice(commaIdx + 1);
    let binary;
    try {
      binary = atob(b64);
    } catch {
      return file;
    }
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    if (blob.size >= file.size) return file;
    // Replace the extension with .jpg if we re-encoded as JPEG.
    const ext = mime === "image/jpeg" ? "jpg" : (mime.split("/")[1] || "img");
    const newName = file.name ? file.name.replace(/\.[^.]+$/, "") + "." + ext : "image." + ext;
    return new File([blob], newName, { type: mime, lastModified: Date.now() });
  }

  window.CompressUpload = {
    image: compressFile,
    dataUrl: compressDataUrl,
    file: compressToFile,
    MAX_DIMENSION,
    JPEG_QUALITY,
  };
})();
