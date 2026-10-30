import os
import tempfile
import unittest
from datetime import date, timedelta
from app import app


class ControlRoomTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        app.config.update(TESTING=True, DATABASE=os.path.join(self.tmp.name, 'db.sqlite'))
        self.client = app.test_client()
        self.day = (date.today()+timedelta(days=1)).isoformat()

    def tearDown(self):
        app.config.pop('DATABASE', None)
        self.tmp.cleanup()

    def test_dashboard_and_recommendations(self):
        self.assertEqual(self.client.get('/control').status_code, 200)
        self.assertEqual(self.client.get('/api/control/dashboard').json['metrics']['bookings'], 0)
        response=self.client.post('/api/control/recommend',json={
            'mode':'create','budget':1200,'date':self.day,'time':'18:00','hours':2})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['recommendations'][0]['type'],'studio')
        self.assertEqual(self.client.post('/api/control/recommend',json={'mode':'bad'}).status_code,400)

    def test_booking_state_machine_and_occupancy(self):
        payload={'seat_id':'pc-01','guest':'Луна','date':self.day,'time':'18:00','hours':2}
        created=self.client.post('/api/bookings',json=payload)
        self.assertEqual(created.status_code,201)
        code=created.json['code']
        self.assertEqual(self.client.post(f'/api/control/bookings/{code}/transition',json={'action':'finish'}).status_code,409)
        self.assertEqual(self.client.post(f'/api/control/bookings/{code}/transition',json={'action':'checkin'}).json['status'],'active')
        self.assertEqual(self.client.post('/api/bookings',json=payload).status_code,409)
        self.assertEqual(self.client.post(f'/api/control/bookings/{code}/transition',json={'action':'finish'}).json['status'],'completed')
        self.assertEqual(self.client.post('/api/bookings',json=payload).status_code,201)
        events=self.client.get('/api/control/dashboard').json['events']
        self.assertTrue(any(e['action']=='booking.finish' for e in events))

    def test_bar_promo_loyalty_and_status(self):
        order=self.client.post('/api/orders',json={'guest':'Тест','promo':'NEON10','items':[{'id':'latte','qty':2,'price':1}]})
        self.assertEqual(order.status_code,201)
        self.assertEqual(order.json['total'],522)
        self.assertEqual(order.json['quote']['discount'],58)
        self.assertEqual(order.json['quote']['points'],5)
        code=order.json['code']
        for action,next_status in [('prepare','preparing'),('ready','ready'),('serve','served')]:
            res=self.client.post(f'/api/control/orders/{code}/transition',json={'action':action})
            self.assertEqual(res.json['status'],next_status)
        self.assertEqual(self.client.post(f'/api/control/orders/{code}/transition',json={'action':'prepare'}).status_code,409)
        self.assertEqual(self.client.get('/api/control/dashboard').json['members'][0]['points'],5)
        self.assertEqual(self.client.post('/api/orders',json={'promo':'FAKE','items':[{'id':'latte','qty':1}]}).status_code,400)

    def test_idempotent_seed(self):
        a=self.client.post('/api/control/demo-fill',json={})
        b=self.client.post('/api/control/demo-fill',json={})
        self.assertEqual(a.status_code,201)
        self.assertEqual(a.json['seeded'],10)
        self.assertEqual(b.json['seeded'],0)
        m=self.client.get('/api/control/dashboard').json['metrics']
        self.assertEqual(m['orders'],6)
        self.assertEqual(m['bookings'],4)


if __name__=='__main__': unittest.main()