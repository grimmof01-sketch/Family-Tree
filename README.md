<p align="center">
  <img src="frontend/public/fist.png" alt="Sangam Roots Logo" width="80" />
</p>

<h1 align="center">Sangam Roots</h1>

<p align="center">
  <strong>A mathematical validation and kinship engine for managing family trees governed by Dravidian kinship parity and descent rules.</strong>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#detailed-description">Detailed Description</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#security-enforcements">Security Enforcements</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#future-development-roadmap">Roadmap</a> •
  <a href="#license">License</a>
</p>

---

## Overview

**Sangam Roots** is a full-stack web application designed for building, visualizing, and managing family trees governed by Dravidian kinship systems. Unlike typical Western genealogies, the Dravidian system classifies relatives into parallel and cross categories based on lineage parity. This application features a custom mathematical engine that resolves kinship relationships, provides visual interactive graphs using React Flow, manages secure user accounts and roles, and facilitates cross-tree spouse linking.

---

## Detailed Description

Dravidian kinship is characterized by its bifurcate merging structure and descent rules. Relatives are divided into two main categories:
1. **Parallel Kin**: Siblings, father's brothers, mother's sisters, and parallel cousins (father's brother's children or mother's sister's children). Parallel cousins are conceptually classified as brothers and sisters, and marriage among them is strictly taboo.
2. **Cross Kin**: Mother's brothers, father's sisters, and cross cousins (father's sister's children or mother's brother's children). Cross cousins are eligible marriage partners.

**Sangam Roots** mathematically computes relationship terms between any two nodes in a family tree using parity-based graph traversal. It traces paths, calculates generation difference and gender parity, and resolves the correct Dravidian kinship term (e.g., *Anna* / *Thambi* for parallel brother, *Maman* for maternal uncle, *Machan* for cross-cousin). 

### Key Capabilities:
- **Interactive Graphing**: Drag-and-pan canvas rendered via React Flow. Nodes are organized dynamically using the Dagre layout algorithm.
- **Cross-Tree Spousal Linking**: When members of different family trees marry, administrators can link the spouse node to their original family tree, allowing seamless cross-tree navigation.
- **Universal Profiles & In-Memory Authentication**: Allows users to manage a centralized profile and choose which fields automatically synchronize with their corresponding node in the family tree.
- **Activity Logging & Revert Actions**: Every modification (adding nodes, marriages, spouse links) is audited. Admins can roll back actions from the activity history panel.

---

## Tech Stack

### Frontend
- **React 19** — User interface rendering
- **Vite** — Fast building and local development server
- **Tailwind CSS** — Utility-first styling with custom design tokens
- **React Flow** — Node-based graph canvas for family tree visualization
- **Dagre** — Automatic hierarchical graph layout calculation
- **Firebase client SDK** — User authentication verification

### Backend
- **Node.js + Express** — REST API routing and logic
- **MongoDB + Mongoose** — Document database and Object Data Modeling (ODM)
- **Firebase Admin SDK** — Verification of client-side authentication tokens
- **Google API Client** — Google Drive upload integration for profile pictures

---

## Security Enforcements

The application is hardened against major OWASP security vulnerabilities:

