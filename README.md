
# CCTV Network Impact Monitoring and Simulation System

This system is an academic demonstration of how bandwidth-heavy IoT devices (CCTV cameras) impact local area network performance.

## Core Features
- **Real-time Simulation:** Dynamically calculates latency and packet loss based on aggregated camera bitrates.
- **Interactive Controls:** Toggle cameras on/off to see immediate impact on network congestion.
- **Visual Analytics:** Real-time charts for monitoring bandwidth vs latency.
- **Threshold Alerts:** Automatic detection of network saturation.

## Simulation Logic Explanation
The application uses a mathematical model to simulate network behavior:
1. **Queuing Delay:** As `Current Traffic / Capacity` approaches 1.0, latency increases exponentially (modeling a full router buffer).
2. **Packet Dropping:** When load exceeds 80%, a random loss factor is introduced to simulate TCP/IP congestion control mechanisms (tail-drop).
3. **Bitrate Aggregation:** Demonstrates that CCTV scalability is limited by backhaul network capacity.

## How to Run
This project is a unified Full-Stack application.

### 1. Installation
Install all dependencies from the root directory:
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (optional, as the system has a built-in fallback):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/cctv_network
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_gemini_api_key
```
*Note: If no database is detected, the system will automatically use a robust in-memory store for demonstration.*

### 3. Development Mode
Start both the backend server and the frontend development environment with a single command:
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

### 4. Production Build
To build the project for production:
```bash
npm run build
npm start
```

## Project Structure
- `/server`: Node.js/Express backend and database logic.
- `/client`: React frontend and dashboard UI.
- `/shared`: Shared TypeScript types.

## Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, Recharts.
- **Backend:** Node.js, Express.js.
- **Database:** PostgreSQL.
