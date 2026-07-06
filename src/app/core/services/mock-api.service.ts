import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, delay } from 'rxjs';
import { ApiService } from './api.service';
import {
  CategoryNode,
  DiscoverRequest,
  DiscoverResponse,
  RecommendationCard,
} from '../models';

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class MockApiService extends ApiService {
  private http = inject(HttpClient);
  private allCards: RecommendationCard[] | null = null;

  private loadCards(): Observable<RecommendationCard[]> {
    if (this.allCards) {
      return of(this.allCards);
    }
    return this.http
      .get<RecommendationCard[]>('./assets/mock/cards.json')
      .pipe(map((cards) => (this.allCards = cards)));
  }

  discover(request: DiscoverRequest): Observable<DiscoverResponse> {
    return this.loadCards().pipe(
      map((cards) => {
        const filtered = cards
          .map((card) => ({
            ...card,
            distanceM: haversineDistance(
              request.lat,
              request.lng,
              card.lat,
              card.lng
            ),
            walkMinutes: Math.round(
              (haversineDistance(request.lat, request.lng, card.lat, card.lng) *
                1.3) /
                80
            ),
          }))
          .filter((card) => card.distanceM <= request.radiusM)
          .filter(
            (card) => !request.hiddenIds.includes(card.id)
          )
          .sort((a, b) => {
            const aMatch = this.interestScore(a, request.profile.interests);
            const bMatch = this.interestScore(b, request.profile.interests);
            return bMatch - aMatch || a.distanceM - b.distanceM;
          })
          .slice(0, 20);

        return {
          sessionId: crypto.randomUUID(),
          cards: filtered,
          hasMore: false,
        };
      }),
      delay(300)
    );
  }

  getCard(type: string, id: string): Observable<RecommendationCard> {
    return this.loadCards().pipe(
      map((cards) => {
        const card = cards.find((c) => c.id === id && c.type === type);
        if (!card) throw new Error(`Card not found: ${type}/${id}`);
        return card;
      })
    );
  }

  getCategories(): Observable<CategoryNode[]> {
    return this.http.get<CategoryNode[]>('./assets/mock/categories.json');
  }

  private interestScore(
    card: RecommendationCard,
    interests: Record<string, number>
  ): number {
    if (!interests || Object.keys(interests).length === 0) return 0.5;
    const matchingWeights = (card.explanations || [])
      .filter((e) => e.type === 'matches_interest')
      .map((e) => interests[card.category] ?? 0);
    const catWeight = interests[card.category] ?? 0;
    return Math.max(catWeight, ...matchingWeights, 0.1);
  }
}
