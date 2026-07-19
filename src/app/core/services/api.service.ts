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
  abstract getCard(type: string, id: string, lat?: number, lng?: number): Observable<RecommendationCard>;
  abstract getCategories(): Observable<CategoryNode[]>;
  abstract submitFeedback(data: { category: string; text: string; contact?: string; meta?: Record<string, unknown> }): Observable<{ ok: boolean }>;
  abstract getTasteProfile(): Observable<any>;
  abstract updateTasteProfile(data: { removeFacet?: { type: string; value: string }; removeNegative?: { type: string; value: string }; reset?: boolean }): Observable<any>;
}
