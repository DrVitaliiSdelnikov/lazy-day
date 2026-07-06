export type CardType = 'place' | 'event';

export type CompanyType = 'solo' | 'couple' | 'family' | 'friends';

export type Locale = 'ru' | 'en' | 'ka';

export type InteractionAction =
  | 'impression'
  | 'click'
  | 'save'
  | 'hide'
  | 'share'
  | 'clickout';

export type EventStatus = 'scheduled' | 'postponed' | 'cancelled' | 'past';

export type SourceType =
  | 'google_places'
  | 'osm'
  | 'tkt_ge'
  | 'jsonld'
  | 'ics'
  | 'bandsintown'
  | 'manual';
