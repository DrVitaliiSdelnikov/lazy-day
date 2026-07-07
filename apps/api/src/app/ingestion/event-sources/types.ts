export interface NormalizedEvent {
  title: string;
  titleEn?: string;
  titleKa?: string;
  description?: string;
  startsAt: Date;
  endsAt?: Date;
  venueName: string;
  venueAddress?: string;
  category: string;
  tags: string[];
  priceMin?: number;
  priceMax?: number;
  currency: string;
  ticketUrl?: string;
  posterUrl?: string;
  source: string;
  sourceEventId: string;
}

export interface EventSourceAdapter {
  readonly sourceName: string;
  fetch(): Promise<NormalizedEvent[]>;
}
