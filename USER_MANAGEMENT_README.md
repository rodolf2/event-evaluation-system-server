# User Management System with Google SSO

This document provides instructions for setting up and using the User Management System with Google Single Sign-On (SSO) functionality in the Event Evaluation System.

## Features

- **Google OAuth 2.0 Integration**: Users can authenticate using their Google accounts
- **Super Admin Management**: Complete user management capabilities for administrators
- **User Roles**: Support for regular users and administrators
- **User Statistics**: Dashboard with user analytics and insights
- **CRUD Operations**: Full Create, Read, Update, Delete functionality for user management
- **Real-time Dashboard**: Web-based admin interface for user management

## Prerequisites

- Node.js (v14 or higher)
- MongoDB database
- Google Cloud Console account

## Installation & Setup

### 1. Install Dependencies

The required packages have been added to `package.json`:
- `passport` - Authentication middleware
- `passport-google-oauth20` - Google OAuth 2.0 strategy
- `express-session` - Session management
- `cookie-parser` - Cookie handling
- `jsonwebtoken` - JWT token generation
- `bcryptjs` - Password hashing

Run the following command to install dependencies:
```bash
npm install
```

### 2. Google OAuth Setup

#### Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

#### Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure the OAuth consent screen:
   - Choose "External" for user type
   - Fill in the required fields (App name, User support email, etc.)
   - Add authorized domains (e.g., `localhost` for development)
4. Create the OAuth client ID:
   - Application type: "Web application"
   - Name: "Event Evaluation System"
   - Authorized JavaScript origins: `http://localhost:5000`
   - Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`

5. Copy the Client ID and Client Secret

#### Configure Environment Variables

Update your `.env` file with the Google OAuth credentials:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID="your_google_client_id_here"
GOOGLE_CLIENT_SECRET="your_google_client_secret_here"

# Session and JWT Configuration
SESSION_SECRET="your_session_secret_here_change_this_in_production"
JWT_SECRET="your_jwt_secret_here_change_this_in_production"
```

### 3. Database Setup

Ensure your MongoDB connection is properly configured in the `.env` file:

```env
MONGO_URI="your_mongodb_connection_string"
```

### 4. Set Super Admin

To set up the first super admin, you need to manually update a user in the database or create one through the application. The system checks for admin privileges using the email address `admin@yourdomain.com` by default.

You can modify this in the `src/middlewares/auth.js` file or add a `role` field to the User model.

## Usage

### Starting the Server

```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

### First-Time Setup (Bootstrap)

If this is your first time running the system:

1. Navigate to `http://localhost:5000/bootstrap.html`
2. Enter your full name and `@laverdad.edu.ph` email address
3. Click "Create Administrator Account"
4. This creates your first admin user

**Note:** Bootstrap is only available when no admin users exist in the system.

### Accessing the Admin Dashboard

1. Navigate to `http://localhost:5000/admin.html`
2. Click "Sign in with Google"
3. After authentication, you'll be redirected to the admin dashboard
4. Only users with admin role can access the dashboard

### Domain-Based Role Assignment

The system automatically assigns roles based on email domains:

- **@laverdad.edu.ph** → **Administrator** role (employees only)
- **@student.laverdad.edu.ph** → **Student** role (students)
- **Other domains** → **User** role (default)

This happens automatically during Google OAuth login. Users get the appropriate role based on their email domain.

### User Roles and Permissions

#### Administrator (@laverdad.edu.ph)
- **Only @laverdad.edu.ph emails allowed** for administrator role
- Full access to admin dashboard
- Can manage all users (view, edit, delete)
- Access to user statistics and analytics
- Can access all system administrative features
- Can manage events, evaluations, and certificates

#### Student (@student.laverdad.edu.ph)
- Can participate in events and evaluations
- Can submit feedback and evaluations
- Can view certificates and reports
- Cannot access administrative features
- Limited to participant/student functions only

#### User (Other domains)
- Basic user access with limited permissions
- Can participate in events if granted access
- Cannot access administrative features
- Cannot manage users or system settings

### Login Flow for Different User Types

1. **First Admin Setup**: Use `/bootstrap.html` to create the first admin (requires @laverdad.edu.ph email)
2. **Employee Login**: @laverdad.edu.ph emails get automatic administrator access
3. **Student Login**: @student.laverdad.edu.ph emails get student role for participation
4. **Other Users**: Default user role with limited access

### API Endpoints

#### Authentication Routes

