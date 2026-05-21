/**
 * Helper to verify a Paystack transaction reference.
 * Returns the transaction data if successful, otherwise throws an error.
 */
export const verifyPaystackTransaction = async (reference) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured on the server.");
  }

  if (!reference) {
    throw new Error("Transaction reference is required.");
  }

  if (secretKey.includes("sk_test_1234567890abcdef")) {
    console.log(`[Paystack] Dummy credentials detected. Simulating successful verification...`);
    return {
      status: 'success',
      amount: null, // Indicates mocked amount
      reference,
      isDummy: true
    };
  }

  try {
    console.log(`[Paystack] Verifying transaction reference: ${reference}`);
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      throw new Error(data.message || "Failed to verify transaction with Paystack.");
    }

    if (data.data.status !== 'success') {
      throw new Error(`Transaction was not successful. Paystack Status: ${data.data.status}`);
    }

    console.log(`[Paystack] Transaction successfully verified. Amount: ${data.data.amount / 100} NGN`);
    return data.data; // Contains amount (in kobo), reference, status, metadata, etc.
  } catch (error) {
    console.error("[Paystack Verification Error]:", error.message);
    throw new Error(error.message || "An error occurred during payment verification.");
  }
};
