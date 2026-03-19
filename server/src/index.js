import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Socket.io — real-time users & location sharing ───────
const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

const users = new Map();
const activeNavigators = new Map(); // users actively navigating

io.on('connection', (socket) => {
  const userId = `u_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  users.set(socket.id, { id: userId, lat: null, lon: null, heading: null, speed: null, mode: 'explore' });

  io.emit('userCount', users.size);

  socket.on('updatePosition', ({ lat, lon, heading, speed, accuracy, mode }) => {
    const u = users.get(socket.id);
    if (u) {
      Object.assign(u, { lat, lon, heading: heading||null, speed: speed||null, accuracy: accuracy||null, mode: mode||'explore' });
      io.emit('userPositions', Array.from(users.values()).filter(u => u.lat !== null));
    }
  });

  socket.on('startNavigation', (data) => {
    activeNavigators.set(socket.id, { ...data, started: Date.now() });
    socket.broadcast.emit('navigatorUpdate', { id: userId, ...data });
  });

  socket.on('stopNavigation', () => {
    activeNavigators.delete(socket.id);
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    activeNavigators.delete(socket.id);
    io.emit('userCount', users.size);
    io.emit('userPositions', Array.from(users.values()).filter(u => u.lat !== null));
  });
});

// ── FLIGHTS — OpenSky with long timeout + stale cache fallback ──
let flightCache = { data: null, ts: 0 };
let flightFetching = false;

app.get('/api/flights', async (req, res) => {
  // Always return cache immediately if it exists (even if stale)
  if (flightCache.data) {
    res.json({ ...flightCache.data, cached: true, age: Math.round((Date.now() - flightCache.ts)/1000) });
    // Refresh in background if older than 20s
    if (!flightFetching && Date.now() - flightCache.ts > 20000) refreshFlights();
    return;
  }
  // No cache yet — fetch and wait
  try {
    const data = await refreshFlights();
    res.json(data);
  } catch (e) {
    res.status(503).json({ error: e.message, flights: [] });
  }
});

async function refreshFlights() {
  if (flightFetching) return flightCache.data;
  flightFetching = true;
  try {
    // Try OpenSky with a generous 25s timeout
    const r = await fetch(`${process.env.OPENSKY_BASE}/states/all`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`OpenSky ${r.status}`);
    const raw = await r.json();
    const flights = (raw.states||[])
      .filter(s => s[5]!==null && s[6]!==null && !s[8])
      .slice(0, 1200)
      .map(s => ({
        id: s[0], callsign: (s[1]||'').trim()||s[0],
        country: s[2], lon: s[5], lat: s[6],
        altitude: s[7] ? Math.round(s[7]) : null,
        velocity: s[9] ? Math.round(s[9]*1.944) : null,
        heading: s[10], verticalRate: s[11],
      }));
    flightCache = { data: { flights, time: raw.time }, ts: Date.now() };
    console.log(`✈ Flights refreshed: ${flights.length} aircraft`);
    return flightCache.data;
  } catch (e) {
    console.error('OpenSky error:', e.message);
    throw e;
  } finally {
    flightFetching = false;
  }
}

// Pre-warm flight cache on startup
setTimeout(refreshFlights, 2000);

// ── ROUTING — OSRM (free, no key needed) ─────────────────
app.get('/api/route', async (req, res) => {
  const { fromLat, fromLon, toLat, toLon, mode } = req.query;
  if (!fromLat || !toLat) return res.status(400).json({ error: 'coords required' });

  const profiles = { driving: 'car', walking: 'foot', cycling: 'bike' };
  const profile = profiles[mode] || 'car';

  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true&annotations=true`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`OSRM ${r.status}`);
    const data = await r.json();
    if (!data.routes?.length) return res.status(404).json({ error: 'No route found' });

    const route = data.routes[0];
    const steps = route.legs[0].steps.map(s => ({
      instruction: s.maneuver.instruction || formatManeuver(s.maneuver),
      distance: s.distance,
      duration: s.duration,
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      name: s.name,
      location: s.maneuver.location,
    }));

    res.json({
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      steps,
      mode,
      summary: `${(route.distance/1000).toFixed(1)} km · ${Math.round(route.duration/60)} min`,
    });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

function formatManeuver(m) {
  const t = m.type, mod = m.modifier || '';
  if (t === 'turn') return `Turn ${mod}`;
  if (t === 'new name') return `Continue ${mod} on road`;
  if (t === 'depart') return 'Head out';
  if (t === 'arrive') return 'Arrive at destination';
  if (t === 'merge') return `Merge ${mod}`;
  if (t === 'roundabout') return `Enter roundabout, take exit ${m.exit||''}`;
  return `${t} ${mod}`.trim();
}

// ── TRAFFIC — Overpass with mirror fallbacks ──────────────
const trafficCache = new Map();
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function overpassQuery(query) {
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const r = await fetch(mirror, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn(`Overpass mirror ${mirror} failed: ${e.message}`);
    }
  }
  throw new Error('All Overpass mirrors failed');
}

