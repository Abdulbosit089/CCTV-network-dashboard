
import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cctv_network_secret_key_2024';

// --- DATABASE SETUP ---
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'cctv_network'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Fallback in-memory store if DB connection fails (for demo resilience)
let useInMemory = false;
const memoryDb = {
  users: [] as any[],
  cameras: [
    { id: 1, name: 'Front Gate HQ', location: 'Main Entrance', resolution: '1080p', fps: 30, bitrate: 4.5, is_active: true },
    { id: 2, name: 'Server Room A', location: 'Data Center', resolution: '4K', fps: 15, bitrate: 12.0, is_active: true },
    { id: 3, name: 'Parking Lot East', location: 'Outer Perimeter', resolution: '720p', fps: 24, bitrate: 2.0, is_active: true }
  ],
  metrics: [] as any[],
  alerts: [] as any[],
  logs: [] as any[]
};

const initDb = async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'viewer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cameras (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(200),
        resolution VARCHAR(20),
        fps INTEGER DEFAULT 30,
        bitrate DECIMAL(10,2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS network_metrics (
        id SERIAL PRIMARY KEY,
        bandwidth_usage DECIMAL(10,2),
        latency DECIMAL(10,2),
        packet_loss DECIMAL(5,2),
        jitter DECIMAL(10,2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        alert_type VARCHAR(50),
        current_value DECIMAL(10,2),
        threshold_value DECIMAL(10,2),
        severity VARCHAR(20),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS transaction_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
  } catch (err) {
    console.error('Database connection failed, falling back to in-memory store:', err);
    useInMemory = true;
  }
};

const addLog = async (action: string) => {
  if (useInMemory) {
    memoryDb.logs.push({ id: Date.now(), action, timestamp: new Date() });
    if (memoryDb.logs.length > 50) memoryDb.logs.shift();
    return;
  }
  try {
    await pool.query('INSERT INTO transaction_logs (action) VALUES ($1)', [action]);
  } catch (err) {
    console.error('Error adding log:', err);
  }
};

app.use(cors());
app.use(express.json());

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- API ROUTES ---

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    if (useInMemory) {
      if (memoryDb.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      const newUser = { id: Date.now(), username, password_hash: passwordHash, role: 'administrator' };
      memoryDb.users.push(newUser);
      addLog(`USER_SIGNUP: ${username}`);
      return res.status(201).json({ id: newUser.id, username: newUser.username });
    }
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username',
      [username, passwordHash, 'administrator']
    );
    addLog(`USER_SIGNUP: ${username}`);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    let user;
    if (useInMemory) {
      user = memoryDb.users.find(u => u.username === username);
    } else {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      user = result.rows[0];
    }

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      addLog(`FAILED_LOGIN: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    addLog(`USER_LOGIN: ${username}`);
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, username: user.username });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/change-password', authenticateToken, async (req: any, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    let user;
    if (useInMemory) {
      user = memoryDb.users.find(u => u.id === req.user.id);
    } else {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      user = result.rows[0];
    }

    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    if (useInMemory) {
      user.password_hash = newHash;
    } else {
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    }
    addLog(`PASSWORD_CHANGE: ${user.username}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    let cameras, metrics, alerts, logs;
    if (useInMemory) {
      cameras = { rows: memoryDb.cameras };
      metrics = { rows: memoryDb.metrics.slice(-30) };
      alerts = { rows: memoryDb.alerts.slice(-10) };
      logs = { rows: memoryDb.logs.slice(-10) };
    } else {
      cameras = await pool.query('SELECT * FROM cameras ORDER BY id ASC');
      metrics = await pool.query('SELECT * FROM network_metrics ORDER BY timestamp DESC LIMIT 30');
      alerts = await pool.query('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 10');
      logs = await pool.query('SELECT * FROM transaction_logs ORDER BY timestamp DESC LIMIT 10');
    }
    
    res.json({
      cameras: cameras.rows,
      metrics: useInMemory ? metrics.rows : metrics.rows.reverse(),
      alerts: alerts.rows,
      logs: logs.rows,
      capacity: 100
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cameras/toggle/:id', authenticateToken, async (req, res) => {
  try {
    if (useInMemory) {
      const cam = memoryDb.cameras.find(c => c.id === parseInt(req.params.id));
      if (cam) {
        cam.is_active = !cam.is_active;
        addLog(`CAMERA_TOGGLE: ${cam.name} (${cam.is_active ? 'ON' : 'OFF'})`);
        return res.json({ success: true, isActive: cam.is_active });
      }
    } else {
      const result = await pool.query('UPDATE cameras SET is_active = NOT is_active WHERE id = $1 RETURNING *', [req.params.id]);
      const cam = result.rows[0];
      if (cam) {
        addLog(`CAMERA_TOGGLE: ${cam.name} (${cam.is_active ? 'ON' : 'OFF'})`);
        return res.json({ success: true, isActive: cam.is_active });
      }
    }
    res.status(404).json({ error: 'Camera not found' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cameras', authenticateToken, async (req, res) => {
  const { name, location, resolution, fps, bitrate } = req.body;
  try {
    if (useInMemory) {
      const newCam = { id: Date.now(), name, location, resolution, fps, bitrate, is_active: true };
      memoryDb.cameras.push(newCam);
      addLog(`CAMERA_PROVISIONED: ${name}`);
      return res.status(201).json(newCam);
    }
    const result = await pool.query(
      'INSERT INTO cameras (name, location, resolution, fps, bitrate, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *',
      [name, location, resolution, fps, bitrate]
    );
    addLog(`CAMERA_PROVISIONED: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/database/reset', authenticateToken, async (req, res) => {
  try {
    if (useInMemory) {
      memoryDb.cameras = [
        { id: 1, name: 'Front Gate HQ', location: 'Main Entrance', resolution: '1080p', fps: 30, bitrate: 4.5, is_active: true },
        { id: 2, name: 'Server Room A', location: 'Data Center', resolution: '4K', fps: 15, bitrate: 12.0, is_active: true },
        { id: 3, name: 'Parking Lot East', location: 'Outer Perimeter', resolution: '720p', fps: 24, bitrate: 2.0, is_active: true }
      ];
      memoryDb.metrics = [];
      memoryDb.alerts = [];
      memoryDb.logs = [];
    } else {
      await pool.query('DELETE FROM cameras');
      await pool.query('DELETE FROM network_metrics');
      await pool.query('DELETE FROM alerts');
      await pool.query('DELETE FROM transaction_logs');
      await pool.query(`
        INSERT INTO cameras (name, location, resolution, fps, bitrate) VALUES 
        ('Front Gate HQ', 'Main Entrance', '1080p', 30, 4.5),
        ('Server Room A', 'Data Center', '4K', 15, 12.0),
        ('Parking Lot East', 'Outer Perimeter', '720p', 24, 2.0)
      `);
    }
    addLog('DATABASE_RESET');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- SIMULATION LOOP ---
const runSimulation = async () => {
  try {
    let cameras;
    if (useInMemory) {
      cameras = memoryDb.cameras.filter(c => c.is_active);
    } else {
      const result = await pool.query('SELECT * FROM cameras WHERE is_active = true');
      cameras = result.rows;
    }
    
    const capacity = 100;
    const currentTotalBitrate = cameras.reduce((sum, cam) => sum + parseFloat(cam.bitrate), 0);
    const loadRatio = currentTotalBitrate / capacity;
    
    const baseLatency = 20; 
    const queuingDelay = Math.pow(loadRatio, 3) * 500; 
    const latency = baseLatency + queuingDelay + (Math.random() * 5);

    let packetLoss = 0;
    if (loadRatio > 0.8) {
      packetLoss = Math.pow((loadRatio - 0.8) * 5, 2); 
    }
    packetLoss += Math.random() * 0.1;

    const jitter = (Math.random() * 2) + (loadRatio * 15);

    if (useInMemory) {
      memoryDb.metrics.push({ id: Date.now(), bandwidth_usage: currentTotalBitrate, latency, packet_loss: Math.min(packetLoss, 100), jitter, timestamp: new Date() });
      if (memoryDb.metrics.length > 100) memoryDb.metrics.shift();
    } else {
      await pool.query(
        'INSERT INTO network_metrics (bandwidth_usage, latency, packet_loss, jitter) VALUES ($1, $2, $3, $4)',
        [currentTotalBitrate, latency, Math.min(packetLoss, 100), jitter]
      );
    }

    // Check Alerts
    if (loadRatio >= 0.9) {
      const alert = { alert_type: 'Bandwidth', current_value: currentTotalBitrate, threshold_value: capacity * 0.9, severity: 'Critical', timestamp: new Date() };
      if (useInMemory) {
        memoryDb.alerts.push({ id: Date.now(), ...alert });
        if (memoryDb.alerts.length > 50) memoryDb.alerts.shift();
      } else {
        await pool.query(
          'INSERT INTO alerts (alert_type, current_value, threshold_value, severity) VALUES ($1, $2, $3, $4)',
          [alert.alert_type, alert.current_value, alert.threshold_value, alert.severity]
        );
      }
    }
  } catch (err) {
    console.error('Simulation error:', err);
  }
};

setInterval(runSimulation, 5000);

// --- VITE MIDDLEWARE ---
async function startServer() {
  await initDb();
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
