# TractorLink – Database Design

This document defines the MySQL database schema and Prisma ORM configuration for the TractorLink system.

---

## 1. Database Standards

To ensure consistency and prevent case-sensitivity issues, the following rules are mandatory:

- Table Names: lowercase, plural, snake_case (e.g., users, bookings)
- Column Names: lowercase, snake_case (e.g., created_at)
- Foreign Keys: use table_id format (e.g., farmer_id)
- Prisma Mapping:
  - Use @map for fields
  - Use @@map for tables
  - Keep camelCase in backend, snake_case in DB

---

## 2. Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ bookings : "creates (farmer)"
    users ||--o{ bookings : "operates (operator)"
    users ||--o| tractors : "assigned to"
    tractors ||--o{ bookings : "used in"
    bookings ||--o{ payments : "has"
    bookings }o--|| services : "uses"
    users ||--o{ fuel_logs : "records"
    tractors ||--o{ fuel_logs : "linked to"
    users ||--o{ notifications : "receives"

    users {
        int id PK
        string name
        string email
        string phone UK
        string password_hash
        string role
        string status
        string availability
        string language
        string location
        datetime created_at
        datetime updated_at
    }

    services {
        int id PK
        string name UK
        float base_rate_per_hectare
        string description
        datetime effective_date
        datetime created_at
        datetime updated_at
    }

    system_config {
        int id PK
        float diesel_price
        float avg_mileage
        string contact_email
        string hub_location
        string hub_name
        int pre_alert_hours
        int service_interval_hours
        string support_email
        float base_latitude
        float base_longitude
        float per_km_rate
        string pricing_mode
        datetime created_at
        datetime updated_at
    }

    zones {
        int id PK
        float min_distance
        float max_distance
        float surcharge_per_hectare
        string status
        datetime created_at
        datetime updated_at
    }

    bookings {
        int id PK
        int farmer_id FK
        int service_id FK
        float land_size
        string location
        float base_price
        float distance_km
        float distance_charge
        float fuel_surcharge
        float total_price
        float final_price
        int tractor_id FK
        int operator_id FK
        string status
        string payment_status
        string zone_name
        float air_distance
        float road_distance
        float farmer_latitude
        float farmer_longitude
        float hub_latitude
        float hub_longitude
        string hub_location
        string hub_name
        string service_name_snapshot
        datetime scheduled_at
        datetime created_at
        datetime updated_at
    }

    payments {
        int id PK
        int booking_id FK
        float amount
        string method
        string status
        string reference
        datetime created_at
    }

    tractors {
        int id PK
        string name
        string model
        string status
        int operator_id FK_UK
        float engine_hours
        float next_service_due_hours
        datetime last_service_date
        datetime created_at
        datetime updated_at
    }

    fuel_logs {
        int id PK
        int operator_id FK
        int tractor_id FK
        float liters
        float cost
        string station
        string receipt_url
        string status
        int reviewed_by FK
        datetime reviewed_at
        datetime created_at
    }

    fuel_price_logs {
        int id PK
        float old_price
        float new_price
        int admin_id
        datetime timestamp
    }

    notifications {
        int id PK
        int user_id FK
        string role
        string message
        string type
        boolean is_read
        datetime created_at
    }

    ussd_locations {
        int id PK
        string name UK
        float charge_per_hectare
        boolean is_active
        datetime created_at
        datetime updated_at
    }
```

---

## 3. Table Definitions

### 3.1 users
Stores all platform users (farmers, admins, operators).

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| name | String | required | |
| email | String? | optional | |
| phone | String (Unique) | required | Used for login |
| password_hash | String | required | bcrypt hashed |
| role | String | `farmer` | `farmer` \| `admin` \| `operator` |
| status | String | `active` | `active` \| `inactive` — **authentication only** |
| availability | String | `available` | `available` \| `busy` — **dispatch only** (operators) |
| language | String | `en` | `en` \| `naira` |
| location | String? | optional | Farmer location text |
| created_at | DateTime | now() | |
| updated_at | DateTime | auto | |

**Relations:**
- `bookings` → Booking[] (as farmer, via FarmerBookings)
- `operatorBookings` → Booking[] (as operator, via OperatorBookings)
- `fuelLogs` → FuelLog[] (via OperatorFuelLogs)
- `tractor` → Tractor? (1-to-1, via OperatorTractor)
- `notifications` → Notification[] (via UserNotifications)

> ⚠️ **CRITICAL RULE**: `status` and `availability` must NEVER be mixed. Auth only checks `status`. Dispatch only checks `availability`.

---

### 3.2 services
Defines service types and base rates.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| name | String (Unique) | required | plough, harrow, ridge, full |
| base_rate_per_hectare | Float | required | Used in pricing engine |
| description | Text? | optional | Service description |
| effective_date | DateTime | now() | Date from which rate is valid |
| created_at | DateTime | now() | |
| updated_at | DateTime | auto | |

---

### 3.3 system_config (Singleton, id=1)
Stores global system configuration and pricing parameters.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | 1 | Always 1 (singleton) |
| diesel_price | Float | 0 | Current diesel price |
| avg_mileage | Float | 1 | Average km/liter |
| contact_email | String | ops@dummy.com | |
| hub_location | String | Ludhiana Central Command | Hub address |
| hub_name | String | TractorLink Admin HQ | Hub display name |
| pre_alert_hours | Int | 50 | Maintenance pre-alert threshold |
| service_interval_hours | Int | 250 | Service interval for tractors |
| support_email | String | support@dummy.com | |
| base_latitude | Float? | optional | Hub GPS latitude |
| base_longitude | Float? | optional | Hub GPS longitude |
| per_km_rate | Float | 500 | Rate per km (FUEL mode) |
| pricing_mode | String | ZONE | `ZONE` \| `FUEL` |
| created_at | DateTime | now() | |
| updated_at | DateTime | auto | |

---

### 3.4 zones
Distance-based pricing tiers for ZONE pricing mode.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| min_distance | Float | required | Minimum km for this tier |
| max_distance | Float? | optional | NULL = open-ended (last tier) |
| surcharge_per_hectare | Float | required | Extra charge per hectare for this zone |
| status | String | ACTIVE | `ACTIVE` \| `INACTIVE` |
| created_at | DateTime | now() | |
| updated_at | DateTime | auto | |

---

### 3.5 bookings (Core Table)

This is the central table of the system.

#### Input Data
| Column | Type | Notes |
|:---|:---|:---|
| farmer_id | Int (FK) | Links to users |
| service_id | Int (FK) | Links to services |
| land_size | Float | Hectares |
| location | String | Address text |

#### Farmer GPS Coordinates
| Column | Type | Notes |
|:---|:---|:---|
| farmer_latitude | Float? | GPS lat |
| farmer_longitude | Float? | GPS lng |

#### Historical Snapshots (Quote Integrity)
| Column | Type | Notes |
|:---|:---|:---|
| service_name_snapshot | String? | Service name at booking time |
| hub_name | String? | Hub name at booking time |
| hub_location | String? | Hub address at booking time |
| hub_latitude | Float? | Hub GPS lat at booking time |
| hub_longitude | Float? | Hub GPS lng at booking time |

#### Pricing Breakdown
| Column | Type | Notes |
|:---|:---|:---|
| base_price | Float | service.rate × landSize |
| distance_km | Float | Road distance in km |
| distance_charge | Float | Zone/fuel surcharge |
| fuel_surcharge | Float | 0 (reserved, not used) |
| total_price | Float | base_price + distance_charge |
| final_price | Float | = total_price (no adjustments) |
| zone_name | String? | Matched zone label |
| air_distance | Float | Haversine distance |
| road_distance | Float | air_distance × 1.3 |

#### Assignment
| Column | Type | Notes |
|:---|:---|:---|
| tractor_id | Int? (FK) | Assigned tractor |
| operator_id | Int? (FK) | Assigned operator |

#### Status & Scheduling
| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| status | String | `pending` | `PENDING`, `SCHEDULED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED` |
| payment_status | String | `pending` | `PENDING`, `PARTIAL`, `PAID` (independent of status) |
| scheduled_at | DateTime? | - | Set by Admin during scheduling |
| created_at | DateTime | now() | |
| updated_at | DateTime | auto | |

> ⚠️ **IMPORTANT**: `status` (work lifecycle) and `payment_status` (financial tracking) are **decoupled**. A booking can be `COMPLETED` with `paymentStatus: PENDING`. There is no `PAID` booking status.

---

### 3.6 payments
Tracks financial transactions per booking.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| booking_id | Int (FK) | required | Links to bookings |
| amount | Float | required | Payment amount |
| method | String | `cash` | `cash` \| `online` \| `mobile_money` \| `bank_transfer` \| `admin_settlement` |
| reference | String? | optional | Payment reference |
| status | String | `full` | `pending` \| `partial` \| `full` (per-record coverage) |
| created_at | DateTime | now() | |

- Multiple payments per booking are supported
- Booking `paymentStatus` is recalculated from sum of payment amounts

---

### 3.7 tractors
Fleet inventory with maintenance tracking.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| name | String | required | Tractor identifier |
| model | String? | optional | Make/model |
| status | String | `AVAILABLE` | `AVAILABLE` \| `IN_USE` \| `MAINTENANCE` |
| operator_id | Int? (FK, Unique) | optional | 1-to-1 with operator |
| engine_hours | Float | 0 | Total runtime hours |
| next_service_due_hours | Float | 250 | Service threshold |
| last_service_date | DateTime? | optional | |
| created_at | DateTime | now() | |
| updated_at | DateTime | auto | |

- Auto-maintenance: status set to `MAINTENANCE` when `(nextServiceDueHours - engineHours) ≤ 50`
- `operator_id` is unique — enforces 1-to-1 tractor-operator mapping

---

### 3.8 fuel_logs
Tracks operator fuel consumption and expenses with admin review lifecycle.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| operator_id | Int (FK) | required | Links to users (operator) |
| tractor_id | Int? (FK) | optional | Links to tractors |
| liters | Float | required | Fuel amount in liters |
| cost | Float | required | Total cost paid |
| station | String | required | Fuel station name |
| receipt_url | String? | optional | Upload link |
| status | String | `PENDING` | `PENDING` \| `APPROVED` \| `REJECTED` |
| reviewed_by | Int? (FK) | optional | Links to users (admin) |
| reviewed_at | DateTime? | optional | |
| created_at | DateTime | now() | |

**Relations:**
- `operator` → User (via OperatorFuelLogs)
- `tractor` → Tractor (via TractorFuelLogs)
- `reviewer` → User (via AdminFuelLogReviews)

---

### 3.9 fuel_price_logs
Audit trail for diesel price changes.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| old_price | Float | required | |
| new_price | Float | required | |
| admin_id | Int | required | Admin who made the change |
| timestamp | DateTime | now() | |

---

### 3.10 notifications
System-wide notification storage.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| user_id | Int (FK) | required | Target user |
| role | String | required | `admin` \| `farmer` \| `operator` |
| message | Text | required | |
| type | String | required | `booking` \| `assignment` \| `tracking` \| `payment` |
| is_read | Boolean | false | |
| created_at | DateTime | now() | |

---

### 3.11 ussd_locations
Registry of locations and rates for USSD-based offline bookings.

| Column | Type | Default | Notes |
|:---|:---|:---|:---|
| id | Int (PK) | autoincrement | |
| name | String (Unique) | required | Location name used in USSD menus |
| charge_per_hectare | Float | required | Specific rate for this area |
| is_active | Boolean | true | |
| created_at | DateTime | now() | |
| updated_at | DateTime | auto | |

---

## 4. Current Prisma Schema

The actual Prisma schema (`prisma/schema.prisma`) includes:

- **9 Models**: User, Service, SystemConfig, Zone, Booking, Payment, Tractor, FuelLog, FuelPriceLog, Notification
- **Database**: MySQL
- **All field mappings**: camelCase → snake_case via `@map`
- **All table mappings**: PascalCase → snake_case via `@@map`
- **Foreign key indexes**: Defined on all relation fields
- **Unique constraints**: User.phone, Service.name, Tractor.operatorId

---

## 5. Critical Database Rules

1. Pricing must always be stored in DB (never rely on frontend)
2. Booking is the central entity — all operations revolve around it
3. Status must follow strict lifecycle (see FLOW.md)
4. `status` (work) and `paymentStatus` (financial) are **decoupled** — never mix them
5. `User.status` (auth) and `User.availability` (dispatch) are **decoupled** — never mix them
6. Always store assignment (tractor + operator) in booking record
7. No business logic in database layer — all logic in services
8. Historical snapshots must be preserved — never recalculate from current config
9. Atomic transactions for state changes (assignment, completion)
10. Tractor-operator mapping is 1-to-1 (enforced by unique constraint on `operator_id`)

---

## 6. Notes

- Operators and tractors require admin enrollment
- Farmers self-register via public API
- Schema is designed for future expansion (without breaking existing logic)
- Zone status supports soft-delete (ACTIVE/INACTIVE)
- SystemConfig is a singleton (id=1)
- `fuel_surcharge` field exists on bookings for schema compatibility but is always 0

---