import { getPendingBookings, getAvailableOperators, assignOperator } from '../src/services/admin.service.js';

async function test() {
  try {
    console.log("Fetching bookings...");
    const bookings = await getPendingBookings();
    console.log("Pending Bookings:", bookings);

    console.log("\Fetching operators...");
    const operators = await getAvailableOperators();
    console.log("Available Operators:", operators);

    // If there is at least one operator, we can try assigning. But maybe no booking exists yet in demo DB.
    if (bookings.length > 0 && operators.length > 0) {
      console.log(`\nAssigning Booking ${bookings[0].id} to Operator ${operators[0].id}...`);
      const result = await assignOperator(bookings[0].id, operators[0].id);
      console.log("Assign Result:", result);
    } else {
      console.log("\nNo bookings or operators to assign.");
    }
  } catch (error) {
    console.error("Test Error:", error);
  }
}

test();

