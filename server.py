import json
import mimetypes
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs
from uuid import uuid4
from wsgiref.simple_server import make_server


BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "0.0.0.0")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "change-me")
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data"))
SUBMISSIONS_FILE = DATA_DIR / "submissions.json"


def ensure_data_store():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not SUBMISSIONS_FILE.exists():
        SUBMISSIONS_FILE.write_text("[]", encoding="utf-8")


def read_submissions():
    ensure_data_store()
    return json.loads(SUBMISSIONS_FILE.read_text(encoding="utf-8"))


def write_submissions(submissions):
    ensure_data_store()
    SUBMISSIONS_FILE.write_text(json.dumps(submissions, indent=2), encoding="utf-8")


def json_response(start_response, status, payload):
    body = json.dumps(payload).encode("utf-8")
    headers = [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
    ]
    start_response(status, headers)
    return [body]


def text_response(start_response, status, text):
    body = text.encode("utf-8")
    headers = [
        ("Content-Type", "text/plain; charset=utf-8"),
        ("Content-Length", str(len(body))),
    ]
    start_response(status, headers)
    return [body]


def file_response(start_response, file_path):
    mime_type, _ = mimetypes.guess_type(file_path.name)
    body = file_path.read_bytes()
    headers = [
        ("Content-Type", mime_type or "application/octet-stream"),
        ("Content-Length", str(len(body))),
    ]
    start_response("200 OK", headers)
    return [body]


def is_authorized(environ):
    if environ.get("HTTP_X_ADMIN_TOKEN") == ADMIN_TOKEN:
        return True

    query = parse_qs(environ.get("QUERY_STRING", ""))
    return query.get("token", [""])[0] == ADMIN_TOKEN


def handle_submit(environ, start_response):
    try:
        content_length = int(environ.get("CONTENT_LENGTH") or "0")
        raw_body = environ["wsgi.input"].read(content_length)
        payload = json.loads(raw_body.decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return json_response(start_response, "400 Bad Request", {"error": "Invalid submission payload"})

    if not payload.get("fullName") or not payload.get("email"):
        return json_response(start_response, "400 Bad Request", {"error": "Full name and email are required"})

    submissions = read_submissions()
    record = {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    submissions.insert(0, record)
    write_submissions(submissions)
    return json_response(start_response, "201 Created", {"ok": True, "submission": record})


def app(environ, start_response):
    ensure_data_store()

    method = environ["REQUEST_METHOD"]
    path = environ.get("PATH_INFO", "/")

    if method == "GET" and path == "/health":
        return text_response(start_response, "200 OK", "ok")

    if path == "/api/submissions":
        if method == "GET":
            if not is_authorized(environ):
                return json_response(start_response, "401 Unauthorized", {"error": "Unauthorized"})
            return json_response(start_response, "200 OK", read_submissions())

        if method == "POST":
            return handle_submit(environ, start_response)

        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if method != "GET":
        return json_response(start_response, "404 Not Found", {"error": "Not found"})

    if path == "/":
        return file_response(start_response, PUBLIC_DIR / "index.html")

    if path == "/admin":
        return file_response(start_response, PUBLIC_DIR / "admin.html")

    safe_path = (PUBLIC_DIR / path.lstrip("/")).resolve()
    if not str(safe_path).startswith(str(PUBLIC_DIR.resolve())) or not safe_path.exists():
        return json_response(start_response, "404 Not Found", {"error": "Not found"})

    return file_response(start_response, safe_path)


if __name__ == "__main__":
    print(f"DS-160 intake app running at http://{HOST}:{PORT}")
    with make_server(HOST, PORT, app) as server:
        server.serve_forever()
