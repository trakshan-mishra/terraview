import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import { FlightLayer } from './components/FlightLayer.js';
import { UserLayer } from './components/UserLayer.js';
import { GPSManager, NavigationManager } from './components/GPS.js';
import { api } from './utils/api.js';

// ── SKELETON ─────────────────────────────────────────────
document.getElementById('app').innerHTML = `
<div id="topbar">
  <div class="logo">Terra<em>View</em></div>
  <div id="search-form">
    <svg class="s-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="5.5" cy="5.5" r="4" stroke="rgba(160,200,240,.5)" stroke-width="1.2"/>
      <path d="M9 9l3 3" stroke="rgba(160,200,240,.5)" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
    <input id="search-input" type="text" placeholder="Search any city, place, airport…" autocomplete="off"/>
    <div id="search-results"></div>
  </div>
  <div class="topbar-right">
    <div class="live-pill"><div class="pulse"></div><span id="user-count">0</span> live</div>
    <div class="gps-btn" id="gps-btn">📍 My Location</div>
  </div>
</div>
<div id="main">
  <div id="map"></div>

  <!-- Left toolbar -->
  <div id="left-panel">
    <div class="tool-btn active" data-tool="map" title="Map view">
      <div class="icon">🗺</div><div class="label">Map</div>
    </div>
    <div class="tool-btn" data-tool="satellite" title="Satellite">
      <div class="icon">🛰</div><div class="label">Sat</div>
    </div>
    <div class="tool-btn" data-tool="traffic" title="Traffic">
      <div class="icon">🚦</div><div class="label">Traffic</div>
    </div>
    <div class="tool-btn" data-tool="flights" title="Air traffic">
      <div class="icon">✈</div><div class="label">Air</div>
    </div>
    <div class="tool-btn" data-tool="users" title="Live users">
      <div class="icon">👥</div><div class="label">Users</div>
    </div>
    <div class="tool-btn" data-tool="nearby" title="Nearby places">
      <div class="icon">📍</div><div class="label">Near</div>
    </div>
  </div>

  <!-- Right sidebar -->
  <div id="sidebar">
    <div id="sidebar-tabs">
      <div class="tab active" data-tab="navigate">Navigate</div>
      <div class="tab" data-tab="flights">Flights</div>
      <div class="tab" data-tab="ai">AI</div>
      <div class="tab" data-tab="info">Info</div>
    </div>

    <!-- NAVIGATE TAB -->
    <div class="tab-panel active" id="tab-navigate">
      <div id="nav-panel">
        <div class="route-inputs">
          <div class="route-input-wrap">
            <div class="route-dot from"></div>
            <input class="route-in" id="from-input" type="text" placeholder="From: Your location or search…" autocomplete="off"/>
          </div>
          <div class="route-input-wrap">
            <div class="route-dot to"></div>
            <input class="route-in" id="to-input" type="text" placeholder="To: Destination…" autocomplete="off"/>
          </div>
        </div>
        <div class="mode-row">
          <div class="mode-btn active" data-mode="driving" title="Drive">🚗</div>
          <div class="mode-btn" data-mode="walking" title="Walk">🚶</div>
          <div class="mode-btn" data-mode="cycling" title="Cycle">🚴</div>
          <div class="mode-btn" data-mode="flying" title="Fly (AI)">✈️</div>
        </div>
        <button class="go-btn" id="route-btn">Get Route</button>
        <div id="route-result">
          <div class="route-summary">
            <div class="rs-main" id="rs-summary">—</div>
            <div class="rs-sub" id="rs-sub">—</div>
            <div class="rs-meta">
              <div class="rs-badge" id="rs-dist">—</div>
              <div class="rs-badge" id="rs-time">—</div>
              <div class="rs-badge" id="rs-mode">—</div>
            </div>
          </div>
          <div class="steps-list" id="steps-list"></div>
          <button class="start-nav-btn" id="start-nav-btn">▶ Start Navigation</button>
        </div>
      </div>
    </div>

    <!-- FLIGHTS TAB -->
    <div class="tab-panel" id="tab-flights">
      <div id="flights-panel">
        <div class="flights-header">
          <div style="font-family:var(--fd);font-size:13px;font-weight:700">✈ Live Air Traffic</div>
          <div class="flights-count" id="fc-count">Loading…</div>
        </div>
        <div id="flight-cards"></div>
        <div id="flight-refresh">Refreshes every 15s · OpenSky Network</div>
      </div>
    </div>

    <!-- AI TAB -->
    <div class="tab-panel" id="tab-ai">
      <div id="ai-panel">
        <div id="ai-messages"></div>
        <div id="quick-prompts">
          <div class="qp" data-q="What's the fastest route avoiding traffic right now?">⚡ Fastest route</div>
          <div class="qp" data-q="What flights are nearby and where are they going?">✈ Nearby flights</div>
          <div class="qp" data-q="What's the weather like and should I travel today?">🌤 Travel weather</div>
          <div class="qp" data-q="Find me restaurants within 1km of my location">🍜 Food nearby</div>
          <div class="qp" data-q="What are the best transport options to get to the nearest airport?">🛫 Airport</div>
          <div class="qp" data-q="Are there any travel alerts or disruptions I should know about?">⚠️ Alerts</div>
        </div>
        <div id="ai-input-row">
          <textarea id="ai-input" rows="2" placeholder="Ask anything — navigation, flights, weather, places…"></textarea>
          <button id="ai-send">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="#060d18" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- INFO TAB -->
    <div class="tab-panel" id="tab-info">
      <div id="info-panel">
        <div class="info-card" id="weather-card">
          <div class="info-title">🌤 Weather</div>
          <div style="font-size:11px;color:var(--muted)">Click anywhere on the map to see weather</div>
        </div>
        <div class="info-card" id="location-card">
          <div class="info-title">📍 Current View</div>
          <div id="location-rows"><div style="font-size:11px;color:var(--muted)">Move the map to update</div></div>
        </div>
        <div class="info-card">
          <div class="info-title">📡 Data Sources</div>
          <div class="info-row"><span class="info-key">Map tiles</span><span class="info-val">OpenStreetMap</span></div>
          <div class="info-row"><span class="info-key">Flights</span><span class="info-val">OpenSky Network</span></div>
          <div class="info-row"><span class="info-key">Routing</span><span class="info-val">OSRM (free)</span></div>
          <div class="info-row"><span class="info-key">Weather</span><span class="info-val">Open-Meteo</span></div>
          <div class="info-row"><span class="info-key">AI</span><span class="info-val">OpenRouter</span></div>
          <div class="info-row"><span class="info-key">Running cost</span><span class="info-val" style="color:var(--green)">~$0–5/mo</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Navigation HUD -->
  <div id="nav-hud">
    <div class="hud-top">
      <div class="hud-instruction" id="hud-instr">Follow the route</div>
      <div class="hud-dist" id="hud-dist">—</div>
    </div>
    <div class="hud-bottom">
      <div class="hud-stat"><div class="hud-val" id="hud-eta">—</div><div class="hud-key">ETA</div></div>
      <div class="hud-stat"><div class="hud-val" id="hud-remain">—</div><div class="hud-key">Remaining</div></div>
      <div class="hud-stat"><div class="hud-val" id="hud-speed">—</div><div class="hud-key">Speed</div></div>
      <button class="hud-end-btn" id="hud-end">End</button>
    </div>
  </div>

  <!-- Coordinate bar -->
  <div id="coord-bar">
    <div class="coord-pill" id="coord-pill">Lat: — Lon: —</div>
    <div class="coord-pill" id="zoom-pill">Zoom: 3</div>
  </div>
</div>
`;

