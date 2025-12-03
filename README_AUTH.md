# Authentication & Authorization Setup

## Initial Setup

### 1. Run Database Migrations

First, run the migrations to create the `user_roles` table and add verification:

```sql
-- Run these in your Supabase SQL editor
-- File: supabase/migrations/add_user_roles.sql
-- File: supabase/migrations/add_user_verification.sql
```

### 2. Create Your First Admin Account

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to Authentication > Users
3. Create a new user manually or use the signup page
4. Go to Table Editor > `user_roles`
5. Insert a new row:
   - `user_id`: The UUID of the user you just created
   - `role`: `admin`
   - `verified`: `true` (check the box)

#### Option B: Via SQL

```sql
-- First, create a user via the signup page or Supabase Auth
-- Then run this SQL (replace USER_ID with the actual user UUID):
INSERT INTO user_roles (user_id, role, verified)
VALUES ('USER_ID_HERE', 'admin', true);
```

### 3. User Verification System

**Important**: All new accounts require manual verification by an admin before they can access the system.

- New users sign up via `/signup` page
- They are automatically assigned `user` role with `verified = false`
- They will see a "Pending Verification" page after login
- An admin must verify them via `/admin/users` page before they can access the system

### 4. Verifying New Users

1. Log in as an admin
2. Go to Admin > User Management (`/admin/users`)
3. You will see all users with their verification status
4. Click "Verify" button next to pending users
5. Users can then access the system

## User Roles

- **user**: Default role for all new signups. Can access all regular pages (after verification).
- **admin**: Can access admin pages (`/admin`, `/employees`, `/admin/users`) and manage user roles/verification.

## Protected Routes

- `/admin` - Admin dashboard (admin only, verified)
- `/admin/users` - User management (admin only, verified)
- `/employees` - Employee management (admin only, verified)
- All other pages require authentication and verification (any role)

## Public Routes

- `/login` - Login page
- `/signup` - Registration page
- `/pending-verification` - Shown to unverified users after login

## Verification Workflow

1. User signs up → Account created with `verified = false`
2. User tries to login → Redirected to `/pending-verification` page
3. Admin verifies user → User can now access the system
4. User logs in again → Full access granted

