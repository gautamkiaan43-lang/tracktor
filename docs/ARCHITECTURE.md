# TractorLink – Backend Architecture

---

## 1. Overview

The TractorLink backend is designed using a modular, layered architecture to support a centralized tractor booking and fleet management system.

The architecture ensures:
- Clear separation of concerns
- Maintainability and scalability
- Consistent coding standards
- Real-time communication via Socket.IO
- Persistent notification system

---

## 2. Tech Stack

- Runtime: Node.js (ES Modules)
- Framework: Express.js
- ORM: Prisma ORM
- Database: MySQL
- Authentication: JWT (JSON Web Tokens)
- Validation: Zod (Schema validation)
- Real-Time: Socket.IO (HTTP server + WebSocket)
- Password Hashing: bcryptjs
- Storage: Multer (Local disk storage for receipts)
- Frontend Connectivity: Vite Environment Variables (VITE_API_BASE_URL)

---

## 3. Architecture Pattern

```
Client → Routes → Controllers → Services → Database (Prisma)
                                    ↕
                            Socket.IO (Real-Time)
                                    ↕
                          Notification Service
```

Each layer has a clearly defined responsibility.

---

## 4. Directory Structure

```
backend/
├── src/                      # Core application source
│   ├── controllers/          # Request handlers
│   │   ├── admin/            # Admin controllers (admin, assignment, dashboard, dispatch, report, settings)
│   │   ├── auth/             # Authentication controller
│   │   ├── farmer/           # Farmer controllers (booking, dashboard, payment, profile, service)
│   │   ├── operator/         # Operator controllers (fuel, job, profile)
│   │   ├── notification.controller.js
│   │   └── request.controller.js
│   ├── routes/               # API endpoints
│   │   ├── admin.routes.js
│   │   ├── auth.routes.js
│   │   ├── farmer.routes.js
│   │   ├── notification.routes.js
│   │   ├── operator.routes.js
│   │   ├── payment.routes.js
│   │   └── request.routes.js
│   ├── services/             # Business logic (Core)
│   │   ├── admin.service.js         # Booking mgmt, dispatch, fleet, operators, farmers, dashboard
│   │   ├── auth.service.js          # Registration, login, user lookup
│   │   ├── booking.service.js       # Pricing engine, booking CRUD
│   │   ├── farmer.service.js        # Farmer dashboard metrics, activity, jobs
│   │   ├── fuel.service.js          # Operator fuel logging
│   │   ├── notification.service.js  # Real-time + persistent notifications
│   │   ├── operator.service.js      # Job lifecycle, stats
│   │   ├── payment.service.js       # Farmer payments, ledger
│   │   ├── report.service.js        # Analytics & reports
│   │   └── settings.service.js      # System config, zones, services
│   ├── schema/               # Zod validation schemas
│   │   ├── auth.schema.js
│   │   ├── booking.schema.js
│   │   └── farmer.schema.js
│   ├── middleware/            # Auth & validation
│   │   └── auth.middleware.js
│   ├── config/               # System configuration
│   │   └── db.js             # Prisma client singleton
│   ├── utils/                # Utility functions
│   │   ├── format.js         # Currency formatting
│   │   └── response.js       # Standard API response helpers
│   └── index.js              # Server entry point (Express + Socket.IO)
├── docs/                     # System documentation (.md)
├── prisma/                   # Database schema & migrations
│   ├── schema.prisma
│   ├── seed.js
│   └── migrations/
├── scripts/                  # Maintenance & test scripts
├── .env                      # Environment variables
└── package.json              # Dependencies
```

---

## 5. Layer Responsibilities

### Routes Layer
- Defines API endpoints
- Connects routes to controllers
- Applies middleware (auth, role check)
- No business logic allowed
- 7 route modules: auth, farmer, admin, operator, payment, request, notification

---

### Controllers Layer
- Handles request and response
- Extracts data from:
  - req.body
  - req.params
  - req.query
  - req.user (injected by auth middleware)
