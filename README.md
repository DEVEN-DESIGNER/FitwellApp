# Fitwell Retailer Ordering System

A complete digital ordering solution for **Fitwell Sanitary Fittings**, enabling retail shopkeepers to browse sanitary products, select variants and sizes, place orders directly with Fitwell, and track shipments.

## Technology Stack

- **Mobile App:** React Native + Expo (Android and iOS)
- **Admin Dashboard:** React + Tailwind CSS
- **Backend:** Node.js + Express.js
- **Database:** MongoDB
- **Version Control:** Git + GitHub

## Core Features

### Retailer Mobile App
- Retailer registration and authentication
- Product catalogue with images, categories and search
- Variant, size and quantity selection
- Shopping cart with a minimum order value of ₹10,000
- Order placement and order history
- Shipment and courier tracking

### Admin Dashboard
- Complete product CRUD operations
- Admin login is required before the dashboard and admin API can be accessed.
- Product categories and image management
- Flexible product attributes and variant combinations
- SKU, size-wise pricing and inventory management
- Retailer account management
- Order approval and processing
- Invoice and courier dispatch management

### Product Variant Management
Supports complex product variations, including Polyamide Connection Pipe with four Nut + Inner combinations:
1. SS 304 Nut + Brass Inner
2. SS Nut + Brass Inner
3. Brass Nut + Brass Inner
4. SS Nut + Nylon Inner

Each sellable size and variant can have its own SKU, price and stock quantity.

### Project Status
Development repository only. The project is intended for local development, testing and Git-based collaboration. No production deployment, public release or app-store publishing is included in the current scope.

### Local admin login

On first backend startup, an admin user is seeded into MongoDB using `ADMIN_USERNAME` and `ADMIN_PASSWORD` from the environment. If they are not set during local development, the defaults are:

- Username: `admin`
- Password: `fitwell123`

Set custom values in `fitwell-backend/.env` before running the backend for anything beyond local testing.

Passwords are stored as scrypt hashes in the `admins` collection, not as plain text. Changing the environment values does not overwrite an existing admin; update or remove that database record if you need to change the login.

The login also includes a forgot-password flow. It creates a one-time six-digit reset code valid for 15 minutes and stores only its hash in MongoDB. Because no email provider is configured yet, the code is displayed in the local development UI; connect an email provider before using this flow in production.

### Dispatch SMS setup

Dispatch uses MSG91's Flow SMS API. Add `MSG91_AUTH_KEY` and `MSG91_TRACKING_TEMPLATE_ID` to `fitwell-backend/.env`. The approved MSG91 template should define `VAR1` for the order number, `VAR2` for the courier name, and `VAR3` for the tracking number. When tracking is saved, the system sends the SMS to the retailer's 10-digit Indian mobile number. See the [MSG91 Flow SMS API documentation](https://docs.msg91.com/sms/send-sms).