// ── LEAFLET MAP ───────────────────────────────────────────
const map = L.map('map', { center: [20, 0], zoom: 3, zoomControl: true, preferCanvas: true, maxZoom: 19 });

const tileLayers = {
  // Standard OSM — has all city/road labels built in
  map: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19, maxNativeZoom: 19,
  }),
  // Esri satellite imagery
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri, Maxar, GeoEye',
    maxZoom: 19, maxNativeZoom: 17,
  }),
  // Labels overlay for satellite mode (OSM labels on top of satellite)
  satelliteLabels: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '',
    maxZoom: 19, opacity: 0.7,
    className: 'labels-only-tile',
  }),
};
tileLayers.map.addTo(map);
let activeBase = 'map';

// Traffic layer (polylines from Overpass)
const trafficGroup = L.layerGroup();
let trafficLoaded = new Set();
let trafficVisible = false;

// Nearby places layer
const nearbyGroup = L.layerGroup();

// ── REAL-TIME LAYERS ──────────────────────────────────────
const userLayer = new UserLayer(map, n => {
  document.getElementById('user-count').textContent = n.toLocaleString();
});
const socket = userLayer.connect();
userLayer.show();

const flightLayer = new FlightLayer(map, onFlightClick);
flightLayer.start().then(() => refreshFlightPanel());
setInterval(() => refreshFlightPanel(), 30000);

