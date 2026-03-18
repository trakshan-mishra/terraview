const B = '';

export const api = {
  flights: () => fetch(`${B}/api/flights`).then(r => r.json()),
  route: (p) => fetch(`${B}/api/route?${new URLSearchParams(p)}`).then(r => r.json()),
  traffic: (b) => fetch(`${B}/api/traffic?${new URLSearchParams(b)}`).then(r => r.json()),
  weather: (lat, lon) => fetch(`${B}/api/weather?lat=${lat}&lon=${lon}`).then(r => r.json()),
  geocode: (q) => fetch(`${B}/api/geocode?q=${encodeURIComponent(q)}`).then(r => r.json()),
  reverse: (lat, lon) => fetch(`${B}/api/reverse?lat=${lat}&lon=${lon}`).then(r => r.json()),
  nearby: (lat, lon, type) => fetch(`${B}/api/nearby?lat=${lat}&lon=${lon}&type=${type}`).then(r => r.json()),
  ai: (message, context, history) => fetch(`${B}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context, history }),
  }).then(r => r.json()),
};
