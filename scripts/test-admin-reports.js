const BASE_URL = 'http://localhost:5000/api';
let adminToken = '';

async function runTests() {
  console.log("Starting Admin Reports & Analytics Verification...");

  // 1. Login as Admin
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tractorlink.com', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  
  if (!loginData.success) {
    console.error("Failed to login admin:", loginData);
    return;
  }
  
  adminToken = loginData.data.token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };
  console.log("Admin logged in successfully.");

  // 2. Test Revenue Report (7d)
  console.log("\nTesting Revenue Report (7d)...");
  const revRes = await fetch(`${BASE_URL}/admin/reports/revenue?range=7d`, { headers });
  const revData = await revRes.json();
  console.log("Revenue (7d):", JSON.stringify(revData.data, null, 2));

  // 3. Test Service Usage
  console.log("\nTesting Service Usage Report...");
  const servRes = await fetch(`${BASE_URL}/admin/reports/service-usage`, { headers });
  const servData = await servRes.json();
  console.log("Service Usage:", JSON.stringify(servData.data, null, 2));

  // 4. Test Fleet Report
  console.log("\nTesting Fleet Report...");
  const fleetRes = await fetch(`${BASE_URL}/admin/reports/fleet`, { headers });
  const fleetData = await fleetRes.json();
  console.log("Fleet Report:", JSON.stringify(fleetData.data, null, 2));

  // 5. Test Farmer Growth
  console.log("\nTesting Farmer Growth Report...");
  const growthRes = await fetch(`${BASE_URL}/admin/reports/farmers`, { headers });
  const growthData = await growthRes.json();
  console.log("Farmer Growth:", JSON.stringify(growthData.data, null, 2));

  console.log("\nAdmin Reports Verification Completed!");
}

runTests();