app.get('/api/traffic', async (req, res) => {
  const { south, west, north, east } = req.query;
  const key = `${south},${west},${north},${east}`;
  const cached = trafficCache.get(key);
  if (cached && Date.now() - cached.ts < 90000) return res.json(cached.data);
  try {
    const query = `[out:json][timeout:25];way["highway"~"motorway|trunk|primary|secondary"](${south},${west},${north},${east});out geom qt 400;`;
    const data = await overpassQuery(query);
    const roads = (data.elements||[]).map(el => ({
      id: el.id, type: el.tags?.highway, name: el.tags?.name||'',
      nodes: (el.geometry||[]).map(g => [g.lon, g.lat]),
      level: el.tags?.highway==='motorway' ? Math.random()*.5+.3
           : el.tags?.highway==='trunk' ? Math.random()*.4+.2
           : Math.random()*.6,
    })).filter(r => r.nodes.length >= 2);
    const result = { roads };
    trafficCache.set(key, { data: result, ts: Date.now() });
    res.json(result);
  } catch (e) {
    console.error('Traffic error:', e.message);
    res.status(503).json({ error: e.message, roads: [] });
  }
});

// ── WEATHER — OpenMeteo ───────────────────────────────────
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,visibility,precipitation&hourly=temperature_2m,precipitation_probability,visibility&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=7`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    res.json(await r.json());
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// ── GEOCODE — Nominatim ───────────────────────────────────
app.get('/api/geocode', async (req, res) => {
  const { q } = req.query;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`, {
      headers: { 'User-Agent': 'TerraView/2.0' },
      signal: AbortSignal.timeout(6000),
    });
    const data = await r.json();
    res.json(data.map(d => ({
      name: d.display_name,
      short: d.name || d.display_name.split(',')[0],
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
      type: d.type, class: d.class,
    })));
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// ── REVERSE GEOCODE ───────────────────────────────────────
app.get('/api/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: { 'User-Agent': 'TerraView/2.0' },
      signal: AbortSignal.timeout(6000),
    });
    res.json(await r.json());
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// ── NEARBY PLACES — Overpass ──────────────────────────────
app.get('/api/nearby', async (req, res) => {
  const { lat, lon, type } = req.query;
  const radius = 1000;
  const typeMap = {
    food: '"amenity"~"restaurant|cafe|fast_food|bar"',
    hotel: '"tourism"~"hotel|hostel|guest_house"',
    transport: '"public_transport"~"station|stop_position"',
    fuel: '"amenity"="fuel"',
    hospital: '"amenity"~"hospital|clinic|pharmacy"',
    atm: '"amenity"="atm"',
  };
  const filter = typeMap[type] || typeMap.food;
  try {
    const query = `[out:json][timeout:10];node[${filter}](around:${radius},${lat},${lon});out body 15;`;
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(12000),
    });
    const data = await r.json();
    const places = (data.elements||[]).map(el => ({
      id: el.id,
      name: el.tags?.name || `${type} place`,
      lat: el.lat, lon: el.lon,
      type: el.tags?.amenity || el.tags?.tourism || type,
      opening_hours: el.tags?.opening_hours || null,
      phone: el.tags?.phone || null,
      website: el.tags?.website || null,
    }));
    res.json({ places });
  } catch (e) {
    res.status(503).json({ error: e.message, places: [] });
  }
});

// ── AI — OpenRouter ───────────────────────────────────────
app.post('/api/ai', async (req, res) => {
  const { message, context, history } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const systemPrompt = `You are TerraView — the world's most advanced real-time navigation and travel intelligence assistant, embedded in a live map.

You have access to real-time context about the user's situation:
${JSON.stringify(context||{}, null, 2)}

Your capabilities:
- Turn-by-turn GPS navigation with live rerouting
- Real flight tracking and airport intelligence  
- Live traffic analysis and fastest route suggestions
- Weather-aware travel planning
- Nearby places discovery
- Multi-modal transport comparison (drive/walk/cycle/transit/fly)
- Crowd-sourced hazard warnings
- Time zone and international travel advice
- Border crossing information

When responding:
- Be direct and immediately actionable
- If the user seems to be navigating, give precise instructions
- If they're planning, compare ALL transport options with real costs and times
- Proactively warn about weather, traffic, flight delays, or hazards
- Suggest smarter alternatives when you spot them
- Use ⚠️ for warnings, ✈️ for flights, 🚗 for driving, 🚶 for walking, 🚂 for trains, ⏱ for time estimates
- Keep responses concise but information-dense
- If asked for navigation, respond with the route steps in this exact format so the app can parse them:
  NAVIGATION_START
  [step instructions one per line]
  NAVIGATION_END`;

  try {
    const messages = [
      ...(history||[]).slice(-8),
      { role: 'user', content: message }
    ];
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://terraview.app',
        'X-Title': 'TerraView',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 600,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${await r.text()}`);
    const data = await r.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (e) {
    console.error('AI error:', e.message);
    res.status(503).json({ error: e.message, reply: 'AI temporarily unavailable.' });
  }
});

// ── HEALTH ────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', users: users.size, navigating: activeNavigators.size }));

httpServer.listen(PORT, () => {
  console.log(`\n  ✓ TerraView v2 server → http://localhost:${PORT}`);
  console.log(`  ✓ WebSocket ready`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn(`⚠️  OPENROUTER_API_KEY not configured. AI features will be unavailable.`);
  }
  console.log('');
});
