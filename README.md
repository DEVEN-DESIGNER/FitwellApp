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
- Retailer sign-in (accounts are created and approved by Fitwell)
- Product catalogue with images, categories and search
- Variant, size and quantity selection
- Shopping cart with a minimum order value of ₹10,000
- Order placement and order history
- Shipment and courier tracking

### Running the Retailer App

The Expo app uses the existing Express API and MongoDB database. It does not connect directly to MongoDB. Start the backend with its MongoDB connection and local admin/retailer setup configured, then set `EXPO_PUBLIC_API_URL` in `fitwell-retailer/.env` to the backend API URL:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

Use `http://10.0.2.2:5000/api` for the standard Android emulator. For a physical phone, use the computer's LAN IP address (for example, `http://192.168.1.20:5000/api`) and make sure the phone and computer are on the same network. Keep `.env` local; do not commit it.

From the project root, start the backend and mobile app in separate terminals:

```powershell
Set-Location .\fitwell-backend
npm install
npm run dev
```

```powershell
Set-Location .\fitwell-retailer
npm install
npx expo start
```

Open the Expo project in Expo Go or an emulator. A retailer must have an approved, active account created by Fitwell to sign in. The app supports product browsing, variant selection, cart checkout with the ₹10,000 minimum, order history, and shipment tracking.

### Admin Dashboard Hosting

The admin dashboard is a static GitHub Pages site; it cannot host the Express API or MongoDB. The repository includes a Render Blueprint in `render.yaml` for hosting the API. Create a MongoDB Atlas cluster and database user, then create a Render Blueprint from this repository. When prompted, provide `MONGODB_URI`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`; Render generates `ADMIN_TOKEN_SECRET`. Do not commit these values. The backend refuses to start in production if its admin credentials or token-signing secret are missing. Browser origins are limited by `CORS_ORIGINS` (configured for the GitHub Pages site and local Vite development by default). Use `fitwell-backend/.env.example` as a local template (never put real credentials in the example). The API health check is available at `/api/health`.

After the API deploys, add the GitHub Actions variable `VITE_API_URL` under **Settings → Secrets and variables → Actions → Variables** with the full HTTPS API base URL, for example `https://fitwell-api.onrender.com/api`. Push the Pages workflow changes or manually run **Deploy admin dashboard to GitHub Pages** to rebuild with that URL. The Render free service may take a short time to wake after inactivity. A new Atlas database starts empty; existing local MongoDB data must be migrated separately if it should appear in the deployed app.

For local dashboard development, copy `fitwell-admin/.env.example` to `fitwell-admin/.env` and keep the localhost URL.

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

### Dispatch email setup

Dispatch also sends a detailed tracking email to the retailer's saved email address through Gmail SMTP. Add `SMTP_USER=fitwellsanitary@gmail.com` and a Gmail app password to `fitwell-backend/.env`. The email includes the client name, order number, courier, tracking ID, dispatch date, order total, and item list. If SMTP credentials are not configured, dispatch still succeeds and the UI reports that email is not configured.
