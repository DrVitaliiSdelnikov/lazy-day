import {
  CardType,
  CompanyType,
  Locale,
  InteractionAction,
} from './enums';

export interface ExplanationTag {
  type: string;
  label: string;
}

export interface RecommendationCard {
  id: string;
  type: CardType;
  title: string;
  category: string;
  categoryLabel?: string;
  photoUrl?: string;
  posterUrl?: string;
  lat: number;
  lng: number;
  distanceM: number;
  walkMinutes: number;
  priceLabel?: string;
  timeLabel?: string;
  status?: 'postponed' | 'cancelled' | 'sold_out';
  freshness?: string;
  explanations: ExplanationTag[];
  externalUrl?: string;
  ticketUrl?: string;
  address?: string;
  description?: string;
  openStatus?: string;
  startsAt?: string;
  endsAt?: string;
  venueName?: string;
  rating?: number;
  ratingCount?: number;
  primaryTags?: string[];
  secondaryTags?: string[];
  googlePlaceId?: string;
  isChain?: boolean;
  whyLabel?: string;
  source: string;
}

export interface CategoryNode {
  slug: string;
  label: string;
  icon?: string;
  children?: CategoryNode[];
}

export interface UserProfile {
  deviceId: string;
  interests: Record<string, number>;
  company: CompanyType | null;
  budgetMax: number | null;
  locale: Locale;
  city: string;
  onboardingCompleted: boolean;
}

export interface DiscoverRequest {
  lat: number;
  lng: number;
  radiusM: number;
  timeWindow: { from: string; to: string };
  profile: {
    interests: Record<string, number>;
    company?: CompanyType;
    hasPet?: boolean;
    budgetMax?: number;
  };
  hiddenIds: string[];
  locale: Locale;
  forcedNow?: boolean;
  deviceIdHash?: string;
}

export interface DiscoverMeta {
  fallback?: 'tomorrow' | 'exhausted';
  originalCount?: number;
}

export interface DiscoverResponse {
  sessionId: string;
  cards: RecommendationCard[];
  hasMore: boolean;
  meta?: DiscoverMeta;
}

export interface InteractionRequest {
  sessionId: string;
  cardType: CardType;
  cardId: string;
  action: InteractionAction;
  context?: Record<string, unknown>;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'ok' | 'down';
  redis: 'ok' | 'down';
  google: 'ok' | 'degraded' | 'down';
}
