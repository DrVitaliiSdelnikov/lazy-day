import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type {
  DiscoverRequest,
  DiscoverResponse,
  RecommendationCard,
  CategoryNode,
} from '@lazy-day/shared-models';

@Injectable()
export class HttpApiService extends ApiService {
  private readonly baseUrl = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    ? 'https://lazy-day-production.up.railway.app/v1'
    : '/v1';

  constructor(private readonly http: HttpClient) {
    super();
  }

  discover(request: DiscoverRequest): Observable<DiscoverResponse> {
    return this.http.post<DiscoverResponse>(
      `${this.baseUrl}/recommendations`,
      request,
    );
  }

  getCard(type: string, id: string, lat?: number, lng?: number): Observable<RecommendationCard> {
    const params = (lat != null && lng != null) ? `?lat=${lat}&lng=${lng}` : '';
    return this.http.get<RecommendationCard>(
      `${this.baseUrl}/cards/${type}/${id}${params}`,
    );
  }

  getCategories(): Observable<CategoryNode[]> {
    return this.http.get<CategoryNode[]>(`${this.baseUrl}/meta/categories`);
  }

  submitFeedback(data: { category: string; text: string; contact?: string; meta?: Record<string, unknown> }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/feedback`, data);
  }
}
