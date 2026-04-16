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
ALT_TEMPLATE = Path(__file__).resolve().parent / "data" / "Гэрээ.docx"
CONTRACTS_FILE = DATA_DIR / "contracts.json"
DS160_FILE = DATA_DIR / "ds160_applications.json"
FINANCE_FILE = DATA_DIR / "finance_entries.json"
BOOKINGS_FILE = DATA_DIR / "hotel_bookings.json"
RESERVATIONS_FILE = DATA_DIR / "reservations.json"
CAMP_RESERVATIONS_FILE = DATA_DIR / "camp_reservations.json"
FLIGHT_RESERVATIONS_FILE = DATA_DIR / "flight_reservations.json"
TRANSFER_RESERVATIONS_FILE = DATA_DIR / "transfer_reservations.json"
CAMP_TRIPS_FILE = DATA_DIR / "camp_trips.json"
CAMP_SETTINGS_FILE = DATA_DIR / "camp_settings.json"
FIFA2026_FILE = DATA_DIR / "fifa2026.json"
FIFA2026_RESET_MARKER_FILE = DATA_DIR / "fifa2026_manual_reset_v3.txt"
MANAGER_DASHBOARD_FILE = DATA_DIR / "manager_dashboard.json"
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
    "tent": "Майхны захиалга",
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
        FLIGHT_RESERVATIONS_FILE,
        TRANSFER_RESERVATIONS_FILE,
        CAMP_TRIPS_FILE,
        USERS_FILE,
        SESSIONS_FILE,
    ]:
        if not file_path.exists():
            file_path.write_text("[]", encoding="utf-8")
    if not MANAGER_DASHBOARD_FILE.exists():
        MANAGER_DASHBOARD_FILE.write_text(
            json.dumps(default_manager_dashboard(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
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
    if not FIFA2026_FILE.exists():
        FIFA2026_FILE.write_text(
            json.dumps(default_fifa2026_data(), indent=2, ensure_ascii=False),
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
        FIFA2026_FILE,
        MANAGER_DASHBOARD_FILE,
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


def default_manager_dashboard():
    return {
        "tasks": [],
        "reminders": [],
        "contacts": [],
    }


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


def read_flight_reservations():
    return read_json_list(FLIGHT_RESERVATIONS_FILE)


def write_flight_reservations(records):
    write_json_list(FLIGHT_RESERVATIONS_FILE, records)


def read_transfer_reservations():
    return read_json_list(TRANSFER_RESERVATIONS_FILE)


def write_transfer_reservations(records):
    write_json_list(TRANSFER_RESERVATIONS_FILE, records)


def read_camp_trips():
    return read_json_list(CAMP_TRIPS_FILE)


def write_camp_trips(records):
    write_json_list(CAMP_TRIPS_FILE, records)


def normalize_manager_dashboard(payload):
    if not isinstance(payload, dict):
        return default_manager_dashboard()
    return {
        "tasks": payload.get("tasks") if isinstance(payload.get("tasks"), list) else [],
        "reminders": payload.get("reminders") if isinstance(payload.get("reminders"), list) else [],
        "contacts": payload.get("contacts") if isinstance(payload.get("contacts"), list) else [],
    }


def read_manager_dashboard():
    payload = read_json_object(MANAGER_DASHBOARD_FILE, default_manager_dashboard())
    return normalize_manager_dashboard(payload)


def write_manager_dashboard(payload):
    write_json_object(MANAGER_DASHBOARD_FILE, normalize_manager_dashboard(payload))


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


def default_fifa2026_data():
    return {"tickets": [], "sales": []}


def normalize_fifa2026_store(payload):
    default_payload = default_fifa2026_data()
    if not isinstance(payload, dict):
        return default_payload
    tickets = payload.get("tickets") if isinstance(payload.get("tickets"), list) else default_payload["tickets"]
    sales = payload.get("sales") if isinstance(payload.get("sales"), list) else []
    return {
        "tickets": tickets,
        "sales": sales,
    }


def read_fifa2026_store():
    payload = read_json_object(FIFA2026_FILE, default_fifa2026_data())
    return normalize_fifa2026_store(payload)


def write_fifa2026_store(payload):
    write_json_object(FIFA2026_FILE, normalize_fifa2026_store(payload))


def reset_fifa2026_store_from_seed():
    payload = normalize_fifa2026_store(default_fifa2026_data())
    write_fifa2026_store(payload)
    return payload


def fifa_store_totals(store):
    tickets = store.get("tickets", [])
    return {
        "lots": len(tickets),
        "matches": len({normalize_text(ticket.get("matchNumber")) for ticket in tickets if normalize_text(ticket.get("matchNumber"))}),
        "quantity": sum(max(parse_int(ticket.get("totalQuantity")), 0) for ticket in tickets),
    }


def ensure_fifa2026_manual_inventory():
    if not FIFA2026_RESET_MARKER_FILE.exists():
        empty_store = {"tickets": [], "sales": []}
        write_fifa2026_store(empty_store)
        FIFA2026_RESET_MARKER_FILE.write_text("manual-reset-v3", encoding="utf-8")
        return empty_store
    current = read_fifa2026_store()
    tickets = current.get("tickets", [])
    if tickets and all(
        "Imported from DTX 2026 WC - Sales Registration.xlsx" in normalize_text(ticket.get("notes"))
        for ticket in tickets
    ):
        empty_store = {"tickets": [], "sales": []}
        write_fifa2026_store(empty_store)
        return empty_store
    return current


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
        "contractLastName": normalize_text(payload.get("contractLastName")),
        "contractFirstName": normalize_text(payload.get("contractFirstName")),
        "contractEmail": normalize_text(payload.get("contractEmail")).lower(),
        "contractPhone": normalize_text(payload.get("contractPhone")),
        "contractSignaturePath": normalize_text(payload.get("contractSignaturePath")),
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
    contract_last_name = normalize_text(payload.get("contractLastName"))
    contract_first_name = normalize_text(payload.get("contractFirstName"))
    contract_email = normalize_text(payload.get("contractEmail")).lower()
    contract_phone = normalize_text(payload.get("contractPhone"))
    signature_data = payload.get("contractSignatureData")
    if len(full_name) < 2:
        return json_response(start_response, "400 Bad Request", {"error": "Name must be at least 2 characters"})
    if contract_last_name and len(contract_last_name) < 2:
        return json_response(start_response, "400 Bad Request", {"error": "Contract surname must be at least 2 characters"})
    if contract_first_name and len(contract_first_name) < 2:
        return json_response(start_response, "400 Bad Request", {"error": "Contract given name must be at least 2 characters"})
    if contract_email and "@" not in contract_email:
        return json_response(start_response, "400 Bad Request", {"error": "Contract email must be valid"})

    users = read_users()
    for record in users:
        if record.get("id") != user.get("id"):
            continue
        if signature_data:
            signature_path = save_manager_signature_image(signature_data, record["id"])
            if not signature_path:
                return json_response(start_response, "400 Bad Request", {"error": "Invalid manager signature"})
            record["contractSignaturePath"] = signature_path
        record["fullName"] = full_name
        record["contractLastName"] = contract_last_name
        record["contractFirstName"] = contract_first_name
        record["contractEmail"] = contract_email
        record["contractPhone"] = contract_phone
        write_users(users)
        return json_response(start_response, "200 OK", {"ok": True, "user": sanitize_user(record)})

    return json_response(start_response, "404 Not Found", {"error": "User not found"})


def handle_list_users(environ, start_response):
    user = require_login(environ, start_response)
    if not user:
        return []
    users = [sanitize_user(user) for user in read_users()]
    return json_response(start_response, "200 OK", {"entries": users})


def handle_list_team_members(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    entries = []
    for user in read_users():
        if user.get("status") != "approved":
            continue
        display_name = normalize_text(user.get("fullName")) or normalize_text(user.get("name")) or normalize_text(user.get("email"))
        if not display_name:
            continue
        entries.append(
            {
                "id": user.get("id"),
                "fullName": display_name,
                "contractLastName": normalize_text(user.get("contractLastName")),
                "contractFirstName": normalize_text(user.get("contractFirstName")),
                "contractEmail": normalize_text(user.get("contractEmail")).lower(),
                "contractPhone": normalize_text(user.get("contractPhone")),
                "contractSignaturePath": normalize_text(user.get("contractSignaturePath")),
                "email": normalize_text(user.get("email")),
                "role": normalize_text(user.get("role")) or "staff",
            }
        )
    entries.sort(key=lambda item: item["fullName"].lower())
    return json_response(start_response, "200 OK", {"entries": entries})


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
        if "contractLastName" in payload:
            user["contractLastName"] = normalize_text(payload.get("contractLastName"))
        if "contractFirstName" in payload:
            user["contractFirstName"] = normalize_text(payload.get("contractFirstName"))
        if "contractEmail" in payload:
            user["contractEmail"] = normalize_text(payload.get("contractEmail")).lower()
        if "contractPhone" in payload:
            user["contractPhone"] = normalize_text(payload.get("contractPhone"))
        if "contractSignaturePath" in payload:
            user["contractSignaturePath"] = normalize_text(payload.get("contractSignaturePath"))
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


def normalize_person_name(value):
    text = normalize_text(value)
    if not text:
        return ""
    if " " not in text and len(text) % 2 == 0:
        mid = len(text) // 2
        if text[:mid] == text[mid:]:
            text = text[:mid]
    parts = text.split()

    deduped = []
    for part in parts:
        if not deduped or deduped[-1] != part:
            deduped.append(part)
    parts = deduped

    changed = True
    while changed:
        changed = False
        for chunk_size in range(1, (len(parts) // 2) + 1):
            if len(parts) % chunk_size != 0:
                continue
            repeat_count = len(parts) // chunk_size
            if repeat_count <= 1:
                continue
            first = parts[:chunk_size]
            if all(parts[index * chunk_size:(index + 1) * chunk_size] == first for index in range(1, repeat_count)):
                parts = first
                changed = True
                break
    if parts and len(set(parts)) == 1:
        return parts[0]
    return " ".join(parts)


def dedupe_full_name(last_name, first_name):
    last_clean = normalize_person_name(last_name)
    first_clean = normalize_person_name(first_name)
    if last_clean and first_clean and last_clean == first_clean:
        return last_clean
    combined = " ".join(part for part in [last_clean, first_clean] if part).strip()
    return normalize_person_name(combined)


def get_manager_display_name(data):
    full_name = normalize_person_name(data.get("managerFullName"))
    combined_name = dedupe_full_name(data.get("managerLastName"), data.get("managerFirstName"))

    if combined_name and full_name:
        if full_name == combined_name:
            return combined_name

        full_parts = full_name.split()
        combined_parts = combined_name.split()
        if combined_parts:
            if len(full_parts) >= len(combined_parts) and (
                full_parts[: len(combined_parts)] == combined_parts
                or full_parts[-len(combined_parts) :] == combined_parts
            ):
                return combined_name

    return combined_name or full_name or "Ч.Нямбаяр"


def get_manager_contract_formal_name(data):
    last_name = normalize_person_name(data.get("managerLastName"))
    first_name = normalize_person_name(data.get("managerFirstName"))
    if last_name and first_name:
        return f"{last_name} овогтой {first_name}"
    return get_manager_display_name(data)


def get_manager_signature_name(data):
    last_name = normalize_person_name(data.get("managerLastName"))
    first_name = normalize_person_name(data.get("managerFirstName"))
    if last_name and first_name:
        return f"{last_name[:1]}.{first_name}"
    if first_name:
        return first_name
    return get_manager_display_name(data)


def get_manager_contract_email(data):
    return normalize_text(data.get("managerEmail")) or "nyambayar@travelx.mn"


def get_manager_contract_phone(data):
    return normalize_text(data.get("managerPhone")) or "85178877"


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
        "contractLastName": user.get("contractLastName", ""),
        "contractFirstName": user.get("contractFirstName", ""),
        "contractEmail": user.get("contractEmail", ""),
        "contractPhone": user.get("contractPhone", ""),
        "contractSignaturePath": user.get("contractSignaturePath", ""),
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
        "contractLastName": "",
        "contractFirstName": "",
        "contractEmail": "",
        "contractPhone": "",
        "contractSignaturePath": "",
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


def format_iso_date_display(value):
    raw = str(value or "").split("T", 1)[0]
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        return raw
    return "-"


def parse_date_safe(value):
    raw = str(value or "").split("T", 1)[0]
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw).date()
    except ValueError:
        return None


def format_trip_range_phrase(start_value, end_value):
    start = normalize_text(start_value)
    end = normalize_text(end_value)
    if start and end:
        return f"{start} өдрөөс {end} хооронд"
    if start:
        return f"{start} өдрөөс"
    return end


def build_traveler_count_sentence(data):
    parts = []
    adult_count = parse_int(data.get("adultCount"))
    child_count = parse_int(data.get("childCount"))
    infant_count = parse_int(data.get("infantCount"))
    if adult_count:
        parts.append(f"{adult_count} том хүн")
    if child_count:
        parts.append(f"{child_count} хүүхэд")
    if infant_count:
        parts.append(f"{infant_count} нярай")
    if not parts:
        return "Энэхүү аялалд аялагчийн тоо тусгайлан тохиролцоно."
    return f"Энэхүү аялалд нийт {', '.join(parts)} оролцоно."


def build_traveler_representation_phrase(data):
    parts = []
    adult_count = parse_int(data.get("adultCount"))
    child_count = parse_int(data.get("childCount"))
    infant_count = parse_int(data.get("infantCount"))
    if adult_count:
        parts.append(f"{adult_count} том хүн")
    if child_count:
        parts.append(f"{child_count} хүүхэд")
    if infant_count:
        parts.append(f"{infant_count} нярай")
    total_count = parse_int(data.get("travelerCount"))
    if not parts and total_count:
        return f"/нийт {total_count} жуулчинг/"
    if not parts:
        return "/жуулчинг/"
    if adult_count and not child_count and not infant_count:
        return f"/нийт {total_count} жуулчинг/"
    return f"/{', '.join(parts)} нийт {total_count} жуулчинг/"


def build_contract_data(payload):
    today = datetime.now(timezone.utc).astimezone(MONGOLIA_TZ).date().isoformat()
    contract_date = payload.get("contractDate") or today

    tourist_last_name = normalize_text(payload.get("touristLastName"))
    tourist_first_name = normalize_text(payload.get("touristFirstName"))

    adult_count = parse_int(payload.get("adultCount"))
    child_count = parse_int(payload.get("childCount"))
    infant_count = parse_int(payload.get("infantCount"))
    ticket_only_count = parse_int(payload.get("ticketOnlyCount"))
    land_only_count = parse_int(payload.get("landOnlyCount"))
    custom_count = parse_int(payload.get("customCount"))

    traveler_count = parse_int(payload.get("travelerCount")) or adult_count + child_count + infant_count + ticket_only_count + land_only_count + custom_count
    adult_price_raw = parse_int(payload.get("adultPrice"))
    child_price_raw = parse_int(payload.get("childPrice"))
    infant_price_raw = parse_int(payload.get("infantPrice"))
    ticket_only_price_raw = parse_int(payload.get("ticketOnlyPrice"))
    land_only_price_raw = parse_int(payload.get("landOnlyPrice"))
    custom_price_raw = parse_int(payload.get("customPrice"))
    total_price_raw = parse_int(payload.get("totalPrice"))
    if not total_price_raw:
        total_price_raw = (
            adult_count * adult_price_raw
            + child_count * child_price_raw
            + infant_count * infant_price_raw
            + ticket_only_count * ticket_only_price_raw
            + land_only_count * land_only_price_raw
            + custom_count * custom_price_raw
        )
    deposit_raw = parse_int(payload.get("depositAmount"))
    balance_raw = max(total_price_raw - deposit_raw, 0)

    contract_serial = normalize_text(payload.get("contractSerial")).strip().strip("_")
    serial_matches = re.findall(r"DTX-\d{2}[A-ZА-Я]?-?\d{2}-\d+|DTX-\d{2}[A-ZА-Я]?-\d{2}-\d+", contract_serial)
    if serial_matches:
        contract_serial = serial_matches[-1]
    if not contract_serial:
        now = datetime.now(timezone.utc).astimezone(MONGOLIA_TZ)
        year = str(now.year)[-2:]
        prefix = f"DTX-09A-{year}-"
        serials = [
            c.get("data", {}).get("contractSerial", "")
            for c in read_contracts()
            if str(c.get("data", {}).get("contractSerial", "")).startswith(prefix)
        ]
        numbers = []
        for item in serials:
            try:
                numbers.append(int(str(item).replace(prefix, "")))
            except ValueError:
                continue
        base_number = 46 if year == "26" else 0
        next_num = max(numbers or [base_number]) + 1
        contract_serial = f"{prefix}{next_num:03d}"

    manager_last = normalize_text(payload.get("managerLastName"))
    manager_first = normalize_text(payload.get("managerFirstName"))
    manager_full = dedupe_full_name(manager_last, manager_first)
    manager_email = normalize_text(payload.get("managerEmail")).lower()
    manager_phone = normalize_text(payload.get("managerPhone"))

    trip_start = normalize_text(payload.get("tripStartDate"))
    trip_end = normalize_text(payload.get("tripEndDate"))
    trip_duration = normalize_text(payload.get("tripDuration"))
    if not trip_duration and trip_start and trip_end:
        try:
            start_date = datetime.fromisoformat(trip_start).date()
            end_date = datetime.fromisoformat(trip_end).date()
            diff_days = (end_date - start_date).days + 1
            if diff_days > 0:
                trip_duration = f"{diff_days} өдөр {max(diff_days - 1, 0)} шөнө"
        except ValueError:
            trip_duration = trip_duration

    data = {
        "contractSerial": contract_serial,
        "contractDate": contract_date,
        "managerLastName": manager_last,
        "managerFirstName": manager_first,
        "managerFullName": normalize_person_name(manager_full),
        "managerEmail": manager_email,
        "managerPhone": manager_phone,
        "managerSignaturePath": normalize_text(payload.get("managerSignaturePath")),
        "touristLastName": tourist_last_name,
        "touristFirstName": tourist_first_name,
        "touristRegister": normalize_text(payload.get("touristRegister")),
        "clientPhone": normalize_text(payload.get("clientPhone")),
        "emergencyContactName": normalize_text(payload.get("emergencyContactName")),
        "emergencyContactRelation": normalize_text(payload.get("emergencyContactRelation")),
        "emergencyContactPhone": normalize_text(payload.get("emergencyContactPhone")),
        "destination": normalize_text(payload.get("destination")),
        "tripStartDate": trip_start,
        "tripEndDate": trip_end,
        "tripDuration": trip_duration,
        "adultCount": adult_count,
        "childCount": child_count,
        "infantCount": infant_count,
        "ticketOnlyCount": ticket_only_count,
        "landOnlyCount": land_only_count,
        "customCount": custom_count,
        "travelerCount": traveler_count,
        "adultPrice": format_money(adult_price_raw),
        "childPrice": format_money(child_price_raw),
        "infantPrice": format_money(infant_price_raw),
        "ticketOnlyPrice": format_money(ticket_only_price_raw),
        "landOnlyPrice": format_money(land_only_price_raw),
        "customPriceLabel": normalize_text(payload.get("customPriceLabel")) or "Нэмэлт үйлчилгээ",
        "customPrice": format_money(custom_price_raw),
        "totalPrice": format_money(total_price_raw),
        "depositAmount": format_money(payload.get("depositAmount")),
        "balanceAmount": format_money(balance_raw),
        "depositDueDate": normalize_text(payload.get("depositDueDate")),
        "balanceDueDate": normalize_text(payload.get("balanceDueDate")),
    }
    data["touristSignature"] = (
        f"{data['touristLastName'][:1]}.{data['touristFirstName']}" if data["touristLastName"] else data["touristFirstName"]
    )

    parts = []
    if adult_count:
        parts.append(f"{adult_count} том хүний {data['adultPrice']} төгрөг")
    if child_count:
        parts.append(f"{child_count} хүүхдийн {data['childPrice']} төгрөг")
    if infant_count:
        parts.append(f"{infant_count} нярай хүүхдийн {data['infantPrice']} төгрөг")
    if ticket_only_count:
        parts.append(f"{ticket_only_count} зочин зөвхөн билеттэй {data['ticketOnlyPrice']} төгрөг")
    if land_only_count:
        parts.append(f"{land_only_count} зочин газрын үйлчилгээтэй {data['landOnlyPrice']} төгрөг")
    if custom_count:
        parts.append(f"{custom_count} зочин {data['customPriceLabel']} {data['customPrice']} төгрөг")
    price_breakdown = ", ".join(part for part in parts if part)
    data["priceBreakdown"] = price_breakdown or ""
    data["paymentParagraph"] = (
        f"Энэхүү гэрээгээр аялагчийн төлбөр нь {price_breakdown}, нийт {data['travelerCount']} хүний {data['totalPrice']} төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно."
        if price_breakdown
        else f"Энэхүү гэрээгээр аялагчийн төлбөр нь нийт {data['travelerCount']} хүний {data['totalPrice']} төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно."
    )
    data["depositParagraph"] = (
        f"Аяллын төлбөр дараах байдлаар хийгдэнэ. 5.3.1.Аяллын урьдчилгаа төлбөр болох {data['depositAmount']} төгрөгийг {format_balance_due_date(data['depositDueDate'])} өдөр “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN03 0034 3432 7777 9999 дансанд хийснээр аялал баталгаажна."
    )
    data["balanceParagraph"] = (
        f"5.3.2 Аяллын үлдэгдэл төлбөр болох {data['balanceAmount']} төгрөгийг {format_balance_due_date(data['balanceDueDate'])} өдөр “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN03 0034 3432 7777 9999 дансанд хийнэ."
    )
    return data


def validate_contract_data(data):
    required = [
        "contractSerial",
        "contractDate",
        "managerLastName",
        "managerFirstName",
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


def ensure_child(parent, tag):
    child = parent.find(qname(tag))
    if child is None:
        child = ET.Element(qname(tag))
        parent.append(child)
    return child


def set_or_create(parent, tag, attributes):
    node = parent.find(qname(tag))
    if node is None:
        node = ET.Element(qname(tag))
        parent.append(node)
    for key, value in attributes.items():
        node.set(qname(key), value)
    return node


def update_docx_styles(styles_xml):
    root = ET.fromstring(styles_xml)

    doc_defaults = root.find(qname("docDefaults"))
    if doc_defaults is None:
        doc_defaults = ET.Element(qname("docDefaults"))
        root.insert(0, doc_defaults)

    rpr_default = ensure_child(doc_defaults, "rPrDefault")
    rpr = ensure_child(rpr_default, "rPr")
    set_or_create(rpr, "rFonts", {"ascii": "Times New Roman", "hAnsi": "Times New Roman", "cs": "Times New Roman"})
    set_or_create(rpr, "sz", {"val": "24"})
    set_or_create(rpr, "szCs", {"val": "24"})

    for style in root.findall(qname("style")):
        style_type = style.get(qname("type"))
        style_id = style.get(qname("styleId"))
        if style_type == "paragraph" and style_id in {"Normal", "BodyText", "DefaultParagraphFont"}:
            style_rpr = ensure_child(style, "rPr")
            set_or_create(style_rpr, "rFonts", {"ascii": "Times New Roman", "hAnsi": "Times New Roman", "cs": "Times New Roman"})
            set_or_create(style_rpr, "sz", {"val": "24"})
            set_or_create(style_rpr, "szCs", {"val": "24"})

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def replace_template_paragraphs(root, data):
    manager_formal_name = get_manager_contract_formal_name(data)
    manager_signature_name = get_manager_signature_name(data)
    trip_range_phrase = format_trip_range_phrase(data["tripStartDate"], data["tripEndDate"])
    traveler_count_sentence = build_traveler_count_sentence(data)
    traveler_representation_phrase = build_traveler_representation_phrase(data)
    replacements = {
        "Дугаар: DTX-09А-26-_____": f"Дугаар: {data['contractSerial']}",
        "2026 оны 01 сарын 26 өдөр                                                 Улаанбаатар хот":
            f"{format_contract_header_date(data['contractDate'])}                                                 Улаанбаатар хот",
        "Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл, Иргэний хуулийн 370-379 дүгээр зүйлийг үндэслэн нэг талаас “Дэлхий Трэвел Икс” ХХК (РД:6925073) цаашид Дэлхий Трэвел Икс гэхийг төлөөлөн аяллын менежер албан тушаалтай Чулуунбаатар овогтой Нямбаяр, нөгөө талаас 2 жуулчин төлөөлөн Батмөнх овогтой Уранчимэг (РД:ШД84011762) нар харилцан тохиролцож энэхүү аялал жуулчлалын гэрээг байгуулав.":
            "Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл, Иргэний хуулийн 370-379 дүгээр зүйлийг үндэслэн нэг талаас “Дэлхий Трэвел Икс” ХХК (РД:6925073) цаашид Дэлхий Трэвел Икс гэхийг төлөөлөн аяллын менежер албан тушаалтай "
            f"{manager_formal_name}, нөгөө талаас цаашид Жуулчин гэхийг {traveler_representation_phrase} төлөөлөн, {data['touristLastName']} овогтой {data['touristFirstName']} нар харилцан тохиролцож энэхүү аялал жуулчлалын гэрээг байгуулав.",
        "Энэхүү гэрээгээр Дэлхий Трэвел Икс нь 2026/02/17-2026/02/25 хооронд Египет аяллын хөтөлбөртэй үйлчилгээг үзүүлэх, аялал зохион байгуулах, Жуулчин нь гэрээний нөхцөлийн дагуу төлбөрийг төлөх, аяллын үйлчилгээ авахтай холбоотой талуудын эдлэх эрх, үүрэг, хариуцлага, төлбөр тооцоотой холбогдон үүссэн харилцааг зохицуулна.":
            f"Энэхүү гэрээгээр Дэлхий Трэвел Икс нь {trip_range_phrase} {data['destination']} чиглэлийн аяллын хөтөлбөртэй үйлчилгээг үзүүлэх, аялал зохион байгуулах, Жуулчин нь гэрээний нөхцөлийн дагуу төлбөрийг төлөх, аяллын үйлчилгээ авахтай холбоотой талуудын эдлэх эрх, үүрэг, хариуцлага, төлбөр тооцоотой холбогдон үүссэн харилцааг зохицуулна.",
        "Энэхүү гэрээгээр аялагчийн төлбөр нь том хүний 7,340,000 төгрөг буюу нийт 2 хүний 14,680,000 төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно.":
            data["paymentParagraph"],
        "Аяллын төлбөр дараах байдлаар хийгдэнэ. 5.3.1.Аяллын урьдчилгаа төлбөр болох 4,404,000 төгрөгийг 2026 оны 01-р сарын 26 өдөр “Дэлхий Трэвел Икс”  ХХК-ний  Төрийн Банкны MN03 0034 3432":
            data["depositParagraph"],
        "7777 9999 дугаартай дансанд хийснээр аялал баталгаажна.":
            "",
        "5.3.2 Аяллын үлдэгдэл төлбөр болох 10,276,000 төгрөгийг 2026 оны 02 сарын 06 өдөр “Дэлхий Трэвел Икс”  ХХК-ний  Төрийн Банкны MN03 0034 3432":
            data["balanceParagraph"],
        "7777 9999 дугаартай дансанд хийнэ.":
            "",
        "Б. Уранчимэг":
            f"{data['touristLastName']} {data['touristFirstName']}",
        "Утас:":
            f"Утас: {data.get('clientPhone') or ''}".strip(),
        "VIBER:":
            f"Яаралтай үед холбоо барих: {data.get('emergencyContactName') or ''}".strip(),
        "FACEBOOK:":
            f"Холбоо барих утас: {data.get('emergencyContactPhone') or ''}".strip(),
        "Хаяг: _____________ хот, ___________":
            "",
        "дүүрэг, ______________________ гудамж,":
            "",
        "______ хороо, _________________хотхон":
            "",
        "______ байр ___тоот":
            "",
        "Яаралтай үед холбоо барих утасны дугаар:":
            f"Яаралтай үед холбоо барих утас: {data.get('emergencyContactPhone') or ''}".strip(),
        "Таны хэн болох:":
            f"Таны хэн болох: {data.get('emergencyContactRelation') or ''}".strip(),
        "2026 оны 03 сарын 13 өдөр                                                                                Улаанбаатар хот":
            f"{format_contract_header_date(data['contractDate'])}                                                                                Улаанбаатар хот",
        "Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл, Иргэний хуулийн 370-379 дүгээр зүйлийг үндэслэн нэг талаас “Дэлхий Трэвел Икс” ХХК (РД:6925073) цаашид Дэлхий Трэвел Икс гэхийг төлөөлөн аяллын менежер албан тушаалтай Чулуунбаатар овогтой Нямбаяр, нөгөө талаас Жуулчин цаашид “Жуулчин” гэхийг төлөөлөн Цэдэн-Иш овогтой Чинзориг (РД: ШЕ77111832) нар харилцан тохиролцож энэхүү аялал жуулчлалын гэрээг байгуулав.":
            "Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл, Иргэний хуулийн 370-379 дүгээр зүйлийг үндэслэн нэг талаас “Дэлхий Трэвел Икс” ХХК (РД:6925073) цаашид Дэлхий Трэвел Икс гэхийг төлөөлөн аяллын менежер албан тушаалтай "
            f"{manager_formal_name}, нөгөө талаас цаашид Жуулчин гэхийг {traveler_representation_phrase} төлөөлөн, "
            f"{data['touristLastName']} овогтой {data['touristFirstName']} нар харилцан тохиролцож энэхүү аялал жуулчлалын гэрээг байгуулав.",
        "Энэхүү гэрээгээр Дэлхий Трэвел Икс нь 2026/03/28-2026/04/03 хооронд Турк аялал, 7 өдөр 6 шөнө, хөтөлбөртэй аяллын дагуу 5 аялагчдад үйлчилгээг үзүүлэх, аялал зохион байгуулах, Жуулчин нь гэрээний нөхцөлийн дагуу төлбөрийг төлөх, аяллын үйлчилгээ авахтай холбоотой талуудын эдлэх эрх, үүрэг, хариуцлага, төлбөр тооцоотой холбогдон үүссэн харилцааг зохицуулна.":
            f"Энэхүү гэрээгээр Дэлхий Трэвел Икс нь {trip_range_phrase} {data['destination']} чиглэлийн аяллын хөтөлбөртэй, {data['tripDuration']}, үйлчилгээг үзүүлэх, аялал зохион байгуулах, Жуулчин нь гэрээний нөхцөлийн дагуу төлбөрийг төлөх, аяллын үйлчилгээ авахтай холбоотой талуудын эдлэх эрх, үүрэг, хариуцлага, төлбөр тооцоотой холбогдон үүссэн харилцааг зохицуулна.",
        "Энэхүү гэрээгээр аялагчийн төлбөр нь 3 том хүний 3,990,000 төгрөг, 1 хүүхдийн 3,390,000  төгрөг, 1 хүний онгоц ороогүй дүн 2,590,000 төгрөг,  нийт 5 аялагчийн аяллын төлбөр 17,450,000 төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно.":
            data["paymentParagraph"],
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
            f"Нэг талаас Дэлхий Трэвел Икс ХХК (6925073 )/цаашид “Аялал зохион байгуулагч” гэх/ түүнийг төлөөлөн менежер {manager_signature_name},",
        "Нөгөө талаас 21 аялагчийг төлөөлөн, ХХХХХХХХ овогтой XXXXXXXX (РД: ДЙ91101311) /цаашид “Захиалагч” гэх/ нар дор дурдсан нөхцөлөөр харилцан тохиролцож  байгуулав.":
            f"Нөгөө талаас {data['travelerCount']} аялагчийг төлөөлөн, {data['touristLastName']} овогтой {data['touristFirstName']} (РД: {data['touristRegister']}) /цаашид “Захиалагч” гэх/ нар дор дурдсан нөхцөлөөр харилцан тохиролцож  байгуулав.",
        "Энэхүү гэрээгээр Аялал зохион байгуулагч нь захиалагчийн хүсэлтээр Тайланд улсын Пукет арлаар аялах хөтөлбөртэй аяллыг 2025/02/16 – 2025/02/23-ны хооронд 8 өдөр 7 шөнөөр тооцож энэ гэрээнд заагдсан аяллыг зохион байгуулах,":
            f"Энэхүү гэрээгээр Аялал зохион байгуулагч нь захиалагчийн хүсэлтээр {data['destination']} чиглэлд аялах хөтөлбөртэй аяллыг {data['tripStartDate']} – {data['tripEndDate']}-ны хооронд {data['tripDuration']} тооцож энэ гэрээнд заагдсан аяллыг зохион байгуулах,",
        "1 том хүний 4’590’000 төгрөг, нийт 21 хүний 96,390,000 төгрөг байхаар харилцан тохиров.":
            data["paymentParagraph"],
        "Аяллын урьдчилгаа төлбөр болох 10,980,000 төгрөгийг  2026 оны 01 сарын 24 –ны өдрийн дотор Төрийн банкны MN030034 3432 7777 9999 тоот төгрөгийн дансанд шилжүүлнэ.":
            f"Аяллын урьдчилгаа төлбөр болох {data['depositAmount']} төгрөгийг  {format_balance_due_date(data['depositDueDate'])} өдрийн дотор Төрийн банкны MN030034 3432 7777 9999 тоот төгрөгийн дансанд шилжүүлнэ.",
        "Аяллын үлдэгдэл болох 10,980,000 төгрөгийг  2026 оны 01 сарын 24 –ны өдрийн дотор Төрийн банкны MN030034 3432 7777 9999 тоот төгрөгийн дансанд шилжүүлнэ.":
            f"Аяллын үлдэгдэл болох {data['balanceAmount']} төгрөгийг  {format_balance_due_date(data['balanceDueDate'])} өдрийн дотор Төрийн банкны MN030034 3432 7777 9999 тоот төгрөгийн дансанд шилжүүлнэ.",
        "XXXXX Овогтой XXXXXXXX":
            f"{data['touristLastName']} Овогтой {data['touristFirstName']}",
    }

    for paragraph in root.findall(f".//{qname('p')}"):
        current_text = paragraph_text(paragraph)
        if "хараар оршин сууж байсан удаатай" in current_text:
            set_paragraph_text(paragraph, current_text.replace("хараар оршин сууж байсан удаатай", "хараар оршин сууж байсан"))
            continue
        if current_text.strip().startswith("Цоо шинэ паспорттой эсэх."):
            set_paragraph_text(paragraph, "")
            continue
        if current_text.strip().startswith("Гадаад паспортоо өмнө нь хаяж гээгдүүлж байсан эсэх"):
            set_paragraph_text(paragraph, "")
            continue
        if current_text in replacements:
            set_paragraph_text(paragraph, replacements[current_text])
            continue
        if current_text.startswith("Хөтөлбөрт аяллаар"):
            set_paragraph_text(paragraph, traveler_count_sentence)
            continue
        if current_text.startswith("Зорчих чиглэл нь визтэй бол"):
            set_paragraph_text(paragraph, "Зорчих чиглэл нь визтэй эсвэл визний тусгай нөхцөлтэй чиглэл бол энэхүү гэрээний Хавсралт 2 - Харилцан ойлголцлын санамж бичиг нь гэрээний салшгүй хэсэг байна.")


def get_contract_template_path():
    template_path = TEMPLATE_FILE
    if not template_path.exists() and ALT_TEMPLATE.exists():
        template_path = ALT_TEMPLATE
    if not template_path.exists() and TEMPLATE_FALLBACK.exists():
        template_path = TEMPLATE_FALLBACK
    return template_path


def load_contract_template_root(data):
    template_path = get_contract_template_path()
    if not template_path.exists():
        return None

    with zipfile.ZipFile(template_path, "r") as source_zip:
        document_xml = source_zip.read("word/document.xml")

    root = ET.fromstring(document_xml)
    replace_template_paragraphs(root, data)
    return root


def normalize_contract_heading(text):
    normalized = " ".join((text or "").strip().upper().split())
    normalized = normalized.replace("YY", "ҮҮ")
    normalized = normalized.replace(" YY", " ҮҮ")
    normalized = normalized.replace("ЖУУЛЧИН Ы", "ЖУУЛЧИНЫ")
    normalized = normalized.replace("ЖУУЛЧНЫ", "ЖУУЛЧИНЫ")
    normalized = normalized.replace(", Ү Ү Р Э Г", ", ҮҮРЭГ")
    normalized = normalized.replace(", Ү ҮРЭГ", ", ҮҮРЭГ")
    normalized = normalized.replace(", YYРЭГ", ", ҮҮРЭГ")
    normalized = normalized.replace("  ", " ")
    return normalized.strip()


def extract_contract_blocks(data):
    root = load_contract_template_root(data)
    if root is None:
        return []

    body = root.find(qname("body"))
    if body is None:
        return []

    section_heading_map = {
        "ЕРӨНХИЙ ЗҮЙЛ": "1. ЕРӨНХИЙ ЗҮЙЛ",
        "ГЭРЭЭНИЙ ХУГАЦАА": "2. ГЭРЭЭНИЙ ХУГАЦАА",
        "АЯЛАЛ ЗОХИОН БАЙГУУЛАГЧИЙН ЭРХ, ҮҮРЭГ": "3. АЯЛАЛ ЗОХИОН БАЙГУУЛАГЧИЙН ЭРХ, ҮҮРЭГ",
        "ЖУУЛЧИНЫ ЭРХ, ҮҮРЭГ": "4. ЖУУЛЧИНЫ ЭРХ, ҮҮРЭГ",
        "АЯЛЛЫН ЗАРДАЛ, ТӨЛБӨР ТООЦОО": "5. АЯЛЛЫН ЗАРДАЛ, ТӨЛБӨР ТООЦОО",
        "ТАЛУУДЫН ХАРИУЦЛАГА": "6. ТАЛУУДЫН ХАРИУЦЛАГА",
        "ХИЛИЙН ШАЛГАН НЭВТРҮҮЛЭХ ХЭСЭГ": "7. ХИЛИЙН ШАЛГАН НЭВТРҮҮЛЭХ ХЭСЭГ",
        "БУСАД ЗҮЙЛ": "8. БУСАД ЗҮЙЛ",
    }

    blocks = []
    current_section = None
    subsection_index = 0

    for element in body:
        tag = element.tag.split("}")[-1]
        if tag == "p":
            text = paragraph_text(element).strip()
            if not text:
                continue
            text = text.replace("хараар оршин сууж байсан удаатай", "хараар оршин сууж байсан")
            if text.startswith("Цоо шинэ паспорттой эсэх."):
                continue
            if text.startswith("Гадаад паспортоо өмнө нь хаяж гээгдүүлж байсан эсэх"):
                continue
            normalized = normalize_contract_heading(text)
            if normalized in {"ГЭРЭЭГ БАЙГУУЛСАН:", "ГЭРЭЭГ БАЙГУУЛСАН"}:
                break
            if normalized in section_heading_map:
                numbered_heading = section_heading_map[normalized]
                current_section = numbered_heading.split(".", 1)[0]
                subsection_index = 0
                blocks.append({"type": "heading", "text": numbered_heading})
            elif current_section is not None:
                subsection_index += 1
                blocks.append(
                    {
                        "type": "numbered-paragraph",
                        "number": f"{current_section}.{subsection_index}.",
                        "text": text,
                    }
                )
            else:
                blocks.append({"type": "paragraph", "text": text})
        elif tag == "tbl":
            rows = []
            for row in element.findall(f".//{qname('tr')}"):
                cells = []
                for cell in row.findall(f".//{qname('tc')}"):
                    cell_text = " ".join(
                        paragraph_text(p).strip()
                        for p in cell.findall(f".//{qname('p')}")
                    ).strip()
                    cells.append(cell_text)
                if cells:
                    rows.append(cells)
            if rows:
                blocks.append({"type": "table", "rows": rows})
    return blocks


def generate_docx(data, output_path):
    ensure_data_store()
    template_path = get_contract_template_path()
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found at {template_path}")

    with zipfile.ZipFile(template_path, "r") as source_zip:
        document_xml = source_zip.read("word/document.xml")
        root = ET.fromstring(document_xml)
        replace_template_paragraphs(root, data)
        new_document_xml = ET.tostring(root, encoding="utf-8", xml_declaration=True)
        styles_xml = None
        if "word/styles.xml" in source_zip.namelist():
            styles_xml = update_docx_styles(source_zip.read("word/styles.xml"))

        with zipfile.ZipFile(output_path, "w") as target_zip:
            for item in source_zip.infolist():
                content = source_zip.read(item.filename)
                if item.filename == "word/document.xml":
                    content = new_document_xml
                elif item.filename == "word/styles.xml" and styles_xml is not None:
                    content = styles_xml
                target_zip.writestr(item, content)


def render_docx_to_html(data):
    if not get_contract_template_path().exists():
        return "<p>Template not found.</p>"
    blocks = extract_contract_blocks(data)
    if not blocks:
        return "<p>Template is empty.</p>"

    parts = []
    for block in blocks:
        if block["type"] == "heading":
            parts.append(f"<h2>{html.escape(block['text'])}</h2>")
        elif block["type"] == "numbered-paragraph":
            parts.append(
                "<p class=\"contract-numbered\">"
                f"<span class=\"contract-number\">{html.escape(block['number'])}</span>"
                f"<span class=\"contract-text\">{html.escape(block['text'])}</span>"
                "</p>"
            )
        elif block["type"] == "paragraph":
            parts.append(f"<p>{html.escape(block['text'])}</p>")
        elif block["type"] == "table":
            rows = []
            for row in block["rows"]:
                cells = "".join(f"<td>{html.escape(cell)}</td>" for cell in row)
                rows.append(f"<tr>{cells}</tr>")
            parts.append(f"<table>{''.join(rows)}</table>")
    return "\n".join(parts)


def get_contract_display_blocks(data):
    blocks = []
    for block in extract_contract_blocks(data):
        if block["type"] == "paragraph":
            text = block["text"].strip()
            if text == "АЯЛАЛ ЖУУЛЧЛАЛЫН ГЭРЭЭ":
                continue
            if text.startswith("Дугаар:"):
                continue
            if "Улаанбаатар хот" in text and any(ch.isdigit() for ch in text):
                continue
        blocks.append(block)
    return blocks


def build_contract_body_html(data):
    blocks = get_contract_display_blocks(data)

    if not blocks:
        return "<p>Template is empty.</p>"

    def format_contract_text_html(text):
        escaped = html.escape(text)
        return re.sub(
            r"(\d{1,3}(?:,\d{3})+(?:\s*төгрөг(?:ийг|ийн|өөр|өөс|төгрөг)?)?)",
            r"<strong>\1</strong>",
            escaped,
        )

    parts = []
    for block in blocks:
        if block["type"] == "heading":
            parts.append(f"<h2>{html.escape(block['text'])}</h2>")
        elif block["type"] == "numbered-paragraph":
            parts.append(
                "<p class=\"contract-numbered\">"
                f"<span class=\"contract-number\">{html.escape(block['number'])}</span>"
                f"<span class=\"contract-text\">{format_contract_text_html(block['text'])}</span>"
                "</p>"
            )
        elif block["type"] == "paragraph":
            paragraph_class = "contract-opening-paragraph" if block["text"].startswith("Монгол Улсын Аялал Жуулчлалын тухай хуулийн 13.1 дүгээр зүйл") else ""
            class_attr = f' class="{paragraph_class}"' if paragraph_class else ""
            parts.append(f"<p{class_attr}>{format_contract_text_html(block['text'])}</p>")
        elif block["type"] == "table":
            rows = []
            for row in block["rows"]:
                cells = "".join(f"<td>{format_contract_text_html(cell)}</td>" for cell in row)
                rows.append(f"<tr>{cells}</tr>")
            parts.append(f"<table>{''.join(rows)}</table>")
    return "\n".join(parts)


def build_contract_html(data, signature_path=None, asset_mode="web", contract_id=None):
    content = build_contract_body_html(data)
    organizer_name = html.escape(get_manager_display_name(data))
    customer_name = html.escape(data.get("touristSignature") or "")
    manager_display_name = html.escape(get_manager_signature_name(data))
    manager_email = html.escape(get_manager_contract_email(data))
    manager_phone = html.escape(get_manager_contract_phone(data))
    contract_date = html.escape(format_contract_header_date(data["contractDate"]))
    contract_serial = html.escape(data["contractSerial"])
    signature_markup = ""
    if signature_path:
        signature_src = signature_path
        if asset_mode == "file":
            sig_file = (GENERATED_DIR / signature_path.replace("/generated/", "", 1)).resolve()
            if sig_file.exists():
                signature_src = sig_file.as_uri()
        signature_markup = f'<img class="tourist-signature-image" src="{html.escape(signature_src)}" alt="Tourist signature" />'

    def asset_src(filename):
        if asset_mode == "file":
            return (PUBLIC_DIR / "assets" / filename).resolve().as_uri()
        return f"/assets/{filename}"

    manager_signature_src = asset_src("nyambayar-signature-cropped.png")
    manager_signature_path = normalize_text(data.get("managerSignaturePath"))
    if manager_signature_path:
        manager_signature_src = manager_signature_path
        if asset_mode == "file" and manager_signature_path.startswith("/generated/"):
            manager_file = (GENERATED_DIR / manager_signature_path.replace("/generated/", "", 1)).resolve()
            if manager_file.exists():
                manager_signature_src = manager_file.as_uri()

    download_href = f"/api/contracts/{contract_id}/document?mode=download" if contract_id else ""
    download_button = (
        f'<a href="{html.escape(download_href)}">PDF Татах</a>'
        if download_href
        else '<button onclick="window.print()">Print</button>'
    )

    return f"""<!DOCTYPE html>
<html lang="mn">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Аялал жуулчлалын гэрээ</title>
    <link rel="icon" type="image/png" href="{asset_src('favicon-dtx-x.png')}" />
    <style>
      @font-face {{
        font-family: "TravelXTimes";
        src:
          local("Times New Roman"),
          local("Times New Roman Regular"),
          url("{asset_src('fonts/times-new-roman.ttf')}") format("truetype");
        font-weight: 400;
        font-style: normal;
      }}
      @font-face {{
        font-family: "TravelXTimes";
        src:
          local("Times New Roman Bold"),
          local("Times New Roman"),
          url("{asset_src('fonts/times-new-roman-bold.ttf')}") format("truetype");
        font-weight: 700;
        font-style: normal;
      }}
      :root {{
        color-scheme: light;
        --ink: #1d1d1b;
        --paper: #ffffff;
        --accent: #1d2b4f;
        --muted: #6e645f;
        --page-width: 210mm;
        --page-height: 297mm;
        --page-top: 2cm;
        --page-right: 3cm;
        --page-bottom: 2cm;
        --page-left: 3cm;
      }}
      @page {{
        size: A4;
        margin: 2cm 3cm 2cm 3cm;
        @bottom-center {{
          content: counter(page);
          font-family: "TravelXTimes", "Times New Roman", "Liberation Serif", serif;
          font-size: 10pt;
        }}
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        background: #f4f2ee;
        color: var(--ink);
        font-family: "TravelXTimes", "Times New Roman", "Liberation Serif", serif;
        line-height: 1.5;
      }}
      .toolbar {{
        position: sticky;
        top: 0;
        display: flex;
        gap: 12px;
        justify-content: center;
        padding: 16px;
        background: rgba(255, 255, 255, 0.96);
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
        width: var(--page-width);
        min-height: var(--page-height);
        margin: 24px auto 56px;
        padding: var(--page-top) var(--page-right) var(--page-bottom) var(--page-left);
        background: var(--paper);
        box-shadow: 0 20px 60px rgba(71, 53, 43, 0.12);
      }}
      .doc-logo {{
        display: flex;
        justify-content: center;
        margin-bottom: 14px;
      }}
      .doc-logo-image {{
        width: 220px;
        max-width: 100%;
        height: auto;
        display: block;
      }}
      h1 {{
        margin: 0 0 10px;
        text-align: center;
        font-size: 12pt;
      }}
      .contract-number-line {{
        margin: 0 0 18px;
        text-align: center;
        font-size: 12pt;
      }}
      .contract-number-label {{
        text-decoration: none;
      }}
      .contract-date-row {{
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 24px;
        font-size: 12pt;
      }}
      h2 {{
        margin: 22px 0 12px;
        font-size: 12pt;
        text-align: center;
        text-transform: uppercase;
      }}
      p {{
        margin: 0 0 12px;
        font-size: 12pt;
        line-height: 1.5;
        text-align: justify;
      }}
      .contract-opening-paragraph {{
        text-indent: 1.25cm;
        margin-top: 8px;
      }}
      .contract-numbered {{
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }}
      .contract-number {{
        flex: 0 0 auto;
        font-weight: 700;
      }}
      .contract-text {{
        flex: 1 1 auto;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0 24px;
      }}
      td, th {{
        border: 1px solid #1d1d1b;
        padding: 8px 10px;
        font-size: 12pt;
        line-height: 1.5;
        text-align: center;
      }}
      .signature-section {{
        margin-top: 42px;
        padding-top: 10px;
        page-break-inside: auto;
      }}
      .signature-heading {{
        margin: 0 0 22px;
        text-align: center;
        font-size: 12pt;
        font-weight: 700;
      }}
      .signature-grid {{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        align-items: start;
      }}
      .signature-column {{
        display: flex;
        flex-direction: column;
      }}
      .signature-prelude {{
        min-height: 88px;
      }}
      .signature-title {{
        margin-bottom: 12px;
        font-size: 12pt;
        font-weight: 700;
      }}
      .signature-org-name {{
        margin-bottom: 12px;
        font-size: 12pt;
        font-weight: 700;
      }}
      .signature-sign-label {{
        margin: 0 0 8px;
        font-size: 12pt;
        font-weight: 400;
      }}
      .signature-sign-area {{
        position: relative;
        width: 100%;
        max-width: 360px;
        height: 144px;
        margin: 0 0 10px;
        display: flex;
        align-items: flex-end;
        border-bottom: 1px solid rgba(0, 0, 0, 0.28);
        overflow: visible;
      }}
      .signature-stack {{
        position: relative;
        width: 100%;
        height: 100%;
      }}
      .signature-stack img {{
        position: absolute;
        object-fit: contain;
      }}
      .tourist-signature-image {{
        max-width: 300px;
        max-height: 120px;
        object-fit: contain;
      }}
      .stamp-image {{
        left: -8px;
        top: -52px;
        width: 300px;
        height: 300px;
        z-index: 3;
      }}
      .company-signature-image {{
        left: 22px;
        top: 12px;
        width: 260px;
        height: 107px;
        z-index: 2;
      }}
      .signature-contact {{
        margin-top: 10px;
        position: relative;
        z-index: 1;
      }}
      .signer-contact {{
        margin-top: 10px;
        position: relative;
        z-index: 1;
      }}
      .signature-contact p,
      .signer-contact p {{
        margin-bottom: 8px;
        line-height: 1.5;
      }}
      .signature-label {{
        display: inline-block;
        min-width: 68px;
        font-weight: 400;
      }}
      .signature-name {{
        font-size: 12pt;
        font-weight: 400;
        margin: 0 0 6px;
        min-height: 1.75em;
        display: flex;
        align-items: flex-start;
      }}
      .signature-subtitle {{
        margin: 0 0 4px;
        font-size: 12pt;
        font-weight: 400;
        min-height: 1.75em;
        display: flex;
        align-items: flex-start;
      }}
      .signer-signature-space {{
        width: 100%;
        height: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 20px;
      }}
      .signature-role {{
        margin-top: 6px;
        font-size: 12pt;
        font-weight: 400;
      }}
      @media print {{
        body {{ background: white; }}
        .toolbar {{ display: none; }}
        .page {{
          width: auto;
          min-height: auto;
          margin: 0;
          padding: 0;
          box-shadow: none;
        }}
      }}
      @media (max-width: 720px) {{
        :root {{
          --page-top: 16px;
          --page-right: 12px;
          --page-bottom: 20px;
          --page-left: 12px;
        }}
        body {{
          background: #ffffff;
        }}
        .toolbar {{
          position: static;
          padding: 12px;
          border-bottom: 0;
          background: #ffffff;
          justify-content: center;
        }}
        .page {{
          width: 100%;
          min-height: auto;
          margin: 0;
          padding: var(--page-top) var(--page-right) var(--page-bottom) var(--page-left);
          box-shadow: none;
        }}
        .doc-logo-image {{
          width: min(220px, 72vw);
        }}
        .contract-date-row {{
          gap: 12px;
          flex-wrap: wrap;
        }}
        .signature-grid {{
          grid-template-columns: 1fr;
          gap: 28px;
        }}
        .signature-prelude {{
          min-height: auto;
        }}
        .signature-sign-area {{
          max-width: 100%;
        }}
      }}
    </style>
  </head>
  <body>
    <div class="toolbar">
      {download_button}
    </div>
    <main class="page">
      <div class="doc-logo">
        <img src="{asset_src('logo.png')}" alt="Дэлхий Трэвел Икс" class="doc-logo-image" />
      </div>
      <h1>АЯЛАЛ ЖУУЛЧЛАЛЫН ГЭРЭЭ</h1>
      <p class="contract-number-line"><span class="contract-number-label">Дугаар:</span> {contract_serial}</p>
      <div class="contract-date-row">
        <span>{contract_date}</span>
        <span>Улаанбаатар хот</span>
      </div>
      {content}
      <section class="signature-section">
        <h2 class="signature-heading">ГЭРЭЭГ БАЙГУУЛСАН:</h2>
        <div class="signature-grid">
          <div class="signature-column">
            <div class="signature-prelude">
              <div class="signature-title">Аялал зохион байгуулагчийг төлөөлж:</div>
              <div class="signature-org-name">“Дэлхий Трэвел Икс” ХХК -ийн</div>
            </div>
            <p class="signature-sign-label">Гарын үсэг:</p>
            <div class="signature-sign-area">
              <div class="signature-stack">
                <img class="stamp-image" src="{asset_src('dtx-stamp-cropped.png')}" alt="DTX stamp" />
                <img class="company-signature-image" src="{html.escape(manager_signature_src)}" alt="Manager signature" />
              </div>
            </div>
            <div class="signature-contact">
              <p class="signature-name">{manager_display_name}</p>
              <p class="signature-subtitle">Аяллын менежер</p>
              <p><span class="signature-label">Гар утас:</span> {manager_phone}</p>
              <p><span class="signature-label">Утас:</span> 72007722</p>
              <p><span class="signature-label">И-мэйл:</span> {manager_email}</p>
              <p><span class="signature-label"></span> info@travelx.mn</p>
              <p><span class="signature-label">Вэбсайт:</span> www.travelx.mn</p>
              <p><span class="signature-label">Хаяг:</span> Улаанбаатар хот, Хан-Уул дүүрэг, Их Монгол Улс гудамж, 17 хороо, Кинг Тауэр 121-102 тоот</p>
            </div>
          </div>
          <div class="signature-column">
            <div class="signature-prelude">
              <div class="signature-title">Жуулчныг төлөөлж:</div>
            </div>
            <p class="signature-sign-label">Гарын үсэг:</p>
            <div class="signature-sign-area">
              <div class="signer-signature-space">{signature_markup}</div>
            </div>
            <div class="signer-contact">
              <p class="signature-name">{customer_name}</p>
              <p class="signature-subtitle">Аялагч</p>
              <p><span class="signature-label">Утас:</span> {html.escape(data.get("clientPhone") or "")}</p>
              <p>Яаралтай үед холбогдох дугаар: {html.escape(data.get("emergencyContactPhone") or "")}</p>
              <p>Таны хэн болох: {html.escape(data.get("emergencyContactRelation") or "")}</p>
            </div>
          </div>
        </div>
      </section>
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


def draw_wrapped_text_with_indent(pdf, text, x, y, max_width, font_name, font_size, leading=16, first_line_indent=0):
    from reportlab.lib.utils import simpleSplit

    if first_line_indent <= 0:
        return draw_wrapped_text(pdf, text, x, y, max_width, font_name, font_size, leading)

    first_width = max_width - first_line_indent
    lines = simpleSplit(text, font_name, font_size, first_width)
    pdf.setFont(font_name, font_size)
    for index, line in enumerate(lines):
        line_x = x + first_line_indent if index == 0 else x
        pdf.drawString(line_x, y, line)
        y -= leading
    return y


def build_invoice_line_items(data):
    destination = normalize_text(data.get("destination")) or "Аяллын үйлчилгээ"
    custom_label = normalize_text(data.get("customPriceLabel")) or "Нэмэлт үйлчилгээ"
    item_specs = [
        ("adultCount", "adultPrice", "Том хүн"),
        ("childCount", "childPrice", "Хүүхэд"),
        ("infantCount", "infantPrice", "Нярай"),
        ("ticketOnlyCount", "ticketOnlyPrice", "Зөвхөн билет"),
        ("landOnlyCount", "landOnlyPrice", "Газрын үйлчилгээ"),
        ("customCount", "customPrice", custom_label),
    ]
    populated = []
    for count_key, price_key, label in item_specs:
        count = parse_int(data.get(count_key))
        unit_price = parse_int(data.get(price_key))
        if count <= 0 or unit_price <= 0:
            continue
        populated.append((count, unit_price, label))

    if not populated:
        total_price = parse_int(data.get("totalPrice"))
        return [{"description": destination, "quantity": 1, "unitPrice": total_price, "totalPrice": total_price}]

    rows = []
    for count, unit_price, label in populated:
        rows.append(
            {
                "description": label or destination,
                "quantity": count,
                "unitPrice": unit_price,
                "totalPrice": count * unit_price,
            }
        )
    return rows


def normalize_invoice_line_items(record):
    invoice_meta = record.get("invoiceMeta") if isinstance(record.get("invoiceMeta"), dict) else {}
    raw_items = invoice_meta.get("lineItems")
    normalized = []
    if isinstance(raw_items, list):
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            description = normalize_text(item.get("description"))
            quantity = parse_int(item.get("quantity"))
            unit_price = parse_int(item.get("unitPrice"))
            total_price = parse_int(item.get("totalPrice")) or quantity * unit_price
            if not description or quantity <= 0:
                continue
            normalized.append(
                {
                    "key": normalize_text(item.get("key")) or f"item-{len(normalized) + 1}",
                    "description": description,
                    "quantity": quantity,
                    "unitPrice": unit_price,
                    "totalPrice": total_price,
                }
            )
    if normalized:
        return normalized
    return [
        {
            "key": f"item-{index}",
            "description": item["description"],
            "quantity": item["quantity"],
            "unitPrice": item["unitPrice"],
            "totalPrice": item["totalPrice"],
        }
        for index, item in enumerate(build_invoice_line_items(record.get("data") or {}), start=1)
    ]


INVOICE_STATUS_META = {
    "paid": {"label": "Төлөгдсөн", "className": "paid"},
    "waiting": {"label": "Хүлээгдэж буй", "className": "waiting"},
    "overdue": {"label": "Хугацаа хэтэрсэн", "className": "overdue"},
}

INVOICE_BANK_ACCOUNTS = {
    "state": {
        "bankName": "Төрийн Банк",
        "prefix": "MN030034",
        "accountNumber": "3432 7777 9999",
    },
    "golomt": {
        "bankName": "Голомт Банк",
        "prefix": "MN80001500",
        "accountNumber": "3675114666",
    },
}


def normalize_invoice_status(value, fallback="waiting"):
    normalized = normalize_text(value).strip().lower()
    if normalized in INVOICE_STATUS_META:
        return normalized
    return fallback


def normalize_invoice_bank_account(value, fallback="state"):
    normalized = normalize_text(value).strip().lower()
    if normalized in INVOICE_BANK_ACCOUNTS:
        return normalized
    return fallback


def build_invoice_payment_rows(record):
    data = record.get("data") or {}
    created_at = record.get("createdAt")
    signed_at = record.get("signedAt")
    today = now_mongolia().date()
    issue_date = format_iso_date_display(data.get("contractDate") or created_at)
    signed_date = format_iso_date_display(signed_at or created_at or data.get("contractDate"))
    balance_due = parse_date_safe(data.get("balanceDueDate"))
    balance_amount = parse_int(data.get("balanceAmount"))
    invoice_meta = record.get("invoiceMeta") or {}
    payment_meta = invoice_meta.get("payments") if isinstance(invoice_meta, dict) else {}
    payment_meta = payment_meta if isinstance(payment_meta, dict) else {}

    custom_rows = []
    if isinstance(payment_meta.get("rows"), list):
        for row in payment_meta.get("rows"):
            if not isinstance(row, dict):
                continue
            amount = parse_int(row.get("amount"))
            title = normalize_text(row.get("title"))
            if not title or amount <= 0:
                continue
            status_key = normalize_invoice_status(row.get("status"), fallback="waiting")
            custom_rows.append(
                {
                    "key": normalize_text(row.get("key")) or f"payment-{len(custom_rows) + 1}",
                    "title": title,
                    "created": format_iso_date_display(row.get("created")),
                    "secondaryLabel": normalize_text(row.get("secondaryLabel")) or "Эцсийн хугацаа",
                    "secondaryValue": format_iso_date_display(row.get("secondaryValue")),
                    "statusKey": status_key,
                    "status": INVOICE_STATUS_META[status_key]["label"],
                    "statusClass": INVOICE_STATUS_META[status_key]["className"],
                    "amount": amount,
                }
            )
    if custom_rows:
        return custom_rows

    rows = []
    deposit_amount = parse_int(data.get("depositAmount"))
    if deposit_amount > 0:
        deposit_status = normalize_invoice_status(
            (payment_meta.get("deposit") or {}).get("status"),
            fallback="paid",
        )
        rows.append(
            {
                "key": "deposit",
                "title": "Урьдчилгаа төлбөр",
                "created": issue_date,
                "secondaryLabel": "Төлсөн огноо",
                "secondaryValue": signed_date,
                "statusKey": deposit_status,
                "status": INVOICE_STATUS_META[deposit_status]["label"],
                "statusClass": INVOICE_STATUS_META[deposit_status]["className"],
                "amount": deposit_amount,
            }
        )

    if balance_amount > 0:
        overdue = bool(balance_due and balance_due < today)
        default_balance_status = "overdue" if overdue else "waiting"
        balance_status = normalize_invoice_status(
            (payment_meta.get("balance") or {}).get("status"),
            fallback=default_balance_status,
        )
        rows.append(
            {
                "key": "balance",
                "title": "Үлдэгдэл төлбөр",
                "created": issue_date,
                "secondaryLabel": "Эцсийн хугацаа",
                "secondaryValue": format_iso_date_display(data.get("balanceDueDate")),
                "statusKey": balance_status,
                "status": INVOICE_STATUS_META[balance_status]["label"],
                "statusClass": INVOICE_STATUS_META[balance_status]["className"],
                "amount": balance_amount,
            }
        )
    return rows


def build_invoice_html(record, asset_mode="web"):
    data = record.get("data") or {}
    invoice_meta = record.get("invoiceMeta") if isinstance(record.get("invoiceMeta"), dict) else {}
    bank_account_key = normalize_invoice_bank_account(invoice_meta.get("bankAccountKey"))
    bank_account = INVOICE_BANK_ACCOUNTS[bank_account_key]
    invoice_number = html.escape(f"{normalize_text(data.get('contractSerial')) or record.get('id', '')}-1")
    tourist_name = normalize_person_name(
        f"{normalize_text(data.get('touristLastName'))} {normalize_text(data.get('touristFirstName'))}"
    ).strip()
    customer_name = html.escape(tourist_name.upper() or "CLIENT")
    items = normalize_invoice_line_items(record)
    payment_rows = build_invoice_payment_rows(record)
    total_amount = sum(item["totalPrice"] for item in items)
    status_options_markup = "".join(
        f'<option value="{status_key}">{html.escape(status_meta["label"])}</option>'
        for status_key, status_meta in INVOICE_STATUS_META.items()
    )
    bank_options_markup = "".join(
        f'<option value="{account_key}"{" selected" if account_key == bank_account_key else ""}>{html.escape(account["bankName"])} / {html.escape(account["prefix"])} / {html.escape(account["accountNumber"])}</option>'
        for account_key, account in INVOICE_BANK_ACCOUNTS.items()
    )
    accountant_name = "Г.Баясгалан"

    def asset_src(filename):
        if asset_mode == "file":
            return (PUBLIC_DIR / "assets" / filename).resolve().as_uri()
        return f"/assets/{filename}"

    download_href = "" if asset_mode == "file" else f"/api/contracts/{record.get('id')}/invoice?mode=download"
    items_markup = "".join(
        f"""
          <tr data-item-key="{html.escape(item['key'])}">
            <td>{index}</td>
            <td>
              <span class="invoice-view-text">{html.escape(item['description'])}</span>
              <input class="invoice-edit-input" data-item-field="description" value="{html.escape(item['description'])}" />
            </td>
            <td>
              <span class="invoice-view-text">{item['quantity']}</span>
              <input class="invoice-edit-input" data-item-field="quantity" type="number" min="1" value="{item['quantity']}" />
            </td>
            <td>
              <span class="invoice-view-text">{format_money(item['unitPrice'])} ₮</span>
              <input class="invoice-edit-input" data-item-field="unitPrice" type="number" min="0" value="{item['unitPrice']}" />
            </td>
            <td>
              <span class="invoice-view-text">{format_money(item['totalPrice'])} ₮</span>
              <input class="invoice-edit-input" data-item-field="totalPrice" type="number" min="0" value="{item['totalPrice']}" />
            </td>
            <td class="item-remove-cell">
              <button type="button" class="invoice-remove-button" data-remove-item hidden>×</button>
            </td>
          </tr>
        """
        for index, item in enumerate(items, start=1)
    )
    toolbar_markup = ""
    if asset_mode != "file":
        toolbar_markup = f"""
    <div class="toolbar">
      <button type="button" class="toolbar-button is-active" data-invoice-mode="view">View</button>
      <button type="button" class="toolbar-button" data-invoice-mode="edit">Edit</button>
      <button type="button" class="toolbar-button toolbar-save" data-save-invoice hidden>Save</button>
      <a href="{html.escape(download_href)}">PDF Татах</a>
    </div>"""

    script_markup = ""
    if asset_mode != "file":
        script_markup = f"""
    <script>
      (() => {{
        const statusMeta = {json.dumps(INVOICE_STATUS_META, ensure_ascii=False)};
        const bankAccountMeta = {json.dumps(INVOICE_BANK_ACCOUNTS, ensure_ascii=False)};
        const modeButtons = Array.from(document.querySelectorAll("[data-invoice-mode]"));
        const saveButton = document.querySelector("[data-save-invoice]");
        const itemRowsBody = document.querySelector("[data-invoice-items-body]");
        const addItemButton = document.querySelector("[data-add-item]");
        const paymentStack = document.querySelector("[data-payment-stack]");
        const addPaymentButton = document.querySelector("[data-add-payment]");
        const bankSelect = document.querySelector("[data-bank-account-select]");
        const bankName = document.querySelector("[data-bank-name]");
        const bankPrefix = document.querySelector("[data-bank-prefix]");
        const bankNumber = document.querySelector("[data-bank-number]");
        const showSavedNotice = () => {{
          const notice = document.querySelector("[data-save-notice]");
          if (!notice) return;
          notice.hidden = false;
          setTimeout(() => {{
            notice.hidden = true;
          }}, 2400);
        }};
        const itemTemplate = () => {{
          const row = document.createElement("tr");
          row.dataset.itemKey = "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
          row.innerHTML = `
            <td></td>
            <td><span class="invoice-view-text"></span><input class="invoice-edit-input" data-item-field="description" value="" /></td>
            <td><span class="invoice-view-text">1</span><input class="invoice-edit-input" data-item-field="quantity" type="number" min="1" value="1" /></td>
            <td><span class="invoice-view-text">0 ₮</span><input class="invoice-edit-input" data-item-field="unitPrice" type="number" min="0" value="0" /></td>
            <td><span class="invoice-view-text">0 ₮</span><input class="invoice-edit-input" data-item-field="totalPrice" type="number" min="0" value="0" /></td>
            <td class="item-remove-cell"><button type="button" class="invoice-remove-button" data-remove-item>×</button></td>
          `;
          return row;
        }};
        const paymentTemplate = () => {{
          const wrap = document.createElement("div");
          wrap.className = "payment-card";
          wrap.dataset.paymentKey = "payment-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
          wrap.innerHTML = `
            <div class="payment-main">
              <span class="payment-title invoice-view-text"></span>
              <input class="invoice-edit-input" data-payment-field="title" value="Төлбөр" />
            </div>
            <div class="payment-meta">
              <span class="meta-label">Нэхэмжилсэн огноо</span>
              <span class="meta-value invoice-view-text">-</span>
              <input class="invoice-edit-input" data-payment-field="created" type="date" />
            </div>
            <div class="payment-meta">
              <span class="meta-label invoice-view-text" data-secondary-label-view>Эцсийн хугацаа</span>
              <input class="invoice-edit-input" data-payment-field="secondaryLabel" value="Эцсийн хугацаа" />
              <span class="meta-value invoice-view-text">-</span>
              <input class="invoice-edit-input" data-payment-field="secondaryValue" type="date" />
            </div>
            <div class="payment-meta">
              <span class="meta-label">Төлөв</span>
              <span class="payment-status payment-status-view waiting" data-status-badge>Хүлээгдэж буй</span>
              <select class="payment-status-select" data-status-select>{status_options_markup}</select>
            </div>
            <div class="payment-amount-wrap">
              <div class="payment-amount invoice-view-text">0 ₮</div>
              <input class="invoice-edit-input" data-payment-field="amount" type="number" min="0" value="0" />
              <button type="button" class="invoice-remove-button payment-remove-button" data-remove-payment>×</button>
            </div>
          `;
          return wrap;
        }};
        const setMode = (mode) => {{
          document.body.classList.toggle("is-editing", mode === "edit");
          modeButtons.forEach((button) => {{
            button.classList.toggle("is-active", button.dataset.invoiceMode === mode);
          }});
          if (saveButton) saveButton.hidden = mode !== "edit";
          if (addItemButton) addItemButton.hidden = mode !== "edit";
          if (addPaymentButton) addPaymentButton.hidden = mode !== "edit";
        }};
        const formatMoney = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0)) + " ₮";
        const syncItemRows = () => {{
          Array.from(itemRowsBody?.querySelectorAll("tr[data-item-key]") || []).forEach((row, index) => {{
            const descriptionInput = row.querySelector('[data-item-field="description"]');
            const quantityInput = row.querySelector('[data-item-field="quantity"]');
            const unitInput = row.querySelector('[data-item-field="unitPrice"]');
            const totalInput = row.querySelector('[data-item-field="totalPrice"]');
            const quantity = Number(quantityInput?.value || 0);
            const unitPrice = Number(unitInput?.value || 0);
            if (totalInput) totalInput.value = String(quantity * unitPrice);
            const cells = row.querySelectorAll("td");
            if (cells[0]) cells[0].textContent = index + 1;
            if (cells[1]) {{
              const view = cells[1].querySelector(".invoice-view-text");
              if (view) view.textContent = descriptionInput?.value || "";
            }}
            if (cells[2]) {{
              const view = cells[2].querySelector(".invoice-view-text");
              if (view) view.textContent = quantityInput?.value || "0";
            }}
            if (cells[3]) {{
              const view = cells[3].querySelector(".invoice-view-text");
              if (view) view.textContent = formatMoney(unitInput?.value || 0);
            }}
            if (cells[4]) {{
              const view = cells[4].querySelector(".invoice-view-text");
              if (view) view.textContent = formatMoney(totalInput?.value || 0);
            }}
          }});
          const total = Array.from(itemRowsBody?.querySelectorAll('[data-item-field="totalPrice"]') || []).reduce((sum, input) => sum + Number(input.value || 0), 0);
          const totalCell = document.querySelector("[data-invoice-total]");
          if (totalCell) totalCell.textContent = formatMoney(total);
        }};
        const syncBankAccount = () => {{
          if (!bankSelect) return;
          const meta = bankAccountMeta[bankSelect.value] || bankAccountMeta.state;
          if (bankName) bankName.textContent = meta.bankName;
          if (bankPrefix) bankPrefix.textContent = meta.prefix;
          if (bankNumber) bankNumber.textContent = meta.accountNumber;
        }};
        const syncBadges = () => {{
          Array.from(document.querySelectorAll("[data-status-select]")).forEach((select) => {{
            const card = select.closest("[data-payment-key]");
            const badge = card?.querySelector("[data-status-badge]");
            const meta = statusMeta[select.value] || statusMeta.waiting;
            if (!badge) return;
            badge.textContent = meta.label;
            badge.className = "payment-status payment-status-view " + meta.className;
          }});
        }};
        const syncSelectDefaults = () => {{
          Array.from(document.querySelectorAll("[data-status-select]")).forEach((select) => {{
            const card = select.closest("[data-payment-key]");
            if (!card) return;
            const badge = card.querySelector("[data-status-badge]");
            const currentValue = Object.entries(statusMeta).find(([, meta]) => meta.label === badge?.textContent)?.[0] || select.value || "waiting";
            select.value = currentValue;
          }});
        }};
        const syncPaymentCards = () => {{
          Array.from(paymentStack?.querySelectorAll("[data-payment-key]") || []).forEach((card) => {{
            const titleInput = card.querySelector('[data-payment-field="title"]');
            const createdInput = card.querySelector('[data-payment-field="created"]');
            const secondaryLabelInput = card.querySelector('[data-payment-field="secondaryLabel"]');
            const secondaryValueInput = card.querySelector('[data-payment-field="secondaryValue"]');
            const amountInput = card.querySelector('[data-payment-field="amount"]');
            const views = card.querySelectorAll(".invoice-view-text");
            if (views[0]) views[0].textContent = titleInput?.value || "";
            if (views[1]) views[1].textContent = createdInput?.value || "-";
            if (views[2]) views[2].textContent = secondaryValueInput?.value || "-";
            if (views[3]) views[3].textContent = formatMoney(amountInput?.value || 0);
            const labelView = card.querySelector("[data-secondary-label-view]");
            if (labelView) labelView.textContent = secondaryLabelInput?.value || "Эцсийн хугацаа";
          }});
        }};
        itemRowsBody?.addEventListener("input", syncItemRows);
        paymentStack?.addEventListener("input", syncPaymentCards);
        paymentStack?.addEventListener("change", () => {{
          syncBadges();
          syncPaymentCards();
        }});
        itemRowsBody?.addEventListener("click", (event) => {{
          const button = event.target.closest("[data-remove-item]");
          if (!button) return;
          button.closest("tr")?.remove();
          syncItemRows();
        }});
        paymentStack?.addEventListener("click", (event) => {{
          const button = event.target.closest("[data-remove-payment]");
          if (!button) return;
          button.closest("[data-payment-key]")?.remove();
          syncPaymentCards();
        }});
        addItemButton?.addEventListener("click", () => {{
          const row = itemTemplate();
          itemRowsBody?.appendChild(row);
          syncItemRows();
        }});
        addPaymentButton?.addEventListener("click", () => {{
          const card = paymentTemplate();
          paymentStack?.appendChild(card);
          syncSelectDefaults();
          syncBadges();
          syncPaymentCards();
        }});
        bankSelect?.addEventListener("change", syncBankAccount);
        modeButtons.forEach((button) => {{
          button.addEventListener("click", () => setMode(button.dataset.invoiceMode || "view"));
        }});
        saveButton?.addEventListener("click", async () => {{
          saveButton.disabled = true;
          saveButton.textContent = "Saving...";
          try {{
            const payments = Array.from(document.querySelectorAll("[data-status-select]")).map((select) => {{
              const card = select.closest("[data-payment-key]");
              return {{
                key: card?.dataset.paymentKey || "",
                title: card?.querySelector('[data-payment-field="title"]')?.value || "",
                created: card?.querySelector('[data-payment-field="created"]')?.value || "",
                secondaryLabel: card?.querySelector('[data-payment-field="secondaryLabel"]')?.value || "",
                secondaryValue: card?.querySelector('[data-payment-field="secondaryValue"]')?.value || "",
                status: select.value,
                amount: Number(card?.querySelector('[data-payment-field="amount"]')?.value || 0),
              }};
            }});
            const items = Array.from(itemRowsBody?.querySelectorAll("tr[data-item-key]") || []).map((row) => ({{
              key: row.dataset.itemKey || "",
              description: row.querySelector('[data-item-field="description"]')?.value || "",
              quantity: Number(row.querySelector('[data-item-field="quantity"]')?.value || 0),
              unitPrice: Number(row.querySelector('[data-item-field="unitPrice"]')?.value || 0),
              totalPrice: Number(row.querySelector('[data-item-field="totalPrice"]')?.value || 0),
            }}));
            const response = await fetch("/api/contracts/{record.get('id')}/invoice", {{
              method: "POST",
              headers: {{ "Content-Type": "application/json" }},
              credentials: "same-origin",
              body: JSON.stringify({{
                items,
                payments,
                bankAccountKey: bankSelect?.value || "state",
              }}),
            }});
            const payload = await response.json().catch(() => ({{}}));
            if (!response.ok) {{
              throw new Error(payload.error || "Could not save invoice.");
            }}
            sessionStorage.setItem("invoiceSaved", "1");
            window.location.reload();
          }} catch (error) {{
            window.alert(error.message || "Could not save invoice.");
          }} finally {{
            saveButton.disabled = false;
            saveButton.textContent = "Save";
          }}
        }});
        syncBankAccount();
        syncItemRows();
        syncSelectDefaults();
        syncBadges();
        syncPaymentCards();
        setMode("view");
        if (sessionStorage.getItem("invoiceSaved") === "1") {{
          sessionStorage.removeItem("invoiceSaved");
          showSavedNotice();
        }}
      }})();
    </script>"""

    payment_markup = "".join(
        f"""
          <div class="payment-card" data-payment-key="{html.escape(row['key'])}">
            <div class="payment-main">
              <span class="payment-title invoice-view-text">{html.escape(row['title'])}</span>
              <input class="invoice-edit-input" data-payment-field="title" value="{html.escape(row['title'])}" />
            </div>
            <div class="payment-meta">
              <span class="meta-label">Нэхэмжилсэн огноо</span>
              <span class="meta-value invoice-view-text">{html.escape(row['created'])}</span>
              <input class="invoice-edit-input" data-payment-field="created" type="date" value="{html.escape(normalize_text(row['created']))}" />
            </div>
            <div class="payment-meta">
              <span class="meta-label invoice-view-text" data-secondary-label-view>{html.escape(row['secondaryLabel'])}</span>
              <input class="invoice-edit-input" data-payment-field="secondaryLabel" value="{html.escape(row['secondaryLabel'])}" />
              <span class="meta-value invoice-view-text">{html.escape(row['secondaryValue'])}</span>
              <input class="invoice-edit-input" data-payment-field="secondaryValue" type="date" value="{html.escape(normalize_text(row['secondaryValue']))}" />
            </div>
            <div class="payment-meta">
              <span class="meta-label">Төлөв</span>
              <span class="payment-status payment-status-view {row['statusClass']}" data-status-badge>{html.escape(row['status'])}</span>
              <select class="payment-status-select" data-status-select>
                {status_options_markup}
              </select>
            </div>
            <div class="payment-amount-wrap">
              <div class="payment-amount invoice-view-text">{format_money(row['amount'])} ₮</div>
              <input class="invoice-edit-input" data-payment-field="amount" type="number" min="0" value="{row['amount']}" />
              <button type="button" class="invoice-remove-button payment-remove-button" data-remove-payment>×</button>
            </div>
          </div>
        """
        for row in payment_rows
    )

    return f"""<!DOCTYPE html>
<html lang="mn">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Нэхэмжлэх</title>
    <link rel="icon" type="image/png" href="{asset_src('favicon-dtx-x.png')}" />
    <style>
      @page {{
        size: A4;
        margin: 14mm;
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        background: #f3f5fb;
        color: #22283a;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
      }}
      .toolbar {{
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        justify-content: center;
        gap: 12px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid rgba(34, 40, 58, 0.08);
        backdrop-filter: blur(10px);
      }}
      .toolbar a,
      .toolbar-button {{
        padding: 12px 18px;
        border: none;
        border-radius: 999px;
        background: #253776;
        color: #fff;
        text-decoration: none;
        font: 700 14px/1.2 Inter, system-ui, sans-serif;
        cursor: pointer;
      }}
      .toolbar-button {{
        background: #e9edf8;
        color: #2a3c78;
      }}
      .toolbar-button.is-active {{
        background: #253776;
        color: #fff;
      }}
      .toolbar-save {{
        background: #157347;
        color: #fff;
      }}
      .toolbar-button[hidden] {{
        display: none;
      }}
      .save-notice {{
        position: sticky;
        top: 72px;
        z-index: 9;
        width: fit-content;
        margin: 8px auto 0;
        padding: 10px 16px;
        border-radius: 999px;
        background: #dcf4e3;
        color: #1f8550;
        font: 700 13px/1.2 Inter, system-ui, sans-serif;
        box-shadow: 0 10px 24px rgba(31, 133, 80, 0.12);
      }}
      .page {{
        width: min(210mm, calc(100vw - 24px));
        margin: 20px auto 40px;
        padding: 24px 22px 26px;
        background: #fff;
        border: 1px solid #e6e8ef;
        border-radius: 12px;
        box-shadow: 0 16px 44px rgba(34, 40, 58, 0.08);
      }}
      .invoice-number {{
        margin: 0 0 18px;
        color: #3b4257;
        font-size: 17px;
        font-weight: 500;
      }}
      .header-grid {{
        display: grid;
        grid-template-columns: 1.1fr 1fr;
        gap: 26px;
        align-items: start;
      }}
      .invoice-logo {{
        width: 154px;
        max-width: 100%;
        display: block;
        margin-bottom: 8px;
      }}
      .company-name {{
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 700;
        color: #2a3150;
      }}
      .company-block p,
      .customer-block p,
      .meta-note {{
        margin: 0;
        font-size: 14px;
        line-height: 1.4;
      }}
      .meta-note {{
        text-align: right;
        color: #535b74;
      }}
      .customer-block {{
        padding-top: 54px;
      }}
      .customer-block .label {{
        display: block;
        margin-bottom: 4px;
        color: #6f7791;
        font-size: 13px;
      }}
      .section-title {{
        margin: 22px 0 12px;
        color: #7f889d;
        font-size: 14px;
        font-weight: 500;
      }}
      .invoice-edit-toolbar {{
        display: none;
        margin: -2px 0 10px;
        justify-content: flex-end;
      }}
      body.is-editing .invoice-edit-toolbar,
      body.is-editing .payment-edit-toolbar {{
        display: flex;
      }}
      .invoice-edit-button,
      .invoice-remove-button {{
        border: none;
        border-radius: 999px;
        background: #eef2fb;
        color: #2a3c78;
        font: 700 12px/1.2 Inter, system-ui, sans-serif;
        cursor: pointer;
      }}
      .invoice-edit-button {{
        padding: 8px 12px;
      }}
      .invoice-remove-button {{
        width: 28px;
        height: 28px;
      }}
      .invoice-edit-input {{
        display: none;
        width: 100%;
        min-height: 36px;
        padding: 8px 10px;
        border: 1px solid #cfd7eb;
        border-radius: 10px;
        background: #fff;
        color: #2b3148;
        font: 600 13px/1.2 Inter, system-ui, sans-serif;
      }}
      body.is-editing .invoice-edit-input {{
        display: block;
      }}
      body.is-editing .invoice-view-text {{
        display: none;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        overflow: hidden;
        border-radius: 12px;
        border: 1px solid #e7e9f1;
      }}
      th, td {{
        padding: 11px 12px;
        border-bottom: 1px solid #eceef5;
        text-align: left;
        font-size: 14px;
      }}
      th {{
        background: #fbfcfe;
        color: #4d566f;
        font-weight: 700;
      }}
      td:last-child,
      th:last-child,
      td:nth-last-child(2),
      th:nth-last-child(2) {{
        text-align: right;
      }}
      .total-row td {{
        font-weight: 700;
        background: #fdfdfd;
      }}
      .item-remove-cell {{
        display: none;
        width: 40px;
        text-align: center !important;
      }}
      body.is-editing .item-remove-cell {{
        display: table-cell;
      }}
      .payment-stack {{
        display: grid;
        gap: 14px;
      }}
      .payment-edit-toolbar {{
        display: none;
        margin: -2px 0 10px;
        justify-content: flex-end;
      }}
      .payment-card {{
        display: grid;
        grid-template-columns: 1.3fr repeat(3, minmax(110px, 0.8fr)) auto;
        gap: 14px;
        align-items: center;
        padding: 15px 16px;
        border: 1px solid #e7e9f1;
        border-radius: 14px;
        background: #fff;
        position: relative;
      }}
      body.is-editing .payment-card {{
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 14px;
        align-items: start;
        padding-right: 52px;
      }}
      body.is-editing .payment-main {{
        grid-column: 1 / -1;
      }}
      body.is-editing .payment-meta,
      body.is-editing .payment-amount-wrap {{
        min-width: 0;
      }}
      .payment-title,
      .payment-amount {{
        font-size: 14px;
        font-weight: 600;
        color: #2b3148;
      }}
      .payment-amount {{
        text-align: right;
        white-space: nowrap;
      }}
      .payment-meta {{
        display: grid;
        gap: 4px;
      }}
      .meta-value {{
        font-size: 14px;
        font-weight: 600;
        color: #2b3148;
      }}
      .meta-label {{
        color: #8b93a9;
        font-size: 13px;
      }}
      .payment-status {{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
      }}
      .payment-status.paid {{
        background: #dcf4e3;
        color: #1f8550;
      }}
      .payment-status.overdue {{
        background: #f8dede;
        color: #c44747;
      }}
      .payment-status.waiting {{
        background: #eef2fb;
        color: #506189;
      }}
      .payment-status-select {{
        display: none;
        min-height: 38px;
        padding: 8px 12px;
        border: 1px solid #cfd7eb;
        border-radius: 12px;
        background: #fff;
        color: #2b3148;
        font: 600 13px/1.2 Inter, system-ui, sans-serif;
      }}
      body.is-editing .payment-status-view {{
        display: none;
      }}
      body.is-editing .payment-status-select {{
        display: inline-flex;
      }}
      .payment-amount-wrap {{
        display: grid;
        gap: 8px;
        justify-items: end;
      }}
      body.is-editing .payment-amount-wrap {{
        justify-items: stretch;
      }}
      .payment-remove-button {{
        display: none;
        position: absolute;
        right: 14px;
        top: 14px;
      }}
      body.is-editing .payment-remove-button {{
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }}
      .bank-section {{
        margin-top: 16px;
        padding-bottom: 0;
      }}
      .bank-select-wrap {{
        display: none;
        margin: 0 0 10px;
      }}
      .bank-account-select {{
        width: 100%;
        min-height: 40px;
        padding: 8px 12px;
        border: 1px solid #cfd7eb;
        border-radius: 12px;
        background: #fff;
        color: #2b3148;
        font: 600 13px/1.2 Inter, system-ui, sans-serif;
      }}
      body.is-editing .bank-select-wrap {{
        display: block;
      }}
      .bank-grid {{
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: baseline;
        font-size: 14px;
        color: #2d344c;
      }}
      .invoice-footer {{
        margin-top: 28px;
        padding-top: 18px;
        border-top: 1px solid #e7e9f1;
      }}
      .invoice-footer-grid {{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 22px;
        align-items: start;
      }}
      .invoice-footer-party {{
        display: flex;
        flex-direction: column;
      }}
      .invoice-footer-label {{
        margin: 0 0 10px;
        color: #8b93a9;
        font-size: 13px;
      }}
      .finance-asset-wrap {{
        position: relative;
        min-height: 136px;
      }}
      .finance-stamp {{
        position: absolute;
        left: 16px;
        top: 14px;
        width: 172px;
        z-index: 2;
      }}
      .finance-stamp img {{
        width: 100%;
        height: auto;
        display: block;
      }}
      .finance-signature {{
        position: absolute;
        left: 74px;
        top: 18px;
        width: 150px;
        z-index: 1;
        height: 62px;
        overflow: hidden;
      }}
      .finance-signature img {{
        width: 220px;
        max-width: none;
        display: block;
        transform: translate(-42px, -28px) rotate(-3deg);
      }}
      .invoice-footer-space {{
        min-height: 136px;
      }}
      .invoice-sign-line {{
        height: 1px;
        background: #d6dceb;
      }}
      .invoice-sign-name {{
        margin-top: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #2b3148;
      }}
      @media print {{
        .toolbar {{
          display: none;
        }}
        .page {{
          width: auto;
          margin: 0;
          border: none;
          border-radius: 0;
          box-shadow: none;
        }}
        .bank-select-wrap {{
          display: none !important;
        }}
      }}
      @media (max-width: 820px) {{
        .header-grid {{
          grid-template-columns: 1fr;
        }}
        .customer-block {{
          padding-top: 0;
        }}
        .payment-card {{
          grid-template-columns: 1fr;
        }}
        body.is-editing .payment-card {{
          grid-template-columns: 1fr;
        }}
        .payment-amount {{
          text-align: left;
        }}
      }}
    </style>
  </head>
  <body>
    {toolbar_markup}
    <div class="save-notice" data-save-notice hidden>Saved successfully</div>
    <div class="page">
      <p class="invoice-number">Нэхэмжлэх #{invoice_number}</p>
      <div class="header-grid">
        <div class="company-block">
          <img class="invoice-logo" src="{asset_src('logo.png')}" alt="Дэлхий Трэвел" />
          <p class="company-name">Дэлхий Трэвел Икс ХХК (6925073)</p>
          <p>Улаанбаатар хот, ХУД, 17-р хороо</p>
          <p>Их Монгол Улс гудамж, Кинг Тауэр, 121 байр, 102 тоот</p>
          <p>info@travelx.mn</p>
          <p>+976 72007722</p>
        </div>
        <div>
          <p class="meta-note">Сангийн сайдын 2017 оны 12 дугаар сарын 05</p>
          <p class="meta-note">өдрийн 347 тоот тушаалын хавсралт</p>
          <div class="customer-block">
            <span class="label">Төлөгч</span>
            <p><strong>{customer_name}</strong></p>
          </div>
        </div>
      </div>
      <p class="section-title">Үнийн мэдээлэл</p>
      <div class="invoice-edit-toolbar">
        <button type="button" class="invoice-edit-button" data-add-item hidden>Мөр нэмэх</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Утга</th>
            <th>Тоо ширхэг</th>
            <th>Нэгжийн үнэ</th>
            <th>Нийт үнэ</th>
            <th class="item-remove-cell"></th>
          </tr>
        </thead>
        <tbody data-invoice-items-body>
          {items_markup}
          <tr class="total-row">
            <td colspan="4">Нийт үнэ</td>
            <td data-invoice-total>{format_money(total_amount)} ₮</td>
            <td class="item-remove-cell"></td>
          </tr>
        </tbody>
      </table>
      <p class="section-title">Төлбөрийн хуваарь</p>
      <div class="payment-edit-toolbar">
        <button type="button" class="invoice-edit-button" data-add-payment hidden>Төлбөр нэмэх</button>
      </div>
      <div class="payment-stack" data-payment-stack>
        {payment_markup}
      </div>
      <div class="bank-section">
        <p class="section-title">Дансны мэдээлэл</p>
        <div class="bank-select-wrap">
          <select class="bank-account-select" data-bank-account-select>
            {bank_options_markup}
          </select>
        </div>
        <div class="bank-grid">
          <span>Дэлхий Трэвел Икс</span>
          <span data-bank-name>{html.escape(bank_account['bankName'])}</span>
          <span data-bank-prefix>{html.escape(bank_account['prefix'])}</span>
          <strong data-bank-number>{html.escape(bank_account['accountNumber'])}</strong>
        </div>
      </div>
      <div class="invoice-footer">
        <div class="invoice-footer-grid">
          <div class="invoice-footer-party">
            <p class="invoice-footer-label">Нягтлан</p>
            <div class="finance-asset-wrap">
              <div class="finance-stamp">
                <img src="{asset_src('invoice-finance-stamp.png')}" alt="Санхүүгийн тамга" />
              </div>
              <div class="finance-signature">
                <img src="{asset_src('invoice-finance-signature-source.png')}" alt="Нягтлан гарын үсэг" />
              </div>
            </div>
            <div class="invoice-sign-line"></div>
            <div class="invoice-sign-name">{html.escape(accountant_name)}</div>
          </div>
          <div class="invoice-footer-party">
            <p class="invoice-footer-label">Төлөгч</p>
            <div class="invoice-footer-space"></div>
            <div class="invoice-sign-line"></div>
            <div class="invoice-sign-name">{customer_name}</div>
          </div>
        </div>
      </div>
    </div>
    {script_markup}
  </body>
</html>"""


def save_invoice_pdf(record):
    ensure_data_store()
    pdf_filename = f"invoice-{record['id']}.pdf"
    pdf_path = GENERATED_DIR / pdf_filename
    try:
        from weasyprint import HTML
    except Exception as exc:
        raise RuntimeError(f"WeasyPrint not available: {exc}") from exc

    html_string = build_invoice_html(record, asset_mode="file")
    try:
        HTML(string=html_string, base_url=str(BASE_DIR)).write_pdf(str(pdf_path))
    except Exception as exc:
        raise RuntimeError(f"HTML PDF generation failed: {exc}") from exc
    return f"/generated/{pdf_filename}"


def save_contract_pdf(record):
    ensure_data_store()
    pdf_filename = f"contract-{record['id']}.pdf"
    pdf_path = GENERATED_DIR / pdf_filename
    try:
        from weasyprint import HTML
    except Exception as exc:
        raise RuntimeError(f"WeasyPrint not available: {exc}") from exc

    html_string = build_contract_html(
        record["data"],
        signature_path=record.get("signaturePath"),
        asset_mode="file",
        contract_id=record.get("id"),
    )
    try:
        HTML(string=html_string, base_url=str(BASE_DIR)).write_pdf(str(pdf_path))
    except Exception as exc:
        raise RuntimeError(f"HTML PDF generation failed: {exc}") from exc
    return f"/generated/{pdf_filename}"


def save_contract_files(data):
    contract_id = str(uuid4())
    timestamp = datetime.now(timezone.utc).astimezone(MONGOLIA_TZ).strftime("%Y%m%d%H%M%S")
    filename_stem = slugify(f"contract-{data['contractSerial']}-{timestamp}-{contract_id[:8]}")
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
        "invoiceViewPath": None,
        "invoicePath": None,
        "invoiceMeta": {"payments": {}, "bankAccountKey": "state"},
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


def save_manager_signature_image(data_url, user_id):
    if not data_url or "base64," not in data_url:
        return None
    header, encoded = data_url.split("base64,", 1)
    if "image/png" not in header:
        return None
    try:
        raw = base64.b64decode(encoded)
    except Exception:
        return None
    filename = f"manager-signature-{user_id}-{uuid4().hex[:8]}.png"
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
        font-family: "Times New Roman", Tinos, "Liberation Serif", serif;
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
        font-family: "Times New Roman", Tinos, "Liberation Serif", serif;
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
        font-family: "Times New Roman", Tinos, "Liberation Serif", serif;
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


def build_flight_reservation(payload, actor=None):
    return {
        "id": str(uuid4()),
        "createdAt": now_mongolia().isoformat(),
        "tripId": normalize_text(payload.get("tripId")),
        "tripName": normalize_text(payload.get("tripName")),
        "reservationName": normalize_text(payload.get("reservationName")) or normalize_text(payload.get("tripName")),
        "flightScope": normalize_text(payload.get("flightScope")).lower() or "domestic",
        "routeType": normalize_text(payload.get("routeType")).lower() or "internal",
        "airline": normalize_text(payload.get("airline")),
        "flightNumber": normalize_text(payload.get("flightNumber")),
        "guideName": normalize_text(payload.get("guideName")),
        "guideTicket": normalize_text(payload.get("guideTicket")),
        "guideStatus": normalize_text(payload.get("guideStatus")).lower() or "to_check",
        "fromCity": normalize_text(payload.get("fromCity")),
        "toCity": normalize_text(payload.get("toCity")),
        "departureDate": normalize_text(payload.get("departureDate")),
        "departureTime": normalize_text(payload.get("departureTime")),
        "arrivalDate": normalize_text(payload.get("arrivalDate")),
        "arrivalTime": normalize_text(payload.get("arrivalTime")),
        "bookingReference": normalize_text(payload.get("bookingReference")),
        "ticketNumber": normalize_text(payload.get("ticketNumber")),
        "passengerCount": parse_int(payload.get("passengerCount")),
        "status": normalize_text(payload.get("status")).lower() or "to_check",
        "boughtDate": normalize_text(payload.get("boughtDate")),
        "paymentStatus": normalize_text(payload.get("paymentStatus")).lower() or "unpaid",
        "amount": parse_int(payload.get("amount")),
        "currency": "MNT",
        "notes": normalize_text(payload.get("notes")),
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_flight_reservation(data):
    required = ["tripId", "tripName", "fromCity", "toCity", "departureDate", "status", "paymentStatus"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    if data.get("passengerCount", 0) <= 0:
        return "Passenger count must be greater than 0"
    if not parse_date_input(data.get("departureDate")):
        return "Departure date must be in YYYY-MM-DD format"
    arrival_date = normalize_text(data.get("arrivalDate"))
    if arrival_date and not parse_date_input(arrival_date):
        return "Arrival date must be in YYYY-MM-DD format"
    return None


def build_transfer_reservation(payload, actor=None):
    return {
        "id": str(uuid4()),
        "createdAt": now_mongolia().isoformat(),
        "tripId": normalize_text(payload.get("tripId")),
        "tripName": normalize_text(payload.get("tripName")),
        "reservationName": normalize_text(payload.get("reservationName")) or normalize_text(payload.get("tripName")),
        "transferType": normalize_text(payload.get("transferType")).lower() or "airport_hotel",
        "pickupLocation": normalize_text(payload.get("pickupLocation")),
        "dropoffLocation": normalize_text(payload.get("dropoffLocation")),
        "serviceDate": normalize_text(payload.get("serviceDate")),
        "serviceTime": normalize_text(payload.get("serviceTime")),
        "supplierName": normalize_text(payload.get("supplierName")),
        "driverName": normalize_text(payload.get("driverName")),
        "vehicleType": normalize_text(payload.get("vehicleType")),
        "passengerCount": parse_int(payload.get("passengerCount")),
        "status": normalize_text(payload.get("status")).lower() or "pending",
        "paymentStatus": normalize_text(payload.get("paymentStatus")).lower() or "unpaid",
        "driverSalary": parse_int(payload.get("driverSalary") or payload.get("amount")),
        "currency": "MNT",
        "notes": normalize_text(payload.get("notes")),
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_transfer_reservation(data):
    required = ["tripId", "tripName", "transferType", "pickupLocation", "dropoffLocation", "serviceDate", "paymentStatus"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    if data.get("passengerCount", 0) <= 0:
        return "Passenger count must be greater than 0"
    if not parse_date_input(data.get("serviceDate")):
        return "Service date must be in YYYY-MM-DD format"
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


def build_manager_summary(store):
    today = today_mongolia()
    tasks = store.get("tasks", [])
    reminders = store.get("reminders", [])
    contacts = store.get("contacts", [])
    return {
        "tasks": {
            "total": len(tasks),
            "open": len([item for item in tasks if item.get("status") != "done"]),
            "done": len([item for item in tasks if item.get("status") == "done"]),
            "highPriority": len([item for item in tasks if item.get("priority") == "high"]),
        },
        "reminders": {
            "total": len(reminders),
            "active": len([item for item in reminders if item.get("status") != "done"]),
            "today": len([item for item in reminders if str(item.get("reminderDate") or "")[:10] == today and item.get("status") != "done"]),
            "overdue": len(
                [
                    item
                    for item in reminders
                    if item.get("status") != "done"
                    and normalize_text(item.get("reminderDate"))[:10]
                    and normalize_text(item.get("reminderDate"))[:10] < today
                ]
            ),
        },
        "contacts": {
            "total": len(contacts),
            "priority": len([item for item in contacts if item.get("status") == "priority"]),
            "clients": len([item for item in contacts if item.get("type") == "client"]),
            "partners": len([item for item in contacts if item.get("type") == "partner"]),
        },
    }


def handle_get_manager_dashboard(start_response):
    store = read_manager_dashboard()
    return json_response(
        start_response,
        "200 OK",
        {
            **store,
            "summary": build_manager_summary(store),
        },
    )


def build_manager_task(payload):
    return {
        "id": str(uuid4()),
        "title": normalize_text(payload.get("title")),
        "owner": normalize_text(payload.get("owner")),
        "priority": normalize_text(payload.get("priority")).lower() or "medium",
        "status": normalize_text(payload.get("status")).lower() or "todo",
        "dueDate": normalize_text(payload.get("dueDate")),
        "note": normalize_text(payload.get("note")),
        "createdAt": now_mongolia().isoformat(),
        "updatedAt": now_mongolia().isoformat(),
    }


def validate_manager_task(task):
    if len(task.get("title", "")) < 2:
        return "Task title must be at least 2 characters"
    if task.get("priority") not in {"low", "medium", "high"}:
        return "Task priority is invalid"
    if task.get("status") not in {"todo", "in-progress", "done"}:
        return "Task status is invalid"
    if task.get("dueDate") and not parse_date_input(task.get("dueDate")):
        return "Task due date must be in YYYY-MM-DD format"
    return None


def build_manager_reminder(payload):
    return {
        "id": str(uuid4()),
        "title": normalize_text(payload.get("title")),
        "reminderDate": normalize_text(payload.get("reminderDate")),
        "status": normalize_text(payload.get("status")).lower() or "active",
        "audience": normalize_text(payload.get("audience")).lower() or "team",
        "note": normalize_text(payload.get("note")),
        "createdAt": now_mongolia().isoformat(),
        "updatedAt": now_mongolia().isoformat(),
    }


def validate_manager_reminder(reminder):
    if len(reminder.get("title", "")) < 2:
        return "Reminder title must be at least 2 characters"
    if reminder.get("status") not in {"active", "done"}:
        return "Reminder status is invalid"
    if reminder.get("audience") not in {"team", "client", "internal"}:
        return "Reminder audience is invalid"
    reminder_date = normalize_text(reminder.get("reminderDate"))
    if reminder_date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?", reminder_date):
        return "Reminder date must be YYYY-MM-DD or YYYY-MM-DDTHH:MM"
    return None


def build_manager_contact(payload):
    return {
        "id": str(uuid4()),
        "name": normalize_text(payload.get("name")),
        "phone": normalize_text(payload.get("phone")),
        "company": normalize_text(payload.get("company")),
        "type": normalize_text(payload.get("type")).lower() or "client",
        "status": normalize_text(payload.get("status")).lower() or "new",
        "lastContacted": normalize_text(payload.get("lastContacted")),
        "note": normalize_text(payload.get("note")),
        "createdAt": now_mongolia().isoformat(),
        "updatedAt": now_mongolia().isoformat(),
    }


def validate_manager_contact(contact):
    if len(contact.get("name", "")) < 2:
        return "Contact name must be at least 2 characters"
    if len(contact.get("phone", "")) < 5:
        return "Phone number must be at least 5 characters"
    if contact.get("type") not in {"client", "staff", "partner", "vendor"}:
        return "Contact type is invalid"
    if contact.get("status") not in {"new", "warm", "priority", "inactive"}:
        return "Contact status is invalid"
    if contact.get("lastContacted") and not parse_date_input(contact.get("lastContacted")):
        return "Last contacted date must be in YYYY-MM-DD format"
    return None


def fifa_active_sales(sales):
    return [sale for sale in sales if normalize_text(sale.get("saleStatus")).lower() != "cancelled"]


def fifa_ticket_sales(sales, ticket_id, excluded_sale_id=None):
    return [
        sale
        for sale in fifa_active_sales(sales)
        if sale.get("id") != excluded_sale_id
        and (
            sale.get("ticketId") == ticket_id
            or ticket_id in (sale.get("ticketIds") or [])
        )
    ]


def fifa_sale_quantity_for_ticket(sale, ticket_id):
    ticket_ids = [normalize_text(value) for value in (sale.get("ticketIds") or []) if normalize_text(value)]
    primary_ticket_id = normalize_text(sale.get("ticketId"))
    if ticket_ids:
        return 1 if ticket_id in ticket_ids else 0
    if primary_ticket_id == ticket_id:
        return max(parse_int(sale.get("quantity")), 0)
    return 0


def fifa_ticket_available_quantity(ticket, sales, excluded_sale_id=None):
    sold_quantity = sum(
        fifa_sale_quantity_for_ticket(sale, ticket.get("id"))
        for sale in fifa_ticket_sales(sales, ticket.get("id"), excluded_sale_id)
    )
    return max(parse_int(ticket.get("totalQuantity")) - sold_quantity, 0)


def find_fifa_ticket(store, ticket_id):
    for ticket in store.get("tickets", []):
        if ticket.get("id") == ticket_id:
            return ticket
    return None


def enrich_fifa_ticket(ticket, sales):
    sold_quantity = sum(
        fifa_sale_quantity_for_ticket(sale, ticket.get("id"))
        for sale in fifa_ticket_sales(sales, ticket.get("id"))
    )
    total_quantity = max(parse_int(ticket.get("totalQuantity")), 0)
    available_quantity = max(total_quantity - sold_quantity, 0)
    public_visible = (
        normalize_text(ticket.get("visibility")).lower() == "public"
        and normalize_text(ticket.get("status")).lower() == "active"
        and available_quantity > 0
    )
    return {
        **ticket,
        "totalQuantity": total_quantity,
        "soldQuantity": sold_quantity,
        "availableQuantity": available_quantity,
        "publicVisible": public_visible,
        "soldOut": available_quantity <= 0,
    }


def enrich_fifa_sale(sale, ticket, store=None):
    ticket_ids = sale.get("ticketIds") or ([sale.get("ticketId")] if sale.get("ticketId") else [])
    linked_tickets = [find_fifa_ticket(store or {"tickets": []}, ticket_id) for ticket_id in ticket_ids]
    linked_tickets = [item for item in linked_tickets if item]
    quantity = max(parse_int(sale.get("quantity")) or len(ticket_ids), 0)
    price_per_ticket = max(parse_int(sale.get("pricePerTicket")), 0)
    discount_amount = max(parse_int(sale.get("discountAmount")), 0)
    block_total_price = sum(max(parse_int(block.get("totalPrice")), 0) for block in (sale.get("ticketBlocks") or []))
    total_price = max(parse_int(sale.get("totalPrice")) or max(block_total_price - discount_amount, 0) or (quantity * price_per_ticket), 0)
    amount_paid = max(parse_int(sale.get("amountPaid")), 0)
    invoice_exchange_rate = max(parse_int(sale.get("invoiceExchangeRate")) or 3600, 1)
    buyer_name = normalize_text(sale.get("buyerName"))
    sold_by = sale.get("soldBy") or {}
    sold_by_email = normalize_text(sold_by.get("email")).lower()
    sold_by_user = find_user_by_email(sold_by_email) if sold_by_email else None
    sold_by_name = (
        normalize_text(sold_by.get("fullName"))
        or normalize_text(sold_by_user.get("fullName") if sold_by_user else "")
        or normalize_text(sold_by_user.get("name") if sold_by_user else "")
        or sold_by_email
    )
    ticket_labels = [
        f"{normalize_text(item.get('matchNumber'))} · {normalize_text(item.get('matchLabel'))}".strip(" ·")
        for item in linked_tickets
        if normalize_text(item.get("matchNumber")) or normalize_text(item.get("matchLabel"))
    ]
    cities = [normalize_text(item.get("city")) for item in linked_tickets if normalize_text(item.get("city"))]
    stages = [normalize_text(item.get("stage")) for item in linked_tickets if normalize_text(item.get("stage"))]
    seat_details = [normalize_text(item.get("seatDetails")) for item in linked_tickets if normalize_text(item.get("seatDetails"))]
    return {
        **sale,
        "ticketIds": ticket_ids,
        "quantity": quantity,
        "pricePerTicket": price_per_ticket,
        "discountAmount": discount_amount,
        "invoiceExchangeRate": invoice_exchange_rate,
        "invoiceBankAccount": normalize_text(sale.get("invoiceBankAccount")) or "state",
        "invoiceDescriptions": sale.get("invoiceDescriptions") or [],
        "invoiceSchedule": sale.get("invoiceSchedule") or [],
        "totalPrice": total_price,
        "amountPaid": amount_paid,
        "balanceDue": max(total_price - amount_paid, 0),
        "isPaid": amount_paid >= total_price and total_price > 0,
        "buyerName": buyer_name,
        "buyerEmail": normalize_text(sale.get("buyerEmail")).lower(),
        "ticket": enrich_fifa_ticket(ticket, []) if ticket else None,
        "ticketLabel": normalize_text(sale.get("buyerTitle")) or ", ".join(dict.fromkeys(ticket_labels)),
        "city": ", ".join(dict.fromkeys(cities)),
        "stage": ", ".join(dict.fromkeys(stages)),
        "seatDetails": " | ".join(seat_details),
        "buyerTitle": normalize_text(sale.get("buyerTitle")),
        "ticketBlocks": sale.get("ticketBlocks") or [],
        "participants": sale.get("participants") or [],
        "soldByName": sold_by_name,
    }


def build_fifa_summary(store):
    tickets = store.get("tickets", [])
    sales = store.get("sales", [])
    enriched_tickets = [enrich_fifa_ticket(ticket, sales) for ticket in tickets]
    active_sales = fifa_active_sales(sales)
    enriched_sales = [enrich_fifa_sale(sale, find_fifa_ticket(store, sale.get("ticketId")), store) for sale in sales]
    public_tickets = [ticket for ticket in enriched_tickets if ticket.get("publicVisible")]
    paid_sales = [sale for sale in active_sales if normalize_text(sale.get("paymentStatus")).lower() == "paid"]
    unpaid_sales = [sale for sale in active_sales if normalize_text(sale.get("paymentStatus")).lower() == "unpaid"]
    partial_sales = [sale for sale in active_sales if normalize_text(sale.get("paymentStatus")).lower() == "partial"]
    return {
        "tickets": {
            "total": len(tickets),
            "matches": len({normalize_text(ticket.get("matchNumber")) or normalize_text(ticket.get("matchLabel")) for ticket in tickets}),
            "public": len([ticket for ticket in tickets if normalize_text(ticket.get("visibility")).lower() == "public"]),
            "availableLots": len([ticket for ticket in enriched_tickets if ticket.get("availableQuantity", 0) > 0]),
            "soldOutLots": len([ticket for ticket in enriched_tickets if ticket.get("availableQuantity", 0) <= 0]),
            "availableUnits": sum(ticket.get("availableQuantity", 0) for ticket in enriched_tickets),
            "soldUnits": sum(ticket.get("soldQuantity", 0) for ticket in enriched_tickets),
        },
        "sales": {
            "total": len(sales),
            "active": len(active_sales),
            "cancelled": len([sale for sale in sales if normalize_text(sale.get("saleStatus")).lower() == "cancelled"]),
            "paid": len(paid_sales),
            "partial": len(partial_sales),
            "unpaid": len(unpaid_sales),
            "revenue": sum(max(parse_int(sale.get("totalPrice")), 0) for sale in active_sales),
            "collected": sum(max(parse_int(sale.get("amountPaid")), 0) for sale in active_sales),
        },
        "public": {
            "visibleLots": len(public_tickets),
            "visibleUnits": sum(ticket.get("availableQuantity", 0) for ticket in public_tickets),
        },
        "filters": {
            "stages": sorted({normalize_text(ticket.get("stage")) for ticket in tickets if normalize_text(ticket.get("stage"))}),
            "cities": sorted({normalize_text(ticket.get("city")) for ticket in tickets if normalize_text(ticket.get("city"))}),
            "categories": sorted({normalize_text(ticket.get("categoryCode")) for ticket in tickets if normalize_text(ticket.get("categoryCode"))}),
            "matches": sorted({
                f"{normalize_text(ticket.get('matchNumber'))} · {normalize_text(ticket.get('matchLabel'))}".strip(" ·")
                for ticket in tickets
                if normalize_text(ticket.get("matchNumber")) or normalize_text(ticket.get("matchLabel"))
            }),
            "soldBy": sorted({sale.get("soldByName") for sale in enriched_sales if sale.get("soldByName")}),
        },
    }


def build_fifa_ticket(payload):
    timestamp = now_mongolia().isoformat()
    return {
        "id": str(uuid4()),
        "stage": normalize_text(payload.get("stage")),
        "groupLabel": normalize_text(payload.get("groupLabel")),
        "matchNumber": normalize_text(payload.get("matchNumber")),
        "matchLabel": normalize_text(payload.get("matchLabel")),
        "matchDate": normalize_text(payload.get("matchDate")),
        "teamA": normalize_text(payload.get("teamA")),
        "teamB": normalize_text(payload.get("teamB")),
        "city": normalize_text(payload.get("city")),
        "venue": normalize_text(payload.get("venue")),
        "categoryCode": normalize_text(payload.get("categoryCode")) or "1",
        "categoryName": normalize_text(payload.get("categoryName")),
        "seatSection": normalize_text(payload.get("seatSection")),
        "seatDetails": normalize_text(payload.get("seatDetails")),
        "seatAssignedLater": bool(payload.get("seatAssignedLater")),
        "price": max(parse_int(payload.get("price")), 0),
        "currency": normalize_text(payload.get("currency")) or "USD",
        "totalQuantity": max(parse_int(payload.get("totalQuantity")) or 1, 1),
        "visibility": normalize_text(payload.get("visibility")).lower() or "public",
        "status": normalize_text(payload.get("status")).lower() or "active",
        "notes": normalize_text(payload.get("notes")),
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }


def validate_fifa_ticket(ticket):
    if len(ticket.get("matchLabel", "")) < 2:
        return "Match label must be at least 2 characters"
    if not ticket.get("matchDate") or not parse_date_input(ticket.get("matchDate")):
        return "Match date must be in YYYY-MM-DD format"
    if len(ticket.get("city", "")) < 2:
        return "City is required"
    if ticket.get("price", 0) <= 0:
        return "Price must be greater than 0"
    if ticket.get("totalQuantity", 0) <= 0:
        return "Quantity must be greater than 0"
    if ticket.get("categoryCode") not in {"1", "2", "3"}:
        return "Category must be 1, 2, or 3"
    if ticket.get("visibility") not in {"public", "private"}:
        return "Visibility must be public or private"
    if ticket.get("status") not in {"active", "hidden", "archived"}:
        return "Status must be active, hidden, or archived"
    return None


def build_fifa_sale(payload, actor=None):
    ticket_ids = [normalize_text(value) for value in (payload.get("ticketIds") or []) if normalize_text(value)]
    if not ticket_ids and normalize_text(payload.get("ticketId")):
        ticket_ids = [normalize_text(payload.get("ticketId"))]
    ticket_blocks = payload.get("ticketBlocks") if isinstance(payload.get("ticketBlocks"), list) else []
    participants = payload.get("participants") if isinstance(payload.get("participants"), list) else []
    quantity = max(parse_int(payload.get("quantity")) or len(ticket_ids) or 1, 1)
    normalized_blocks = []
    for block in ticket_blocks:
        if not isinstance(block, dict):
            continue
        normalized_block = {
            "matchNumber": normalize_text(block.get("matchNumber")),
            "matchLabel": normalize_text(block.get("matchLabel")),
            "categoryCode": normalize_text(block.get("categoryCode")),
            "quantity": max(parse_int(block.get("quantity")), 0),
            "unitPrice": max(parse_int(block.get("unitPrice")), 0),
            "totalPrice": max(parse_int(block.get("totalPrice")), 0),
            "seatPreview": normalize_text(block.get("seatPreview")),
            "ticketLabels": [normalize_text(item) for item in (block.get("ticketLabels") or []) if normalize_text(item)],
            "ticketIds": [normalize_text(item) for item in (block.get("ticketIds") or []) if normalize_text(item)],
        }
        if normalized_block["quantity"] <= 0 and normalized_block["ticketIds"]:
            normalized_block["quantity"] = len(normalized_block["ticketIds"])
        if normalized_block["totalPrice"] <= 0 and normalized_block["quantity"] > 0 and normalized_block["unitPrice"] > 0:
            normalized_block["totalPrice"] = normalized_block["quantity"] * normalized_block["unitPrice"]
        normalized_blocks.append(normalized_block)
    ticket_blocks = normalized_blocks
    block_total_price = sum(max(parse_int(block.get("totalPrice")), 0) for block in ticket_blocks)
    unique_unit_prices = {max(parse_int(block.get("unitPrice")), 0) for block in ticket_blocks if max(parse_int(block.get("unitPrice")), 0) > 0}
    price_per_ticket = max(parse_int(payload.get("pricePerTicket")), 0)
    if not price_per_ticket and len(unique_unit_prices) == 1:
        price_per_ticket = next(iter(unique_unit_prices))
    discount_amount = max(parse_int(payload.get("discountAmount")), 0)
    invoice_exchange_rate = max(parse_int(payload.get("invoiceExchangeRate")) or 3600, 1)
    invoice_bank_account = normalize_text(payload.get("invoiceBankAccount")) or "state"
    invoice_schedule = []
    invoice_descriptions = [normalize_text(item) for item in (payload.get("invoiceDescriptions") or []) if normalize_text(item)]
    for row in payload.get("invoiceSchedule") or []:
        if not isinstance(row, dict):
            continue
        invoice_schedule.append(
            {
                "title": normalize_text(row.get("title")),
                "created": normalize_text(row.get("created")),
                "due": normalize_text(row.get("due")),
                "status": normalize_text(row.get("status")).lower() or "waiting",
                "amount": max(parse_int(row.get("amount")), 0),
            }
        )
    total_price = max(parse_int(payload.get("totalPrice")) or max(block_total_price - discount_amount, 0) or (quantity * price_per_ticket), 0)
    amount_paid = max(parse_int(payload.get("amountPaid")), 0)
    payment_status = normalize_text(payload.get("paymentStatus")).lower()
    if not payment_status:
        if total_price and amount_paid >= total_price:
            payment_status = "paid"
        elif amount_paid > 0:
            payment_status = "partial"
        else:
            payment_status = "unpaid"
    timestamp = now_mongolia().isoformat()
    return {
        "id": str(uuid4()),
        "ticketId": ticket_ids[0] if ticket_ids else "",
        "ticketIds": ticket_ids,
        "ticketBlocks": ticket_blocks,
        "participants": participants,
        "quantity": quantity,
        "buyerTitle": normalize_text(payload.get("buyerTitle")),
        "buyerName": normalize_text(payload.get("buyerName")),
        "buyerPhone": normalize_text(payload.get("buyerPhone")),
        "buyerEmail": normalize_text(payload.get("buyerEmail")).lower(),
        "buyerPassportNumber": normalize_text(payload.get("buyerPassportNumber")),
        "buyerNationality": normalize_text(payload.get("buyerNationality")),
        "buyerNotes": normalize_text(payload.get("buyerNotes")),
        "pricePerTicket": price_per_ticket,
        "discountAmount": discount_amount,
        "invoiceExchangeRate": invoice_exchange_rate,
        "invoiceBankAccount": invoice_bank_account,
        "invoiceDescriptions": invoice_descriptions,
        "invoiceSchedule": invoice_schedule,
        "totalPrice": total_price,
        "amountPaid": amount_paid,
        "paymentStatus": payment_status,
        "paymentMethod": normalize_text(payload.get("paymentMethod")),
        "saleStatus": normalize_text(payload.get("saleStatus")).lower() or "active",
        "soldAt": normalize_text(payload.get("soldAt")) or timestamp,
        "soldBy": actor_snapshot(actor),
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }


def validate_fifa_sale(sale, ticket, sales, store, excluded_sale_id=None):
    ticket_ids = sale.get("ticketIds") or ([sale.get("ticketId")] if sale.get("ticketId") else [])
    if not ticket_ids:
        return "Choose at least one ticket"
    linked_tickets = [find_fifa_ticket(store, ticket_id) for ticket_id in ticket_ids]
    if any(not item for item in linked_tickets):
        return "One or more tickets were not found"
    if any(item.get("status") == "archived" for item in linked_tickets if item):
        return "Archived tickets cannot be sold"
    if len(sale.get("buyerName", "")) < 2:
        return "Buyer name must be at least 2 characters"
    if sale.get("quantity", 0) != len(ticket_ids):
        return "Selected ticket count and quantity must match"
    ticket_blocks = sale.get("ticketBlocks") or []
    if not ticket_blocks and sale.get("pricePerTicket", 0) <= 0:
        return "Sale price must be greater than 0"
    if ticket_blocks:
        if any(max(parse_int(block.get("unitPrice")), 0) <= 0 for block in ticket_blocks):
            return "Each match block must have a valid price per ticket"
        if any(max(parse_int(block.get("totalPrice")), 0) <= 0 for block in ticket_blocks):
            return "Each match block must have a valid total price"
        if sum(max(parse_int(block.get("totalPrice")), 0) for block in ticket_blocks) <= 0:
            return "Total price must be greater than 0"
    if sale.get("paymentStatus") not in {"unpaid", "partial", "paid", "refunded"}:
        return "Payment status is invalid"
    if sale.get("saleStatus") not in {"active", "cancelled"}:
        return "Sale status is invalid"
    if sale.get("invoiceBankAccount") not in {"state", "golomt"}:
        return "Invoice bank account is invalid"
    for row in sale.get("invoiceSchedule") or []:
        if normalize_text(row.get("status")).lower() not in {"paid", "waiting", "overdue"}:
            return "Invoice schedule status is invalid"
    if sale.get("buyerEmail") and "@" not in sale.get("buyerEmail", ""):
        return "Buyer email must be valid"
    if sale.get("soldAt") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?", sale.get("soldAt")) and not parse_date_input(sale.get("soldAt")[:10]):
        return "Sold at must be a valid date or date-time"
    if len(sale.get("participants") or []) < sale.get("quantity", 0):
        return "Add all participants for this buyer"
    if sale.get("saleStatus") != "cancelled":
        for linked_ticket in linked_tickets:
            available_quantity = fifa_ticket_available_quantity(linked_ticket, sales, excluded_sale_id)
            if available_quantity < 1:
                return f"Ticket {linked_ticket.get('seatDetails') or linked_ticket.get('id')} is no longer available"
    return None


def handle_get_fifa2026_dashboard(start_response):
    store = ensure_fifa2026_manual_inventory()
    sales = store.get("sales", [])
    tickets = [enrich_fifa_ticket(ticket, sales) for ticket in store.get("tickets", [])]
    enriched_sales = [enrich_fifa_sale(sale, find_fifa_ticket(store, sale.get("ticketId")), store) for sale in sales]
    return json_response(
        start_response,
        "200 OK",
        {
            "tickets": tickets,
            "sales": enriched_sales,
            "summary": build_fifa_summary(store),
        },
    )


def handle_get_fifa2026_public(start_response):
    store = ensure_fifa2026_manual_inventory()
    sales = store.get("sales", [])
    tickets = []
    for ticket in store.get("tickets", []):
        enriched = enrich_fifa_ticket(ticket, sales)
        is_public_schedule_item = normalize_text(ticket.get("visibility")).lower() == "public"
        is_placeholder = max(parse_int(ticket.get("totalQuantity")), 0) == 0
        if normalize_text(ticket.get("status")).lower() == "archived":
            continue
        if is_public_schedule_item or is_placeholder:
            tickets.append(enriched)
    return json_response(
        start_response,
        "200 OK",
        {
            "tickets": tickets,
            "summary": {
                **build_fifa_summary(store).get("public", {}),
                "matchCount": len(
                    {
                        normalize_text(ticket.get("matchNumber")) or normalize_text(ticket.get("matchLabel"))
                        for ticket in tickets
                        if normalize_text(ticket.get("matchNumber")) or normalize_text(ticket.get("matchLabel"))
                    }
                ),
            },
        },
    )


def handle_reset_fifa2026_from_seed(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    store = reset_fifa2026_store_from_seed()
    sales = store.get("sales", [])
    tickets = [enrich_fifa_ticket(ticket, sales) for ticket in store.get("tickets", [])]
    return json_response(
        start_response,
        "200 OK",
        {
            "ok": True,
            "tickets": tickets,
            "sales": [],
            "summary": build_fifa_summary(store),
        },
    )


def handle_create_fifa_ticket(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    ticket = build_fifa_ticket(payload)
    error = validate_fifa_ticket(ticket)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    store = read_fifa2026_store()
    store["tickets"].insert(0, ticket)
    write_fifa2026_store(store)
    return json_response(start_response, "201 Created", {"ok": True, "ticket": ticket, "summary": build_fifa_summary(store)})


def handle_update_fifa_ticket(environ, start_response, ticket_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    store = read_fifa2026_store()
    for index, item in enumerate(store.get("tickets", [])):
        if item.get("id") != ticket_id:
            continue
        updated = build_fifa_ticket({**item, **payload})
        updated["id"] = ticket_id
        updated["createdAt"] = item.get("createdAt") or updated.get("createdAt")
        updated["updatedAt"] = now_mongolia().isoformat()
        error = validate_fifa_ticket(updated)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        active_sales_quantity = sum(
            fifa_sale_quantity_for_ticket(sale, ticket_id)
            for sale in fifa_ticket_sales(store.get("sales", []), ticket_id)
        )
        if updated.get("totalQuantity", 0) < active_sales_quantity:
            return json_response(
                start_response,
                "400 Bad Request",
                {"error": f"Quantity cannot be less than already sold units ({active_sales_quantity})"},
            )
        store["tickets"][index] = updated
        write_fifa2026_store(store)
        return json_response(start_response, "200 OK", {"ok": True, "ticket": updated, "summary": build_fifa_summary(store)})
    return json_response(start_response, "404 Not Found", {"error": "Ticket not found"})


def handle_delete_fifa_ticket(environ, start_response, ticket_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    store = read_fifa2026_store()
    if fifa_ticket_sales(store.get("sales", []), ticket_id):
        return json_response(start_response, "400 Bad Request", {"error": "Cancel active sales before deleting this ticket lot"})
    before = len(store.get("tickets", []))
    store["tickets"] = [ticket for ticket in store.get("tickets", []) if ticket.get("id") != ticket_id]
    if len(store["tickets"]) == before:
        return json_response(start_response, "404 Not Found", {"error": "Ticket not found"})
    write_fifa2026_store(store)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": ticket_id, "summary": build_fifa_summary(store)})


def handle_create_fifa_sale(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    store = read_fifa2026_store()
    sale = build_fifa_sale(payload, actor)
    ticket = find_fifa_ticket(store, sale.get("ticketId"))
    error = validate_fifa_sale(sale, ticket, store.get("sales", []), store)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    store["sales"].insert(0, sale)
    write_fifa2026_store(store)
    return json_response(start_response, "201 Created", {"ok": True, "sale": enrich_fifa_sale(sale, ticket, store), "summary": build_fifa_summary(store)})


def handle_update_fifa_sale(environ, start_response, sale_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    store = read_fifa2026_store()
    for index, item in enumerate(store.get("sales", [])):
        if item.get("id") != sale_id:
            continue
        merged_payload = {**item, **payload}
        sale = build_fifa_sale(merged_payload, actor)
        sale["id"] = sale_id
        sale["createdAt"] = item.get("createdAt") or sale.get("createdAt")
        sale["soldBy"] = item.get("soldBy") or actor_snapshot(actor)
        sale["soldAt"] = normalize_text(payload.get("soldAt")) or item.get("soldAt") or sale.get("soldAt")
        sale["updatedAt"] = now_mongolia().isoformat()
        ticket = find_fifa_ticket(store, sale.get("ticketId"))
        error = validate_fifa_sale(sale, ticket, store.get("sales", []), store, excluded_sale_id=sale_id)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        store["sales"][index] = sale
        write_fifa2026_store(store)
        return json_response(start_response, "200 OK", {"ok": True, "sale": enrich_fifa_sale(sale, ticket, store), "summary": build_fifa_summary(store)})
    return json_response(start_response, "404 Not Found", {"error": "Sale not found"})


def handle_delete_fifa_sale(environ, start_response, sale_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    store = read_fifa2026_store()
    before = len(store.get("sales", []))
    store["sales"] = [sale for sale in store.get("sales", []) if sale.get("id") != sale_id]
    if len(store["sales"]) == before:
        return json_response(start_response, "404 Not Found", {"error": "Sale not found"})
    write_fifa2026_store(store)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": sale_id, "summary": build_fifa_summary(store)})


def update_manager_item(records, item_id, payload, builder, validator):
    for index, item in enumerate(records):
        if item.get("id") != item_id:
            continue
        merged = builder({**item, **payload})
        merged["id"] = item.get("id") or item_id
        merged["createdAt"] = item.get("createdAt") or now_mongolia().isoformat()
        merged["updatedAt"] = now_mongolia().isoformat()
        error = validator(merged)
        if error:
            return None, error
        records[index] = merged
        return merged, None
    return None, "Record not found"


def handle_manager_item_create(environ, start_response, key, builder, validator, response_label):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    record = builder(payload)
    error = validator(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    store = read_manager_dashboard()
    store[key].insert(0, record)
    write_manager_dashboard(store)
    return json_response(
        start_response,
        "201 Created",
        {
            "ok": True,
            response_label: record,
            "summary": build_manager_summary(store),
        },
    )


def handle_manager_item_update(environ, start_response, key, item_id, builder, validator, response_label):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    store = read_manager_dashboard()
    record, error = update_manager_item(store[key], item_id, payload, builder, validator)
    if error == "Record not found":
        return json_response(start_response, "404 Not Found", {"error": error})
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    write_manager_dashboard(store)
    return json_response(
        start_response,
        "200 OK",
        {
            "ok": True,
            response_label: record,
            "summary": build_manager_summary(store),
        },
    )


def handle_manager_item_delete(environ, start_response, key, item_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    store = read_manager_dashboard()
    before = len(store[key])
    store[key] = [item for item in store[key] if item.get("id") != item_id]
    if len(store[key]) == before:
        return json_response(start_response, "404 Not Found", {"error": "Record not found"})
    write_manager_dashboard(store)
    return json_response(
        start_response,
        "200 OK",
        {
            "ok": True,
            "deletedId": item_id,
            "summary": build_manager_summary(store),
        },
    )


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


def handle_list_flight_reservations(start_response):
    return json_response(start_response, "200 OK", {"entries": read_flight_reservations()})


def handle_list_transfer_reservations(start_response):
    return json_response(start_response, "200 OK", {"entries": read_transfer_reservations()})


def handle_list_camp_trips(start_response):
    trips = read_camp_trips()
    return json_response(start_response, "200 OK", {"entries": trips})


def handle_list_camp_settings(start_response):
    return json_response(start_response, "200 OK", {"entry": read_camp_settings()})


def handle_update_camp_settings(environ, start_response):
    user = require_login(environ, start_response)
    if not user:
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
    flight_reservations = [record for record in read_flight_reservations() if record.get("tripId") != trip_id]
    transfer_reservations = [record for record in read_transfer_reservations() if record.get("tripId") != trip_id]
    write_camp_trips(trips)
    write_camp_reservations(reservations)
    write_flight_reservations(flight_reservations)
    write_transfer_reservations(transfer_reservations)
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


def handle_create_flight_reservation(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_flight_reservation(payload, actor)
    trip = find_camp_trip(record["tripId"])
    if trip is None:
        return json_response(start_response, "400 Bad Request", {"error": "Please create or select a trip first"})
    record["tripName"] = trip["tripName"]
    record["reservationName"] = record.get("reservationName") or trip.get("reservationName") or trip["tripName"]
    error = validate_flight_reservation(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    records = read_flight_reservations()
    records.insert(0, record)
    write_flight_reservations(records)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


def handle_create_transfer_reservation(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_transfer_reservation(payload, actor)
    trip = find_camp_trip(record["tripId"])
    if trip is None:
        return json_response(start_response, "400 Bad Request", {"error": "Please create or select a trip first"})
    record["tripName"] = trip["tripName"]
    record["reservationName"] = record.get("reservationName") or trip.get("reservationName") or trip["tripName"]
    error = validate_transfer_reservation(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    records = read_transfer_reservations()
    records.insert(0, record)
    write_transfer_reservations(records)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


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


def handle_update_flight_reservation(environ, start_response, reservation_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    records = read_flight_reservations()
    for index, record in enumerate(records):
        if record["id"] != reservation_id:
            continue
        merged = {**record}
        for key in [
            "tripId",
            "tripName",
            "reservationName",
            "flightScope",
            "routeType",
            "airline",
            "flightNumber",
            "guideName",
            "guideTicket",
            "guideStatus",
            "fromCity",
            "toCity",
            "departureDate",
            "departureTime",
            "arrivalDate",
            "arrivalTime",
            "bookingReference",
            "ticketNumber",
            "status",
            "boughtDate",
            "paymentStatus",
            "currency",
            "notes",
        ]:
            if key in payload:
                value = normalize_text(payload.get(key))
                merged[key] = value.upper() if key == "currency" else value
        for key in ["passengerCount", "amount"]:
            if key in payload:
                merged[key] = parse_int(payload.get(key))
        merged["currency"] = "MNT"
        if normalize_text(merged.get("tripId")):
            trip = find_camp_trip(merged.get("tripId"))
            if trip is None:
                return json_response(start_response, "400 Bad Request", {"error": "Selected trip was not found"})
            merged["tripName"] = trip["tripName"]
            if not normalize_text(merged.get("reservationName")):
                merged["reservationName"] = trip.get("reservationName") or trip["tripName"]
        error = validate_flight_reservation(merged)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        merged["updatedAt"] = now_mongolia().isoformat()
        merged["updatedBy"] = actor_snapshot(actor)
        records[index] = merged
        write_flight_reservations(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged})
    return json_response(start_response, "404 Not Found", {"error": "Flight reservation not found"})


def handle_update_transfer_reservation(environ, start_response, reservation_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    records = read_transfer_reservations()
    for index, record in enumerate(records):
        if record["id"] != reservation_id:
            continue
        merged = {**record}
        for key in [
            "tripId",
            "tripName",
            "reservationName",
            "transferType",
            "pickupLocation",
            "dropoffLocation",
            "serviceDate",
            "serviceTime",
            "driverName",
            "vehicleType",
            "paymentStatus",
            "currency",
            "notes",
        ]:
            if key in payload:
                value = normalize_text(payload.get(key))
                merged[key] = value.upper() if key == "currency" else value
        for key in ["passengerCount", "amount", "driverSalary"]:
            if key in payload:
                target_key = "driverSalary" if key in {"amount", "driverSalary"} else key
                merged[target_key] = parse_int(payload.get(key))
        merged["currency"] = "MNT"
        if normalize_text(merged.get("tripId")):
            trip = find_camp_trip(merged.get("tripId"))
            if trip is None:
                return json_response(start_response, "400 Bad Request", {"error": "Selected trip was not found"})
            merged["tripName"] = trip["tripName"]
            if not normalize_text(merged.get("reservationName")):
                merged["reservationName"] = trip.get("reservationName") or trip["tripName"]
        error = validate_transfer_reservation(merged)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        merged["updatedAt"] = now_mongolia().isoformat()
        merged["updatedBy"] = actor_snapshot(actor)
        records[index] = merged
        write_transfer_reservations(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged})
    return json_response(start_response, "404 Not Found", {"error": "Transfer reservation not found"})


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


def handle_delete_flight_reservation(environ, start_response, reservation_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    records = read_flight_reservations()
    if not any(record["id"] == reservation_id for record in records):
        return json_response(start_response, "404 Not Found", {"error": "Flight reservation not found"})
    records = [record for record in records if record["id"] != reservation_id]
    write_flight_reservations(records)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": reservation_id})


def handle_delete_transfer_reservation(environ, start_response, reservation_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    records = read_transfer_reservations()
    if not any(record["id"] == reservation_id for record in records):
        return json_response(start_response, "404 Not Found", {"error": "Transfer reservation not found"})
    records = [record for record in records if record["id"] != reservation_id]
    write_transfer_reservations(records)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": reservation_id})


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
        contracts = read_contracts()
        record["createdBy"] = actor_snapshot(actor)
        record["updatedBy"] = actor_snapshot(actor)
        contracts.insert(0, record)
        write_contracts(contracts)
        return json_response(start_response, "201 Created", {"ok": True, "contract": record})
    except FileNotFoundError as exc:
        return json_response(start_response, "500 Internal Server Error", {"error": str(exc)})
    except Exception as exc:
        return json_response(start_response, "500 Internal Server Error", {"error": f"Could not generate contract: {exc}"})


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
            if contract.get("status") == "signed":
                return json_response(start_response, "400 Bad Request", {"error": "Signed contracts cannot be edited"})
            data = build_contract_data(payload)
            error = validate_contract_data(data)
            if error:
                return json_response(start_response, "400 Bad Request", {"error": error})
            contract["data"] = data
            contract["updatedBy"] = actor_snapshot(actor)
            contract["updatedAt"] = datetime.now(timezone.utc).isoformat()
            docx_path = contract.get("docxPath")
            if docx_path:
                safe_docx = (GENERATED_DIR / unquote(docx_path.replace("/generated/", "", 1))).resolve()
                if str(safe_docx).startswith(str(GENERATED_DIR.resolve())):
                    try:
                        generate_docx(data, safe_docx)
                    except Exception:
                        pass
            view_path = contract.get("pdfViewPath")
            if view_path:
                safe_view = (GENERATED_DIR / unquote(view_path.replace("/generated/", "", 1))).resolve()
                if str(safe_view).startswith(str(GENERATED_DIR.resolve())):
                    try:
                        safe_view.write_text(
                            build_contract_html(
                                data,
                                signature_path=contract.get("signaturePath"),
                                contract_id=contract.get("id"),
                            ),
                            encoding="utf-8",
                        )
                    except Exception:
                        pass
            contract["pdfPath"] = None
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
    client_phone = normalize_text(payload.get("clientPhone"))
    emergency_name = normalize_text(payload.get("emergencyContactName"))
    emergency_phone = normalize_text(payload.get("emergencyContactPhone"))
    emergency_relation = normalize_text(payload.get("emergencyContactRelation"))
    accepted = bool(payload.get("accepted"))
    if not accepted:
        return json_response(start_response, "400 Bad Request", {"error": "Agreement not accepted"})
    if not client_phone or not emergency_name or not emergency_phone or not emergency_relation:
        return json_response(start_response, "400 Bad Request", {"error": "Missing client contact information"})

    contracts = read_contracts()
    for idx, contract in enumerate(contracts):
        if contract.get("id") == contract_id:
            signature_path = save_signature_image(signature_data, contract_id)
            if not signature_path:
                return json_response(start_response, "400 Bad Request", {"error": "Invalid signature"})
            data = contract.get("data") or {}
            data["clientPhone"] = client_phone
            data["emergencyContactName"] = emergency_name
            data["emergencyContactPhone"] = emergency_phone
            data["emergencyContactRelation"] = emergency_relation
            contract["data"] = data
            contract["signaturePath"] = signature_path
            contract["signerName"] = signer_name or contract.get("signerName")
            contract["accepted"] = accepted
            contract["status"] = "signed"
            contract["signedAt"] = datetime.now(timezone.utc).isoformat()
            try:
                contract["pdfPath"] = save_contract_pdf(contract)
            except Exception as exc:
                return json_response(
                    start_response,
                    "500 Internal Server Error",
                    {"error": f"Could not generate signed PDF: {exc}"},
                )
            view_path = contract.get("pdfViewPath")
            if view_path:
                safe_view = (GENERATED_DIR / unquote(view_path.replace("/generated/", "", 1))).resolve()
                if str(safe_view).startswith(str(GENERATED_DIR.resolve())):
                    try:
                        safe_view.write_text(
                            build_contract_html(
                                data,
                                signature_path=contract.get("signaturePath"),
                                contract_id=contract.get("id"),
                            ),
                            encoding="utf-8",
                        )
                    except Exception:
                        pass
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
        if contract.get("status") == "signed":
            try:
                pdf_path = save_contract_pdf(contract)
            except Exception as exc:
                return json_response(
                    start_response,
                    "500 Internal Server Error",
                    {"error": f"Could not generate contract PDF: {exc}"},
                )
            contract["pdfPath"] = pdf_path
            if contract_index is not None:
                contracts[contract_index] = contract
                write_contracts(contracts)
        if not str(pdf_path or "").endswith(".pdf"):
            return json_response(start_response, "409 Conflict", {"error": "PDF not ready"})
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
    safe_path.write_text(
        build_contract_html(
            contract.get("data") or {},
            signature_path=contract.get("signaturePath"),
            contract_id=contract.get("id"),
        ),
        encoding="utf-8",
    )
    if contract_index is not None:
        contracts[contract_index] = contract
        write_contracts(contracts)
    return file_response(start_response, safe_path)


def handle_contract_invoice_document(environ, start_response, contract_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
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
        try:
            invoice_path = save_invoice_pdf(contract)
        except Exception as exc:
            return json_response(
                start_response,
                "500 Internal Server Error",
                {"error": f"Could not generate invoice PDF: {exc}"},
            )
        contract["invoicePath"] = invoice_path
        if contract_index is not None:
            contracts[contract_index] = contract
            write_contracts(contracts)
        safe_path = (GENERATED_DIR / unquote(invoice_path.replace("/generated/", "", 1))).resolve()
        if not str(safe_path).startswith(str(GENERATED_DIR.resolve())) or not safe_path.exists():
            return json_response(start_response, "404 Not Found", {"error": "Invoice not found"})
        return file_response(start_response, safe_path, extra_headers=generated_download_headers(safe_path))

    view_path = contract.get("invoiceViewPath")
    if not view_path:
        view_path = f"/generated/invoice-{contract_id}.html"
        contract["invoiceViewPath"] = view_path
    safe_path = (GENERATED_DIR / unquote(view_path.replace("/generated/", "", 1))).resolve()
    if not str(safe_path).startswith(str(GENERATED_DIR.resolve())):
        return json_response(start_response, "404 Not Found", {"error": "Invoice not found"})
    safe_path.write_text(build_invoice_html(contract), encoding="utf-8")
    if contract_index is not None:
        contracts[contract_index] = contract
        write_contracts(contracts)
    return file_response(start_response, safe_path)


def handle_update_contract_invoice(environ, start_response, contract_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    contracts = read_contracts()
    for idx, contract in enumerate(contracts):
        if contract.get("id") != contract_id:
            continue
        payments_payload = payload.get("payments")
        items_payload = payload.get("items")
        if not isinstance(payments_payload, list):
            return json_response(start_response, "400 Bad Request", {"error": "Payments payload is invalid"})
        if not isinstance(items_payload, list):
            return json_response(start_response, "400 Bad Request", {"error": "Items payload is invalid"})

        invoice_meta = contract.get("invoiceMeta") if isinstance(contract.get("invoiceMeta"), dict) else {}
        stored_payments = invoice_meta.get("payments") if isinstance(invoice_meta.get("payments"), dict) else {}
        invoice_meta["bankAccountKey"] = normalize_invoice_bank_account(
            payload.get("bankAccountKey"),
            fallback=normalize_invoice_bank_account(invoice_meta.get("bankAccountKey")),
        )

        normalized_items = []
        for item in items_payload:
            if not isinstance(item, dict):
                continue
            description = normalize_text(item.get("description"))
            quantity = parse_int(item.get("quantity"))
            unit_price = parse_int(item.get("unitPrice"))
            total_price = parse_int(item.get("totalPrice")) or quantity * unit_price
            if not description or quantity <= 0:
                continue
            normalized_items.append(
                {
                    "key": normalize_text(item.get("key")) or f"item-{len(normalized_items) + 1}",
                    "description": description,
                    "quantity": quantity,
                    "unitPrice": unit_price,
                    "totalPrice": total_price,
                }
            )
        if not normalized_items:
            return json_response(start_response, "400 Bad Request", {"error": "At least one invoice item is required"})

        normalized_payment_rows = []
        for payment in payments_payload:
            if not isinstance(payment, dict):
                continue
            title = normalize_text(payment.get("title"))
            amount = parse_int(payment.get("amount"))
            if not title or amount <= 0:
                continue
            status_value = normalize_invoice_status(payment.get("status"))
            normalized_payment_rows.append(
                {
                    "key": normalize_text(payment.get("key")) or f"payment-{len(normalized_payment_rows) + 1}",
                    "title": title,
                    "created": normalize_text(payment.get("created")),
                    "secondaryLabel": normalize_text(payment.get("secondaryLabel")) or "Эцсийн хугацаа",
                    "secondaryValue": normalize_text(payment.get("secondaryValue")),
                    "status": status_value,
                    "amount": amount,
                }
            )
        if not normalized_payment_rows:
            return json_response(start_response, "400 Bad Request", {"error": "At least one payment row is required"})

        stored_payments["rows"] = normalized_payment_rows
        invoice_meta["payments"] = stored_payments
        invoice_meta["lineItems"] = normalized_items
        contract["invoiceMeta"] = invoice_meta
        contract["updatedBy"] = actor_snapshot(actor)
        contract["updatedAt"] = datetime.now(timezone.utc).isoformat()
        contracts[idx] = contract
        write_contracts(contracts)
        return json_response(start_response, "200 OK", {"ok": True, "contract": contract})

    return json_response(start_response, "404 Not Found", {"error": "Contract not found"})


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

    if path == "/api/team-members":
        if method == "GET":
            return handle_list_team_members(environ, start_response)
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

    if path == "/api/manager-dashboard":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_get_manager_dashboard(start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/manager-dashboard/tasks":
        if method == "POST":
            return handle_manager_item_create(environ, start_response, "tasks", build_manager_task, validate_manager_task, "task")
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/manager-dashboard/tasks/"):
        item_id = path.replace("/api/manager-dashboard/tasks/", "", 1).strip("/")
        if method == "POST" and item_id:
            return handle_manager_item_update(environ, start_response, "tasks", item_id, build_manager_task, validate_manager_task, "task")
        if method == "DELETE" and item_id:
            return handle_manager_item_delete(environ, start_response, "tasks", item_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/manager-dashboard/reminders":
        if method == "POST":
            return handle_manager_item_create(
                environ,
                start_response,
                "reminders",
                build_manager_reminder,
                validate_manager_reminder,
                "reminder",
            )
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/manager-dashboard/reminders/"):
        item_id = path.replace("/api/manager-dashboard/reminders/", "", 1).strip("/")
        if method == "POST" and item_id:
            return handle_manager_item_update(
                environ,
                start_response,
                "reminders",
                item_id,
                build_manager_reminder,
                validate_manager_reminder,
                "reminder",
            )
        if method == "DELETE" and item_id:
            return handle_manager_item_delete(environ, start_response, "reminders", item_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/manager-dashboard/contacts":
        if method == "POST":
            return handle_manager_item_create(
                environ,
                start_response,
                "contacts",
                build_manager_contact,
                validate_manager_contact,
                "contact",
            )
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/manager-dashboard/contacts/"):
        item_id = path.replace("/api/manager-dashboard/contacts/", "", 1).strip("/")
        if method == "POST" and item_id:
            return handle_manager_item_update(
                environ,
                start_response,
                "contacts",
                item_id,
                build_manager_contact,
                validate_manager_contact,
                "contact",
            )
        if method == "DELETE" and item_id:
            return handle_manager_item_delete(environ, start_response, "contacts", item_id)
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
        if tail.endswith("/invoice"):
            contract_id = tail.replace("/invoice", "", 1).strip("/")
            if method == "GET":
                return handle_contract_invoice_document(environ, start_response, contract_id)
            if method == "POST":
                return handle_update_contract_invoice(environ, start_response, contract_id)
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

    if path == "/api/flight-reservations":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_flight_reservations(start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_flight_reservation(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/transfer-reservations":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_transfer_reservations(start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_transfer_reservation(environ, start_response)
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

    if path == "/api/fifa2026":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_get_fifa2026_dashboard(start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/fifa2026/public":
        if method == "GET":
            return handle_get_fifa2026_public(start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/fifa2026/reset-from-seed":
        if method == "POST":
            return handle_reset_fifa2026_from_seed(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/fifa2026/tickets":
        if method == "POST":
            return handle_create_fifa_ticket(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/fifa2026/sales":
        if method == "POST":
            return handle_create_fifa_sale(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/fifa2026/tickets/"):
        ticket_id = path.replace("/api/fifa2026/tickets/", "", 1).strip("/")
        if method == "POST" and ticket_id:
            return handle_update_fifa_ticket(environ, start_response, ticket_id)
        if method == "DELETE" and ticket_id:
            return handle_delete_fifa_ticket(environ, start_response, ticket_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/fifa2026/sales/"):
        sale_id = path.replace("/api/fifa2026/sales/", "", 1).strip("/")
        if method == "POST" and sale_id:
            return handle_update_fifa_sale(environ, start_response, sale_id)
        if method == "DELETE" and sale_id:
            return handle_delete_fifa_sale(environ, start_response, sale_id)
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

    if path.startswith("/api/flight-reservations/"):
        reservation_id = path.replace("/api/flight-reservations/", "", 1).strip("/")
        if method == "POST" and reservation_id:
            if not require_login(environ, start_response):
                return []
            return handle_update_flight_reservation(environ, start_response, reservation_id)
        if method == "DELETE" and reservation_id:
            return handle_delete_flight_reservation(environ, start_response, reservation_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/transfer-reservations/"):
        reservation_id = path.replace("/api/transfer-reservations/", "", 1).strip("/")
        if method == "POST" and reservation_id:
            if not require_login(environ, start_response):
                return []
            return handle_update_transfer_reservation(environ, start_response, reservation_id)
        if method == "DELETE" and reservation_id:
            return handle_delete_transfer_reservation(environ, start_response, reservation_id)
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

    if path == "/fifa2026-admin":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "fifa2026-admin.html")

    if path == "/fifa2026":
        return file_response(start_response, PUBLIC_DIR / "fifa2026.html")

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
