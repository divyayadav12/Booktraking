# FAST DISPATCH PRO

A production-ready, full-stack dispatch management system built with **React, TypeScript, Vite, Tailwind CSS, Node.js, Express, MongoDB, and Mongoose ODM**.

---

## 📖 System Overview

The system manages student book orders and their outgoing fulfillment dispatch process:
1. **Admin** uploads Excel/CSV files containing student details and ordered books.
2. The system imports records, calculates required quantities per book code, and queues outgoing orders.
3. **Employees** log in separately, open student orders, and verify each physical copy by scanning/entering the book code.
4. **Server-Side Atomic Verification**:
   - If the code matches and copies remain pending, the backend dispatches **exactly one copy**, decrements pending, increments dispatched, and creates an immutable audit dispatch log.
   - If the code does not match, the backend displays a warning: *"Warning: Book code does not match this order. Please verify the book."*, records the failed attempt in `VerificationAttempt`, and preserves all quantities unchanged.
   - Prevents over-dispatching via atomic conditions and eliminates duplicate clicks using idempotency keys.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Axios, Recharts, Lucide React |
| **Backend** | Node.js (v20+), Express.js, TypeScript, MongoDB, Mongoose ODM, bcryptjs, jsonwebtoken, ExcelJS, Zod |
| **Testing** | Vitest, Supertest, React Testing Library, jsdom |
| **Security** | Helmet, CORS, Rate Limiting, Atomic Document Updates, JWT Expiry |
| **Timezone** | `Asia/Kolkata` (IST) date-time reporting |

---

## 👤 User Roles & Default Demo Credentials

> [!NOTE]
> The seed script automatically creates these accounts for local development and testing.

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@example.com` | `Admin@123` | Full administrative control, Excel wizard, reports, employee management, audit logs |
| **EMPLOYEE** | `emp1@example.com` | `Emp@123` | Outgoing orders list, book code verification & dispatch, personal dispatch history |
| **EMPLOYEE** | `emp2@example.com` | `Emp@123` | Outgoing orders list, book code verification & dispatch, personal dispatch history |

---

## 🚀 Quick Setup & Installation

### 1. Prerequisites
- Node.js (v18 or v20+)
- PostgreSQL 14+ running locally or a cloud database (Neon, Supabase, Render Postgres)

### 2. Environment Configuration
Backend `.env` file (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:Zenvora%40123@localhost:5432/book_tracking_db?schema=public"
JWT_SECRET=supersecret_jwt_key_book_tracking_system_2026_dev_secure
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
ADMIN_DEFAULT_EMAIL=admin@example.com
ADMIN_DEFAULT_PASSWORD=Admin@123
```

### 3. Install Dependencies
```bash
# In backend
cd backend
npm install

# In frontend
cd ../frontend
npm install
```

### 4. Database Migration & Seeding
```bash
cd backend

# Sync database schema with PostgreSQL
npx prisma db push

# Seed demo admin, employees, sample orders, dispatch logs
npm run prisma:seed
```

---

## 💻 Running the Application

### Start Backend API Server
```bash
cd backend
npm run dev
# Running on http://localhost:5000
```

### Start Frontend Client
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

Access the web interface at **`http://localhost:5173`**.

---

## 🧪 Running Automated Tests

### Backend Integration & Security Tests
Tests cover:
- Admin & Employee login authentication
- Invalid credentials rejection
- Role-based authorization & 403 Forbidden enforcement on Admin APIs
- Excel preview & row-level validation
- Correct book code dispatch (atomic increment of 1 copy)
- Incorrect book code rejection & warning without modifying quantities
- Row-locking & prevention of over-dispatch
- Idempotency key protection
- Reports and Excel export generation

```bash
cd backend
npm test
```

### Frontend UI Component Tests
```bash
cd frontend
npm test
```

---

## 📁 Sample Excel Files for Import Testing

Sample test files are located in `sample-data/`:
1. `sample_valid_orders.xlsx`: Valid student orders with multiple books and quantities.
2. `sample_with_validation_errors.xlsx`: Contains invalid rows (invalid email, invalid mobile format, quantity ≤ 0, missing book code) to test the 9-step Import Wizard and error export.

### Excel Column Headers Required
```
Student Name | Mobile Number | Email | Tracking ID | Book Code | Book Name | Quantity
```

---

## 📦 Production Build & Deployment

### 1. Build Frontend
```bash
cd frontend
npm run build
# Generates production assets in frontend/dist/
```

### 2. Build Backend
```bash
cd backend
npm run build
# Generates compiled JavaScript in backend/dist/
```

### 3. Deployment Guides
- **Frontend (Vercel)**:
  - Framework Preset: `Vite`
  - Root Directory: `frontend`
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Set Environment Variable: `VITE_API_URL` pointing to the deployed backend URL.

- **Backend (Render / Railway / AWS)**:
  - Root Directory: `backend`
  - Build Command: `npm install && npx prisma generate && npm run build`
  - Start Command: `node dist/server.js`
  - Add Environment Variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT=5000`.

- **Database (Managed PostgreSQL)**:
  - Compatible with AWS RDS, Neon, Supabase, Render PostgreSQL.
  - Run `npx prisma db push` or `npx prisma migrate deploy`.

---

## 🏛️ Project Directory Structure

```
Book traking/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Prisma models, relations, and indexes
│   │   └── seed.ts             # Demo data seed script
│   ├── src/
│   │   ├── config/             # Database & environment configuration
│   │   ├── controllers/        # REST controllers (Auth, Orders, Dispatch, Reports, etc.)
│   │   ├── middleware/         # JWT Auth, Role checks, Rate limiters, Error handling
│   │   ├── routes/             # Express API routes
│   │   ├── services/           # Business logic & atomic database transactions
│   │   ├── utils/              # IST date formatting, audit logger, normalization
│   │   ├── validators/         # Zod request payload schemas
│   │   ├── app.ts              # Express application configuration
│   │   └── server.ts           # Server bootstrap
│   ├── tests/
│   │   └── api.test.ts         # Vitest + Supertest integration test suite
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components (Modal, Button, Badge, Card, etc.)
│   │   ├── context/            # AuthContext, ToastContext
│   │   ├── layouts/            # DashboardLayout (Responsive sidebar & topbar)
│   │   ├── pages/
│   │   │   ├── admin/          # Admin Dashboard, Import Wizard, Orders, Reports, etc.
│   │   │   ├── employee/       # Employee Dashboard, My History
│   │   │   ├── common/         # Outgoing Orders, Order Detail & Verification Modal
│   │   │   └── LoginPage.tsx   # Login with quick demo buttons
│   │   ├── services/           # Axios HTTP client with JWT interceptor
│   │   ├── types/              # TypeScript interfaces
│   │   ├── App.tsx             # Routes & route guards
│   │   └── main.tsx            # Entry point
│   ├── package.json
│   └── vite.config.ts
│
├── sample-data/                # Sample Excel files for testing
├── package.json                # Root automation scripts
└── README.md                   # Full documentation
```
