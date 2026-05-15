# TractorLink – Product Requirement Document (PRD)

---

## 1. Project Overview

TractorLink is a centralized tractor booking and fleet management platform designed to connect farmers with mechanized agricultural services.

The system operates on a **centralized fleet model**, where all tractors and operators are managed by the admin to ensure reliability, standardized pricing, and efficient dispatch.

---

## 2. Objectives

- Enable farmers to easily request tractor services  
- Provide transparent and automated pricing  
- Optimize tractor utilization through centralized dispatch  
- Ensure real-time job tracking and status visibility  
- Maintain structured booking and payment records  
- Provide real-time notifications across all user roles  

---

## 3. User Roles & Responsibilities

### 3.1 Farmer
- Register and login via **phone number + password**
- Create booking requests with location (GPS coordinates)
- View price estimates (zone-based or fuel-based pricing)
- Track job status in real-time via Socket.IO
- View booking history with pagination and filters
- **Make digital payments** (full or partial) — cash payments are disabled
- View payment history and pending dues
- Manage profile (name, location, password, language)
- Send service requests (quick location-based request)
- Receive real-time notifications (assignment, payment, scheduling)

---

### 3.2 Admin
- Manage all bookings (view, search, filter, paginate)
- **Schedule** pending bookings (set deployment date/time)
- **Assign** operators and tractors to scheduled bookings
- Monitor fleet availability and tractor health (engine hours, maintenance alerts)
- Configure pricing rules (service rates, distance zones, fuel pricing mode)
- Configure system settings (hub name, location, coordinates, diesel price, mileage)
- **Farmer Management**: View all farmers, activate/deactivate accounts
- **Operator Management**: Direct enrollment and decommissioning of operator accounts
- **Tractor Management**: Add, edit, assign operators, monitor maintenance
- **Distance Zone Management**: Create, edit, activate/deactivate, delete zones  
- **Fuel Management**: Review operator fuel submissions (Approve/Reject), monitor consumption KPIs, and track diesel price history.
- View comprehensive analytics and reports (revenue, bookings, fleet, operators, export)
- Monitor active jobs on live tracking map (Socket.IO)
- Receive real-time notifications for new bookings and payments
- View unified financial ledger (payments + outstanding dues)

---

### 3.3 Operator
- View assigned jobs (current job + queue)
- View performance stats (hectares done, total jobs, engine hours, unit health)
- Update job status: ASSIGNED → IN_PROGRESS → COMPLETED
- Navigate to job location
- **Profile Management**: Update personal contact details (Name, Email, Phone)
- **Password Management**: Change password with old password verification
- **Language Setting**: Switch interface language
- Log fuel consumption and expenses (liters, cost, station, receipt)
- View fuel history and summary
- Broadcast real-time location via Socket.IO
- Receive real-time notifications (new assignment)

---

## 4. Core Features (Current Implementation)

### 4.1 Authentication System
- **Phone-based authentication**: All users login with phone number + password
- **JWT tokens** with 7-day expiry
- **Active status check**: Users with `status: inactive` are blocked from login
- **Role-based access control**: farmer, admin, operator
- **Middleware-enforced**: Every protected route verifies token + checks user status in DB
- **Public registration restricted to `farmer` role only**

---

### 4.2 Booking System
- Farmer inputs:
  - Service type (plough, harrow, ridge, full)
  - Land size (hectares)
  - Location (address string)
  - GPS Coordinates (latitude, longitude) for distance calculation
  - Payment option (full or partial — 'later'/cash is **disabled**)
- System generates estimated price via pricing engine
- **Price Preview**: Available before booking creation
- **Rich Quote View**: Detailed breakdown showing route from Hub to Farmer with price itemization
- Booking is created with status: **PENDING**
- System snapshots current hub/service metadata at creation time
- **Digital payment is mandatory** — booking creation throws error if `paymentOption === 'later'`

---

