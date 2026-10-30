"""NEON DEN Control Room: inspectable teaching-oriented Python business logic.

Public demo only: there is deliberately no admin authentication. Do not use with
real customer data or payments. Data is temporary on serverless SQLite.
"""
from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter
from datetime import date, datetime, timedelta
from flask import jsonify, render_template, request


TRANSITIONS = {
    "bookings": {"confirmed": {"checkin": "active", "cancel": "cancelled"},
                 "active": {"finish": "completed", "cancel": "cancelled"}},
    "orders": {"accepted": {"prepare": "preparing"},
               "preparing": {"ready": "ready"},
               "ready": {"serve": "served"}},
}


def migrate(db: sqlite3.Connection) -> None:
    """Add teaching tables and migrate existing SQLite data safely."""
    db.execute("""CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL,
      summary TEXT NOT NULL, details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS members (
      alias TEXT PRIMARY KEY COLLATE NOCASE, points INTEGER NOT NULL DEFAULT 0,
      visits INTEGER NOT NULL DEFAULT 0
    )""")
    for table, column, definition in (
        ("bookings", "status", "TEXT NOT NULL DEFAULT 'confirmed'"),
        ("orders", "status", "TEXT NOT NULL DEFAULT 'accepted'"),
        ("orders", "discount", "INTEGER NOT NULL DEFAULT 0"),
        ("orders", "points_earned", "INTEGER NOT NULL DEFAULT 0"),
    ):
        columns = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
        if column not in columns:
            db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def record(db: sqlite3.Connection, action: str, summary: str, details: dict | None = None) -> None:
    db.execute("INSERT INTO activity(action,summary,details) VALUES (?,?,?)",
               (action, summary[:160], json.dumps(details or {}, ensure_ascii=False)))


