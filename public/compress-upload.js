// Client-side image compression for base64 uploads.
//
// Why client-side: Render disk is 1 GB and Bataa frequently uploads phone
// photos/passport scans. Resizing to max 1600px and re-encoding as JPEG q=0.82
// typically shrinks 4-8 MB phone photos to ~150-400 KB without visible quality
// loss. PDFs/DOC are passed through unchanged (would need ghostscript/qpdf to
// shrink, not worth the dependency).
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

  async function compressFile(file) {
    if (!file) return null;
    const dataUrl = await readFileAsDataUrl(file);
    if (!file.type || !file.type.startsWith("image/")) return dataUrl;
    return compressDataUrl(dataUrl);
  }

  // Returns a Blob/File for FormData upload paths. Non-images and small images
  // are passed through unchanged.
  async function compressToFile(file) {
    if (!file) return file;
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
