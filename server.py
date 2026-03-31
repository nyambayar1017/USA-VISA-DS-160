import copy
import html
import hashlib
import hmac
import json
import base64
import mimetypes
import os
import re
import secrets
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote
from urllib import request as urlrequest
from uuid import uuid4
import xml.etree.ElementTree as ET
from wsgiref.simple_server import make_server


BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = Path(os.environ.get("DATA_DIR", str(BASE_DIR / "data"))).expanduser()
GENERATED_DIR = DATA_DIR / "generated"
BACKUP_DIR = DATA_DIR / "backups"
PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "0.0.0.0")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "change-me")
TEMPLATE_FILE = Path(os.environ.get("CONTRACT_TEMPLATE", DATA_DIR / "GEREE-template.docx"))
TEMPLATE_FALLBACK = Path(__file__).resolve().parent / "data" / "GEREE-template.docx"
CONTRACTS_FILE = DATA_DIR / "contracts.json"
DS160_FILE = DATA_DIR / "ds160_applications.json"
FINANCE_FILE = DATA_DIR / "finance_entries.json"
BOOKINGS_FILE = DATA_DIR / "hotel_bookings.json"
RESERVATIONS_FILE = DATA_DIR / "reservations.json"
CAMP_RESERVATIONS_FILE = DATA_DIR / "camp_reservations.json"
CAMP_TRIPS_FILE = DATA_DIR / "camp_trips.json"
CAMP_SETTINGS_FILE = DATA_DIR / "camp_settings.json"
USERS_FILE = DATA_DIR / "users.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"
SESSION_COOKIE = "travelx_session"
SESSION_SECRET = os.environ.get("SESSION_SECRET", ADMIN_TOKEN)
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip().lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "").strip()
BACKUP_WEBHOOK_URL = os.environ.get("BACKUP_WEBHOOK_URL", "").strip()
BACKUP_TOKEN = os.environ.get("BACKUP_TOKEN", "").strip()
STEPPE_COMPANY_NAME = "“АНЛОК СТЕП МОНГОЛИА” ХХК"
STEPPE_CITY = "Улаанбаатар хот"
STEPPE_ADDRESS_LINES = [
    "Хан-Уул дүүрэг, 17-р хороо,",
    "Их Монгол Улсын гудамж, Кинг Товер, 121-102 тоот",
    "Улаанбаатар хот, Монгол улс.",
]
STEPPE_MANAGER = "Г. Бужинлхам"
STEPPE_PHONES = "72007722, 85178822"
STEPPE_CONTACT_PHONES = "72007722, 85178822"
STEPPE_EMAIL = "booking@steppe-mongolia.com"
DEFAULT_ROOM_CHOICES = [
    "Double Standard Ger",
    "Twin Standard Ger",
    "Standard Ger 3/4 pax",
    "Luxury Ger with bathroom",
    "Luxury Ger without bathroom",
]
DEFAULT_LANGUAGES = [
    "English",
    "French",
    "Mongolian",
    "Korean",
    "Spanish",
    "Italian",
    "Other",
]
RESERVATION_TYPE_LABELS = {
    "camp": "Баазын захиалга",
    "hotel": "Буудлын захиалга",
    "herder": "Малчин айлын захиалга",
}
MONGOLIA_TZ = timezone(timedelta(hours=8))

ET.register_namespace("w", WORD_NS)