def seat_price(seat: dict, hours: int, start: str) -> dict:
    """Happy hour discount is calculated on the backend, never in JS."""
    dt = datetime.fromisoformat(start)
    base = seat["rate"] * hours
    happy = dt.weekday() < 5 and 12 <= dt.hour < 16
    discount = (base * 15 // 100) if happy else 0
    return {"base": base, "discount": discount, "total": base-discount,
            "tariff": "DAY BOOST · −15%" if happy else "STANDARD"}


def bar_price(normalized: list[dict], promo: str) -> dict:
    base = sum(item["qty"] * item["price"] for item in normalized)
    if promo not in ("", "NEON10"):
        raise ValueError("Неизвестный промокод. Попробуйте NEON10.")
    discount = base // 10 if promo == "NEON10" else 0
    return {"subtotal": base, "discount": discount,
            "total": base-discount, "promo": promo, "points": (base-discount)//100}


def install(app, connect, seats, menu, parse_slot, error):
    seat_map = {s["id"]: s for s in seats}

    @app.get('/control')
    def control_room():
        return render_template('control.html')

    @app.get('/api/control/health')
    def control_health():
        return jsonify({"service": "NEON DEN Control Room", "language": "Python",
                        "framework": "Flask", "database": "SQLite",
                        "modules": ["pricing", "recommendations", "analytics", "status_machine", "audit_log", "loyalty"],
                        "demo_mode": True, "storage": "ephemeral on Vercel"})

    @app.get('/api/control/dashboard')
    def dashboard():
        with connect() as db:
            booking_rows = db.execute("SELECT code,seat_id,guest,start_at,end_at,total,status FROM bookings ORDER BY id DESC LIMIT 35").fetchall()
            order_rows = db.execute("SELECT code,guest,items,total,discount,points_earned,status,created_at FROM orders ORDER BY id DESC LIMIT 35").fetchall()
            events = db.execute("SELECT action,summary,created_at FROM activity ORDER BY id DESC LIMIT 22").fetchall()
            members = db.execute("SELECT alias,points,visits FROM members ORDER BY points DESC LIMIT 8").fetchall()
            groups = db.execute("SELECT seat_id,COUNT(*) AS cnt,SUM(total) AS revenue FROM bookings WHERE status!='cancelled' GROUP BY seat_id").fetchall()
            bcount = db.execute("SELECT COUNT(*) FROM bookings WHERE status!='cancelled'").fetchone()[0]
            ocount = db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
            revenue_b = db.execute("SELECT COALESCE(SUM(total),0) FROM bookings WHERE status!='cancelled'").fetchone()[0]
            revenue_o = db.execute("SELECT COALESCE(SUM(total),0) FROM orders").fetchone()[0]
            now = datetime.now().isoformat(timespec='seconds')
            occupied = {r[0] for r in db.execute("""SELECT seat_id FROM bookings
                WHERE status='active' OR (status='confirmed' AND start_at<=? AND end_at>?)""",(now,now)).fetchall()}
            active_count = db.execute("SELECT COUNT(*) FROM bookings WHERE status='active'").fetchone()[0]
            in_kitchen = db.execute("SELECT COUNT(*) FROM orders WHERE status IN ('accepted','preparing')").fetchone()[0]
            # Aggregate daily orders and reservations in Python for an explicit analytics example.
            days = [(date.today() - timedelta(days=d)).isoformat() for d in range(6,-1,-1)]
            daily = {day: {"date":day, "bookings":0, "orders":0, "revenue":0} for day in days}
            for row in db.execute("SELECT start_at,total FROM bookings WHERE status!='cancelled'"):
                key=row[0][:10]
                if key in daily: daily[key]["bookings"] += 1; daily[key]["revenue"] += row[1]
            for row in db.execute("SELECT created_at,total FROM orders"):
                key=row[0][:10]
                if key in daily: daily[key]["orders"] += 1; daily[key]["revenue"] += row[1]
        return jsonify({"demo": True, "as_of": now, "metrics": {
            "bookings": bcount, "orders": ocount, "revenue": revenue_b + revenue_o,
            "playing_now": active_count, "kitchen_queue": in_kitchen,
            "available_now": len(seats)-len(occupied), "occupied_now": len(occupied),
            "members": len(members)},
            "stations": [{**s, "state": "occupied" if s["id"] in occupied else "free"} for s in seats],
            "bookings": [dict(r) for r in booking_rows],
            "orders": [{**dict(r), "items":json.loads(r['items'])} for r in order_rows],
            "events": [dict(r) for r in events], "members": [dict(r) for r in members],
            "zones": [{**dict(g), "station_name":seat_map.get(g["seat_id"],{}).get("name",g["seat_id"])} for g in groups],
            "days": list(daily.values())})

    @app.post('/api/control/recommend')
    def recommend():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict): return error('Нужны параметры поиска.')
        slot = parse_slot(payload)
        if slot is None: return error('Выберите корректную дату, время и длительность.')
        start, end, hours = slot
        mode = payload.get('mode', 'game')
        if mode not in ('game', 'chill', 'create'): return error('Неизвестный сценарий.')
        try:
            budget = int(payload.get('budget', 1000))
            if not 200 <= budget <= 10000: raise ValueError()
        except (TypeError, ValueError): return error('Бюджет должен быть от 200 до 10 000 ₽.')
        scores = {'game': {'arena': 90, 'lounge': 62, 'studio': 48},
                  'chill': {'lounge': 95, 'arena': 65, 'studio': 58},
                  'create': {'studio': 98, 'lounge': 65, 'arena': 55}}
        results=[]
        with connect() as db:
            for seat in seats:
                occupied = bool(db.execute("""SELECT 1 FROM bookings WHERE seat_id=?
                    AND status IN ('confirmed','active') AND start_at<? AND end_at>? LIMIT 1""",
                    (seat['id'],end,start)).fetchone())
                price = seat_price(seat,hours,start)
                score = scores[mode][seat['type']] + max(0,20 - price['total']//100)
                if price['total'] > budget: score -= 45
                if occupied: score -= 100
                reason = {'game':'Оптимизировано для игровых сессий',
                          'chill':'Комфорт для общения и отдыха',
                          'create':'Подходит для стримов и творчества'}[mode]
                if price['discount']: reason += ' · действует DAY BOOST'
                results.append({"id":seat['id'],"name":seat['name'],"type":seat['type'],
                                "score":score,"price":price,"available":not occupied,
                                "within_budget":price['total']<=budget,"reason":reason})
        results.sort(key=lambda x: (-x['score'], x['price']['total'], x['name']))
        return jsonify({"recommendations": results[:4], "algorithm":"rules + budget + availability + dynamic pricing",
                        "inputs": {"mode":mode,"budget":budget,"hours":hours,"start":start}})

    @app.post('/api/control/bookings/<code>/transition')
    def transition_booking(code):
        payload=request.get_json(silent=True) or {}
        action=payload.get('action') if isinstance(payload,dict) else None
        if action not in ('checkin','finish','cancel'): return error('Недопустимое действие.')
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT status,seat_id,guest FROM bookings WHERE code=?',(code,)).fetchone()
            if not row: return error('Бронь не найдена.',404)
            next_status=TRANSITIONS['bookings'].get(row['status'],{}).get(action)
            if not next_status: return error(f'Нельзя выполнить {action} для статуса {row["status"]}.',409)
            db.execute('UPDATE bookings SET status=? WHERE code=?',(next_status,code))
            record(db, 'booking.'+action, f'{code} · {row["seat_id"]} → {next_status}',{'code':code,'status':next_status})
            db.commit()
        return jsonify({'code':code,'status':next_status,'action':action})

    @app.post('/api/control/orders/<code>/transition')
    def transition_order(code):
        payload=request.get_json(silent=True) or {}
        action=payload.get('action') if isinstance(payload,dict) else None
        if action not in ('prepare','ready','serve'): return error('Недопустимое действие.')
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT status,guest FROM orders WHERE code=?',(code,)).fetchone()
            if not row: return error('Заказ не найден.',404)
            next_status=TRANSITIONS['orders'].get(row['status'],{}).get(action)
            if not next_status: return error(f'Нельзя выполнить {action} для статуса {row["status"]}.',409)
            db.execute('UPDATE orders SET status=? WHERE code=?',(next_status,code))
            record(db,'order.'+action,f'{code} · {row["guest"]} → {next_status}',{'code':code,'status':next_status})
            db.commit()
        return jsonify({'code':code,'status':next_status,'action':action})

    @app.post('/api/control/demo-fill')
    def demo_fill():
        """Idempotently create pseudonymous demo records; no real customer data."""
        samples = [('Алекс', 'latte', 2),('Мира','matcha',1),('Сэм','cookie',3),
                   ('Ника','soda',2),('Кай','waffle',1),('Луна','berry',2)]
        menu_map={m['id']:m for m in menu}
        new=0
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute("SELECT 1 FROM activity WHERE action='demo.seed' LIMIT 1").fetchone():
                return jsonify({'seeded':0,'message':'Демо-данные уже добавлены.'})
            for i,(name,item_id,qty) in enumerate(samples):
                item=menu_map[item_id]; total=qty*item['price']; code=f'BAR-DEMO{i+1:03d}'
                line=json.dumps([{'id':item_id,'name':item['name'],'price':item['price'],'qty':qty}],ensure_ascii=False)
                db.execute("INSERT OR IGNORE INTO orders(code,guest,items,total,status,points_earned) VALUES (?,?,?,?,?,?)",
                           (code,name,line,total,['accepted','preparing','ready','served'][i%4],total//100))
                db.execute('INSERT INTO members(alias,points,visits) VALUES (?,?,1) ON CONFLICT(alias) DO UPDATE SET points=points+excluded.points,visits=visits+1',(name,total//100))
                new+=1
            for i,seat in enumerate(seats[:4]):
                day=(date.today()+timedelta(days=1)).isoformat()
                st=f'{day}T{["12:00","14:00","16:00","18:00"][i]}:00'
                ed=(datetime.fromisoformat(st)+timedelta(hours=2)).isoformat(timespec='seconds')
                code=f'ND-DEMO{i+1:03d}'
                db.execute("INSERT OR IGNORE INTO bookings(code,seat_id,guest,start_at,end_at,total,status) VALUES (?,?,?,?,?,?,'confirmed')",
                           (code,seat['id'],['Алекс','Мира','Ника','Кай'][i],st,ed,seat_price(seat,2,st)['total']))
                new+=1
            record(db,'demo.seed','Загружены 10 учебных записей (вымышленные гости)',{'count':new})
            db.commit()
        return jsonify({'seeded':new,'message':'Учебные данные добавлены в SQLite.'}),201

    @app.get('/api/control/source')
    def python_source_examples():
        return jsonify({'snippets': {
            'sql': 'SELECT * FROM bookings WHERE seat_id=? AND status IN (\'confirmed\',\'active\') AND start_at<? AND end_at>?',
            'pricing': 'discount = base * 15 // 100 if weekday < 5 and 12 <= hour < 16 else 0',
            'analytics': 'revenue = sum(order.total for order in orders) + sum(booking.total for booking in bookings)',
            'states': 'confirmed → active → completed    |    accepted → preparing → ready → served',
            'loyalty': 'points = total // 100   # 1 балл за каждые 100 рублей',
        }})