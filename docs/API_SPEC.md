# TractorLink – API Specification

This document defines all RESTful API endpoints for the TractorLink backend.

---

## 1. Authentication APIs (`/api/auth`)

### POST /api/auth/register
- Description: Register a new user (**Farmer Only**)
- Body: `{ name, phone, password }`
- Logic: Role is hardcoded to `farmer`.

### POST /api/auth/login
- Description: Authenticate user and return JWT token
- Body: `{ phone, password }`
- Returns: JWT (7-day expiry) + user object.

### GET /api/auth/me
- Description: Get logged-in user profile
- Protected: Yes

---

## 2. Farmer APIs (`/api/farmer`)

### Metadata (Shared Roles)
- **GET /api/farmer/services**: List all available services and rates.
- **GET /api/farmer/settings/config**: Get global system configuration.
- **GET /api/farmer/zones**: List all distance-based pricing zones.

### Dashboard
- **GET /api/farmer/dashboard**: Get summary metrics for the farmer dashboard.
- **GET /api/farmer/recent-activity**: Get recent job activity.
- **GET /api/farmer/upcoming-jobs**: Get list of upcoming scheduled jobs.

### Bookings
- **POST /api/farmer/price-preview**: Calculate estimated price for a potential booking.
- **POST /api/farmer/bookings**: Create a pending booking.
- **POST /api/farmer/checkout**: Atomic "Pay to Book" flow (booking + initial payment).
- **GET /api/farmer/bookings**: List all bookings for the farmer (paginated).
- **GET /api/farmer/bookings/:id**: Get specific booking details.

### Profile
- **GET /api/farmer/profile**: Get profile details.
- **PATCH /api/farmer/profile**: Update name/phone/location.
- **PATCH /api/farmer/change-password**: Update password.
- **PATCH /api/farmer/language**: Update interface language preference.

---

## 3. Admin APIs (`/api/admin`)

### Dashboard
- **GET /api/admin/dashboard/metrics**: Core KPIs for admin dashboard.
- **GET /api/admin/dashboard/assignment-queue**: List of pending/scheduled jobs needing attention.
- **GET /api/admin/dashboard/revenue**: Revenue analytics data.
- **GET /api/admin/dashboard/fleet**: Fleet status summary.
- **GET /api/admin/dashboard/active-jobs**: Currently running jobs on the map.

### Operations & Finance
- **GET /api/admin/bookings**: Searchable/paginated list of all system bookings.
- **GET /api/admin/bookings/:id**: Detail view for a booking.
- **GET /api/admin/payments**: Master ledger of all payments.
- **POST /api/admin/payments/record-cash**: Back-office tool to record manual payments.
- **PUT /api/admin/bookings/:id/fix-location**: Manually fix GPS data for USSD bookings.

### Dispatch & Assignments
- **GET /api/admin/pending-assignment**: List of jobs ready for scheduling/assignment.
- **PUT /api/admin/schedule/:bookingId**: Transition PENDING → SCHEDULED.
- **GET /api/admin/operators**: List of operators available for assignment.
- **PUT /api/admin/assign/:bookingId**: Transition SCHEDULED → ASSIGNED.

### Registry Management
- **GET /api/admin/farmers**: List all registered farmers.
- **PUT /api/admin/farmers/:id/status**: Activate/Deactivate farmer accounts.
- **GET /api/admin/operator-list**: List all operators.
- **POST /api/admin/operators**: Enroll a new operator.
- **DELETE /api/admin/operators/:id**: Decommission an operator account.
- **GET /api/admin/tractors**: List all tractors in the fleet.
- **POST /api/admin/tractors**: Add a new tractor.
- **PUT /api/admin/tractors/:id**: Update tractor metadata or operator linkage.

### Fuel Management (Admin)
- **GET /api/admin/fuel-logs**: List of all operator fuel submissions.
- **GET /api/admin/fuel-logs/kpi**: Fuel management core metrics.
- **GET /api/admin/fuel-analytics**: Consumption vs Work analytics.
- **PUT /api/admin/fuel-logs/:id/status**: Approve or Reject a fuel log entry.

### Reports
- **GET /api/admin/reports/revenue**: Deep-dive revenue reports.
- **GET /api/admin/reports/service-usage**: Demand distribution by service type.
- **GET /api/admin/reports/fleet**: Maintenance and health analysis.
- **GET /api/admin/reports/operators**: Performance ranking and hectares monitoring.
- **GET /api/admin/reports/export**: CSV/PDF data export endpoint.

### System Settings
- **GET /api/admin/settings/config**: Global system configuration toggle.
- **POST /api/admin/settings/config**: Update hub, pricing mode, or fuel prices.
- **GET /api/admin/settings/fuel-history**: Audit trail of fuel price changes.
- **GET /api/admin/settings/zones**: CRUD for distance zones.
- **GET /api/admin/settings/ussd-locations**: CRUD for offline USSD location registry.

---

## 4. Operator APIs (`/api/operator`)

### Job Execution
- **GET /api/operator/jobs**: Fetch current assigned job and upcoming queue.
- **GET /api/operator/stats**: Personal performance KPIs (hectares, work hours).
- **PATCH /api/operator/job-status/:id**: Update status (ASSIGNED → IN_PROGRESS → COMPLETED).

### Fuel Logs
- **POST /api/operator/fuel**: Submit a new fuel log with receipt image upload.
- **GET /api/operator/fuel**: Personal fuel log history.
- **GET /api/operator/fuel/summary**: Aggregated fuel spend summary.

### Profile
- **GET /api/operator/profile**: Get profile details and tractor info.
- **PATCH /api/operator/profile**: Update personal contact info.
- **PATCH /api/operator/change-password**: Change password.
- **PATCH /api/operator/language**: Update UI language.

---

## 5. Standard Response Format

### Success
```json
{
  "success": true,
  "data": {},
  "message": "Success message"
}
```

### Error
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Error details"
}
```