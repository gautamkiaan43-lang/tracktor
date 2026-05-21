import express from 'express';
import crypto from 'crypto';
import prisma from '../config/db.js';
import * as BookingService from '../services/booking.service.js';
import * as PaymentService from '../services/payment.service.js';

const router = express.Router();

router.post('/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error("[Paystack Webhook] PAYSTACK_SECRET_KEY is not configured.");
      return res.status(500).json({ error: "PAYSTACK_SECRET_KEY is not configured" });
    }

    // 1. Verify Signature (only if not using a dummy secret key)
    if (!secretKey.includes('sk_test_1234567890abcdef')) {
      if (!signature) {
        console.warn("[Paystack Webhook] Missing x-paystack-signature header.");
        return res.status(401).json({ error: "Missing signature header" });
      }

      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      const hash = crypto.createHmac('sha512', secretKey)
                         .update(rawBody)
                         .digest('hex');

      if (hash !== signature) {
        console.warn("[Paystack Webhook] Signature verification failed.");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      console.log("[Paystack Webhook] Dummy key detected. Bypassing signature verification.");
    }

    const { event, data } = req.body;

    console.log(`[Paystack Webhook] Received event: ${event}`);

    // We only process charge.success events
    if (event === 'charge.success') {
      const { reference, amount, metadata } = data;

      if (!reference) {
        return res.status(400).json({ error: "Missing reference in transaction data" });
      }

      console.log(`[Paystack Webhook] Processing charge.success | Reference: ${reference} | Amount: ${amount / 100} NGN`);

      // 2. Check if this payment reference has already been recorded
      const existingPayment = await prisma.payment.findFirst({
        where: { reference }
      });

      if (existingPayment) {
        console.log(`[Paystack Webhook] Payment with reference ${reference} has already been recorded. Skipping.`);
        return res.status(200).json({ message: "Payment already recorded" });
      }

      // If metadata is missing or incomplete, we cannot map it back
      if (!metadata || !metadata.bookingId || !metadata.farmerId) {
        console.warn(`[Paystack Webhook] Missing critical metadata in transaction. Metadata:`, metadata);
        // Save the payment under a generic "orphan" record or log it
        return res.status(200).json({ message: "Ignored: Missing metadata mapping" });
      }

      const farmerId = parseInt(metadata.farmerId);
      const bookingId = metadata.bookingId;
      const actualAmount = amount / 100; // Paystack is in kobo, convert back to NGN

      // 3. Process Booking Payment or Checkout
      if (bookingId === 'NEW_BOOKING') {
        console.log(`[Paystack Webhook] Recovering checkout flow for farmer ${farmerId}...`);
        await BookingService.createBookingWithInitialPayment(farmerId, {
          ...metadata.bookingData,
          paymentMethod: 'paystack',
          reference
        });
        console.log(`[Paystack Webhook] Checkout recovered successfully! Booking created.`);
      } else {
        console.log(`[Paystack Webhook] Recovering direct payment flow for booking ${bookingId}...`);
        await PaymentService.processBookingPayment(farmerId, {
          bookingId: parseInt(bookingId),
          amount: actualAmount,
          method: 'paystack',
          reference
        });
        console.log(`[Paystack Webhook] Direct payment recovered successfully!`);
      }
    }

    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("[Paystack Webhook Error]:", error.message);
    // Return 200/400 instead of 500 so Paystack doesn't get stuck in a retry loop if there's a coding error,
    // but log it prominently.
    return res.status(400).json({ error: error.message });
  }
});

export default router;