// ── GPS & NAVIGATION ──────────────────────────────────────
let gpsPos = null;
let navManager = new NavigationManager(map);
const gpsManager = new GPSManager(map, socket, (pos, coords) => {
  gpsPos = pos;
  userLayer.broadcastPosition(pos.lat, pos.lon, {
    heading: coords.heading, speed: coords.speed
  });
  if (navManager.active) {
    navManager.updatePosition(pos);
  }
  document.getElementById('hud-speed').textContent =
    coords.speed ? `${Math.round(coords.speed * 3.6)} km/h` : '—';
  document.getElementById('gps-btn').textContent = '📍 Tracking';
  document.getElementById('gps-btn').className = 'gps-btn tracking';
});

document.getElementById('gps-btn').addEventListener('click', async () => {
  const btn = document.getElementById('gps-btn');
  btn.textContent = '⏳ Getting GPS…';
  try {
    if (!navigator.geolocation) throw new Error('Your browser does not support GPS');
    const pos = await gpsManager.start();
    gpsManager.centerMap(14);
    document.getElementById('from-input').value = 'My Location';
    aiAddMsg('sys', `📍 GPS active — your position is locked. Accuracy improves over ~30 seconds. On desktop, accuracy may be 100m–2km (uses WiFi/IP). On mobile it will be much better (5–20m).`);
    switchTab('navigate');
  } catch (e) {
    btn.textContent = '📍 My Location';
    btn.className = 'gps-btn';
    let msg = e.message;
    if (e.code === 1) msg = 'Location access denied — please allow location in your browser settings.';
    if (e.code === 2) msg = 'GPS position unavailable. On desktop this is normal — try on mobile for accurate GPS.';
    if (e.code === 3) msg = 'GPS timed out. On desktop GPS is unreliable — works much better on mobile.';
    aiAddMsg('sys', `⚠️ ${msg}`);
    switchTab('ai');
  }
});

// ── TOOL BUTTONS (left panel) ─────────────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const tool = btn.dataset.tool;

    if (tool === 'map' || tool === 'satellite') {
      document.querySelectorAll('.tool-btn[data-tool="map"],.tool-btn[data-tool="satellite"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (activeBase !== tool) {
        // Remove current base + any label overlay
        map.removeLayer(tileLayers[activeBase]);
        if (activeBase === 'satellite') map.removeLayer(tileLayers.satelliteLabels);
        // Add new base
        tileLayers[tool].addTo(map);
        // Satellite: also add label overlay on top
        if (tool === 'satellite') tileLayers.satelliteLabels.addTo(map);
        activeBase = tool;
      }
    } else if (tool === 'traffic') {
      btn.classList.toggle('active');
      if (btn.classList.contains('active')) {
        trafficVisible = true;
        map.addLayer(trafficGroup);
        await loadTraffic();
      } else {
        trafficVisible = false;
        map.removeLayer(trafficGroup);
      }
    } else if (tool === 'flights') {
      btn.classList.toggle('active');
      btn.classList.contains('active') ? flightLayer.show() : flightLayer.hide();
    } else if (tool === 'users') {
      btn.classList.toggle('active');
      btn.classList.contains('active') ? userLayer.show() : userLayer.hide();
    } else if (tool === 'nearby') {
      btn.classList.toggle('active');
      if (btn.classList.contains('active')) {
        const c = map.getCenter();
        await loadNearby(c.lat, c.lng, 'food');
      } else {
        map.removeLayer(nearbyGroup);
        nearbyGroup.clearLayers();
      }
    }
  });
});

