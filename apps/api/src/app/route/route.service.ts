import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GenerateRouteDto } from './dto/generate-route.dto';

const INTEREST_FACET_BRIDGE: Record<string, string[]> = {
  scenic:  ['scenic', 'instagram_worthy', 'outdoorsy'],
  food:    ['georgian', 'traditional', 'casual', 'cozy'],
  nature:  ['outdoorsy', 'scenic', 'quiet'],
  culture: ['cultural', 'exploring', 'traditional'],
  spa:     ['traditional', 'quiet'],
  coffee:  ['work_friendly', 'casual', 'cozy'],
};

const WALK_SPEED_M_PER_MIN = 80;
const STREET_CURVE = 1.3;
const MAX_WALK_MIN = 15;
const MAX_WALK_M = MAX_WALK_MIN * WALK_SPEED_M_PER_MIN / STREET_CURVE;

interface RouteCandidate {
  id: string;
  name: string;
  name_en?: string;
  category: string;
  lat: number;
  lng: number;
  hook?: string;
  walk_tier: string;
  route_moment: string;
  best_time: string;
  outdoor: string;
  typical_duration_min?: number;
  opening_hours?: Record<string, unknown>;
  google_rating?: number;
  photos?: string[];
}

export interface RoutePoint {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  hook?: string;
  role: string;
  durationMin: number;
  arriveAt: string; // HH:mm
  photoUrl?: string;
}

export interface RouteTransition {
  type: 'walk' | 'taxi';
  distanceM: number;
  durationMin: number;
  careLine?: string;
  geometry?: [number, number][]; // [lng, lat][] from OSRM
}

export interface CareLine {
  rule: string;
  text: string;
  position: 'header' | 'transition' | 'point' | 'footer';
}

