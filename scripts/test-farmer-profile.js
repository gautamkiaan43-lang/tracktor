const BASE_URL = 'http://localhost:5000/api';
let farmerToken = '';

async function runTests() {
  console.log("Starting Farmer Profile Tests...");

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'farmer@tractorlink.com', password: 'farmer123' })
  });
  const loginData = await loginRes.json();
  
  if (!loginData.success) {
    console.error("Failed to login farmer:", loginData);
    return;
  }
  
  farmerToken = loginData.data.token;
  console.log("Logged in successfully. Got farmer token.");

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${farmerToken}`
  };

  // 2. Fetch Profile
  console.log("\nFetching farmer profile...");
  const profileRes = await fetch(`${BASE_URL}/farmer/profile`, { headers });
  const profileData = await profileRes.json();
  console.log("Profile Response:", profileData);

  // 3. Update Profile
  console.log("\nUpdating profile name and location...");
  const updateRes = await fetch(`${BASE_URL}/farmer/profile`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: 'Farmer Demo Edit', location: 'New Location' })
  });
  const updateData = await updateRes.json();
  console.log("Profile Update Response:", updateData);

  // 4. Update Language
  console.log("\nUpdating language to 'naira'...");
  const langRes = await fetch(`${BASE_URL}/farmer/language`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ language: 'naira' })
  });
  const langData = await langRes.json();
  console.log("Language Update Response:", langData);

  // 5. Change Password (back and forth)
  console.log("\nChanging password...");
  const passRes = await fetch(`${BASE_URL}/farmer/change-password`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ oldPassword: 'farmer123', newPassword: 'newpassword123' })
  });
  const passData = await passRes.json();
  console.log("Change Password Response:", passData);

  console.log("\nReverting password to original...");
  const revertPassRes = await fetch(`${BASE_URL}/farmer/change-password`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ oldPassword: 'newpassword123', newPassword: 'farmer123' })
  });
  const revertPassData = await revertPassRes.json();
  console.log("Revert Password Response:", revertPassData);

  // Reverting profile info to dummy defaults
  console.log("\nReverting profile name to initial...");
  await fetch(`${BASE_URL}/farmer/profile`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: 'Farmer Demo', location: 'Not Specified' })
  });

  console.log("\nFarmer Profile Tests Completed!");
}

runTests();

