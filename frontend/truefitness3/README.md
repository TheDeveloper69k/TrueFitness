# True Fitness — Gym Management Website

## Project Structure
```
truefitness/
├── index.html                  ← Public Landing Page
├── css/
│   ├── style.css               ← Landing page styles
│   └── dashboard.css           ← Dashboard shared styles
├── js/
│   └── auth.js                 ← Auth logic (login, signup, guards)
└── pages/
    ├── user/
    │   └── dashboard.html      ← User Dashboard
    └── admin/
        └── dashboard.html      ← Admin Dashboard (GymPro)
```

## How to Run
1. Open `index.html` in a browser (double-click or use Live Server in VS Code)
2. No server needed — pure HTML/CSS/JS with localStorage

## Login Credentials

### Admin
- Phone: `9999999999`
- Password: `admin123`
- Redirects to: `/pages/admin/dashboard.html`

### Demo User 1
- Phone: `9877507810`
- Password: `user123`
- Redirects to: `/pages/user/dashboard.html`

### Demo User 2
- Phone: `8837740652`
- Password: `user123`

### New User
- Click **Signup** on landing page
- Fill in name, phone, password
- Automatically logs in as user

## Features

### Landing Page
- Hero with gym imagery and CTA
- About section
- Trainers section with cards
- Membership plans (Basic/Premium/VIP)
- Testimonials
- Footer with real contact info (SCO 1,2,3 Sector-115, Mohali)
- Login modal (phone + password)
- Signup modal (OTP flow UI + form validation)
- Reset Password modal

### User Dashboard
- Sidebar nav: Dashboard, My Plan, Attendance, Profile
- Stats: Current Plan, Days Attended, Classes Booked, Next Renewal
- Activity table
- My Plan page with upgrade option
- Attendance calendar + log
- Profile page with all user details

### Admin Dashboard (GymPro)
- Dashboard with stat cards + member management table
- Members: add/edit/delete, trainer assignment, toggles
- Trainers: cards with View/Edit, add new trainer
- Membership: 3 plan cards + statistics
- Payments: transaction table with methods/status
- Notifications: center with send/delete
- Diet Plans: member diet cards + add new
- Receipts: receipt cards + generate new
- Reports: KPI cards + revenue/membership bar charts
- Settings: General, Notifications, Security, Backup
- Global search across members

## Security
- Role-based routing: admin/user pages check localStorage
- Unauthorized access redirects to login
- Session stored in localStorage as `tf_user`
