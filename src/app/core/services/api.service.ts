import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CategoryNode,
  DiscoverRequest,
  DiscoverResponse,
  RecommendationCard,
} from '../models';

@Injectable()
export abstract class ApiService {
  abstract discover(request: DiscoverRequest): Observable<DiscoverResponse>;
  abstract count(request: DiscoverRequest): Observable<{ places: number; events: number; total: number }>;
  abstract getCard(type: string, id: string, lat?: number, lng?: number): Observable<RecommendationCard>;
  abstract getCategories(): Observable<CategoryNode[]>;
  abstract submitFeedback(data: { category: string; text: string; contact?: string; meta?: Record<string, unknown> }): Observable<{ ok: boolean }>;
  abstract generateRoute(request: { lat: number; lng: number; duration?: string; moods?: string[]; pace?: string; locale?: string }): Observable<any>;
  abstract getRouteAlternatives(request: { lat: number; lng: number; role: string; excludeIds: string[]; prevLat?: number; prevLng?: number; nextLat?: number; nextLng?: number; moods?: string[] }): Observable<any>;
  abstract getTasteProfile(): Observable<any>;
  abstract updateTasteProfile(data: { removeFacet?: { type: string; value: string }; removeNegative?: { type: string; value: string }; reset?: boolean }): Observable<any>;
}
