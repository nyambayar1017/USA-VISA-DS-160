import copy
import html
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote
from uuid import uuid4
import xml.etree.ElementTree as ET
from wsgiref.simple_server import make_server


BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = BASE_DIR / "data"
GENERATED_DIR = DATA_DIR / "generated"
PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "0.0.0.0")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "change-me")
TEMPLATE_FILE = Path(os.environ.get("CONTRACT_TEMPLATE", DATA_DIR / "GEREE-template.docx"))
CONTRACTS_FILE = DATA_DIR / "contracts.json"
DS160_FILE = DATA_DIR / "ds160_applications.json"
FINANCE_FILE = DATA_DIR / "finance_entries.json"
BOOKINGS_FILE = DATA_DIR / "hotel_bookings.json"
RESERVATIONS_FILE = DATA_DIR / "reservations.json"
CAMP_RESERVATIONS_FILE = DATA_DIR / "camp_reservations.json"
CAMP_TRIPS_FILE = DATA_DIR / "camp_trips.json"
USERS_FILE = DATA_DIR / "users.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"
SESSION_COOKIE = "travelx_session"
SESSION_SECRET = os.environ.get("SESSION_SECRET", ADMIN_TOKEN)
ADMIN_EMAIL = normalize_admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "").strip()

ET.register_namespace("w", WORD_NS)


def ensure_data_store():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
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
    bootstrap_admin_user()


def read_json_list(file_path):
    ensure_data_store()
    return json.loads(file_path.read_text(encoding="utf-8"))


def write_json_list(file_path, records):
    ensure_data_store()
    file_path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")


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
        write_users(users)
        return json_response(start_response, "200 OK", {"ok": True, "user": sanitize_user(user)})
    return json_response(start_response, "404 Not Found", {"error": "User not found"})


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
        "lastLoginAt": user.get("lastLoginAt"),
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


def split_date_parts(value):
    raw = str(value or "")
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
    }

    for paragraph in root.findall(f".//{qname('p')}"):
        current_text = paragraph_text(paragraph)
        if current_text in replacements:
            set_paragraph_text(paragraph, replacements[current_text])


def generate_docx(data, output_path):
    ensure_data_store()
    if not TEMPLATE_FILE.exists():
        raise FileNotFoundError(f"Template not found at {TEMPLATE_FILE}")

    with zipfile.ZipFile(TEMPLATE_FILE, "r") as source_zip:
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
        "data": data,
        "docxPath": f"/generated/{docx_filename}",
        "pdfViewPath": f"/generated/{html_filename}",
    }
    return record


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