// ── TABS ──────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
}
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

// ── SEARCH ────────────────────────────────────────────────
let searchT;
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', () => {
  clearTimeout(searchT);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.style.display = 'none'; return; }
  searchT = setTimeout(async () => {
    const results = await api.geocode(q).catch(() => []);
    if (!results.length) { searchResults.style.display = 'none'; return; }
    searchResults.innerHTML = results.slice(0, 6).map((r, i) => `
      <div class="sr" data-i="${i}">
        <div class="sr-name">${r.short || r.name.split(',')[0]}</div>
        <div class="sr-type">${r.name.split(',').slice(1, 3).join(',').trim()} · ${r.type || r.class}</div>
      </div>
    `).join('');
    searchResults.style.display = 'block';
    searchResults.querySelectorAll('.sr').forEach((el, i) => {
      el.addEventListener('click', async () => {
        const r = results[i];
        map.setView([r.lat, r.lon], 13);
        searchInput.value = r.short || r.name.split(',')[0];
        searchResults.style.display = 'none';
        document.getElementById('to-input').value = searchInput.value;
        switchTab('ai');
        await askAI(`I just navigated to ${r.name.split(',').slice(0,2).join(',')}. Tell me: best time to visit, how to get here from major cities, current travel alerts, nearby transport hubs, and weather outlook.`);
      });
    });
  }, 380);
});
document.addEventListener('click', e => {
  if (!e.target.closest('#search-form')) searchResults.style.display = 'none';
});

// ── ROUTING ───────────────────────────────────────────────
let navMode = 'driving';
let currentRoute = null;
let routeLayer = null;

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    navMode = btn.dataset.mode;
  });
});

// Auto-fill from GPS
document.getElementById('from-input').addEventListener('focus', () => {
  if (gpsPos && !document.getElementById('from-input').value) {
    document.getElementById('from-input').value = 'My Location';
  }
});