export interface RouteResponse {
  points: RoutePoint[];
  transitions: RouteTransition[];
  careLines: CareLine[];
  totalKm: number;
  totalMinutes: number;
  taxiLinks: number;
  header: string;
}

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(private readonly ds: DataSource) {}

  async generate(dto: GenerateRouteDto): Promise<RouteResponse & { curatedCode?: string; allSeen?: boolean }> {
    const duration = dto.duration ?? '2-3h';
    const pace = dto.pace ?? 'relaxed';
    const moods = dto.moods ?? ['scenic', 'food'];
    const companions = dto.companions ?? [];
    const locale = dto.locale ?? 'ru';
    const deviceId = dto.deviceId ?? '';

    // Try curated route first
    const curated = await this.findCuratedRoute(moods, duration, companions, deviceId);
    if (curated) {
      return this.buildFromCurated(curated, pace, locale);
    }

    // Check if all seen
    const allSeenCheck = await this.areAllCuratedSeen(moods, duration, companions, deviceId);
    if (allSeenCheck) {
      // Fall through to dynamic generation, but flag it
    }

    const targetMinutes = duration === '1h' ? 60 : duration === '2-3h' ? 150 : duration === 'half-day' ? 300 : 480;
    const targetPoints = duration === '1h' ? 3 : duration === '2-3h' ? 4 : duration === 'half-day' ? 6 : 8;
    const radiusM = duration === '1h' ? 2000 : duration === '2-3h' ? 3000 : duration === 'half-day' ? 5000 : 8000;

    // 1. Fetch candidates
    const candidates = await this.fetchCandidates(dto.lat, dto.lng, radiusM, moods);
    this.logger.log(`Route: ${candidates.length} candidates in ${radiusM}m radius`);

    if (candidates.length < 2) {
      return this.emptyFallback(dto, locale);
    }

    // 2. Fetch areas for district spreading
    const areas = await this.ds.query('SELECT id, bbox FROM areas WHERE bbox IS NOT NULL');

    // 3. Build chain with district spreading
    const chain = this.buildChain(candidates, dto.lat, dto.lng, targetPoints, targetMinutes, pace, areas, duration);

    // 3. Compute transitions (includes OSRM path fetch)
    const transitions = await this.computeTransitions(chain);

    // 4. Assign times
    const now = new Date();
    const startHour = now.getUTCHours() + 4; // Tbilisi
    const startMin = now.getMinutes();
    this.assignTimes(chain, transitions, startHour, startMin);

    // 5. Compute totals
    const totalWalkM = transitions.reduce((s, t) => s + (t.type === 'walk' ? t.distanceM : 0), 0);
    const totalMinutes = chain.reduce((s, p) => s + p.durationMin, 0) +
      transitions.reduce((s, t) => s + t.durationMin, 0);
    const taxiLinks = transitions.filter(t => t.type === 'taxi').length;

    // 6. Care rules
    const careLines = this.computeCareLines(chain, transitions, totalWalkM, totalMinutes);

    // 7. Header
    const header = this.buildHeader(chain, totalWalkM, totalMinutes, careLines, locale);

    return {
      points: chain,
      transitions,
      careLines,
      totalKm: Math.round(totalWalkM / 100) / 10,
      totalMinutes,
      taxiLinks,
      header,
      allSeen: allSeenCheck || undefined,
    };
  }

  // --- Curated route logic ---

  private durationToTiers(duration: string): string[] {
    switch (duration) {
      case '1h': return ['easy'];
      case '2-3h': return ['easy', 'medium'];
      case 'half-day': return ['medium', 'full_day'];
      case 'full-day': return ['full_day'];
      default: return ['easy', 'medium'];
    }
  }

  private async findCuratedRoute(moods: string[], duration: string, companions: string[], deviceId: string): Promise<any | null> {
    // Nightlife mood → only night tier
    const tiers = moods.includes('nightlife') ? ['night'] : this.durationToTiers(duration);
    const tiersPlaceholder = tiers.map((_, i) => `$${i + 1}`).join(',');

    // Build query: match any mood, match tier, exclude seen
    const rows = await this.ds.query(`
      SELECT cr.* FROM curated_routes cr
      WHERE cr.tier IN (${tiersPlaceholder})
        AND cr.moods && $${tiers.length + 1}::text[]
        AND (
          $${tiers.length + 2}::text[] = '{}'::text[]
          OR cr.companions && $${tiers.length + 2}::text[]
          OR cr.companions = '{}'::text[]
        )
        AND NOT EXISTS (
          SELECT 1 FROM seen_routes sr
          WHERE sr.route_id = cr.id AND sr.device_id = $${tiers.length + 3}
        )
      ORDER BY
        (SELECT COUNT(*) FROM unnest(cr.moods) m WHERE m = ANY($${tiers.length + 1}::text[])) DESC,
        random()
      LIMIT 1
    `, [...tiers, moods, companions, deviceId]);

    return rows[0] ?? null;
  }

  private async areAllCuratedSeen(moods: string[], duration: string, companions: string[], deviceId: string): Promise<boolean> {
    if (!deviceId) return false;
    const tiers = moods.includes('nightlife') ? ['night'] : this.durationToTiers(duration);
    const tiersPlaceholder = tiers.map((_, i) => `$${i + 1}`).join(',');

    const [{ total, seen }] = await this.ds.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM seen_routes sr WHERE sr.route_id = cr.id AND sr.device_id = $${tiers.length + 3}
        )) as seen
      FROM curated_routes cr
      WHERE cr.tier IN (${tiersPlaceholder})
        AND cr.moods && $${tiers.length + 1}::text[]
        AND (
          $${tiers.length + 2}::text[] = '{}'::text[]
          OR cr.companions && $${tiers.length + 2}::text[]
          OR cr.companions = '{}'::text[]
        )
    `, [...tiers, moods, companions, deviceId]);

    return Number(total) > 0 && Number(seen) >= Number(total);
  }

  private async buildFromCurated(curated: any, pace: string, locale: string): Promise<RouteResponse & { curatedCode?: string }> {
    const isRu = locale === 'ru';
    const points: RoutePoint[] = (curated.points as any[]).map((p: any, i: number) => ({
      id: `curated-${curated.code}-${i}`,
      name: isRu ? (p.name ?? p.name_en) : (p.name_en ?? p.name),
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      hook: p.note,
      role: i === 0 ? 'anchor' : p.category === 'restaurant' || p.category === 'bar' ? 'food_break' : 'passage',
      durationMin: RouteService.ROUTE_DURATION[p.category] ?? p.duration_min ?? 20,
      arriveAt: '',
      photoUrl: undefined,
    }));

    const transitions = await this.computeTransitions(points);

    const now = new Date();
    this.assignTimes(points, transitions, (now.getUTCHours() + 4) % 24, now.getMinutes());

    const totalWalkM = transitions.reduce((s, t) => s + (t.type === 'walk' ? t.distanceM : 0), 0);
    const totalMinutes = points.reduce((s, p) => s + p.durationMin, 0) +
      transitions.reduce((s, t) => s + t.durationMin, 0);
    const taxiLinks = transitions.filter(t => t.type === 'taxi').length;
    const careLines = this.computeCareLines(points, transitions, totalWalkM, totalMinutes);
    const guideNote = isRu ? curated.guide_notes : curated.guide_notes_en;
    const header = (isRu ? curated.description : curated.description_en) +
      (guideNote ? `\n💡 ${guideNote}` : '');

    return {
      points, transitions, careLines,
      totalKm: Math.round(totalWalkM / 100) / 10,
      totalMinutes, taxiLinks, header,
      curatedCode: curated.code,
    };
  }

  async markSeen(deviceId: string, routeCode: string): Promise<void> {
    await this.ds.query(`
      INSERT INTO seen_routes (device_id, route_id)
      SELECT $1, id FROM curated_routes WHERE code = $2
      ON CONFLICT DO NOTHING
    `, [deviceId, routeCode]);
  }

  async getInterestingPlaces(excludeIds: string[], lat: number, lng: number, locale = 'ru'): Promise<any[]> {
    const excludePlaceholders = excludeIds.length > 0
      ? `AND p.id NOT IN (${excludeIds.map((_, i) => `$${i + 1}`).join(',')})`
      : '';

    const rows = await this.ds.query(`
      SELECT p.id, v.name, v.name_en, p.category,
        v.lat, v.lng, p.hook, p.walk_tier, p.route_moment,
        p.google_rating, p.photos
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE p.status = 'active'
        AND p.walk_tier IN ('must_see', 'worth_detour')
        ${excludePlaceholders}
      ORDER BY
        CASE p.walk_tier WHEN 'must_see' THEN 1 ELSE 2 END,
        p.google_rating DESC NULLS LAST
      LIMIT 30
    `, excludeIds);

    return rows.map((r: any) => ({
      id: r.id,
      name: this.resolveTitle(r.name, r.name_en, locale),
      category: r.category,
      lat: Number(r.lat),
      lng: Number(r.lng),
      hook: r.hook,
      walkTier: r.walk_tier,
      rating: r.google_rating ? Number(r.google_rating) : undefined,
      photoUrl: r.photos?.[0],
      distanceM: Math.round(this.haversine(lat, lng, Number(r.lat), Number(r.lng))),
    }));
  }

  // --- Dynamic route logic ---

  private async fetchCandidates(lat: number, lng: number, radiusM: number, moods: string[]): Promise<RouteCandidate[]> {
    // Map moods to facets
    const facets = new Set<string>();
    for (const mood of moods) {
      for (const f of (INTEREST_FACET_BRIDGE[mood] ?? [])) facets.add(f);
    }

    const radiusDeg = radiusM / 111000;

    const rows = await this.ds.query(`
      SELECT p.id, v.name, v.name_en, p.category,
        v.lat, v.lng, p.hook, p.walk_tier, p.route_moment, p.best_time, p.outdoor,
        p.typical_duration_min, p.opening_hours, p.google_rating, p.photos,
        p.facet_atmosphere, p.facet_occasion
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE p.status = 'active'
        AND p.walk_tier IS NOT NULL
        AND p.walk_tier != 'skip'
        AND v.lat BETWEEN $1::float - $3::float AND $1::float + $3::float
        AND v.lng BETWEEN $2::float - $4::float AND $2::float + $4::float
      ORDER BY
        CASE p.walk_tier
          WHEN 'must_see' THEN 1
          WHEN 'worth_detour' THEN 2
          WHEN 'nice_nearby' THEN 3
        END,
        p.google_rating DESC NULLS LAST
      LIMIT 500
    `, [lat, lng, radiusDeg, radiusDeg * 1.3]);

    // Soft filter: prefer places with matching mood facets
    // must_see always pass, others need at least one facet match
    if (facets.size > 0) {
      const facetArr = [...facets];
      const matched = rows.filter((r: any) => {
        if (r.walk_tier === 'must_see') return true;
        const atm: string[] = r.facet_atmosphere ?? [];
        const occ: string[] = r.facet_occasion ?? [];
        return facetArr.some(f => atm.includes(f) || occ.includes(f));
      });
      // If too few matched, include all (better than empty route)
      return matched.length >= 10 ? matched : rows;
    }

    return rows;
  }

  // Min distance between consecutive route points (meters)
  private static readonly MIN_POINT_DISTANCE = 300;

  private getAreaForCoords(lat: number, lng: number, areas: any[]): string | null {
    for (const a of areas) {
      if (!a.bbox) continue;
      if (lat >= a.bbox.minLat && lat <= a.bbox.maxLat &&
          lng >= a.bbox.minLng && lng <= a.bbox.maxLng) {
        return a.id;
      }
    }
    return null;
  }

  private buildChain(
    candidates: RouteCandidate[],
    startLat: number, startLng: number,
    targetPoints: number, targetMinutes: number,
    pace: string,
    areas: any[] = [],
    duration?: string,
  ): RoutePoint[] {
    const used = new Set<string>();
    const chain: RoutePoint[] = [];
    const usedAreas = new Set<string>();

    // District spreading config based on duration
    const targetDistricts = duration === '1h' ? 1 : duration === '2-3h' ? 2 : 3;

    // Role sequence: anchor → photo_spot → food_break → rest_stop → anchor...
    const roleSequence = ['anchor', 'photo_spot', 'food_break', 'rest_stop'];
    let roleIdx = 0;

    let curLat = startLat;
    let curLng = startLng;

    // Pick anchors first (must_see)
    const anchors = candidates.filter(c => c.walk_tier === 'must_see' && c.route_moment === 'anchor');
    if (anchors.length > 0) {
      const nearest = this.nearest(anchors, curLat, curLng);
      if (nearest) {
        chain.push(this.toPoint(nearest, 'anchor', pace));
        used.add(nearest.id);
        curLat = nearest.lat;
        curLng = nearest.lng;
        roleIdx = 1;
        const area = this.getAreaForCoords(nearest.lat, nearest.lng, areas);
        if (area) usedAreas.add(area);
      }
    }

    // Fill remaining slots with district spreading + min distance
    let totalMin = chain.reduce((s, p) => s + p.durationMin, 0);
    const needFood = targetMinutes >= 180;
    let hasFoodBreak = false;

    while (chain.length < targetPoints && totalMin < targetMinutes * 0.9) {
      const desiredRole = roleSequence[roleIdx % roleSequence.length];
      const actualRole = (needFood && !hasFoodBreak && chain.length >= Math.floor(targetPoints / 2))
        ? 'food_break' : desiredRole;

      // Filter candidates: unused + min distance from last point
      const eligible = candidates.filter(c => {
        if (used.has(c.id)) return false;
        const dist = this.haversine(curLat, curLng, c.lat, c.lng);
        if (dist < RouteService.MIN_POINT_DISTANCE) return false;
        return true;
      });

      // If we have enough districts, prefer candidates from already-used districts (coherent route)
      // If we need more districts, prefer candidates from NEW districts
      let preferred = eligible;
      if (usedAreas.size < targetDistricts && areas.length > 0) {
        // Need more districts — prefer new areas
        const fromNewArea = eligible.filter(c => {
          const area = this.getAreaForCoords(c.lat, c.lng, areas);
          return area && !usedAreas.has(area);
        });
        if (fromNewArea.length > 0) preferred = fromNewArea;
      }

      const candidate = this.findByRoleFrom(preferred, curLat, curLng, actualRole)
        ?? this.findByRoleFrom(eligible, curLat, curLng, actualRole);

      if (!candidate) {
        const fallback = this.nearest(eligible, curLat, curLng);
        if (!fallback) break;
        chain.push(this.toPoint(fallback, fallback.route_moment || 'passage', pace));
        used.add(fallback.id);
        curLat = fallback.lat;
        curLng = fallback.lng;
        const area = this.getAreaForCoords(fallback.lat, fallback.lng, areas);
        if (area) usedAreas.add(area);
      } else {
        chain.push(this.toPoint(candidate, actualRole, pace));
        used.add(candidate.id);
        curLat = candidate.lat;
        curLng = candidate.lng;
        if (actualRole === 'food_break') hasFoodBreak = true;
        const area = this.getAreaForCoords(candidate.lat, candidate.lng, areas);
        if (area) usedAreas.add(area);
      }

      totalMin = chain.reduce((s, p) => s + p.durationMin, 0);
      roleIdx++;
    }

    return chain;
  }

  private findByRoleFrom(
    pool: RouteCandidate[], lat: number, lng: number, role: string,
  ): RouteCandidate | null {
    const categoryMap: Record<string, string[]> = {
      food_break: ['restaurant', 'cafe', 'bakery'],
      rest_stop: ['cafe', 'park', 'garden'],
      photo_spot: ['viewpoint', 'park', 'attraction', 'garden'],
      anchor: ['viewpoint', 'museum', 'gallery', 'theater', 'bath'],
    };
    const validCategories = categoryMap[role] ?? [];
    const matched = pool.filter(c =>
      validCategories.includes(c.category) || c.route_moment === role
    );
    return matched.length > 0 ? this.nearest(matched, lat, lng) : null;
  }



  private nearest(candidates: RouteCandidate[], lat: number, lng: number): RouteCandidate | null {
    if (candidates.length === 0) return null;
    let best = candidates[0];
    let bestDist = this.haversine(lat, lng, best.lat, best.lng);
    for (let i = 1; i < candidates.length; i++) {
      const d = this.haversine(lat, lng, candidates[i].lat, candidates[i].lng);
      if (d < bestDist) { best = candidates[i]; bestDist = d; }
    }
    return best;
  }

  // Route-context duration: how long you actually spend at a place on a walking route
  private static readonly ROUTE_DURATION: Record<string, number> = {
    // "Сел" — main time spent here
    restaurant: 50, bar: 45,
    // "Зашёл" — go inside, look around
    museum: 45, gallery: 35, bath: 60, spa: 60, cafe: 25, club: 40,
    // "Глянул" — look, photo, move on
    viewpoint: 15, park: 25, church: 15, theater: 15, cinema: 15,
    entertainment: 20, mall: 20, gym: 15,
    // "Прошёл" — quick stop
    bakery: 10,
  };

  private toPoint(c: RouteCandidate, role: string, pace: string): RoutePoint {
    const routeDuration = RouteService.ROUTE_DURATION[c.category];
    const raw = routeDuration ?? (role === 'food_break' ? 45 : role === 'anchor' ? 30 : 20);
    const baseDuration = Math.min(raw, 60);
    const durationMin = pace === 'relaxed' ? Math.round(baseDuration * 1.2) : baseDuration;
    return {
      id: c.id,
      name: c.name_en || c.name,
      category: c.category,
      lat: c.lat,
      lng: c.lng,
      hook: c.hook ?? undefined,
      role,
      durationMin,
      arriveAt: '',
      photoUrl: c.photos?.[0] ?? undefined,
    };
  }

  private async computeTransitions(chain: RoutePoint[]): Promise<RouteTransition[]> {
    const transitions: RouteTransition[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const distM = this.haversine(chain[i].lat, chain[i].lng, chain[i + 1].lat, chain[i + 1].lng);
      const walkMin = Math.round((distM / WALK_SPEED_M_PER_MIN) * STREET_CURVE);

      if (distM > MAX_WALK_M) {
        const taxiMin = Math.max(5, Math.round(distM / 500));
        transitions.push({ type: 'taxi', distanceM: Math.round(distM), durationMin: taxiMin });
      } else {
        transitions.push({ type: 'walk', distanceM: Math.round(distM), durationMin: walkMin });
      }
    }

    // Fetch real walking paths from OSRM (parallel, with fallback)
    await Promise.all(transitions.map(async (t, i) => {
      try {
        const from = chain[i];
        const to = chain[i + 1];
        const profile = t.type === 'taxi' ? 'driving' : 'walking';
        const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          const data = await resp.json();
          const coords = data?.routes?.[0]?.geometry?.coordinates;
          if (coords?.length > 1) {
            t.geometry = coords;
          }
        }
      } catch {
        // Fallback: no geometry = straight line on frontend
      }
    }));

    return transitions;
  }

  private assignTimes(chain: RoutePoint[], transitions: RouteTransition[], startH: number, startM: number): void {
    let minutes = startH * 60 + startM;
    for (let i = 0; i < chain.length; i++) {
      chain[i].arriveAt = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      minutes += chain[i].durationMin;
      if (i < transitions.length) minutes += transitions[i].durationMin;
    }
  }

  private computeCareLines(
    chain: RoutePoint[], transitions: RouteTransition[],
    totalWalkM: number, totalMinutes: number,
  ): CareLine[] {
    const care: CareLine[] = [];
    const totalKm = totalWalkM / 1000;

    // C1: long walk
    if (totalKm >= 4 || totalMinutes >= 180) {
      care.push({ rule: 'C1', text: 'Прогулка неблизкая — возьмите воду и удобную обувь', position: 'header' });
    }

    // C2/C2b: outdoor + season
    const outdoorRatio = chain.filter(p => p.category === 'park' || p.category === 'viewpoint' || p.category === 'garden').length / chain.length;
    const hour = new Date().getUTCHours() + 4;
    const month = new Date().getMonth();
    if (outdoorRatio >= 0.5) {
      if (month >= 4 && month <= 8 && hour >= 10 && hour < 17) {
        care.push({ rule: 'C2', text: 'Днём будет солнечно — проверьте погоду, часть пути на воздухе', position: 'header' });
      } else if (month >= 10 || month <= 2 || hour >= 19) {
        care.push({ rule: 'C2b', text: 'Одевайтесь теплее — половина маршрута на воздухе', position: 'header' });
      }
    }

    // C3: taxi links — honest, no fake price/ETA
    for (let i = 0; i < transitions.length; i++) {
      if (transitions[i].type === 'taxi') {
        transitions[i].careLine = undefined; // handled by frontend [Taxi][Transit] buttons
        care.push({ rule: 'C3', text: 'Далеко пешком — тут удобнее доехать', position: 'transition' });
      }
    }

    // C4: long walk segments
    for (const t of transitions) {
      if (t.type === 'walk' && t.durationMin > 15) {
        t.careLine = `Этот отрезок неблизкий, минут ${t.durationMin} — не спешите`;
        care.push({ rule: 'C4', text: t.careLine, position: 'transition' });
      }
    }

    // C5: auto food_break
    for (const p of chain) {
      if (p.role === 'food_break') {
        care.push({ rule: 'C5', text: 'К этому времени проголодаетесь — здесь удобно перекусить', position: 'point' });
      }
    }

    // C8: late finish
    const lastPoint = chain[chain.length - 1];
    if (lastPoint) {
      const [h] = lastPoint.arriveAt.split(':').map(Number);
      const finishH = h + Math.ceil(lastPoint.durationMin / 60);
      if (finishH >= 21) {
        care.push({ rule: 'C8', text: 'Заканчиваете поздно — обратно удобнее на такси', position: 'footer' });
      }
    }

    return care;
  }

  private buildHeader(
    chain: RoutePoint[], totalWalkM: number, totalMinutes: number,
    careLines: CareLine[], locale: string,
  ): string {
    const km = (totalWalkM / 1000).toFixed(1);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours} ч ${mins > 0 ? mins + ' мин' : ''}` : `${mins} мин`;

    let header = `Прогулка на ~${timeStr}, ${chain.length} ${chain.length <= 4 ? 'места' : 'мест'}, ${km} км пешком`;

    const headerCare = careLines.filter(c => c.position === 'header').slice(0, 2);
    if (headerCare.length > 0) {
      header += '. ' + headerCare.map(c => c.text).join('. ');
    }

    return header;
  }

  private emptyFallback(dto: GenerateRouteDto, locale: string): RouteResponse {
    return {
      points: [],
      transitions: [],
      careLines: [{ rule: 'fallback', text: 'Под такое сочетание сейчас мало открытого. Попробуйте расширить критерии', position: 'header' }],
      totalKm: 0,
      totalMinutes: 0,
      taxiLinks: 0,
      header: 'Не получилось собрать маршрут — попробуйте другое настроение',
    };
  }

  /**
   * Get top places for manual route building.
   * must_see + worth_detour, optionally filtered by category type.
   */
  /**
   * Link user-selected points into a route (manual mode).
   * Fetches point data, orders by greedy nearest-neighbor, computes transitions + care.
   */
  async linkPoints(dto: { pointIds: string[]; startLat: number; startLng: number; locale?: string }): Promise<RouteResponse> {
    if (!dto.pointIds?.length) {
      return this.emptyFallback({ lat: dto.startLat, lng: dto.startLng } as any, dto.locale ?? 'ru');
    }

    const placeholders = dto.pointIds.map((_, i) => `$${i + 1}`).join(',');
    const rows = await this.ds.query(`
      SELECT p.id, v.name, v.name_en, p.category,
        v.lat, v.lng, p.hook, p.walk_tier, p.route_moment, p.best_time, p.outdoor,
        p.typical_duration_min, p.photos
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE p.id IN (${placeholders})
    `, dto.pointIds);

    if (rows.length === 0) {
      return this.emptyFallback({ lat: dto.startLat, lng: dto.startLng } as any, dto.locale ?? 'ru');
    }

    // Order by greedy nearest-neighbor from start
    const ordered: RouteCandidate[] = [];
    const remaining = [...rows] as RouteCandidate[];
    let curLat = dto.startLat;
    let curLng = dto.startLng;

    while (remaining.length > 0) {
      const nearest = this.nearest(remaining, curLat, curLng)!;
      ordered.push(nearest);
      remaining.splice(remaining.indexOf(nearest), 1);
      curLat = nearest.lat;
      curLng = nearest.lng;
    }

    // Convert to RoutePoints
    const chain: RoutePoint[] = ordered.map((c) => this.toPoint(c, c.route_moment || 'anchor', 'relaxed'));

    // Compute transitions (includes OSRM path fetch)
    const transitions = await this.computeTransitions(chain);

    // Assign times
    const now = new Date();
    this.assignTimes(chain, transitions, (now.getUTCHours() + 4) % 24, now.getMinutes());

    // Totals
    const totalWalkM = transitions.reduce((s, t) => s + (t.type === 'walk' ? t.distanceM : 0), 0);
    const totalMinutes = chain.reduce((s, p) => s + p.durationMin, 0) +
      transitions.reduce((s, t) => s + t.durationMin, 0);
    const taxiLinks = transitions.filter(t => t.type === 'taxi').length;

    // Care
    const careLines = this.computeCareLines(chain, transitions, totalWalkM, totalMinutes);

    // Header (manual tone)
    const km = (totalWalkM / 1000).toFixed(1);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours} ч ${mins > 0 ? mins + ' мин' : ''}` : `${mins} мин`;
    let header = `Ваш маршрут: ~${timeStr}, ${chain.length} ${chain.length <= 4 ? 'места' : 'мест'}, ${km} км пешком`;
    const headerCare = careLines.filter(c => c.position === 'header').slice(0, 2);
    if (headerCare.length > 0) header += '. ' + headerCare.map(c => c.text).join('. ');

    return { points: chain, transitions, careLines, totalKm: Math.round(totalWalkM / 100) / 10, totalMinutes, taxiLinks, header };
  }

  async getAreas(locale = 'ru'): Promise<any[]> {
    // Only select columns that exist in the table
    const rows = await this.ds.query(`
      SELECT id, name, name_en, name_ru, description_en, description_ru,
        vibe, best_for, when_best, when_best_ru, what_to_expect, what_to_expect_ru,
        honest_warning, honest_warning_ru,
        center_lat, center_lng, bbox, walk_tier
      FROM areas ORDER BY walk_tier, name_en
    `);
    const isRu = locale === 'ru';
    return rows.map((r: any) => ({
      id: r.id,
      name: isRu ? (r.name_ru ?? r.name_en ?? r.name) : (r.name_en ?? r.name),
      description: isRu ? (r.description_ru ?? r.description_en) : r.description_en,
      fullDescription: isRu ? (r.description_ru ?? r.description_en) : r.description_en,
      vibe: r.vibe,
      bestFor: r.best_for,
      whenBest: isRu ? (r.when_best_ru ?? r.when_best) : r.when_best,
      whatToExpect: isRu ? (r.what_to_expect_ru ?? r.what_to_expect) : r.what_to_expect,
      honestWarning: isRu ? (r.honest_warning_ru ?? r.honest_warning) : r.honest_warning,
      centerLat: Number(r.center_lat),
      centerLng: Number(r.center_lng),
      bbox: r.bbox,
      walkTier: r.walk_tier,
    }));
  }

  async getTopPlaces(lat: number, lng: number, type?: string, locale = 'ru'): Promise<any[]> {
    const typeFilter = type ? this.mapTypeToCategories(type) : null;
    const typeWhere = typeFilter ? `AND p.category IN (${typeFilter.map((t: string) => `'${t}'`).join(',')})` : '';

    const rows = await this.ds.query(`
      SELECT p.id, v.name, v.name_en, p.category,
        v.lat, v.lng, p.hook, p.walk_tier, p.route_moment, p.best_time, p.outdoor,
        p.typical_duration_min, p.google_rating, p.photos
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE p.status = 'active'
        AND p.walk_tier IN ('must_see', 'worth_detour')
        ${typeWhere}
      ORDER BY
        CASE p.walk_tier WHEN 'must_see' THEN 1 ELSE 2 END,
        p.google_rating DESC NULLS LAST
      LIMIT 60
    `);

    return rows.map((r: any) => ({
      id: r.id,
      name: this.resolveTitle(r.name, r.name_en, locale),
      category: r.category,
      lat: Number(r.lat),
      lng: Number(r.lng),
      hook: r.hook,
      walkTier: r.walk_tier,
      routeMoment: r.route_moment,
      rating: r.google_rating ? Number(r.google_rating) : undefined,
      photoUrl: r.photos?.[0],
      durationMin: RouteService.ROUTE_DURATION[r.category] ?? Math.min(Number(r.typical_duration_min ?? 30), 60),
    }));
  }

  private mapTypeToCategories(type: string): string[] | null {
    const map: Record<string, string[]> = {
      scenic: ['viewpoint', 'park', 'garden', 'attraction'],
      food: ['restaurant', 'cafe', 'bakery'],
      culture: ['museum', 'gallery', 'theater', 'library'],
      spa: ['bath', 'swimming'],
      coffee: ['cafe'],
    };
    return map[type] ?? null;
  }

  /**
   * Get 2-3 alternatives for a specific point in the route.
   * Same role, nearby, not already in route. Returns with transition cost preview.
   */
  async getAlternatives(dto: {
    lat: number; lng: number; role: string;
    excludeIds: string[]; prevLat?: number; prevLng?: number; nextLat?: number; nextLng?: number;
    moods?: string[];
  }): Promise<{ id: string; name: string; category: string; lat: number; lng: number;
    hook?: string; walkTier: string; transitionFromPrev?: { type: string; durationMin: number };
    transitionToNext?: { type: string; durationMin: number }; photoUrl?: string }[]> {

    const candidates = await this.fetchCandidates(dto.lat, dto.lng, 3000, dto.moods ?? []);
    const excludeSet = new Set(dto.excludeIds);

    const categoryMap: Record<string, string[]> = {
      food_break: ['restaurant', 'cafe', 'bakery'],
      rest_stop: ['cafe', 'park', 'garden'],
      photo_spot: ['viewpoint', 'park', 'attraction', 'garden'],
      anchor: ['viewpoint', 'museum', 'gallery', 'theater', 'bath'],
    };

    const validCategories = categoryMap[dto.role] ?? [];
    const filtered = candidates.filter(c => {
      if (excludeSet.has(c.id)) return false;
      return validCategories.includes(c.category) || c.route_moment === dto.role;
    });

    // Sort by distance from current point, take top 3
    const sorted = filtered
      .map(c => ({ ...c, dist: this.haversine(dto.lat, dto.lng, c.lat, c.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    return sorted.map(c => {
      const result: any = {
        id: c.id, name: c.name_en || c.name, category: c.category,
        lat: c.lat, lng: c.lng, hook: c.hook, walkTier: c.walk_tier,
        photoUrl: c.photos?.[0],
      };
      // Preview transition cost from previous point
      if (dto.prevLat != null && dto.prevLng != null) {
        const distM = this.haversine(dto.prevLat, dto.prevLng, c.lat, c.lng);
        const walkMin = Math.round((distM / WALK_SPEED_M_PER_MIN) * STREET_CURVE);
        result.transitionFromPrev = distM > MAX_WALK_M
          ? { type: 'taxi', durationMin: Math.max(5, Math.round(distM / 500)) }
          : { type: 'walk', durationMin: walkMin };
      }
      // Preview transition cost to next point
      if (dto.nextLat != null && dto.nextLng != null) {
        const distM = this.haversine(c.lat, c.lng, dto.nextLat, dto.nextLng);
        const walkMin = Math.round((distM / WALK_SPEED_M_PER_MIN) * STREET_CURVE);
        result.transitionToNext = distM > MAX_WALK_M
          ? { type: 'taxi', durationMin: Math.max(5, Math.round(distM / 500)) }
          : { type: 'walk', durationMin: walkMin };
      }
      return result;
    });
  }

  /**
   * Find places within ±250m corridor along route segments.
   * For "nearby" suggestions on result screen.
   */
  async getNearbyPlaces(dto: { points: { lat: number; lng: number }[]; excludeIds: string[]; locale?: string }): Promise<any[]> {
    if (!dto.points?.length) return [];
    const excludeSet = new Set(dto.excludeIds ?? []);
    const corridorM = 250;
    const corridorDeg = corridorM / 111000;

    // Bounding box of all route points + corridor buffer
    const lats = dto.points.map(p => p.lat);
    const lngs = dto.points.map(p => p.lng);
    const minLat = Math.min(...lats) - corridorDeg;
    const maxLat = Math.max(...lats) + corridorDeg;
    const minLng = Math.min(...lngs) - corridorDeg * 1.3;
    const maxLng = Math.max(...lngs) + corridorDeg * 1.3;

    const rows = await this.ds.query(`
      SELECT p.id, v.name, v.name_en, p.category,
        v.lat, v.lng, p.hook, p.walk_tier, p.route_moment, p.google_rating, p.photos
      FROM places p JOIN venues v ON p.venue_id = v.id
      WHERE p.status = 'active'
        AND p.walk_tier IN ('must_see', 'worth_detour')
        AND v.lat BETWEEN $1::float AND $2::float
        AND v.lng BETWEEN $3::float AND $4::float
      ORDER BY CASE p.walk_tier WHEN 'must_see' THEN 1 ELSE 2 END,
        p.google_rating DESC NULLS LAST
      LIMIT 50
    `, [minLat, maxLat, minLng, maxLng]);

    // Filter: within 250m of any route segment + not in excludeIds
    const nearby: any[] = [];
    for (const r of rows) {
      if (excludeSet.has(r.id)) continue;
      const lat = Number(r.lat);
      const lng = Number(r.lng);

      // Check distance to each segment
      let minDist = Infinity;
      for (let i = 0; i < dto.points.length - 1; i++) {
        const d = this.pointToSegmentDistance(
          lat, lng,
          dto.points[i].lat, dto.points[i].lng,
          dto.points[i + 1].lat, dto.points[i + 1].lng,
        );
        if (d < minDist) minDist = d;
      }
      // Also check distance to individual points (for single-point routes)
      for (const pt of dto.points) {
        const d = this.haversine(lat, lng, pt.lat, pt.lng);
        if (d < minDist) minDist = d;
      }

      if (minDist <= corridorM) {
        nearby.push({
          id: r.id,
          name: this.resolveTitle(r.name, r.name_en, dto.locale ?? 'ru'),
          category: r.category,
          lat, lng,
          hook: r.hook,
          walkTier: r.walk_tier,
          distanceFromRoute: Math.round(minDist),
          photoUrl: r.photos?.[0],
        });
      }
    }

    return nearby.slice(0, 4);
  }

  /** Approximate distance from point to line segment (meters) */
  private pointToSegmentDistance(
    px: number, py: number,
    ax: number, ay: number, bx: number, by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return this.haversine(px, py, ax, ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    const closestLat = ax + t * dx;
    const closestLng = ay + t * dy;
    return this.haversine(px, py, closestLat, closestLng);
  }

  private resolveTitle(name: string, nameEn?: string, locale = 'ru'): string {
    const isGeorgian = (s: string) => /[\u10A0-\u10FF]/.test(s);
    if (locale === 'ka') return name;
    if (nameEn) return nameEn;
    if (isGeorgian(name)) return name; // Georgian fallback if no English
    return name;
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
