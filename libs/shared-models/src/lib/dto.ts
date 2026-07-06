import {
  CardType,
  CompanyType,
  InteractionAction,
  Locale,
} from './enums';

/**
 * DTO marker interfaces for backend class-validator.
 * Frontend uses these as plain types.
 * Backend extends them with decorators.
 */

export interface DiscoverRequestDto {
  lat: number;
  lng: number;
  radiusM?: number;
  timeWindow: { from: string; to: string };
  profile: {
    interests: Record<string, number>;
    company?: CompanyType;
    budgetMax?: number;
  };
  hiddenIds?: string[];
  locale: Locale;
}

export interface InteractionDto {
  sessionId: string;
  cardType: CardType;
  cardId: string;
  action: InteractionAction;
  context?: Record<string, unknown>;
}
