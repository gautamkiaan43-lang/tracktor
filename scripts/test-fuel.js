// Native fetch is supported in Node 22

const BASE_URL = 'http://localhost:5000/api';
let operatorToken = '';

async function runTests() {
  console.log("Starting Fuel Telemetry Tests...");

  // 1. Login as Operator
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@tractorlink.com', password: 'operator123' })
  });
  const loginData = await loginRes.json();
  
  if (!loginData.success) {
    console.error("Failed to login operator:", loginData);
    return;
  }
  
  operatorToken = loginData.data.token;
  console.log("Logged in successfully. Got operator token.");

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${operatorToken}`
  };

  // 2. Add Fuel Log
  console.log("\nAttempting to add a new fuel log...");
  const addRes = await fetch(`${BASE_URL}/operator/fuel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      liters: 45.5,
      cost: 5005,
      station: "Test Station 1"
    })
  });
  const addData = await addRes.json();
  console.log("Add Fuel Response:", addData);

  // 3. Add another Fuel Log
  console.log("\nAttempting to add another fuel log...");
  const addRes2 = await fetch(`${BASE_URL}/operator/fuel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      liters: 10,
      cost: 1100,
      station: "Test Station 2"
    })
  });
  const addData2 = await addRes2.json();
  console.log("Add Fuel 2 Response:", addData2);


  // 4. Get Fuel History
  console.log("\nFetching fuel history...");
  const historyRes = await fetch(`${BASE_URL}/operator/fuel`, {
    method: 'GET',
    headers
  });
  const historyData = await historyRes.json();
  console.log("History Response:", historyData);

  // 5. Get Fuel Summary
  console.log("\nFetching fuel summary...");
  const summaryRes = await fetch(`${BASE_URL}/operator/fuel/summary`, {
    method: 'GET',
    headers
  });
  const summaryData = await summaryRes.json();
  console.log("Summary Response:", summaryData);
}

runTests();

