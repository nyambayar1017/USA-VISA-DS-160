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
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, quote
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
TRIP_UPLOADS_DIR = DATA_DIR / "trip-uploads"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".gif", ".txt"}
CAMP_SETTINGS_FILE = DATA_DIR / "camp_settings.json"
FIFA2026_FILE = DATA_DIR / "fifa2026.json"
FIFA2026_RESET_MARKER_FILE = DATA_DIR / "fifa2026_manual_reset_v3.txt"
MANAGER_DASHBOARD_FILE = DATA_DIR / "manager_dashboard.json"
USERS_FILE = DATA_DIR / "users.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"
NOTIFICATIONS_FILE = DATA_DIR / "notifications.json"
NOTIFICATIONS_MAX = 200
GROUPS_FILE = DATA_DIR / "tourist_groups.json"
TOURISTS_FILE = DATA_DIR / "tourists.json"
INVOICES_FILE = DATA_DIR / "invoices.json"
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
    TRIP_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
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
        NOTIFICATIONS_FILE,
        GROUPS_FILE,
        TOURISTS_FILE,
        INVOICES_FILE,
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
        FLIGHT_RESERVATIONS_FILE,
        TRANSFER_RESERVATIONS_FILE,
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


def restore_json_from_latest_backup(filename, normalizer):
    ensure_data_store()
    for item in list_backup_archives():
        archive_path = BACKUP_DIR / item["filename"]
        if not archive_path.exists():
            continue
        try:
            with zipfile.ZipFile(archive_path, "r") as archive:
                if filename not in archive.namelist():
                    continue
                payload = json.loads(archive.read(filename).decode("utf-8"))
        except Exception:
            continue
        normalized = normalizer(payload)
        if normalized:
            return normalized
    return None


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
    records = read_json_list(DS160_FILE)
    normalized = [normalize_ds160_record(record) for record in records if isinstance(record, dict)]
    normalized.sort(
        key=lambda item: item.get("submittedAt") or item.get("updatedAt") or item.get("createdAt") or "",
        reverse=True,
    )
    return normalized


def write_ds160_applications(records):
    write_json_list(DS160_FILE, [normalize_ds160_record(record) for record in records if isinstance(record, dict)])


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
    records = read_json_list(CAMP_TRIPS_FILE)
    if any(not r.get("serial") for r in records):
        records = backfill_trip_serials(records)
        write_json_list(CAMP_TRIPS_FILE, records)
    return records


def write_camp_trips(records):
    write_json_list(CAMP_TRIPS_FILE, records)


def backfill_trip_serials(records):
    counters = {}
    sorted_records = sorted(
        records,
        key=lambda r: (
            r.get("createdAt") or "",
            r.get("startDate") or "",
            r.get("id") or "",
        ),
    )
    for record in sorted_records:
        if record.get("serial"):
            continue
        company = normalize_company(record.get("company"))
        counters.setdefault(company, 0)
        counters[company] += 1
        # Find a unique serial that doesn't collide with existing ones
        while True:
            candidate = f"T-{counters[company]:04d}"
            if not any(r.get("serial") == candidate for r in records):
                record["serial"] = candidate
                break
            counters[company] += 1
    return records


def next_trip_serial(company):
    company = normalize_company(company)
    prefix = "S-" if company == "USM" else "T-"
    existing = read_json_list(CAMP_TRIPS_FILE)
    max_seq = 0
    for record in existing:
        if normalize_company(record.get("company")) != company:
            continue
        serial = (record.get("serial") or "").upper()
        # Read either prefix when scanning so legacy USM trips (T-prefix)
        # don't collide with the new S- numbering.
        for known in ("T-", "S-"):
            if serial.startswith(known):
                try:
                    num = int(serial[len(known):])
                    if num > max_seq:
                        max_seq = num
                except ValueError:
                    pass
                break
    return f"{prefix}{max_seq + 1:04d}"


def read_tourist_groups():
    return read_json_list(GROUPS_FILE)


def write_tourist_groups(records):
    write_json_list(GROUPS_FILE, records)


def read_tourists():
    return read_json_list(TOURISTS_FILE)


def write_tourists(records):
    write_json_list(TOURISTS_FILE, records)