### 4.3 Pricing Engine
- **Dual Pricing Modes** (configured in SystemConfig):
  
  **ZONE-Based (Default):**
  - `airDistance` = haversine(hubCoords, farmerCoords)
  - `roadDistance` = airDistance × 1.3 (terrain factor)
  - Matched to a Zone tier based on roadDistance
  - `distanceCharge` = matchedZone.surchargePerHectare × landSize
  - `totalPrice` = basePrice + distanceCharge
  
  **FUEL-Based:**
  - `fuelIndex` = dieselPrice / 800
  - `adjustedKmRate` = 750 × fuelIndex
  - `distanceCharge` = adjustedKmRate × roadDistance
  - `totalPrice` = basePrice + distanceCharge

- Base rate defined per service per hectare
- **Effective Rate Management**: Admins can update rates with an `effectiveDate` (supports past, present, and future dates)
- **Historical Integrity**: Rates and Hub locations are captured at booking time to ensure the "Quote" remains consistent

---

### 4.4 Dispatch System (Two-Step)
1. **Scheduling** (Admin): Set deployment date/time → Status: PENDING → SCHEDULED
2. **Assignment** (Admin): Assign operator (auto-links their tractor) → Status: SCHEDULED → ASSIGNED
- Only operators with `availability: available` AND `status: active` AND tractor `status: AVAILABLE` can be assigned
- Assignment is atomic (transaction): booking → ASSIGNED, operator → busy, tractor → IN_USE
- Notifications sent to both operator and farmer on assignment

---

### 4.5 Job Tracking (Operator Lifecycle)
- Status flow managed by operator:
  - ASSIGNED → IN_PROGRESS → COMPLETED
- **Resource Recovery on Completion**: Atomic transaction releases operator (→ available) and tractor (→ AVAILABLE)
- **Idempotency**: Repeating same status update returns success without duplication
- **Ownership validation**: Operator can only update their own assigned bookings

---

### 4.6 Real-Time Tracking (Socket.IO)
- **Room-based architecture**:
  - `track-booking-{bookingId}` — private channel for specific job
  - `admin-tracking` — admin overview (receives all operator updates)
  - `user-{userId}` — personal notification channel
- **Events**:
  - `tracking:join` — join a tracking room
  - `location:update` — operator broadcasts GPS coordinates
  - `farmer:destination:update` — farmer location broadcast
  - `notification:new` — real-time notification delivery
  - `new:request` — new service request broadcast

---

### 4.7 Payment System
- **Digital-only payments** by farmer (cash/admin settlement is disabled)
- Payment processed per booking via `POST /api/payments/pay-booking`
- **Automatic status calculation**:
  - `PAID` if paidAmount ≥ finalPrice
  - `PARTIAL` if paidAmount ≥ 50% of finalPrice
  - `PENDING` otherwise
- `paymentStatus` is **decoupled** from booking `status` — they are independent fields
- Admin financial ledger shows combined payments + outstanding dues
- Notifications sent to farmer and all admins on payment

---

### 4.8 Notification System
- **Persistent notifications** stored in `notifications` table
- **Real-time delivery** via Socket.IO to user-specific rooms
- **Role-scoped**: Each notification has a role (admin/farmer/operator) and type (booking/assignment/tracking/payment)
- **Management**: Users can mark as read, mark all read, delete individual, delete all
- **Triggered on**: Booking creation, scheduling, assignment, payment

---

### 4.9 Service Request System
- Quick request from farmer with service type and GPS location
- Admin can view all requests and accept them
- Real-time broadcast via Socket.IO (`new:request`, `request:updated`)
- **Fallback**: Works with in-memory storage if `ServiceRequest` model is not available

---

### 4.10 User Enrollment & Access Control
- **Farmer Registration**: Self-service signup via the public portal. Restricted to `farmer` role.
- **Internal Accounts**: Admins and Operators must be enrolled manually by an existing administrator.
- **Profile Independence**: Operators and Farmers can manage their own profile details and platform interface language.
- **Farmer Status Control**: Admins can activate/deactivate farmer accounts.

---

### 4.11 Fleet Management
- **Tractor CRUD**: Admin can add, edit, assign operators to tractors
- **1-to-1 mapping**: Each tractor linked to one operator (enforced by unique constraint)
- **Auto-maintenance**: Tractors automatically set to `MAINTENANCE` when `hoursRemaining ≤ 50`
- **Tractor Statuses**: `AVAILABLE`, `IN_USE`, `MAINTENANCE`
- **Engine tracking**: engineHours, nextServiceDueHours, lastServiceDate

