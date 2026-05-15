import prisma from '../config/db.js';
import bcrypt from 'bcryptjs';

/**
 * USSD Service Logic (Production-Ready Refactor)
 * Uses an iterative approach to process input trails, allowing for robust error handling.
 */

// Helper to format currency
const formatNaira = (amount) => `\u20A6${amount.toLocaleString()}`;

/**
 * Main Entry Point for USSD Requests
 */
export const handleUssdRequest = async (sessionId, phoneNumber, text) => {
  try {
    const parts = text === '' ? [] : text.split('*');

    // Safety: Prevent extremely long trails (potential bot or infinite error loop)
    if (parts.length > 12) {
      return "END Session expired. Please try again.";
    }

    // 1. Initial Menu
    if (parts.length === 0) {
      return "CON Welcome to TractorLink\n\n1. Book Tractor\n2. Check Status";
    }

    const mainOption = parts[0];

    if (mainOption === '1') return await processBookingFlow(phoneNumber, parts);
    if (mainOption === '2') return await processStatusFlow(phoneNumber);

    return "CON Invalid option.\n\n1. Book Tractor\n2. Check Status";
  } catch (error) {
    console.error('[USSD Global Error]:', error);
    return "END Something went wrong. Try again later.";
  }
};

/**
 * Iterative Booking Flow State Machine
 */
async function processBookingFlow(phoneNumber, parts) {
  // We skip parts[0] which is '1' (the menu option)
  const inputs = parts.slice(1);
  
  // State variables
  let hects = null;
  let service = null;
  let location = null;
  let landmark = null;
  let errorMessage = "";

  // Step 0: Welcome / Hectares
  // Initial prompt if no inputs provided yet
  if (inputs.length === 0) {
    return "CON Enter land size (hectares):";
  }

  // Iteratively consume inputs
  let currentStep = 1; // 1: Hectares, 2: Service, 3: Area, 4: Landmark, 5: Confirm

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i].trim();
    if (!input) continue; // Skip empty segments

    if (currentStep === 1) {
      const val = parseFloat(input);
      if (!isNaN(val) && val > 0) {
        hects = val;
        currentStep = 2;
        errorMessage = "";
      } else {
        errorMessage = "Error: Invalid size.\n";
      }
    } 
    else if (currentStep === 2) {
      const services = await prisma.service.findMany({ where: { isActive: true, isDeleted: false }, orderBy: { name: 'asc' } });
      const idx = parseInt(input) - 1;
      if (!isNaN(idx) && services[idx]) {
        service = services[idx];
        currentStep = 3;
        errorMessage = "";
      } else {
        errorMessage = "Error: Invalid service.\n";
      }
    } 
    else if (currentStep === 3) {
      const locs = await prisma.ussdLocation.findMany({ where: { isActive: true }, take: 6, orderBy: { name: 'asc' } });
      const idx = parseInt(input) - 1;
      if (!isNaN(idx) && locs[idx]) {
        location = locs[idx];
        currentStep = 4;
        errorMessage = "";
      } else {
        errorMessage = "Error: Invalid area.\n";
      }
    } 
    else if (currentStep === 4) {
      if (input.length >= 3) {
        landmark = input;
        currentStep = 5;
        errorMessage = "";
      } else {
        errorMessage = "Error: Landmark too short.\n";
      }
    }
    else if (currentStep === 5) {
      if (input === '1') {
        return await finalizeBooking(phoneNumber, hects, service, location, landmark);
      } else if (input === '2') {
        return "END Booking cancelled.";
      } else {
        errorMessage = "Error: Select 1 or 2.\n";
      }
    }
  }

  // Return the prompt for the current step (with potential error message)
  if (currentStep === 1) {
    return `CON ${errorMessage}Enter land size (hectares):`;
  }
  if (currentStep === 2) {
    const services = await prisma.service.findMany({ where: { isActive: true, isDeleted: false }, orderBy: { name: 'asc' } });
    let menu = `CON ${errorMessage}Select Service:\n`;
    services.forEach((s, i) => {
      menu += `${i + 1}. ${s.name.charAt(0).toUpperCase() + s.name.slice(1)}\n`;
    });
    return menu;
  }
  if (currentStep === 3) {
    const locs = await prisma.ussdLocation.findMany({ where: { isActive: true }, take: 6, orderBy: { name: 'asc' } });
    if (locs.length === 0) return "END No service areas available.";
    let menu = `CON ${errorMessage}Select Area:\n`;
    locs.forEach((l, i) => menu += `${i + 1}. ${l.name}\n`);
    return menu;
  }
  if (currentStep === 4) {
    return `CON ${errorMessage}Enter landmark (e.g. near school):`;
  }
  if (currentStep === 5) {
    const base = service.baseRatePerHectare * hects;
    const trans = location.chargePerHectare * hects;
    const total = base + trans;
    return `CON ${errorMessage}Confirm Booking:\nBase: ${formatNaira(base)}\nTrans: ${formatNaira(trans)}\nTotal: ${formatNaira(total)}\n\n1. Confirm\n2. Cancel`;
  }

  return "END Invalid session state.";
}

/**
 * Handle user creation and booking persistence
 */
async function finalizeBooking(phoneNumber, hects, service, location, landmark) {
  let user = await prisma.user.findUnique({ where: { phone: phoneNumber } });
  if (!user) {
    const pass = await bcrypt.hash(Math.random().toString(36), 10);
    user = await prisma.user.create({
      data: {
        name: 'USSD Member',
        phone: phoneNumber,
        passwordHash: pass,
        role: 'farmer',
        email: `${phoneNumber}@tractorlink.ussd`
      }
    });
  }

  const basePrice = service.baseRatePerHectare * hects;
  const transportPrice = location.chargePerHectare * hects;
  const total = basePrice + transportPrice;

  await prisma.booking.create({
    data: {
      farmerId: user.id,
      serviceId: service.id,
      landSize: hects,
      location: `${location.name} (${landmark})`,
      basePrice,
      distanceCharge: transportPrice,
      totalPrice: total,
      finalPrice: total,
      source: 'USSD',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      serviceNameSnapshot: service.name.charAt(0).toUpperCase() + service.name.slice(1),
      locationFixed: false
    }
  });

  return "END Booking Confirmed!\nWe will contact you shortly.";
}

/**
 * Status Flow
 */
async function processStatusFlow(phoneNumber) {
  const user = await prisma.user.findUnique({ 
    where: { phone: phoneNumber },
    include: { bookings: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  if (!user || user.bookings.length === 0) {
    return "END No active bookings found.";
  }

  const b = user.bookings[0];
  const dateStr = b.scheduledAt ? b.scheduledAt.toLocaleDateString() : 'Unscheduled';
  
  return `END Status: ${b.status.toUpperCase()}\nDate: ${dateStr}\nPrice: ${formatNaira(b.finalPrice || b.totalPrice)}`;
}
