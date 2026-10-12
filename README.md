# Timetable Management System

A timetable management application built with a React/Vite frontend, an Express/Prisma backend, and PostgreSQL. Docker is not required.

## Prerequisites

Install the following before starting:

- [Node.js](https://nodejs.org/) 20 or later (includes npm)
- [PostgreSQL](https://www.postgresql.org/download/)

Ensure the PostgreSQL server is running and that you have credentials for a user allowed to create and access a database.

## Setup

1. Clone the repository and open its root directory.

2. Install the backend dependencies:

   ```powershell
   cd backend
   npm install
   ```

3. Create the backend environment file from the example:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Update `backend/.env` with your PostgreSQL credentials. At minimum, set `DATABASE_URL` and replace the development `JWT_SECRET` with a secure value.

   ```env
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/timetable_db"
   JWT_SECRET="use_a_long_random_secret"
   ```

5. Create the database. For the default connection string, run:

   ```powershell
   createdb -U postgres timetable_db
   ```

   Alternatively, create a database named `timetable_db` using pgAdmin or any PostgreSQL client. If you use a different database name, update `DATABASE_URL` to match.

6. Apply the Prisma migrations, generate the Prisma client, and add the initial data:

   ```powershell
   npm run prisma:migrate
   npm run prisma:generate
   npm run prisma:seed
   ```

7. Install the frontend dependencies:

   ```powershell
   cd ..\frontend
   npm install
   ```

## Run the project

Start the backend in one terminal:

```powershell
cd backend
npm run dev
```

The API starts at `http://localhost:5000`; its health check is available at `http://localhost:5000/api/health`.

In a second terminal, start the frontend:

```powershell
cd frontend
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. The frontend development server automatically proxies `/api` requests to the backend on port `5000`.

## Useful commands

From `backend`:

```powershell
npm run prisma:verify  # Verify the Prisma/database setup
npm test               # Run backend tests
```

From `frontend`:

```powershell
npm run build          # Create a production build
npm run lint           # Lint the frontend
```

## Production Deployment (No Docker)

For step-by-step production deployment using Nginx, PostgreSQL, and PM2/systemd without Docker, see the [Production Deployment Guide](file:///c:/3rd/year/Timetable/deploy/README.md).

