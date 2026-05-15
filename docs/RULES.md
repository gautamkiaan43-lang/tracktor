# TractorLink – AI Development Rules & Guardrails

This document defines strict rules for any AI agent or developer working on the TractorLink backend.

---

## 1. Code Integrity & Safety

- Do not overwrite or delete existing logic unless explicitly required
- Always extend or refactor carefully
- Avoid breaking existing functionality
- Ensure idempotent operations (repeat-safe logic)
- Test status transitions before deploying changes

---

## 2. Architectural Consistency

Follow strict layer separation:

**Routes → Controllers → Services → Prisma**

### Rules:
- Routes: Only endpoints + middleware
- Controllers: Request handling + service calls + notification triggers (async)
- Services: All business logic + Prisma queries
- Prisma: Only inside services

No direct database access in controllers or routes.

> **Known Exceptions**: `notification.controller.js` and `request.controller.js` currently access Prisma directly. These should be refactored into proper services in future.

---

## 3. Programming Standards

- Use async/await only (no .then chains)
- Use Prisma ORM for all DB operations
- Validate all inputs using Zod schemas
- Keep functions small and reusable
- Return structured responses using `sendSuccess` / `sendError` utilities
- Use `prisma.$transaction()` for atomic multi-model updates

---

## 4. Naming Conventions

- Database: snake_case (enforced via @map / @@map)
- Backend code:
  - variables/functions → camelCase
  - constants → UPPER_SNAKE_CASE
  - Status values → UPPER_SNAKE_CASE (e.g., `PENDING`, `ASSIGNED`, `IN_PROGRESS`)

Maintain consistency across the codebase.

---

## 5. Error Handling & Security

- Use centralized error middleware (in `index.js`)
- Use `sendError(res, message, statusCode, errorCode)` for all error responses
- Do not expose sensitive data (passwords, tokens, internal errors)
- Do not log secrets
- Follow standard API response format: `{ success, data, message }`

---

## 6. Business Logic Enforcement

### Status Lifecycle (CRITICAL)
- Booking status must follow: **PENDING → SCHEDULED → ASSIGNED → IN_PROGRESS → COMPLETED**
- Never skip lifecycle steps
- Invalid transitions must return `INVALID_TRANSITION` error
- There is **NO** `EN_ROUTE` status — operators go directly from ASSIGNED to IN_PROGRESS
- There is **NO** `PAID` booking status — payment is tracked via `paymentStatus` (PENDING | PARTIAL | PAID)
- There is **NO** `DISPATCHED` status — it was renamed to `ASSIGNED`

### Role-Based Actions:
| Role | Allowed Status Transitions |
|:---|:---|
| Farmer | Create booking (→ PENDING) |
| Admin | Schedule (→ SCHEDULED), Assign (→ ASSIGNED) |
| Operator | Start work (→ IN_PROGRESS), Complete (→ COMPLETED) |

---

## 7. AI-Specific Guardrails

Before making any change, AI must:

- Read:
  - PRD.md
  - ARCHITECTURE.md
  - DATABASE.md
  - API_SPEC.md
  - FLOW.md
  - RULES.md (this file)

- Understand:
  - Current status lifecycle (PENDING → SCHEDULED → ASSIGNED → IN_PROGRESS → COMPLETED)
  - Decoupled paymentStatus (PENDING → PARTIAL → PAID)
  - Decoupled User fields (status=auth, availability=dispatch)
  - Role permissions and ownership validation
  - Phone-based authentication (not email)
  - Digital-only payments (cash/admin settlement disabled)

- Then implement changes

---

## 8. Change Management Rules (VERY IMPORTANT)

### 8.1 Backward Compatibility
- Never break existing APIs
- If changes are needed:
  - Extend instead of modifying
  - Add new fields instead of removing old ones

---

### 8.2 Feature Extension Rule
- New features must:
  - Follow existing architecture (Routes → Controllers → Services)
  - Reuse services when possible
  - Not duplicate logic
  - Use existing notification patterns for user feedback

---

### 8.3 Schema Update Rule
- If database schema changes:
  - Update `prisma/schema.prisma`
  - Update `docs/DATABASE.md`
  - Run `npx prisma generate`
  - Run `npx prisma migrate dev` if structural changes

---

### 8.4 API Change Rule
- Do not modify existing API contracts
- If required:
  - Create new endpoints
  - Maintain old endpoints
  - Update `docs/API_SPEC.md`

