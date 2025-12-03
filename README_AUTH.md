# Authentication & Authorization Setup

## Initial Setup

### 1. Run Database Migration

First, run the migration to create the `user_roles` table:

```sql
-- Run this in your Supabase SQL editor
-- File: supabase/migrations/add_user_roles.sql
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

#### Option B: Via SQL

```sql
-- First, create a user via the signup page or Supabase Auth
-- Then run this SQL (replace USER_ID with the actual user UUID):
INSERT INTO user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'admin');
```

### 3. Create Additional Users

- Regular users can sign up via `/signup` page
- They will automatically get `user` role
- Only admins can access `/admin` and `/employees` pages
- Admins can see the "Admin" dropdown in the navbar

## User Roles

- **user**: Default role for all new signups. Can access all regular pages.
- **admin**: Can access admin pages (`/admin`, `/employees`) and manage user roles.

## Protected Routes

- `/admin` - Admin dashboard (admin only)
- `/employees` - Employee management (admin only)
- All other pages require authentication (any role)

## Public Routes

- `/login` - Login page
- `/signup` - Registration page