def build_camp_document_html(record, pdf_href):
    meals = " / ".join(
        [
            meal
            for meal in [
                record["breakfast"] == "Yes" and "Breakfast",
                record["lunch"] == "Yes" and "Lunch",
                record["dinner"] == "Yes" and "Dinner",
            ]
            if meal
        ]
    ) or "No meal"
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
      .top {{
        display: grid;
        grid-template-columns: 1.1fr 1.2fr;
        gap: 24px;
        align-items: start;
      }}
      .brand-mark {{
        display: inline-block;
        padding: 16px 18px;
        border-radius: 18px;
        background: #1a3e72;
        color: #fff;
        font: 700 24px/1.05 Arial, sans-serif;
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
        font-size: 29px;
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
          <div class="brand-mark">STEPPE<br/>MONGOLIA</div>
          <div class="brand-sub">
            Unlock Steppe Mongolia<br/>
            Language: {html.escape(record.get('language') or 'Other')}<br/>
            Staff assignment: {html.escape(record['staffAssignment'] or '-')}
          </div>
        </div>
        <div class="doc-title">
          <h1>CAMP RESERVATION</h1>
          <div class="doc-meta">
            <span>{format_pdf_date(record['createdDate'])}</span>
            <span>Улаанбаатар хот</span>
          </div>
        </div>
      </div>

      <div class="center-title">
        <h2>Аяллын нэр: {html.escape(record['tripName'])}</h2>
        <p>Баазын захиалга - “{html.escape(record['campName'])}”</p>
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
            <th>Нэмэлт тэмдэглэл</th>
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
            <td>{html.escape(record['notes'] or '-')}</td>
            <td>{html.escape(meals)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <div class="status-box">
          <p><strong>Status:</strong> {html.escape(record['status'])}</p>
          <p><strong>Deposit:</strong> {format_money(record['deposit'])} MNT</p>
          <p><strong>Total payment:</strong> {format_money(record['totalPayment'])} MNT</p>
          <p><strong>Balance payment:</strong> {format_money(record['balancePayment'])} MNT</p>
        </div>
        <div class="status-box">
          <p><strong>Trip:</strong> {html.escape(record['tripName'])}</p>
          <p><strong>Language:</strong> {html.escape(record.get('language') or 'Other')}</p>
          <p><strong>Staff:</strong> {html.escape(record['staffAssignment'] or '-')}</p>
        </div>
      </div>
    </div>
  </body>
</html>
"""


def save_camp_reservation_document(record):
    ensure_data_store()
    filename_stem = slugify(
        f"camp-{record['tripName']}-{record['campName']}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )
    html_filename = f"{filename_stem}.html"
    pdf_filename = f"{filename_stem}.pdf"
    html_path = GENERATED_DIR / html_filename
    pdf_path = GENERATED_DIR / pdf_filename

    pdf_href = f"/generated/{pdf_filename}"
    html_path.write_text(build_camp_document_html(record, pdf_href), encoding="utf-8")

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CampTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            alignment=1,
        )
        body_style = ParagraphStyle(
            "CampBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
        )

        doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=A4,
            leftMargin=42,
            rightMargin=42,
            topMargin=42,
            bottomMargin=42,
        )
        elements = [
            Paragraph("UNLOCK STEPPE MONGOLIA", title_style),
            Spacer(1, 10),
            Paragraph(f"Date: {format_pdf_date(record['createdDate'])} | City: Ulaanbaatar", body_style),
            Spacer(1, 18),
            Paragraph(
                f"Trip name: {html.escape(record['tripName'])}",
                ParagraphStyle("Sub", parent=body_style, fontName="Helvetica-Bold", fontSize=13, alignment=1),
            ),
            Spacer(1, 8),
            Paragraph(
                f"Camp reservation - {html.escape(record['campName'])}",
                ParagraphStyle("Sub2", parent=body_style, fontName="Helvetica-Bold", fontSize=12, alignment=1),
            ),
            Spacer(1, 20),
        ]

        table = Table(
            [[
                "Clients", "Staff", "Arrival", "Departure", "Nights", "Gers", "Room type", "Note", "Meals"
            ], [
                str(record["clientCount"]),
                str(record["staffCount"]),
                format_pdf_date(record["checkIn"]),
                format_pdf_date(record["checkOut"]),
                str(record["nights"]),
                str(record["gerCount"]),
                record["roomType"],
                record["notes"] or "-",
                meals,
            ]],
            repeatRows=1,
        )
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d8e4f2")),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("LEADING", (0, 0), (-1, -1), 13),
        ]))
        elements.extend([table, Spacer(1, 26)])
        elements.append(
            Paragraph(
                f"Status: {record['status']} | Deposit: {format_money(record['deposit'])} MNT | Total: {format_money(record['totalPayment'])} MNT | Balance: {format_money(record['balancePayment'])} MNT",
                body_style,
            )
        )
        elements.append(Spacer(1, 10))
        elements.append(
            Paragraph(
                f"Trip: {html.escape(record['tripName'])} | Language: {html.escape(record.get('language') or 'Other')}",
                body_style,
            )
        )
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Assigned staff: {html.escape(record['staffAssignment'] or '-')}", body_style))
        doc.build(elements)
    except Exception:
        pdf_path.write_text("PDF generation unavailable", encoding="utf-8")

    return {
        "pdfViewPath": f"/generated/{html_filename}",
        "pdfPath": pdf_href,
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


def build_camp_trip(payload):
    return {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "tripName": normalize_text(payload.get("tripName")),
        "language": normalize_text(payload.get("language")) or "Other",
        "inboundCompany": "Unlock Steppe Mongolia",
    }


def validate_camp_trip(data):
    if not data.get("tripName"):
        return "Trip name is required"
    return None


def find_camp_trip(trip_id):
    for trip in read_camp_trips():
        if trip["id"] == trip_id:
            return trip
    return None


def build_camp_reservation(payload):
    created_date = normalize_text(payload.get("createdDate")) or datetime.now().strftime("%Y-%m-%d")
    return {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdDate": created_date,
        "tripId": normalize_text(payload.get("tripId")),
        "tripName": normalize_text(payload.get("tripName")),
        "language": normalize_text(payload.get("language")) or "Other",
        "campName": normalize_text(payload.get("campName")),
        "checkIn": normalize_text(payload.get("checkIn")),
        "checkOut": normalize_text(payload.get("checkOut")),
        "clientCount": parse_int(payload.get("clientCount")),
        "staffCount": parse_int(payload.get("staffCount")),
        "staffAssignment": normalize_text(payload.get("staffAssignment")),
        "gerCount": parse_int(payload.get("gerCount")),
        "nights": parse_int(payload.get("nights")),
        "roomType": normalize_text(payload.get("roomType")),
        "breakfast": normalize_text(payload.get("breakfast")) or "No",
        "lunch": normalize_text(payload.get("lunch")) or "No",
        "dinner": normalize_text(payload.get("dinner")) or "No",
        "status": normalize_text(payload.get("status")).lower() or "pending",
        "deposit": parse_int(payload.get("deposit")),
        "totalPayment": parse_int(payload.get("totalPayment")),
        "balancePayment": parse_int(payload.get("balancePayment")),
        "notes": normalize_text(payload.get("notes")),
    }


def validate_camp_reservation(data):
    required = ["tripId", "tripName", "campName", "checkIn", "checkOut", "status", "roomType"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    if data.get("clientCount", 0) <= 0:
        return "Number of clients must be greater than 0"
    if data.get("gerCount", 0) <= 0:
        return "Number of gers must be greater than 0"
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
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_finance_entry(payload)
    error = validate_finance_entry(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    records = read_finance_entries()
    records.insert(0, record)
    write_finance_entries(records)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record, "summary": finance_summary(records)})


def handle_list_bookings(start_response):
    return json_response(start_response, "200 OK", read_bookings())


def handle_create_booking(environ, start_response):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_booking(payload)
    error = validate_booking(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    records = read_bookings()
    records.insert(0, record)
    write_bookings(records)
    return json_response(start_response, "201 Created", {"ok": True, "booking": record})


def handle_list_reservations(start_response):
    return json_response(start_response, "200 OK", read_reservations())


def handle_create_reservation(environ, start_response):
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


def handle_create_camp_trip(environ, start_response):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_camp_trip(payload)
    error = validate_camp_trip(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    trips = read_camp_trips()
    trips.insert(0, record)
    write_camp_trips(trips)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record})


def handle_create_camp_reservation(environ, start_response):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    record = build_camp_reservation(payload)
    trip = find_camp_trip(record["tripId"])
    if trip is None:
        return json_response(start_response, "400 Bad Request", {"error": "Please create or select a trip first"})
    record["tripName"] = trip["tripName"]
    record["language"] = trip.get("language") or "Other"
    error = validate_camp_reservation(record)
    if error:
        return json_response(start_response, "400 Bad Request", {"error": error})

    record.update(save_camp_reservation_document(record))
    records = read_camp_reservations()
    records.insert(0, record)
    write_camp_reservations(records)
    return json_response(start_response, "201 Created", {"ok": True, "entry": record, "summary": camp_summary(records)})


def handle_update_camp_reservation(environ, start_response, reservation_id):
    payload = collect_json(environ)
    if payload is None:
        return json_response(start_response, "400 Bad Request", {"error": "Invalid payload"})

    records = read_camp_reservations()
    for index, record in enumerate(records):
        if record["id"] != reservation_id:
            continue

        merged = {**record}
        for key in [
            "campName",
            "checkIn",
            "checkOut",
            "roomType",
            "status",
            "staffAssignment",
            "notes",
            "breakfast",
            "lunch",
            "dinner",
        ]:
            if key in payload:
                merged[key] = normalize_text(payload.get(key))

        for key in ["clientCount", "staffCount", "gerCount", "nights", "deposit", "totalPayment", "balancePayment"]:
            if key in payload:
                merged[key] = parse_int(payload.get(key))

        error = validate_camp_reservation(merged)
        if error:
            return json_response(start_response, "400 Bad Request", {"error": error})

        merged.update(save_camp_reservation_document(merged))
        records[index] = merged
        write_camp_reservations(records)
        return json_response(start_response, "200 OK", {"ok": True, "entry": merged, "summary": camp_summary(records)})

    return json_response(start_response, "404 Not Found", {"error": "Camp reservation not found"})


def handle_generate_contract(environ, start_response):
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
    contracts.insert(0, record)
    write_contracts(contracts)
    return json_response(start_response, "201 Created", {"ok": True, "contract": record})


def handle_list_contracts(start_response):
    return json_response(start_response, "200 OK", read_contracts())


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

    if path == "/api/auth/logout" and method == "POST":
        return handle_auth_logout(environ, start_response)

    if path == "/api/auth/me" and method == "GET":
        return handle_auth_me(environ, start_response)

    if path == "/api/users":
        if method == "GET":
            return handle_list_users(environ, start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path.startswith("/api/users/"):
        user_id = path.replace("/api/users/", "", 1).strip("/")
        if method == "POST" and user_id:
            return handle_update_user(environ, start_response, user_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if path == "/api/backoffice/summary":
        if method == "GET":
            if not require_login(environ, start_response):
                return []
            return handle_dashboard_summary(start_response)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

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

    if path.startswith("/api/camp-reservations/"):
        reservation_id = path.replace("/api/camp-reservations/", "", 1).strip("/")
        if method == "POST" and reservation_id:
            if not require_login(environ, start_response):
                return []
            return handle_update_camp_reservation(environ, start_response, reservation_id)
        return json_response(start_response, "405 Method Not Allowed", {"error": "Method not allowed"})

    if method != "GET":
        return json_response(start_response, "404 Not Found", {"error": "Not found"})

    if path == "/login":
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
        return file_response(start_response, safe_path)

    safe_path = (PUBLIC_DIR / path.lstrip("/")).resolve()
    if not str(safe_path).startswith(str(PUBLIC_DIR.resolve())) or not safe_path.exists():
        return json_response(start_response, "404 Not Found", {"error": "Not found"})

    return file_response(start_response, safe_path)


if __name__ == "__main__":
    print(f"Client intake app running at http://{HOST}:{PORT}")
    with make_server(HOST, PORT, app) as server:
        server.serve_forever()