### 1. SQL Injection & NoSQL Injection Protection
* **Defense**: Built-in immunity to SQL Injection by utilizing **MongoDB** instead of SQL databases. 
* **Mechanism**: To prevent NoSQL query operator injection (such as bypassing login using `{ "$gt": "" }`), the backend applies a global recursive sanitization middleware ([sanitize.js](file:///home/grimm/dravidian-kinship-tree/backend/middleware/sanitize.js)). It strips keys starting with `$` or containing `.` from all incoming `body`, `query`, and `params` inputs before they reach the database queries.

### 2. Cross-Site Scripting (XSS) Prevention
* **Defense**: React automatically escapes text contents rendered inside JSX brackets, neutralizing typical script injection.
* **Mechanism**: We do not use `dangerouslySetInnerHTML`. Furthermore, user-submitted URLs (social media and profile photos) are filtered using helper functions that prepend `https://` if an `http` prefix is not present. This prevents the execution of malicious `javascript:` URI schemes.

### 3. DDoS (Distributed Denial of Service) Shielding
* **Defense**: Infrastructure-level shielding provided by **Render** proxy gateways. 
* **Mechanism**: Limits concurrent connections and filters malformed request headers. Rate limits are additionally enforced at the application level to defend resource-intensive endpoints.

### 4. Credential Stuffing & Brute Force Protection
* **Defense**: IP-based rate limiting on sensitive routes.
* **Mechanism**: A custom sliding-window rate-limiting middleware ([rateLimiter.js](file:///home/grimm/dravidian-kinship-tree/backend/middleware/rateLimiter.js)) is active on all authentication endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/auth/firebase-login`). It permits a maximum of 15 authentication attempts per 5 minutes per IP, blocking automated botnets and scanners.

### 5. Session Proxying & Token Hijack Protection
* **Defense**: Safe in-memory frontend storage.
* **Mechanism**: The auth token is stored only in-memory (`authToken` in JavaScript state) and is never written to `localStorage` or persistent cookies, preventing token extraction via browser vulnerabilities.
* **Mechanism**: HTTPS/SSL is strictly enforced in transit.
* **Mechanism**: Single active session rules are enforced. A new login automatically overwrites `currentSessionToken` in the database. Any existing session on another tab or device immediately fails token matching in the auth middleware ([auth.js](file:///home/grimm/dravidian-kinship-tree/backend/middleware/auth.js)) and gets ejected.

### 6. Malware Upload Protection
* **Defense**: Memory-based file uploads and strict MIME validation.
* **Mechanism**: File uploads are processed using Multer's `memoryStorage`. No files are written to the web server's local disk, blocking LFI or local shell execution.
* **Mechanism**: A `fileFilter` in `multer` restricts uploads strictly to image formats (`image/*`), rejecting malicious binaries, executables, or scripts.

---

## Getting Started

### Prerequisites

To run the backend and frontend locally, the following modules and credentials are required:

- **Node.js** v18+ and **npm**
- **MongoDB** Atlas database instance or a running local MongoDB instance
- **Firebase Project** with Authentication enabled (Email/Password + Google sign-in)
- **Firebase Admin SDK credentials** saved as `backend/service-account.json`
- **Google Cloud Console Service Account** with Google Drive API enabled (for image hosting)

### Backend Dependencies
The backend requires the following npm packages, which will be installed automatically:
- `express` — Web framework
- `mongoose` — Database connection
- `bcryptjs` — Local credential password hashing
- `jsonwebtoken` — JWT token generation
- `multer` — Multi-part form-data parsing for uploads
- `cors` — Cross-Origin Resource Sharing configuration
- `dotenv` — Environment configuration loading
- `firebase-admin` — Firebase authentication token verification
- `googleapis` — Google Drive file uploading

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/Family-Tree.git
cd Family-Tree
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>

# Firebase Service Account Credentials (matching firebase-admin config)
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Google Drive API configuration (for profile pictures)
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id
```

Make sure your Google Service Account key file is saved as `backend/service-account.json`.

Start the backend:
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Configure your Firebase client credentials inside [firebase.js](file:///home/grimm/dravidian-kinship-tree/frontend/src/utils/firebase.js).

Start the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

---

## Project Structure

```
Family-Tree/
├── backend/
│   ├── config/
│   │   └── db.js                # MongoDB connection setup
│   ├── controllers/
│   │   ├── authController.js    # Authentication and profiles
│   │   ├── kinshipController.js # Kinship engine and calculator
│   │   ├── superadminController.js
│   │   └── treeController.js    # Tree management and CRUD
│   ├── middleware/
│   │   ├── auth.js              # JWT session matching middleware
│   │   ├── rateLimiter.js       # sliding-window brute force protection
│   │   └── sanitize.js          # NoSQL query operator scrubbing
│   ├── models/
│   │   ├── ActivityLog.js
│   │   ├── Edge.js              # Relationships (parent-child, spouse)
│   │   ├── JoinRequest.js
│   │   ├── Node.js              # Tree nodes (family members)
│   │   ├── Notification.js
│   │   ├── Tree.js
│   │   └── User.js              # User profiles and settings
│   ├── routes/
│   │   ├── auth.js
│   │   ├── kinship.js
│   │   ├── superadmin.js
│   │   └── trees.js
│   ├── server.js                # Express app entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # UI Components
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Auth event listeners (pagehide/unload)
│   │   ├── utils/
│   │   │   ├── api.js           # Fetch wrapper with dynamic backend URL
│   │   │   └── firebase.js      # In-memory Firebase SDK persistence
│   │   └── App.jsx
│   └── package.json
```

---

## API Reference

### Authentication — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Register an account (rate limited) |
| `POST` | `/login` | Login with credentials (rate limited) |
| `POST` | `/google` | Google sign-in auth (rate limited) |
| `POST` | `/firebase-login` | Verify Firebase ID token (rate limited) |
| `POST` | `/logout` | Terminate session and invalidate JWT |
| `GET` | `/me` | Get current verified user profile |
| `PUT` | `/profile` | Edit user profile and sync options |
| `POST` | `/upload` | Upload picture buffer to Google Drive (image validation) |

### Trees — `/api/trees`
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/` | Create a family tree |
| `GET` | `/` | Retrieve accessible trees for user |
| `GET` | `/:treeId` | Get full tree structure (nodes and edges) |
| `DELETE` | `/:treeId` | Delete a family tree (Admin only) |

### Kinship Operations — `/api/kinship`
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/:treeId/nodes` | Create a member node |
| `POST` | `/:treeId/nodes/spouse` | Add spouse node (with cross-tree checks) |
| `POST` | `/:treeId/edges/marriage` | Create a marriage link |
| `POST` | `/:treeId/edges/parent-child` | Create a parent-child relationship |
| `GET` | `/:treeId/relation` | Calculate exact kinship terms between two members |
| `POST` | `/:treeId/logs/:logId/revert` | Roll back an action from history |
| `GET` | `/:treeId/notifications` | Fetch birthday and anniversary alerts |

---

## Future Development Roadmap

We plan to implement the following features in future versions of **Sangam Roots**:

1. **Dravidian Marriage Eligibility Checker**: 
   An algorithmic rules engine that checks selected nodes and warns/informs user whether a marriage complies with Dravidian kinship rules (e.g., checks parity classification to ensure partners are cross-cousins and not parallel cousins).
2. **Advanced Descent Visualizations**:
   Add filter overlays to highlight specific lineages separately (such as highlighting matrilineal vs. patrilineal inheritance lines in different colors).
3. **Offline-First Tree Editing**:
   Implement LocalStorage/IndexedDB state saving on the frontend so users can make drafts or edit family trees offline, syncing changes to MongoDB once network reconnects.
4. **Automated Notification Delivery**:
   Integrate Twilio (SMS) or SendGrid (Email) to send automated alerts for birthdays, anniversaries, and join requests directly to family members.
5. **Interactive Kinship Game / Walkthrough**:
   An interactive tutorial showing step-by-step how Dravidian kinship terms are resolved for different members, preserving anthropological knowledge for younger generations.

---

## License

This project is for educational and personal use.

---

<p align="center">
  Built with ❤️ for preserving Dravidian family heritage
</p>
