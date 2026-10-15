async function run() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'HAPPY@2024' })
    });
    
    if (!loginRes.ok) {
      console.error('Login failed status:', loginRes.status, await loginRes.json());
      return;
    }
    
    const { token } = await loginRes.json();
    console.log('Login successful, token obtained!');
    
    const endpoints = [
      '/api/dashboard/today',
      '/api/job-cards?limit=25',
      '/api/staff',
      '/api/advance-bookings/today'
    ];
    
    for (const ep of endpoints) {
      console.log(`\nFetching ${ep}...`);
      const res = await fetch(`http://localhost:5000${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        console.log(`Response:`, JSON.stringify(json).substring(0, 300));
      } catch (e) {
        console.log(`Response (non-JSON):`, text.substring(0, 300));
      }
    }
  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();

