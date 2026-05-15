const BASE_URL = 'http://localhost:5000/api';
let operatorToken = '';

async function runTests() {
  console.log("Starting Operator Profile Tests...");

  // 1. Login
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

  // 2. Fetch Profile
  console.log("\nFetching operator profile...");
  const profileRes = await fetch(`${BASE_URL}/operator/profile`, { headers });
  const profileData = await profileRes.json();
  console.log("Profile Response:", profileData);

  // 3. Update Language
  console.log("\nUpdating language to 'naira'...");
  const langRes = await fetch(`${BASE_URL}/operator/language`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ language: 'naira' })
  });
  const langData = await langRes.json();
  console.log("Language Update Response:", langData);

  // 4. Change Password (back and forth)
  console.log("\nChanging password...");
  const passRes = await fetch(`${BASE_URL}/operator/change-password`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ oldPassword: 'operator123', newPassword: 'newpassword123' })
  });
  const passData = await passRes.json();
  console.log("Change Password Response:", passData);

  console.log("\nReverting password to original...");
  const revertPassRes = await fetch(`${BASE_URL}/operator/change-password`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ oldPassword: 'newpassword123', newPassword: 'operator123' })
  });
  const revertPassData = await revertPassRes.json();
  console.log("Revert Password Response:", revertPassData);

  console.log("\nOperator Profile Tests Completed!");
}

runTests();

