# Grimoire

A self-hosted D&D 5e character management web application. Players log in from any device (including tablets and phones) to create and manage their characters. Dungeon Masters can run campaigns, add players, and view or edit all characters in their campaigns.

---

## Requirements

- [Node.js](https://nodejs.org/) v20 or newer (a `.nvmrc` file is included — run `nvm use` if you use [nvm](https://github.com/nvm-sh/nvm))
- npm (comes with Node.js)

---

## First-Time Setup

### 1. Install dependencies

```bash
# Server dependencies
npm install

# Client dependencies
cd client && npm install && cd ..
```

> **Note:** `better-sqlite3` uses a native binary. If you see a segfault or core dump on first run, rebuild it for your Node.js version:
> ```bash
> npm rebuild better-sqlite3
> ```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set a strong, random `JWT_SECRET`. This is used to sign login tokens — treat it like a password.

```env
PORT=3000
JWT_SECRET=replace_this_with_a_long_random_string
DB_PATH=./grimoire.db
```

### 3. Create the first admin user

Admins can only be created via the CLI on the server. The database is created automatically on first run.

```bash
node server/cli.js create-admin -u admin -p yourpassword
```

### 4. Build the frontend

```bash
cd client && npm run build && cd ..
```

### 5. Start the server

```bash
npm start
```

Open `http://localhost:3000` (or your server's IP/domain) in a browser. Log in with the admin credentials you created.

---

## Running in Development

To run the backend and frontend separately with hot reload:

**Terminal 1 — API server:**
```bash
npm run dev
```

**Terminal 2 — Vite dev server (auto-proxies `/api` to port 3000):**
```bash
cd client && npm run dev
```

Then open `http://localhost:5173`.

---

## Admin CLI

The CLI is the only way to manage admin-level users directly on the server.

```bash
# Create an admin user
node server/cli.js create-admin -u <username> -p <password>

# List all users
node server/cli.js list-users

# Reset any user's password
node server/cli.js reset-password -u <username> -p <newpassword>
```

---

## Admin Panel (Web UI)

Admin users have access to an **Admin** tab in the navigation. From there you can:

- Create new player accounts
- Reset any user's password
- Delete player accounts

Admin accounts cannot be deleted from the web UI — use the CLI for admin management.

---

## How It Works

### Users & Roles

| Role    | Capabilities |
|---------|-------------|
| `admin` | Manage all user accounts (create, delete, reset passwords) |
| `player` | Create characters, create campaigns (as DM), join campaigns |

Every user with the `player` role can be both a player in some campaigns and a DM in others simultaneously.

### Characters

- Players create and own their characters. All data maps to the standard D&D 5e pen-and-paper sheet.
- Characters exist independently of campaigns. Any edits — whether made inside or outside a campaign — are reflected everywhere.
- Only the owner (or a DM of a campaign the character belongs to) can view or edit a character.

### Campaigns

- Any player can create a campaign, making them the **Dungeon Master (DM)** of it.
- The DM adds registered players to the campaign.
- Players (and the DM) add their own characters to the campaign.

### Permissions inside a campaign

| Action | DM | Player |
|--------|:--:|:------:|
| View all campaign characters | ✅ | ❌ |
| View own characters | ✅ | ✅ |
| Edit any campaign character | ✅ | ❌ |
| Edit own characters | ✅ | ✅ |
| Add/remove players | ✅ | ❌ |
| Assign a character to a player | ✅ | ❌ |
| Copy another player's character | ✅ | ❌ |
| Add own character to campaign | ✅ | ✅ |

**Assignment:** The DM can reassign ownership of their own characters to any player in the campaign. They cannot take ownership of a player's character, but they can create a copy of it (which they own and can then assign).

---

## Updating

After pulling new code:

```bash
npm install
cd client && npm install && npm run build && cd ..
npm start
```

---

## Data

The database is a single SQLite file at the path set by `DB_PATH` in `.env` (default: `./grimoire.db`).

**Backup:** Copy `grimoire.db` to a safe location. That file contains all users, characters, and campaigns.

**Restore:** Stop the server, replace `grimoire.db` with your backup, start the server again.

---

## Hosting Tips

- **Reverse proxy:** Use Nginx or Caddy in front of the Node server to handle HTTPS and serve on port 80/443.
- **Process manager:** Use [PM2](https://pm2.keymetrics.io/) to keep the server running and restart it on crashes:
  ```bash
  npm install -g pm2
  pm2 start server/index.js --name grimoire
  pm2 save
  pm2 startup
  ```
- **Port:** Change `PORT` in `.env` to run on a different port.