- Calls services to perform operations
- Returns formatted API response using `sendSuccess` / `sendError`
- May trigger notifications via NotificationService (async, non-blocking)
- No database queries here

---

### Services Layer (Core Logic)

This is the most important layer.

Responsibilities:
- Business logic implementation
- Pricing calculation (zone-based and fuel-based)
- Dispatch logic (scheduling + assignment)
- Status transition validation
- Resource locking/release (atomic transactions)
- Historical data snapshotting

Rules:
- Prisma is used only here
- Functions must be reusable
- Keep logic modular

**10 Service Modules:**

| Service | Responsibility |
|:---|:---|
| `admin.service.js` | Booking management, operator dispatch, fleet monitoring, farmer/operator management, dashboard metrics |
| `auth.service.js` | User registration, login authentication, user lookup |
| `booking.service.js` | Price calculation engine, booking CRUD, farmer booking queries |
| `farmer.service.js` | Farmer dashboard metrics, recent activity, upcoming jobs |
| `fuel.service.js` | Operator fuel log CRUD, consumption summary, **Admin review lifecycle (Approval/Rejection)** |
| `notification.service.js` | Persistent + real-time notification delivery (class-based) |
| `operator.service.js` | Job lifecycle management, stats, status transitions |
| `payment.service.js` | Farmer payment processing, pending dues, manual back-office settlement |
| `report.service.js` | Revenue, service usage, bookings analytics, operator performance, fleet health, farmer growth, data export |
| `settings.service.js` | System config CRUD, zone management, service rate management, **USSD Location management** |

---

### Prisma Layer
- Defines database schema in `prisma/schema.prisma`
- Handles all DB queries via Prisma Client
- Accessed only through services
- Singleton instance in `src/config/db.js`

---

### Middleware Layer
- **Authentication** (`verifyToken`): JWT verification + DB user lookup + active status check
- **Role-based authorization** (`requireRole`): Array of allowed roles
- Applied at route level, not controller level

---

### Notification Layer
- Class-based service (`NotificationService`)
- Two methods: `notifyAdmins(io, payload)` and `notifyUser(io, userId, role, payload)`
- Persists notifications in DB via `prisma.notification.createMany` / `create`
- Broadcasts via Socket.IO to role-specific rooms
- Called asynchronously from controllers (fire-and-forget, errors caught silently)

---

## 6. Frontend Connectivity (Centralized API)

The system uses a centralized API configuration for the frontend to maintain compatibility across different environments (local vs production).

- **Location**: `frontend/src/config/api.js`
- **Mechanism**: Reads `import.meta.env.VITE_API_BASE_URL`.
- **Default**: Falls back to `http://localhost:5000` if no env is set.
- **Usage**: All axios/fetch calls and Socket.IO initializations must import and use this `API_BASE_URL` constant.

---

## 7. Server Entry Point (`src/index.js`)

The entry point sets up:
1. Express app with CORS and JSON middleware
2. HTTP server wrapping Express
3. Socket.IO server with CORS configuration
4. In-memory `roomsState` Map for tracking state
5. All 7 route modules mounted under `/api/`
6. Socket.IO event handlers:
   - `tracking:join` — room management
   - `location:update` — operator GPS broadcasting
   - `farmer:destination:update` — farmer location broadcasting
7. Global error handler and 404 handler

---

## 7. Core System Rules

### No Logic in Routes
Routes should only map endpoints to controllers and apply middleware.

### Controllers Are Thin
Controllers only:
- Receive request
- Validate input (Zod where applicable)
- Call service
- Trigger notifications (async)
- Send response

### Services Contain All Logic
All business rules must be implemented in services.

### Database Access Rule
- Prisma queries only inside services
- Never in controllers or routes
- **Exception**: `notification.controller.js` and `request.controller.js` access Prisma directly (legacy pattern — should be refactored)

