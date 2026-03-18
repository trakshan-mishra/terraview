import L from 'leaflet';
import { io } from 'socket.io-client';

export class UserLayer {
  constructor(map, onCount) {
    this.map = map;
    this.onCount = onCount;
    this.group = L.layerGroup();
    this.markers = new Map();
    this.socket = null;
  }

  connect() {
    const url = import.meta.env.VITE_WS_URL || window.location.origin;
    this.socket = io(url, { transports: ['websocket','polling'], reconnectionAttempts: 5 });
    this.socket.on('connect', () => this._broadcast());
    this.socket.on('userCount', n => this.onCount(n));
    this.socket.on('userPositions', positions => this._sync(positions));
    this.map.on('moveend', () => this._broadcast());
    setInterval(() => this._broadcast(), 12000);
    return this.socket;
  }

  _broadcast() {
    if (!this.socket?.connected) return;
    const c = this.map.getCenter();
    this.socket.emit('updatePosition', { lat: c.lat, lon: c.lng });
  }

  broadcastPosition(lat, lon, extras = {}) {
    if (!this.socket?.connected) return;
    this.socket.emit('updatePosition', { lat, lon, ...extras });
  }

  _sync(positions) {
    const seen = new Set();
    positions.forEach(u => {
      if (!u.lat) return;
      seen.add(u.id);
      if (!this.markers.has(u.id)) {
        const icon = L.divIcon({
          html: `<div style="width:7px;height:7px;background:#00e676;border-radius:50%;opacity:.7;box-shadow:0 0 5px #00e676"></div>`,
          className: '', iconSize: [7,7], iconAnchor: [3.5,3.5],
        });
        this.markers.set(u.id, L.marker([u.lat, u.lon], { icon }).addTo(this.group));
      } else {
        this.markers.get(u.id).setLatLng([u.lat, u.lon]);
      }
    });
    this.markers.forEach((m, id) => {
      if (!seen.has(id)) { this.group.removeLayer(m); this.markers.delete(id); }
    });
  }

  show() { this.map.addLayer(this.group); }
  hide() { this.map.removeLayer(this.group); }
  getSocket() { return this.socket; }
}