def ensure_data_store():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for file_path in [
        CONTRACTS_FILE,
        DS160_FILE,
        FINANCE_FILE,
        BOOKINGS_FILE,
        RESERVATIONS_FILE,
        CAMP_RESERVATIONS_FILE,
        CAMP_TRIPS_FILE,
        USERS_FILE,
        SESSIONS_FILE,
    ]:
        if not file_path.exists():
            file_path.write_text("[]", encoding="utf-8")
    if not CAMP_SETTINGS_FILE.exists():
        CAMP_SETTINGS_FILE.write_text(
            json.dumps(
                {
                    "campNames": ["Khustai camp"],
                    "staffAssignments": [STEPPE_MANAGER],
                    "roomChoices": DEFAULT_ROOM_CHOICES,
                },
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    bootstrap_admin_user()


def read_json_list(file_path):
    ensure_data_store()
    return json.loads(file_path.read_text(encoding="utf-8"))


def write_json_list(file_path, records):
    ensure_data_store()
    file_path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")


def list_backup_sources():
    return [
        CONTRACTS_FILE,
        DS160_FILE,
        FINANCE_FILE,
        BOOKINGS_FILE,
        RESERVATIONS_FILE,
        CAMP_RESERVATIONS_FILE,
        CAMP_TRIPS_FILE,
        CAMP_SETTINGS_FILE,
        USERS_FILE,
        SESSIONS_FILE,
    ]


def notify_backup_webhook(payload):
    if not BACKUP_WEBHOOK_URL:
        return
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            BACKUP_WEBHOOK_URL,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        urlrequest.urlopen(req, timeout=8)
    except Exception:
        return


def create_backup_archive():
    ensure_data_store()
    timestamp = now_mongolia().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"travelx-backup-{timestamp}.zip"
    archive_path = BACKUP_DIR / filename
    manifest = {
        "createdAt": now_mongolia().isoformat(),
        "files": [],
    }
    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for file_path in list_backup_sources():
            if not file_path.exists():
                continue
            arcname = file_path.name
            archive.write(file_path, arcname)
            manifest["files"].append(arcname)
        archive.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
    notify_backup_webhook(
        {
            "filename": filename,
            "createdAt": manifest["createdAt"],
            "fileCount": len(manifest["files"]),
        }
    )
    return archive_path


def list_backup_archives():
    ensure_data_store()
    backups = []
    for path in BACKUP_DIR.glob("travelx-backup-*.zip"):
        stat = path.stat()
        backups.append(
            {
                "filename": path.name,
                "size": stat.st_size,
                "createdAt": datetime.fromtimestamp(stat.st_mtime, MONGOLIA_TZ).isoformat(),
            }
        )
    backups.sort(key=lambda item: item["createdAt"], reverse=True)
    return backups


def read_json_object(file_path, default):
    ensure_data_store()
    if not file_path.exists():
        file_path.write_text(json.dumps(default, indent=2, ensure_ascii=False), encoding="utf-8")
        return copy.deepcopy(default)
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        data = copy.deepcopy(default)
    if not isinstance(data, dict):
        data = copy.deepcopy(default)
    return data


def write_json_object(file_path, payload):
    ensure_data_store()
    file_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def read_contracts():
    return read_json_list(CONTRACTS_FILE)


def write_contracts(contracts):
    write_json_list(CONTRACTS_FILE, contracts)


def read_ds160_applications():
    return read_json_list(DS160_FILE)


def write_ds160_applications(records):
    write_json_list(DS160_FILE, records)


def read_finance_entries():
    return read_json_list(FINANCE_FILE)


def write_finance_entries(records):
    write_json_list(FINANCE_FILE, records)


def read_bookings():
    return read_json_list(BOOKINGS_FILE)


def write_bookings(records):
    write_json_list(BOOKINGS_FILE, records)


def read_reservations():
    return read_json_list(RESERVATIONS_FILE)


def write_reservations(records):
    write_json_list(RESERVATIONS_FILE, records)


def read_camp_reservations():
    return read_json_list(CAMP_RESERVATIONS_FILE)


def write_camp_reservations(records):
    write_json_list(CAMP_RESERVATIONS_FILE, records)


def read_camp_trips():
    return read_json_list(CAMP_TRIPS_FILE)


def write_camp_trips(records):
    write_json_list(CAMP_TRIPS_FILE, records)


def normalize_option_list(values):
    cleaned = []
    for value in values or []:
        text = normalize_text(value)
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned


def default_camp_settings():
    return {
        "campNames": ["Khustai camp"],
        "locationNames": ["Khustai"],
        "staffAssignments": [STEPPE_MANAGER],
        "roomChoices": DEFAULT_ROOM_CHOICES,
        "campLocations": {"Khustai camp": "Khustai"},
    }


def normalize_camp_location_map(payload, camp_names=None):
    normalized = {}
    if isinstance(payload, dict):
        items = payload.items()
    else:
        items = []
    for camp_name, location_name in items:
        camp_text = normalize_text(camp_name)
        location_text = normalize_text(location_name)
        if camp_text:
            normalized[camp_text] = location_text
    for camp_name in camp_names or []:
        normalized.setdefault(camp_name, "")
    return normalized


def read_camp_settings():
    payload = read_json_object(CAMP_SETTINGS_FILE, default_camp_settings())
    camp_names = normalize_option_list(payload.get("campNames")) or ["Khustai camp"]
    camp_locations = normalize_camp_location_map(payload.get("campLocations"), camp_names)
    location_names = normalize_option_list(payload.get("locationNames")) or ["Khustai"]
    location_names = normalize_option_list(location_names + [value for value in camp_locations.values() if value])
    return {
        "campNames": camp_names,
        "locationNames": location_names,
        "staffAssignments": normalize_option_list(payload.get("staffAssignments")) or [STEPPE_MANAGER],
        "roomChoices": normalize_option_list(payload.get("roomChoices")) or DEFAULT_ROOM_CHOICES,
        "campLocations": camp_locations,
    }


def write_camp_settings(payload):
    write_json_object(CAMP_SETTINGS_FILE, payload)


def json_response(start_response, status, payload, extra_headers=None):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
    ]
    if extra_headers:
        headers.extend(extra_headers)
    start_response(status, headers)
    return [body]


def text_response(start_response, status, text, extra_headers=None):
    body = text.encode("utf-8")
    headers = [
        ("Content-Type", "text/plain; charset=utf-8"),
        ("Content-Length", str(len(body))),
    ]
    if extra_headers:
        headers.extend(extra_headers)
    start_response(status, headers)
    return [body]


def bytes_response(start_response, status, body, content_type, extra_headers=None):
    headers = [
        ("Content-Type", content_type),
        ("Content-Length", str(len(body))),
    ]
    if extra_headers:
        headers.extend(extra_headers)
    start_response(status, headers)
    return [body]


def file_response(start_response, file_path, extra_headers=None):
    mime_type, _ = mimetypes.guess_type(file_path.name)
    body = file_path.read_bytes()
    headers = [
        ("Content-Type", mime_type or "application/octet-stream"),
        ("Content-Length", str(len(body))),
    ]
    if extra_headers:
        headers.extend(extra_headers)
    start_response("200 OK", headers)
    return [body]


def generated_download_headers(file_path):
    if file_path.suffix.lower() != ".pdf":
        return None
    return [("Content-Disposition", f'attachment; filename="{file_path.name}"')]


def collect_json(environ):
    try:
        content_length = int(environ.get("CONTENT_LENGTH") or "0")
        raw_body = environ["wsgi.input"].read(content_length)
        return json.loads(raw_body.decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None


def is_authorized(environ):
    query = environ.get("QUERY_STRING", "")
    params = {}
    for pair in query.split("&"):
        if "=" not in pair:
            continue
        key, value = pair.split("=", 1)
        params[key] = value
    return params.get("token") == ADMIN_TOKEN or environ.get("HTTP_X_ADMIN_TOKEN") == ADMIN_TOKEN


def build_user_account(payload):
    return {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "approvedAt": "",
        "resetRequestedAt": "",
        "lastLoginAt": "",
        "fullName": normalize_text(payload.get("fullName")),
        "email": normalize_text(payload.get("email")).lower(),
        "passwordHash": hash_password(payload.get("password") or ""),
        "role": "staff",
        "status": "pending",
    }


def validate_user_account(payload):
    email = normalize_text(payload.get("email")).lower()
    password = str(payload.get("password") or "")
    if not email or "@" not in email:
        return "Valid email is required"
    if len(password) < 6:
        return "Password must be at least 6 characters"
    if "confirmPassword" in payload and str(payload.get("confirmPassword") or "") != password:
        return "Passwords do not match"
    return None


def create_session(user_id):
    sessions = read_sessions()
    token = secrets.token_urlsafe(32)
    sessions = [item for item in sessions if item.get("userId") != user_id]
    sessions.insert(0, {
        "token": token,
        "userId": user_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })
    write_sessions(sessions)
    return token


def handle_auth_register(environ, start_response):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    error = validate_user_account(payload)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    if find_user_by_email(payload.get("email")):
        return json_response(start_response, "400 Bad Request", {"error": "This email is already registered"})
    users = read_users()
    users.insert(0, build_user_account(payload))
    write_users(users)
    return json_response(start_response, "201 Created", {"ok": True, "message": "Your account request was sent. Wait for admin approval."})


def handle_auth_request_reset(environ, start_response):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    email = normalize_text(payload.get("email")).lower()
    if not email or "@" not in email:
        return json_response(start_response, "400 Bad Request", {"error": "Valid email is required"})
    users = read_users()
    for user in users:
        if user.get("email") == email:
            user["resetRequestedAt"] = datetime.now(timezone.utc).isoformat()
            break
    write_users(users)
    return json_response(start_response, "200 OK", {"ok": True, "message": "If the account exists, a reset request was sent to admin."})


def handle_auth_bootstrap_admin(environ, start_response):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    if payload.get("adminToken") != ADMIN_TOKEN:
        return json_response(start_response, "401 Unauthorized", {"error": "Invalid admin token"})
    if any(user.get("role") == "admin" for user in read_users()):
        return json_response(start_response, "400 Bad Request", {"error": "Admin account already exists"})
    error = validate_user_account(payload)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    user = build_user_account(payload)
    user["role"] = "admin"
    user["status"] = "approved"
    user["approvedAt"] = datetime.now(timezone.utc).isoformat()
    users = read_users()
    users.insert(0, user)
    write_users(users)
    token = create_session(user["id"])
    return json_response(
        start_response,
        "201 Created",
        {"ok": True, "user": sanitize_user(user)},
        extra_headers=[("Set-Cookie", make_session_cookie(token))],
    )


def handle_auth_login(environ, start_response):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    user = find_user_by_email(payload.get("email"))
    if not user or user.get("passwordHash") != hash_password(payload.get("password") or ""):
        return json_response(start_response, "401 Unauthorized", {"error": "Incorrect email or password"})
    if user.get("status") != "approved":
        return json_response(start_response, "403 Forbidden", {"error": f"Your account is {user.get('status', 'pending')}. Wait for admin approval."})
    token = create_session(user["id"])
    users = read_users()
    for item in users:
        if item["id"] == user["id"]:
            item["lastLoginAt"] = datetime.now(timezone.utc).isoformat()
    write_users(users)
    return json_response(
        start_response,
        "200 OK",
        {"ok": True, "user": sanitize_user(find_user_by_id(user["id"]))},
        extra_headers=[("Set-Cookie", make_session_cookie(token))],
    )


def handle_auth_logout(environ, start_response):
    token = parse_cookies(environ).get(SESSION_COOKIE)
    if token:
        sessions = [item for item in read_sessions() if item.get("token") != token]
        write_sessions(sessions)
    return json_response(
        start_response,
        "200 OK",
        {"ok": True},
        extra_headers=[("Set-Cookie", clear_session_cookie())],
    )


def handle_auth_me(environ, start_response):
    user = current_user(environ)
    if not user:
        return json_response(start_response, "401 Unauthorized", {"error": "Not logged in"})
    return json_response(start_response, "200 OK", {"user": user})


def handle_auth_profile_update(environ, start_response):
    user = require_login(environ, start_response)
    if not user:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    full_name = normalize_text(payload.get("fullName"))
    if len(full_name) < 2:
        return json_response(start_response, "400 Bad Request", {"error": "Name must be at least 2 characters"})

    users = read_users()
    for record in users:
        if record.get("id") != user.get("id"):
            continue
        record["fullName"] = full_name
        write_users(users)
        return json_response(start_response, "200 OK", {"ok": True, "user": sanitize_user(record)})

    return json_response(start_response, "404 Not Found", {"error": "User not found"})


def handle_list_users(environ, start_response):
    admin = require_admin(environ, start_response)
    if not admin:
        return []
    users = [sanitize_user(user) for user in read_users()]
    return json_response(start_response, "200 OK", {"entries": users})


def handle_update_user(environ, start_response, user_id):
    admin = require_admin(environ, start_response)
    if not admin:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    users = read_users()
    for user in users:
        if user["id"] != user_id:
            continue
        if "status" in payload:
            user["status"] = normalize_text(payload.get("status")).lower()
            if user["status"] == "approved":
                user["approvedAt"] = datetime.now(timezone.utc).isoformat()
        if "role" in payload:
            user["role"] = normalize_text(payload.get("role")).lower() or user["role"]
        if "fullName" in payload:
            user["fullName"] = normalize_text(payload.get("fullName"))
        if "password" in payload:
            password = str(payload.get("password") or "")
            if len(password) < 6:
                return json_response(start_response, "400 Bad Request", {"error": "Password must be at least 6 characters"})
            user["passwordHash"] = hash_password(password)
            user["resetRequestedAt"] = ""
        write_users(users)
        return json_response(start_response, "200 OK", {"ok": True, "user": sanitize_user(user)})
    return json_response(start_response, "404 Not Found", {"error": "User not found"})


def handle_delete_user(environ, start_response, user_id):
    admin = require_admin(environ, start_response)
    if not admin:
        return []
    if user_id == admin.get("id"):
        return json_response(start_response, "400 Bad Request", {"error": "You cannot delete your own admin account"})

    users = read_users()
    before = len(users)
    users = [user for user in users if user.get("id") != user_id]
    if len(users) == before:
        return json_response(start_response, "404 Not Found", {"error": "User not found"})

    sessions = [session for session in read_sessions() if session.get("userId") != user_id]
    write_users(users)
    write_sessions(sessions)
    return json_response(start_response, "200 OK", {"ok": True})


def request_host(environ):
    host = environ.get("HTTP_HOST") or environ.get("SERVER_NAME") or ""
    return host.split(":", 1)[0].strip().lower()


def format_money(value):
    digits = re.sub(r"[^\d]", "", str(value or "0"))
    if not digits:
        digits = "0"
    return f"{int(digits):,}"


def normalize_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slugify(value):
    cleaned = re.sub(r"[^a-zA-Z0-9а-яА-ЯөүӨҮёЁ]+", "-", normalize_text(value))
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    return cleaned or "contract"


def parse_int(value):
    digits = re.sub(r"[^\d]", "", str(value or "0"))
    return int(digits or "0")


def now_mongolia():
    return datetime.now(MONGOLIA_TZ)


def today_mongolia():
    return now_mongolia().strftime("%Y-%m-%d")


def parse_date_input(value):
    text = normalize_text(value)
    if not text:
        return None
    for pattern in ("%Y-%m-%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(text, pattern).date()
        except ValueError:
            continue
    return None


def normalize_stay_fields(check_in, nights, check_out):
    check_in_text = normalize_text(check_in)
    check_out_text = normalize_text(check_out)
    check_in_date = parse_date_input(check_in_text)
    check_out_date = parse_date_input(check_out_text)
    stay_count = parse_int(nights) or 0

    if not check_in_date:
        return check_in_text, max(stay_count, 1), check_out_text

    if stay_count > 0:
        check_out_date = check_in_date + timedelta(days=stay_count)
    elif check_out_date and check_out_date > check_in_date:
        stay_count = (check_out_date - check_in_date).days
    else:
        stay_count = 1
        check_out_date = check_in_date + timedelta(days=stay_count)

    return check_in_text, stay_count, check_out_date.strftime("%Y-%m-%d")


def read_users():
    return read_json_list(USERS_FILE)


def write_users(records):
    write_json_list(USERS_FILE, records)


def read_sessions():
    return read_json_list(SESSIONS_FILE)


def write_sessions(records):
    write_json_list(SESSIONS_FILE, records)


def hash_password(password):
    return hashlib.sha256(f"{SESSION_SECRET}:{password}".encode("utf-8")).hexdigest()


def parse_cookies(environ):
    raw = environ.get("HTTP_COOKIE", "")
    cookies = {}
    for part in raw.split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        cookies[key.strip()] = value.strip()
    return cookies


def make_session_cookie(token, max_age=60 * 60 * 24 * 30):
    return f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}"


def clear_session_cookie():
    return f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"


def sanitize_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "fullName": user.get("fullName", ""),
        "role": user.get("role", "staff"),
        "status": user.get("status", "pending"),
        "createdAt": user.get("createdAt"),
        "approvedAt": user.get("approvedAt"),
        "resetRequestedAt": user.get("resetRequestedAt"),
        "lastLoginAt": user.get("lastLoginAt"),
    }


def actor_snapshot(user):
    if not user:
        return {"id": "", "email": "system", "name": "System"}
    return {
        "id": user.get("id", ""),
        "email": user.get("email", ""),
        "name": user.get("fullName") or user.get("email", ""),
    }


def find_user_by_email(email):
    needle = normalize_text(email).lower()
    for user in read_users():
        if user.get("email") == needle:
            return user
    return None


def find_user_by_id(user_id):
    for user in read_users():
        if user.get("id") == user_id:
            return user
    return None


def bootstrap_admin_user():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        return
    users = json.loads(USERS_FILE.read_text(encoding="utf-8"))
    if any(user.get("role") == "admin" for user in users):
        return
    users.insert(0, {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "approvedAt": datetime.now(timezone.utc).isoformat(),
        "resetRequestedAt": "",
        "lastLoginAt": "",
        "fullName": "Admin",
        "email": ADMIN_EMAIL,
        "passwordHash": hash_password(ADMIN_PASSWORD),
        "role": "admin",
        "status": "approved",
    })
    USERS_FILE.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")


def current_user(environ):
    token = parse_cookies(environ).get(SESSION_COOKIE)
    if not token:
        return None
    sessions = read_sessions()
    match = next((item for item in sessions if item.get("token") == token), None)
    if not match:
        return None
    user = find_user_by_id(match.get("userId"))
    if not user or user.get("status") != "approved":
        return None
    return sanitize_user(user)


def require_login(environ, start_response):
    user = current_user(environ)
    if user:
        return user
    json_response(start_response, "401 Unauthorized", {"error": "Login required"})
    return None


def require_admin(environ, start_response):
    user = current_user(environ)
    if not user:
        json_response(start_response, "401 Unauthorized", {"error": "Login required"})
        return None
    if user.get("role") != "admin":
        json_response(start_response, "403 Forbidden", {"error": "Admin access required"})
        return None
    return user


def backup_token_from_request(environ):
    params = parse_qs(environ.get("QUERY_STRING", ""))
    query_token = (params.get("token", [""])[0] or "").strip()
    header_token = (environ.get("HTTP_X_BACKUP_TOKEN", "") or "").strip()
    return query_token or header_token


def require_backup_admin(environ, start_response):
    user = current_user(environ)
    if user and user.get("role") == "admin":
        return user
    token = backup_token_from_request(environ)
    if BACKUP_TOKEN and token == BACKUP_TOKEN:
        return {"role": "admin", "email": "backup-token", "fullName": "Backup Token"}
    json_response(start_response, "401 Unauthorized", {"error": "Admin access required"})
    return None


def split_date_parts(value):
    raw = str(value or "").split("T", 1)[0]
    parts = raw.split("-")
    if len(parts) == 3:
        return {
            "year": parts[0],
            "month": parts[1],
            "day": parts[2],
        }
    return {"year": "", "month": "", "day": ""}


def format_contract_header_date(value):
    parts = split_date_parts(value)
    return f"{parts['year']} оны {parts['month']} сарын {parts['day']} өдөр"


def format_due_date_ordinal(value):
    parts = split_date_parts(value)
    return f"{parts['year']} оны {parts['month']}-р сарын {int(parts['day'] or '0')}-ий"


def format_balance_due_date(value):
    parts = split_date_parts(value)
    return f"{parts['year']} оны {parts['month']} сарын {int(parts['day'] or '0')}-ий"


def build_contract_data(payload):
    today = datetime.now().strftime("%Y-%m-%d")
    contract_date = payload.get("contractDate") or today
    tourist_last_name = normalize_text(payload.get("touristLastName"))
    tourist_first_name = normalize_text(payload.get("touristFirstName"))
    adult_count = parse_int(payload.get("adultCount"))
    child_count = parse_int(payload.get("childCount"))
    traveler_count = parse_int(payload.get("travelerCount")) or adult_count + child_count
    total_price_raw = parse_int(payload.get("totalPrice"))
    deposit_raw = parse_int(payload.get("depositAmount"))
    balance_raw = max(total_price_raw - deposit_raw, 0)

    data = {
        "contractSerial": normalize_text(payload.get("contractSerial")),
        "contractDate": contract_date,
        "touristLastName": tourist_last_name,
        "touristFirstName": tourist_first_name,
        "touristRegister": normalize_text(payload.get("touristRegister")),
        "destination": normalize_text(payload.get("destination")),
        "tripStartDate": normalize_text(payload.get("tripStartDate")),
        "tripEndDate": normalize_text(payload.get("tripEndDate")),
        "tripDuration": normalize_text(payload.get("tripDuration")),
        "adultCount": adult_count,
        "childCount": child_count,
        "travelerCount": traveler_count,
        "adultPrice": format_money(payload.get("adultPrice")),
        "childPrice": format_money(payload.get("childPrice")),
        "noFlightPrice": format_money(payload.get("noFlightPrice")),
        "totalPrice": format_money(payload.get("totalPrice")),
        "depositAmount": format_money(payload.get("depositAmount")),
        "balanceAmount": format_money(balance_raw),
        "depositDueDate": normalize_text(payload.get("depositDueDate")),
        "balanceDueDate": normalize_text(payload.get("balanceDueDate")),
    }
    data["touristSignature"] = (
        f"{data['touristLastName'][:1]}.{data['touristFirstName']}" if data["touristLastName"] else data["touristFirstName"]
    )
    return data


def validate_contract_data(data):
    required = [
        "contractSerial",
        "contractDate",
        "touristLastName",
        "touristFirstName",
        "touristRegister",
        "destination",
        "tripStartDate",
        "tripEndDate",
        "tripDuration",
        "totalPrice",
        "depositAmount",
        "depositDueDate",
        "balanceDueDate",
    ]
    missing = [field for field in required if not str(data.get(field, "")).strip()]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None


def qname(tag):
    return f"{{{WORD_NS}}}{tag}"


def paragraph_text(paragraph):
    return "".join(node.text or "" for node in paragraph.findall(f".//{qname('t')}")).strip()


def set_paragraph_text(paragraph, text):
    paragraph_props = None
    first_run_props = None

    for child in list(paragraph):
        if child.tag == qname("pPr"):
            paragraph_props = copy.deepcopy(child)
        if first_run_props is None and child.tag == qname("r"):
            run_props = child.find(qname("rPr"))
            if run_props is not None:
                first_run_props = copy.deepcopy(run_props)

    paragraph.clear()

    if paragraph_props is not None:
        paragraph.append(paragraph_props)

    if not text:
        return

    run = ET.Element(qname("r"))
    if first_run_props is not None:
        run.append(first_run_props)

    text_node = ET.Element(qname("t"))
    if text[:1].isspace() or text[-1:].isspace():
        text_node.set(f"{{{XML_NS}}}space", "preserve")
    text_node.text = text
    run.append(text_node)
    paragraph.append(run)


def replace_template_paragraphs(root, data):
    replacements = {
        "Дугаар: DTX-09А-26-_____": f"Дугаар: DTX-09А-26-{data['contractSerial']}",
        "2026 оны 03 сарын 13 өдөр                                                                                Улаанбаатар хот":
            f"{format_contract_header_date(data['contractDate'])}                                                                                Улаанбаатар хот",
        "Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл, Иргэний хуулийн 370-379 дүгээр зүйлийг үндэслэн нэг талаас “Дэлхий Трэвел Икс” ХХК (РД:6925073) цаашид Дэлхий Трэвел Икс гэхийг төлөөлөн аяллын менежер албан тушаалтай Чулуунбаатар овогтой Нямбаяр, нөгөө талаас Жуулчин цаашид “Жуулчин” гэхийг төлөөлөн Цэдэн-Иш овогтой Чинзориг (РД: ШЕ77111832) нар харилцан тохиролцож энэхүү аялал жуулчлалын гэрээг байгуулав.":
            "Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл, Иргэний хуулийн 370-379 дүгээр зүйлийг үндэслэн нэг талаас “Дэлхий Трэвел Икс” ХХК (РД:6925073) цаашид Дэлхий Трэвел Икс гэхийг төлөөлөн аяллын менежер албан тушаалтай Чулуунбаатар овогтой Нямбаяр, нөгөө талаас Жуулчин цаашид “Жуулчин” гэхийг төлөөлөн "
            f"{data['touristLastName']} овогтой {data['touristFirstName']} (РД: {data['touristRegister']}) нар харилцан тохиролцож энэхүү аялал жуулчлалын гэрээг байгуулав.",
        "Энэхүү гэрээгээр Дэлхий Трэвел Икс нь 2026/03/28-2026/04/03 хооронд Турк аялал, 7 өдөр 6 шөнө, хөтөлбөртэй аяллын дагуу 5 аялагчдад үйлчилгээг үзүүлэх, аялал зохион байгуулах, Жуулчин нь гэрээний нөхцөлийн дагуу төлбөрийг төлөх, аяллын үйлчилгээ авахтай холбоотой талуудын эдлэх эрх, үүрэг, хариуцлага, төлбөр тооцоотой холбогдон үүссэн харилцааг зохицуулна.":
            f"Энэхүү гэрээгээр Дэлхий Трэвел Икс нь {data['tripStartDate']}-{data['tripEndDate']} хооронд {data['destination']}, {data['tripDuration']}, хөтөлбөртэй аяллын дагуу {data['travelerCount']} аялагчдад үйлчилгээг үзүүлэх, аялал зохион байгуулах, Жуулчин нь гэрээний нөхцөлийн дагуу төлбөрийг төлөх, аяллын үйлчилгээ авахтай холбоотой талуудын эдлэх эрх, үүрэг, хариуцлага, төлбөр тооцоотой холбогдон үүссэн харилцааг зохицуулна.",
        "Энэхүү гэрээгээр аялагчийн төлбөр нь 3 том хүний 3,990,000 төгрөг, 1 хүүхдийн 3,390,000  төгрөг, 1 хүний онгоц ороогүй дүн 2,590,000 төгрөг,  нийт 5 аялагчийн аяллын төлбөр 17,450,000 төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно.":
            f"Энэхүү гэрээгээр аялагчийн төлбөр нь {data['adultCount']} том хүний {data['adultPrice']} төгрөг, {data['childCount']} хүүхдийн {data['childPrice']} төгрөг, 1 хүний онгоц ороогүй дүн {data['noFlightPrice']} төгрөг, нийт {data['travelerCount']} аялагчийн аяллын төлбөр {data['totalPrice']} төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно.",
        "Аяллын төлбөр дараах байдлаар хийгдэнэ. 5.3.1.Аяллын урьдчилгаа төлбөр болох 8,725,000 төгрөгийг 2026 оны 03-р сарын":
            f" Аяллын төлбөр дараах байдлаар хийгдэнэ. 5.3.1. Аяллын урьдчилгаа төлбөр болох {data['depositAmount']} төгрөгийг {format_due_date_ordinal(data['depositDueDate'])} дотор “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN030034343277779999 дугаартай дансанд хийснээр аялал баталгаажна.",
        "13 -ий дотор “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны":
            "",
        "MN030034343277779999 дугаартай дансанд хийснээр аялал баталгаажна.":
            "",
        "5.3.2. Аяллын үлдэгдэлийг 2026 оны 03 сарын 20-ий дотор “Дэлхий Трэвел Икс”  ХХК-ний  Төрийн Банкны MN030034343277779999 дугаартай дансанд хийхээр тохиролцов.":
            f"5.3.2. Аяллын үлдэгдэлийг {format_balance_due_date(data['balanceDueDate'])} дотор “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN030034343277779999 дугаартай дансанд хийхээр тохиролцов.",
        "Ц.Чинзориг":
            data["touristSignature"],
        "2025 оны 01 сарын  21 өдөр                     № 25 / ПУКЕТ                      Улаанбаатар хот":
            f"{format_contract_header_date(data['contractDate'])}                     № {data['contractSerial']} / {data['destination']}                      Улаанбаатар хот",
        "Нэг талаас Дэлхий Трэвел Икс ХХК (6925073 )/цаашид “Аялал зохион байгуулагч” гэх/ түүнийг төлөөлөн менежер Ч.Нямбаяр,":
            "Нэг талаас Дэлхий Трэвел Икс ХХК (6925073 )/цаашид “Аялал зохион байгуулагч” гэх/ түүнийг төлөөлөн менежер Ч.Нямбаяр,",
        "Нөгөө талаас 21 аялагчийг төлөөлөн, ХХХХХХХХ овогтой XXXXXXXX (РД: ДЙ91101311) /цаашид “Захиалагч” гэх/ нар дор дурдсан нөхцөлөөр харилцан тохиролцож  байгуулав.":
            f"Нөгөө талаас {data['travelerCount']} аялагчийг төлөөлөн, {data['touristLastName']} овогтой {data['touristFirstName']} (РД: {data['touristRegister']}) /цаашид “Захиалагч” гэх/ нар дор дурдсан нөхцөлөөр харилцан тохиролцож  байгуулав.",
        "Энэхүү гэрээгээр Аялал зохион байгуулагч нь захиалагчийн хүсэлтээр Тайланд улсын Пукет арлаар аялах хөтөлбөртэй аяллыг 2025/02/16 – 2025/02/23-ны хооронд 8 өдөр 7 шөнөөр тооцож энэ гэрээнд заагдсан аяллыг зохион байгуулах,":
            f"Энэхүү гэрээгээр Аялал зохион байгуулагч нь захиалагчийн хүсэлтээр {data['destination']} чиглэлд аялах хөтөлбөртэй аяллыг {data['tripStartDate']} – {data['tripEndDate']}-ны хооронд {data['tripDuration']} тооцож энэ гэрээнд заагдсан аяллыг зохион байгуулах,",
        "1 том хүний 4’590’000 төгрөг, нийт 21 хүний 96,390,000 төгрөг байхаар харилцан тохиров.":
            f"{data['adultCount']} том хүний {data['adultPrice']} төгрөг, нийт {data['travelerCount']} хүний {data['totalPrice']} төгрөг байхаар харилцан тохиров.",
        "Аяллын урьдчилгаа төлбөр болох 10,980,000 төгрөгийг  2026 оны 01 сарын 24 –ны өдрийн дотор Төрийн банкны MN030034 3432 7777 9999 тоот төгрөгийн дансанд шилжүүлнэ.":
            f"Аяллын урьдчилгаа төлбөр болох {data['depositAmount']} төгрөгийг  {format_balance_due_date(data['depositDueDate'])} өдрийн дотор Төрийн банкны MN030034 3432 7777 9999 тоот төгрөгийн дансанд шилжүүлнэ.",
        "Аяллын үлдэгдэл болох 10,980,000 төгрөгийг  2026 оны 01 сарын 24 –ны өдрийн дотор Төрийн банкны MN030034 3432 7777 9999 тоот төгрөгийн дансанд шилжүүлнэ.":
            f"Аяллын үлдэгдэл болох {data['balanceAmount']} төгрөгийг  {format_balance_due_date(data['balanceDueDate'])} өдрийн дотор Төрийн банкны MN030034 3432 7777 9999 тоот төгрөгийн дансанд шилжүүлнэ.",
        "XXXXX Овогтой XXXXXXXX":
            f"{data['touristLastName']} Овогтой {data['touristFirstName']}",
    }

    for paragraph in root.findall(f".//{qname('p')}"):
        current_text = paragraph_text(paragraph)
        if current_text in replacements:
            set_paragraph_text(paragraph, replacements[current_text])


def generate_docx(data, output_path):
    ensure_data_store()
    template_path = TEMPLATE_FILE
    if not template_path.exists() and TEMPLATE_FALLBACK.exists():
        template_path = TEMPLATE_FALLBACK
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found at {template_path}")

    with zipfile.ZipFile(template_path, "r") as source_zip:
        document_xml = source_zip.read("word/document.xml")
        root = ET.fromstring(document_xml)
        replace_template_paragraphs(root, data)
        new_document_xml = ET.tostring(root, encoding="utf-8", xml_declaration=True)

        with zipfile.ZipFile(output_path, "w") as target_zip:
            for item in source_zip.infolist():
                content = source_zip.read(item.filename)
                if item.filename == "word/document.xml":
                    content = new_document_xml
                target_zip.writestr(item, content)


def build_contract_html(data):
    contract_date = format_contract_header_date(data["contractDate"])
    return f"""<!DOCTYPE html>
<html lang="mn">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Аялал жуулчлалын гэрээ</title>
    <style>
      :root {{
        color-scheme: light;
        --ink: #1d1d1b;
        --paper: #fffdf8;
        --accent: #b33a3a;
        --muted: #6e645f;
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        background:
          radial-gradient(circle at top, rgba(179, 58, 58, 0.10), transparent 35%),
          linear-gradient(180deg, #f4eadf 0%, #efe4d6 100%);
        color: var(--ink);
        font-family: "Times New Roman", serif;
      }}
      .toolbar {{
        position: sticky;
        top: 0;
        display: flex;
        gap: 12px;
        justify-content: center;
        padding: 16px;
        background: rgba(255, 253, 248, 0.92);
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        backdrop-filter: blur(10px);
      }}
      .toolbar button, .toolbar a {{
        padding: 12px 18px;
        border-radius: 999px;
        border: none;
        background: var(--accent);
        color: white;
        text-decoration: none;
        font: 600 14px/1.2 sans-serif;
        cursor: pointer;
      }}
      .toolbar a.secondary {{
        background: #2f4858;
      }}
      .page {{
        width: min(920px, calc(100vw - 32px));
        margin: 24px auto 56px;
        padding: 56px 64px;
        background: var(--paper);
        box-shadow: 0 20px 60px rgba(71, 53, 43, 0.18);
      }}
      h1 {{
        margin: 0 0 8px;
        text-align: center;
        font-size: 28px;
        letter-spacing: 0.06em;
      }}
      .meta {{
        display: flex;
        justify-content: space-between;
        margin-bottom: 32px;
        color: var(--muted);
      }}
      h2 {{
        margin: 28px 0 12px;
        font-size: 18px;
      }}
      p {{
        margin: 0 0 12px;
        font-size: 16px;
        line-height: 1.6;
        text-align: justify;
      }}
      @media print {{
        body {{ background: white; }}
        .toolbar {{ display: none; }}
        .page {{
          width: auto;
          margin: 0;
          padding: 24px;
          box-shadow: none;
        }}
      }}
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button onclick="window.print()">Save as PDF</button>
      <a class="secondary" href="/">Back to form</a>
    </div>
    <main class="page">
      <h1>АЯЛАЛ ЖУУЛЧЛАЛЫН ГЭРЭЭ</h1>
      <div class="meta">
        <span>Дугаар: DTX-09А-26-{data['contractSerial']}</span>
        <span>{contract_date} · Улаанбаатар хот</span>
      </div>

      <p>Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл, Иргэний хуулийн 370-379 дүгээр зүйлийг үндэслэн нэг талаас “Дэлхий Трэвел Икс” ХХК (РД:6925073) цаашид Дэлхий Трэвел Икс гэхийг төлөөлөн аяллын менежер албан тушаалтай Чулуунбаатар овогтой Нямбаяр, нөгөө талаас Жуулчин цаашид “Жуулчин” гэхийг төлөөлөн {data['touristLastName']} овогтой {data['touristFirstName']} (РД: {data['touristRegister']}) нар харилцан тохиролцож энэхүү аялал жуулчлалын гэрээг байгуулав.</p>

      <h2>ЕРӨНХИЙ ЗҮЙЛ</h2>
      <p>Энэхүү гэрээгээр Дэлхий Трэвел Икс нь {data['tripStartDate']}-{data['tripEndDate']} хооронд {data['destination']}, {data['tripDuration']}, хөтөлбөртэй аяллын дагуу {data['travelerCount']} аялагчдад үйлчилгээг үзүүлэх, аялал зохион байгуулах, Жуулчин нь гэрээний нөхцөлийн дагуу төлбөрийг төлөх, аяллын үйлчилгээ авахтай холбоотой талуудын эдлэх эрх, үүрэг, хариуцлага, төлбөр тооцоотой холбогдон үүссэн харилцааг зохицуулна.</p>
      <p>Хөтөлбөртэй аяллаар захиалсан бол Хавсралт 1 – Аяллын хөтөлбөр нь гэрээний салшгүй хэсэг байна.</p>
      <p>Зорчих чиглэл нь визтэй бол энэхүү гэрээний Хавсралт 2 – Харилцан ойлголцлын санамж бичиг нь гэрээний салшгүй хэсэг байна.</p>

      <h2>АЯЛЛЫН ЗАРДАЛ, ТӨЛБӨР ТООЦОО</h2>
      <p>Энэхүү гэрээгээр аялагчийн төлбөр нь {data['adultCount']} том хүний {data['adultPrice']} төгрөг, {data['childCount']} хүүхдийн {data['childPrice']} төгрөг, 1 хүний онгоц ороогүй дүн {data['noFlightPrice']} төгрөг, нийт {data['travelerCount']} аялагчийн аяллын төлбөр {data['totalPrice']} төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно.</p>
      <p>Аяллын төлбөр дараах байдлаар хийгдэнэ. 5.3.1. Аяллын урьдчилгаа төлбөр болох {data['depositAmount']} төгрөгийг {format_due_date_ordinal(data['depositDueDate'])} дотор “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN030034343277779999 дугаартай дансанд хийснээр аялал баталгаажна.</p>
      <p>5.3.2. Аяллын үлдэгдэлийг {format_balance_due_date(data['balanceDueDate'])} дотор “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN030034343277779999 дугаартай дансанд хийхээр тохиролцов.</p>
    </main>
  </body>
</html>
"""


def register_contract_font():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    font_name = "Times-Roman"
    bold_font_name = "Times-Bold"

    for candidate in [
        "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
        "/Library/Fonts/Times New Roman.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]:
        if Path(candidate).exists():
            pdfmetrics.registerFont(TTFont("TravelXContract", candidate))
            font_name = "TravelXContract"
            bold_font_name = "TravelXContract"
            break

    return font_name, bold_font_name


def draw_wrapped_text(pdf, text, x, y, max_width, font_name, font_size, leading=16):
    from reportlab.lib.utils import simpleSplit

    lines = simpleSplit(text, font_name, font_size, max_width)
    pdf.setFont(font_name, font_size)
    for line in lines:
        pdf.drawString(x, y, line)
        y -= leading
    return y


def save_contract_pdf(record):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    ensure_data_store()
    data = record["data"]
    pdf_filename = f"contract-{record['id']}.pdf"
    pdf_path = GENERATED_DIR / pdf_filename
    width, height = A4
    pdf = canvas.Canvas(str(pdf_path), pagesize=A4)

    font_name, bold_font_name = register_contract_font()
    margin_x = 50
    current_y = height - 60

    pdf.setFont(bold_font_name, 18)
    pdf.drawCentredString(width / 2, current_y, "АЯЛАЛ ЖУУЛЧЛАЛЫН ГЭРЭЭ")
    current_y -= 30

    contract_date = format_contract_header_date(data["contractDate"])
    pdf.setFont(font_name, 11)
    pdf.drawString(margin_x, current_y, f"Дугаар: DTX-09А-26-{data['contractSerial']}")
    pdf.drawRightString(width - margin_x, current_y, f"{contract_date} · Улаанбаатар хот")
    current_y -= 24

    paragraphs = [
        "Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл, Иргэний хуулийн 370-379 дүгээр зүйлийг үндэслэн нэг талаас “Дэлхий Трэвел Икс” ХХК (РД:6925073) цаашид Дэлхий Трэвел Икс гэхийг төлөөлөн аяллын менежер албан тушаалтай Чулуунбаатар овогтой Нямбаяр, нөгөө талаас Жуулчин цаашид “Жуулчин” гэхийг төлөөлөн "
        f"{data['touristLastName']} овогтой {data['touristFirstName']} (РД: {data['touristRegister']}) нар харилцан тохиролцож энэхүү аялал жуулчлалын гэрээг байгуулав.",
        "ЕРӨНХИЙ ЗҮЙЛ",
        f"Энэхүү гэрээгээр Дэлхий Трэвел Икс нь {data['tripStartDate']}-{data['tripEndDate']} хооронд {data['destination']}, {data['tripDuration']}, хөтөлбөртэй аяллын дагуу {data['travelerCount']} аялагчдад үйлчилгээг үзүүлэх, аялал зохион байгуулах, Жуулчин нь гэрээний нөхцөлийн дагуу төлбөрийг төлөх, аяллын үйлчилгээ авахтай холбоотой талуудын эдлэх эрх, үүрэг, хариуцлага, төлбөр тооцоотой холбогдон үүссэн харилцааг зохицуулна.",
        "Хөтөлбөртэй аяллаар захиалсан бол Хавсралт 1 – Аяллын хөтөлбөр нь гэрээний салшгүй хэсэг байна.",
        "Зорчих чиглэл нь визтэй бол энэхүү гэрээний Хавсралт 2 – Харилцан ойлголцлын санамж бичиг нь гэрээний салшгүй хэсэг байна.",
        "АЯЛЛЫН ЗАРДАЛ, ТӨЛБӨР ТООЦОО",
        f"Энэхүү гэрээгээр аялагчийн төлбөр нь {data['adultCount']} том хүний {data['adultPrice']} төгрөг, {data['childCount']} хүүхдийн {data['childPrice']} төгрөг, 1 хүний онгоц ороогүй дүн {data['noFlightPrice']} төгрөг, нийт {data['travelerCount']} аялагчийн аяллын төлбөр {data['totalPrice']} төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно.",
        f"Аяллын төлбөр дараах байдлаар хийгдэнэ. 5.3.1. Аяллын урьдчилгаа төлбөр болох {data['depositAmount']} төгрөгийг {format_due_date_ordinal(data['depositDueDate'])} дотор “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN030034343277779999 дугаартай дансанд хийснээр аялал баталгаажна.",
        f"5.3.2. Аяллын үлдэгдэлийг {format_balance_due_date(data['balanceDueDate'])} дотор “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN030034343277779999 дугаартай дансанд хийхээр тохиролцов.",
    ]

    for text in paragraphs:
        if text in {"ЕРӨНХИЙ ЗҮЙЛ", "АЯЛЛЫН ЗАРДАЛ, ТӨЛБӨР ТООЦОО"}:
            current_y -= 8
            pdf.setFont(bold_font_name, 12)
            pdf.drawString(margin_x, current_y, text)
            current_y -= 18
            continue
        current_y = draw_wrapped_text(pdf, text, margin_x, current_y, width - margin_x * 2, font_name, 11, 15)
        current_y -= 8

    signature_y = 140
    pdf.setFont(font_name, 11)
    pdf.drawString(margin_x, signature_y + 48, "Аялал зохион байгуулагч:")
    pdf.drawString(width / 2 + 20, signature_y + 48, "Захиалагч:")

    company_signature = PUBLIC_DIR / "assets" / "nyambayar-signature.png"
    company_stamp = PUBLIC_DIR / "assets" / "dtx-stamp.png"
    if company_signature.exists():
        pdf.drawImage(str(company_signature), margin_x, signature_y, width=140, height=60, mask="auto")
    if company_stamp.exists():
        pdf.drawImage(str(company_stamp), margin_x + 150, signature_y - 10, width=70, height=70, mask="auto")

    signature_path = record.get("signaturePath")
    if signature_path:
        sig_file = (GENERATED_DIR / signature_path.replace("/generated/", "", 1)).resolve()
        if sig_file.exists():
            pdf.drawImage(str(sig_file), width / 2 + 20, signature_y, width=180, height=60, mask="auto")

    pdf.setFont(font_name, 10)
    pdf.drawString(margin_x, signature_y - 20, "Ч.Нямбаяр")
    pdf.drawString(width / 2 + 20, signature_y - 20, record.get("signerName") or data.get("touristFirstName") or "")

    pdf.showPage()
    pdf.save()
    return f"/generated/{pdf_filename}"


def save_contract_files(data):
    contract_id = str(uuid4())
    filename_stem = slugify(
        f"{data['contractDate']}-{data['touristLastName']}-{data['touristFirstName']}-{data['destination']}"
    )
    docx_filename = f"{filename_stem}.docx"
    html_filename = f"{filename_stem}.html"

    docx_path = GENERATED_DIR / docx_filename
    html_path = GENERATED_DIR / html_filename

    generate_docx(data, docx_path)
    html_path.write_text(build_contract_html(data), encoding="utf-8")

    record = {
        "id": contract_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "signedAt": None,
        "signaturePath": None,
        "signerName": None,
        "data": data,
        "docxPath": f"/generated/{docx_filename}",
        "pdfViewPath": f"/generated/{html_filename}",
        "pdfPath": None,
    }
    return record


def save_signature_image(data_url, contract_id):
    if not data_url or "base64," not in data_url:
        return None
    header, encoded = data_url.split("base64,", 1)
    if "image/png" not in header:
        return None
    try:
        raw = base64.b64decode(encoded)
    except Exception:
        return None
    filename = f"contract-signature-{contract_id}.png"
    path = GENERATED_DIR / filename
    path.write_bytes(raw)
    return f"/generated/{filename}"


def build_document_html(title, subtitle, sections):
    section_markup = []
    for heading, content in sections:
        section_markup.append(
            f"<section><h2>{html.escape(heading)}</h2><p>{html.escape(content)}</p></section>"
        )

    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{html.escape(title)}</title>
    <style>
      body {{
        margin: 0;
        padding: 48px 24px;
        background: #f5efe8;
        color: #1f1713;
        font-family: Georgia, "Times New Roman", serif;
      }}
      main {{
        width: min(860px, 100%);
        margin: 0 auto;
        padding: 40px;
        background: white;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
      }}
      h1 {{
        margin-bottom: 8px;
      }}
      .subtitle {{
        margin: 0 0 28px;
        color: #70584a;
      }}
      section {{
        margin-top: 24px;
      }}
      h2 {{
        margin: 0 0 10px;
        font-size: 1.05rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }}
      p {{
        margin: 0;
        line-height: 1.65;
        white-space: pre-wrap;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>{html.escape(title)}</h1>
      <p class="subtitle">{html.escape(subtitle)}</p>
      {''.join(section_markup)}
    </main>
  </body>
</html>
"""


def save_simple_document(prefix, title, subtitle, sections):
    doc_id = str(uuid4())
    filename_stem = slugify(f"{prefix}-{title}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}")
    html_filename = f"{filename_stem}.html"
    doc_filename = f"{filename_stem}.doc"
    html_path = GENERATED_DIR / html_filename
    doc_path = GENERATED_DIR / doc_filename
    html = build_document_html(title, subtitle, sections)
    html_path.write_text(html, encoding="utf-8")
    doc_path.write_text(html, encoding="utf-8")
    return {
        "id": doc_id,
        "wordPath": f"/generated/{doc_filename}",
        "pdfViewPath": f"/generated/{html_filename}",
    }


def format_pdf_date(value):
    parts = split_date_parts(value)
    if not parts["year"]:
        return "-"
    return f"{parts['year']}.{parts['month']}.{parts['day']}"


def format_iso_date(value):
    parts = split_date_parts(value)
    if not parts["year"]:
        return "-"
    return f"{parts['year']}-{parts['month']}-{parts['day']}"


def camp_reservation_title(record):
    reservation_type = normalize_text(record.get("reservationType")).lower() or "camp"
    return RESERVATION_TYPE_LABELS.get(reservation_type, RESERVATION_TYPE_LABELS["camp"])


def camp_reservation_meals(record):
    return " / ".join(
        [
            meal
            for meal in [
                record.get("breakfast") == "Yes" and "Breakfast",
                record.get("lunch") == "Yes" and "Lunch",
                record.get("dinner") == "Yes" and "Dinner",
            ]
            if meal
        ]
    ) or "No meal"


def build_camp_document_html(record, pdf_href):
    meals = camp_reservation_meals(record)
    reservation_title = camp_reservation_title(record)
    manager_name = record.get("staffAssignment") or STEPPE_MANAGER
    return f"""<!DOCTYPE html>
<html lang="mn">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Camp reservation</title>
    <style>
      body {{
        margin: 0;
        background: #f1f0ec;
        color: #161616;
        font-family: Georgia, "Times New Roman", serif;
      }}
      .toolbar {{
        position: sticky;
        top: 0;
        display: flex;
        gap: 12px;
        justify-content: center;
        padding: 16px;
        background: rgba(255,255,255,0.94);
        border-bottom: 1px solid rgba(0,0,0,0.08);
      }}
      .toolbar button, .toolbar a {{
        padding: 12px 18px;
        border: none;
        border-radius: 999px;
        background: #17365f;
        color: #fff;
        text-decoration: none;
        font: 600 14px/1 sans-serif;
        cursor: pointer;
      }}
      .page {{
        width: 920px;
        margin: 22px auto 40px;
        padding: 56px 52px 72px;
        background: white;
        box-shadow: 0 20px 60px rgba(0,0,0,0.1);
      }}
      .logo {{
        color: #1d2f86;
        font: 800 30px/1 "Poppins", Arial, sans-serif;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }}
      .top {{
        display: grid;
        grid-template-columns: 1.1fr 1.2fr;
        gap: 24px;
        align-items: start;
      }}
      .brand-sub {{
        margin-top: 14px;
        color: #4e4e4e;
        line-height: 1.55;
        font-size: 15px;
      }}
      .doc-title {{
        text-align: right;
      }}
      .doc-title h1 {{
        margin: 0;
        font-size: 24px;
        color: #1d2f86;
        white-space: nowrap;
      }}
      .doc-meta {{
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 15px;
      }}
      .center-title {{
        margin: 42px 0 28px;
        text-align: center;
      }}
      .center-title h2 {{
        margin: 0 0 22px;
        font-size: 22px;
      }}
      .center-title p {{
        margin: 0;
        font-size: 18px;
        font-weight: 700;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }}
      th, td {{
        border: 1px solid #2a2a2a;
        padding: 12px 10px;
        text-align: center;
        vertical-align: top;
        font-size: 16px;
      }}
      th {{
        background: #d8e4f2;
      }}
      .footer {{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-top: 54px;
      }}
      .status-box {{
        padding: 18px;
        border-radius: 18px;
        background: #f7f8fb;
      }}
      .status-box p {{
        margin: 0 0 8px;
      }}
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button onclick="window.print()">Print / Save PDF</button>
      <a href="{html.escape(pdf_href)}" download>Download PDF</a>
    </div>
    <div class="page">
      <div class="top">
        <div>
          <div class="logo">Unlock Steppe Mongolia</div>
          <div class="brand-sub">
            {"<br/>".join(html.escape(line) for line in STEPPE_ADDRESS_LINES)}<br/>
            Утас: {html.escape(STEPPE_PHONES)}<br/>
            И-мэйл: {html.escape(STEPPE_EMAIL)}
          </div>
        </div>
        <div class="doc-title">
          <h1 style="font-size:24px; white-space:nowrap;">{html.escape(STEPPE_COMPANY_NAME)}</h1>
          <div class="doc-meta">
            <span></span>
            <span>{html.escape(STEPPE_CITY)}</span>
          </div>
          <div class="doc-meta" style="justify-content:flex-end; margin-top: 2px;">
            <span>{format_pdf_date(record['createdDate'])}</span>
          </div>
        </div>
      </div>

      <div class="center-title">
        <h2>Аяллын нэр: {html.escape(record.get('reservationName') or record['tripName'])}</h2>
        <p>{reservation_title} - “{html.escape(record['campName'])}”</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Жуулчны тоо</th>
            <th>Ажилчдын тоо</th>
            <th>Ирэх өдөр</th>
            <th>Явах өдөр</th>
            <th>Хоногийн тоо</th>
            <th>Гэрийн тоо</th>
            <th>Өрөөний төрөл</th>
            <th>Хоол</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{record['clientCount']}</td>
            <td>{record['staffCount']}</td>
            <td>{format_pdf_date(record['checkIn'])}</td>
            <td>{format_pdf_date(record['checkOut'])}</td>
            <td>{record['nights']}</td>
            <td>{record['gerCount']}</td>
            <td>{html.escape(record['roomType'])}</td>
            <td>{html.escape(meals)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 18px; font-size: 18px; line-height: 1.7;">
        <strong>Нэмэлт тэмдэглэл:</strong> {html.escape(record['notes'] or '-')}
      </div>

      <div class="footer">
        <div></div>
        <div class="status-box">
          <p><strong>Захиалгын менежер:</strong> {html.escape(manager_name)}</p>
          <p><strong>Харилцах утас:</strong> {html.escape(STEPPE_CONTACT_PHONES)}</p>
          <p><strong>Цахим шуудан:</strong> {html.escape(STEPPE_EMAIL)}</p>
        </div>
      </div>
    </div>
  </body>
</html>
"""


def build_camp_bundle_document_html(records, pdf_href):
    if not records:
        return build_document_html("Camp reservations", "No records", [])

    first = records[0]
    reservation_title = camp_reservation_title(first)
    manager_name = first.get("staffAssignment") or STEPPE_MANAGER
    note_lines = [
        f"{index + 1}. {record.get('reservationName') or record.get('tripName') or '-'}: {record.get('notes') or '-'}"
        for index, record in enumerate(records)
    ]
    row_markup = "".join(
        f"""
          <tr>
            <td>{index + 1}</td>
            <td>{html.escape(record.get('reservationName') or record['tripName'])}</td>
            <td>{record['clientCount']}</td>
            <td>{record['staffCount']}</td>
            <td>{format_pdf_date(record['checkIn'])}</td>
            <td>{format_pdf_date(record['checkOut'])}</td>
            <td>{record['nights']}</td>
            <td>{record['gerCount']}</td>
            <td>{html.escape(record['roomType'])}</td>
            <td>{html.escape(camp_reservation_meals(record))}</td>
          </tr>
        """
        for index, record in enumerate(records)
    )
    return f"""<!DOCTYPE html>
<html lang="mn">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Camp reservation export</title>
    <style>
      body {{
        margin: 0;
        background: #f1f0ec;
        color: #161616;
        font-family: Georgia, "Times New Roman", serif;
      }}
      .toolbar {{
        position: sticky;
        top: 0;
        display: flex;
        gap: 12px;
        justify-content: center;
        padding: 16px;
        background: rgba(255,255,255,0.94);
        border-bottom: 1px solid rgba(0,0,0,0.08);
      }}
      .toolbar button, .toolbar a {{
        padding: 12px 18px;
        border: none;
        border-radius: 999px;
        background: #17365f;
        color: #fff;
        text-decoration: none;
        font: 600 14px/1 sans-serif;
        cursor: pointer;
      }}
      .page {{
        width: 920px;
        margin: 22px auto 40px;
        padding: 56px 52px 72px;
        background: white;
        box-shadow: 0 20px 60px rgba(0,0,0,0.1);
      }}
      .logo {{
        color: #1d2f86;
        font: 800 30px/1 "Poppins", Arial, sans-serif;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }}
      .top {{
        display: grid;
        grid-template-columns: 1.1fr 1.2fr;
        gap: 24px;
        align-items: start;
      }}
      .brand-sub {{
        margin-top: 14px;
        color: #4e4e4e;
        line-height: 1.55;
        font-size: 15px;
      }}
      .doc-title {{
        text-align: right;
      }}
      .doc-title h1 {{
        margin: 0;
        font-size: 24px;
        white-space: nowrap;
        color: #1d2f86;
      }}
      .doc-meta {{
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 15px;
      }}
      .center-title {{
        margin: 42px 0 28px;
        text-align: center;
      }}
      .center-title h2 {{
        margin: 0 0 22px;
        font-size: 22px;
      }}
      .center-title p {{
        margin: 0;
        font-size: 18px;
        font-weight: 700;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }}
      th, td {{
        border: 1px solid #2a2a2a;
        padding: 10px 8px;
        text-align: center;
        vertical-align: top;
        font-size: 15px;
      }}
      th {{
        background: #d8e4f2;
      }}
      .footer {{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-top: 54px;
      }}
      .status-box {{
        padding: 18px;
        border-radius: 18px;
        background: #f7f8fb;
      }}
      .status-box p {{
        margin: 0 0 8px;
      }}
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button onclick="window.print()">Print / Save PDF</button>
      <a href="{html.escape(pdf_href)}" download>Download PDF</a>
    </div>
    <div class="page">
      <div class="top">
        <div>
          <div class="logo">Unlock Steppe Mongolia</div>
          <div class="brand-sub">
            {"<br/>".join(html.escape(line) for line in STEPPE_ADDRESS_LINES)}<br/>
            Утас: {html.escape(STEPPE_PHONES)}<br/>
            И-мэйл: {html.escape(STEPPE_EMAIL)}
          </div>
        </div>
        <div class="doc-title">
          <h1>{html.escape(STEPPE_COMPANY_NAME)}</h1>
          <div class="doc-meta">
            <span></span>
            <span>{html.escape(STEPPE_CITY)}</span>
          </div>
          <div class="doc-meta" style="justify-content:flex-end; margin-top: 2px;">
            <span>{format_pdf_date(first['createdDate'])}</span>
          </div>
        </div>
      </div>
      <div class="center-title">
        <h2>Аяллын нэр: {html.escape(first.get('reservationName') or first['tripName'])}</h2>
        <p>{reservation_title} - “{html.escape(first['campName'])}”</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Аяллын нэр</th>
            <th>Жуулчны тоо</th>
            <th>Ажилчдын тоо</th>
            <th>Ирэх өдөр</th>
            <th>Явах өдөр</th>
            <th>Хоногийн тоо</th>
            <th>Гэрийн тоо</th>
            <th>Өрөөний төрөл</th>
            <th>Хоол</th>
          </tr>
        </thead>
        <tbody>{row_markup}</tbody>
      </table>
      <div style="margin-top: 18px; font-size: 18px; line-height: 1.7;">
        <strong>Нэмэлт тэмдэглэл:</strong><br/>{'<br/>'.join(html.escape(line) for line in note_lines)}
      </div>
      <div class="footer">
        <div></div>
        <div class="status-box">
          <p><strong>Захиалгын менежер:</strong> {html.escape(manager_name)}</p>
          <p><strong>Харилцах утас:</strong> {html.escape(STEPPE_CONTACT_PHONES)}</p>
          <p><strong>Цахим шуудан:</strong> {html.escape(STEPPE_EMAIL)}</p>
        </div>
      </div>
    </div>
  </body>
</html>
"""


def save_camp_reservation_document(record):
    ensure_data_store()
    filename_stem = slugify(
        f"camp-{record.get('reservationName') or record['tripName']}-{record['campName']}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )
    html_filename = f"{filename_stem}.html"
    pdf_filename = f"{filename_stem}.pdf"
    html_path = GENERATED_DIR / html_filename
    pdf_path = GENERATED_DIR / pdf_filename

    pdf_href = f"/generated/{pdf_filename}"
    html_path.write_text(build_camp_document_html(record, pdf_href), encoding="utf-8")

    pdf_ready = False

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.pdfgen import canvas
        from reportlab.platypus import Table, TableStyle

        pdf = canvas.Canvas(str(pdf_path), pagesize=landscape(A4))
        width, height = landscape(A4)
        font_name = "Helvetica"
        bold_font_name = "Helvetica-Bold"

        for candidate in [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "/Library/Fonts/Arial Unicode.ttf",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        ]:
            if Path(candidate).exists():
                pdfmetrics.registerFont(TTFont("TravelXUnicode", candidate))
                font_name = "TravelXUnicode"
                bold_font_name = "TravelXUnicode"
                break

        reservation_title = camp_reservation_title(record)
        manager_name = record.get("staffAssignment") or STEPPE_MANAGER
        meals = camp_reservation_meals(record)

        def draw_logo(x, y):
            pdf.setFillColor(colors.HexColor("#1d2f86"))
            pdf.setFont(bold_font_name, 18)
            pdf.drawString(x, y - 16, "UNLOCK STEPPE MONGOLIA")

        draw_logo(40, height - 40)
        pdf.setFillColor(colors.HexColor("#1d2f86"))
        pdf.setFont(bold_font_name, 15)
        pdf.drawString(width - 360, height - 36, STEPPE_COMPANY_NAME)
        pdf.setFillColor(colors.black)
        pdf.setFont(font_name, 12)
        pdf.drawRightString(width - 40, height - 58, STEPPE_CITY)
        pdf.drawRightString(width - 40, height - 76, format_pdf_date(record["createdDate"]))

        text = pdf.beginText(40, height - 92)
        text.setFont(font_name, 10)
        for line in STEPPE_ADDRESS_LINES:
            text.textLine(line)
        text.textLine(f"Утас: {STEPPE_PHONES}")
        text.textLine(f"И-мэйл: {STEPPE_EMAIL}")
        pdf.drawText(text)

        pdf.setFont(bold_font_name, 16)
        pdf.drawCentredString(width / 2, height - 160, f"Аяллын нэр: {record.get('reservationName') or record['tripName']}")
        pdf.drawCentredString(width / 2, height - 190, f"{reservation_title} - “{record['campName']}”")

        table = Table(
            [[
                "Жуулчны\nтоо",
                "Ажилчдын\nтоо",
                "Ирэх\nөдөр",
                "Явах\nөдөр",
                "Хоногийн\nтоо",
                "Гэрийн\nтоо",
                "Өрөөний\nтөрөл",
                "Хоолны\nтөрөл",
            ], [
                str(record["clientCount"]),
                str(record["staffCount"]),
                format_iso_date(record["checkIn"]),
                format_iso_date(record["checkOut"]),
                str(record["nights"]),
                str(record["gerCount"]),
                record["roomType"],
                meals,
            ]],
            colWidths=[68, 68, 74, 74, 62, 62, 150, 118],
        )
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d8e4f2")),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("FONTNAME", (0, 0), (-1, 0), bold_font_name),
            ("FONTNAME", (0, 1), (-1, -1), font_name),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("LEADING", (0, 0), (-1, -1), 13),
        ]))
        table.wrapOn(pdf, width - 80, height)
        table.drawOn(pdf, 40, height - 320)

        pdf.setFont(bold_font_name, 12)
        pdf.drawString(40, 120, f"Нэмэлт тэмдэглэл: {record['notes'] or '-'}")
        pdf.drawString(width - 320, 110, f"Захиалгын менежер: {manager_name}")
        pdf.setFont(font_name, 12)
        pdf.drawString(width - 320, 84, f"Харилцах утас : {STEPPE_CONTACT_PHONES}")
        pdf.drawString(width - 320, 60, f"Цахим шуудан : {STEPPE_EMAIL}")

        pdf.showPage()
        pdf.save()
        pdf_ready = True
    except Exception:
        pdf_href = f"/generated/{html_filename}"

    return {
        "pdfViewPath": f"/generated/{html_filename}",
        "pdfPath": pdf_href if pdf_ready else f"/generated/{html_filename}",
    }


def save_camp_reservations_bundle(records):
    ensure_data_store()
    first = records[0]
    filename_stem = slugify(
        f"camp-bundle-{first['tripName']}-{first['campName']}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )
    html_filename = f"{filename_stem}.html"
    pdf_filename = f"{filename_stem}.pdf"
    html_path = GENERATED_DIR / html_filename
    pdf_path = GENERATED_DIR / pdf_filename

    pdf_href = f"/generated/{pdf_filename}"
    html_path.write_text(build_camp_bundle_document_html(records, pdf_href), encoding="utf-8")

    pdf_ready = False
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.pdfgen import canvas
        from reportlab.platypus import Table, TableStyle

        pdf = canvas.Canvas(str(pdf_path), pagesize=landscape(A4))
        width, height = landscape(A4)
        font_name = "Helvetica"
        bold_font_name = "Helvetica-Bold"

        for candidate in [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "/Library/Fonts/Arial Unicode.ttf",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        ]:
            if Path(candidate).exists():
                pdfmetrics.registerFont(TTFont("TravelXUnicode", candidate))
                font_name = "TravelXUnicode"
                bold_font_name = "TravelXUnicode"
                break

        reservation_title = camp_reservation_title(first)
        manager_name = first.get("staffAssignment") or STEPPE_MANAGER

        pdf.setFillColor(colors.HexColor("#1d2f86"))
        pdf.setFont(bold_font_name, 18)
        pdf.drawString(40, height - 40, "UNLOCK STEPPE MONGOLIA")
        pdf.setFillColor(colors.HexColor("#1d2f86"))
        pdf.setFont(bold_font_name, 15)
        pdf.drawString(width - 360, height - 36, STEPPE_COMPANY_NAME)
        pdf.setFillColor(colors.black)
        pdf.setFont(font_name, 12)
        pdf.drawRightString(width - 40, height - 58, STEPPE_CITY)
        pdf.drawRightString(width - 40, height - 76, format_pdf_date(first["createdDate"]))

        text = pdf.beginText(40, height - 92)
        text.setFont(font_name, 10)
        for line in STEPPE_ADDRESS_LINES:
            text.textLine(line)
        text.textLine(f"Утас: {STEPPE_PHONES}")
        text.textLine(f"И-мэйл: {STEPPE_EMAIL}")
        pdf.drawText(text)

        pdf.setFont(bold_font_name, 16)
        pdf.drawCentredString(width / 2, height - 160, f"Аяллын нэр: {first.get('reservationName') or first['tripName']}")
        pdf.drawCentredString(width / 2, height - 190, f"{reservation_title} - “{first['campName']}”")

        table_rows = [[
            "#",
            "Аяллын нэр",
            "Жуулчны\nтоо",
            "Ажилчдын\nтоо",
            "Ирэх\nөдөр",
            "Явах\nөдөр",
            "Хоногийн\nтоо",
            "Гэрийн\nтоо",
            "Өрөөний\nтөрөл",
            "Хоол",
        ]]
        for index, record in enumerate(records, start=1):
            table_rows.append([
                str(index),
                record.get("reservationName") or record["tripName"],
                str(record["clientCount"]),
                str(record["staffCount"]),
                format_iso_date(record["checkIn"]),
                format_iso_date(record["checkOut"]),
                str(record["nights"]),
                str(record["gerCount"]),
                record["roomType"],
                camp_reservation_meals(record),
            ])

        table = Table(
            table_rows,
            colWidths=[28, 124, 58, 58, 68, 68, 58, 58, 118, 90],
            repeatRows=1,
        )
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d8e4f2")),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("FONTNAME", (0, 0), (-1, 0), bold_font_name),
            ("FONTNAME", (0, 1), (-1, -1), font_name),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("LEADING", (0, 0), (-1, -1), 12),
        ]))
        table.wrapOn(pdf, width - 80, height)
        table_height = min(340, 30 + 26 * len(table_rows))
        table.drawOn(pdf, 40, height - 220 - table_height)

        note_lines = [f"{index}. {record['tripName']}: {record.get('notes') or '-'}" for index, record in enumerate(records, start=1)]
        note_text = pdf.beginText(40, 120)
        note_text.setFont(font_name, 10)
        note_text.textLine("Нэмэлт тэмдэглэл:")
        for line in note_lines[:6]:
            note_text.textLine(line)
        pdf.drawText(note_text)

        pdf.setFont(bold_font_name, 12)
        pdf.drawString(width - 320, 110, f"Захиалгын менежер: {manager_name}")
        pdf.setFont(font_name, 12)
        pdf.drawString(width - 320, 84, f"Харилцах утас : {STEPPE_CONTACT_PHONES}")
        pdf.drawString(width - 320, 60, f"Цахим шуудан : {STEPPE_EMAIL}")

        pdf.showPage()
        pdf.save()
        pdf_ready = True
    except Exception:
        pdf_href = f"/generated/{html_filename}"

    return {
        "pdfViewPath": f"/generated/{html_filename}",
        "pdfPath": pdf_href if pdf_ready else f"/generated/{html_filename}",
    }


def build_ds160_application(payload):
    cleaned = {}
    for key, value in payload.items():
        cleaned[key] = normalize_text(value)

    surname = cleaned.get("surname", "")
    given_name = cleaned.get("givenName", "")
    applicant_name = normalize_text(f"{surname} {given_name}")

    return {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "applicantName": applicant_name,
        **cleaned,
        "officialFlowNote": "Энэ нь дотоод мэдээлэл авах маягт бөгөөд албан ёсны DS-160 маягтыг орлохгүй.",
    }


def validate_ds160_application(data):
    required = [
        "surname",
        "givenName",
        "dateOfBirth",
        "birthCity",
        "birthCountry",
        "nationality",
        "email",
        "primaryPhone",
        "passportNumber",
        "passportIssueDate",
        "passportExpiryDate",
        "tripPurposeCategory",
        "intendedArrivalDate",
    ]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None


def build_finance_entry(payload):
    amount = parse_int(payload.get("amount"))
    bonus_rate = parse_int(payload.get("bonusRate"))
    bonus_amount = round(amount * bonus_rate / 100)
    entry_type = normalize_text(payload.get("type")).lower() or "income"
    return {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "employeeName": normalize_text(payload.get("employeeName")),
        "clientName": normalize_text(payload.get("clientName")),
        "category": normalize_text(payload.get("category")),
        "type": entry_type,
        "amount": amount,
        "bonusRate": bonus_rate,
        "bonusAmount": bonus_amount if entry_type == "income" else 0,
        "status": normalize_text(payload.get("status")) or "open",
        "notes": normalize_text(payload.get("notes")),
    }


def validate_finance_entry(data):
    required = ["employeeName", "category", "type"]
    missing = [field for field in required if not data.get(field)]
    if missing or data.get("amount", 0) <= 0:
        return "Employee, category, type, and a positive amount are required"
    return None


def build_booking(payload):
    return {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "guestName": normalize_text(payload.get("guestName")),
        "hotelName": normalize_text(payload.get("hotelName")),
        "city": normalize_text(payload.get("city")),
        "checkIn": normalize_text(payload.get("checkIn")),
        "checkOut": normalize_text(payload.get("checkOut")),
        "status": normalize_text(payload.get("status")) or "pending",
        "confirmationCode": normalize_text(payload.get("confirmationCode")),
        "notes": normalize_text(payload.get("notes")),
    }


def validate_booking(data):
    required = ["guestName", "hotelName", "checkIn", "checkOut", "status"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None


def build_reservation(payload):
    return {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "customerName": normalize_text(payload.get("customerName")),
        "serviceType": normalize_text(payload.get("serviceType")),
        "reservationDate": normalize_text(payload.get("reservationDate")),
        "status": normalize_text(payload.get("status")) or "draft",
        "amount": parse_int(payload.get("amount")),
        "notes": normalize_text(payload.get("notes")),
    }


def validate_reservation(data):
    required = ["customerName", "serviceType", "reservationDate", "status"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None


def build_camp_trip(payload, actor=None):
    return {
        "id": str(uuid4()),
        "createdAt": now_mongolia().isoformat(),
        "tripName": normalize_text(payload.get("tripName")),
        "reservationName": normalize_text(payload.get("reservationName")) or normalize_text(payload.get("tripName")),
        "startDate": normalize_text(payload.get("startDate")),
        "totalDays": parse_int(payload.get("totalDays")) or 1,
        "participantCount": parse_int(payload.get("participantCount")),
        "staffCount": parse_int(payload.get("staffCount")),
        "guideName": normalize_text(payload.get("guideName")),
        "driverName": normalize_text(payload.get("driverName")),
        "cookName": normalize_text(payload.get("cookName")),
        "language": normalize_text(payload.get("language")) or "Other",
        "status": normalize_text(payload.get("status")).lower() or "planning",
        "inboundCompany": "Unlock Steppe Mongolia",
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_camp_trip(data):
    required = ["tripName", "startDate", "language"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    if data.get("participantCount", 0) <= 0:
        return "Number of participants must be greater than 0"
    if data.get("totalDays", 0) <= 0:
        return "Total days must be greater than 0"
    return None


def find_camp_trip(trip_id):
    for trip in read_camp_trips():
        if trip["id"] == trip_id:
            return trip
    return None


def ensure_checkout_from_nights(check_in, nights, check_out):
    return normalize_stay_fields(check_in, nights, check_out)[2]


def build_camp_reservation(payload, actor=None):
    check_in, nights, check_out = normalize_stay_fields(payload.get("checkIn"), payload.get("nights"), payload.get("checkOut"))
    created_date = normalize_text(payload.get("createdDate")) or today_mongolia()
    return {
        "id": str(uuid4()),
        "createdAt": now_mongolia().isoformat(),
        "createdDate": created_date,
        "tripId": normalize_text(payload.get("tripId")),
        "tripName": normalize_text(payload.get("tripName")),
        "reservationName": normalize_text(payload.get("reservationName")) or normalize_text(payload.get("tripName")),
        "language": normalize_text(payload.get("language")) or "Other",
        "campName": normalize_text(payload.get("campName")),
        "locationName": normalize_text(payload.get("locationName")),
        "newCampName": normalize_text(payload.get("newCampName")),
        "reservationType": normalize_text(payload.get("reservationType")).lower() or "camp",
        "checkIn": check_in,
        "checkOut": check_out,
        "clientCount": parse_int(payload.get("clientCount")),
        "staffCount": parse_int(payload.get("staffCount")),
        "staffAssignment": normalize_text(payload.get("staffAssignment")),
        "gerCount": parse_int(payload.get("gerCount")),
        "nights": nights,
        "roomType": normalize_text(payload.get("roomType")),
        "breakfast": normalize_text(payload.get("breakfast")) or "No",
        "lunch": normalize_text(payload.get("lunch")) or "No",
        "dinner": normalize_text(payload.get("dinner")) or "No",
        "status": normalize_text(payload.get("status")).lower() or "pending",
        "deposit": parse_int(payload.get("deposit")),
        "depositPaidDate": normalize_text(payload.get("depositPaidDate")),
        "secondPayment": parse_int(payload.get("secondPayment")),
        "secondPaidDate": normalize_text(payload.get("secondPaidDate")),
        "totalPayment": parse_int(payload.get("totalPayment")),
        "balancePayment": parse_int(payload.get("balancePayment")),
        "paidAmount": parse_int(payload.get("paidAmount")),
        "paymentStatus": normalize_text(payload.get("paymentStatus")) or "in_progress",
        "notes": normalize_text(payload.get("notes")),
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_camp_reservation(data):
    required = ["tripId", "tripName", "reservationName", "campName", "reservationType", "checkIn", "checkOut", "status", "roomType"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    if data.get("clientCount", 0) <= 0:
        return "Number of clients must be greater than 0"
    if data.get("gerCount", 0) <= 0:
        return "Number of gers must be greater than 0"
    if data.get("nights", 0) <= 0:
        return "Number of nights must be greater than 0"
    check_in_date = parse_date_input(data.get("checkIn"))
    check_out_date = parse_date_input(data.get("checkOut"))
    if check_in_date and check_out_date and check_out_date <= check_in_date:
        return "Check-out must be after check-in"
    return None


def camp_summary(records):
    return {
        "total": len(records),
        "confirmed": len([record for record in records if record["status"] == "confirmed"]),
        "pending": len([record for record in records if record["status"] == "pending"]),
        "cancelled": len([record for record in records if record["status"] == "cancelled"]),
        "rejected": len([record for record in records if record["status"] == "rejected"]),
        "trips": len({record["tripId"] for record in records if record.get("tripId")}),
    }


def finance_summary(entries):
    income = sum(entry["amount"] for entry in entries if entry["type"] == "income")
    expense = sum(entry["amount"] for entry in entries if entry["type"] == "expense")
    bonus = sum(entry["bonusAmount"] for entry in entries)
    return {
        "income": income,
        "expense": expense,
        "profit": income - expense,
        "bonus": bonus,
    }


def handle_dashboard_summary(start_response):
    finance_entries = read_finance_entries()
    bookings = read_bookings()
    reservations = read_reservations()
    ds160_records = read_ds160_applications()
    camp_records = read_camp_reservations()
    return json_response(
        start_response,
        "200 OK",
        {
            "finance": finance_summary(finance_entries),
            "counts": {
                "contracts": len(read_contracts()),
                "ds160": len(ds160_records),
                "bookings": len(bookings),
                "reservations": len(reservations),
                "campReservations": len(camp_records),
            },
            "bookingStatuses": {
                "confirmed": len([entry for entry in bookings if entry["status"] == "confirmed"]),
                "pending": len([entry for entry in bookings if entry["status"] == "pending"]),
                "cancelled": len([entry for entry in bookings if entry["status"] == "cancelled"]),
            },
            "campStatuses": camp_summary(camp_records),
        },
    )


def handle_list_ds160(start_response):
    # Protected because the records contain sensitive personal information.
    # The public form submission endpoint remains open.
    return json_response(start_response, "200 OK", read_ds160_applications())


def handle_create_ds160(environ, start_response):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_ds160_application(payload)
    error = validate_ds160_application(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    records = read_ds160_applications()
    records.insert(0, record)
    write_ds160_applications(records)
    return json_response(start_response, "201 Created", {"ok": True, "application": record})


def handle_list_finance(start_response):
    entries = read_finance_entries()
    return json_response(start_response, "200 OK", {"entries": entries, "summary": finance_summary(entries)})


def handle_create_finance(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_finance_entry(payload)
    error = validate_finance_entry(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    records = read_finance_entries()
    record["createdBy"] = actor_snapshot(actor)
    record["updatedBy"] = actor_snapshot(actor)
    records.insert(0, record)
    write_finance_entries(records)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record, "summary": finance_summary(records)})


def handle_list_bookings(start_response):
    return json_response(start_response, "200 OK", read_bookings())


def handle_create_booking(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_booking(payload)
    error = validate_booking(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    records = read_bookings()
    record["createdBy"] = actor_snapshot(actor)
    record["updatedBy"] = actor_snapshot(actor)
    records.insert(0, record)
    write_bookings(records)
    return json_response(start_response, "201 Created", {"ok": True, "booking": record})


def handle_list_reservations(start_response):
    return json_response(start_response, "200 OK", read_reservations())


def handle_create_reservation(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_reservation(payload)
    error = validate_reservation(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    document = save_simple_document(
        "reservation",
        f"Reservation - {record['customerName']}",
        "Printable internal reservation summary for team use.",
        [
            ("Reservation", f"Customer: {record['customerName']}\nService: {record['serviceType']}\nDate: {record['reservationDate']}\nStatus: {record['status']}"),
            ("Finance", f"Amount: {format_money(record['amount'])}"),
            ("Notes", record["notes"] or "No extra notes"),
        ],
    )
    record.update(document)
    record["createdBy"] = actor_snapshot(actor)
    record["updatedBy"] = actor_snapshot(actor)
    records = read_reservations()
    records.insert(0, record)
    write_reservations(records)
    return json_response(start_response, "201 Created", {"ok": True, "reservation": record})


def handle_list_camp_reservations(start_response):
    records = read_camp_reservations()
    return json_response(start_response, "200 OK", {"entries": records, "summary": camp_summary(records)})


def handle_list_camp_trips(start_response):
    trips = read_camp_trips()
    return json_response(start_response, "200 OK", {"entries": trips})


def handle_list_camp_settings(start_response):
    return json_response(start_response, "200 OK", {"entry": read_camp_settings()})


def handle_update_camp_settings(environ, start_response):
    admin = require_admin(environ, start_response)
    if not admin:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    camp_names = normalize_option_list(payload.get("campNames"))
    settings = {
        "campNames": camp_names,
        "locationNames": normalize_option_list(payload.get("locationNames")),
        "staffAssignments": normalize_option_list(payload.get("staffAssignments")),
        "roomChoices": normalize_option_list(payload.get("roomChoices")) or DEFAULT_ROOM_CHOICES,
        "campLocations": normalize_camp_location_map(payload.get("campLocations"), camp_names),
    }
    if not settings["campNames"]:
        settings["campNames"] = ["Khustai camp"]
    if not settings["locationNames"]:
        settings["locationNames"] = ["Khustai"]
    if not settings["staffAssignments"]:
        settings["staffAssignments"] = [STEPPE_MANAGER]
    settings["locationNames"] = normalize_option_list(settings["locationNames"] + [value for value in settings["campLocations"].values() if value])
    write_camp_settings(settings)
    return json_response(start_response, "200 OK", {"ok": True, "entry": settings})


def handle_create_camp_trip(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_camp_trip(payload, actor)
    error = validate_camp_trip(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    trips = read_camp_trips()
    trips.insert(0, record)
    write_camp_trips(trips)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


def handle_update_camp_trip(environ, start_response, trip_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    trips = read_camp_trips()
    for index, trip in enumerate(trips):
        if trip["id"] != trip_id:
            continue
        merged = {**trip}
        for key in ["tripName", "reservationName", "startDate", "language", "status", "guideName", "driverName", "cookName"]:
            if key in payload:
                merged[key] = normalize_text(payload.get(key))
        for key in ["participantCount", "staffCount", "totalDays"]:
            if key in payload:
                merged[key] = parse_int(payload.get(key))
        error = validate_camp_trip(merged)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        merged["updatedAt"] = now_mongolia().isoformat()
        merged["updatedBy"] = actor_snapshot(actor)
        trips[index] = merged
        write_camp_trips(trips)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged})
    return json_response(start_response, "404 Not Found", {"error": "Trip not found"})


def handle_delete_camp_trip(environ, start_response, trip_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    trips = read_camp_trips()
    if not any(trip["id"] == trip_id for trip in trips):
        return json_response(start_response, "404 Not Found", {"error": "Trip not found"})
    trips = [trip for trip in trips if trip["id"] != trip_id]
    reservations = [record for record in read_camp_reservations() if record.get("tripId") != trip_id]
    write_camp_trips(trips)
    write_camp_reservations(reservations)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": trip_id, "summary": camp_summary(reservations)})


def handle_create_camp_reservation(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_camp_reservation(payload, actor)
    trip = find_camp_trip(record["tripId"])
    if trip is None:
        return json_response(start_response, "400 Bad Request", {"error": "Please create or select a trip first"})
    record["tripName"] = trip["tripName"]
    record["reservationName"] = record.get("reservationName") or trip.get("reservationName") or trip["tripName"]
    record["language"] = trip.get("language") or "Other"
    settings = read_camp_settings()
    if record.get("newCampName"):
        record["campName"] = record["newCampName"]
        if record["campName"] not in settings["campNames"]:
            settings["campNames"] = normalize_option_list(settings["campNames"] + [record["campName"]])
    if record.get("campName") and not record.get("locationName"):
        record["locationName"] = settings.get("campLocations", {}).get(record["campName"], "")
    if record.get("campName") and record.get("locationName"):
        settings["campLocations"][record["campName"]] = record["locationName"]
        settings["locationNames"] = normalize_option_list(settings["locationNames"] + [record["locationName"]])
    write_camp_settings(settings)
    error = validate_camp_reservation(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    record.update(save_camp_reservation_document(record))
    records = read_camp_reservations()
    records.insert(0, record)
    write_camp_reservations(records)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record, "summary": camp_summary(records)})


def handle_update_camp_reservation(environ, start_response, reservation_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    records = read_camp_reservations()
    settings = read_camp_settings()
    for index, record in enumerate(records):
        if record["id"] != reservation_id:
            continue

        merged = {**record}
        for key in [
            "tripId",
            "tripName",
            "campName",
            "locationName",
            "reservationName",
            "reservationType",
            "createdDate",
            "checkIn",
            "checkOut",
            "roomType",
            "status",
            "staffAssignment",
            "notes",
            "breakfast",
            "lunch",
            "dinner",
            "depositPaidDate",
            "secondPaidDate",
            "paymentStatus",
        ]:
            if key in payload:
                merged[key] = normalize_text(payload.get(key))

        if normalize_text(payload.get("newCampName")):
            merged["campName"] = normalize_text(payload.get("newCampName"))
            if merged["campName"] not in settings["campNames"]:
                settings["campNames"] = normalize_option_list(settings["campNames"] + [merged["campName"]])
        if not normalize_text(merged.get("reservationName")):
            trip = find_camp_trip(merged.get("tripId"))
            merged["reservationName"] = (trip or {}).get("reservationName") or merged.get("tripName") or ""
        if merged.get("campName") and not normalize_text(merged.get("locationName")):
            merged["locationName"] = settings.get("campLocations", {}).get(merged["campName"], "")
        if merged.get("campName") and normalize_text(merged.get("locationName")):
            settings["campLocations"][merged["campName"]] = normalize_text(merged["locationName"])
            settings["locationNames"] = normalize_option_list(settings["locationNames"] + [normalize_text(merged["locationName"])])
        write_camp_settings(settings)

        for key in ["clientCount", "staffCount", "gerCount", "deposit", "secondPayment", "totalPayment", "balancePayment", "paidAmount"]:
            if key in payload:
                merged[key] = parse_int(payload.get(key))

        merged["checkIn"], merged["nights"], merged["checkOut"] = normalize_stay_fields(
            merged.get("checkIn"),
            payload.get("nights", merged.get("nights")),
            merged.get("checkOut"),
        )

        error = validate_camp_reservation(merged)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})

        merged["updatedAt"] = now_mongolia().isoformat()
        merged["updatedBy"] = actor_snapshot(actor)
        merged.update(save_camp_reservation_document(merged))
        records[index] = merged
        write_camp_reservations(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged, "summary": camp_summary(records)})

    return json_response(start_response, "404 Not Found", {"error": "Camp reservation not found"})


def handle_delete_camp_reservation(environ, start_response, reservation_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    records = read_camp_reservations()
    if not any(record["id"] == reservation_id for record in records):
        return json_response(start_response, "404 Not Found", {"error": "Camp reservation not found"})
    records = [record for record in records if record["id"] != reservation_id]
    write_camp_reservations(records)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": reservation_id, "summary": camp_summary(records)})


def handle_export_camp_reservations(environ, start_response):
    if not require_login(environ, start_response):
        return []
    params = parse_qs(environ.get("QUERY_STRING", ""))
    ids = [value for item in params.get("ids", []) for value in item.split(",") if value]
    records = read_camp_reservations()
    selected = [record for record in records if not ids or record["id"] in ids]
    if ids:
        order = {value: index for index, value in enumerate(ids)}
        selected.sort(key=lambda record: order.get(record["id"], len(order)))
    if not selected:
        return json_response(start_response, "400 Bad Request", {"error": "No reservations selected"})
    document = save_camp_reservations_bundle(selected)
    if not str(document.get("pdfPath", "")).endswith(".pdf"):
        return json_response(start_response, "500 Internal Server Error", {"error": "PDF generation failed"})
    return json_response(start_response, "200 OK", {"ok": True, "entry": document})


def handle_create_backup(environ, start_response):
    admin = require_backup_admin(environ, start_response)
    if not admin:
        return []
    archive_path = create_backup_archive()
    return json_response(
        start_response,
        "201 Created",
        {"ok": True, "filename": archive_path.name, "createdAt": now_mongolia().isoformat()},
    )


def handle_list_backups(environ, start_response):
    admin = require_backup_admin(environ, start_response)
    if not admin:
        return []
    return json_response(start_response, "200 OK", {"ok": True, "backups": list_backup_archives()})


def handle_download_backup(environ, start_response, filename):
    admin = require_backup_admin(environ, start_response)
    if not admin:
        return []
    safe_path = (BACKUP_DIR / unquote(filename)).resolve()
    if not str(safe_path).startswith(str(BACKUP_DIR.resolve())) or not safe_path.exists():
        return json_response(start_response, "404 Not Found", {"error": "Backup not found"})
    if safe_path.suffix != ".zip":
        return json_response(start_response, "400 Bad Request", {"error": "Invalid backup file"})
    return file_response(start_response, safe_path, "application/zip")


def handle_camp_reservation_document(environ, start_response, reservation_id):
    if not require_login(environ, start_response):
        return []
    params = parse_qs(environ.get("QUERY_STRING", ""))
    mode = (params.get("mode", ["view"])[0] or "view").strip().lower()
    records = read_camp_reservations()
    record = next((item for item in records if item["id"] == reservation_id), None)
    if not record:
        return json_response(start_response, "404 Not Found", {"error": "Camp reservation not found"})
    document = save_camp_reservation_document(record)
    if mode == "download" and not str(document.get("pdfPath", "")).endswith(".pdf"):
        return json_response(start_response, "500 Internal Server Error", {"error": "PDF generation failed"})
    relative_path = document["pdfViewPath"] if mode == "view" else document["pdfPath"]
    safe_path = (GENERATED_DIR / unquote(relative_path.replace("/generated/", "", 1))).resolve()
    if not str(safe_path).startswith(str(GENERATED_DIR.resolve())) or not safe_path.exists():
        return json_response(start_response, "404 Not Found", {"error": "Document not found"})
    extra_headers = generated_download_headers(safe_path) if mode == "download" else None
    return file_response(start_response, safe_path, extra_headers=extra_headers)


def handle_generate_contract(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    data = build_contract_data(payload)
    error = validate_contract_data(data)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    try:
        record = save_contract_files(data)
    except FileNotFoundError as exc:
        return json_response(start_response, "500 Internal Server Error", {"error": str(exc)})
    except Exception:
        return json_response(start_response, "500 Internal Server Error", {"error": "Could not generate contract"})

    contracts = read_contracts()
    record["createdBy"] = actor_snapshot(actor)
    record["updatedBy"] = actor_snapshot(actor)
    contracts.insert(0, record)
    write_contracts(contracts)
    return json_response(start_response, "201 Created", {"ok": True, "contract": record})


def handle_list_contracts(start_response):
    return json_response(start_response, "200 OK", read_contracts())


def find_contract(contract_id):
    for contract in read_contracts():
        if contract.get("id") == contract_id:
            return contract
    return None


def handle_get_contract(start_response, contract_id):
    contract = find_contract(contract_id)
    if not contract:
        return json_response(start_response, "404 Not Found", {"error": "Contract not found"})
    return json_response(start_response, "200 OK", {"contract": contract})


def handle_update_contract(environ, start_response, contract_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    contracts = read_contracts()
    for idx, contract in enumerate(contracts):
        if contract.get("id") == contract_id:
            data = build_contract_data(payload)
            error = validate_contract_data(data)
            if error:
                return json_response(start_response, "400 Bad Request", {"error": error})
            contract["data"] = data
            contract["updatedBy"] = actor_snapshot(actor)
            contract["updatedAt"] = datetime.now(timezone.utc).isoformat()
            contracts[idx] = contract
            write_contracts(contracts)
            return json_response(start_response, "200 OK", {"ok": True, "contract": contract})
    return json_response(start_response, "404 Not Found", {"error": "Contract not found"})


def handle_delete_contract(environ, start_response, contract_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    contracts = read_contracts()
    remaining = [item for item in contracts if item.get("id") != contract_id]
    if len(remaining) == len(contracts):
        return json_response(start_response, "404 Not Found", {"error": "Contract not found"})
    write_contracts(remaining)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": contract_id})


def handle_sign_contract(environ, start_response, contract_id):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    signature_data = payload.get("signatureData")
    signer_name = normalize_text(payload.get("signerName"))

    contracts = read_contracts()
    for idx, contract in enumerate(contracts):
        if contract.get("id") == contract_id:
            signature_path = save_signature_image(signature_data, contract_id)
            if not signature_path:
                return json_response(start_response, "400 Bad Request", {"error": "Invalid signature"})
            contract["signaturePath"] = signature_path
            contract["signerName"] = signer_name or contract.get("signerName")
            contract["status"] = "signed"
            contract["signedAt"] = datetime.now(timezone.utc).isoformat()
            contract["pdfPath"] = save_contract_pdf(contract)
            contracts[idx] = contract
            write_contracts(contracts)
            return json_response(start_response, "200 OK", {"ok": True, "contract": contract})
    return json_response(start_response, "404 Not Found", {"error": "Contract not found"})


def handle_contract_document(environ, start_response, contract_id):
    params = parse_qs(environ.get("QUERY_STRING", ""))
    mode = (params.get("mode", ["view"])[0] or "view").strip().lower()
    contracts = read_contracts()
    contract = None
    contract_index = None
    for idx, entry in enumerate(contracts):
        if entry.get("id") == contract_id:
            contract = entry
            contract_index = idx
            break
    if not contract:
        return json_response(start_response, "404 Not Found", {"error": "Contract not found"})
    if mode == "download":
        pdf_path = contract.get("pdfPath")
        if not str(pdf_path or "").endswith(".pdf"):
            return json_response(start_response, "409 Conflict", {"error": "PDF not ready"})
        safe_path = (GENERATED_DIR / unquote(pdf_path.replace("/generated/", "", 1))).resolve()
        if not safe_path.exists() and contract.get("status") == "signed":
            pdf_path = save_contract_pdf(contract)
            contract["pdfPath"] = pdf_path
            if contract_index is not None:
                contracts[contract_index] = contract
                write_contracts(contracts)
            safe_path = (GENERATED_DIR / unquote(pdf_path.replace("/generated/", "", 1))).resolve()
        if not str(safe_path).startswith(str(GENERATED_DIR.resolve())) or not safe_path.exists():
            return json_response(start_response, "404 Not Found", {"error": "Document not found"})
        return file_response(start_response, safe_path, extra_headers=generated_download_headers(safe_path))

    view_path = contract.get("pdfViewPath")
    if not view_path:
        view_path = f"/generated/contract-{contract_id}.html"
        contract["pdfViewPath"] = view_path
    safe_path = (GENERATED_DIR / unquote(view_path.replace("/generated/", "", 1))).resolve()
    if not str(safe_path).startswith(str(GENERATED_DIR.resolve())):
        return json_response(start_response, "404 Not Found", {"error": "Document not found"})
    if not safe_path.exists():
        safe_path.write_text(build_contract_html(contract.get("data") or {}), encoding="utf-8")
        if contract_index is not None:
            contracts[contract_index] = contract
            write_contracts(contracts)
    return file_response(start_response, safe_path)


def app(environ, start_response):
    ensure_data_store()

    method = environ["REQUEST_METHOD"]
    path = environ.get("PATH_INFO", "/")
    host = request_host(environ)

    if method == "GET" and path == "/health":
        return text_response(start_response, "200 OK", "ok")

    if path == "/api/auth/register" and method == "POST":
        return handle_auth_register(environ, start_response)

    if path == "/api/auth/bootstrap-admin" and method == "POST":
        return handle_auth_bootstrap_admin(environ, start_response)

    if path == "/api/auth/login" and method == "POST":
        return handle_auth_login(environ, start_response)

    if path == "/api/auth/request-reset" and method == "POST":
        return handle_auth_request_reset(environ, start_response)

    if path == "/api/auth/logout" and method == "POST":
        return handle_auth_logout(environ, start_response)

    if path == "/api/auth/me" and method == "GET":
        return handle_auth_me(environ, start_response)

    if path == "/api/auth/profile" and method == "POST":
        return handle_auth_profile_update(environ, start_response)

    if path == "/api/users":
        if method == "GET":
            return handle_list_users(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/users/"):
        user_id = path.replace("/api/users/", "", 1).strip("/")
        if method == "POST" and user_id:
            return handle_update_user(environ, start_response, user_id)
        if method == "DELETE" and user_id:
            return handle_delete_user(environ, start_response, user_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/backoffice/summary":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_dashboard_summary(start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/backups":
        if method == "GET":
            return handle_list_backups(environ, start_response)
        if method == "POST":
            return handle_create_backup(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/backups/") and method == "GET":
        filename = path.replace("/api/backups/", "", 1).strip("/")
        if filename:
            return handle_download_backup(environ, start_response, filename)
        return json_response(start_response, "404 Not Found", {"error": "Backup not found"})

    if path == "/api/contracts":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_contracts(start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_generate_contract(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/contracts/"):
        tail = path.replace("/api/contracts/", "", 1).strip("/")
        if not tail:
            return json_response(start_response, "404 Not Found", {"error": "Contract not found"})
        if tail.endswith("/sign"):
            contract_id = tail.replace("/sign", "", 1).strip("/")
            if method == "POST":
                return handle_sign_contract(environ, start_response, contract_id)
            return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})
        if tail.endswith("/document"):
            contract_id = tail.replace("/document", "", 1).strip("/")
            if method == "GET":
                return handle_contract_document(environ, start_response, contract_id)
            return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})
        contract_id = tail
        if method == "GET":
            return handle_get_contract(start_response, contract_id)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_update_contract(environ, start_response, contract_id)
        if method == "DELETE":
            if not require_login(environ, start_response):
                return []
            return handle_delete_contract(environ, start_response, contract_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/ds160":
        if method == "GET":
            if not current_user(environ) and not is_authorized(environ):
                return json_response(start_response, "401 Unauthorized", {"error": "Unauthorized"})
            return handle_list_ds160(start_response)
        if method == "POST":
            return handle_create_ds160(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/finance":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_finance(start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_finance(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/bookings":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_bookings(start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_booking(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/reservations":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_reservations(start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_reservation(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/camp-reservations":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_camp_reservations(start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_camp_reservation(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/camp-trips":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_camp_trips(start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_camp_trip(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/camp-settings":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_camp_settings(start_response)
        if method == "POST":
            return handle_update_camp_settings(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/camp-reservations/export":
        if method == "GET":
            return handle_export_camp_reservations(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/camp-reservations/"):
        reservation_id = path.replace("/api/camp-reservations/", "", 1).strip("/")
        if method == "GET" and reservation_id.endswith("/document"):
            reservation_id = reservation_id[:-len("/document")].strip("/")
            return handle_camp_reservation_document(environ, start_response, reservation_id)
        if method == "POST" and reservation_id:
            if not require_login(environ, start_response):
                return []
            return handle_update_camp_reservation(environ, start_response, reservation_id)
        if method == "DELETE" and reservation_id:
            return handle_delete_camp_reservation(environ, start_response, reservation_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/camp-trips/"):
        trip_id = path.replace("/api/camp-trips/", "", 1).strip("/")
        if method == "POST" and trip_id:
            return handle_update_camp_trip(environ, start_response, trip_id)
        if method == "DELETE" and trip_id:
            return handle_delete_camp_trip(environ, start_response, trip_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if method != "GET":
        return json_response(start_response, "404 Not Found", {"error": "Not found"})

    if path == "/login":
        if current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "backoffice.html")
        return file_response(start_response, PUBLIC_DIR / "login.html")

    if path == "/":
        if host == "camp.travelx.mn":
            if not current_user(environ):
                return file_response(start_response, PUBLIC_DIR / "login.html")
            return file_response(start_response, PUBLIC_DIR / "camp.html")
        if host in {"backoffice.travelx.mn", "www.backoffice.travelx.mn"}:
            if not current_user(environ):
                return file_response(start_response, PUBLIC_DIR / "login.html")
            return file_response(start_response, PUBLIC_DIR / "backoffice.html")
        return file_response(start_response, PUBLIC_DIR / "index.html")

    if path == "/backoffice":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "backoffice.html")

    if path == "/contracts":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "contracts.html")

    if path.startswith("/contract/"):
        contract_id = path.replace("/contract/", "", 1).strip("/")
        if contract_id:
            return file_response(start_response, PUBLIC_DIR / "contract-sign.html")

    if path == "/ds160":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "index.html")

    if path == "/camp":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "camp.html")

    if path == "/admin":
        user = current_user(environ)
        if not user:
            return file_response(start_response, PUBLIC_DIR / "login.html")
        if user.get("role") != "admin":
            return text_response(start_response, "403 Forbidden", "Admin access required")
        return file_response(start_response, PUBLIC_DIR / "admin.html")

    if path.startswith("/generated/"):
        safe_path = (GENERATED_DIR / unquote(path.replace("/generated/", "", 1))).resolve()
        if not str(safe_path).startswith(str(GENERATED_DIR.resolve())) or not safe_path.exists():
            return json_response(start_response, "404 Not Found", {"error": "Not found"})
        params = parse_qs(environ.get("QUERY_STRING", ""))
        extra_headers = generated_download_headers(safe_path) if params.get("download", ["0"])[0] == "1" else None
        return file_response(start_response, safe_path, extra_headers=extra_headers)

    safe_path = (PUBLIC_DIR / path.lstrip("/")).resolve()
    if not str(safe_path).startswith(str(PUBLIC_DIR.resolve())) or not safe_path.exists():
        return json_response(start_response, "404 Not Found", {"error": "Not found"})

    return file_response(start_response, safe_path)


if __name__ == "__main__":
    print(f"Client intake app running at http://{HOST}:{PORT}")
    with make_server(HOST, PORT, app) as server:
        server.serve_forever()