---

### 4.12 Analytics & Reports
- Revenue reports (7d / 30d / 1y time ranges)
- Service usage distribution
- Bookings analytics (total vs completed)
- Operator performance ranking (top 5)
- Tractor profitability (net revenue per machine)
- Job status distribution
- Fleet utilization metrics
- Farmer growth/registration trends
- **Fuel Analytics**: Consumption per hectare and kilometer monitoring.
- **Export**: Raw data export for bookings, revenue, operators

---

## 5. Business Logic (Core System Rules)

### 5.1 Booking Logic
- Each booking is linked to:
  - One farmer  
  - One service  
  - One location (address + GPS coordinates)
- Booking is created with status **PENDING**
- Payment status starts as **PENDING**

---

### 5.2 Status Lifecycle

Bookings must follow this order:

**PENDING → SCHEDULED → ASSIGNED → IN_PROGRESS → COMPLETED**

- `paymentStatus` (PENDING → PARTIAL → PAID) is tracked **separately** and does not affect booking status
- Invalid transitions are blocked with `INVALID_TRANSITION` error

---

### 5.3 Pricing Logic

Total Price = (Base Rate × Land Size) + Distance Surcharge

- **Historical Integrity**: Rates and Hub locations are captured at booking time
- **base_price** = service.baseRatePerHectare × landSize
- **distance_charge** = zone.surchargePerHectare × landSize (ZONE mode) or adjustedKmRate × roadDistance (FUEL mode)
- **fuel_surcharge** = 0 (kept for schema compatibility, not actively used)
- **total_price** = base_price + distance_charge
- **final_price** = total_price (no additional adjustments currently)

---

### 5.4 Dispatch Logic
- Only operators with `availability: available` can be assigned  
- Only tractors with `status: AVAILABLE` can be assigned
- Each booking can have only one active assignment  
- Assignment is atomic (Prisma transaction)

---

### 5.5 Resource Management
- One tractor is linked to one operator (unique constraint)
- On Assignment:
  - Operator availability → `busy`
  - Tractor status → `IN_USE`
- On Completion:
  - Operator availability → `available`  
  - Tractor status → `AVAILABLE`

---

### 5.6 Operator Rules
- Operators can only view their own assigned jobs  
- Operators cannot modify booking details  
- Status updates validated against ownership

---

### 5.7 Payment Logic
- Digital payment only (cash/admin settlement disabled)
- Payment is linked to booking via `bookingId`
- Multiple payments per booking supported (incremental)
- `paymentStatus` auto-calculated: PENDING → PARTIAL (≥50%) → PAID (≥100%)

---

## 6. Data Model Overview

The system is centered around the **Booking entity**, which connects:

- Farmer (User)
- Service  
- Tractor  
- Operator (User)
- Payment(s)

Supporting entities:
- SystemConfig (singleton pricing/hub configuration)
- Zone (distance-based pricing tiers)
- FuelLog (operator fuel tracking)
- FuelPriceLog (diesel price change audit trail)
- Notification (cross-role notification system)

---

## 7. Non-Functional Requirements

- Scalable system architecture  
- Optimized API performance with pagination
- Data consistency via Prisma transactions
- Secure authentication (JWT-based with DB user verification)
- Role-based access control (middleware-enforced)
- Real-time communication (Socket.IO)

---

## 8. Assumptions

- All tractors are centrally managed  
- Farmers do not choose operators directly  
- Location is captured via GPS coordinates (latitude/longitude)
- Pricing is configurable by admin (zone-based or fuel-based)
- All payments are digital (no cash transactions)

---

## 9. Future Enhancements

- USSD-based booking system  
- Automatic dispatch (algorithm-based)  
- Payment gateway integration (Paystack, Flutterwave)
- Multi-language support (currently en/naira)
- Advanced analytics with AI insights
- Mobile app (React Native)

---

## 10. Success Criteria

- Farmers can successfully create bookings with GPS-based pricing
- Admin can schedule and assign resources without conflict  
- Operators complete jobs with correct status updates and resource recovery
- Payments are recorded accurately with automatic status tracking
- System handles real-time tracking and notifications
- All status transitions are enforced and validated

---