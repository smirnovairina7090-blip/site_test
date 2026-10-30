"""NEON DEN - a small but real Flask + SQLite cybercafe application.

The /tmp default on serverless hosts makes reservations ephemeral there. Set DB_PATH
on a persistent server/volume for durable storage.
"""
from __future__ import annotations

import os
import re
import secrets
import sqlite3
from datetime import date, datetime
from pathlib import Path
from flask import Flask, jsonify, render_template, request

BASE = Path(__file__).resolve().parent
app = Flask(__name__)
app.json.ensure_ascii = False
app.config["JSON_SORT_KEYS"] = False
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024

SEATS = [
    {"id": "pc-01", "name": "NOVA 01", "type": "arena", "label": "Киберарена", "rate": 250},
    {"id": "pc-02", "name": "NOVA 02", "type": "arena", "label": "Киберарена", "rate": 250},
    {"id": "pc-03", "name": "NOVA 03", "type": "arena", "label": "Киберарена", "rate": 250},
    {"id": "pc-04", "name": "NOVA 04", "type": "arena", "label": "Киберарена", "rate": 250},
    {"id": "vip-01", "name": "ORBIT 01", "type": "lounge", "label": "Лаунж-зона", "rate": 350},
    {"id": "vip-02", "name": "ORBIT 02", "type": "lounge", "label": "Лаунж-зона", "rate": 350},
    {"id": "studio-01", "name": "PULSE 01", "type": "studio", "label": "Стрим-студия", "rate": 490},
    {"id": "studio-02", "name": "PULSE 02", "type": "studio", "label": "Стрим-студия", "rate": 490},
]
MENU = [
    {"id": "latte", "name": "Pixel Latte", "category": "coffee", "details": "Ваниль, эспрессо, молоко", "price": 290, "accent": "pink", "emoji": "☕"},
    {"id": "matcha", "name": "Matrix Matcha", "category": "coffee", "details": "Матча, кокосовое молоко", "price": 340, "accent": "green", "emoji": "🍵"},
    {"id": "soda", "name": "Cyber Soda", "category": "cold", "details": "Лайм, яблоко, мята", "price": 260, "accent": "blue", "emoji": "🧊"},
    {"id": "berry", "name": "Berry Glitch", "category": "cold", "details": "Малина, клубника, лёд", "price": 320, "accent": "pink", "emoji": "🍓"},
    {"id": "cookie", "name": "Cookie.exe", "category": "snack", "details": "Печенье с шоколадом", "price": 170, "accent": "orange", "emoji": "🍪"},
    {"id": "waffle", "name": "Level Up Waffle", "category": "snack", "details": "Вафля с ягодным соусом", "price": 310, "accent": "green", "emoji": "🧇"},
]


def db_path() -> str:
    return app.config.get("DATABASE") or os.environ.get("DB_PATH") or ("/tmp/neonden.sqlite3" if os.environ.get("VERCEL") else str(BASE / "neonden.sqlite3"))


