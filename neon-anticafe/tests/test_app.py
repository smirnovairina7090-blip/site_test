import os
import tempfile
import unittest
from datetime import date, timedelta
from app import app

class NeonDenTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        app.config.update(TESTING=True, DATABASE=os.path.join(self.tmp.name, "test.sqlite3"))
        self.client = app.test_client()
        self.day = (date.today() + timedelta(days=1)).isoformat()
    def tearDown(self):
        self.tmp.cleanup()
        app.config.pop("DATABASE", None)
    def test_health_and_catalog(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        self.assertEqual(len(self.client.get("/api/catalog").json["seats"]), 8)
    def test_booking_rejects_overlapping_reservations(self):
        data = {"seat_id":"pc-01","guest":"Аня","date":self.day,"time":"18:00","hours":2}
        first = self.client.post("/api/bookings", json=data)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(self.client.post("/api/bookings", json=data).status_code, 409)
        code = first.json["code"]
        self.assertEqual(self.client.get("/api/bookings/"+code).status_code, 200)
        data["time"] = "20:00"
        self.assertEqual(self.client.post("/api/bookings", json=data).status_code, 201)
    def test_server_owns_menu_prices(self):
        result = self.client.post("/api/orders", json={"items":[{"id":"latte","qty":2,"price":1}]})
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json["total"], 580)
        bad = self.client.post("/api/orders", json={"items":[{"id":"latte","qty":-1}]})
        self.assertEqual(bad.status_code, 400)

if __name__ == "__main__":
    unittest.main()
