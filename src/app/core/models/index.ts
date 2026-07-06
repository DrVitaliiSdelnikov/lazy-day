export type CardType = 'place' | 'event';

export type CompanyType = 'solo' | 'couple' | 'family' | 'friends';

export type Locale = 'ru' | 'en';

export interface RecommendationCard {
  id: string;
  type: CardType;
  title: string;
  category: string;
  categoryLabel?: string;
  photoUrl?: string;
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
  source: string;
}

export interface ExplanationTag {
  type: string;
  label: string;
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
    budgetMax?: number;
  };
  hiddenIds: string[];
  locale: Locale;
}

export interface DiscoverResponse {
  sessionId: string;
  cards: RecommendationCard[];
  hasMore: boolean;
}