document.getElementById('route-btn').addEventListener('click', async () => {
  const fromVal = document.getElementById('from-input').value.trim();
  const toVal = document.getElementById('to-input').value.trim();
  if (!fromVal || !toVal) return alert('Enter both From and To locations');

  const btn = document.getElementById('route-btn');
  btn.textContent = 'Calculating…'; btn.disabled = true;

  try {
    // Flying mode — AI-powered
    if (navMode === 'flying') {
      switchTab('ai');
      await askAI(`I want to fly from "${fromVal}" to "${toVal}". Give me: available airlines, typical flight duration, approximate costs, check-in tips, and the best way to get to/from each airport.`);
      btn.textContent = 'Get Route'; btn.disabled = false;
      return;
    }

    // Geocode from/to
    const useGPS = (fromVal === 'My Location' || fromVal.match(/^-?\d+\.\d+/)) && gpsPos;
    let fromCoord = useGPS ? gpsPos : null;
    let toCoord = null;

    if (!fromCoord) {
      const r = await api.geocode(fromVal);
      if (!r.length) throw new Error(`Can't find: ${fromVal}`);
      fromCoord = { lat: r[0].lat, lon: r[0].lon };
    }
    const r2 = await api.geocode(toVal);
    if (!r2.length) throw new Error(`Can't find: ${toVal}`);
    toCoord = { lat: r2[0].lat, lon: r2[0].lon };

    // Get route from OSRM
    const route = await api.route({
      fromLat: fromCoord.lat, fromLon: fromCoord.lon,
      toLat: toCoord.lat, toLon: toCoord.lon,
      mode: navMode,
    });
    if (route.error) throw new Error(route.error);
    currentRoute = route;

    // Draw route line
    if (routeLayer) map.removeLayer(routeLayer);
    const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    routeLayer = L.polyline(coords, { color: '#00d4ff', weight: 5, opacity: .85, lineCap: 'round' }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

    // Show result
    const dist = route.distance < 1000
      ? `${Math.round(route.distance)}m`
      : `${(route.distance/1000).toFixed(1)}km`;
    const mins = Math.round(route.duration / 60);
    const eta = new Date(Date.now() + route.duration * 1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

    document.getElementById('rs-summary').textContent = `${fromVal.split(',')[0]} → ${toVal.split(',')[0]}`;
    document.getElementById('rs-sub').textContent = `ETA: ${eta}`;
    document.getElementById('rs-dist').textContent = dist;
    document.getElementById('rs-time').textContent = `${mins} min`;
    document.getElementById('rs-mode').textContent = navMode;

    const stepsEl = document.getElementById('steps-list');
    stepsEl.innerHTML = (route.steps || []).map((s, i) => `
      <div class="step-item">
        <div class="step-num">${i+1}</div>
        <div class="step-text">${s.instruction}</div>
        <div class="step-dist">${s.distance < 1000 ? Math.round(s.distance)+'m' : (s.distance/1000).toFixed(1)+'km'}</div>
      </div>
    `).join('');

    document.getElementById('route-result').style.display = 'block';

    // Ask AI about this route with context
    switchTab('ai');
    await askAI(
      `I'm routing from "${fromVal}" to "${toVal}" by ${navMode}. Distance: ${dist}, time: ${mins} mins. Any traffic warnings, better alternatives, or things I should know along this route?`,
      { route: { from: fromVal, to: toVal, distance: dist, duration: `${mins} min`, mode: navMode } }
    );

  } catch (e) {
    aiAddMsg('sys', `⚠️ Route error: ${e.message}`);
    switchTab('ai');
  }
  btn.textContent = 'Get Route'; btn.disabled = false;
});

// ── START NAVIGATION ──────────────────────────────────────
document.getElementById('start-nav-btn').addEventListener('click', () => {
  if (!currentRoute) return;
  navManager.startNavigation(currentRoute, step => {
    document.getElementById('hud-instr').textContent = step.instruction || 'Continue';
    document.getElementById('hud-dist').textContent =
      step.distance < 1000 ? `${Math.round(step.distance)}m` : `${(step.distance/1000).toFixed(1)}km`;
  });
  document.getElementById('nav-hud').classList.add('active');
  const mins = Math.round(currentRoute.duration / 60);
  const eta = new Date(Date.now() + currentRoute.duration * 1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  document.getElementById('hud-eta').textContent = eta;
  document.getElementById('hud-remain').textContent = `${mins} min`;
  if (socket) socket.emit('startNavigation', { mode: navMode, steps: currentRoute.steps.length });
});

document.getElementById('hud-end').addEventListener('click', () => {
  navManager.stopNavigation();
  document.getElementById('nav-hud').classList.remove('active');
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  if (socket) socket.emit('stopNavigation');
});

// ── TRAFFIC LAYER ─────────────────────────────────────────
async function loadTraffic() {
  if (map.getZoom() < 8) {
    // Show a hint in the traffic legend
    const hint = document.querySelector('#sb-traffic-section div:last-child');
    if (hint) hint.textContent = 'Zoom in to level 8+ to see road data';
    return;
  }
  const b = map.getBounds();
  const bbox = {
    south: b.getSouth().toFixed(2), west: b.getWest().toFixed(2),
    north: b.getNorth().toFixed(2), east: b.getEast().toFixed(2),
  };
  const key = Object.values(bbox).join(',');
  if (trafficLoaded.has(key)) return;
  trafficLoaded.add(key);
  try {
    const { roads = [] } = await api.traffic(bbox);
    roads.forEach(r => {
      if (r.nodes.length < 2) return;
      const lls = r.nodes.map(([lo, la]) => [la, lo]);
      const color = r.level < .3 ? '#00e676' : r.level < .55 ? '#f5a623' : r.level < .78 ? '#ff4444' : '#8b0000';
      const line = L.polyline(lls, { color, weight: r.type === 'motorway' ? 4 : r.type === 'trunk' ? 3 : 2, opacity: .75 });
      if (r.name) line.bindTooltip(r.name, { className: 'tv-tip' });
      line.addTo(trafficGroup);
    });
  } catch (e) { console.warn('Traffic:', e.message); trafficLoaded.delete(key); }
}
map.on('moveend', () => { if (trafficVisible && map.getZoom() >= 8) loadTraffic(); });

// ── NEARBY PLACES ─────────────────────────────────────────
async function loadNearby(lat, lon, type) {
  nearbyGroup.clearLayers();
  map.addLayer(nearbyGroup);
  try {
    const { places = [] } = await api.nearby(lat, lon, type);
    places.forEach(p => {
      const icon = L.divIcon({
        html: `<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:2px 6px;font-size:10px;color:var(--white);white-space:nowrap;font-family:var(--fb)">${p.name.slice(0,18)}</div>`,
        className: '', iconAnchor: [0, 0],
      });
      L.marker([p.lat, p.lon], { icon })
        .bindPopup(`<b>${p.name}</b><br>${p.type}${p.opening_hours ? '<br>Hours: '+p.opening_hours : ''}`)
        .addTo(nearbyGroup);
    });
  } catch (e) { console.warn('Nearby:', e.message); }
}

// ── MAP EVENTS ────────────────────────────────────────────
map.on('mousemove', e => {
  const { lat, lng } = e.latlng;
  const ns = lat >= 0 ? 'N' : 'S', ew = lng >= 0 ? 'E' : 'W';
  document.getElementById('coord-pill').textContent = `${Math.abs(lat).toFixed(4)}°${ns}  ${Math.abs(lng).toFixed(4)}°${ew}`;
});
map.on('zoomend', () => {
  document.getElementById('zoom-pill').textContent = `Zoom: ${map.getZoom()}`;
});

// Right-click to set destination
map.on('contextmenu', async e => {
  const { lat, lng } = e.latlng;
  try {
    const r = await api.reverse(lat, lng);
    const name = r.display_name?.split(',').slice(0,2).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    document.getElementById('to-input').value = name;
    L.popup({ className: 'tv-popup' })
      .setLatLng([lat, lng])
      .setContent(`<div class="popup-call">📍 Destination set</div><div style="font-size:11px;color:var(--muted)">${name}</div>`)
      .openOn(map);
    switchTab('navigate');
  } catch (_) {}
});

// Click to get weather & info
map.on('click', async e => {
  const { lat, lng } = e.latlng;
  try {
    const [weather, place] = await Promise.all([
      api.weather(lat, lng),
      api.reverse(lat, lng).catch(() => null),
    ]);
    updateWeatherCard(weather, place);
    switchTab('info');
  } catch (_) {}
});

function updateWeatherCard(w, place) {
  const cur = w.current || {};
  const codes = { 0:'☀️ Clear', 1:'🌤 Mostly clear', 2:'⛅ Partly cloudy', 3:'☁️ Overcast', 45:'🌫 Foggy', 51:'🌦 Drizzle', 61:'🌧 Rain', 71:'❄️ Snow', 80:'🌦 Showers', 95:'⛈ Thunderstorm' };
  const desc = codes[cur.weather_code] || codes[Math.floor((cur.weather_code||0)/10)*10] || '🌍 —';
  const name = place?.address?.city || place?.address?.town || place?.display_name?.split(',')[0] || 'This location';

  document.getElementById('weather-card').innerHTML = `
    <div class="info-title">🌤 ${name}</div>
    <div style="font-size:28px;font-family:var(--fd);font-weight:800;margin-bottom:8px">${cur.temperature_2m ?? '—'}°C <span style="font-size:14px;font-weight:400;color:var(--muted)">${desc}</span></div>
    <div class="info-row"><span class="info-key">Feels like</span><span class="info-val">${cur.apparent_temperature ?? '—'}°C</span></div>
    <div class="info-row"><span class="info-key">Humidity</span><span class="info-val">${cur.relative_humidity_2m ?? '—'}%</span></div>
    <div class="info-row"><span class="info-key">Wind</span><span class="info-val">${cur.wind_speed_10m ?? '—'} km/h</span></div>
    <div class="info-row"><span class="info-key">Visibility</span><span class="info-val">${cur.visibility ? (cur.visibility/1000).toFixed(0)+'km' : '—'}</span></div>
    <button onclick="askWeatherAI(${cur.temperature_2m},${JSON.stringify(name)})" style="width:100%;margin-top:10px;padding:7px;background:rgba(0,212,255,.1);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--glow);cursor:pointer;font-family:var(--fb)">
      Ask AI about travel conditions →
    </button>
  `;
}

window.askWeatherAI = async (temp, place) => {
  switchTab('ai');
  await askAI(`The weather at ${place} is ${temp}°C. Should I travel there now? What should I pack and what travel warnings apply?`);
};

// Update location card on map move
map.on('moveend', async () => {
  const c = map.getCenter();
  try {
    const r = await api.reverse(c.lat, c.lng);
    const parts = r.display_name?.split(',') || [];
    document.getElementById('location-rows').innerHTML = `
      <div class="info-row"><span class="info-key">City</span><span class="info-val">${r.address?.city || r.address?.town || '—'}</span></div>
      <div class="info-row"><span class="info-key">Country</span><span class="info-val">${r.address?.country || parts[parts.length-1]?.trim() || '—'}</span></div>
      <div class="info-row"><span class="info-key">Timezone</span><span class="info-val">${Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
    `;
  } catch (_) {}
});

// ── FLIGHT PANEL ──────────────────────────────────────────
function refreshFlightPanel() {
  const center = map.getCenter();
  const nearby = flightLayer.getNearby(center.lat, center.lng, 10);
  const el = document.getElementById('flight-cards');
  document.getElementById('fc-count').textContent = `${flightLayer.count?.toLocaleString() || '…'} worldwide`;

  if (!nearby.length) {
    el.innerHTML = `<div style="font-size:11px;color:var(--muted);padding:8px 0">No flights detected nearby. Zoom out or wait for refresh.</div>`;
    return;
  }
  el.innerHTML = nearby.map(f => {
    const alt = f.altitude ? `${Math.round(f.altitude/0.3048/1000).toFixed(0)}k ft` : '—';
    const spd = f.velocity ? `${f.velocity} kts` : '—';
    const pct = f.altitude ? Math.min(100, f.altitude / 130) : 20;
    return `
      <div class="flight-card" onclick="onFlightClick(${JSON.stringify(f).replace(/"/g,'&quot;')})">
        <div class="fc-top">
          <div class="fc-call">✈ ${f.callsign || f.id}</div>
          <div class="fc-country">${f.country || '—'}</div>
        </div>
        <div class="fc-stats">
          <div class="fc-stat"><div class="fc-val">${alt}</div><div class="fc-key">Altitude</div></div>
          <div class="fc-stat"><div class="fc-val">${spd}</div><div class="fc-key">Speed</div></div>
          <div class="fc-stat"><div class="fc-val">${f.heading ? Math.round(f.heading)+'°' : '—'}</div><div class="fc-key">Heading</div></div>
        </div>
        <div class="altitude-bar"><div class="altitude-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');
}

function onFlightClick(f) {
  window.onFlightClick = onFlightClick;
  const alt = f.altitude ? `${Math.round(f.altitude / 0.3048).toLocaleString()} ft` : '—';
  const spd = f.velocity ? `${f.velocity} kts` : '—';
  L.popup({ className: 'tv-popup' })
    .setLatLng([f.lat, f.lon])
    .setContent(`
      <div class="popup-call">✈ ${f.callsign || f.id}</div>
      <div class="popup-grid">
        <div class="popup-stat"><div class="popup-val">${alt}</div><div class="popup-key">Altitude</div></div>
        <div class="popup-stat"><div class="popup-val">${spd}</div><div class="popup-key">Speed</div></div>
        <div class="popup-stat"><div class="popup-val">${f.heading ? Math.round(f.heading)+'°' : '—'}</div><div class="popup-key">Heading</div></div>
        <div class="popup-stat"><div class="popup-val">${f.country || '—'}</div><div class="popup-key">Origin</div></div>
      </div>
      <button class="popup-ask" onclick="askAboutFlight('${f.callsign||f.id}','${f.country||'unknown'}')">Ask AI about this flight →</button>
    `)
    .openOn(map);
}
window.onFlightClick = onFlightClick;

window.askAboutFlight = async (callsign, country) => {
  switchTab('ai');
  await askAI(`Tell me about flight ${callsign} from ${country}. What route is it likely on, what airline operates it, and what can you tell me about this aircraft?`);
};

// ── AI CHAT ───────────────────────────────────────────────
const aiHistory = [];
let aiBusy = false;

function aiAddMsg(type, text) {
  const el = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  const who = type === 'ai' ? 'TerraView AI' : type === 'sys' ? 'System' : 'You';
  div.innerHTML = `<div class="msg-who">${who}</div>${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

function aiAddTyping() {
  const el = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = 'typing'; div.id = 'ai-typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  el.appendChild(div); el.scrollTop = el.scrollHeight;
}
function aiRemoveTyping() { document.getElementById('ai-typing')?.remove(); }

async function askAI(msg, extraCtx = {}) {
  if (aiBusy) return;
  aiBusy = true;
  document.getElementById('ai-send').disabled = true;

  aiHistory.push({ role: 'user', content: msg });

  const c = map.getCenter();
  const context = {
    mapCenter: { lat: c.lat.toFixed(4), lon: c.lng.toFixed(4) },
    zoom: map.getZoom(),
    gpsActive: gpsManager.tracking,
    gpsPosition: gpsPos,
    navigating: navManager.active,
    nearbyFlights: flightLayer.getNearby(c.lat, c.lng, 5).map(f => ({
      callsign: f.callsign, country: f.country,
      altitude: f.altitude ? Math.round(f.altitude/0.3048)+'ft' : null,
    })),
    ...extraCtx,
  };

  aiAddTyping();
  try {
    const { reply } = await api.ai(msg, context, aiHistory.slice(-8));
    aiRemoveTyping();
    aiAddMsg('ai', reply);
    aiHistory.push({ role: 'assistant', content: reply });
  } catch (e) {
    aiRemoveTyping();
    aiAddMsg('sys', `⚠️ AI error: ${e.message}`);
  }
  aiBusy = false;
  document.getElementById('ai-send').disabled = false;
}

// Welcome
setTimeout(() => {
  aiAddMsg('ai', `Welcome to **TerraView** — your real-time world intelligence platform.\n\nI can see live flights, road conditions, weather, and your GPS position. Try:\n• Right-click the map to set a destination\n• Tap 📍 My Location for GPS navigation\n• Ask me anything about any place on Earth`);
}, 500);

// Send button
document.getElementById('ai-send').addEventListener('click', sendAI);
document.getElementById('ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAI(); }
});

function sendAI() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim();
  if (!msg || aiBusy) return;
  input.value = '';
  aiAddMsg('user', msg);
  switchTab('ai');
  askAI(msg);
}

// Quick prompts
document.querySelectorAll('.qp').forEach(el => {
  el.addEventListener('click', () => {
    aiAddMsg('user', el.dataset.q);
    switchTab('ai');
    askAI(el.dataset.q);
  });
});

// ── TOOLTIP STYLE ─────────────────────────────────────────
const s = document.createElement('style');
s.textContent = `.leaflet-tooltip.tv-tip{background:var(--card)!important;border:1px solid var(--border)!important;color:rgba(220,235,255,.9)!important;font-family:var(--fb)!important;font-size:11px!important;border-radius:7px!important;padding:4px 8px!important;box-shadow:none!important}.leaflet-tooltip.tv-tip::before{display:none!important}`;
document.head.appendChild(s);