---

### 8.5 Dependency Safety
- Avoid introducing heavy dependencies
- Ensure new libraries do not break existing system
- Current key deps: express, prisma, bcryptjs, jsonwebtoken, zod, socket.io, cors, dotenv

---

### 8.6 Documentation Update Rule
- After making code changes, **always update** the relevant .md files in `docs/`:
  - Schema changes → DATABASE.md
  - New endpoints → API_SPEC.md
  - Status flow changes → FLOW.md
  - Architecture changes → ARCHITECTURE.md
  - Business logic changes → PRD.md + RULES.md

---

## 9. Complexity Control Rules

- Avoid deeply nested logic
- Break large functions into smaller ones
- Keep services modular
- Avoid duplicate logic across files
- Use Prisma transactions for multi-model atomic operations

---

## 10. Forbidden Actions

### Code Quality
- Do not use `var` (use `const`/`let`)
- Do not hardcode secrets (use `.env`)
- Do not bypass validation
- Do not write business logic in frontend
- Do not skip status validation
- Do not directly update DB without service layer

### Status & Lifecycle
- **Never** use `DISPATCHED` — it has been renamed to `ASSIGNED`
- **Never** use `EN_ROUTE` — this status no longer exists
- **Never** use `PAID` as a booking status — use `paymentStatus` field instead
- **Never** mix `User.status` (auth) with `User.availability` (dispatch)
- **Never** use `email` for login — system uses `phone`-based authentication

### Payment Rules
- **Admin Settlement Disabled**: The `settleBooking` endpoint exists but throws an error. All payments must be digital.
- **Cash Settlement Disabled**: `settleAllDues` throws an error. Use per-booking digital payment only.
- **Financial Integrity**: Payment status must be derived from actual ledger entry metrics (`sum(payments.amount)` vs `finalPrice`) rather than trusting string status alone.
- **Payment Method Default**: New farmer payments default to `method: 'online'`

### User Management
- **Registration Restriction**: Public registration MUST only permit the `farmer` role.
- **Operator Lifecycle**: Operators MUST be created by an Admin and cannot self-register.
- **Profile Integrity**: Operator profile updates MUST validate email uniqueness and maintain the `operator` role.
- **Access Control**: Users with `status: inactive` MUST be blocked from authentication (checked in BOTH login AND middleware).

### Data Integrity
- **Historical Integrity**: Do NOT recalculate prices or locations for existing bookings using current configuration; always use the snapshot fields (`hubName`, `hubLocation`, `hubLatitude`, `hubLongitude`, `serviceNameSnapshot`).
- **Service Rate Flexibility**: Do NOT restrict `effectiveDate` to future dates; allow past and present dates for adjustments.
- **Zone Validation**: When creating/updating zones, validate for overlaps, gaps, and ensure only one open-ended zone exists.
- **Tractor Maintenance**: Do NOT allow assigning a tractor in MAINTENANCE status to a booking.
- **1-to-1 Tractor-Operator**: When assigning an operator to a tractor, unassign their previous tractor first (enforced by unique constraint).

### Notification Rules
- **Async Fire-and-Forget**: Notification errors should NEVER block the main operation. Catch and log silently.
- **Dual Delivery**: All notifications must be both persisted (DB) and broadcast (Socket.IO).
- **Role Scoping**: Notifications are always scoped to a specific role in the DB for proper filtering.

---

## 11. Current System State Reference

### Active Booking Statuses
`PENDING`, `SCHEDULED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`

### Active Payment Statuses (paymentStatus field)
`PENDING`, `PARTIAL`, `PAID`

### Active User Statuses (status field — auth only)
`active`, `inactive`

### Active User Availability (availability field — dispatch only)
`available`, `busy`

### Active Tractor Statuses
`AVAILABLE`, `IN_USE`, `MAINTENANCE`

### Active Zone Statuses
`ACTIVE`, `INACTIVE`

### Pricing Modes
`ZONE` (default), `FUEL`

### Payment Methods
`cash`, `online`, `mobile_money`, `bank_transfer`, `admin_settlement`

### User Roles
`farmer`, `admin`, `operator`

### Notification Types
`booking`, `assignment`, `tracking`, `payment`, `general`

---

## Conclusion

These rules ensure:
- Stable system behavior
- Scalable architecture
- Safe future development
- Consistent AI-generated code
- Data integrity across all operations

All contributors and AI agents must strictly follow these rules.