def connect() -> sqlite3.Connection:
    p = db_path()
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(p, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout = 10000")
    db.execute("""CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL,
        seat_id TEXT NOT NULL, guest TEXT NOT NULL, start_at TEXT NOT NULL,
        end_at TEXT NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL,
        guest TEXT NOT NULL, items TEXT NOT NULL, total INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    db.commit()
    return db


def error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def parse_slot(payload: dict):
    try:
        day = str(payload["date"])
        hour = str(payload["time"])
        hours = int(payload["hours"])
        if hours not in (1, 2, 3, 4):
            raise ValueError()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            raise ValueError()
        if hour not in ("12:00", "14:00", "16:00", "18:00", "20:00", "22:00"):
            raise ValueError()
        start = datetime.fromisoformat(f"{day}T{hour}:00")
        if date.fromisoformat(day) < date.today():
            raise ValueError()
        if (date.fromisoformat(day) - date.today()).days > 60:
            raise ValueError()
        from datetime import timedelta
        end = start + timedelta(hours=hours)
        return start.isoformat(timespec="seconds"), end.isoformat(timespec="seconds"), hours
    except (KeyError, ValueError, TypeError, OverflowError):
        return None


def is_taken(db: sqlite3.Connection, seat_id: str, start: str, end: str) -> bool:
    return bool(db.execute(
        "SELECT 1 FROM bookings WHERE seat_id=? AND start_at < ? AND end_at > ? LIMIT 1",
        (seat_id, end, start),
    ).fetchone())


def make_code(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(4).upper()}"


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "NEON DEN", "backend": "Python / Flask / SQLite"})


@app.get("/api/catalog")
def catalog():
    return jsonify({"seats": SEATS, "menu": MENU, "demo": True})


@app.get("/api/availability")
def availability():
    slot = parse_slot(request.args.to_dict())
    if slot is None:
        return error("Выберите корректные дату, время и длительность.")
    start, end, hours = slot
    with connect() as db:
        result = [{**seat, "available": not is_taken(db, seat["id"], start, end),
                   "total": seat["rate"] * hours} for seat in SEATS]
    return jsonify({"seats": result, "start": start, "end": end, "hours": hours})


@app.post("/api/bookings")
def book():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return error("Неверный формат данных.")
    slot = parse_slot(payload)
    if slot is None:
        return error("Проверьте дату и время бронирования.")
    start, end, hours = slot
    seat = next((s for s in SEATS if s["id"] == payload.get("seat_id")), None)
    guest = str(payload.get("guest", "")).strip()
    if not seat:
        return error("Такого места нет.")
    if len(guest) < 2 or len(guest) > 50 or not re.fullmatch(r"[\w\-\sА-Яа-яЁё]+", guest):
        return error("Введите имя от 2 до 50 символов.")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if is_taken(db, seat["id"], start, end):
            return error("Это место уже занято. Выберите другое.", 409)
        code = make_code("ND")
        total = seat["rate"] * hours
        db.execute(
            "INSERT INTO bookings(code, seat_id, guest, start_at, end_at, total) VALUES (?,?,?,?,?,?)",
            (code, seat["id"], guest, start, end, total),
        )
        db.commit()
    return jsonify({"code": code, "seat": seat["name"], "guest": guest,
                    "start": start, "end": end, "hours": hours, "total": total}), 201


@app.get("/api/bookings/<code>")
def booking_lookup(code: str):
    if not re.fullmatch(r"ND-[A-F0-9]{8}", code):
        return error("Неверный код бронирования.", 404)
    with connect() as db:
        row = db.execute("SELECT code, seat_id, guest, start_at, end_at, total FROM bookings WHERE code=?", (code,)).fetchone()
    if row is None:
        return error("Бронирование не найдено.", 404)
    return jsonify(dict(row))


@app.post("/api/orders")
def order():
    import json
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
        return error("Неверный формат заказа.")
    guest = str(payload.get("guest", "Гость")).strip() or "Гость"
    if len(guest) > 50:
        return error("Слишком длинное имя.")
    items = payload["items"]
    if not 1 <= len(items) <= 10:
        return error("Корзина должна содержать от 1 до 10 товаров.")
    by_id = {item["id"]: item for item in MENU}
    normalized = []
    for entry in items:
        if not isinstance(entry, dict) or entry.get("id") not in by_id:
            return error("Неизвестный товар.")
        quantity = entry.get("qty")
        if type(quantity) is not int or not 1 <= quantity <= 9:
            return error("Количество должно быть от 1 до 9.")
        item = by_id[entry["id"]]
        normalized.append({"id": item["id"], "name": item["name"], "qty": quantity,
                           "price": item["price"]})
    total = sum(item["qty"] * item["price"] for item in normalized)
    code = make_code("BAR")
    with connect() as db:
        db.execute("INSERT INTO orders(code, guest, items, total) VALUES (?,?,?,?)",
                   (code, guest, json.dumps(normalized, ensure_ascii=False), total))
        db.commit()
    return jsonify({"code": code, "items": normalized, "total": total,
                    "message": "Заказ принят в деморежиме. Оплата не требуется."}), 201


@app.get("/api/stats")
def stats():
    with connect() as db:
        bookings = db.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]
        orders = db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    return jsonify({"stations": len(SEATS), "menu_items": len(MENU),
                    "bookings": bookings, "orders": orders, "stack": ["HTML", "CSS", "JavaScript", "Python", "SQLite"]})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=os.environ.get("FLASK_DEBUG") == "1")