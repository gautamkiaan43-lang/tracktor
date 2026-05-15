# TractorLink – Business Flow & State Transitions

---

## 1. Booking Lifecycle Flow

A booking must follow this strict sequence. Status transitions cannot be skipped.

1. **PENDING** (Farmer creates a booking request)
   - System calculates price (Zone-based or Fuel-based)
   - System snapshots hub/service metadata into the Booking record
   - **Mandatory Digital Payment**: Farmer must select 'Full' or 'Partial' (50%) payment.
   - **Pay to Book**: Booking created via `checkout` which ensures payment is recorded.
   - Booking created with `status: PENDING`, `paymentStatus: PARTIAL` or `PAID`.

2. **SCHEDULED** (Admin sets official deployment Date & Time)
   - Admin reviews pending booking and sets `scheduledAt`
   - Farmer receives notification about scheduling

3. **ASSIGNED** (Admin assigns operator + tractor)
   - Admin selects an available operator (auto-links their tractor)
   - Atomic transaction: booking → ASSIGNED, operator → busy, tractor → IN_USE
   - Both operator and farmer receive notifications

4. **IN_PROGRESS** (Operator starts work on-site)
   - Operator updates status from ASSIGNED → IN_PROGRESS
   - Real-time location tracking active via Socket.IO

5. **COMPLETED** (Operator finishes work)
   - Atomic transaction:
     - Booking status → COMPLETED
     - Operator availability → available
     - Tractor status → AVAILABLE

---

## 2. Payment Status Flow (Decoupled)

Payment status is tracked **independently** from the booking work status via `paymentStatus`.

| Payment Status | Condition |
|:---|:---|
| **PENDING** | No payments recorded yet (Initial state for draft bookings) |
| **PARTIAL** | Total paid ≥ 50% of finalPrice |
| **PAID** | Total paid ≥ 100% of finalPrice |

- Multiple payments per booking are supported.
- `paymentStatus` is automatically recalculated on each payment.
- Payments are **digital only**. Admin manual settlement is **disabled** for security.

---

## 3. Pricing Logic & Terrain Factor

Pricing is calculated using one of two modes defined in `SystemConfig`:

### 3.1 Terrain Factor
All distance calculations use a **1.3 Terrain Factor** (Client Requirement) to account for road distances vs air distances.
`roadDistance = airDistance * 1.3`

### 3.2 Pricing Modes
1.  **ZONE (Default)**:
    - Matches `roadDistance` against active distance zones.
    - `distanceCharge = zone.surchargePerHectare * landSize`
2.  **FUEL**:
    - Dynamic pricing based on current diesel price.
    - `fuel_index = diesel_price / 800`
    - `per_km_rate = 750 * fuel_index`
    - `distanceCharge = per_km_rate * roadDistance`

---

## 4. Status Transition Rules

### 4.1 Booking Status Transitions

| Current Status | Next Allowed Status | Action | Actor |
|:---|:---|:---|:---|
| *(none)* | PENDING | Create Booking | Farmer |
| PENDING | SCHEDULED | Schedule (set date/time) | Admin |
| SCHEDULED | ASSIGNED | Assign Operator + Tractor | Admin |
| ASSIGNED | IN_PROGRESS | Start Work | Operator |
| IN_PROGRESS | COMPLETED | Finish Work | Operator |

### 4.2 Status Transition Validator (Current Code)

```javascript
const allowedTransitions = {
  SCHEDULED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: []
};
```

---

## 5. Strict Business Rules

### 5.1 No Skipping Steps
- Status must follow defined order: PENDING → SCHEDULED → ASSIGNED → IN_PROGRESS → COMPLETED

### 5.2 Resource Locking
- **At ASSIGNED**: Operator availability → `busy`, Tractor status → `IN_USE`.
- **At COMPLETED**: Operator availability → `available`, Tractor status → `AVAILABLE`.

### 5.3 Maintenance Rule
- Tractors with `< 50` hours remaining until next service are auto-flagged as `MAINTENANCE`.
- Maintenance tractors cannot be assigned to new bookings.

---

## 6. Notification Flow

Notifications are triggered at key lifecycle events:

| Event | Recipients | Type |
|:---|:---|:---|
| Booking Created | Admin | `booking` |
| Payment Received | Admin | `payment` |
| Booking Scheduled | Farmer | `booking` |
| Operator Assigned | Operator + Farmer | `assignment` |
| Job Completed | Farmer + Admin | `tracking` |

---

## 7. Real-Time Tracking Flow

Operators broadcast their location via Socket.IO during `IN_PROGRESS` state.
- **Room**: `track-booking-{bookingId}` for Farmer.
- **Admin Room**: `admin-tracking` for global fleet monitoring.

---

## 8. User Registration & Auth

### 8.1 Authentication
- Primary identifier: **Phone Number**.
- System automatically generates an internal email for every user: `phone@tractorlink.app`.

### 8.2 Role-Based Registry
- **Farmers**: Can self-register or be added by Admin via the Registry Enrollment.
- **Operators**: Must be added by Admin. They are tied to a specific tractor.

---

## 9. Admin Fuel Management Flow

This flow handles the lifecycle of fuel expense tracking and validation.

1. **Submission** (Operator):
   - Operator submits a fuel log (liters, cost, station) + Receipt Image.
   - Entry created with `status: PENDING`.
2. **Review** (Admin):
   - Admin reviews the receipt and log details.
   - Admin sets status to `APPROVED` or `REJECTED`.
3. **Audit**:
   - Every change to global `dieselPrice` creates an entry in `fuel_price_logs` index (audit trail).

---

## 10. Summary

This flow ensures:
- Mandatory digital payments for service security.
- Accurate distance-based pricing with Nigerian terrain adjustments.
- Automated maintenance tracking for fleet longevity.
- Real-time location visibility for farmers.