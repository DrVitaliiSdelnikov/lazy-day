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

  async generate(dto: GenerateRouteDto): Promise<RouteResponse> {
    const duration = dto.duration ?? '2-3h';
    const pace = dto.pace ?? 'relaxed';
    const moods = dto.moods ?? ['scenic', 'food'];
    const locale = dto.locale ?? 'ru';

    const targetMinutes = duration === '2-3h' ? 150 : duration === 'half-day' ? 300 : 480;
    const targetPoints = duration === '2-3h' ? 4 : duration === 'half-day' ? 6 : 8;
    const radiusM = duration === '2-3h' ? 3000 : duration === 'half-day' ? 5000 : 8000;

    // 1. Fetch candidates
    const candidates = await this.fetchCandidates(dto.lat, dto.lng, radiusM, moods);
    this.logger.log(`Route: ${candidates.length} candidates in ${radiusM}m radius`);

    if (candidates.length < 2) {
      return this.emptyFallback(dto, locale);
    }

    // 2. Build chain
    const chain = this.buildChain(candidates, dto.lat, dto.lng, targetPoints, targetMinutes, pace);

    // 3. Compute transitions
    const transitions = this.computeTransitions(chain);

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
    };
  }

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

  private buildChain(
    candidates: RouteCandidate[],
    startLat: number, startLng: number,
    targetPoints: number, targetMinutes: number,
    pace: string,
  ): RoutePoint[] {
    const used = new Set<string>();
    const chain: RoutePoint[] = [];

    // Role sequence: anchor → photo_spot → food_break → rest_stop → anchor...
    const roleSequence = ['anchor', 'photo_spot', 'food_break', 'rest_stop'];
    let roleIdx = 0;

    // Start with nearest anchor/must_see
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
      }
    }

    // Fill remaining slots
    let totalMin = chain.reduce((s, p) => s + p.durationMin, 0);
    const needFood = targetMinutes >= 180;
    let hasFoodBreak = false;

    while (chain.length < targetPoints && totalMin < targetMinutes * 0.9) {
      const desiredRole = roleSequence[roleIdx % roleSequence.length];
      const actualRole = (needFood && !hasFoodBreak && chain.length >= Math.floor(targetPoints / 2))
        ? 'food_break' : desiredRole;

      const candidate = this.findByRole(candidates, used, curLat, curLng, actualRole);
      if (!candidate) {
        // Fallback: any unused nearby
        const fallback = this.nearest(candidates.filter(c => !used.has(c.id)), curLat, curLng);
        if (!fallback) break;
        chain.push(this.toPoint(fallback, fallback.route_moment || 'passage', pace));
        used.add(fallback.id);
        curLat = fallback.lat;
        curLng = fallback.lng;
      } else {
        chain.push(this.toPoint(candidate, actualRole, pace));
        used.add(candidate.id);
        curLat = candidate.lat;
        curLng = candidate.lng;
        if (actualRole === 'food_break') hasFoodBreak = true;
      }

      totalMin = chain.reduce((s, p) => s + p.durationMin, 0);
      roleIdx++;
    }

    return chain;
  }

  private findByRole(
    candidates: RouteCandidate[], used: Set<string>,
    lat: number, lng: number, role: string,
  ): RouteCandidate | null {
    const categoryMap: Record<string, string[]> = {
      food_break: ['restaurant', 'cafe', 'bakery'],
      rest_stop: ['cafe', 'park', 'garden'],
      photo_spot: ['viewpoint', 'park', 'attraction', 'garden'],
      anchor: ['viewpoint', 'museum', 'gallery', 'theater', 'bath'],
    };

    const validCategories = categoryMap[role] ?? [];
    // Try strict match first (category OR route_moment)
    const strict = candidates.filter(c => {
      if (used.has(c.id)) return false;
      return validCategories.includes(c.category) || c.route_moment === role;
    });
    if (strict.length > 0) return this.nearest(strict, lat, lng);

    // Fallback: any unused nearby
    const unused = candidates.filter(c => !used.has(c.id));
    return unused.length > 0 ? this.nearest(unused, lat, lng) : null;
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

  private toPoint(c: RouteCandidate, role: string, pace: string): RoutePoint {
    const raw = c.typical_duration_min ?? (role === 'food_break' ? 45 : role === 'anchor' ? 30 : 20);
    const baseDuration = Math.min(raw, 60); // cap at 1h per point
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

  private computeTransitions(chain: RoutePoint[]): RouteTransition[] {
    const transitions: RouteTransition[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const distM = this.haversine(chain[i].lat, chain[i].lng, chain[i + 1].lat, chain[i + 1].lng);
      const walkMin = Math.round((distM / WALK_SPEED_M_PER_MIN) * STREET_CURVE);

      if (distM > MAX_WALK_M) {
        // Taxi link
        const taxiMin = Math.max(5, Math.round(distM / 500)); // ~30km/h city
        transitions.push({ type: 'taxi', distanceM: Math.round(distM), durationMin: taxiMin });
      } else {
        transitions.push({ type: 'walk', distanceM: Math.round(distM), durationMin: walkMin });
      }
    }
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

    // C3: taxi links
    for (let i = 0; i < transitions.length; i++) {
      if (transitions[i].type === 'taxi') {
        const costLari = Math.max(4, Math.round(transitions[i].distanceM / 1000 * 2));
        transitions[i].careLine = `Отсюда пешком далеко — лучше такси, минут ${transitions[i].durationMin} и ~${costLari} лари`;
        care.push({ rule: 'C3', text: transitions[i].careLine!, position: 'transition' });
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