- `GET /api/auth/google` - Initiate Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/google/failure` - OAuth failure handler
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `GET /api/auth/check` - Check authentication status
- `GET /api/auth/verify-admin` - Verify admin status

#### Bootstrap Routes (System Setup)

- `GET /api/bootstrap/status` - Check if bootstrap is needed
- `POST /api/bootstrap/admin` - Create first admin user

#### User Management Routes (Admin Only)

- `GET /api/users` - Get all users with pagination and filters
- `GET /api/users/stats/overview` - Get user statistics
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete/deactivate user
- `PUT /api/users/bulk` - Bulk update users

### Admin Dashboard Features

#### User Statistics
- Total users count
- Active vs inactive users
- Admin vs regular users ratio
- Recent signups (last 30 days)
- Active users (last 7 days)

#### User Management
- Search users by name or email
- Filter by role (user/admin) or status (active/inactive)
- Add new users manually
- Edit existing user details
- Activate/deactivate user accounts
- Delete users (soft delete)

#### User Information Displayed
- User avatar (from Google profile)
- Name and email
- Role (user/admin)
- Account status (active/inactive)
- Registration date
- Last login time

### Authentication Flow

1. **User Login**:
   - User clicks "Sign in with Google" on the admin dashboard
   - Redirected to Google OAuth consent screen
   - After authorization, Google redirects back to `/api/auth/google/callback`
   - Server creates/updates user account and generates JWT token
   - User is redirected back to the dashboard

2. **Token Management**:
   - JWT tokens are generated with 7-day expiration
   - Tokens are stored in localStorage on the client side
   - API endpoints validate tokens for authentication

3. **Session Management**:
   - Express sessions handle OAuth state
   - Cookies store session information
   - Secure cookie settings for production

## Security Features

- **JWT Authentication**: Stateless token-based authentication
- **Role-based Access Control**: Admin-only routes for user management
- **Secure Session Management**: HttpOnly cookies, secure settings for production
- **Input Validation**: Server-side validation of all inputs
- **CORS Configuration**: Properly configured cross-origin resource sharing

## Development Notes

### Environment Variables Reference

```env
PORT=5000
NODE_ENV=development

# Database
MONGO_URI="mongodb://localhost:27017/event-evaluation-system"

# Email Configuration (existing)
EMAIL_USER="your_email@gmail.com"
EMAIL_PASS="your_app_password"

# Google OAuth (required for this feature)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# Security (change in production)
SESSION_SECRET="your_unique_session_secret"
JWT_SECRET="your_unique_jwt_secret"

# Client URL (for CORS)
CLIENT_URL="http://localhost:3000"
```

### Production Deployment

1. **Environment Variables**:
   - Set `NODE_ENV=production`
   - Use strong, unique secrets for `SESSION_SECRET` and `JWT_SECRET`
   - Enable secure cookies: `SESSION_COOKIE_SECURE=true`

2. **Google OAuth**:
   - Update authorized domains in Google Cloud Console
   - Update redirect URIs to match production domain
   - Configure proper origins for your production domain

3. **Security**:
   - Use HTTPS in production
   - Set secure cookie flags
   - Implement rate limiting
   - Add request logging

## Troubleshooting

### Common Issues

1. **Google OAuth Not Working**:
   - Check that Google Client ID and Secret are correct
   - Verify authorized domains and redirect URIs in Google Cloud Console
   - Ensure the callback URL matches exactly

2. **Admin Access Denied**:
   - Verify user email matches the admin email in the auth middleware
   - Check user role in the database
   - Ensure JWT token is valid

3. **CORS Errors**:
   - Update `CLIENT_URL` in environment variables
   - Check CORS configuration in `src/index.js`

4. **Database Connection Issues**:
   - Verify MongoDB connection string
   - Check network connectivity
   - Ensure database user has proper permissions

### Debug Mode

To enable debug logging, set in your `.env` file:
```env
DEBUG=passport:*
```

## API Usage Examples

### Get User Statistics
```javascript
const response = await fetch('/api/users/stats/overview', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const stats = await response.json();
```

### Update User
```javascript
const response = await fetch(`/api/users/${userId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Updated Name',
    role: 'admin',
    isActive: true
  })
});
```

### Filter Users
```javascript
const params = new URLSearchParams({
  search: 'john',
  role: 'user',
  isActive: 'true',
  page: '1',
  limit: '10'
});

const response = await fetch(`/api/users?${params}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## File Structure

```
src/
├── config/
│   └── passport.js              # Passport OAuth configuration
├── middlewares/
│   └── auth.js                  # Authentication middleware
├── models/
│   └── User.js                  # Updated User model with auth fields
├── api/
│   ├── controllers/
│   │   ├── authController.js    # Authentication endpoints
│   │   └── userController.js    # User management endpoints
│   └── routes/
│       ├── authRoutes.js        # OAuth routes
│       └── userRoutes.js        # User management routes
└── index.js                     # Updated main server file

public/
└── admin.html                   # Admin dashboard interface
```

## Contributing

When extending the user management system:

1. **Adding New User Fields**: Update the User model and controller
2. **New Admin Features**: Add routes and update the admin dashboard
3. **Security Enhancements**: Review authentication middleware
4. **API Changes**: Update this documentation

## Support

For issues related to:
- Google OAuth setup: Check Google Cloud Console configuration
- Authentication problems: Verify JWT tokens and user roles
- Database issues: Check MongoDB connection and user permissions
- Admin dashboard: Ensure proper authentication and admin role