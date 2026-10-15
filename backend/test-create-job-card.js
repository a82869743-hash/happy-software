const http = require('http');

function httpReq(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // 1. Login
  const login = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: 'admin', password: 'HAPPY@2024' }));

  const j = JSON.parse(login.body);
  if (!j.token) { console.error('Login failed:', login.body); process.exit(1); }
  const token = j.token;

  // 2. Create Job Card Payload
  const payload = {
    // Vehicle
    reg_no: 'MH12XX9999',
    car_name: 'Hyundai i20 Asta',
    make: 'Hyundai',
    model: 'i20',
    year: 2021,
    variant: 'Asta',
    vin: 'VIN1234567890',
    engine_no: 'ENG123456',
    fuel_type: 'EV',
    charging_pct: 85,
    vehicle_color: 'Red',
    odometer: 15000,
    avg_km_day: 25,
    service_type: 'Regular Service',
    service_advisor: 'Advisor John',
    estimated_delivery: '',
    is_inhouse: false,
    fuel_level: '1/2',

    // Customer
    customer_type: 'individual',
    customer_name: 'Test Customer',
    mobile_no: '9876543210',
    email: 'test@example.com',
    alt_mobile: '',
    company_name: '',
    gstin: '',
    ref_no: '',
    contact_person: '',
    driver_name: '',
    address_line: '123 Test St',
    colony_street: 'Test Colony',
    city: 'Pune',
    state: 'Maharashtra',
    state_code: '27',
    pincode: '411001',
    birth_date: null,
    is_sez: false,

    // Job
    assigned_staff_id: null,
    notes: 'Please wash carefully',
    concerns: ['Squeaky brakes', 'AC not cooling well'],
    services: [
      { service_name: 'Brake cleaning', item_type: 'labour', qty: 1, rate: 500, amount: 500 },
      { service_name: 'AC Gas Refill', item_type: 'labour', qty: 1, rate: 1500, amount: 1500 }
    ],

    // Insurance
    insurance_company: '',
    insurance_claim_no: '',
    claim_no: '',
    accident_date: null,
    delivery_date: null,
    approval_status: 'pending',
    approval_date: null,

    // Advance payment
    advance_payment: {
      payment_type: 'cash',
      amount: 1000,
      payment_date: '2026-06-01'
    }
  };

  console.log('Sending job card creation request...');
  const res = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/job-cards',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  }, JSON.stringify(payload));

  console.log('Status Code:', res.status);
  console.log('Response Body:', res.body);
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

