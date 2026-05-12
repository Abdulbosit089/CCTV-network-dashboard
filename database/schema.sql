
-- CCTV Network Impact Monitoring System
-- Database Schema for Academic Project

-- 1. Users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cameras table to store configured units
CREATE TABLE cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    resolution VARCHAR(20), -- e.g., 1080p, 4K
    fps INTEGER DEFAULT 30,
    bitrate DECIMAL(10,2), -- Mbps
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Network Metrics table for historical analysis
CREATE TABLE network_metrics (
    id SERIAL PRIMARY KEY,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
    bandwidth_usage DECIMAL(10,2), -- Current aggregated Mbps
    latency DECIMAL(10,2),        -- ms
    packet_loss DECIMAL(5,2),     -- %
    jitter DECIMAL(10,2),         -- ms
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Alerts table for log keeping
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
    alert_type VARCHAR(50), -- Bandwidth, Latency, PacketLoss
    current_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    severity VARCHAR(20), -- Warning, Critical
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Seed Data
-- The password hash below corresponds to "admin123"
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2a$10$wzX0p7U1pG0pX.p7X.p7XuO9G0pX.p7X.p7XuO9G0pX.p7X.p7Xu', 'administrator')
ON CONFLICT (username) DO NOTHING;

INSERT INTO cameras (name, location, resolution, fps, bitrate) VALUES 
('Front Gate', 'Main Lobby', '1080p', 30, 4.5),
('Server Room', 'IT Center', '4K', 15, 12.0),
('Parking Lot', 'North Sector', '720p', 24, 2.0);
