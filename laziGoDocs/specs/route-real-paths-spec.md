# LaziGo — Real Walking Paths on Route Map

## Problem

Route map draws straight lines between points (SVG `<line>`). Users see bird's-eye distance, not actual walking path. This is misleading — a 5-min walk can look like 2km straight line across a river when the actual path goes over a bridge.

## Goal

Replace straight lines with real walking paths that follow roads, sidewalks, and bridges. Same SVG overlay approach (raster-only tiles), but polylines instead of straight lines.

## Architecture

```
route.component.ts                     route-map.component.ts
       |                                       |
  buildRoute()                          renderRoute()
       |                                       |
  API returns points                    For each line segment:
  + transitions                           1. Call OSRM /route
       |                                  2. Get geometry (GeoJSON coords)
  pass to map                            3. Draw SVG polyline (not line)
```

## Routing API: OSRM (Open Source Routing Machine)

**Why OSRM:**
- Free, no API key, no cost
- Walking profile available
- Returns GeoJSON geometry with actual road coordinates
- Demo server available (rate limited but sufficient for our scale)

**Endpoint:**
```
GET https://router.project-osrm.org/route/v1/walking/{lng1},{lat1};{lng2},{lat2}?geometries=geojson&overview=full
```

**Response (relevant part):**
```json
{
  "routes": [{
    "geometry": {
      "type": "LineString",
      "coordinates": [[44.8015, 41.6934], [44.8020, 41.6930], ...]
    },
    "distance": 523.4,
    "duration": 412.1
  }]
}
```

**Rate limits (demo server):**
- No official limit documented, but ~1 req/sec is safe
- For 8 segments = 8 requests, sequential = ~2-3 seconds
- Can parallelize (Promise.all) = ~500ms total

**Self-hosted option (future):**
- Docker: `docker run -t -v /data:/data osrm/osrm-backend osrm-routed --algorithm mld /data/georgia-latest.osrm`
- Georgia PBF: ~20MB from Geofabrik
- Zero cost, zero latency, no rate limits
- Recommended when traffic grows

## Implementation Plan

### Step 1: Backend — add geometry to transitions (recommended)

Add OSRM call in `route.service.ts` when building transitions:

```typescript
// In route.service.ts, after computing transitions
for (const transition of transitions) {
  const from = points[transition.fromIndex];
  const to = points[transition.toIndex];
  const url = `https://router.project-osrm.org/route/v1/walking/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full`;
  const resp = await fetch(url);
  const data = await resp.json();
  transition.geometry = data.routes?.[0]?.geometry?.coordinates ?? [[from.lng, from.lat], [to.lng, to.lat]];
}
```

**Why backend, not frontend:**
- OSRM demo server has no CORS headers — browser fetch will fail
- Backend can cache paths (same two points = same path)
- Backend can switch to self-hosted OSRM transparently
- Frontend just renders whatever coordinates it gets

**Fallback:** If OSRM fails → straight line (current behavior). Never block route display on OSRM failure.

### Step 2: Extend MapLine interface

```typescript
// shared-models or route-map.component.ts
interface MapLine {
  from: [number, number];
  to: [number, number];
  type: 'walk' | 'taxi';
  durationMin: number;
  geometry?: [number, number][];  // NEW: full path coordinates from OSRM
}
```

### Step 3: Update SVG drawing

In `route-map.component.ts`, `drawSvgLines()`:

```typescript
for (const ln of lns) {
  if (ln.geometry && ln.geometry.length > 1) {
    // Draw polyline from OSRM geometry
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    const points = ln.geometry
      .map(coord => {
        const px = this.map!.project(coord as [number, number]);
        return `${px.x},${px.y}`;
      })
      .join(' ');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', ln.type === 'taxi' ? '#e67e22' : '#4a7c59');
    polyline.setAttribute('stroke-width', '4');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    if (ln.type === 'taxi') polyline.setAttribute('stroke-dasharray', '8,6');
    svg.appendChild(polyline);
  } else {
    // Fallback: straight line (current behavior)
    // ... existing code
  }
}
```

### Step 4: Backend caching (optional, recommended)

```sql
CREATE TABLE IF NOT EXISTS route_paths (
  from_lng DOUBLE PRECISION,
  from_lat DOUBLE PRECISION,
  to_lng DOUBLE PRECISION,
  to_lat DOUBLE PRECISION,
  geometry JSONB,
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (from_lng, from_lat, to_lng, to_lat)
);
```

Round coordinates to 4 decimal places (~11m precision) for cache key.
Cache hit = skip OSRM call. Tbilisi has ~3000 venues, max ~9M pairs, but in practice only popular routes get cached.

## Timing & Cost

| Item | Estimate |
|------|----------|
| Backend OSRM integration | ~2h |
| MapLine + SVG polyline | ~1h |
| Cache table + migration | ~1h |
| Testing + edge cases | ~1h |
| **Total** | **~5h** |
| **Cost** | **$0** (OSRM demo is free) |

## Edge Cases

| Case | Behavior |
|------|----------|
| OSRM returns no route (river/mountain between) | Fallback to straight line |
| OSRM demo server down | Fallback to straight line, log warning |
| OSRM timeout (>3s) | Fallback, don't block UI |
| Taxi transition | Still use OSRM (driving profile: `/route/v1/driving/...`) or straight dashed line |
| Very short segment (<50m) | OSRM still works, but straight line is fine too |
| geometry has 500+ points | Simplify with Douglas-Peucker (keep ~50 points) to reduce SVG size |

## Migration Path

1. **Phase 1**: Backend calls OSRM, returns geometry in transitions. Frontend draws polylines. Fallback to straight lines on error. No cache yet.
2. **Phase 2**: Add route_paths cache table. Cache paths on first computation.
3. **Phase 3**: Self-hosted OSRM Docker for zero-latency, zero-rate-limit.
4. **Phase 4 (optional)**: If we move to vector tiles — switch from SVG overlay to native GeoJSON layer (much cleaner).

## NOT doing

- Turn-by-turn navigation — we're not a navigation app
- Real-time traffic — not relevant for walking
- Multiple route options per segment — OSRM returns the best one, that's enough
- Elevation profile — nice-to-have but not now