def read_invoices():
    try:
        if not INVOICES_FILE.exists():
            INVOICES_FILE.write_text("[]", encoding="utf-8")
        return json.loads(INVOICES_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def write_invoices(records):
    INVOICES_FILE.parent.mkdir(parents=True, exist_ok=True)
    INVOICES_FILE.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")


def next_invoice_serial(company=None):
    """Invoice serials are workspace-scoped: USM uses S-NNNNNN, DTX uses
    T-NNNNNN. Counters are shared across both prefixes (and legacy plain-digit
    serials) so we never clash with what's already in storage."""
    company = normalize_company(company) if company else ""
    prefix = "S-" if company == "USM" else ("T-" if company == "DTX" else "")
    existing = read_invoices()
    max_seq = 0
    for record in existing:
        s = str(record.get("serial") or "")
        core = s
        for known in ("S-", "T-"):
            if s.startswith(known):
                core = s[len(known):]
                break
        if core.isdigit():
            max_seq = max(max_seq, int(core))
    return f"{prefix}{(max_seq + 1):06d}"


def _trip_company_for_invoice(payload):
    """Resolve a trip's company from an invoice payload's tripId, falling back
    to whatever the payload already carried so legacy/manual rows aren't
    re-prefixed accidentally."""
    trip_id = (payload or {}).get("tripId")
    if not trip_id:
        return ""
    trip = find_camp_trip(trip_id)
    return normalize_company((trip or {}).get("company")) if trip else ""


def build_invoice(payload, actor=None):
    items = []
    for raw in payload.get("items") or []:
        desc = normalize_text(raw.get("description"))
        if not desc:
            continue
        try:
            qty = float(raw.get("qty") or 1)
        except Exception:
            qty = 1
        try:
            price = float(raw.get("price") or 0)
        except Exception:
            price = 0
        items.append({
            "description": desc,
            "qty": qty,
            "price": price,
            "total": round(qty * price, 2),
        })
    installments = []
    for raw in payload.get("installments") or []:
        desc = normalize_text(raw.get("description")) or "Installment"
        try:
            amount = float(raw.get("amount") or 0)
        except Exception:
            amount = 0
        installments.append({
            "description": desc,
            "amount": amount,
            "issueDate": normalize_text(raw.get("issueDate")),
            "dueDate": normalize_text(raw.get("dueDate")),
            "status": normalize_text(raw.get("status")) or "pending",
        })
    total = round(sum(i["total"] for i in items), 2)
    return {
        "id": str(uuid4()),
        "serial": next_invoice_serial(_trip_company_for_invoice(payload)),
        "tripId": normalize_text(payload.get("tripId")),
        "groupId": normalize_text(payload.get("groupId")),
        "payerId": normalize_text(payload.get("payerId")),
        "payerName": normalize_text(payload.get("payerName")),
        "participantIds": [normalize_text(x) for x in (payload.get("participantIds") or []) if x],
        "items": items,
        "total": total,
        "installments": installments,
        "currency": normalize_text(payload.get("currency")) or "MNT",
        "status": "draft",
        "createdAt": now_mongolia().isoformat(),
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_invoice(data):
    if not data.get("tripId"):
        return "tripId is required"
    if not data.get("groupId"):
        return "groupId is required"
    if not data.get("payerName") and not data.get("payerId"):
        return "Payer is required"
    if not data.get("items"):
        return "At least one item is required"
    return None


def next_group_serial(trip_serial, trip_id):
    if not trip_serial:
        return ""
    existing = read_tourist_groups()
    max_seq = 0
    prefix = f"{trip_serial}-G"
    for record in existing:
        if record.get("tripId") != trip_id:
            continue
        serial = record.get("serial") or ""
        if serial.startswith(prefix):
            try:
                num = int(serial[len(prefix):])
                if num > max_seq:
                    max_seq = num
            except ValueError:
                pass
    return f"{prefix}{max_seq + 1}"


def next_tourist_serial(group_serial, group_id):
    if not group_serial:
        return ""
    existing = read_tourists()
    max_seq = 0
    prefix = f"{group_serial}-"
    for record in existing:
        if record.get("groupId") != group_id:
            continue
        serial = record.get("serial") or ""
        if serial.startswith(prefix):
            try:
                num = int(serial[len(prefix):])
                if num > max_seq:
                    max_seq = num
            except ValueError:
                pass
    return f"{prefix}{max_seq + 1:02d}"


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
    current = read_fifa2026_store()
    if current.get("tickets") or current.get("sales"):
        return current
    restored = restore_json_from_latest_backup(
        FIFA2026_FILE.name,
        lambda payload: (
            normalized
            if (normalized := normalize_fifa2026_store(payload)) and (normalized.get("tickets") or normalized.get("sales"))
            else None
        ),
    )
    if restored:
        write_fifa2026_store(restored)
        return restored
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
    # Always revalidate HTML, JS, and CSS so cache-busting query strings
    # take effect immediately across browsers. Heavier static assets
    # (images, fonts, PDFs) are still browser-cacheable.
    if file_path.suffix.lower() in (".html", ".htm", ".js", ".css"):
        headers.append(("Cache-Control", "no-cache, no-store, must-revalidate"))
        headers.append(("Pragma", "no-cache"))
        headers.append(("Expires", "0"))
    if extra_headers:
        headers.extend(extra_headers)
    start_response("200 OK", headers)
    return [body]


def generated_download_headers(file_path):
    if file_path.suffix.lower() != ".pdf":
        return None
    return [("Content-Disposition", f'inline; filename="{file_path.name}"')]


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
    avatar_data = payload.get("avatarData")
    remove_avatar = bool(payload.get("removeAvatar"))
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
        if avatar_data:
            avatar_path = save_user_avatar_image(avatar_data, record["id"])
            if not avatar_path:
                return json_response(start_response, "400 Bad Request", {"error": "Invalid profile picture"})
            record["avatarPath"] = avatar_path
        elif remove_avatar:
            record["avatarPath"] = ""
        record["fullName"] = full_name
        record["contractLastName"] = contract_last_name
        record["contractFirstName"] = contract_first_name
        record["contractEmail"] = contract_email
        record["contractPhone"] = contract_phone
        write_users(users)
        return json_response(start_response, "200 OK", {"ok": True, "user": sanitize_user(record)})

    return json_response(start_response, "404 Not Found", {"error": "User not found"})


def handle_list_users(environ, start_response):
    admin = require_admin(environ, start_response)
    if not admin:
        return []
    users = [sanitize_user(user) for user in read_users()]
    return json_response(start_response, "200 OK", {"entries": users})


def handle_list_notifications(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    params = parse_qs(environ.get("QUERY_STRING", ""))
    try:
        limit = int(params.get("limit", ["50"])[0])
    except (TypeError, ValueError):
        limit = 50
    limit = max(1, min(limit, NOTIFICATIONS_MAX))
    since = normalize_text(params.get("since", [""])[0])
    entries = read_notifications()
    if since:
        filtered = [e for e in entries if e.get("createdAt", "") > since]
        entries = filtered if filtered else entries
    last_read_iso = ""
    users = read_users()
    for record in users:
        if record.get("id") == actor.get("id"):
            last_read_iso = record.get("notificationsLastReadAt", "")
            break
    unread = [e for e in entries if e.get("createdAt", "") > last_read_iso] if last_read_iso else list(entries)
    return json_response(
        start_response,
        "200 OK",
        {
            "entries": entries[:limit],
            "unread": len(unread),
            "lastReadAt": last_read_iso,
        },
    )


def handle_mark_notifications_read(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    users = read_users()
    now_iso = datetime.now(timezone.utc).isoformat()
    for record in users:
        if record.get("id") == actor.get("id"):
            record["notificationsLastReadAt"] = now_iso
            write_users(users)
            break
    return json_response(start_response, "200 OK", {"ok": True, "lastReadAt": now_iso})


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
                "avatarPath": normalize_text(user.get("avatarPath")),
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


def parse_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").strip().replace(",", "")
    text = re.sub(r"[^\d.\-]", "", text)
    if text.count(".") > 1:
        parts = text.split(".")
        text = parts[0] + "." + "".join(parts[1:])
    try:
        return float(text or "0")
    except ValueError:
        return 0.0


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


def read_notifications():
    try:
        return read_json_list(NOTIFICATIONS_FILE)
    except Exception:
        return []


def write_notifications(records):
    write_json_list(NOTIFICATIONS_FILE, records[:NOTIFICATIONS_MAX])


def log_notification(kind, actor, title, detail="", meta=None):
    try:
        entries = read_notifications()
    except Exception:
        entries = []
    actor_info = actor_snapshot(actor) if actor else {"id": "", "email": "system", "name": "System"}
    entry = {
        "id": uuid4().hex,
        "kind": kind,
        "title": title,
        "detail": detail or "",
        "actor": actor_info,
        "actorAvatar": (actor.get("avatarPath") if isinstance(actor, dict) else "") or "",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "meta": meta or {},
    }
    entries.insert(0, entry)
    write_notifications(entries)
    return entry


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


WORKSPACE_COOKIE = "activeWorkspace"
VALID_COMPANIES = {"DTX", "USM"}
DEFAULT_COMPANY = "USM"


def active_workspace(environ):
    cookies = parse_cookies(environ)
    value = (cookies.get(WORKSPACE_COOKIE) or "").strip().upper()
    return value if value in VALID_COMPANIES else ""


def normalize_company(value):
    v = (value or "").strip().upper()
    return v if v in VALID_COMPANIES else DEFAULT_COMPANY


def filter_by_company(records, environ):
    workspace = active_workspace(environ)
    if not workspace:
        return records
    return [r for r in records if normalize_company(r.get("company")) == workspace]


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
        "avatarPath": user.get("avatarPath", ""),
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
        parts.append(f"1 том хүний {data['adultPrice']} төгрөг")
    if child_count:
        parts.append(f"1 хүүхдийн {data['childPrice']} төгрөг")
    if infant_count:
        parts.append(f"1 нярай хүүхдийн {data['infantPrice']} төгрөг")
    if ticket_only_count:
        parts.append(f"1 зочин зөвхөн билеттэй {data['ticketOnlyPrice']} төгрөг")
    if land_only_count:
        parts.append(f"1 зочин газрын үйлчилгээтэй {data['landOnlyPrice']} төгрөг")
    if custom_count:
        parts.append(f"1 зочин {data['customPriceLabel']} {data['customPrice']} төгрөг")
    price_breakdown = ", ".join(part for part in parts if part)
    data["priceBreakdown"] = price_breakdown or ""
    data["paymentParagraph"] = (
        f"Энэхүү гэрээгээр аялагчийн төлбөр нь {price_breakdown}, нийт {data['travelerCount']} хүний {data['totalPrice']} төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно."
        if price_breakdown
        else f"Энэхүү гэрээгээр аялагчийн төлбөр нь нийт {data['travelerCount']} хүний {data['totalPrice']} төгрөг байхаар харилцан тохиролцож гэрээ байгуулав. Аялал зохион байгуулагч нь НӨАТ төлөгч биш болно."
    )
    data["depositParagraph"] = (
        f"Аяллын төлбөр дараах байдлаар хийгдэнэ.\n5.3.1. Аяллын урьдчилгаа төлбөр болох {data['depositAmount']} төгрөгийг {format_balance_due_date(data['depositDueDate'])} өдөр “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN03 0034 3432 7777 9999 дансанд хийснээр аялал баталгаажна."
    )
    data["balanceParagraph"] = (
        f"5.3.2. Аяллын үлдэгдэл төлбөр болох {data['balanceAmount']} төгрөгийг {format_balance_due_date(data['balanceDueDate'])} өдөр “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN03 0034 3432 7777 9999 дансанд хийнэ."
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
            f"Аяллын төлбөр дараах байдлаар хийгдэнэ.\n5.3.1. Аяллын урьдчилгаа төлбөр болох {data['depositAmount']} төгрөгийг {format_due_date_ordinal(data['depositDueDate'])} дотор “Дэлхий Трэвел Икс” ХХК-ний Төрийн Банкны MN030034343277779999 дугаартай дансанд хийснээр аялал баталгаажна.",
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
                nested_subsection_match = re.match(
                    rf"^(?P<prefix>.*?)(?:\s+)?{re.escape(current_section)}\.(?P<outer>\d+)\.(?P<inner>\d+)\.\s*(?P<rest>.*)$",
                    text,
                )
                if nested_subsection_match:
                    prefix = nested_subsection_match.group("prefix").strip()
                    outer = nested_subsection_match.group("outer")
                    inner = nested_subsection_match.group("inner")
                    rest = nested_subsection_match.group("rest").strip()
                    subsection_index = max(subsection_index, int(outer))
                    if prefix:
                        blocks.append(
                            {
                                "type": "numbered-paragraph",
                                "number": f"{current_section}.{outer}.",
                                "text": prefix,
                            }
                        )
                    blocks.append(
                        {
                            "type": "numbered-paragraph",
                            "number": f"{current_section}.{outer}.{inner}.",
                            "text": rest,
                        }
                    )
                    continue
                inline_subsections = list(
                    re.finditer(
                        rf"({re.escape(current_section)}\.(\d+)\.\s*)(.*?)(?=(?:\s+{re.escape(current_section)}\.\d+\.)|$)",
                        text,
                    )
                )
                if inline_subsections:
                    lead_text = text[:inline_subsections[0].start()].strip()
                    if lead_text:
                        subsection_index += 1
                        blocks.append(
                            {
                                "type": "numbered-paragraph",
                                "number": f"{current_section}.{subsection_index}.",
                                "text": lead_text,
                            }
                        )
                    for match in inline_subsections:
                        subsection_index = max(subsection_index, int(match.group(2)))
                        blocks.append(
                            {
                                "type": "numbered-paragraph",
                                "number": f"{current_section}.{match.group(2)}.",
                                "text": match.group(3).strip(),
                            }
                        )
                    continue
                split_lines = [line.strip() for line in re.split(r"\n+", text) if line.strip()]
                explicit_subsections = [
                    line for line in split_lines[1:]
                    if re.match(rf"^{re.escape(current_section)}\.\d+\.\s*", line)
                ]
                if split_lines and explicit_subsections:
                    subsection_index += 1
                    blocks.append(
                        {
                            "type": "numbered-paragraph",
                            "number": f"{current_section}.{subsection_index}.",
                            "text": split_lines[0],
                        }
                    )
                    for line in split_lines[1:]:
                        match = re.match(rf"^{re.escape(current_section)}\.(\d+)\.\s*(.*)$", line)
                        if match:
                            subsection_index = max(subsection_index, int(match.group(1)))
                            blocks.append(
                                {
                                    "type": "numbered-paragraph",
                                    "number": f"{current_section}.{match.group(1)}.",
                                    "text": match.group(2).strip(),
                                }
                            )
                        else:
                            blocks.append({"type": "paragraph", "text": line})
                    continue
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
        highlighted = re.sub(
            r"(\d{1,3}(?:,\d{3})+(?:\s*төгрөг(?:ийг|ийн|өөр|өөс|төгрөг)?)?)",
            r"<strong>\1</strong>",
            escaped,
        )
        return highlighted.replace("\n", "<br />")

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
    _dl_title = quote(data.get("contractSerial", "") or (contract_id or ""), safe="")
    download_button = (
        f'<a href="/pdf-viewer?src={quote(download_href, safe="")}&title={_dl_title}" target="_blank" rel="noreferrer">PDF Татах</a>'
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

def strip_invoice_destination_prefix(text, destination):
    value = normalize_text(text)
    base = normalize_text(destination)
    if not value or not base:
        return value

    lowered = value.lower()
    base_lowered = base.lower()
    if lowered == base_lowered:
        return value

    removable_tail_keywords = (
        "урьдчилгаа төлбөр",
        "үлдэгдэл төлбөр",
        "том хүн",
        "хүүхэд",
        "нярай",
        "зөвхөн билет",
        "газрын үйлчилгээ",
    )
    for separator in (" / ", "/", " - ", "-", " "):
        prefix = f"{base_lowered}{separator}"
        if not lowered.startswith(prefix):
            continue
        stripped = value[len(base) + len(separator) :].strip(" /-")
        if stripped and any(keyword in stripped.lower() for keyword in removable_tail_keywords):
            return stripped
    return value


def normalize_invoice_line_items(record):
    destination = normalize_text((record.get("data") or {}).get("destination"))
    invoice_meta = record.get("invoiceMeta") if isinstance(record.get("invoiceMeta"), dict) else {}
    raw_items = invoice_meta.get("lineItems")
    normalized = []
    if isinstance(raw_items, list):
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            description = strip_invoice_destination_prefix(item.get("description"), destination)
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


def format_invoice_input_date(value):
    normalized = normalize_text(value).replace(".", "-")
    parsed = parse_date_safe(normalized)
    if parsed:
        return parsed.isoformat()
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", normalized)
    if match:
        return normalized
    return ""


def build_invoice_payment_rows(record):
    data = record.get("data") or {}
    created_at = record.get("createdAt")
    signed_at = record.get("signedAt")
    today = now_mongolia().date()
    issue_date = format_iso_date_display(data.get("contractDate") or created_at)
    signed_date = format_iso_date_display(signed_at or created_at or data.get("contractDate"))
    balance_due = parse_date_safe(data.get("balanceDueDate"))
    balance_amount = parse_int(data.get("balanceAmount"))
    invoice_meta = record.get("invoiceMeta") if isinstance(record.get("invoiceMeta"), dict) else {}
    payment_meta = invoice_meta.get("payments") if isinstance(invoice_meta.get("payments"), dict) else {}
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
                "title": "Урьдчилгаа",
                "created": issue_date,
                "secondaryLabel": "Төлсөн огноо" if deposit_status == "paid" else "Эцсийн хугацаа",
                "secondaryValue": signed_date if deposit_status == "paid" else format_iso_date_display(data.get("depositDueDate")),
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
                "title": "Аяллын үлдэгдэл",
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
    bank_options_markup = "".join(
        f'<option value="{account_key}"{" selected" if account_key == bank_account_key else ""}>{html.escape(account["bankName"])} / {html.escape(account["prefix"])} / {html.escape(account["accountNumber"])}</option>'
        for account_key, account in INVOICE_BANK_ACCOUNTS.items()
    )

    def status_options_for(current_key):
        current = normalize_invoice_status(current_key)
        return "".join(
            f'<option value="{status_key}"{" selected" if status_key == current else ""}>{html.escape(status_meta["label"])}</option>'
            for status_key, status_meta in INVOICE_STATUS_META.items()
        )

    def asset_src(filename):
        if asset_mode == "file":
            return (PUBLIC_DIR / "assets" / filename).resolve().as_uri()
        return f"/assets/{filename}"

    download_href = "" if asset_mode == "file" else f"/api/contracts/{record.get('id')}/invoice?mode=download"
    _inv_raw_number = f"{normalize_text(data.get('contractSerial')) or record.get('id', '')}-1"
    _inv_viewer_href = f"/pdf-viewer?src={quote(download_href, safe='')}&title={quote(_inv_raw_number, safe='')}" if download_href else ""
    toolbar_markup = ""
    script_markup = ""
    notice_markup = ""
    if asset_mode != "file":
        toolbar_markup = f"""
    <div class="toolbar">
      <button type="button" class="toolbar-button is-active" data-invoice-mode="view">View</button>
      <button type="button" class="toolbar-button" data-invoice-mode="edit">Edit</button>
      <button type="button" class="toolbar-button toolbar-save" data-save-invoice hidden>Save</button>
      <a href="{html.escape(_inv_viewer_href)}" target="_blank" rel="noreferrer">PDF Татах</a>
    </div>"""
        notice_markup = '<div class="save-notice" data-save-notice hidden>Saved successfully</div>'
        script_markup = f"""
    <script>
      (() => {{
        const statusMeta = {json.dumps(INVOICE_STATUS_META, ensure_ascii=False)};
        const bankAccountMeta = {json.dumps(INVOICE_BANK_ACCOUNTS, ensure_ascii=False)};
        const modeButtons = Array.from(document.querySelectorAll("[data-invoice-mode]"));
        const saveButton = document.querySelector("[data-save-invoice]");
        const itemRowsBody = document.querySelector("[data-invoice-items-body]");
        const paymentStack = document.querySelector("[data-payment-stack]");
        const bankSelect = document.querySelector("[data-bank-account-select]");
        const bankName = document.querySelector("[data-bank-name]");
        const bankPrefix = document.querySelector("[data-bank-prefix]");
        const bankNumber = document.querySelector("[data-bank-number]");
        const notice = document.querySelector("[data-save-notice]");
        const setMode = (mode) => {{
          document.body.classList.toggle("is-editing", mode === "edit");
          modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.invoiceMode === mode));
          if (saveButton) saveButton.hidden = mode !== "edit";
        }};
        const formatMoney = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0)) + " ₮";
        const syncItems = () => {{
          let total = 0;
          Array.from(itemRowsBody?.querySelectorAll("tr[data-item-key]") || []).forEach((row, index) => {{
            const descriptionInput = row.querySelector('[data-item-field="description"]');
            const quantityInput = row.querySelector('[data-item-field="quantity"]');
            const unitInput = row.querySelector('[data-item-field="unitPrice"]');
            const totalInput = row.querySelector('[data-item-field="totalPrice"]');
            const quantity = Number(quantityInput?.value || 0);
            const unitPrice = Number(unitInput?.value || 0);
            const lineTotal = quantity * unitPrice;
            if (totalInput) totalInput.value = String(lineTotal);
            total += lineTotal;
            row.querySelector("[data-item-index]").textContent = index + 1;
            row.querySelector('[data-view-field="description"]').textContent = descriptionInput?.value || "";
            row.querySelector('[data-view-field="quantity"]').textContent = quantity || 0;
            row.querySelector('[data-view-field="unitPrice"]').textContent = formatMoney(unitPrice);
            row.querySelector('[data-view-field="totalPrice"]').textContent = formatMoney(lineTotal);
          }});
          const totalCell = document.querySelector("[data-invoice-total]");
          if (totalCell) totalCell.textContent = formatMoney(total);
        }};
        const syncPayments = () => {{
          Array.from(paymentStack?.querySelectorAll("[data-payment-key]") || []).forEach((card) => {{
            const titleInput = card.querySelector('[data-payment-field="title"]');
            const createdInput = card.querySelector('[data-payment-field="created"]');
            const secondaryLabelInput = card.querySelector('[data-payment-field="secondaryLabel"]');
            const secondaryValueInput = card.querySelector('[data-payment-field="secondaryValue"]');
            const amountInput = card.querySelector('[data-payment-field="amount"]');
            const select = card.querySelector("[data-status-select]");
            const badge = card.querySelector("[data-status-badge]");
            const meta = statusMeta[select?.value || "waiting"] || statusMeta.waiting;
            card.querySelector('[data-view-field="payment-title"]').textContent = titleInput?.value || "";
            card.querySelector('[data-view-field="created"]').textContent = createdInput?.value || "-";
            card.querySelector('[data-view-field="secondary-label"]').textContent = secondaryLabelInput?.value || "Эцсийн хугацаа";
            card.querySelector('[data-view-field="secondary-value"]').textContent = secondaryValueInput?.value || "-";
            card.querySelector('[data-view-field="amount"]').textContent = formatMoney(amountInput?.value || 0);
            if (badge) {{
              badge.textContent = meta.label;
              badge.className = "payment-status payment-status-view " + meta.className;
            }}
          }});
        }};
        const syncBank = () => {{
          if (!bankSelect) return;
          const meta = bankAccountMeta[bankSelect.value] || bankAccountMeta.state;
          if (bankName) bankName.textContent = meta.bankName;
          if (bankPrefix) bankPrefix.textContent = meta.prefix;
          if (bankNumber) bankNumber.textContent = meta.accountNumber;
        }};
        itemRowsBody?.addEventListener("input", syncItems);
        paymentStack?.addEventListener("input", syncPayments);
        paymentStack?.addEventListener("change", syncPayments);
        bankSelect?.addEventListener("change", syncBank);
        modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.invoiceMode || "view")));
        saveButton?.addEventListener("click", async () => {{
          saveButton.disabled = true;
          saveButton.textContent = "Saving...";
          try {{
            const items = Array.from(itemRowsBody?.querySelectorAll("tr[data-item-key]") || []).map((row) => ({{
              key: row.dataset.itemKey || "",
              description: row.querySelector('[data-item-field="description"]')?.value || "",
              quantity: Number(row.querySelector('[data-item-field="quantity"]')?.value || 0),
              unitPrice: Number(row.querySelector('[data-item-field="unitPrice"]')?.value || 0),
              totalPrice: Number(row.querySelector('[data-item-field="totalPrice"]')?.value || 0),
            }}));
            const payments = Array.from(paymentStack?.querySelectorAll("[data-payment-key]") || []).map((card) => ({{
              key: card.dataset.paymentKey || "",
              title: card.querySelector('[data-payment-field="title"]')?.value || "",
              created: card.querySelector('[data-payment-field="created"]')?.value || "",
              secondaryLabel: card.querySelector('[data-payment-field="secondaryLabel"]')?.value || "",
              secondaryValue: card.querySelector('[data-payment-field="secondaryValue"]')?.value || "",
              status: card.querySelector('[data-status-select]')?.value || "waiting",
              amount: Number(card.querySelector('[data-payment-field="amount"]')?.value || 0),
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
            if (!response.ok) throw new Error(payload.error || "Could not save invoice.");
            syncItems();
            syncPayments();
            syncBank();
            setMode("view");
            if (notice) {{
              notice.hidden = false;
              setTimeout(() => notice.hidden = true, 2200);
            }}
          }} catch (error) {{
            window.alert(error.message || "Could not save invoice.");
          }} finally {{
            saveButton.disabled = false;
            saveButton.textContent = "Save";
          }}
        }});
        syncItems();
        syncPayments();
        syncBank();
        setMode("view");
      }})();
    </script>"""

    items_markup = "".join(
        f"""
          <tr data-item-key="{html.escape(item['key'])}">
            <td data-item-index>{index}</td>
            <td>
              <span class="invoice-view-text" data-view-field="description">{html.escape(item['description'])}</span>
              <input class="invoice-edit-input" data-item-field="description" value="{html.escape(item['description'])}" />
            </td>
            <td>
              <span class="invoice-view-text" data-view-field="quantity">{item['quantity']}</span>
              <input class="invoice-edit-input" data-item-field="quantity" type="number" min="1" value="{item['quantity']}" />
            </td>
            <td>
              <span class="invoice-view-text" data-view-field="unitPrice">{format_money(item['unitPrice'])} ₮</span>
              <input class="invoice-edit-input" data-item-field="unitPrice" type="number" min="0" value="{item['unitPrice']}" />
            </td>
            <td>
              <span class="invoice-view-text" data-view-field="totalPrice">{format_money(item['totalPrice'])} ₮</span>
              <input class="invoice-edit-input" data-item-field="totalPrice" type="number" min="0" value="{item['totalPrice']}" readonly />
            </td>
          </tr>
        """
        for index, item in enumerate(items, start=1)
    )

    payment_markup = "".join(
        f"""
          <div class="payment-card" data-payment-key="{html.escape(row['key'])}">
            <div class="payment-main">
              <span class="invoice-view-text" data-view-field="payment-title">{html.escape(row['title'])}</span>
              <input class="invoice-edit-input" data-payment-field="title" value="{html.escape(row['title'])}" />
            </div>
            <div class="payment-meta">
              <span class="meta-label">Нэхэмжилсэн огноо</span>
              <span class="meta-value invoice-view-text" data-view-field="created">{html.escape(row['created'])}</span>
              <input class="invoice-edit-input" data-payment-field="created" type="date" value="{html.escape(format_invoice_input_date(row['created']))}" />
            </div>
            <div class="payment-meta">
              <span class="meta-label invoice-view-text" data-view-field="secondary-label">{html.escape(row['secondaryLabel'])}</span>
              <input class="invoice-edit-input" data-payment-field="secondaryLabel" value="{html.escape(row['secondaryLabel'])}" />
              <span class="meta-value invoice-view-text" data-view-field="secondary-value">{html.escape(row['secondaryValue'])}</span>
              <input class="invoice-edit-input" data-payment-field="secondaryValue" type="date" value="{html.escape(format_invoice_input_date(row['secondaryValue']))}" />
            </div>
            <div class="payment-meta">
              <span class="meta-label">Төлөв</span>
              <span class="payment-status payment-status-view {row['statusClass']}" data-status-badge>{html.escape(row['status'])}</span>
              <select class="payment-status-select" data-status-select>{status_options_for(row['statusKey'])}</select>
            </div>
            <div class="payment-amount">
              <span class="invoice-view-text" data-view-field="amount">{format_money(row['amount'])} ₮</span>
              <input class="invoice-edit-input" data-payment-field="amount" type="number" min="0" value="{row['amount']}" />
            </div>
          </div>
        """
        for row in payment_rows
    )
    invoice_font_stack = '"Nunito", Arial, sans-serif'
    invoice_font_faces = f"""
      @font-face {{
        font-family: "Nunito";
        src: url("{asset_src('fonts/nunito-variable.ttf')}") format("truetype");
        font-weight: 200 1000;
        font-style: normal;
      }}"""

    return f"""<!DOCTYPE html>
<html lang="mn">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Нэхэмжлэх</title>
    <link rel="icon" type="image/png" href="{asset_src('favicon-dtx-x.png')}" />
    <style>
{invoice_font_faces}
      @page {{
        size: 768px 1180px;
        margin: 0;
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        background: #ffffff;
        color: #27272a;
        font-family: {invoice_font_stack};
        font-size: 13px;
      }}
      .toolbar {{
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        justify-content: center;
        gap: 14px;
        padding: 18px 16px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #eef1f7;
        backdrop-filter: blur(10px);
      }}
      .toolbar a,
      .toolbar-button {{
        min-width: 86px;
        min-height: 46px;
        padding: 11px 18px;
        border: none;
        border-radius: 999px;
        background: #253776;
        color: #fff;
        text-decoration: none;
        font: 800 16px/1.2 {invoice_font_stack};
        cursor: pointer;
      }}
      .toolbar-button {{
        background: #e9eef8;
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
      .save-notice {{
        position: fixed;
        right: 18px;
        top: 18px;
        padding: 10px 14px;
        border-radius: 10px;
        background: #1f8550;
        color: #fff;
        font: 600 13px/1.2 {invoice_font_stack};
        z-index: 20;
      }}
      .page {{
        width: min(720px, calc(100vw - 48px));
        margin: 20px auto 40px;
        padding: 20px;
        background: #fff;
        border: 1px solid #dce3ef;
        border-radius: 14px;
        box-shadow: none;
      }}
      .invoice-number {{
        margin: 0 0 18px;
        color: #27272a;
        font-size: 18px;
        line-height: 1.15;
        font-weight: 500;
      }}
      .header-grid {{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        align-items: start;
        margin-bottom: 28px;
      }}
      .invoice-logo {{
        width: 154px;
        max-width: 100%;
        display: block;
        margin-bottom: 10px;
      }}
      .company-name {{
        margin: 0 0 12px;
        font-size: 14px;
        line-height: 1.25;
        font-weight: 700;
        color: #27272a;
      }}
      .company-block p,
      .customer-block p,
      .meta-note {{
        margin: 0;
        font-size: 13px;
        line-height: 1.38;
      }}
      .meta-note {{
        text-align: right;
        color: #27272a;
      }}
      .customer-block {{
        padding-top: 80px;
      }}
      .customer-block .label {{
        display: block;
        margin-bottom: 4px;
        color: #64748b;
        font-size: 13px;
        font-weight: 600;
      }}
      .section-title {{
        margin: 0 0 10px;
        color: #64748b;
        font-size: 13px;
        font-weight: 600;
      }}
      .invoice-items-table {{
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        border-radius: 12px;
        border: 1px solid #cfd8e6;
        overflow: hidden;
        margin-bottom: 28px;
      }}
      th, td {{
        padding: 10px 12px;
        border-bottom: 1px solid #cfd8e6;
        text-align: left;
        font-size: 13px;
        line-height: 1.25;
      }}
      th {{
        background: #fbfcfe;
        color: #27272a;
        font-weight: 700;
      }}
      th:first-child,
      td:first-child {{
        width: 46px;
      }}
      td:last-child,
      th:last-child,
      td:nth-last-child(2),
      th:nth-last-child(2) {{
        text-align: right;
      }}
      .total-row td {{
        font-weight: 700;
        background: #fff;
        border-bottom: 0;
      }}
      .payment-stack {{
        display: grid;
        gap: 16px;
        margin-bottom: 28px;
      }}
      .payment-card {{
        display: grid;
        grid-template-columns: 1.35fr 1.08fr 1.08fr 0.9fr 0.92fr;
        gap: 10px;
        align-items: center;
        min-height: 74px;
        padding: 16px 18px;
        border: 1px solid #cfd8e6;
        border-radius: 12px;
        background: #fff;
      }}
      .payment-main,
      .payment-amount {{
        min-width: 0;
        font-size: 13px;
        font-weight: 600;
        color: #27272a;
      }}
      .payment-amount {{
        text-align: right;
        white-space: nowrap;
      }}
      .payment-meta {{
        display: grid;
        gap: 4px;
        min-width: 0;
      }}
      .meta-value {{
        font-size: 13px;
        font-weight: 600;
        color: #27272a;
      }}
      .meta-label {{
        color: #64748b;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
      }}
      .payment-status {{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        min-width: 82px;
        min-height: 30px;
        padding: 5px 11px;
        border-radius: 999px;
        font-size: 12px;
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
        background: #fff5bd;
        color: #8a4b12;
      }}
      .invoice-edit-input,
      .payment-status-select,
      .bank-account-select {{
        display: none;
        width: 100%;
        min-width: 0;
        min-height: 38px;
        padding: 8px 10px;
        border: 1px solid #cbd6ee;
        border-radius: 10px;
        background: #fff;
        color: #1f2937;
        font: 600 13px/1.2 {invoice_font_stack};
      }}
      .invoice-edit-input[type="date"] {{
        min-width: 0;
      }}
      body.is-editing .invoice-edit-input,
      body.is-editing .payment-status-select,
      body.is-editing .bank-account-select {{
        display: block;
      }}
      body.is-editing .invoice-view-text,
      body.is-editing .payment-status-view,
      body.is-editing .bank-view {{
        display: none;
      }}
      body.is-editing .page {{
        width: min(1120px, calc(100vw - 48px));
      }}
      body.is-editing .payment-card {{
        grid-template-columns: minmax(210px, 1.25fr) minmax(150px, 0.9fr) minmax(150px, 0.9fr) minmax(150px, 0.9fr) minmax(170px, 1fr);
        align-items: end;
        gap: 12px;
      }}
      body.is-editing .payment-main {{
        grid-column: auto;
      }}
      body.is-editing .payment-meta,
      body.is-editing .payment-amount {{
        display: grid;
        gap: 6px;
        min-width: 0;
      }}
      body.is-editing .payment-amount {{
        text-align: right;
      }}
      .bank-section {{
        margin-top: 0;
        padding-bottom: 28px;
        border-bottom: 1px solid #d9e0ea;
      }}
      .bank-grid {{
        display: grid;
        gap: 4px;
        font-size: 13px;
        line-height: 1.35;
        color: #27272a;
      }}
      .bank-line {{
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        align-items: baseline;
      }}
      .bank-prefix {{
        color: #64748b;
      }}
      .bank-account-number {{
        font-weight: 800;
      }}
      .signature-grid {{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 28px;
        margin-top: 24px;
        align-items: start;
      }}
      .signature-card {{
        position: relative;
        min-height: 218px;
        padding-top: 0;
      }}
      .signature-label {{
        position: relative;
        z-index: 3;
        min-height: 18px;
        margin-bottom: 112px;
        color: #64748b;
        font-size: 13px;
        font-weight: 600;
        background: #fff;
      }}
      .signature-line {{
        border-bottom: 1px dashed #d5ddec;
      }}
      .accountant-stamp {{
        position: absolute;
        left: 2px;
        bottom: 36px;
        width: 218px;
        z-index: 1;
        opacity: 0.98;
      }}
      .accountant-signature {{
        position: absolute;
        left: 64px;
        bottom: -34px;
        width: 290px;
        z-index: 2;
      }}
      .signature-name {{
        position: relative;
        z-index: 4;
        margin-top: 14px;
        font-size: 13px;
        font-weight: 700;
        color: #27272a;
      }}
      .signature-role {{
        position: relative;
        z-index: 4;
        color: #27272a;
        font-size: 13px;
      }}
      @media print {{
        .toolbar, .save-notice {{
          display: none;
        }}
      }}
      @media (max-width: 980px) {{
        body {{
          font-size: 16px;
        }}
        .toolbar {{
          gap: 10px;
          padding: 14px 10px;
          flex-wrap: wrap;
        }}
        .toolbar a,
        .toolbar-button {{
          min-width: 82px;
          min-height: 46px;
          padding: 10px 16px;
          font-size: 16px;
        }}
        .page {{
          width: calc(100vw - 24px);
          margin: 12px auto 24px;
          padding: 22px;
        }}
        .header-grid,
        .signature-grid {{
          grid-template-columns: 1fr;
        }}
        .invoice-number {{
          font-size: 24px;
        }}
        .invoice-logo {{
          width: 220px;
        }}
        .customer-block {{
          padding-top: 0;
        }}
        .company-block p,
        .customer-block p,
        .meta-note,
        .section-title,
        th,
        td,
        .payment-main,
        .payment-amount,
        .meta-value,
        .meta-label,
        .bank-grid,
        .signature-label,
        .signature-name,
        .signature-role {{
          font-size: 16px;
        }}
        .meta-note {{
          text-align: left;
        }}
        .invoice-items-table {{
          display: block;
          overflow-x: auto;
        }}
        .payment-card {{
          grid-template-columns: 1fr;
          min-height: auto;
          padding: 18px;
        }}
        body.is-editing .payment-card {{
          grid-template-columns: 1fr;
        }}
        .payment-amount {{
          text-align: left;
        }}
        body.is-editing .payment-amount {{
          text-align: left;
        }}
      }}
    </style>
  </head>
  <body>
    {toolbar_markup}
    {notice_markup}
    <div class="page">
      <p class="invoice-number">Нэхэмжлэх #{invoice_number}</p>
      <div class="header-grid">
        <div class="company-block">
          <img class="invoice-logo" src="{asset_src('dtx-logo-blue-yellow.png')}" alt="Дэлхий Трэвел" />
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
      <table class="invoice-items-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Утга</th>
            <th>Аялагч</th>
            <th>Нэгжийн үнэ</th>
            <th>Нийт үнэ</th>
          </tr>
        </thead>
        <tbody data-invoice-items-body>
          {items_markup}
          <tr class="total-row">
            <td colspan="4">Нийт үнэ</td>
            <td data-invoice-total>{format_money(total_amount)} ₮</td>
          </tr>
        </tbody>
      </table>
      <p class="section-title">Төлбөрийн хуваарь</p>
      <div class="payment-stack" data-payment-stack>
        {payment_markup}
      </div>
      <div class="bank-section">
        <p class="section-title">Дансны мэдээлэл</p>
        <select class="bank-account-select" data-bank-account-select>{bank_options_markup}</select>
        <div class="bank-grid bank-view">
          <div>Дэлхий Трэвел Икс</div>
          <div class="bank-line">
            <span data-bank-name>{html.escape(bank_account['bankName'])}</span>
            <span class="bank-prefix" data-bank-prefix>{html.escape(bank_account['prefix'])}</span>
            <strong class="bank-account-number" data-bank-number>{html.escape(bank_account['accountNumber'])}</strong>
          </div>
        </div>
      </div>
      <div class="signature-grid">
        <div class="signature-card">
          <div class="signature-label">Дэлхий Трэвел Икс ХХК</div>
          <div class="signature-line"></div>
          <img class="accountant-stamp" src="{asset_src('invoice-finance-stamp.png')}" alt="Finance stamp" />
          <img class="accountant-signature" src="{asset_src('invoice-finance-signature.png')}" alt="Accountant signature" />
          <div class="signature-name">Нягтлан</div>
          <div class="signature-role">Г.Басгалаан</div>
        </div>
        <div class="signature-card">
          <div class="signature-label">Төлөгч</div>
          <div class="signature-line"></div>
          <div class="signature-name">{customer_name}</div>
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
        HTML(string=html_string, base_url=str(BASE_DIR), media_type="screen").write_pdf(str(pdf_path))
    except Exception as exc:
        raise RuntimeError(f"HTML PDF generation failed: {exc}") from exc
    return f"/generated/{pdf_filename}"


# ── Standalone invoice (new model) — Mongolian invoice template ──
INVOICE_STATUS_LABELS = {
    "pending": ("Хүлээгдэж буй", "waiting"),
    "waiting": ("Хүлээгдэж буй", "waiting"),
    "paid":    ("Төлөгдсөн", "paid"),
    "overdue": ("Хугацаа хэтэрсэн", "overdue"),
}


def _fmt_money(value):
    try:
        n = float(value or 0)
    except Exception:
        n = 0
    return f"{int(round(n)):,} ₮".replace(",", ",")


def build_standalone_invoice_html(invoice):
    """Render the new-model invoice as Mongolian printable HTML for WeasyPrint.
    CSS mirrors the working contract-invoice template (build_invoice_html).
    """
    serial = html.escape(str(invoice.get("serial") or invoice.get("id") or ""))
    customer = html.escape(str((invoice.get("payerName") or "CLIENT")).upper())
    items = invoice.get("items") or []
    grand = sum((float(it.get("qty") or 0) * float(it.get("price") or 0)) for it in items)
    def _fmt_qty(q):
        try:
            f = float(q or 0)
        except (TypeError, ValueError):
            return html.escape(str(q or 0))
        return str(int(f)) if f.is_integer() else str(f)
    items_rows = "".join(
        f"<tr><td>{i+1}</td>"
        f"<td>{html.escape(str(it.get('description') or ''))}</td>"
        f"<td>{_fmt_qty(it.get('qty'))}</td>"
        f"<td>{_fmt_money(it.get('price'))}</td>"
        f"<td>{_fmt_money(float(it.get('qty') or 0) * float(it.get('price') or 0))}</td></tr>"
        for i, it in enumerate(items)
    )
    payments_html = ""
    for inst in (invoice.get("installments") or []):
        status_key = (inst.get("status") or "pending").lower()
        label, klass = INVOICE_STATUS_LABELS.get(status_key, INVOICE_STATUS_LABELS["pending"])
        payments_html += f"""
        <div class="payment-card">
          <div class="payment-main">{html.escape(str(inst.get('description') or ''))}</div>
          <div class="payment-meta"><span class="meta-label">Нэхэмжилсэн огноо</span><span class="meta-value">{html.escape(str(inst.get('issueDate') or '-'))}</span></div>
          <div class="payment-meta"><span class="meta-label">Эцсийн хугацаа</span><span class="meta-value">{html.escape(str(inst.get('dueDate') or '-'))}</span></div>
          <div class="payment-meta"><span class="meta-label">Төлөв</span><span class="payment-status {klass}">{label}</span></div>
          <div class="payment-amount">{_fmt_money(inst.get('amount'))}</div>
        </div>
        """
    # Use Path.as_uri() so WeasyPrint loads the local files reliably (handles spaces).
    def _asset(name):
        p = (BASE_DIR / "public" / "assets" / name)
        return p.resolve().as_uri() if p.exists() else ""
    logo_src = _asset("dtx-logo-blue-yellow.png")
    stamp_src = _asset("invoice-finance-stamp.png")
    sig_src = _asset("invoice-finance-signature.png")
    css = """
      @page { size: A4; margin: 16mm 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: #27272a;
        font-family: 'Nunito', Arial, sans-serif; font-size: 13px; }
      .page { padding: 0; }
      .invoice-number { margin: 0 0 18px; color: #27272a; font-size: 18px;
        line-height: 1.15; font-weight: 500; }
      .header-grid { display: grid; grid-template-columns: 1.05fr 0.95fr;
        gap: 20px; align-items: start; margin-bottom: 28px; }
      .invoice-logo { width: 154px; max-width: 100%; display: block; margin-bottom: 10px; }
      .company-name { margin: 0 0 12px; font-size: 14px; line-height: 1.25;
        font-weight: 700; color: #27272a; }
      .company-block p, .customer-block p, .meta-note {
        margin: 0; font-size: 13px; line-height: 1.38; }
      .meta-note { text-align: right; color: #27272a; white-space: nowrap; }
      .customer-block { padding-top: 80px; }
      .customer-block .label { display: block; margin-bottom: 4px; color: #64748b;
        font-size: 13px; font-weight: 600; }
      .section-title { margin: 0 0 10px; color: #64748b; font-size: 13px; font-weight: 600; }
      .invoice-items-table { width: 100%; border-collapse: separate; border-spacing: 0;
        border-radius: 12px; border: 1px solid #cfd8e6; overflow: hidden; margin-bottom: 28px; }
      th, td { padding: 10px 12px; border-bottom: 1px solid #cfd8e6;
        text-align: left; font-size: 13px; line-height: 1.25; }
      th { background: #fbfcfe; color: #27272a; font-weight: 700; }
      th:first-child, td:first-child { width: 46px; }
      td:last-child, th:last-child, td:nth-last-child(2), th:nth-last-child(2) { text-align: right; }
      .total-row td { font-weight: 700; background: #fff; border-bottom: 0; }
      .payment-stack { display: grid; gap: 16px; margin-bottom: 28px; }
      .payment-card { display: grid;
        grid-template-columns: 1.35fr 1.08fr 1.08fr 0.9fr 0.92fr;
        gap: 10px; align-items: center; min-height: 74px; padding: 16px 18px;
        border: 1px solid #cfd8e6; border-radius: 12px; background: #fff; }
      .payment-main, .payment-amount { min-width: 0; font-size: 13px; font-weight: 600; color: #27272a; }
      .payment-amount { text-align: right; white-space: nowrap; }
      .payment-meta { display: grid; gap: 4px; min-width: 0; }
      .meta-value { font-size: 13px; font-weight: 600; color: #27272a; }
      .meta-label { color: #64748b; font-size: 13px; font-weight: 600; white-space: nowrap; }
      .payment-status { display: inline-flex; align-items: center; justify-content: center;
        min-width: 82px; min-height: 30px; padding: 5px 11px; border-radius: 999px;
        font-size: 12px; font-weight: 700; }
      .payment-status.paid { background: #dcf4e3; color: #1f8550; }
      .payment-status.overdue { background: #f8dede; color: #c44747; }
      .payment-status.waiting { background: #fff5bd; color: #8a4b12; }
      .bank-section { margin-top: 0; padding-bottom: 28px; border-bottom: 1px solid #d9e0ea; }
      .bank-grid { display: grid; gap: 4px; font-size: 13px; line-height: 1.35; color: #27272a; }
      .bank-line { display: flex; flex-wrap: wrap; gap: 18px; align-items: baseline; }
      .bank-prefix { color: #64748b; }
      .bank-account-number { font-weight: 800; }
      .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px;
        margin-top: 24px; align-items: start; }
      .signature-card { position: relative; min-height: 218px; padding-top: 0; }
      .signature-label { position: relative; z-index: 3; min-height: 18px; margin-bottom: 112px;
        color: #64748b; font-size: 13px; font-weight: 600; background: #fff; }
      .signature-line { border-bottom: 1px dashed #d5ddec; }
      .accountant-stamp { position: absolute; left: 2px; bottom: 36px; width: 218px;
        z-index: 1; opacity: 0.98; }
      .accountant-signature { position: absolute; left: 64px; bottom: -34px; width: 290px; z-index: 2; }
      .signature-name { position: relative; z-index: 4; margin-top: 14px; font-size: 13px;
        font-weight: 700; color: #27272a; }
      .signature-role { position: relative; z-index: 4; color: #27272a; font-size: 13px; }
    """
    return f"""<!DOCTYPE html>
<html lang="mn"><head><meta charset="UTF-8"><title>Нэхэмжлэх #{serial}</title>
<style>{css}</style></head><body><div class="page">
  <p class="invoice-number">Нэхэмжлэх #{serial}</p>
  <div class="header-grid">
    <div class="company-block">
      {f'<img class="invoice-logo" src="{logo_src}" alt="">' if logo_src else ''}
      <p class="company-name">Дэлхий Трэвел Икс ХХК (6925073)</p>
      <p>Улаанбаатар хот, ХУД, 17-р хороо</p>
      <p>Их Монгол Улс гудамж, Кинг Тауэр, 121 байр, 102 тоот</p>
      <p>info@travelx.mn</p><p>+976 72007722</p>
    </div>
    <div>
      <p class="meta-note">Сангийн сайдын 2017 оны 12 дугаар сарын 05</p>
      <p class="meta-note">өдрийн 347 тоот тушаалын хавсралт</p>
      <div class="customer-block"><span class="label">Төлөгч</span><p><strong>{customer}</strong></p></div>
    </div>
  </div>
  <p class="section-title">Үнийн мэдээлэл</p>
  <table class="invoice-items-table">
    <thead><tr><th>№</th><th>Утга</th><th>Аялагч</th><th>Нэгжийн үнэ</th><th>Нийт үнэ</th></tr></thead>
    <tbody>{items_rows}<tr class="total-row"><td colspan="4">Нийт үнэ</td><td>{_fmt_money(grand)}</td></tr></tbody>
  </table>
  <p class="section-title">Төлбөрийн хуваарь</p>
  <div class="payment-stack">{payments_html}</div>
  <div class="bank-section"><p class="section-title">Дансны мэдээлэл</p>
    <div class="bank-grid"><div>Дэлхий Трэвел Икс</div>
      <div class="bank-line"><span>Төрийн Банк</span><span class="bank-prefix">MN030034</span><strong class="bank-account-number">3432 7777 9999</strong></div>
    </div>
  </div>
  <div class="signature-grid">
    <div class="signature-card"><div class="signature-label">Дэлхий Трэвел Икс ХХК</div><div class="signature-line"></div>
      {f'<img class="accountant-stamp" src="{stamp_src}" alt="">' if stamp_src else ''}
      {f'<img class="accountant-signature" src="{sig_src}" alt="">' if sig_src else ''}
      <div class="signature-name">Нягтлан</div><div class="signature-role">Г.Басгалаан</div>
    </div>
    <div class="signature-card"><div class="signature-label">Төлөгч</div><div class="signature-line"></div>
      <div class="signature-name">{customer}</div>
    </div>
  </div>
</div></body></html>"""


def save_standalone_invoice_pdf(invoice):
    ensure_data_store()
    pdf_filename = f"std-invoice-{invoice['id']}.pdf"
    pdf_path = GENERATED_DIR / pdf_filename
    try:
        from weasyprint import HTML
    except Exception as exc:
        raise RuntimeError(f"WeasyPrint not available: {exc}") from exc
    html_string = build_standalone_invoice_html(invoice)
    try:
        HTML(string=html_string, base_url=str(BASE_DIR), media_type="screen").write_pdf(str(pdf_path))
    except Exception as exc:
        raise RuntimeError(f"PDF generation failed: {exc}") from exc
    return f"/generated/{pdf_filename}"


def handle_standalone_invoice_pdf(environ, start_response, invoice_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    invoices = read_invoices()
    invoice = next((i for i in invoices if i.get("id") == invoice_id), None)
    if not invoice:
        return json_response(start_response, "404 Not Found", {"error": "Invoice not found"})
    try:
        pdf_url = save_standalone_invoice_pdf(invoice)
    except Exception as exc:
        return json_response(start_response, "500 Internal Server Error", {"error": f"Could not generate invoice PDF: {exc}"})
    safe_path = (GENERATED_DIR / unquote(pdf_url.replace("/generated/", "", 1))).resolve()
    if not str(safe_path).startswith(str(GENERATED_DIR.resolve())) or not safe_path.exists():
        return json_response(start_response, "404 Not Found", {"error": "Invoice PDF not found"})
    return file_response(start_response, safe_path, extra_headers=generated_download_headers(safe_path))


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


def save_user_avatar_image(data_url, user_id):
    if not data_url or "base64," not in data_url:
        return None
    header, encoded = data_url.split("base64,", 1)
    ext = "png"
    if "image/jpeg" in header or "image/jpg" in header:
        ext = "jpg"
    elif "image/webp" in header:
        ext = "webp"
    elif "image/png" not in header:
        return None
    try:
        raw = base64.b64decode(encoded)
    except Exception:
        return None
    if len(raw) > 4 * 1024 * 1024:
        return None
    filename = f"avatar-{user_id}-{uuid4().hex[:8]}.{ext}"
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


def is_hotel_reservation(record):
    reservation_type = normalize_text(record.get("reservationType")).lower()
    camp_name = normalize_text(record.get("campName")).lower()
    title = camp_reservation_title(record)
    return reservation_type == "hotel" or "hotel" in camp_name or title == RESERVATION_TYPE_LABELS["hotel"]


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


def camp_reservation_meals_mn(record):
    return " / ".join(
        [
            meal
            for meal in [
                record.get("breakfast") == "Yes" and "Өглөөний цай",
                record.get("lunch") == "Yes" and "Өдрийн хоол",
                record.get("dinner") == "Yes" and "Оройн хоол",
            ]
            if meal
        ]
    ) or "Хоолгүй"


def build_camp_document_html(record, pdf_href):
    meals = camp_reservation_meals_mn(record)
    reservation_title = camp_reservation_title(record)
    manager_name = record.get("staffAssignment") or STEPPE_MANAGER
    is_hotel = is_hotel_reservation(record)
    unit_label = "Өрөөний тоо" if is_hotel else "Гэрийн тоо"
    room_type_label = "Өрөөний төрөл" if is_hotel else "Гэрийн төрөл"
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
      @media print {{
        @page {{
          size: A4 landscape;
          margin: 0;
        }}
        body {{
          background: #fff;
        }}
        .toolbar {{
          display: none;
        }}
        .page {{
          width: auto;
          min-height: 100vh;
          margin: 0;
          padding: 34px 40px 40px;
          box-shadow: none;
          box-sizing: border-box;
        }}
        .logo {{
          font-size: 24px;
        }}
        .brand-sub {{
          font-size: 13px;
        }}
        .center-title {{
          margin: 28px 0 22px;
        }}
        th, td {{
          padding: 8px 7px;
          font-size: 13px;
        }}
        .footer {{
          margin-top: 34px;
        }}
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
            <th>{unit_label}</th>
            <th>{room_type_label}</th>
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
    is_hotel_bundle = is_hotel_reservation(first)
    place_label = "Буудал" if is_hotel_bundle else "Бааз"
    location_label = "Байршил"
    reservations_label = "Захиалга"
    manager_label = "Менежер"
    unit_label = "Өрөө" if is_hotel_bundle else "Гэр"
    room_type_label = "Өрөөний төрөл" if is_hotel_bundle else "Гэрийн төрөл"
    common_labels = {
        "reservation": "Захиалга",
        "pax": "Жуулчин",
        "staff": "Ажилчид",
        "check_in": "Ирэх өдөр",
        "check_out": "Явах өдөр",
        "nights": "Хоног",
        "meals": "Хоол",
    }
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
            <td>{html.escape(camp_reservation_meals_mn(record))}</td>
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
        grid-template-columns: 1fr minmax(360px, 48%);
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
        <p>{reservation_title} - “{html.escape(first['campName'])}”</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{common_labels["reservation"]}</th>
            <th>{common_labels["pax"]}</th>
            <th>{common_labels["staff"]}</th>
            <th>{common_labels["check_in"]}</th>
            <th>{common_labels["check_out"]}</th>
            <th>{common_labels["nights"]}</th>
            <th>{unit_label}</th>
            <th>{room_type_label}</th>
            <th>{common_labels["meals"]}</th>
          </tr>
        </thead>
        <tbody>{row_markup}</tbody>
      </table>
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
        from weasyprint import HTML

        html_string = build_camp_document_html(record, pdf_href)
        HTML(string=html_string, base_url=str(BASE_DIR)).write_pdf(str(pdf_path))
        pdf_ready = True
    except Exception as exc:
        print(f"Camp reservation PDF generation failed: {exc}", flush=True)
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
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

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
        is_hotel_bundle = is_hotel_reservation(first)
        place_label = "Буудал" if is_hotel_bundle else "Бааз"
        location_label = "Байршил"
        reservations_label = "Захиалга"
        manager_label = "Менежер"
        unit_label = "Өрөө" if is_hotel_bundle else "Гэр"
        room_type_label = "Өрөөний төрөл" if is_hotel_bundle else "Гэрийн төрөл"
        common_labels = {
            "reservation": "Захиалга",
            "pax": "Жуулчин",
            "staff": "Ажилчид",
            "check_in": "Ирэх өдөр",
            "check_out": "Явах өдөр",
            "nights": "Хоног",
            "meals": "Хоол",
        }

        styles = {
            "brand": ParagraphStyle(
                "CampBrand",
                fontName=bold_font_name,
                fontSize=18,
                leading=22,
                textColor=colors.HexColor("#1d2f86"),
                spaceAfter=2,
            ),
            "company": ParagraphStyle(
                "CampCompany",
                fontName=bold_font_name,
                fontSize=13,
                leading=16,
                alignment=2,
                textColor=colors.HexColor("#1d2f86"),
            ),
            "meta": ParagraphStyle("CampMeta", fontName=font_name, fontSize=9, leading=12),
            "meta_right": ParagraphStyle("CampMetaRight", fontName=font_name, fontSize=9, leading=12, alignment=2),
            "title": ParagraphStyle("CampTitle", fontName=bold_font_name, fontSize=16, leading=20, alignment=1, spaceAfter=4),
            "subtitle": ParagraphStyle("CampSubtitle", fontName=bold_font_name, fontSize=13, leading=17, alignment=1, spaceAfter=10),
            "summary": ParagraphStyle("CampSummary", fontName=font_name, fontSize=9, leading=12),
            "th": ParagraphStyle("CampHeaderCell", fontName=bold_font_name, fontSize=7.5, leading=9, alignment=1),
            "td": ParagraphStyle("CampBodyCell", fontName=font_name, fontSize=7.5, leading=9, alignment=1),
            "td_left": ParagraphStyle("CampBodyCellLeft", fontName=font_name, fontSize=7.5, leading=9, alignment=0),
            "footer": ParagraphStyle("CampFooter", fontName=font_name, fontSize=9, leading=12),
        }

        def p(value, style="td"):
            return Paragraph(html.escape(str(value or "-")).replace("\n", "<br/>"), styles[style])

        page_width, _ = landscape(A4)
        margin = 10 * mm
        usable_width = page_width - (margin * 2)
        doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=landscape(A4),
            rightMargin=margin,
            leftMargin=margin,
            topMargin=10 * mm,
            bottomMargin=9 * mm,
            title=f"{first['campName']} reservations",
        )

        story = []
        header_table = Table(
            [[
                Paragraph("UNLOCK STEPPE MONGOLIA", styles["brand"]),
                Paragraph(f"{html.escape(STEPPE_COMPANY_NAME)}<br/>{html.escape(STEPPE_CITY)}<br/>{format_pdf_date(now_mongolia().date().isoformat())}", styles["company"]),
            ], [
                Paragraph(
                    "<br/>".join(html.escape(line) for line in STEPPE_ADDRESS_LINES)
                    + f"<br/>Утас: {html.escape(STEPPE_PHONES)}<br/>И-мэйл: {html.escape(STEPPE_EMAIL)}",
                    styles["meta"],
                ),
                Paragraph("", styles["meta_right"]),
            ]],
            colWidths=[usable_width * 0.48, usable_width * 0.52],
        )
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.extend([
            header_table,
            Spacer(1, 10),
            Paragraph(f"{html.escape(reservation_title)} - “{html.escape(first['campName'])}”", styles["subtitle"]),
        ])

        summary = Table(
            [[
                p(f"{place_label}: {first['campName']}", "summary"),
                p(f"{location_label}: {first.get('locationName') or '-'}", "summary"),
                p(f"{reservations_label}: {len(records)}", "summary"),
                p(f"{manager_label}: {manager_name}", "summary"),
            ]],
            colWidths=[usable_width * 0.26, usable_width * 0.28, usable_width * 0.18, usable_width * 0.28],
        )
        summary.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f3f6fb")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#c8d4e6")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d7e0ec")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.extend([summary, Spacer(1, 9)])

        table_rows = [[
            p("#", "th"),
            p(common_labels["reservation"], "th"),
            p(common_labels["pax"], "th"),
            p(common_labels["staff"], "th"),
            p(common_labels["check_in"], "th"),
            p(common_labels["check_out"], "th"),
            p(common_labels["nights"], "th"),
            p(unit_label, "th"),
            p(room_type_label, "th"),
            p(common_labels["meals"], "th"),
        ]]
        for index, record in enumerate(records, start=1):
            table_rows.append([
                p(index),
                p(record.get("reservationName") or record["tripName"], "td_left"),
                p(record["clientCount"]),
                p(record["staffCount"]),
                p(format_iso_date(record["checkIn"])),
                p(format_iso_date(record["checkOut"])),
                p(record["nights"]),
                p(record["gerCount"]),
                p(record["roomType"], "td_left"),
                p(camp_reservation_meals_mn(record), "td_left"),
            ])

        col_widths = [
            usable_width * 0.035,
            usable_width * 0.18,
            usable_width * 0.045,
            usable_width * 0.05,
            usable_width * 0.095,
            usable_width * 0.095,
            usable_width * 0.05,
            usable_width * 0.05,
            usable_width * 0.22,
            usable_width * 0.18,
        ]
        table = Table(
            table_rows,
            colWidths=col_widths,
            repeatRows=1,
        )
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d8e4f2")),
            ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#1f2937")),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(table)
        contact_box = Table(
            [[
                Paragraph(
                    f"<b>Захиалгын менежер:</b> {html.escape(manager_name)}<br/>"
                    f"<b>Харилцах утас:</b> {html.escape(STEPPE_CONTACT_PHONES)}<br/>"
                    f"<b>Цахим шуудан:</b> {html.escape(STEPPE_EMAIL)}",
                    styles["footer"],
                ),
            ]],
            colWidths=[usable_width * 0.48],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f7f8fb")),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#d7e0ec")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]),
        )
        footer_row = Table(
            [["", contact_box]],
            colWidths=[usable_width * 0.52, usable_width * 0.48],
            style=TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]),
        )
        story.extend([Spacer(1, 10), footer_row])

        doc.build(story)
        pdf_ready = True
    except Exception as exc:
        print(f"Camp bundle PDF generation failed: {exc}", flush=True)
        pdf_href = f"/generated/{html_filename}"

    return {
        "pdfViewPath": f"/generated/{html_filename}",
        "pdfPath": pdf_href if pdf_ready else f"/generated/{html_filename}",
    }


def clean_ds160_payload(payload):
    cleaned = {}
    for key, value in (payload or {}).items():
        if isinstance(value, list):
            cleaned_list = []
            for item in value:
                if isinstance(item, dict):
                    cleaned_list.append({k: normalize_text(v) for k, v in item.items()})
                else:
                    cleaned_list.append(normalize_text(item))
            cleaned[key] = cleaned_list
        elif isinstance(value, dict):
            cleaned[key] = {k: normalize_text(v) for k, v in value.items()}
        elif key in ("photo", "passportScan") and isinstance(value, str) and value.startswith("data:"):
            cleaned[key] = value
        else:
            cleaned[key] = normalize_text(value)
    return cleaned


def flatten_ds160_answers(payload):
    cleaned = clean_ds160_payload(payload)
    surname = cleaned.get("surname", "")
    given_name = cleaned.get("givenName", "")
    applicant_name = normalize_text(f"{surname} {given_name}")
    return {
        **cleaned,
        "applicantName": applicant_name,
    }


def normalize_ds160_status(value):
    status = normalize_text(value).lower()
    if status in {"draft", "sent", "submitted", "reviewed"}:
        return status
    return "submitted" if status == "complete" else "sent"


def normalize_ds160_record(record):
    if not isinstance(record, dict):
        return {}
    payload = clean_ds160_payload(record.get("payload"))
    legacy_payload = {
        key: value
        for key, value in record.items()
        if key
        not in {
            "id",
            "clientToken",
            "status",
            "clientName",
            "clientEmail",
            "clientPhone",
            "managerName",
            "managerEmail",
            "managerPhone",
            "shareUrl",
            "internalNotes",
            "appId",
            "createdAt",
            "updatedAt",
            "submittedAt",
            "appointmentDate",
            "appointmentTime",
            "createdBy",
            "updatedBy",
            "payload",
            "applicantName",
            "officialFlowNote",
        }
    }
    if not payload:
        payload = clean_ds160_payload(legacy_payload)
    flattened = flatten_ds160_answers(payload)
    created_at = normalize_text(record.get("createdAt")) or datetime.now(timezone.utc).isoformat()
    updated_at = normalize_text(record.get("updatedAt")) or normalize_text(record.get("submittedAt")) or created_at
    submitted_at = normalize_text(record.get("submittedAt"))
    status = normalize_ds160_status(record.get("status") or ("submitted" if payload else "sent"))
    if status == "submitted" and not submitted_at:
        submitted_at = updated_at

    return {
        "id": normalize_text(record.get("id")) or str(uuid4()),
        "clientToken": normalize_text(record.get("clientToken")) or secrets.token_urlsafe(18),
        "status": status,
        "clientName": normalize_text(record.get("clientName")) or flattened.get("applicantName", ""),
        "clientEmail": normalize_text(record.get("clientEmail") or flattened.get("email")).lower(),
        "clientPhone": normalize_text(record.get("clientPhone") or flattened.get("primaryPhone")),
        "managerName": normalize_text(record.get("managerName") or (record.get("createdBy") or {}).get("name")),
        "managerEmail": normalize_text(record.get("managerEmail")),
        "managerPhone": normalize_text(record.get("managerPhone")),
        "shareUrl": normalize_text(record.get("shareUrl")),
        "internalNotes": normalize_text(record.get("internalNotes") or record.get("notes")),
        "appId": normalize_text(record.get("appId")),
        "createdAt": created_at,
        "updatedAt": updated_at,
        "submittedAt": submitted_at,
        "appointmentDate": normalize_text(record.get("appointmentDate")),
        "appointmentTime": normalize_text(record.get("appointmentTime")),
        "createdBy": record.get("createdBy") if isinstance(record.get("createdBy"), dict) else {"id": "", "email": "", "name": ""},
        "updatedBy": record.get("updatedBy") if isinstance(record.get("updatedBy"), dict) else {"id": "", "email": "", "name": ""},
        "payload": payload,
        **flattened,
        "officialFlowNote": "Энэ нь дотоод мэдээлэл авах маягт бөгөөд албан ёсны DS-160 маягтыг орлохгүй.",
    }


def build_ds160_invitation(payload, actor):
    now_iso = datetime.now(timezone.utc).isoformat()
    record = normalize_ds160_record(
        {
            "id": str(uuid4()),
            "clientToken": secrets.token_urlsafe(18),
            "status": "sent",
            "clientName": payload.get("clientName"),
            "clientEmail": normalize_text(payload.get("clientEmail")).lower(),
            "clientPhone": payload.get("clientPhone"),
            "managerName": payload.get("managerName") or actor.get("fullName") or actor.get("email"),
            "managerEmail": normalize_text(payload.get("managerEmail") or actor.get("email")).lower(),
            "managerPhone": payload.get("managerPhone"),
            "internalNotes": payload.get("internalNotes"),
            "appId": payload.get("appId"),
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "appointmentDate": payload.get("appointmentDate"),
            "appointmentTime": payload.get("appointmentTime"),
            "createdBy": actor_snapshot(actor),
            "updatedBy": actor_snapshot(actor),
            "payload": {},
        }
    )
    return record


def build_ds160_application(payload):
    now_iso = datetime.now(timezone.utc).isoformat()
    flattened = flatten_ds160_answers(payload)
    return normalize_ds160_record(
        {
            "id": str(uuid4()),
            "clientToken": secrets.token_urlsafe(18),
            "status": "submitted",
            "clientName": flattened.get("applicantName", ""),
            "clientEmail": flattened.get("email", "").lower(),
            "clientPhone": flattened.get("primaryPhone", ""),
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "submittedAt": now_iso,
            "appointmentDate": payload.get("appointmentDate"),
            "appointmentTime": payload.get("appointmentTime"),
            "payload": cleaned if (cleaned := clean_ds160_payload(payload)) else {},
        }
    )


def validate_ds160_application(data):
    required = [
        "surname",
        "givenName",
        "nativeFullName",
        "dateOfBirth",
        "birthCountry",
        "nationality",
        "registerNumber",
        "email",
        "primaryPhone",
        "passportNumber",
        "passportIssueDate",
        "passportExpiryDate",
        "tripPurposeCategory",
    ]
    missing = [field for field in required if not data.get(field)]
    if normalize_text(data.get("hasSpecificTravelPlans")).upper() == "ТИЙМ" and not data.get("intendedArrivalDate"):
        missing.append("intendedArrivalDate")
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None


def validate_ds160_invitation(data):
    if len(normalize_text(data.get("clientName"))) < 2:
        return "Client name is required"
    if "@" not in normalize_text(data.get("clientEmail")):
        return "Client email is required"
    return None


def find_ds160_record(record_id=None, client_token=None):
    for record in read_ds160_applications():
        if record_id and record.get("id") == record_id:
            return record
        if client_token and record.get("clientToken") == client_token:
            return record
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


def normalize_tag_list(value):
    if isinstance(value, str):
        items = [t.strip() for t in value.split(",")]
    elif isinstance(value, list):
        items = [normalize_text(t) for t in value]
    else:
        items = []
    seen = []
    for item in items:
        if item and item not in seen:
            seen.append(item)
    return seen


def build_camp_trip(payload, actor=None):
    company = normalize_company(payload.get("company"))
    trip_type = normalize_text(payload.get("tripType")).lower() or "git"
    if trip_type not in {"fit", "git"}:
        trip_type = "git"
    return {
        "id": str(uuid4()),
        "serial": next_trip_serial(company),
        "createdAt": now_mongolia().isoformat(),
        "tripName": normalize_text(payload.get("tripName")),
        "tripType": trip_type,
        "groupName": normalize_text(payload.get("groupName")),
        "reservationName": normalize_text(payload.get("reservationName")) or normalize_text(payload.get("tripName")),
        "startDate": normalize_text(payload.get("startDate")),
        "endDate": normalize_text(payload.get("endDate")),
        "totalDays": parse_int(payload.get("totalDays")) or 1,
        "participantCount": parse_int(payload.get("participantCount")),
        "staffCount": parse_int(payload.get("staffCount")),
        "guideName": normalize_text(payload.get("guideName")),
        "driverName": normalize_text(payload.get("driverName")),
        "cookName": normalize_text(payload.get("cookName")),
        "language": normalize_text(payload.get("language")) or "Other",
        "status": normalize_text(payload.get("status")).lower() or "planning",
        "tags": normalize_tag_list(payload.get("tags")),
        "inboundCompany": "Unlock Steppe Mongolia",
        "company": company,
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_camp_trip(data):
    required = ["tripName", "startDate"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    if data.get("participantCount", 0) <= 0:
        return "Number of participants must be greater than 0"
    if data.get("totalDays", 0) <= 0:
        return "Total days must be greater than 0"
    trip_type = (data.get("tripType") or "").lower()
    if trip_type and trip_type not in {"fit", "git"}:
        return "Trip type must be FIT or GIT"
    return None


def find_camp_trip(trip_id):
    for trip in read_camp_trips():
        if trip["id"] == trip_id:
            return trip
    return None


def find_tourist_group(group_id):
    for record in read_tourist_groups():
        if record["id"] == group_id:
            return record
    return None


def find_tourist(tourist_id):
    for record in read_tourists():
        if record["id"] == tourist_id:
            return record
    return None


def build_tourist_group(payload, actor=None):
    trip_id = normalize_text(payload.get("tripId"))
    trip = find_camp_trip(trip_id)
    trip_serial = trip.get("serial") if trip else ""
    return {
        "id": str(uuid4()),
        "serial": next_group_serial(trip_serial, trip_id),
        "tripId": trip_id,
        "tripSerial": trip_serial,
        "name": normalize_text(payload.get("name")),
        "leaderName": normalize_text(payload.get("leaderName")),
        "leaderEmail": normalize_text(payload.get("leaderEmail")).lower(),
        "leaderPhone": normalize_text(payload.get("leaderPhone")),
        "leaderNationality": normalize_text(payload.get("leaderNationality")),
        "headcount": parse_int(payload.get("headcount")) or 0,
        "notes": normalize_text(payload.get("notes")),
        "status": (normalize_text(payload.get("status")) or "pending").lower(),
        "createdAt": now_mongolia().isoformat(),
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_tourist_group(data):
    if not data.get("tripId"):
        return "Trip is required"
    if not data.get("name"):
        return "Group name is required"
    return None


VALID_ROOM_TYPES = {"single", "double", "twin", "triple", "family", "other"}


def normalize_room_type(value):
    v = normalize_text(value).lower()
    return v if v in VALID_ROOM_TYPES else ""


def upper_text(value):
    return normalize_text(value).upper()


def _calc_age_from_dob(dob):
    """Return integer age (full years) from a yyyy-mm-dd dob string, or None."""
    s = (dob or "").strip()
    if not s or len(s) < 10:
        return None
    try:
        y, m, d = int(s[0:4]), int(s[5:7]), int(s[8:10])
    except Exception:
        return None
    today = now_mongolia().date()
    age = today.year - y
    if (today.month, today.day) < (m, d):
        age -= 1
    return age if age >= 0 else None


def _resolve_marketing_status(payload_status, dob, prior_status=None):
    """Children (under 18) are forced to 'child' regardless of input.
    Adults: use payload status, falling back to prior status, then 'standard'.
    If a record was previously 'child' and grew up, default back to 'standard'."""
    raw = (payload_status or "").strip().lower()
    age = _calc_age_from_dob(dob)
    if age is not None and age < 18:
        return "child"
    if raw and raw != "child":
        return raw
    prior = (prior_status or "").strip().lower()
    if prior and prior != "child":
        return prior
    return "standard"


def build_tourist(payload, actor=None):
    group_id = normalize_text(payload.get("groupId"))
    group = find_tourist_group(group_id) if group_id else None
    trip_id = (group or {}).get("tripId") or normalize_text(payload.get("tripId"))
    trip = find_camp_trip(trip_id) if trip_id else None
    group_serial = (group or {}).get("serial") or ""
    trip_serial = (trip or {}).get("serial") or ""
    return {
        "id": str(uuid4()),
        "serial": next_tourist_serial(group_serial, group_id),
        "tripId": trip_id,
        "tripSerial": trip_serial,
        "groupId": group_id,
        "groupSerial": group_serial,
        "groupName": (group or {}).get("name") or "",
        "firstName": upper_text(payload.get("firstName")),
        "lastName": upper_text(payload.get("lastName")),
        "gender": normalize_text(payload.get("gender")).lower(),
        "dob": normalize_text(payload.get("dob")),
        "nationality": upper_text(payload.get("nationality")),
        "passportNumber": upper_text(payload.get("passportNumber")),
        "passportIssueDate": normalize_text(payload.get("passportIssueDate")),
        "passportExpiry": normalize_text(payload.get("passportExpiry")),
        "passportIssuePlace": upper_text(payload.get("passportIssuePlace")),
        "registrationNumber": upper_text(payload.get("registrationNumber")),
        "phone": normalize_text(payload.get("phone")),
        "email": normalize_text(payload.get("email")).lower(),
        "marketingStatus": _resolve_marketing_status(payload.get("marketingStatus"), normalize_text(payload.get("dob"))),
        "roomType": normalize_room_type(payload.get("roomType")),
        "roomCode": normalize_text(payload.get("roomCode")),
        "passportScanPath": normalize_text(payload.get("passportScanPath")),
        "photoPath": normalize_text(payload.get("photoPath")),
        "notes": normalize_text(payload.get("notes")),
        "createdAt": now_mongolia().isoformat(),
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_tourist(data):
    if not data.get("tripId"):
        return "Trip is required"
    if not data.get("groupId"):
        return "Group is required"
    if not data.get("firstName") and not data.get("lastName"):
        return "Tourist name is required"
    return None


def save_tourist_image(data_url, prefix, tourist_id):
    if not data_url or "base64," not in data_url:
        return ""
    header, encoded = data_url.split("base64,", 1)
    ext = "png"
    if "image/jpeg" in header or "image/jpg" in header:
        ext = "jpg"
    elif "image/webp" in header:
        ext = "webp"
    elif "image/png" not in header:
        return ""
    try:
        raw = base64.b64decode(encoded)
    except Exception:
        return ""
    if len(raw) > 6 * 1024 * 1024:
        return ""
    filename = f"{prefix}-{tourist_id}-{uuid4().hex[:8]}.{ext}"
    path = GENERATED_DIR / filename
    path.write_bytes(raw)
    return f"/generated/{filename}"


def handle_list_tourist_groups(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    params = parse_qs(environ.get("QUERY_STRING", ""))
    trip_id = (params.get("tripId", [""])[0] or "").strip()
    workspace = active_workspace(environ)
    groups = read_tourist_groups()
    if trip_id:
        groups = [g for g in groups if g.get("tripId") == trip_id]
    elif workspace:
        trip_ids = {t["id"] for t in read_camp_trips() if normalize_company(t.get("company")) == workspace}
        groups = [g for g in groups if g.get("tripId") in trip_ids]
    groups.sort(key=lambda g: (g.get("tripSerial") or "", g.get("serial") or ""))
    return json_response(start_response, "200 OK", {"entries": groups})


def handle_create_tourist_group(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    record = build_tourist_group(payload, actor)
    error = validate_tourist_group(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    records = read_tourist_groups()
    records.insert(0, record)
    write_tourist_groups(records)
    try:
        log_notification(
            "group.created",
            actor,
            "New group added",
            detail=f"{record.get('serial', '')} {record.get('name', '')}".strip(),
            meta={"id": record["id"], "tripId": record.get("tripId")},
        )
    except Exception:
        pass
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


def handle_update_tourist_group(environ, start_response, group_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    records = read_tourist_groups()
    for index, record in enumerate(records):
        if record.get("id") != group_id:
            continue
        merged = {**record}
        for key in ["name", "leaderName", "leaderEmail", "leaderPhone", "leaderNationality", "notes"]:
            if key in payload:
                merged[key] = normalize_text(payload.get(key))
        if "headcount" in payload:
            merged["headcount"] = parse_int(payload.get("headcount")) or 0
        if "status" in payload:
            merged["status"] = (normalize_text(payload.get("status")) or "pending").lower()
        error = validate_tourist_group(merged)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        merged["updatedAt"] = now_mongolia().isoformat()
        merged["updatedBy"] = actor_snapshot(actor)
        records[index] = merged
        write_tourist_groups(records)
        # Cascade groupName update to tourists
        if "name" in payload:
            tourists = read_tourists()
            changed = False
            for t in tourists:
                if t.get("groupId") == group_id and t.get("groupName") != merged["name"]:
                    t["groupName"] = merged["name"]
                    changed = True
            if changed:
                write_tourists(tourists)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged})
    return json_response(start_response, "404 Not Found", {"error": "Group not found"})


def handle_delete_tourist_group(environ, start_response, group_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    records = read_tourist_groups()
    remaining = [r for r in records if r.get("id") != group_id]
    if len(remaining) == len(records):
        return json_response(start_response, "404 Not Found", {"error": "Group not found"})
    write_tourist_groups(remaining)
    # Also delete tourists in that group
    tourists = read_tourists()
    new_tourists = [t for t in tourists if t.get("groupId") != group_id]
    if len(new_tourists) != len(tourists):
        write_tourists(new_tourists)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": group_id})


def handle_list_tourists(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    params = parse_qs(environ.get("QUERY_STRING", ""))
    trip_id = (params.get("tripId", [""])[0] or "").strip()
    group_id = (params.get("groupId", [""])[0] or "").strip()
    workspace = active_workspace(environ)
    tourists = read_tourists()
    if group_id:
        tourists = [t for t in tourists if t.get("groupId") == group_id]
    elif trip_id:
        tourists = [t for t in tourists if t.get("tripId") == trip_id]
    elif workspace:
        trip_ids = {t["id"] for t in read_camp_trips() if normalize_company(t.get("company")) == workspace}
        tourists = [t for t in tourists if t.get("tripId") in trip_ids]
    tourists.sort(key=lambda t: (t.get("tripSerial") or "", t.get("serial") or ""))
    return json_response(start_response, "200 OK", {"entries": tourists})


def handle_promo_email(environ, start_response):
    """POST /api/tourists/promo-email — admin-driven marketing send. Body:
    {touristIds: [...], subject, body, workspace?}. Sends an individual email
    per tourist (so they can't see each other), filtering out anyone with
    marketingStatus="do_not_contact" or no email on file."""
    actor = require_login(environ, start_response)
    if not actor:
        return []
    try:
        body_raw = environ["wsgi.input"].read(int(environ.get("CONTENT_LENGTH") or "0"))
        data = json.loads(body_raw)
    except Exception:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid JSON"})
    ids = data.get("touristIds") or []
    subject = (data.get("subject") or "").strip()
    body_text = (data.get("body") or "").strip()
    workspace = (data.get("workspace") or "").strip().upper()
    if not isinstance(ids, list) or not ids:
        return json_response(start_response, "400 Bad Request", {"error": "touristIds (non-empty list) is required"})
    if not subject or not body_text:
        return json_response(start_response, "400 Bad Request", {"error": "subject and body are required"})

    tourists_by_id = {t.get("id"): t for t in read_tourists()}
    targets = []
    skipped_no_email = 0
    skipped_optout = 0
    skipped_child = 0
    for tid in ids:
        t = tourists_by_id.get(tid)
        if not t:
            continue
        status = (t.get("marketingStatus") or "").lower()
        if status == "do_not_contact":
            skipped_optout += 1
            continue
        # Defense in depth: never email children even if frontend sent the id.
        age = _calc_age_from_dob(t.get("dob"))
        if status == "child" or (age is not None and age < 18):
            skipped_child += 1
            continue
        email = (t.get("email") or "").strip()
        if not email or "@" not in email:
            skipped_no_email += 1
            continue
        targets.append((t, email))

    company_name = "Unlock Steppe Mongolia" if workspace == "USM" else "Дэлхий Трэвел Икс"
    sent = 0
    failures = []
    for t, email in targets:
        first = t.get("firstName") or ""
        greet = f"Сайн байна уу{(', ' + first.title()) if first else ''},"
        personalized = f"{greet}\n\n{body_text}"
        result = _tool_send_email({
            "to": email,
            "subject": subject,
            "body": personalized,
            "_company_name": company_name,
        }, actor)
        if result.get("error"):
            failures.append(f"{email}: {result['error'][:80]}")
        else:
            sent += 1

    return json_response(start_response, "200 OK", {
        "ok": True,
        "sent": sent,
        "skippedNoEmail": skipped_no_email,
        "skippedOptOut": skipped_optout,
        "skippedChild": skipped_child,
        "failures": failures[:20],
    })


def handle_create_tourist(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    record = build_tourist(payload, actor)
    error = validate_tourist(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    if payload.get("passportScanData"):
        record["passportScanPath"] = save_tourist_image(payload["passportScanData"], "tourist-passport", record["id"])
    if payload.get("photoData"):
        record["photoPath"] = save_tourist_image(payload["photoData"], "tourist-photo", record["id"])
    records = read_tourists()
    records.insert(0, record)
    write_tourists(records)
    try:
        log_notification(
            "tourist.created",
            actor,
            "New tourist added",
            detail=f"{record.get('serial', '')} {record.get('lastName', '')} {record.get('firstName', '')}".strip(),
            meta={"id": record["id"], "tripId": record.get("tripId"), "groupId": record.get("groupId")},
        )
    except Exception:
        pass
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


def handle_update_tourist(environ, start_response, tourist_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    records = read_tourists()
    for index, record in enumerate(records):
        if record.get("id") != tourist_id:
            continue
        merged = {**record}
        upper_keys = {"firstName", "lastName", "nationality", "passportNumber", "passportIssuePlace", "registrationNumber"}
        for key in ["firstName", "lastName", "gender", "dob", "nationality", "passportNumber", "passportIssueDate", "passportExpiry", "passportIssuePlace", "registrationNumber", "phone", "email", "notes", "roomCode", "marketingStatus"]:
            if key in payload:
                value = normalize_text(payload.get(key))
                if key == "email":
                    value = value.lower()
                if key == "gender":
                    value = value.lower()
                if key in upper_keys:
                    value = value.upper()
                merged[key] = value
        if "roomType" in payload:
            merged["roomType"] = normalize_room_type(payload.get("roomType"))
        if "orderIndex" in payload:
            merged["orderIndex"] = parse_int(payload.get("orderIndex")) or 0
        merged["marketingStatus"] = _resolve_marketing_status(
            merged.get("marketingStatus"),
            merged.get("dob"),
            prior_status=record.get("marketingStatus"),
        )
        if payload.get("passportScanData"):
            merged["passportScanPath"] = save_tourist_image(payload["passportScanData"], "tourist-passport", tourist_id)
        if payload.get("photoData"):
            merged["photoPath"] = save_tourist_image(payload["photoData"], "tourist-photo", tourist_id)
        if payload.get("removePassportScan"):
            merged["passportScanPath"] = ""
        if payload.get("removePhoto"):
            merged["photoPath"] = ""
        error = validate_tourist(merged)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        merged["updatedAt"] = now_mongolia().isoformat()
        merged["updatedBy"] = actor_snapshot(actor)
        records[index] = merged
        write_tourists(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged})
    return json_response(start_response, "404 Not Found", {"error": "Tourist not found"})


def handle_delete_tourist(environ, start_response, tourist_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    records = read_tourists()
    remaining = [r for r in records if r.get("id") != tourist_id]
    if len(remaining) == len(records):
        return json_response(start_response, "404 Not Found", {"error": "Tourist not found"})
    write_tourists(remaining)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": tourist_id})


def handle_list_documents(environ, start_response):
    """GET /api/documents — flatten every document attached to every trip in
    the active workspace, returning enriched rows ({ tripId, tripSerial,
    tripName, ...doc }) so the global Documents page can show context and
    filter without N+1 fetches."""
    if not require_login(environ, start_response):
        return []
    workspace = active_workspace(environ)
    rows = []
    for trip in read_camp_trips():
        if workspace and normalize_company(trip.get("company")) != workspace:
            continue
        for doc in (trip.get("documents") or []):
            rows.append({
                **doc,
                "tripId": trip.get("id"),
                "tripSerial": trip.get("serial") or "",
                "tripName": trip.get("tripName") or "",
            })
    rows.sort(key=lambda d: d.get("uploadedAt") or "", reverse=True)
    return json_response(start_response, "200 OK", {"entries": rows})


def handle_list_invoices(environ, start_response):
    if not require_login(environ, start_response):
        return []
    qs = parse_qs(environ.get("QUERY_STRING", ""))
    trip_id = (qs.get("tripId") or [""])[0].strip()
    group_id = (qs.get("groupId") or [""])[0].strip()
    records = read_invoices()
    if trip_id:
        records = [r for r in records if r.get("tripId") == trip_id]
    if group_id:
        records = [r for r in records if r.get("groupId") == group_id]
    # Scope by active workspace so DTX admins don't see USM invoices and vice
    # versa. Invoices don't carry their own `company` field — they're tied to
    # a trip, and the trip carries the workspace. So filter via the trip set.
    workspace = active_workspace(environ)
    if workspace and not trip_id:
        ws_trip_ids = {t["id"] for t in read_camp_trips() if normalize_company(t.get("company")) == workspace}
        records = [r for r in records if r.get("tripId") in ws_trip_ids]
    records.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return json_response(start_response, "200 OK", {"entries": records})


def handle_create_invoice(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    record = build_invoice(payload, actor)
    error = validate_invoice(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})
    records = read_invoices()
    records.append(record)
    write_invoices(records)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


def handle_update_invoice(environ, start_response, invoice_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})
    records = read_invoices()
    for index, record in enumerate(records):
        if record.get("id") != invoice_id:
            continue
        rebuilt = build_invoice({**record, **payload}, actor)
        rebuilt["id"] = record["id"]
        rebuilt["serial"] = record["serial"]
        rebuilt["createdAt"] = record.get("createdAt", now_mongolia().isoformat())
        rebuilt["createdBy"] = record.get("createdBy", actor_snapshot(actor))
        rebuilt["status"] = record.get("status", "draft")
        rebuilt["updatedAt"] = now_mongolia().isoformat()
        rebuilt["updatedBy"] = actor_snapshot(actor)
        error = validate_invoice(rebuilt)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        records[index] = rebuilt
        write_invoices(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": rebuilt})
    return json_response(start_response, "404 Not Found", {"error": "Invoice not found"})


def handle_delete_invoice(environ, start_response, invoice_id):
    if not require_login(environ, start_response):
        return []
    records = read_invoices()
    remaining = [r for r in records if r.get("id") != invoice_id]
    if len(remaining) == len(records):
        return json_response(start_response, "404 Not Found", {"error": "Invoice not found"})
    write_invoices(remaining)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": invoice_id})


def handle_publish_invoice(environ, start_response, invoice_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    records = read_invoices()
    for index, record in enumerate(records):
        if record.get("id") != invoice_id:
            continue
        record["status"] = "published"
        record["publishedAt"] = now_mongolia().isoformat()
        record["updatedAt"] = now_mongolia().isoformat()
        record["updatedBy"] = actor_snapshot(actor)
        records[index] = record
        write_invoices(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": record})
    return json_response(start_response, "404 Not Found", {"error": "Invoice not found"})


def handle_invoice_payment(environ, start_response, invoice_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ) or {}
    inst_index = payload.get("installmentIndex")
    if inst_index is None:
        return json_response(start_response, "400 Bad Request", {"error": "installmentIndex required"})
    try:
        inst_index = int(inst_index)
    except Exception:
        return json_response(start_response, "400 Bad Request", {"error": "installmentIndex must be integer"})
    new_status = normalize_text(payload.get("status")) or "paid"
    paid_date = normalize_text(payload.get("paidDate"))
    records = read_invoices()
    for index, record in enumerate(records):
        if record.get("id") != invoice_id:
            continue
        installments = record.get("installments") or []
        if inst_index < 0 or inst_index >= len(installments):
            return json_response(start_response, "400 Bad Request", {"error": "installment out of range"})
        installments[inst_index]["status"] = new_status
        if paid_date:
            installments[inst_index]["paidDate"] = paid_date
        record["installments"] = installments
        record["updatedAt"] = now_mongolia().isoformat()
        record["updatedBy"] = actor_snapshot(actor)
        records[index] = record
        write_invoices(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": record})
    return json_response(start_response, "404 Not Found", {"error": "Invoice not found"})


def handle_export_tourists(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ) or {}
    ids = payload.get("ids") or []
    trip_id = normalize_text(payload.get("tripId"))
    records = read_tourists()
    if ids:
        id_set = set(ids)
        records = [r for r in records if r.get("id") in id_set]
    elif trip_id:
        records = [r for r in records if r.get("tripId") == trip_id]
    groups_by_id = {g["id"]: g for g in read_tourist_groups()}
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
        from io import BytesIO
    except Exception as exc:
        return json_response(start_response, "500 Internal Server Error", {"error": f"Excel export unavailable: {exc}"})
    wb = Workbook()
    ws = wb.active
    ws.title = "Tourists"
    headers = [
        "Serial", "Last name", "First name", "Group",
        "Gender", "Date of birth", "Nationality",
        "Passport #", "Passport issue date", "Passport expiry", "Passport issued at",
        "Registration #", "Phone", "Email",
    ]
    ws.append(headers)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="20356F")
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
    for r in records:
        group = groups_by_id.get(r.get("groupId")) or {}
        ws.append([
            r.get("serial", ""),
            r.get("lastName", ""),
            r.get("firstName", ""),
            group.get("name") or r.get("groupSerial", ""),
            r.get("gender", ""),
            r.get("dob", ""),
            r.get("nationality", ""),
            r.get("passportNumber", ""),
            r.get("passportIssueDate", ""),
            r.get("passportExpiry", ""),
            r.get("passportIssuePlace", ""),
            r.get("registrationNumber", ""),
            r.get("phone", ""),
            r.get("email", ""),
        ])
    widths = [14, 16, 16, 22, 8, 12, 14, 14, 14, 14, 18, 14, 14, 22]
    for idx, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + idx)].width = w
    buf = BytesIO()
    wb.save(buf)
    body = buf.getvalue()
    filename = f"tourists-{trip_id or 'all'}.xlsx"
    headers_out = [
        ("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        ("Content-Length", str(len(body))),
        ("Content-Disposition", f'attachment; filename="{filename}"'),
    ]
    start_response("200 OK", headers_out)
    return [body]


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
        "company": normalize_company(payload.get("company")),
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


def fifa_committed_sales(sales):
    return [sale for sale in sales if normalize_text(sale.get("saleStatus")).lower() == "confirmed"]


def fifa_ticket_sales(sales, ticket_id, excluded_sale_id=None):
    return [
        sale
        for sale in fifa_committed_sales(sales)
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


def normalize_fifa_ticket_match_data(ticket):
    if not isinstance(ticket, dict):
        return ticket
    match_number = normalize_text(ticket.get("matchNumber")).lower()
    team_a = normalize_text(ticket.get("teamA")).upper()
    team_b = normalize_text(ticket.get("teamB")).upper()
    if match_number == "match 53" and team_a == "MEX" and team_b in {"FIFA", "CZECH", "CZECHIA", ""}:
        ticket = {**ticket, "teamB": "CZE"}
        current_label = normalize_text(ticket.get("matchLabel"))
        if not current_label or "FIFA" in current_label.upper():
            ticket["matchLabel"] = "MEX vs CZE"
    return ticket


def enrich_fifa_ticket(ticket, sales):
    ticket = normalize_fifa_ticket_match_data(ticket)
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
    price_per_ticket = max(parse_number(sale.get("pricePerTicket")), 0)
    discount_amount = max(parse_number(sale.get("discountAmount")), 0)
    block_total_price = sum(max(parse_number(block.get("totalPrice")), 0) for block in (sale.get("ticketBlocks") or []))
    total_price = max(parse_number(sale.get("totalPrice")) or max(block_total_price - discount_amount, 0) or (quantity * price_per_ticket), 0)
    amount_paid = max(parse_number(sale.get("amountPaid")), 0)
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
    committed_sales = fifa_committed_sales(sales)
    enriched_sales = [enrich_fifa_sale(sale, find_fifa_ticket(store, sale.get("ticketId")), store) for sale in sales]
    public_tickets = [ticket for ticket in enriched_tickets if ticket.get("publicVisible")]
    paid_sales = [sale for sale in active_sales if normalize_text(sale.get("paymentStatus")).lower() == "paid"]
    unpaid_sales = [sale for sale in active_sales if normalize_text(sale.get("paymentStatus")).lower() == "unpaid"]
    partial_sales = [sale for sale in active_sales if normalize_text(sale.get("paymentStatus")).lower() == "partial"]
    total_units = sum(max(parse_int(ticket.get("totalQuantity")), 0) for ticket in tickets)
    sold_units = sum(
        max(
            parse_int(sale.get("quantity"))
            or len([ticket_id for ticket_id in (sale.get("ticketIds") or []) if normalize_text(ticket_id)])
            or (1 if normalize_text(sale.get("ticketId")) else 0),
            0,
        )
        for sale in committed_sales
    )
    available_units = max(total_units - sold_units, 0)
    return {
        "tickets": {
            "total": len(tickets),
            "matches": len({normalize_text(ticket.get("matchNumber")) or normalize_text(ticket.get("matchLabel")) for ticket in tickets}),
            "public": len([ticket for ticket in tickets if normalize_text(ticket.get("visibility")).lower() == "public"]),
            "availableLots": len([ticket for ticket in enriched_tickets if ticket.get("availableQuantity", 0) > 0]),
            "soldOutLots": len([ticket for ticket in enriched_tickets if ticket.get("availableQuantity", 0) <= 0]),
            "availableUnits": available_units,
            "soldUnits": sold_units,
        },
        "sales": {
            "total": len(sales),
            "active": len(active_sales),
            "cancelled": len([sale for sale in sales if normalize_text(sale.get("saleStatus")).lower() == "cancelled"]),
            "paid": len(paid_sales),
            "partial": len(partial_sales),
            "unpaid": len(unpaid_sales),
            "revenue": sum(max(parse_number(sale.get("totalPrice")), 0) for sale in active_sales),
            "collected": sum(max(parse_number(sale.get("amountPaid")), 0) for sale in active_sales),
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
            "unitPrice": max(parse_number(block.get("unitPrice")), 0),
            "totalPrice": max(parse_number(block.get("totalPrice")), 0),
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
    block_total_price = sum(max(parse_number(block.get("totalPrice")), 0) for block in ticket_blocks)
    unique_unit_prices = {max(parse_number(block.get("unitPrice")), 0) for block in ticket_blocks if max(parse_number(block.get("unitPrice")), 0) > 0}
    price_per_ticket = max(parse_number(payload.get("pricePerTicket")), 0)
    if not price_per_ticket and len(unique_unit_prices) == 1:
        price_per_ticket = next(iter(unique_unit_prices))
    discount_amount = max(parse_number(payload.get("discountAmount")), 0)
    invoice_exchange_rate = max(parse_int(payload.get("invoiceExchangeRate")) or 3600, 1)
    invoice_bank_account = normalize_text(payload.get("invoiceBankAccount")) or "state"
    invoice_bank_account_other = normalize_text(payload.get("invoiceBankAccountOther"))
    invoice_schedule = []
    invoice_descriptions = [normalize_text(item) for item in (payload.get("invoiceDescriptions") or []) if normalize_text(item)]
    for row in payload.get("invoiceSchedule") or []:
        if not isinstance(row, dict):
            continue
        amount_mnt = max(parse_int(row.get("amountMnt")), 0)
        invoice_schedule.append(
            {
                "title": normalize_text(row.get("title")),
                "created": normalize_text(row.get("created")),
                "due": normalize_text(row.get("due")),
                "status": normalize_text(row.get("status")).lower() or "waiting",
                "amount": int(round(amount_mnt / invoice_exchange_rate)) if invoice_exchange_rate else 0,
                "amountMnt": amount_mnt,
                "bankAccount": normalize_text(row.get("bankAccount")) or "state",
                "bankAccountOther": normalize_text(row.get("bankAccountOther")),
            }
        )
    total_price = max(parse_number(payload.get("totalPrice")) or max(block_total_price - discount_amount, 0) or (quantity * price_per_ticket), 0)
    amount_paid_mnt = sum(
        max(parse_int(row.get("amountMnt")), 0)
        for row in invoice_schedule
        if normalize_text(row.get("status")).lower() == "paid"
    )
    amount_paid = max(int(round(amount_paid_mnt / invoice_exchange_rate)), 0)
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
        "invoiceBankAccountOther": invoice_bank_account_other,
        "invoiceDescriptions": invoice_descriptions,
        "invoiceSchedule": invoice_schedule,
        "totalPrice": total_price,
        "amountPaid": amount_paid,
        "paymentStatus": payment_status,
        "paymentMethod": normalize_text(payload.get("paymentMethod")),
        "saleStatus": (
            "confirmed"
            if normalize_text(payload.get("saleStatus")).lower() == "active"
            else normalize_text(payload.get("saleStatus")).lower() or "pending"
        ),
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
        if any(max(parse_number(block.get("unitPrice")), 0) <= 0 for block in ticket_blocks):
            return "Each match block must have a valid price per ticket"
        if any(max(parse_number(block.get("totalPrice")), 0) <= 0 for block in ticket_blocks):
            return "Each match block must have a valid total price"
        if sum(max(parse_number(block.get("totalPrice")), 0) for block in ticket_blocks) <= 0:
            return "Total price must be greater than 0"
    if sale.get("paymentStatus") not in {"unpaid", "partial", "paid", "refunded"}:
        return "Payment status is invalid"
    if sale.get("saleStatus") not in {"pending", "confirmed", "cancelled", "active"}:
        return "Sale status is invalid"
    if sale.get("invoiceBankAccount") not in {"state", "golomt", "lkham-erdene", "azjargal", "bayaraa", "azaa", "lkhamaa", "other"}:
        return "Invoice bank account is invalid"
    for row in sale.get("invoiceSchedule") or []:
        if normalize_text(row.get("status")).lower() not in {"paid", "waiting", "overdue"}:
            return "Invoice schedule status is invalid"
        if normalize_text(row.get("bankAccount")) and normalize_text(row.get("bankAccount")) not in {"state", "golomt", "lkham-erdene", "azjargal", "bayaraa", "azaa", "lkhamaa", "other"}:
            return "Invoice schedule bank account is invalid"
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


MANAGER_ITEM_LABELS = {
    "tasks": ("task", "Task"),
    "contacts": ("contact", "Contact"),
    "reminders": ("reminder", "Reminder"),
}


def _manager_item_title(record, key):
    if key == "tasks":
        return normalize_text(record.get("title")) or "Untitled task"
    if key == "contacts":
        return normalize_text(record.get("name")) or "Untitled contact"
    return normalize_text(record.get("title")) or normalize_text(record.get("name")) or "Item"


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
    try:
        singular, label = MANAGER_ITEM_LABELS.get(key, (response_label, response_label.title()))
        log_notification(
            f"{singular}.created",
            actor,
            f"New {singular} added",
            detail=_manager_item_title(record, key),
            meta={"id": record.get("id"), "key": key},
        )
    except Exception:
        pass
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
    try:
        singular, _ = MANAGER_ITEM_LABELS.get(key, (response_label, response_label.title()))
        if key == "tasks" and normalize_text(record.get("status")) == "done":
            log_notification(
                "task.completed",
                actor,
                "Task completed",
                detail=_manager_item_title(record, key),
                meta={"id": record.get("id"), "key": key},
            )
        else:
            log_notification(
                f"{singular}.updated",
                actor,
                f"{singular.capitalize()} updated",
                detail=_manager_item_title(record, key),
                meta={"id": record.get("id"), "key": key},
            )
    except Exception:
        pass
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


def handle_list_ds160(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    return json_response(start_response, "200 OK", read_ds160_applications())


def handle_get_ds160(environ, start_response, record_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    record = find_ds160_record(record_id=record_id)
    if not record:
        return json_response(start_response, "404 Not Found", {"error": "DS-160 record not found"})
    return json_response(start_response, "200 OK", {"entry": record})


def handle_update_ds160(environ, start_response, record_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    records = read_ds160_applications()
    for index, record in enumerate(records):
        if record.get("id") != record_id:
            continue

        merged = {**record}
        for key in ["clientName", "clientEmail", "clientPhone", "managerName", "managerEmail", "managerPhone", "internalNotes", "appId", "appointmentDate", "appointmentTime", "status"]:
            if key in payload:
                value = normalize_text(payload.get(key))
                merged[key] = value.lower() if key in {"clientEmail", "managerEmail"} else value

        merged["status"] = normalize_ds160_status(merged.get("status"))
        merged["updatedAt"] = now_mongolia().isoformat()
        merged["updatedBy"] = actor_snapshot(actor)
        records[index] = normalize_ds160_record(merged)
        write_ds160_applications(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": records[index]})

    return json_response(start_response, "404 Not Found", {"error": "DS-160 record not found"})


def handle_delete_ds160(environ, start_response, record_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []

    records = read_ds160_applications()
    before = len(records)
    records = [record for record in records if record.get("id") != record_id]
    if len(records) == before:
        return json_response(start_response, "404 Not Found", {"error": "DS-160 record not found"})

    write_ds160_applications(records)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": record_id})


def handle_create_ds160_invitation(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_ds160_invitation(payload, actor)
    error = validate_ds160_invitation(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    host = environ.get("HTTP_HOST") or environ.get("SERVER_NAME") or "backoffice.travelx.mn"
    scheme = environ.get("HTTP_X_FORWARDED_PROTO") or environ.get("wsgi.url_scheme") or "https"
    record["shareUrl"] = f"{scheme}://{host}/ds160/form/{record['clientToken']}"

    records = read_ds160_applications()
    records.insert(0, record)
    write_ds160_applications(records)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


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


def handle_public_get_ds160(start_response, client_token):
    record = find_ds160_record(client_token=client_token)
    if not record:
        return json_response(start_response, "404 Not Found", {"error": "DS-160 form not found"})

    public_entry = {
        "id": record.get("id"),
        "clientToken": record.get("clientToken"),
        "status": record.get("status"),
        "clientName": record.get("clientName"),
        "clientEmail": record.get("clientEmail"),
        "clientPhone": record.get("clientPhone"),
        "managerName": record.get("managerName"),
        "internalNotes": record.get("internalNotes"),
        "submittedAt": record.get("submittedAt"),
        "payload": record.get("payload", {}),
        "officialFlowNote": record.get("officialFlowNote"),
    }
    return json_response(start_response, "200 OK", {"entry": public_entry})


def handle_public_submit_ds160(environ, start_response, client_token):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    records = read_ds160_applications()
    for index, record in enumerate(records):
        if record.get("clientToken") != client_token:
            continue
        cleaned_payload = clean_ds160_payload(payload)
        flattened = flatten_ds160_answers(cleaned_payload)
        error = validate_ds160_application(flattened)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})

        now_iso = datetime.now(timezone.utc).isoformat()
        merged = normalize_ds160_record(
            {
                **record,
                "status": "submitted",
                "updatedAt": now_iso,
                "submittedAt": now_iso,
                "payload": cleaned_payload,
                "clientName": record.get("clientName") or flattened.get("applicantName", ""),
                "clientEmail": record.get("clientEmail") or flattened.get("email", "").lower(),
                "clientPhone": record.get("clientPhone") or flattened.get("primaryPhone", ""),
            }
        )
        records[index] = merged
        write_ds160_applications(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged})

    return json_response(start_response, "404 Not Found", {"error": "DS-160 form not found"})


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


def handle_list_camp_reservations(environ, start_response):
    records = filter_by_company(read_camp_reservations(), environ)
    return json_response(start_response, "200 OK", {"entries": records, "summary": camp_summary(records)})


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
        if enriched.get("publicVisible"):
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


def handle_list_camp_trips(environ, start_response):
    trips = filter_by_company(read_camp_trips(), environ)
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

    payload["company"] = active_workspace(environ) or DEFAULT_COMPANY
    record = build_camp_trip(payload, actor)
    error = validate_camp_trip(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    trips = read_camp_trips()
    trips.insert(0, record)
    write_camp_trips(trips)
    try:
        log_notification(
            "trip.created",
            actor,
            "New trip created",
            detail=record.get("tripName") or record.get("reservationName") or "",
            meta={"id": record.get("id")},
        )
    except Exception:
        pass
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
        for key in ["tripName", "reservationName", "startDate", "endDate", "language", "status", "guideName", "driverName", "cookName", "groupName"]:
            if key in payload:
                merged[key] = normalize_text(payload.get(key))
        for key in ["participantCount", "staffCount", "totalDays"]:
            if key in payload:
                merged[key] = parse_int(payload.get(key))
        if "tags" in payload:
            merged["tags"] = normalize_tag_list(payload.get("tags"))
        if "tripType" in payload:
            tt = normalize_text(payload.get("tripType")).lower()
            if tt in {"fit", "git"}:
                merged["tripType"] = tt
        error = validate_camp_trip(merged)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})
        merged["updatedAt"] = now_mongolia().isoformat()
        merged["updatedBy"] = actor_snapshot(actor)
        trips[index] = merged
        write_camp_trips(trips)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged})
    return json_response(start_response, "404 Not Found", {"error": "Trip not found"})


def parse_multipart(environ):
    content_type = environ.get("CONTENT_TYPE", "")
    if "multipart/form-data" not in content_type:
        return {}, {}
    boundary = None
    for segment in content_type.split(";"):
        segment = segment.strip()
        if segment.startswith("boundary="):
            boundary = segment[9:].strip().strip('"')
            break
    if not boundary:
        return {}, {}
    try:
        content_length = int(environ.get("CONTENT_LENGTH") or "0")
    except ValueError:
        return {}, {}
    body = environ["wsgi.input"].read(content_length)
    fields, files = {}, {}
    sep = ("--" + boundary).encode()
    for part in body.split(sep)[1:]:
        if part.startswith(b"--"):
            break
        if part.startswith(b"\r\n"):
            part = part[2:]
        split_pos = part.find(b"\r\n\r\n")
        if split_pos == -1:
            continue
        raw_headers = part[:split_pos].decode("utf-8", errors="replace")
        raw_body = part[split_pos + 4:]
        if raw_body.endswith(b"\r\n"):
            raw_body = raw_body[:-2]
        headers = {}
        for line in raw_headers.split("\r\n"):
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        disposition = headers.get("content-disposition", "")
        name = filename = None
        for token in disposition.split(";"):
            token = token.strip()
            if token.startswith("name="):
                name = token[5:].strip().strip('"')
            elif token.startswith("filename="):
                filename = token[9:].strip().strip('"')
        if name is None:
            continue
        if filename is not None:
            files[name] = {
                "filename": filename,
                "content_type": headers.get("content-type", "application/octet-stream"),
                "data": raw_body,
            }
        else:
            fields[name] = raw_body.decode("utf-8", errors="replace")
    return fields, files


def handle_upload_trip_document(environ, start_response, trip_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    trips = read_camp_trips()
    trip_index = next((i for i, t in enumerate(trips) if t["id"] == trip_id), None)
    if trip_index is None:
        return json_response(start_response, "404 Not Found", {"error": "Trip not found"})
    fields, files = parse_multipart(environ)
    if "file" not in files:
        return json_response(start_response, "400 Bad Request", {"error": "No file provided"})
    upload = files["file"]
    original_name = upload["filename"] or "file"
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        return json_response(start_response, "400 Bad Request", {"error": f"File type {ext} not allowed"})
    data = upload["data"]
    if len(data) > MAX_UPLOAD_BYTES:
        return json_response(start_response, "400 Bad Request", {"error": "File too large (max 10 MB)"})
    category = fields.get("category", "Other") or "Other"
    tourist_id = (fields.get("touristId") or "").strip()
    tourist_name = ""
    if tourist_id:
        t = next((x for x in read_tourists() if x.get("id") == tourist_id), None)
        if t:
            tourist_name = (
                (t.get("lastName") or "") + " " + (t.get("firstName") or "")
            ).strip()
    ensure_data_store()
    doc_id = str(uuid4())
    trip_upload_dir = TRIP_UPLOADS_DIR / trip_id
    trip_upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = doc_id + ext
    file_path = trip_upload_dir / stored_name
    file_path.write_bytes(data)
    doc = {
        "id": doc_id,
        "originalName": original_name,
        "storedName": stored_name,
        "mimeType": upload["content_type"],
        "size": len(data),
        "category": category,
        "touristId": tourist_id,
        "touristName": tourist_name,
        "uploadedAt": now_mongolia().isoformat(),
        "uploadedBy": actor_snapshot(actor),
    }
    trip = trips[trip_index]
    documents = list(trip.get("documents") or [])
    documents.append(doc)
    trips[trip_index] = {**trip, "documents": documents}
    write_camp_trips(trips)
    return json_response(start_response, "201 Created", {"ok": True, "document": doc})


def handle_delete_trip_document(environ, start_response, trip_id, doc_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    trips = read_camp_trips()
    trip_index = next((i for i, t in enumerate(trips) if t["id"] == trip_id), None)
    if trip_index is None:
        return json_response(start_response, "404 Not Found", {"error": "Trip not found"})
    trip = trips[trip_index]
    documents = list(trip.get("documents") or [])
    doc = next((d for d in documents if d["id"] == doc_id), None)
    if doc is None:
        return json_response(start_response, "404 Not Found", {"error": "Document not found"})
    file_path = (TRIP_UPLOADS_DIR / trip_id / doc["storedName"]).resolve()
    if str(file_path).startswith(str(TRIP_UPLOADS_DIR.resolve())) and file_path.exists():
        file_path.unlink()
    trips[trip_index] = {**trip, "documents": [d for d in documents if d["id"] != doc_id]}
    write_camp_trips(trips)
    return json_response(start_response, "200 OK", {"ok": True, "deletedId": doc_id})


def handle_email_trip_documents(environ, start_response, trip_id):
    """POST /api/camp-trips/{tripId}/documents/email — admin selects files and
    sends them to a client with a Mongolian boilerplate body. Reuses
    _tool_send_email so the auto-disclaimer footer + signature stay consistent."""
    actor = require_login(environ, start_response)
    if not actor:
        return []
    try:
        body = environ["wsgi.input"].read(int(environ.get("CONTENT_LENGTH") or "0"))
        data = json.loads(body)
    except Exception:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid JSON"})
    recipient = (data.get("recipientEmail") or "").strip()
    recipient_name = (data.get("recipientName") or "").strip()
    workspace = (data.get("workspace") or "").strip().upper()
    doc_ids = data.get("docIds") or []
    if not recipient or "@" not in recipient:
        return json_response(start_response, "400 Bad Request", {"error": "recipientEmail is required"})
    if not isinstance(doc_ids, list) or not doc_ids:
        return json_response(start_response, "400 Bad Request", {"error": "docIds (non-empty list) is required"})

    trip = next((t for t in read_camp_trips() if t.get("id") == trip_id), None)
    if not trip:
        return json_response(start_response, "404 Not Found", {"error": "Trip not found"})

    docs_by_id = {d.get("id"): d for d in (trip.get("documents") or [])}
    selected = [docs_by_id[i] for i in doc_ids if i in docs_by_id]
    if not selected:
        return json_response(start_response, "400 Bad Request", {"error": "no matching documents on this trip"})

    company_name = "Unlock Steppe Mongolia" if workspace == "USM" else "Дэлхий Трэвел Икс"
    greet = "Сайн байна уу" + (f", {recipient_name}" if recipient_name else "") + ","
    body_text = (
        f"{greet}\n\n"
        "Танд аяллын баримт бичгүүдийг хавсаргаж илгээж байна. "
        "Та хавсралтуудыг хүлээн авч, шаардлагатай бол хадгалаад авна уу."
    )
    subject = f"Аяллын баримт бичгүүд - {company_name}"
    attachments = [{"kind": "trip_document", "tripId": trip_id, "id": d["id"]} for d in selected]
    result = _tool_send_email({
        "to": recipient,
        "subject": subject,
        "body": body_text,
        "attachments": attachments,
        "_company_name": company_name,
    }, actor)

    if result.get("error"):
        return json_response(start_response, "500 Internal Server Error", {"error": result["error"]})
    return json_response(start_response, "200 OK", {
        "ok": True,
        "messageId": result.get("messageId"),
        "sent": len(attachments),
        "warnings": result.get("warnings"),
    })


def handle_rename_trip_document(environ, start_response, trip_id, doc_id):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    trips = read_camp_trips()
    trip_index = next((i for i, t in enumerate(trips) if t["id"] == trip_id), None)
    if trip_index is None:
        return json_response(start_response, "404 Not Found", {"error": "Trip not found"})
    trip = trips[trip_index]
    documents = list(trip.get("documents") or [])
    doc_index = next((i for i, d in enumerate(documents) if d["id"] == doc_id), None)
    if doc_index is None:
        return json_response(start_response, "404 Not Found", {"error": "Document not found"})
    try:
        body = environ["wsgi.input"].read(int(environ.get("CONTENT_LENGTH") or "0"))
        data = json.loads(body)
    except Exception:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid JSON"})
    updates = {}
    if "name" in data:
        new_name = (data.get("name") or "").strip()
        if not new_name:
            return json_response(start_response, "400 Bad Request", {"error": "Name cannot be empty"})
        updates["originalName"] = new_name
    if "touristId" in data:
        tourist_id = (data.get("touristId") or "").strip()
        tourist_name = ""
        if tourist_id:
            t = next((x for x in read_tourists() if x.get("id") == tourist_id), None)
            if t:
                tourist_name = (
                    (t.get("lastName") or "") + " " + (t.get("firstName") or "")
                ).strip()
        updates["touristId"] = tourist_id
        updates["touristName"] = tourist_name
    if not updates:
        return json_response(start_response, "400 Bad Request", {"error": "No fields to update"})
    documents[doc_index] = {**documents[doc_index], **updates}
    trips[trip_index] = {**trip, "documents": documents}
    write_camp_trips(trips)
    return json_response(start_response, "200 OK", {"ok": True, "document": documents[doc_index]})


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

    payload["company"] = active_workspace(environ) or DEFAULT_COMPANY
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
    try:
        log_notification(
            "camp_reservation.created",
            actor,
            "Camp reservation created",
            detail=record.get("reservationName") or record.get("tripName") or "",
            meta={"id": record.get("id"), "tripId": record.get("tripId")},
        )
    except Exception:
        pass
    return json_response(start_response, "201 Created", {"ok": True, "entry": record, "summary": camp_summary(records)})


def handle_create_flight_reservation(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    payload["company"] = active_workspace(environ) or DEFAULT_COMPANY
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
    try:
        log_notification(
            "flight_reservation.created",
            actor,
            "Flight reservation created",
            detail=f"{record.get('fromCity','')} → {record.get('toCity','')}".strip(" →"),
            meta={"id": record.get("id"), "tripId": record.get("tripId")},
        )
    except Exception:
        pass
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


def handle_create_transfer_reservation(environ, start_response):
    actor = require_login(environ, start_response)
    if not actor:
        return []
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    payload["company"] = active_workspace(environ) or DEFAULT_COMPANY
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
    try:
        log_notification(
            "transfer_reservation.created",
            actor,
            "Transfer reservation created",
            detail=record.get("reservationName") or record.get("tripName") or "",
            meta={"id": record.get("id"), "tripId": record.get("tripId")},
        )
    except Exception:
        pass
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


def handle_list_flight_reservations(environ, start_response):
    return json_response(start_response, "200 OK", {"entries": filter_by_company(read_flight_reservations(), environ)})


def handle_list_transfer_reservations(environ, start_response):
    return json_response(start_response, "200 OK", {"entries": filter_by_company(read_transfer_reservations(), environ)})


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
        "fromCity": normalize_text(payload.get("fromCity")),
        "toCity": normalize_text(payload.get("toCity")),
        "departureDate": normalize_text(payload.get("departureDate")),
        "departureTime": normalize_text(payload.get("departureTime")),
        "arrivalDate": normalize_text(payload.get("arrivalDate")),
        "arrivalTime": normalize_text(payload.get("arrivalTime")),
        "staffCount": parse_int(payload.get("staffCount")),
        "ticketPrice": parse_int(payload.get("ticketPrice")),
        "totalTicketPrice": parse_int(payload.get("totalTicketPrice") or payload.get("amount")),
        "requested": normalize_text(payload.get("requested")).lower() or "no",
        "touristTicketStatus": normalize_text(payload.get("touristTicketStatus") or payload.get("status")).lower() or "waiting_list",
        "guideTicketStatus": normalize_text(payload.get("guideTicketStatus") or payload.get("guideStatus")).lower() or "waiting_list",
        "paidTo": normalize_text(payload.get("paidTo")),
        "paidDate": normalize_text(payload.get("paidDate")),
        "bookingReference": normalize_text(payload.get("bookingReference")),
        "ticketNumber": normalize_text(payload.get("ticketNumber")),
        "passengerCount": parse_int(payload.get("passengerCount")),
        "status": normalize_text(payload.get("status")).lower() or "to_check",
        "boughtDate": normalize_text(payload.get("boughtDate")),
        "paymentStatus": normalize_text(payload.get("paymentStatus")).lower() or "unpaid",
        "amount": parse_int(payload.get("totalTicketPrice") or payload.get("amount")),
        "currency": "MNT",
        "notes": normalize_text(payload.get("notes")),
        "company": normalize_company(payload.get("company")),
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


def validate_flight_reservation(data):
    required = ["tripId", "tripName", "fromCity", "toCity", "departureDate", "touristTicketStatus", "guideTicketStatus", "paymentStatus"]
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
        "company": normalize_company(payload.get("company")),
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
            "fromCity",
            "toCity",
            "departureDate",
            "departureTime",
            "arrivalDate",
            "arrivalTime",
            "requested",
            "touristTicketStatus",
            "guideTicketStatus",
            "paidTo",
            "paidDate",
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
        for key in ["passengerCount", "staffCount", "ticketPrice", "totalTicketPrice", "amount"]:
            if key in payload:
                target_key = "totalTicketPrice" if key in {"totalTicketPrice", "amount"} else key
                merged[target_key] = parse_int(payload.get(key))
        merged["amount"] = parse_int(merged.get("totalTicketPrice"))
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


def build_invoice_from_contract(contract, actor):
    """Create a standalone invoice record mirroring a freshly-saved contract.
    Skipped (returns None) if the contract has no trip+group attached, since
    invoices require both. Items mirror the contract line items where possible,
    otherwise fall back to a single line for the total. Two installments
    (deposit / balance) are created from the contract's deposit/balance fields.
    """
    trip_id = (contract.get("tripId") or "").strip()
    group_id = (contract.get("groupId") or "").strip()
    if not trip_id:
        return None
    # FIT trips usually create contracts without an explicit groupId.
    # Fall back to the trip's first existing group; if none exist yet,
    # create a default group named after the trip so the invoice can attach.
    if not group_id:
        groups = [g for g in read_tourist_groups() if g.get("tripId") == trip_id]
        if groups:
            group_id = groups[0]["id"]
        else:
            trip = find_camp_trip(trip_id)
            if trip:
                default = build_tourist_group({
                    "tripId": trip_id,
                    "name": trip.get("tripName") or "Default group",
                    "headcount": trip.get("participantCount") or 0,
                }, actor)
                groups_all = read_tourist_groups()
                groups_all.append(default)
                write_tourist_groups(groups_all)
                group_id = default["id"]
        if not group_id:
            return None

    data = contract.get("data") or {}
    payer = f"{normalize_text(data.get('touristLastName'))} {normalize_text(data.get('touristFirstName'))}".strip()
    if not payer:
        payer = normalize_text(data.get("clientName")) or "Client"

    def _num(v):
        try:
            return float(str(v).replace(",", "").replace("₮", "").strip() or 0)
        except Exception:
            return 0.0

    # Build line items from per-category counts/prices on the contract.
    raw_items = []
    cats = [
        ("adultCount", "adultPrice", "Том хүн"),
        ("childCount", "childPrice", "Хүүхэд"),
        ("infantCount", "infantPrice", "Нярай"),
        ("ticketOnlyCount", "ticketOnlyPrice", "Зөвхөн билет"),
        ("landOnlyCount", "landOnlyPrice", "Газрын үйлчилгээ"),
        ("customCount", "customPrice", "Бусад"),
    ]
    for count_key, price_key, default_label in cats:
        qty = _num(data.get(count_key))
        price = _num(data.get(price_key))
        if qty <= 0 or price <= 0:
            continue
        label = default_label
        if count_key == "customCount":
            label = normalize_text(data.get("customPriceLabel")) or default_label
        raw_items.append({
            "description": label,
            "qty": qty,
            "price": price,
            "total": round(qty * price, 2),
        })

    total = round(sum(it["total"] for it in raw_items), 2)
    if not raw_items:
        # Fallback: a single line with the contract total.
        total = _num(data.get("totalPrice"))
        if total <= 0:
            return None
        raw_items.append({
            "description": normalize_text(data.get("destination")) or "Trip",
            "qty": 1,
            "price": total,
            "total": total,
        })

    deposit = _num(data.get("depositAmount"))
    balance = _num(data.get("balanceAmount"))
    if balance <= 0 and deposit > 0:
        balance = max(total - deposit, 0)
    contract_date = normalize_text(data.get("contractDate")) or now_mongolia().date().isoformat()
    deposit_due = normalize_text(data.get("depositDueDate")) or contract_date
    balance_due = normalize_text(data.get("balanceDueDate")) or ""

    installments = []
    if deposit > 0:
        installments.append({
            "description": "Урьдчилгаа",
            "amount": deposit,
            "issueDate": contract_date,
            "dueDate": deposit_due,
            "status": "pending",
        })
    if balance > 0:
        installments.append({
            "description": "Аяллын үлдэгдэл",
            "amount": balance,
            "issueDate": contract_date,
            "dueDate": balance_due,
            "status": "pending",
        })
    if not installments:
        installments.append({
            "description": "Бүрэн төлбөр",
            "amount": total,
            "issueDate": contract_date,
            "dueDate": balance_due or contract_date,
            "status": "pending",
        })

    trip_for_serial = find_camp_trip(trip_id) if trip_id else None
    return {
        "id": str(uuid4()),
        "serial": next_invoice_serial((trip_for_serial or {}).get("company")),
        "tripId": trip_id,
        "groupId": group_id,
        "payerId": "",
        "payerName": payer,
        "participantIds": [],
        "items": raw_items,
        "total": total,
        "installments": installments,
        "currency": "MNT",
        "status": "draft",
        "contractId": contract.get("id"),
        "createdAt": now_mongolia().isoformat(),
        "createdBy": actor_snapshot(actor),
        "updatedAt": "",
        "updatedBy": actor_snapshot(actor),
    }


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
        attached_trip = normalize_text(payload.get("attachedTripId"))
        attached_group = normalize_text(payload.get("attachedGroupId"))
        if attached_trip:
            record["tripId"] = attached_trip
        if attached_group:
            record["groupId"] = attached_group
        contracts.insert(0, record)
        write_contracts(contracts)
        try:
            log_notification(
                "contract.created",
                actor,
                "New contract generated",
                detail=record.get("clientName") or record.get("contractNumber") or "",
                meta={"id": record.get("id")},
            )
        except Exception:
            pass
        # Auto-create a corresponding invoice when the contract is attached to a trip+group.
        try:
            auto_inv = build_invoice_from_contract(record, actor)
            if auto_inv:
                inv_list = read_invoices()
                inv_list.insert(0, auto_inv)
                write_invoices(inv_list)
                record["autoInvoiceId"] = auto_inv["id"]
                # Persist the link back on the contract.
                contracts[0] = record
                write_contracts(contracts)
        except Exception as exc:
            print(f"[contract->invoice] auto-create failed: {exc}")
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
    client_email = normalize_text(payload.get("clientEmail"))
    emergency_name = normalize_text(payload.get("emergencyContactName"))
    emergency_phone = normalize_text(payload.get("emergencyContactPhone"))
    emergency_relation = normalize_text(payload.get("emergencyContactRelation"))
    accepted = bool(payload.get("accepted"))
    if not accepted:
        return json_response(start_response, "400 Bad Request", {"error": "Agreement not accepted"})
    if not client_phone or not client_email or not emergency_name or not emergency_phone or not emergency_relation:
        return json_response(start_response, "400 Bad Request", {"error": "Missing client contact information"})
    if "@" not in client_email or "." not in client_email.split("@")[-1]:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid email address"})

    contracts = read_contracts()
    for idx, contract in enumerate(contracts):
        if contract.get("id") == contract_id:
            signature_path = save_signature_image(signature_data, contract_id)
            if not signature_path:
                return json_response(start_response, "400 Bad Request", {"error": "Invalid signature"})
            data = contract.get("data") or {}
            data["clientPhone"] = client_phone
            data["clientEmail"] = client_email
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
            email_sent = _send_signed_contract_email(contract)
            return json_response(start_response, "200 OK", {"ok": True, "contract": contract, "emailSent": email_sent})
    return json_response(start_response, "404 Not Found", {"error": "Contract not found"})


def _send_signed_contract_email(contract):
    """Auto-send after a client signs. Two separate emails:
      1. Friendly confirmation to the client (with auto-disclaimer footer).
      2. Internal notification to info@travelx.mn with full client/contract
         details, no "do not reply" footer (it's self-referential).
    Both carry the contract PDF + invoice PDF as attachments. Failures are
    logged and swallowed — a Resend outage must not break the signing flow."""
    try:
        data = contract.get("data") or {}
        client_email = (data.get("clientEmail") or "").strip()
        if not client_email:
            return False
        serial = data.get("contractSerial") or contract.get("id")
        invoice_id = (contract.get("autoInvoiceId") or "").strip()
        attachments = [{"kind": "contract", "id": contract.get("id")}]
        invoice_serial = None
        if invoice_id:
            attachments.append({"kind": "invoice", "id": invoice_id})
            inv = next((i for i in read_invoices() if i.get("id") == invoice_id), None)
            invoice_serial = inv.get("serial") if inv else None
        client_name = " ".join(filter(None, [data.get("touristLastName"), data.get("touristFirstName")])) or "—"
        client_phone = data.get("clientPhone") or "—"
        destination = data.get("destination") or "—"
        signed_iso = contract.get("signedAt") or ""
        try:
            signed_dt = datetime.fromisoformat(signed_iso.replace("Z", "+00:00")) if signed_iso else None
            signed_str = signed_dt.astimezone(MONGOLIA_TZ).strftime("%Y-%m-%d %H:%M") if signed_dt else "—"
        except Exception:
            signed_str = signed_iso[:16] if signed_iso else "—"

        # Email 1 — to the client
        client_lines = [
            "Сайн байна уу,",
            "",
            "Гэрээ амжилттай байгууллаа. Хавсаргав:",
            f"- Гэрээ {serial}",
        ]
        if invoice_serial:
            client_lines.append(f"- Нэхэмжлэх {invoice_serial}")
        elif invoice_id:
            client_lines.append("- Нэхэмжлэх")
        client_lines += ["", "Баярлалаа"]
        client_args = {
            "to": [client_email],
            "subject": f"Travelx — Гэрээ {serial}",
            "body": "\n".join(client_lines),
            "attachments": attachments,
        }
        client_result = _tool_send_email(client_args, None)

        # Email 2 — to info@travelx.mn (internal notification, no auto-footer)
        internal_lines = [
            "Үйлчлүүлэгч гэрээнд гарын үсэг зурлаа.",
            "",
            f"Гэрээ: {serial}",
            f"Үйлчлүүлэгч: {client_name}",
            f"Утас: {client_phone}",
            f"Имэйл: {client_email}",
            f"Аяллын чиглэл: {destination}",
            f"Гарын үсэг зурсан: {signed_str}",
            "",
            f"Гэрээ болон нэхэмжлэхийг {client_email} хаяг руу автоматаар илгээлээ.",
        ]
        internal_args = {
            "to": ["info@travelx.mn"],
            "subject": f"Шинэ гарын үсэг — Гэрээ {serial} — {client_name}",
            "body": "\n".join(internal_lines),
            "attachments": attachments,
            "_skip_footer": True,
        }
        internal_result = _tool_send_email(internal_args, None)

        ok = bool(client_result.get("ok"))
        print(
            f"[auto-email] sign-confirmation contract={contract.get('id')} "
            f"client_ok={client_result.get('ok')} internal_ok={internal_result.get('ok')} "
            f"client_result={client_result} internal_result={internal_result}",
            flush=True,
        )
        return ok
    except Exception as exc:
        print(f"[auto-email] sign-confirmation crashed: {type(exc).__name__}: {exc}", flush=True)
        return False


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

        items_payload = payload.get("items")
        payments_payload = payload.get("payments")
        if not isinstance(items_payload, list):
            return json_response(start_response, "400 Bad Request", {"error": "Items payload is invalid"})
        if not isinstance(payments_payload, list):
            return json_response(start_response, "400 Bad Request", {"error": "Payments payload is invalid"})

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

        normalized_payments = []
        for payment in payments_payload:
            if not isinstance(payment, dict):
                continue
            title = normalize_text(payment.get("title"))
            amount = parse_int(payment.get("amount"))
            if not title or amount <= 0:
                continue
            status = normalize_invoice_status(payment.get("status"))
            normalized_payments.append(
                {
                    "key": normalize_text(payment.get("key")) or f"payment-{len(normalized_payments) + 1}",
                    "title": title,
                    "created": normalize_text(payment.get("created")),
                    "secondaryLabel": normalize_text(payment.get("secondaryLabel")) or "Эцсийн хугацаа",
                    "secondaryValue": normalize_text(payment.get("secondaryValue")),
                    "status": status,
                    "amount": amount,
                }
            )
        if not normalized_payments:
            return json_response(start_response, "400 Bad Request", {"error": "At least one payment row is required"})

        invoice_meta = contract.get("invoiceMeta") if isinstance(contract.get("invoiceMeta"), dict) else {}
        invoice_meta["lineItems"] = normalized_items
        invoice_meta["payments"] = {"rows": normalized_payments}
        invoice_meta["bankAccountKey"] = normalize_invoice_bank_account(
            payload.get("bankAccountKey"),
            fallback=normalize_invoice_bank_account(invoice_meta.get("bankAccountKey")),
        )
        contract["invoiceMeta"] = invoice_meta
        contract["updatedBy"] = actor_snapshot(actor)
        contract["updatedAt"] = datetime.now(timezone.utc).isoformat()
        contracts[idx] = contract
        write_contracts(contracts)
        return json_response(start_response, "200 OK", {"ok": True, "contract": contract})

    return json_response(start_response, "404 Not Found", {"error": "Contract not found"})


# ════════════════════════════════════════════════════════════════════
#  AGENT  (admin-only Claude assistant with tool use over the API)
# ════════════════════════════════════════════════════════════════════

AGENT_CONVERSATIONS_FILE = DATA_DIR / "agent_conversations.json"
AGENT_AUDIT_FILE = DATA_DIR / "agent_audit.json"
AGENT_MEMORY_FILE = DATA_DIR / "agent_memory.json"
AGENT_MODEL = os.environ.get("AGENT_MODEL", "claude-sonnet-4-5-20250929")
AGENT_MAX_TOKENS = 2048  # smaller responses → faster round trips, fewer timeouts
AGENT_MAX_TOOL_LOOPS = 6  # fits comfortably inside Render proxy budget; the agent should split big asks instead
AGENT_HISTORY_TURNS = 8  # smaller history → faster requests, fewer 502s
AGENT_MAX_IMAGES_PER_MESSAGE = 5
AGENT_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # Anthropic per-image limit


def _agent_load_memories():
    if not AGENT_MEMORY_FILE.exists():
        return []
    try:
        data = json.loads(AGENT_MEMORY_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _agent_save_memories(records):
    AGENT_MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    AGENT_MEMORY_FILE.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def _agent_load_conversations():
    if not AGENT_CONVERSATIONS_FILE.exists():
        return {}
    try:
        return json.loads(AGENT_CONVERSATIONS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _agent_save_conversations(data):
    AGENT_CONVERSATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    AGENT_CONVERSATIONS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _agent_audit(user, tool_name, tool_input, ok, output_summary):
    AGENT_AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing = json.loads(AGENT_AUDIT_FILE.read_text(encoding="utf-8")) if AGENT_AUDIT_FILE.exists() else []
    except Exception:
        existing = []
    existing.append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "user": (user or {}).get("email") or (user or {}).get("id") or "?",
        "tool": tool_name,
        "input": tool_input,
        "ok": ok,
        "summary": str(output_summary)[:400],
    })
    # Keep last 2000 entries.
    if len(existing) > 2000:
        existing = existing[-2000:]
    AGENT_AUDIT_FILE.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Tool implementations (thin wrappers over read_/write_/build_) ─────

def _tool_list_trips(args, actor):
    trips = read_camp_trips()
    ws = (args.get("workspace") or args.get("company") or "").upper().strip()
    status = (args.get("status") or "").lower().strip()
    trip_type = (args.get("tripType") or "").lower().strip()
    if ws:
        trips = [t for t in trips if normalize_company(t.get("company")) == ws]
    if status:
        trips = [t for t in trips if (t.get("status") or "").lower() == status]
    if trip_type:
        trips = [t for t in trips if (t.get("tripType") or "").lower() == trip_type]
    items = [{"id": t["id"], "serial": t.get("serial"), "tripName": t.get("tripName"),
              "tripType": t.get("tripType"), "startDate": t.get("startDate"),
              "endDate": t.get("endDate"), "status": t.get("status"),
              "participantCount": t.get("participantCount"), "company": t.get("company")}
             for t in trips]
    return {"count": len(items), "items": items}


def _tool_get_trip(args, actor):
    trip_id = args.get("tripId") or ""
    trip = next((t for t in read_camp_trips() if t.get("id") == trip_id), None)
    return trip or {"error": "Trip not found"}


def _tool_create_trip(args, actor):
    payload = dict(args)
    ws = (payload.get("workspace") or payload.get("company") or "").upper().strip()
    if ws not in ("DTX", "USM"):
        return {"error": "workspace is required and must be 'DTX' (outbound — any non-Mongolia destination) or 'USM' (inbound — inside Mongolia only)."}
    payload["company"] = ws
    payload.pop("workspace", None)
    record = build_camp_trip(payload, actor)
    err = validate_camp_trip(record)
    if err:
        return {"error": err}
    trips = read_camp_trips()
    trips.insert(0, record)
    write_camp_trips(trips)
    return {"ok": True, "trip": {"id": record["id"], "serial": record.get("serial"), "tripName": record.get("tripName")}}


def _tool_update_trip(args, actor):
    trip_id = args.get("tripId") or ""
    fields = args.get("fields") or {}
    trips = read_camp_trips()
    for i, t in enumerate(trips):
        if t.get("id") != trip_id:
            continue
        t.update({k: v for k, v in fields.items() if k != "id"})
        t["updatedAt"] = now_mongolia().isoformat()
        t["updatedBy"] = actor_snapshot(actor)
        trips[i] = t
        write_camp_trips(trips)
        return {"ok": True, "trip": {"id": t["id"], "serial": t.get("serial"), "tripName": t.get("tripName"), "status": t.get("status")}}
    return {"error": "Trip not found"}


def _tool_delete_trip(args, actor):
    trip_id = args.get("tripId") or ""
    trips = read_camp_trips()
    new = [t for t in trips if t.get("id") != trip_id]
    if len(new) == len(trips):
        return {"error": "Trip not found"}
    write_camp_trips(new)
    return {"ok": True}


def _tool_list_groups(args, actor):
    groups = read_tourist_groups()
    trip_id = (args.get("tripId") or "").strip()
    if trip_id:
        groups = [g for g in groups if g.get("tripId") == trip_id]
    return [{"id": g["id"], "serial": g.get("serial"), "name": g.get("name"),
             "tripId": g.get("tripId"), "headcount": g.get("headcount"),
             "status": g.get("status"), "leaderName": g.get("leaderName")}
            for g in groups]


def _tool_create_group(args, actor):
    record = build_tourist_group(dict(args), actor)
    err = validate_tourist_group(record)
    if err:
        return {"error": err}
    groups = read_tourist_groups()
    groups.append(record)
    write_tourist_groups(groups)
    return {"ok": True, "group": {"id": record["id"], "serial": record.get("serial"), "name": record.get("name")}}


def _tool_update_group(args, actor):
    gid = args.get("groupId") or ""
    fields = args.get("fields") or {}
    groups = read_tourist_groups()
    for i, g in enumerate(groups):
        if g.get("id") != gid:
            continue
        g.update({k: v for k, v in fields.items() if k != "id"})
        g["updatedAt"] = now_mongolia().isoformat()
        g["updatedBy"] = actor_snapshot(actor)
        groups[i] = g
        write_tourist_groups(groups)
        return {"ok": True, "group": g}
    return {"error": "Group not found"}


def _tool_delete_group(args, actor):
    gid = args.get("groupId") or ""
    groups = read_tourist_groups()
    new = [g for g in groups if g.get("id") != gid]
    if len(new) == len(groups):
        return {"error": "Group not found"}
    write_tourist_groups(new)
    return {"ok": True}


def _tool_list_tourists(args, actor):
    tourists = read_tourists()
    trip_id = (args.get("tripId") or "").strip()
    group_id = (args.get("groupId") or "").strip()
    if trip_id:
        tourists = [t for t in tourists if t.get("tripId") == trip_id]
    if group_id:
        tourists = [t for t in tourists if t.get("groupId") == group_id]
    return [{"id": t["id"], "serial": t.get("serial"),
             "lastName": t.get("lastName"), "firstName": t.get("firstName"),
             "passportNumber": t.get("passportNumber"), "phone": t.get("phone"),
             "groupId": t.get("groupId"), "tripId": t.get("tripId"),
             "roomType": t.get("roomType"), "roomCode": t.get("roomCode")}
            for t in tourists]


def _tool_create_tourist(args, actor):
    record = build_tourist(dict(args), actor)
    err = validate_tourist(record)
    if err:
        return {"error": err}
    tourists = read_tourists()
    tourists.append(record)
    write_tourists(tourists)
    return {"ok": True, "tourist": {"id": record["id"], "serial": record.get("serial"),
                                     "lastName": record.get("lastName"), "firstName": record.get("firstName")}}


def _tool_update_tourist(args, actor):
    tid = args.get("touristId") or ""
    fields = args.get("fields") or {}
    tourists = read_tourists()
    for i, t in enumerate(tourists):
        if t.get("id") != tid:
            continue
        t.update({k: v for k, v in fields.items() if k != "id"})
        t["updatedAt"] = now_mongolia().isoformat()
        t["updatedBy"] = actor_snapshot(actor)
        tourists[i] = t
        write_tourists(tourists)
        return {"ok": True, "tourist": t}
    return {"error": "Tourist not found"}


def _tool_delete_tourist(args, actor):
    tid = args.get("touristId") or ""
    tourists = read_tourists()
    new = [t for t in tourists if t.get("id") != tid]
    if len(new) == len(tourists):
        return {"error": "Tourist not found"}
    write_tourists(new)
    return {"ok": True}


def _tool_list_invoices(args, actor):
    invoices = read_invoices()
    trip_id = (args.get("tripId") or "").strip()
    if trip_id:
        invoices = [i for i in invoices if i.get("tripId") == trip_id]
    return [{"id": i["id"], "serial": i.get("serial"), "tripId": i.get("tripId"),
             "groupId": i.get("groupId"), "payerName": i.get("payerName"),
             "total": i.get("total"), "status": i.get("status")}
            for i in invoices]


def _tool_get_invoice(args, actor):
    iid = args.get("invoiceId") or ""
    inv = next((i for i in read_invoices() if i.get("id") == iid), None)
    return inv or {"error": "Invoice not found"}


def _tool_create_invoice(args, actor):
    record = build_invoice(dict(args), actor)
    err = validate_invoice(record)
    if err:
        return {"error": err}
    invs = read_invoices()
    invs.insert(0, record)
    write_invoices(invs)
    return {"ok": True, "invoice": {"id": record["id"], "serial": record.get("serial"), "total": record.get("total")}}


def _tool_update_invoice(args, actor):
    iid = args.get("invoiceId") or ""
    fields = args.get("fields") or {}
    invs = read_invoices()
    for i, inv in enumerate(invs):
        if inv.get("id") != iid:
            continue
        inv.update({k: v for k, v in fields.items() if k != "id"})
        inv["updatedAt"] = now_mongolia().isoformat()
        inv["updatedBy"] = actor_snapshot(actor)
        invs[i] = inv
        write_invoices(invs)
        return {"ok": True, "invoice": inv}
    return {"error": "Invoice not found"}


def _tool_delete_invoice(args, actor):
    iid = args.get("invoiceId") or ""
    invs = read_invoices()
    new = [i for i in invs if i.get("id") != iid]
    if len(new) == len(invs):
        return {"error": "Invoice not found"}
    write_invoices(new)
    return {"ok": True}


def _tool_publish_invoice(args, actor):
    iid = args.get("invoiceId") or ""
    invs = read_invoices()
    for i, inv in enumerate(invs):
        if inv.get("id") != iid:
            continue
        inv["status"] = "published"
        inv["publishedAt"] = now_mongolia().isoformat()
        inv["updatedBy"] = actor_snapshot(actor)
        invs[i] = inv
        write_invoices(invs)
        return {"ok": True, "invoice": {"id": inv["id"], "status": inv["status"]}}
    return {"error": "Invoice not found"}


def _tool_register_invoice_payment(args, actor):
    iid = args.get("invoiceId") or ""
    idx = int(args.get("installmentIndex") or 0)
    paid = args.get("paidDate") or now_mongolia().date().isoformat()
    invs = read_invoices()
    for i, inv in enumerate(invs):
        if inv.get("id") != iid:
            continue
        installments = inv.get("installments") or []
        if idx < 0 or idx >= len(installments):
            return {"error": "installmentIndex out of range"}
        installments[idx]["status"] = "paid"
        installments[idx]["paidDate"] = paid
        inv["installments"] = installments
        inv["updatedBy"] = actor_snapshot(actor)
        invs[i] = inv
        write_invoices(invs)
        return {"ok": True, "installment": installments[idx]}
    return {"error": "Invoice not found"}


def _tool_list_contracts(args, actor):
    cs = read_contracts()
    trip_id = (args.get("tripId") or "").strip()
    if trip_id:
        cs = [c for c in cs if c.get("tripId") == trip_id]
    return [{"id": c["id"], "tripId": c.get("tripId"), "groupId": c.get("groupId"),
             "status": c.get("status"), "contractSerial": (c.get("data") or {}).get("contractSerial"),
             "tourist": ((c.get("data") or {}).get("touristLastName") or "") + " " + ((c.get("data") or {}).get("touristFirstName") or "")}
            for c in cs]


def _tool_delete_contract(args, actor):
    cid = args.get("contractId") or ""
    cs = read_contracts()
    new = [c for c in cs if c.get("id") != cid]
    if len(new) == len(cs):
        return {"error": "Contract not found"}
    write_contracts(new)
    return {"ok": True}


def _tool_list_camp_reservations(args, actor):
    rs = read_camp_reservations()
    trip_id = (args.get("tripId") or "").strip()
    if trip_id:
        rs = [r for r in rs if r.get("tripId") == trip_id]
    return rs


def _tool_list_flight_reservations(args, actor):
    rs = read_flight_reservations()
    trip_id = (args.get("tripId") or "").strip()
    if trip_id:
        rs = [r for r in rs if r.get("tripId") == trip_id]
    return rs


def _tool_list_transfer_reservations(args, actor):
    rs = read_transfer_reservations()
    trip_id = (args.get("tripId") or "").strip()
    if trip_id:
        rs = [r for r in rs if r.get("tripId") == trip_id]
    return rs


def _tool_list_users(args, actor):
    return [{"id": u.get("id"), "email": u.get("email"), "fullName": u.get("fullName"),
             "role": u.get("role"), "status": u.get("status")} for u in read_users()]


def _tool_list_ds160(args, actor):
    return [{"id": a.get("id"), "email": a.get("email"), "status": a.get("status"),
             "createdAt": a.get("createdAt")} for a in read_ds160_applications()]


def _tool_list_notifications(args, actor):
    return read_notifications()[-50:]


def _tool_list_fifa_inventory(args, actor):
    store = read_fifa2026_store()
    tickets = store.get("tickets") if isinstance(store, dict) else None
    return tickets[:200] if isinstance(tickets, list) else (tickets or [])


def _tool_get_contract(args, actor):
    cid = (args.get("contractId") or "").strip()
    if not cid:
        return {"error": "contractId is required"}
    contract = next((c for c in read_contracts() if c.get("id") == cid), None)
    if not contract:
        return {"error": "Contract not found"}
    data = contract.get("data") or {}
    return {
        "id": contract.get("id"),
        "contractSerial": data.get("contractSerial"),
        "tripId": contract.get("tripId"),
        "groupId": contract.get("groupId"),
        "destination": data.get("destination"),
        "tripStartDate": data.get("tripStartDate"),
        "tripEndDate": data.get("tripEndDate"),
        "touristLastName": data.get("touristLastName"),
        "touristFirstName": data.get("touristFirstName"),
        "adultCount": data.get("adultCount"),
        "adultPrice": data.get("adultPrice"),
        "childCount": data.get("childCount"),
        "childPrice": data.get("childPrice"),
        "totalPrice": data.get("totalPrice"),
        "depositAmount": data.get("depositAmount"),
        "depositDueDate": data.get("depositDueDate"),
        "balanceDueDate": data.get("balanceDueDate"),
        "autoInvoiceId": contract.get("autoInvoiceId"),
        "pdfPath": contract.get("pdfPath"),
    }


def _tool_create_contract(args, actor):
    payload = dict(args)

    # Auto-fill manager fields from the logged-in admin if not provided.
    if actor:
        payload.setdefault("managerLastName", actor.get("contractLastName") or "")
        payload.setdefault("managerFirstName",
                            actor.get("contractFirstName") or (actor.get("fullName") or "").split(" ")[0] or "Admin")
        payload.setdefault("managerPhone", actor.get("contractPhone") or "")
        payload.setdefault("managerEmail", actor.get("contractEmail") or actor.get("email") or "")

    # Auto-fill from trip.
    trip_id = payload.get("tripId") or payload.get("attachedTripId")
    if trip_id:
        trip = next((t for t in read_camp_trips() if t.get("id") == trip_id), None)
        if trip:
            payload.setdefault("destination", trip.get("tripName") or "")
            payload.setdefault("tripStartDate", trip.get("startDate") or "")
            payload.setdefault("tripEndDate", trip.get("endDate") or "")
            payload.setdefault("tripDuration", str(trip.get("totalDays") or ""))
            payload["attachedTripId"] = trip_id

    # Auto-fill from tourist.
    tid = payload.get("touristId")
    if tid:
        tourist = next((t for t in read_tourists() if t.get("id") == tid), None)
        if tourist:
            payload.setdefault("touristLastName", tourist.get("lastName") or "")
            payload.setdefault("touristFirstName", tourist.get("firstName") or "")
            payload.setdefault("touristRegister", tourist.get("registrationNumber") or tourist.get("passportNumber") or "")
            payload.setdefault("touristPhone", tourist.get("phone") or "")
            payload.setdefault("touristEmail", tourist.get("email") or "")

    gid = payload.get("groupId")
    if gid:
        payload["attachedGroupId"] = gid

    data = build_contract_data(payload)
    err = validate_contract_data(data)
    if err:
        return {"error": err}
    try:
        record = save_contract_files(data)
    except Exception as exc:
        return {"error": f"save_contract_files failed: {type(exc).__name__}: {exc}"}
    record["createdBy"] = actor_snapshot(actor)
    record["updatedBy"] = actor_snapshot(actor)
    if trip_id:
        record["tripId"] = trip_id
    if gid:
        record["groupId"] = gid
    contracts = read_contracts()
    contracts.insert(0, record)
    write_contracts(contracts)

    # Auto-create the matching invoice (mirrors handle_generate_contract).
    auto_invoice = None
    try:
        auto_inv = build_invoice_from_contract(record, actor)
        if auto_inv:
            inv_list = read_invoices()
            inv_list.insert(0, auto_inv)
            write_invoices(inv_list)
            record["autoInvoiceId"] = auto_inv["id"]
            contracts[0] = record
            write_contracts(contracts)
            auto_invoice = {"id": auto_inv["id"], "serial": auto_inv.get("serial")}
    except Exception as exc:
        print(f"[agent contract->invoice] auto-create failed: {exc}", file=sys.stderr, flush=True)

    return {"ok": True, "contract": {
        "id": record["id"],
        "contractSerial": (record.get("data") or {}).get("contractSerial"),
        "pdfPath": record.get("pdfPath") or "",
        "docxPath": record.get("docxPath") or "",
        "autoInvoice": auto_invoice,
    }}


def _strip_image_bytes_from_history(history):
    """Replace image / document content blocks with text placeholders so
    the conversation stays small after the first round-trip. Used between
    tool loops — after Claude has already read the image once, sending it
    again wastes proxy budget."""
    out = []
    for turn in history:
        content = turn.get("content")
        if isinstance(content, list):
            new_content = []
            for block in content:
                if isinstance(block, dict) and block.get("type") in ("image", "document"):
                    new_content.append({"type": "text", "text": "[image/file already read in earlier turn — see notes above]"})
                else:
                    new_content.append(block)
            out.append({**turn, "content": new_content})
        else:
            out.append(turn)
    return out


def _agent_save_uploaded_doc(raw_bytes, original_name, ext_hint):
    """Persist an arbitrary uploaded file to the generated dir and return public path."""
    if not raw_bytes:
        return ""
    safe_ext = re.sub(r"[^a-z0-9]", "", (ext_hint or "bin").lower())[:6] or "bin"
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    base = re.sub(r"[^A-Za-z0-9._-]", "_", original_name or "doc")[:40]
    filename = f"agent-doc-{uuid4().hex[:10]}-{base}"
    if not filename.lower().endswith("." + safe_ext):
        filename = f"{filename}.{safe_ext}"
    (GENERATED_DIR / filename).write_bytes(raw_bytes)
    return f"/generated/{filename}"


def _agent_extract_xlsx_text(raw_bytes):
    """Return a compact text dump of an xlsx file (first sheet, first 200 rows)."""
    try:
        from openpyxl import load_workbook
        from io import BytesIO
        wb = load_workbook(BytesIO(raw_bytes), read_only=True, data_only=True)
        out = []
        for ws in wb.worksheets[:3]:
            out.append(f"--- Sheet: {ws.title} ---")
            for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
                if row_idx >= 200:
                    out.append("(... rows truncated ...)")
                    break
                cells = ["" if v is None else str(v) for v in row]
                out.append("\t".join(cells)[:500])
        return "\n".join(out)[:15000]
    except Exception as exc:
        return f"(xlsx parse failed: {type(exc).__name__}: {exc})"


def _agent_save_uploaded_image(b64, media_type):
    """Persist a base64 image to the generated dir and return its public path."""
    if not b64:
        return ""
    ext_map = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
               "image/gif": "gif", "image/webp": "webp"}
    ext = ext_map.get((media_type or "").lower(), "jpg")
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return ""
    if not raw or len(raw) > AGENT_MAX_IMAGE_BYTES:
        return ""
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"agent-upload-{uuid4().hex[:12]}.{ext}"
    (GENERATED_DIR / filename).write_bytes(raw)
    return f"/generated/{filename}"


def _agent_resolve_attachment(att):
    """Translate {kind, id} or {kind, path} into (filename, bytes). Returns
    (None, error_message) on failure."""
    if not isinstance(att, dict):
        return None, "attachment must be an object"
    kind = (att.get("kind") or "").lower().strip()

    if kind == "file":
        rel = (att.get("path") or "").strip()
        if not rel.startswith("/generated/"):
            return None, "file path must start with /generated/"
        p = GENERATED_DIR / rel.replace("/generated/", "", 1)
        if not p.exists():
            return None, f"file not found: {rel}"
        return p.name, p.read_bytes()

    if kind == "invoice":
        iid = (att.get("id") or "").strip()
        inv = next((i for i in read_invoices() if i.get("id") == iid), None)
        if not inv:
            return None, f"invoice {iid} not found"
        try:
            pdf_url = save_standalone_invoice_pdf(inv)
        except Exception as exc:
            return None, f"invoice PDF render failed: {exc}"
        p = GENERATED_DIR / pdf_url.replace("/generated/", "", 1)
        return f"invoice-{inv.get('serial') or iid}.pdf", p.read_bytes()

    if kind == "contract":
        cid = (att.get("id") or "").strip()
        contracts = read_contracts()
        contract = None
        contract_index = None
        for idx, c in enumerate(contracts):
            if c.get("id") == cid:
                contract = c
                contract_index = idx
                break
        if not contract:
            return None, f"contract {cid} not found"
        # Always attach as PDF. Render on demand if not already saved (or if the
        # saved pdfPath points at the html fallback / a missing file). DOCX is
        # never used as the email attachment — clients expect PDFs.
        rel = contract.get("pdfPath") or ""
        p = GENERATED_DIR / rel.replace("/generated/", "", 1) if rel.startswith("/generated/") else None
        if not (rel.endswith(".pdf") and p and p.exists()):
            try:
                rel = save_contract_pdf(contract)
            except Exception as exc:
                return None, f"contract PDF render failed: {exc}"
            contract["pdfPath"] = rel
            if contract_index is not None:
                contracts[contract_index] = contract
                write_contracts(contracts)
            p = GENERATED_DIR / rel.replace("/generated/", "", 1)
        serial = (contract.get("data") or {}).get("contractSerial") or cid
        return f"contract-{serial}.pdf", p.read_bytes()

    if kind == "tourist_passport":
        tid = (att.get("id") or "").strip()
        tourist = next((t for t in read_tourists() if t.get("id") == tid), None)
        if not tourist:
            return None, f"tourist {tid} not found"
        rel = tourist.get("passportScanPath") or ""
        if not rel.startswith("/generated/"):
            return None, "tourist has no saved passport scan"
        p = GENERATED_DIR / rel.replace("/generated/", "", 1)
        if not p.exists():
            return None, f"passport file not found on disk: {rel}"
        name = ((tourist.get("lastName") or "") + "-" + (tourist.get("firstName") or "")).strip("-") or tid
        return f"passport-{name}{p.suffix}", p.read_bytes()

    if kind == "trip_document":
        trip_id = (att.get("tripId") or "").strip()
        doc_id = (att.get("id") or "").strip()
        if not trip_id or not doc_id:
            return None, "trip_document needs tripId and id"
        trip = next((t for t in read_camp_trips() if t.get("id") == trip_id), None)
        if not trip:
            return None, f"trip {trip_id} not found"
        doc = next((d for d in (trip.get("documents") or []) if d.get("id") == doc_id), None)
        if not doc:
            return None, f"document {doc_id} not found in trip {trip_id}"
        fp = (TRIP_UPLOADS_DIR / trip_id / (doc.get("storedName") or "")).resolve()
        if not str(fp).startswith(str(TRIP_UPLOADS_DIR.resolve())) or not fp.exists():
            return None, "document file missing on disk"
        return doc.get("originalName") or fp.name, fp.read_bytes()

    return None, f"unknown attachment kind: {kind}"


def _tool_send_email(args, actor):
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        return {"error": "Email is not configured. Sign up at resend.com (free, 100 emails/day) and add RESEND_API_KEY to Render → Environment."}
    sender = os.environ.get("EMAIL_FROM", "").strip() or "Travelx <onboarding@resend.dev>"
    # Per-call friendly-name override: when the caller passes _company_name
    # (DTX or USM workspace), the inbox shows "Дэлхий Трэвел Икс" /
    # "Unlock Steppe Mongolia" as the sender name even though the underlying
    # address (e.g. noreply@travelx.mn) doesn't change.
    company_name_override = (args.get("_company_name") or "").strip()
    if company_name_override:
        m = re.search(r"<([^>]+)>", sender)
        addr = m.group(1) if m else sender
        sender = f"{company_name_override} <{addr}>"
    to_raw = args.get("to") or ""
    if isinstance(to_raw, str):
        to_list = [x.strip() for x in to_raw.replace(";", ",").split(",") if x.strip()]
    elif isinstance(to_raw, list):
        to_list = [str(x).strip() for x in to_raw if str(x).strip()]
    else:
        to_list = []
    if not to_list:
        return {"error": "to (recipient email) is required"}

    subject = (args.get("subject") or "").strip() or "Travelx документ"
    body = args.get("body") or ""
    # Treat plain newlines as <br> so the email renders as the agent intended.
    body_html = "<p>" + html.escape(body).replace("\n\n", "</p><p>").replace("\n", "<br>") + "</p>"
    # Auto-appended footer: small gray italic disclaimer + signature. Server-owned
    # so Bataa can't forget it and styling stays consistent across all sends.
    # Internal callers can pass _skip_footer=True (e.g. when emailing info@travelx.mn
    # itself, where the "contact info@travelx.mn" line would be self-referential).
    if not args.get("_skip_footer"):
        company_name = (args.get("_company_name") or "").strip() or "Дэлхий Трэвел Икс"
        body_html += (
            '<p style="color:#888;font-style:italic;font-size:12px;margin-top:20px">'
            'Энэ имэйл нь автомат илгээгдсэн тул буцааж хариу бичихгүй байхыг хүсье. '
            'Шаардлагатай бол <a href="mailto:info@travelx.mn" style="color:#888">info@travelx.mn</a> '
            'эсвэл <a href="tel:+97672007722" style="color:#888">72007722</a> дугаараар холбогдоорой.'
            '</p>'
            f'<p style="margin-top:8px">Хүндэтгэсэн,<br>{html.escape(company_name)}</p>'
        )

    raw_attachments = args.get("attachments") or []
    if not isinstance(raw_attachments, list):
        raw_attachments = []
    if len(raw_attachments) > 10:
        return {"error": "too many attachments (max 10 per email)"}

    api_attachments = []
    failed = []
    for att in raw_attachments:
        filename, payload = _agent_resolve_attachment(att)
        if filename is None:
            failed.append(payload)
            continue
        api_attachments.append({
            "filename": filename,
            "content": base64.b64encode(payload).decode("ascii"),
        })

    if failed and not api_attachments:
        return {"error": "All attachments failed: " + "; ".join(failed)}

    payload = {
        "from": sender,
        "to": to_list,
        "subject": subject,
        "html": body_html,
    }
    if api_attachments:
        payload["attachments"] = api_attachments

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Travelx-Bataa/1.0 (+https://www.backoffice.travelx.mn)",
            "Accept": "application/json",
        },
    )
    print(f"[send_email] from={sender!r} to={to_list!r} subject={subject!r} attachments={[a['filename'] for a in api_attachments]}", flush=True)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            err_body = str(e)
        print(f"[send_email] HTTPError {e.code} body={err_body!r}", flush=True)
        return {"error": f"Resend API error {e.code}: {err_body[:600]}"}
    except Exception as exc:
        print(f"[send_email] {type(exc).__name__}: {exc}", flush=True)
        return {"error": f"Email send failed: {type(exc).__name__}: {exc}"}

    return {
        "ok": True,
        "messageId": data.get("id"),
        "to": to_list,
        "attachments": [a["filename"] for a in api_attachments],
        "warnings": failed if failed else None,
    }


def _tool_attach_document_to_trip(args, actor):
    """Attach a previously-uploaded file (from /generated/agent-upload-...
    or /generated/agent-doc-...) to a trip's Documents section."""
    trip_id = (args.get("tripId") or "").strip()
    src_path = (args.get("filePath") or "").strip()
    category = (args.get("category") or "Other").strip() or "Other"
    rename_to = (args.get("name") or "").strip()
    if not trip_id:
        return {"error": "tripId is required"}
    if not src_path.startswith("/generated/"):
        return {"error": "filePath must be a /generated/... path returned in an [Uploaded ...] note"}
    src_file = GENERATED_DIR / src_path.replace("/generated/", "", 1)
    if not src_file.exists() or not src_file.is_file():
        return {"error": f"Source file not found: {src_path}"}

    trips = read_camp_trips()
    idx = next((i for i, t in enumerate(trips) if t.get("id") == trip_id), None)
    if idx is None:
        return {"error": "Trip not found"}

    doc_id = str(uuid4())
    ext = src_file.suffix.lower()
    original_name = rename_to or src_file.name
    if not original_name.lower().endswith(ext):
        original_name = original_name + ext
    trip_upload_dir = TRIP_UPLOADS_DIR / trip_id
    trip_upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = doc_id + ext
    dest = trip_upload_dir / stored_name
    dest.write_bytes(src_file.read_bytes())

    mime, _ = mimetypes.guess_type(src_file.name)
    doc = {
        "id": doc_id,
        "originalName": original_name,
        "storedName": stored_name,
        "mimeType": mime or "application/octet-stream",
        "size": dest.stat().st_size,
        "category": category,
        "uploadedAt": now_mongolia().isoformat(),
        "uploadedBy": actor_snapshot(actor),
    }
    trip = trips[idx]
    documents = list(trip.get("documents") or [])
    documents.append(doc)
    trips[idx] = {**trip, "documents": documents}
    write_camp_trips(trips)
    return {"ok": True, "document": {"id": doc_id, "originalName": original_name, "category": category}}


def _tool_attach_image_to_tourist(args, actor):
    tid = (args.get("touristId") or "").strip()
    image_path = (args.get("imagePath") or "").strip()
    field = (args.get("field") or "passport").strip().lower()
    if not tid:
        return {"error": "touristId is required"}
    if not image_path:
        return {"error": "imagePath is required (use a path returned in the [Uploaded image paths] note)"}
    if field not in ("passport", "photo"):
        return {"error": "field must be 'passport' or 'photo'"}
    target_field = "passportScanPath" if field == "passport" else "photoPath"
    tourists = read_tourists()
    for i, t in enumerate(tourists):
        if t.get("id") != tid:
            continue
        t[target_field] = image_path
        t["updatedAt"] = now_mongolia().isoformat()
        t["updatedBy"] = actor_snapshot(actor)
        tourists[i] = t
        write_tourists(tourists)
        return {"ok": True, "tourist": {"id": t["id"], "serial": t.get("serial"),
                                          "lastName": t.get("lastName"), "firstName": t.get("firstName"),
                                          target_field: image_path}}
    return {"error": "Tourist not found"}


def _tool_save_memory(args, actor):
    text = (args.get("text") or "").strip()
    if not text:
        return {"error": "text is required"}
    if len(text) > 1000:
        return {"error": "memory text too long (max 1000 chars)"}
    category = (args.get("category") or "general").strip().lower() or "general"
    mems = _agent_load_memories()
    record = {
        "id": str(uuid4()),
        "text": text,
        "category": category,
        "createdAt": now_mongolia().isoformat(),
        "createdBy": (actor or {}).get("email") or (actor or {}).get("id") or "admin",
    }
    mems.append(record)
    if len(mems) > 200:
        mems = mems[-200:]
    _agent_save_memories(mems)
    return {"ok": True, "memory": {"id": record["id"], "category": category, "text": text[:80]}}


def _tool_list_memories(args, actor):
    cat = (args.get("category") or "").strip().lower()
    mems = _agent_load_memories()
    if cat:
        mems = [m for m in mems if (m.get("category") or "") == cat]
    return mems


def _tool_delete_memory(args, actor):
    mid = (args.get("memoryId") or "").strip()
    if not mid:
        return {"error": "memoryId is required"}
    mems = _agent_load_memories()
    new = [m for m in mems if m.get("id") != mid]
    if len(new) == len(mems):
        return {"error": "Memory not found"}
    _agent_save_memories(new)
    return {"ok": True}


# ── Tool registry (Claude-facing JSON schemas) ────────────────────────

AGENT_TOOLS = [
    {"name": "list_trips", "description": "List trips. Optional filters: workspace (DTX or USM), status (planning, confirmed, travelling, completed, cancelled, offer), tripType (fit or git). Returns {count, items: [...]} — ALWAYS use the returned `count` field for any 'how many' answer; never count the items array yourself.",
     "input_schema": {"type": "object", "properties": {
         "workspace": {"type": "string"}, "status": {"type": "string"}, "tripType": {"type": "string"}}},
     "handler": _tool_list_trips},
    {"name": "get_trip", "description": "Get one trip by id.",
     "input_schema": {"type": "object", "required": ["tripId"], "properties": {"tripId": {"type": "string"}}},
     "handler": _tool_get_trip},
    {"name": "create_trip", "description": "Create a trip. workspace MUST be set explicitly: 'DTX' for any destination outside Mongolia (Solongos/Korea, Dubai, Japan, Turkey, Singapore, Russia, China, Europe, etc.) and 'USM' ONLY for trips inside Mongolia (Khustai, Gobi, Khuvsgul, Terelj, etc.). Never let workspace default. tripType is 'fit' or 'git'. Dates ISO yyyy-mm-dd.",
     "input_schema": {"type": "object", "required": ["tripName", "startDate", "tripType", "workspace"], "properties": {
         "workspace": {"type": "string", "enum": ["DTX", "USM"], "description": "DTX = outbound (any non-Mongolia destination); USM = inbound (inside Mongolia only). REQUIRED."},
         "tripName": {"type": "string"}, "tripType": {"type": "string", "enum": ["fit", "git"]},
         "startDate": {"type": "string"}, "endDate": {"type": "string"},
         "participantCount": {"type": "integer"}, "staffCount": {"type": "integer"},
         "totalDays": {"type": "integer"},
         "status": {"type": "string", "enum": ["offer", "planning", "confirmed", "travelling", "completed", "cancelled"]},
         "tags": {"type": "string"}}},
     "handler": _tool_create_trip},
    {"name": "update_trip", "description": "Update fields on an existing trip. Pass fields object with keys to change.",
     "input_schema": {"type": "object", "required": ["tripId", "fields"], "properties": {
         "tripId": {"type": "string"}, "fields": {"type": "object"}}},
     "handler": _tool_update_trip},
    {"name": "delete_trip", "description": "Delete a trip.",
     "input_schema": {"type": "object", "required": ["tripId"], "properties": {"tripId": {"type": "string"}}},
     "handler": _tool_delete_trip},

    {"name": "list_groups", "description": "List groups, optionally filtered by tripId.",
     "input_schema": {"type": "object", "properties": {"tripId": {"type": "string"}}},
     "handler": _tool_list_groups},
    {"name": "create_group", "description": "Create a tourist group on a trip.",
     "input_schema": {"type": "object", "required": ["tripId", "name"], "properties": {
         "tripId": {"type": "string"}, "name": {"type": "string"}, "headcount": {"type": "integer"},
         "leaderName": {"type": "string"}, "leaderEmail": {"type": "string"},
         "leaderPhone": {"type": "string"}, "leaderNationality": {"type": "string"},
         "status": {"type": "string", "enum": ["pending", "confirmed", "cancelled"]}}},
     "handler": _tool_create_group},
    {"name": "update_group", "description": "Update group fields.",
     "input_schema": {"type": "object", "required": ["groupId", "fields"], "properties": {
         "groupId": {"type": "string"}, "fields": {"type": "object"}}},
     "handler": _tool_update_group},
    {"name": "delete_group", "description": "Delete a group.",
     "input_schema": {"type": "object", "required": ["groupId"], "properties": {"groupId": {"type": "string"}}},
     "handler": _tool_delete_group},

    {"name": "list_tourists", "description": "List participants, optionally filtered by tripId or groupId.",
     "input_schema": {"type": "object", "properties": {"tripId": {"type": "string"}, "groupId": {"type": "string"}}},
     "handler": _tool_list_tourists},
    {"name": "create_tourist", "description": "Add a participant to a group.",
     "input_schema": {"type": "object", "required": ["tripId", "groupId", "lastName", "firstName"], "properties": {
         "tripId": {"type": "string"}, "groupId": {"type": "string"},
         "lastName": {"type": "string"}, "firstName": {"type": "string"},
         "gender": {"type": "string"}, "dob": {"type": "string"},
         "nationality": {"type": "string"}, "passportNumber": {"type": "string"},
         "passportIssueDate": {"type": "string"}, "passportExpiry": {"type": "string"},
         "passportIssuePlace": {"type": "string"}, "registrationNumber": {"type": "string"},
         "phone": {"type": "string"}, "email": {"type": "string"},
         "roomType": {"type": "string"}, "roomCode": {"type": "string"},
         "notes": {"type": "string"}}},
     "handler": _tool_create_tourist},
    {"name": "update_tourist", "description": "Update a participant.",
     "input_schema": {"type": "object", "required": ["touristId", "fields"], "properties": {
         "touristId": {"type": "string"}, "fields": {"type": "object"}}},
     "handler": _tool_update_tourist},
    {"name": "delete_tourist", "description": "Delete a participant.",
     "input_schema": {"type": "object", "required": ["touristId"], "properties": {"touristId": {"type": "string"}}},
     "handler": _tool_delete_tourist},

    {"name": "list_invoices", "description": "List invoices, optionally filtered by tripId.",
     "input_schema": {"type": "object", "properties": {"tripId": {"type": "string"}}},
     "handler": _tool_list_invoices},
    {"name": "get_invoice", "description": "Get one invoice by id.",
     "input_schema": {"type": "object", "required": ["invoiceId"], "properties": {"invoiceId": {"type": "string"}}},
     "handler": _tool_get_invoice},
    {"name": "create_invoice", "description": "Create an invoice. Items are [{description, qty, price}]. Installments are [{description, amount, issueDate, dueDate, status}].",
     "input_schema": {"type": "object", "required": ["tripId", "groupId", "payerName", "items"], "properties": {
         "tripId": {"type": "string"}, "groupId": {"type": "string"},
         "payerName": {"type": "string"}, "payerId": {"type": "string"},
         "participantIds": {"type": "array", "items": {"type": "string"}},
         "items": {"type": "array", "items": {"type": "object"}},
         "installments": {"type": "array", "items": {"type": "object"}},
         "currency": {"type": "string"}}},
     "handler": _tool_create_invoice},
    {"name": "update_invoice", "description": "Update invoice fields.",
     "input_schema": {"type": "object", "required": ["invoiceId", "fields"], "properties": {
         "invoiceId": {"type": "string"}, "fields": {"type": "object"}}},
     "handler": _tool_update_invoice},
    {"name": "delete_invoice", "description": "Delete an invoice.",
     "input_schema": {"type": "object", "required": ["invoiceId"], "properties": {"invoiceId": {"type": "string"}}},
     "handler": _tool_delete_invoice},
    {"name": "publish_invoice", "description": "Publish a draft invoice.",
     "input_schema": {"type": "object", "required": ["invoiceId"], "properties": {"invoiceId": {"type": "string"}}},
     "handler": _tool_publish_invoice},
    {"name": "register_invoice_payment", "description": "Mark an installment as paid.",
     "input_schema": {"type": "object", "required": ["invoiceId", "installmentIndex"], "properties": {
         "invoiceId": {"type": "string"}, "installmentIndex": {"type": "integer"},
         "paidDate": {"type": "string"}}},
     "handler": _tool_register_invoice_payment},

    {"name": "list_contracts", "description": "List contracts, optionally filtered by tripId.",
     "input_schema": {"type": "object", "properties": {"tripId": {"type": "string"}}},
     "handler": _tool_list_contracts},
    {"name": "delete_contract", "description": "Delete a contract.",
     "input_schema": {"type": "object", "required": ["contractId"], "properties": {"contractId": {"type": "string"}}},
     "handler": _tool_delete_contract},

    {"name": "list_camp_reservations", "description": "List camp reservations, optionally for a trip.",
     "input_schema": {"type": "object", "properties": {"tripId": {"type": "string"}}},
     "handler": _tool_list_camp_reservations},
    {"name": "list_flight_reservations", "description": "List flight reservations, optionally for a trip.",
     "input_schema": {"type": "object", "properties": {"tripId": {"type": "string"}}},
     "handler": _tool_list_flight_reservations},
    {"name": "list_transfer_reservations", "description": "List transfer reservations, optionally for a trip.",
     "input_schema": {"type": "object", "properties": {"tripId": {"type": "string"}}},
     "handler": _tool_list_transfer_reservations},

    {"name": "list_users", "description": "List back-office users.",
     "input_schema": {"type": "object", "properties": {}},
     "handler": _tool_list_users},
    {"name": "list_ds160_applications", "description": "List DS-160 applications.",
     "input_schema": {"type": "object", "properties": {}},
     "handler": _tool_list_ds160},
    {"name": "list_notifications", "description": "List recent notifications (last 50).",
     "input_schema": {"type": "object", "properties": {}},
     "handler": _tool_list_notifications},
    {"name": "list_fifa_inventory", "description": "List FIFA 2026 ticket inventory entries (first 200).",
     "input_schema": {"type": "object", "properties": {}},
     "handler": _tool_list_fifa_inventory},
    {"name": "save_memory", "description": "Save a long-term note that you (Батаа) should remember in every future conversation. Use this when the admin says 'remember that…', 'санаж аваач', or teaches you a business rule, naming convention, recurring price, or fact that is not obvious from the data. Categories: 'rule' for business rules, 'fact' for facts, 'preference' for stylistic preferences, 'general' otherwise. Keep text short and self-contained.",
     "input_schema": {"type": "object", "required": ["text"], "properties": {
         "text": {"type": "string", "description": "The note to remember (max 1000 chars)."},
         "category": {"type": "string", "description": "rule | fact | preference | general"}}},
     "handler": _tool_save_memory},
    {"name": "list_memories", "description": "List long-term notes saved via save_memory. Optional category filter.",
     "input_schema": {"type": "object", "properties": {"category": {"type": "string"}}},
     "handler": _tool_list_memories},
    {"name": "delete_memory", "description": "Delete a long-term note by id. Use when the admin says 'forget that' or 'мартчих'.",
     "input_schema": {"type": "object", "required": ["memoryId"], "properties": {"memoryId": {"type": "string"}}},
     "handler": _tool_delete_memory},
    {"name": "get_contract", "description": "Read back a contract by id. Use this AFTER create_contract to verify what was actually saved (totalPrice, adultCount, depositAmount, dates) before reporting success to the admin.",
     "input_schema": {"type": "object", "required": ["contractId"], "properties": {"contractId": {"type": "string"}}},
     "handler": _tool_get_contract},
    {"name": "create_contract", "description": "Create a tour contract (гэрээ) and automatically generate the matching invoice. Pass tripId and touristId so destination, dates, and tourist info auto-fill from the existing records — you only need to provide pricing fields and counts. Required pricing fields: adultCount, adultPrice (per-adult price), depositAmount, depositDueDate (yyyy-mm-dd), balanceDueDate (yyyy-mm-dd). Optional: childCount, childPrice, infantCount, infantPrice. The tool fills in destination/dates from the trip and tourist info from the tourist record. Returns {contract: {id, contractSerial, pdfPath, autoInvoice}}.",
     "input_schema": {"type": "object", "required": ["tripId", "touristId", "adultCount", "adultPrice", "depositAmount", "depositDueDate", "balanceDueDate"],
       "properties": {
         "tripId": {"type": "string"},
         "groupId": {"type": "string"},
         "touristId": {"type": "string"},
         "adultCount": {"type": "number"},
         "adultPrice": {"type": "number"},
         "childCount": {"type": "number"},
         "childPrice": {"type": "number"},
         "depositAmount": {"type": "number"},
         "depositDueDate": {"type": "string"},
         "balanceDueDate": {"type": "string"},
         "totalPrice": {"type": "number"},
         "destination": {"type": "string"},
         "tripStartDate": {"type": "string"},
         "tripEndDate": {"type": "string"}}},
     "handler": _tool_create_contract},
    {"name": "send_email", "description": "Send an email with attached files (contract PDF, invoice PDF, tourist passport scans, or arbitrary uploaded files). Requires RESEND_API_KEY env var. Attachments is an array of objects: {kind: 'invoice'|'contract'|'tourist_passport'|'file', id?: '<recordId>', path?: '/generated/...'}. Use kind='invoice' with the invoice id, kind='contract' with the contract id, kind='tourist_passport' with the tourist id, kind='file' with a /generated/... path.",
     "input_schema": {"type": "object", "required": ["to", "subject"], "properties": {
         "to": {"type": "string", "description": "Recipient email address(es), comma-separated for multiple"},
         "subject": {"type": "string"},
         "body": {"type": "string", "description": "Plain text body; newlines become line breaks"},
         "attachments": {"type": "array", "items": {"type": "object", "properties": {
             "kind": {"type": "string", "enum": ["invoice", "contract", "tourist_passport", "file"]},
             "id": {"type": "string"},
             "path": {"type": "string"}}}}}},
     "handler": _tool_send_email},
    {"name": "attach_document_to_trip", "description": "Attach a previously-uploaded file (image OR document) to a trip's Documents section. Use the /generated/... path from the [Uploaded image paths] or [Uploaded document paths] note. Categories: 'Passport', 'Visa', 'Ticket', 'Hotel voucher', 'Insurance', 'Itinerary', 'Other'. Optional `name` to rename for display.",
     "input_schema": {"type": "object", "required": ["tripId", "filePath"], "properties": {
         "tripId": {"type": "string"},
         "filePath": {"type": "string", "description": "/generated/agent-upload-XXX.jpg or /generated/agent-doc-XXX.pdf path from the upload note"},
         "category": {"type": "string"},
         "name": {"type": "string", "description": "Display filename (extension auto-added if missing)"}}},
     "handler": _tool_attach_document_to_trip},
    {"name": "attach_image_to_tourist", "description": "Attach an image (passport scan or portrait photo) to an existing tourist record. Use this AFTER the admin uploads an image in chat — every uploaded image is saved to disk and its path is given to you in a system note like '[Uploaded image paths] img-1=/generated/agent-upload-XXX.jpg'. Pass that path as imagePath. field='passport' fills passportScanPath; field='photo' fills photoPath.",
     "input_schema": {"type": "object", "required": ["touristId", "imagePath"], "properties": {
         "touristId": {"type": "string"},
         "imagePath": {"type": "string", "description": "Path returned in the [Uploaded image paths] note, e.g. /generated/agent-upload-abc123.jpg"},
         "field": {"type": "string", "description": "'passport' (default) or 'photo'"}}},
     "handler": _tool_attach_image_to_tourist},
]
AGENT_TOOL_BY_NAME = {t["name"]: t for t in AGENT_TOOLS}


def _agent_system_prompt(actor):
    name = (actor or {}).get("fullName") or (actor or {}).get("email") or "admin"
    today = now_mongolia().date().isoformat()
    memories = _agent_load_memories()
    if memories:
        mem_lines = "\n".join(
            f"- [{m.get('category', 'general')}] {m.get('text', '')}"
            for m in memories[-80:]
        )
        memory_block = (
            "\n\nLong-term memory (notes saved by the admin team — treat as authoritative business rules):\n"
            + mem_lines + "\n"
        )
    else:
        memory_block = ""
    return f"""You are "Батаа" (Bataa) — the in-app admin assistant for travelx.mn back-office. Today is {today}. You are talking to {name} (admin). Introduce yourself as Батаа when greeted; reply in Mongolian by default unless the user writes in another language.{memory_block}

Domain context:
- Two workspaces: DTX (Delkhii Travel Ix — outbound tours, Монгол хүн гадаад руу) and USM (Unlock Steppe Mongolia — inbound, гадаад жуулчин Монгол руу). Records carry a `company` field with value "DTX" or "USM"; tool inputs use `workspace` as a friendly synonym for the same thing.
- WORKSPACE INFERENCE (very important): if the destination is ANY country other than Mongolia (Dubai, Japan, Turkey, Singapore, Korea, China, Russia, etc.), this is a DTX trip. Only trips whose destination is inside Mongolia (Khustai, Gobi, Khuvsgul, Terelj, etc.) belong to USM. NEVER create a DTX-style trip in USM by mistake. If the user mentions "Dubai", "Japan", "Korea" etc. without naming a workspace, default to DTX.
- TRIP SERIAL PREFIXES: DTX trips use prefix "T-" (e.g., T-0007), USM trips use prefix "S-" (e.g., S-0007). When the admin asks about "T-0007", search DTX; "S-0007" → USM. Some legacy USM trips still carry T- prefix from before the change, so when an exact serial collides across workspaces ask the admin which workspace.
- LANGUAGE: when working in DTX (Mongolian outbound), reply in Mongolian. When working in USM (foreign inbound clients), generated documents (invoice descriptions, contract destinations) should be in English even though you speak Mongolian to the admin.
- Trip types: FIT (individual / family booking, usually no group needed) and GIT (group tour, has named group).
- Trip status values: planning, offer, confirmed, travelling, completed, cancelled. Lowercase only.
- Each trip can have groups, participants (tourists), camp/flight/transfer reservations, contracts, invoices, documents.
- Invoices have items + installments. Each item has fields description, qty, price; total = qty × price. Each installment has issueDate, dueDate, amount, status (pending/paid/overdue).
- IMPORTANT for invoices with multiple people: if the admin says "4 хүн × 2,500,000₮", create ONE item with qty=4 and price=2500000 (total auto-calculates to 10,000,000). Do NOT create one item with qty=1 and price=2500000.
- Mongolian-language naming is normal: payerName, descriptions, etc. may be in Mongolian.

Mongolian number words — read these EXACTLY, no rounding, no estimating:
- "сая" / "say" = 1,000,000 (million). "2 сая" / "2 say" / "2sayiig" / "2sayig" = 2,000,000 (NOT 20 million).
- "мянга" / "myanga" = 1,000 (thousand). "500 мянга" = 500,000.
- "тэрбум" / "terbum" / "tervum" = 1,000,000,000 (billion).
- When the admin gives a specific deposit/balance amount in words, USE THAT EXACT NUMBER. Do NOT recompute as a percentage of the total. Example: total 50,000,000₮, admin says "урьдчилгаа 2 сая" → depositAmount = 2,000,000, balance = 48,000,000. NEVER infer 20,000,000.
- After parsing any money figure, double-check: "2 сая" must equal 2,000,000 — verify the digit count before saving.

How you work:
- Use the provided tools to read and write the system. Don't make up data — call list_/get_ first when you need a fact.
- When the user asks about "DTX-н аяллууд" / "USM-н аяллууд" / "this workspace's X", always pass workspace="DTX" or "USM" to the list tool — never assume.
- Before destructive actions (delete_*, update_invoice fields wiping data, deleting trips/groups), briefly confirm with the user in your reply, then call the tool only if they assent.
- BE EFFICIENT: if the admin gave you a clear instruction (e.g. "Дубайд явах FIT аялал, 4 хүн × 2,500,000₮, гэрээ ба нэхэмжлэх хий"), execute the whole chain in this turn — do NOT ask for confirmation between create_trip → create_group → create_tourist → create_contract. Confirm the FINAL result, not each step.
- One short status sentence, then act. Avoid 3-paragraph plans before doing anything.
- After you do something, summarize the result in 1-2 sentences and include the relevant id/serial. Reply in Mongolian unless the user writes in another language.
- If a tool returns {{"error": ...}}, explain what went wrong and propose a fix. If a list returns 0 items, double-check by calling the same tool without filters before telling the user the data is empty — the filter may be wrong.
- For dates, use yyyy-mm-dd. For money, use plain numbers (no commas) when calling tools.
- DATE INFERENCE: when the admin gives only a month and day (e.g. "12 sariin 1-s 9", "11.01-11.08"), use the CURRENT year (today is shown above). If the resulting date is in the past relative to today, use NEXT year. NEVER use a year more than 1 year away from today. Example with today 2026-04-25: "12 сарын 1-9" → 2026-12-01 to 2026-12-09 (NOT 2016, NOT 2027). Verify the year is within ±1 of today before saving.
- Never invent IDs; only use ones returned by tools.

Counting:
- When a tool returns an object with a `count` field, that count is authoritative — never re-count the items array yourself, and never enumerate items just to get a number. Quote `count` directly.
- Do NOT infer that a serial is "missing" from gaps in returned data unless you have explicitly listed every record and confirmed the gap. Gaps in serial numbers are normal (e.g., a trip was deleted, or status filter excluded it) and do not affect the count.

Honesty (very important):
- Never make up data, IDs, names, prices, dates, or counts. If you don't have a tool for what was asked, say "Уучлаарай, надад тэр үйлдлийг хийх tool алга" (or in English: "I don't have a tool for that") and suggest the closest thing you CAN do.
- If a tool returns nothing or an error, say so plainly: "Олдсонгүй", "Алдаа гарлаа: ...". Do not invent placeholder data to fill the gap.
- If you are unsure (e.g., the user's question is ambiguous, or two records look like they could match), ask a clarifying question instead of guessing.
- Never claim a record exists, a price is X, or a status is Y unless that fact came back from a tool call you just made in this turn.
- It is far better to say "Би мэдэхгүй байна" or "Энэ функц одоогоор боломжгүй" than to give a confident wrong answer.

Verify-after-write (mandatory):
- After EVERY create_* or update_* call that involves money, counts, or dates, you MUST call the matching get_* (get_invoice, get_contract, get_trip) and quote the returned numbers verbatim in your reply. Do not summarize from memory — read the saved values back from the tool result.
- When the admin asks "did you do X correctly?" or "show me what you saved", call get_* first; never answer from your own recollection of what you intended to save.
- If the saved totals do not match what the admin asked for (e.g. admin said 4 × 2,500,000 = 10,000,000 but the saved invoice total is 4,000,000), say so explicitly: "Уучлаарай, би буруу үүсгэсэн байна. Жинхэнэ дүн: 4,000,000₮, таны хэлсэн дүн: 10,000,000₮. Засъя?" — then offer to update or delete-and-recreate. NEVER claim the wrong value is correct.

Long-term memory:
- Use save_memory whenever the admin teaches you something durable — a business rule, a recurring price, a naming convention, a person's role, a recurring instruction. Confirm in your reply (e.g., "Тэмдэглэн авлаа").
- Use list_memories when you want to recall what's been saved (the most recent ~80 are also injected into your system prompt automatically).
- Use delete_memory when the admin says forget / мартчих / устга.

Images and files:
- The admin can attach images (passport pages, contracts, ID photos, receipts), PDF documents, Excel spreadsheets, and plain-text files. Drag-and-drop into the chat works too.
- Images (jpg/png/gif/webp) are sent to you as vision blocks — read them carefully.
- PDF files are sent as document blocks — read every page.
- Excel (.xlsx) files are pre-extracted server-side and the table content is appended to the user message inside a "[Хавсаргасан Excel: filename]" block — use that text directly.
- Every uploaded image's saved path is given to you in a "[Uploaded image paths] img-1=/generated/...; img-2=..." note. Every uploaded document's saved path is in a "[Uploaded document paths] doc-1=/generated/...; doc-2=..." note. Use these exact paths when calling attach_image_to_tourist.
- Supported formats: JPG, PNG, GIF, WebP, PDF, XLSX, TXT/CSV/MD. HEIC/HEIF and Word .docx are NOT supported yet — if those are uploaded, ask the admin to convert (HEIC → JPG, DOCX → PDF) before retrying.
- For passports: read fields exactly as printed (Latin letters), then offer to create a tourist record via create_tourist with the extracted fields. After the tourist is created, ALSO call attach_image_to_tourist with arguments touristId=<the new tourist id>, imagePath=<the img-1 path from the upload note>, field="passport" so the passport scan is saved to the tourist's record. Mention "Паспортын зургийг хавсаргалаа" in the reply so the admin knows.
- For attaching files to a TRIP's Documents section (е.g., admin says "trip document hesegt upload hii", "энэ файлыг аяллын баримт бичигт нэм"), use attach_document_to_trip with the /generated/... path from the upload note and an appropriate category (Passport, Visa, Ticket, Hotel voucher, Insurance, Itinerary, Other).

Email:
- Use send_email when the admin asks to mail something ("mail-r yavuulj og", "имэйлээр илгээ", "send to client@example.com"). Requires RESEND_API_KEY in the env; if it's missing, send_email returns a clear error and you should pass that error to the admin verbatim.
- Attach files by reference. For each attachment pass an object with a `kind` field plus the right id/path: kind="invoice" with id=<invoice id>; kind="contract" with id=<contract id>; kind="tourist_passport" with id=<tourist id>; kind="file" with path="/generated/...". The server fetches and renders the right file — you do not need to know the underlying path.
- Default subject in Mongolian unless admin specified otherwise. Always confirm to the admin which addresses received the mail and which files were attached.
- If a field is unclear or partially obscured, say so rather than guessing.
- DO NOT write a closing signature ("Хүндэтгэсэн", "Дэлхий Трэвел Икс", "Travelx team", company name, contact info, "автомат имэйл" disclaimer, etc.) at the end of `body`. The server appends a fixed gray-italic disclaimer and the company signature automatically. Just write greeting → content → "Баярлалаа" (or similar short close), and stop.
"""


def _agent_call_anthropic(system, messages, tools):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return {"error": "ANTHROPIC_API_KEY is not set on the server. Add it in Render → Environment → ANTHROPIC_API_KEY."}
    url = "https://api.anthropic.com/v1/messages"
    body = {
        "model": AGENT_MODEL,
        "max_tokens": AGENT_MAX_TOKENS,
        "system": system,
        "messages": messages,
        "tools": [{"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]} for t in tools],
    }
    try:
        data = json.dumps(body).encode("utf-8")
    except Exception as e:
        print(f"[agent] payload serialization failed: {e}", file=sys.stderr, flush=True)
        return {"error": f"Could not serialize request: {e}"}
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            err_body = str(e)
        print(f"[agent] Anthropic HTTP {e.code}: {err_body[:1000]}", file=sys.stderr, flush=True)
        return {"error": f"Anthropic API error {e.code}: {err_body[:500]}"}
    except urllib.error.URLError as e:
        print(f"[agent] URLError: {e}", file=sys.stderr, flush=True)
        return {"error": f"Network error contacting Anthropic: {e}"}
    except Exception as e:
        print(f"[agent] {type(e).__name__}: {e}", file=sys.stderr, flush=True)
        return {"error": f"{type(e).__name__}: {e}"}


def handle_agent_chat(environ, start_response):
    try:
        return _handle_agent_chat_impl(environ, start_response)
    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        print(f"[agent] handler crashed: {tb}", file=sys.stderr, flush=True)
        return json_response(start_response, "500 Internal Server Error",
                             {"error": f"{type(exc).__name__}: {exc}"})


def _handle_agent_chat_impl(environ, start_response):
    actor = require_admin(environ, start_response)
    if not actor:
        return []

    method = environ["REQUEST_METHOD"]
    convs = _agent_load_conversations()
    user_key = actor.get("id") or actor.get("email") or "anon"
    history = convs.get(user_key, [])
    # Hard cap loaded history so a long-running conversation doesn't drag
    # every new request down with 80 stale turns.
    if len(history) > AGENT_HISTORY_TURNS * 2:
        history = history[-AGENT_HISTORY_TURNS * 2:]

    if method == "GET":
        # Return history (for hydrating the chat panel on page load).
        params = parse_qs(environ.get("QUERY_STRING", ""))
        if (params.get("history", [""])[0] or "").strip() == "1":
            return json_response(start_response, "200 OK", {"messages": history[-AGENT_HISTORY_TURNS * 2:]})
        return json_response(start_response, "200 OK", {"ok": True})

    if method == "DELETE":
        convs[user_key] = []
        _agent_save_conversations(convs)
        return json_response(start_response, "200 OK", {"ok": True, "messages": []})

    if method != "POST":
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    payload = collect_json(environ) or {}
    user_msg = (payload.get("message") or "").strip()
    raw_images = payload.get("images") or []
    if not isinstance(raw_images, list):
        raw_images = []
    raw_images = raw_images[:AGENT_MAX_IMAGES_PER_MESSAGE]
    raw_docs = payload.get("documents") or []
    if not isinstance(raw_docs, list):
        raw_docs = []
    raw_docs = raw_docs[:AGENT_MAX_IMAGES_PER_MESSAGE]

    image_blocks = []
    doc_blocks = []
    extra_text_blocks = []  # for xlsx/text content extracted server-side
    saved_paths = []  # public paths for images (so agent can attach them later)
    saved_doc_paths = []  # public paths for documents

    for img in raw_images:
        data_url = (img.get("dataUrl") or "") if isinstance(img, dict) else ""
        if not data_url.startswith("data:"):
            continue
        try:
            header, b64 = data_url.split(";base64,", 1)
        except ValueError:
            continue
        media_type = header.replace("data:", "", 1).strip().lower() or "image/jpeg"
        if media_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
            continue
        if len(b64) * 3 // 4 > AGENT_MAX_IMAGE_BYTES:
            continue
        image_blocks.append({
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": b64},
        })
        saved_paths.append(_agent_save_uploaded_image(b64, media_type))

    for doc in raw_docs:
        if not isinstance(doc, dict):
            continue
        data_url = doc.get("dataUrl") or ""
        name = (doc.get("name") or "").strip() or "document"
        if not data_url.startswith("data:"):
            continue
        try:
            header, b64 = data_url.split(";base64,", 1)
        except ValueError:
            continue
        media_type = header.replace("data:", "", 1).strip().lower()
        try:
            raw = base64.b64decode(b64)
        except Exception:
            continue
        if not raw or len(raw) > 30 * 1024 * 1024:  # 30 MB cap per document
            continue

        if media_type == "application/pdf" or name.lower().endswith(".pdf"):
            doc_blocks.append({
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
                "title": name[:120],
            })
            saved_doc_paths.append(_agent_save_uploaded_doc(raw, name, "pdf"))
        elif name.lower().endswith(".xlsx") or media_type in (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ):
            extracted = _agent_extract_xlsx_text(raw)
            extra_text_blocks.append(f"\n\n[Хавсаргасан Excel: {name}]\n{extracted}")
            saved_doc_paths.append(_agent_save_uploaded_doc(raw, name, "xlsx"))
        elif media_type.startswith("text/") or name.lower().endswith((".txt", ".csv", ".md")):
            try:
                txt = raw.decode("utf-8", errors="replace")[:20000]
            except Exception:
                txt = ""
            extra_text_blocks.append(f"\n\n[Хавсаргасан текст файл: {name}]\n{txt}")
            saved_doc_paths.append(_agent_save_uploaded_doc(raw, name, "txt"))
        else:
            # Unknown type — just save and tell agent the file name.
            ext = (name.rsplit(".", 1)[-1] if "." in name else "bin").lower()[:6]
            saved = _agent_save_uploaded_doc(raw, name, ext)
            saved_doc_paths.append(saved)
            extra_text_blocks.append(
                f"\n\n[Хавсаргасан файл: {name} — энэ форматыг шууд унших боломжгүй, зөвхөн файлын зам хадгалагдсан: {saved}]"
            )

    if not user_msg and not image_blocks and not doc_blocks and not extra_text_blocks:
        return json_response(start_response, "400 Bad Request", {"error": "Empty message"})

    # Build the user content blocks: images, then PDFs, then text. Always
    # include at least a text block so Claude has something to respond to.
    content_blocks = list(image_blocks) + list(doc_blocks)
    text_parts = [user_msg or "(файл хавсаргав — танилцана уу)"]
    upload_lines = [f"img-{i+1}={p}" for i, p in enumerate(saved_paths) if p]
    if upload_lines:
        text_parts.append("\n\n[Uploaded image paths] " + "; ".join(upload_lines))
    doc_lines = [f"doc-{i+1}={p}" for i, p in enumerate(saved_doc_paths) if p]
    if doc_lines:
        text_parts.append("\n\n[Uploaded document paths] " + "; ".join(doc_lines))
    text_parts.extend(extra_text_blocks)
    content_blocks.append({"type": "text", "text": "\n".join(text_parts)})
    history.append({"role": "user", "content": content_blocks})

    system = _agent_system_prompt(actor)
    actions = []  # human-readable summary of tool calls performed
    final_text = ""
    loops = 0

    import time
    loop_start = time.time()
    while loops < AGENT_MAX_TOOL_LOOPS:
        loops += 1
        # Strip image bytes from earlier turns before subsequent calls — Claude
        # has already extracted what it needs from the image in loop 1, and
        # re-uploading multi-MB base64 on every loop blows past Render's proxy
        # timeout. Keep the placeholder so the model knows an image was sent.
        if loops > 1:
            history = _strip_image_bytes_from_history(history)
        elapsed = time.time() - loop_start
        if elapsed > 80:
            print(f"[agent] aborting at loop {loops} after {elapsed:.1f}s to stay under proxy timeout", file=sys.stderr, flush=True)
            final_text = (final_text or "") + "\n\n⏱ Хэт удаан үргэлжиллээ. Үлдсэн алхмуудыг дараагийн мессежээр үргэлжлүүлээрэй."
            break
        t0 = time.time()
        resp = _agent_call_anthropic(system, history, AGENT_TOOLS)
        print(f"[agent] loop {loops} anthropic call took {time.time()-t0:.1f}s", file=sys.stderr, flush=True)
        if "error" in resp:
            history.pop()  # Don't persist the failed turn.
            return json_response(start_response, "502 Bad Gateway", {"error": resp["error"]})

        assistant_blocks = resp.get("content") or []
        # Append assistant turn to history (full content, including tool_use blocks).
        history.append({"role": "assistant", "content": assistant_blocks})

        tool_uses = [b for b in assistant_blocks if b.get("type") == "tool_use"]
        for b in assistant_blocks:
            if b.get("type") == "text" and b.get("text"):
                final_text += b["text"]

        if not tool_uses or resp.get("stop_reason") == "end_turn":
            break

        # Execute every tool_use, then feed the results back as a single user turn.
        results_blocks = []
        for tu in tool_uses:
            name = tu.get("name") or ""
            tool = AGENT_TOOL_BY_NAME.get(name)
            tool_input = tu.get("input") or {}
            if not tool:
                out = {"error": f"Unknown tool: {name}"}
                ok = False
            else:
                try:
                    out = tool["handler"](tool_input, actor)
                    ok = "error" not in (out if isinstance(out, dict) else {})
                except Exception as exc:
                    out = {"error": f"{type(exc).__name__}: {exc}"}
                    ok = False
            _agent_audit(actor, name, tool_input, ok, out if isinstance(out, (str, dict)) else "ok")
            actions.append({"tool": name, "ok": ok, "input": tool_input, "summary": _summarize_tool_output(name, out)})
            results_blocks.append({
                "type": "tool_result",
                "tool_use_id": tu.get("id"),
                "content": json.dumps(out, ensure_ascii=False)[:8000],
                "is_error": (not ok),
            })
        history.append({"role": "user", "content": results_blocks})

    # Trim history to keep it bounded but preserve assistant/tool pairs.
    if len(history) > AGENT_HISTORY_TURNS * 4:
        history = history[-AGENT_HISTORY_TURNS * 4:]
    # Strip base64 image bytes before persisting — keep a placeholder so the
    # assistant's later turns still know an image was attached, but don't bloat
    # the JSON file with megabytes of base64.
    persistable = []
    for turn in history:
        content = turn.get("content")
        if isinstance(content, list):
            new_content = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "image":
                    new_content.append({"type": "text", "text": "[image attached, omitted from history]"})
                else:
                    new_content.append(block)
            persistable.append({**turn, "content": new_content})
        else:
            persistable.append(turn)
    convs[user_key] = persistable
    _agent_save_conversations(convs)

    return json_response(start_response, "200 OK", {
        "ok": True,
        "reply": final_text or "(done)",
        "actions": actions,
    })


def _summarize_tool_output(name, out):
    if isinstance(out, dict):
        if "error" in out:
            return f"error: {out['error']}"
        if "count" in out:
            return f"{out['count']} item(s)"
        if "ok" in out:
            extras = []
            for k in ("trip", "group", "tourist", "invoice", "installment"):
                if k in out and isinstance(out[k], dict):
                    s = out[k].get("serial") or out[k].get("id") or ""
                    if s:
                        extras.append(f"{k}={s}")
            return "✓ " + (" ".join(extras) if extras else "done")
    if isinstance(out, list):
        return f"{len(out)} item(s)"
    return "done"


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

    if path == "/api/notifications":
        if method == "GET":
            return handle_list_notifications(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/notifications/read":
        if method == "POST":
            return handle_mark_notifications_read(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/agent/chat":
        if method in ("GET", "POST", "DELETE"):
            return handle_agent_chat(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/tourist-groups":
        if method == "GET":
            return handle_list_tourist_groups(environ, start_response)
        if method == "POST":
            return handle_create_tourist_group(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/tourist-groups/"):
        group_id = path.replace("/api/tourist-groups/", "", 1).strip("/")
        if method == "POST" and group_id:
            return handle_update_tourist_group(environ, start_response, group_id)
        if method == "DELETE" and group_id:
            return handle_delete_tourist_group(environ, start_response, group_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/tourists":
        if method == "GET":
            return handle_list_tourists(environ, start_response)
        if method == "POST":
            return handle_create_tourist(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/tourists/export":
        if method == "POST":
            return handle_export_tourists(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/tourists/promo-email":
        if method == "POST":
            return handle_promo_email(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/invoices":
        if method == "GET":
            return handle_list_invoices(environ, start_response)
        if method == "POST":
            return handle_create_invoice(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/documents":
        if method == "GET":
            return handle_list_documents(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/invoices/") and path.endswith("/publish"):
        invoice_id = path.replace("/api/invoices/", "", 1).replace("/publish", "", 1).strip("/")
        if method == "POST" and invoice_id:
            return handle_publish_invoice(environ, start_response, invoice_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/invoices/") and path.endswith("/payment"):
        invoice_id = path.replace("/api/invoices/", "", 1).replace("/payment", "", 1).strip("/")
        if method == "POST" and invoice_id:
            return handle_invoice_payment(environ, start_response, invoice_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/invoices/") and path.endswith("/pdf"):
        invoice_id = path.replace("/api/invoices/", "", 1).replace("/pdf", "", 1).strip("/")
        if method == "GET" and invoice_id:
            return handle_standalone_invoice_pdf(environ, start_response, invoice_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/invoices/"):
        invoice_id = path.replace("/api/invoices/", "", 1).strip("/")
        if method == "POST" and invoice_id:
            return handle_update_invoice(environ, start_response, invoice_id)
        if method == "DELETE" and invoice_id:
            return handle_delete_invoice(environ, start_response, invoice_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/tourists/"):
        tourist_id = path.replace("/api/tourists/", "", 1).strip("/")
        if method == "POST" and tourist_id:
            return handle_update_tourist(environ, start_response, tourist_id)
        if method == "DELETE" and tourist_id:
            return handle_delete_tourist(environ, start_response, tourist_id)
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
            return handle_list_ds160(environ, start_response)
        if method == "POST":
            return handle_create_ds160(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/ds160/invitations":
        if method == "POST":
            return handle_create_ds160_invitation(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/ds160/public/"):
        client_token = path.replace("/api/ds160/public/", "", 1).strip("/")
        if not client_token:
            return json_response(start_response, "404 Not Found", {"error": "DS-160 form not found"})
        if method == "GET":
            return handle_public_get_ds160(start_response, client_token)
        if method == "POST":
            return handle_public_submit_ds160(environ, start_response, client_token)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/ds160/"):
        record_id = path.replace("/api/ds160/", "", 1).strip("/")
        if method == "GET" and record_id:
            return handle_get_ds160(environ, start_response, record_id)
        if method in {"PATCH", "PUT"} and record_id:
            return handle_update_ds160(environ, start_response, record_id)
        if method == "DELETE" and record_id:
            return handle_delete_ds160(environ, start_response, record_id)
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
            return handle_list_camp_reservations(environ, start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_camp_reservation(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/flight-reservations":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_flight_reservations(environ, start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_flight_reservation(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/transfer-reservations":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_transfer_reservations(environ, start_response)
        if method == "POST":
            if not require_login(environ, start_response):
                return []
            return handle_create_transfer_reservation(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/camp-trips":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_list_camp_trips(environ, start_response)
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
        tail = path.replace("/api/camp-trips/", "", 1).strip("/")
        # /api/camp-trips/{id}/documents  — upload
        if tail.endswith("/documents") and method == "POST":
            trip_id = tail[: -len("/documents")]
            return handle_upload_trip_document(environ, start_response, trip_id)
        # /api/camp-trips/{id}/documents/email  — bulk email selected docs to a client
        if tail.endswith("/documents/email") and method == "POST":
            trip_id = tail[: -len("/documents/email")]
            return handle_email_trip_documents(environ, start_response, trip_id)
        # /api/camp-trips/{id}/documents/{doc_id}  — delete or rename
        if "/documents/" in tail and method == "DELETE":
            trip_id, doc_id = tail.split("/documents/", 1)
            return handle_delete_trip_document(environ, start_response, trip_id, doc_id)
        if "/documents/" in tail and method == "PATCH":
            trip_id, doc_id = tail.split("/documents/", 1)
            return handle_rename_trip_document(environ, start_response, trip_id, doc_id)
        trip_id = tail
        if method == "POST" and trip_id:
            return handle_update_camp_trip(environ, start_response, trip_id)
        if method == "DELETE" and trip_id:
            return handle_delete_camp_trip(environ, start_response, trip_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if method != "GET":
        return json_response(start_response, "404 Not Found", {"error": "Not found"})

    if path == "/login":
        if current_user(environ):
            if not active_workspace(environ):
                start_response("302 Found", [("Location", "/workspace")])
                return [b""]
            return file_response(start_response, PUBLIC_DIR / "backoffice.html")
        return file_response(start_response, PUBLIC_DIR / "login.html")

    if path == "/workspace":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "workspace.html")

    if path == "/":
        if host == "camp.travelx.mn":
            if not current_user(environ):
                return file_response(start_response, PUBLIC_DIR / "login.html")
            return file_response(start_response, PUBLIC_DIR / "camp.html")
        if host in {"backoffice.travelx.mn", "www.backoffice.travelx.mn"}:
            if not current_user(environ):
                return file_response(start_response, PUBLIC_DIR / "login.html")
            if not active_workspace(environ):
                start_response("302 Found", [("Location", "/workspace")])
                return [b""]
            return file_response(start_response, PUBLIC_DIR / "camp.html")
        return file_response(start_response, PUBLIC_DIR / "index.html")

    if path == "/backoffice":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        if not active_workspace(environ):
            start_response("302 Found", [("Location", "/workspace")])
            return [b""]
        return file_response(start_response, PUBLIC_DIR / "camp.html")

    if path == "/todo":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "backoffice.html")

    if path == "/contracts":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "contracts.html")

    if path == "/invoices":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "invoices.html")

    if path == "/documents":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "documents.html")

    if path == "/pdf-viewer":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "pdf-viewer.html")

    if path.startswith("/contract/"):
        contract_id = path.replace("/contract/", "", 1).strip("/")
        if contract_id:
            return file_response(start_response, PUBLIC_DIR / "contract-sign.html")

    if path == "/ds160":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        if active_workspace(environ) == "USM":
            start_response("302 Found", [("Location", "/backoffice")])
            return [b""]
        return file_response(start_response, PUBLIC_DIR / "ds160.html")

    if path.startswith("/ds160/form/"):
        client_token = path.replace("/ds160/form/", "", 1).strip("/")
        if client_token:
            return file_response(start_response, PUBLIC_DIR / "ds160-client.html")

    if path == "/camp":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "camp.html")

    if path == "/camp-reservations":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "camp-reservations.html")

    if path == "/flight-reservations":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "flight-reservations.html")

    if path == "/transfer-reservations":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "transfer-reservations.html")

    if path == "/trip-detail":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "trip-detail.html")

    if path == "/tourist":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "tourist.html")

    if path == "/group":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        return file_response(start_response, PUBLIC_DIR / "group.html")

    if path == "/invoice-view":
        return file_response(start_response, PUBLIC_DIR / "invoice-view.html")

    if path == "/admin":
        user = current_user(environ)
        if not user:
            return file_response(start_response, PUBLIC_DIR / "login.html")
        if user.get("role") != "admin":
            return text_response(start_response, "403 Forbidden", "Admin access required")
        return file_response(start_response, PUBLIC_DIR / "admin.html")

    if path == "/fifa2026-admin":
        if not current_user(environ):
            return file_response(start_response, PUBLIC_DIR / "login.html")
        if active_workspace(environ) == "USM":
            start_response("302 Found", [("Location", "/backoffice")])
            return [b""]
        return file_response(start_response, PUBLIC_DIR / "fifa2026-admin.html")

    if path == "/fifa2026":
        return file_response(start_response, PUBLIC_DIR / "fifa2026.html")

    if path.startswith("/generated/"):
        safe_path = (GENERATED_DIR / unquote(path.replace("/generated/", "", 1))).resolve()
        if not str(safe_path).startswith(str(GENERATED_DIR.resolve())) or not safe_path.exists():
            return json_response(start_response, "404 Not Found", {"error": "Not found"})
        params = parse_qs(environ.get("QUERY_STRING", ""))
        extra_headers = generated_download_headers(safe_path) if params.get("download", ["0"])[0] == "1" else None
        return file_response(start_response, safe_path, extra_headers=extra_headers)

    if path.startswith("/trip-uploads/"):
        if not current_user(environ):
            return json_response(start_response, "401 Unauthorized", {"error": "Login required"})
        rel = unquote(path.replace("/trip-uploads/", "", 1))
        safe_path = (TRIP_UPLOADS_DIR / rel).resolve()
        if not str(safe_path).startswith(str(TRIP_UPLOADS_DIR.resolve())) or not safe_path.exists():
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