### Historical Consistency Rule
- Critical metadata like Hub Name, Hub Location, and Hub Coordinates must be "snapshotted" in the Booking record at creation time.
- This ensures that old quotes remain accurate even if global settings change.
- Never recalculate historical pricing or locations using current master data.

### Status Control Rule
Booking status must follow strict order:

**PENDING → SCHEDULED → ASSIGNED → IN_PROGRESS → COMPLETED**

- `paymentStatus` (PENDING | PARTIAL | PAID) is tracked independently
- Invalid transitions must be blocked with `INVALID_TRANSITION` error

---

## 8. API Design Standards

### REST Principles
- GET → Fetch data
- POST → Create
- PUT/PATCH → Update
- DELETE → Remove

### Standard Response Format

```json
{
  "success": true,
  "data": {},
  "message": "Success"
}
```

### Error Response

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Error message"
}
```

### Pagination Pattern
Used in: Admin Bookings, Admin Payments, Farmer Bookings
```json
{
  "data": [...],
  "totalPages": 5,
  "currentPage": 1,
  "totalCount": 40
}
```

---

## 9. Authentication & Authorization

- JWT-based authentication (7-day token expiry)
- **Phone-based login** (not email)
- Role-based access control:
  - Farmer
  - Admin
  - Operator

Middleware must:
- Verify JWT token
- Look up user in database
- Check `status === 'active'` (inactive users blocked)
- Attach user object to `req.user`
- Check role permissions via `requireRole()`

---

## 10. Validation Strategy

- Use Zod schemas for request validation
- Current schemas:
  - `auth.schema.js` — register (name, phone, email?, password, role) and login (phone, password)
  - `booking.schema.js` — booking creation and price preview
  - `farmer.schema.js` — farmer status update
- Validate: Body, Params, Query
- Invalid requests rejected before reaching services

---

## 11. Real-Time Architecture (Socket.IO)

### Room Architecture
| Room | Purpose | Joined By |
|:---|:---|:---|
| `track-booking-{bookingId}` | Private job tracking channel | Operator + Farmer |
| `admin-tracking` | Admin overview (all operator updates) | Admin |
| `user-{userId}` | Personal notification delivery | All users |
| `default-room` | Legacy backward compatibility | Any |

### Event Flow
| Event | Direction | Payload |
|:---|:---|:---|
| `tracking:join` | Client → Server | `{ roomId, role, bookingId, operatorId, userId }` |
| `tracking:state` | Server → Client | Current room state |
| `location:update` | Bidirectional | `{ lat, lng, timestamp, operatorId, bookingId }` |
| `farmer:destination:update` | Bidirectional | `{ lat, lng, bookingId }` |
| `notification:new` | Server → Client | `{ message, type, metadata, createdAt }` |
| `new:request` | Server → Client | Service request object |
| `request:updated` | Server → Client | Updated request object |

---

## 12. Implementation Workflow

1. Define models in prisma/schema.prisma
2. Run: `npx prisma generate` (and `npx prisma migrate dev` for migrations)
3. Create service logic
4. Create controller
5. Define route
6. Add validation (Zod)
7. Add notifications if needed
8. Test endpoint

---

## 13. Scalability Considerations

- Modular service-based structure
- Easy to convert into microservices
- Add caching (Redis) in future
- Add queue system for dispatch
- Socket.IO can be scaled with Redis adapter
- Notification service designed for bulk operations

---

## 14. Security Standards

- Hash passwords using bcrypt (10 salt rounds)
- Use JWT for authentication with DB user verification on every request
- Validate all inputs using Zod
- Protect sensitive routes with `verifyToken` + `requireRole`
- Check `status: active` on every authenticated request (not just login)
- Do not expose internal errors (generic error messages in production)
- Atomic transactions for state-changing operations (assignment, completion)

---

## Conclusion

This architecture ensures a clean, scalable, and maintainable backend system with strict separation of concerns, real-time communication capabilities, and well-defined responsibilities across all layers.