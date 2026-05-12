
export interface Camera {
  id: string;
  name: string;
  location: string;
  resolution: string;
  fps: number;
  bitrate: number; // in Mbps
  is_active: boolean;
}

export interface NetworkMetric {
  id: string;
  timestamp: number;
  bandwidth_usage: number; // Mbps
  latency: number; // ms
  packet_loss: number; // %
  jitter: number; // ms
}

export interface Alert {
  id: string;
  timestamp: number;
  alert_type: 'Bandwidth' | 'Latency' | 'Packet Loss';
  current_value: number;
  threshold_value: number;
  severity: 'Warning' | 'Critical';
}
