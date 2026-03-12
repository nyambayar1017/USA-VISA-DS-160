const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, "[]", "utf8");
  }
}

function readSubmissions() {
  ensureDataStore();
  const raw = fs.readFileSync(SUBMISSIONS_FILE, "utf8");
  return JSON.parse(raw);
}

function writeSubmissions(submissions) {
  ensureDataStore();
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), "utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStaticFile(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      sendJson(res, 500, { error: "Could not load file" });
      return;
    }

    const extension = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });
    res.end(content);
  });
}

async function handleApi(req, res) {
  if (req.method === "POST" && req.url === "/api/submissions") {
    try {
      const body = await collectBody(req);
      const parsed = JSON.parse(body);

      if (!parsed.fullName || !parsed.email) {
        sendJson(res, 400, { error: "Full name and email are required" });
        return;
      }

      const submissions = readSubmissions();
      const record = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...parsed,
      };

      submissions.unshift(record);
      writeSubmissions(submissions);

      sendJson(res, 201, { ok: true, submission: record });
      return;
    } catch (error) {
      sendJson(res, 400, { error: "Invalid submission payload" });
      return;
    }
  }

  if (req.method === "GET" && req.url === "/api/submissions") {
    const submissions = readSubmissions();
    sendJson(res, 200, submissions);
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  if (req.url === "/admin") {
    req.url = "/admin.html";
  }

  serveStaticFile(req, res);
});

ensureDataStore();

server.listen(PORT, () => {
  console.log(`DS-160 intake app running at http://localhost:${PORT}`);
});
