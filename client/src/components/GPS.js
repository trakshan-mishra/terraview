import L from 'leaflet';

export class GPSManager {
  constructor(map, socket, onUpdate) {
    this.map = map;
    this.socket = socket;
    this.onUpdate = onUpdate;
    this.tracking = false;
    this.marker = null;
    this.accuracyCircle = null;
    this.watchId = null;
    this.position = null;
    this.heading = null;
    this.speed = null;
  }

  start() {
    if (!navigator.geolocation) return Promise.reject(new Error('GPS not supported in this browser'));
    return new Promise((resolve, reject) => {
      // First do a quick one-shot to get fast initial position
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.tracking = true;
          this.position = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          this._updateMarker(pos);
          this._broadcastPosition(pos);
          this.onUpdate(this.position, pos.coords);
          resolve(this.position);
          // Then start watching for updates
          this.watchId = navigator.geolocation.watchPosition(
            p => { this._updateMarker(p); this._broadcastPosition(p); this.onUpdate({ lat: p.coords.latitude, lon: p.coords.longitude }, p.coords); },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
          );
        },
        err => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  _updateMarker(pos) {
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    const latlng = [lat, lon];

    if (!this.marker) {
      const icon = L.divIcon({
        html: '<div class="gps-dot"></div>',
        className: 'gps-marker-icon',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      this.marker = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(this.map);
      this.accuracyCircle = L.circle(latlng, {
        radius: accuracy,
        color: 'rgba(0,212,255,.4)',
        fillColor: 'rgba(0,212,255,.08)',
        fillOpacity: 1,
        weight: 1,
      }).addTo(this.map);
    } else {
      this.marker.setLatLng(latlng);
      this.accuracyCircle.setLatLng(latlng);
      this.accuracyCircle.setRadius(accuracy);
    }
  }

  _broadcastPosition(pos) {
    if (!this.socket?.connected) return;
    this.socket.emit('updatePosition', {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      accuracy: pos.coords.accuracy,
    });
  }

  centerMap(zoom = 15) {
    if (this.position) this.map.setView([this.position.lat, this.position.lon], zoom);
  }

  stop() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.marker) this.map.removeLayer(this.marker);
    if (this.accuracyCircle) this.map.removeLayer(this.accuracyCircle);
    this.tracking = false;
    this.marker = null;
    this.accuracyCircle = null;
  }
}

export class NavigationManager {
  constructor(map) {
    this.map = map;
    this.active = false;
    this.steps = [];
    this.currentStep = 0;
    this.routeLayer = null;
    this.destMarker = null;
    this.onStepChange = null;
  }

  startNavigation(routeData, onStepChange) {
    this.active = true;
    this.steps = routeData.steps || [];
    this.currentStep = 0;
    this.onStepChange = onStepChange;

    // Draw route
    if (this.routeLayer) this.map.removeLayer(this.routeLayer);
    const coords = routeData.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    this.routeLayer = L.polyline(coords, {
      color: '#00d4ff',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this.map);

    // Destination marker
    const lastCoord = coords[coords.length - 1];
    if (this.destMarker) this.map.removeLayer(this.destMarker);
    const destIcon = L.divIcon({
      html: '<div class="dest-marker"></div>',
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 18],
    });
    this.destMarker = L.marker(lastCoord, { icon: destIcon }).addTo(this.map);

    this.updateHUD();
    return this.currentInstruction();
  }

  updatePosition(pos) {
    if (!this.active || !this.steps.length) return;
    // Check if user is near next step
    const step = this.steps[this.currentStep];
    if (!step?.location) return;
    const [sLon, sLat] = step.location;
    const dist = this._dist(pos.lat, pos.lon, sLat, sLon);
    if (dist < 30 && this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.updateHUD();
      if (this.onStepChange) this.onStepChange(this.steps[this.currentStep]);
    }
  }

  _dist(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  currentInstruction() {
    return this.steps[this.currentStep]?.instruction || 'Continue on route';
  }

  updateHUD() {
    const step = this.steps[this.currentStep];
    if (!step || !this.onStepChange) return;
    this.onStepChange(step);
  }

  stopNavigation() {
    this.active = false;
    if (this.routeLayer) this.map.removeLayer(this.routeLayer);
    if (this.destMarker) this.map.removeLayer(this.destMarker);
    this.steps = [];
    this.currentStep = 0;
  }
}
