import L from 'leaflet';
import { api } from '../utils/api.js';

function altColor(alt) {
  if (!alt) return '#f5a623';
  if (alt > 10000) return '#00d4ff';
  if (alt > 5000) return '#00e676';
  if (alt > 2000) return '#f5a623';
  return '#ff7043';
}

function planeIcon(heading = 0, color = '#f5a623', size = 16) {
  return L.divIcon({
    html: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${(heading||0)}, 10, 10)">
        <polygon points="10,1 12.5,14 10,11.5 7.5,14" fill="${color}" opacity=".95"/>
        <polygon points="4.5,9 15.5,9 10,11.5" fill="${color}" opacity=".55"/>
      </g>
    </svg>`,
    className: '', iconSize: [size, size], iconAnchor: [size/2, size/2],
  });
}

export class FlightLayer {
  constructor(map, onFlightClick) {
    this.map = map;
    this.onFlightClick = onFlightClick;
    this.group = L.layerGroup();
    this.markers = new Map();
    this.visible = false;
    this.interval = null;
    this.count = 0;
  }

  async start() {
    this.group.addTo(this.map);
    this.visible = true;
    await this.refresh();
    // Refresh every 30s — OpenSky rate limits to ~100 req/10min
    this.interval = setInterval(() => this.refresh(), 30000);
  }

  async refresh() {
    if (!this.visible) return;
    try {
      const { flights = [], cached, age } = await api.flights();
      this.count = flights.length;
      if (flights.length > 0) {
        this._sync(flights);
        console.log(`✈ ${flights.length} flights${cached ? ` (cached ${age}s ago)` : ' (fresh)'}`);
      }
      return flights.length;
    } catch (e) {
      console.warn('Flights unavailable:', e.message);
      // Don't clear existing markers — keep showing last known positions
    }
  }

  _sync(flights) {
    const seen = new Set();
    flights.forEach(f => {
      if (!f.lat || !f.lon) return;
      seen.add(f.id);
      const color = altColor(f.altitude);
      if (this.markers.has(f.id)) {
        const m = this.markers.get(f.id);
        m.setLatLng([f.lat, f.lon]);
        m.setIcon(planeIcon(f.heading, color));
        m._data = f;
      } else {
        const m = L.marker([f.lat, f.lon], {
          icon: planeIcon(f.heading, color),
          title: f.callsign,
        });
        m._data = f;
        m.on('click', () => this.onFlightClick(f));
        m.bindTooltip(f.callsign || f.id, { className: 'tv-tip', direction: 'top', offset: [0, -8] });
        m.addTo(this.group);
        this.markers.set(f.id, m);
      }
    });
    this.markers.forEach((m, id) => {
      if (!seen.has(id)) { this.group.removeLayer(m); this.markers.delete(id); }
    });
  }

  show() { this.visible = true; this.map.addLayer(this.group); this.refresh(); }
  hide() { this.visible = false; this.map.removeLayer(this.group); }

  getNearby(lat, lon, n = 8) {
    return Array.from(this.markers.values())
      .map(m => ({ ...m._data, _d: Math.hypot(m.getLatLng().lat - lat, m.getLatLng().lng - lon) }))
      .sort((a, b) => a._d - b._d).slice(0, n);
  }

  stop() {
    clearInterval(this.interval);
    this.map.removeLayer(this.group);
  }
}
