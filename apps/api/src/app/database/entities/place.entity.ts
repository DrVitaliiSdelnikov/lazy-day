import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Venue } from './venue.entity';

@Entity('places')
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  venueId!: string;

  @ManyToOne(() => Venue, (venue) => venue.places)
  @JoinColumn()
  venue?: Venue;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  tags!: string[];

  @Column({ type: 'smallint', nullable: true })
  priceLevel?: number;

  @Column({ type: 'jsonb', nullable: true })
  openingHours?: Record<string, unknown>;

  @Column({ type: 'numeric', precision: 2, scale: 1, nullable: true })
  rating?: number;

  @Column({ type: 'int', nullable: true })
  ratingCount?: number;

  @Column({ type: 'text', array: true, default: '{}' })
  photos!: string[];

  @Column({ type: 'boolean', nullable: true })
  indoor?: boolean;

  @Column({ type: 'int', nullable: true })
  avgDurationMin?: number;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0.5 })
  qualityScore!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'jsonb', default: '{}' })
  attributes!: Record<string, unknown>;

  @Column({ type: 'text', array: true, default: '{}' })
  googleTypes!: string[];

  @Column({ type: 'numeric', precision: 2, scale: 1, nullable: true })
  googleRating?: number;

  @Column({ type: 'int', nullable: true })
  googleRatingCount?: number;

  @Column({ type: 'boolean', default: false })
  isChain!: boolean;

  @Column({ type: 'text', nullable: true })
  chainKey?: string;

  // Facets (Phase A)
  @Column({ type: 'text', array: true, nullable: true, name: 'facet_cuisine' })
  facetCuisine?: string[];

  @Column({ type: 'text', array: true, nullable: true, name: 'facet_format' })
  facetFormat?: string[];

  @Column({ type: 'smallint', nullable: true, name: 'facet_price_tier' })
  facetPriceTier?: number;

  @Column({ type: 'real', nullable: true, name: 'facet_price_conf' })
  facetPriceConf?: number;

  @Column({ type: 'text', array: true, nullable: true, name: 'facet_atmosphere' })
  facetAtmosphere?: string[];

  @Column({ type: 'text', array: true, nullable: true, name: 'facet_occasion' })
  facetOccasion?: string[];

  // "Спланируй день" schema (fill now, logic later)
  @Column({ type: 'smallint', nullable: true, name: 'typical_duration_min' })
  typicalDurationMin?: number;

  @Column({ type: 'text', array: true, nullable: true, name: 'time_of_day_fit' })
  timeOfDayFit?: string[];

  @Column({ type: 'text', nullable: true, name: 'venue_role' })
  venueRole?: string;

  @Column({ type: 'text', nullable: true, name: 'anchor_vs_filler' })
  anchorVsFiller?: string;

  // Enrichment freshness
  @Column({ type: 'timestamptz', nullable: true, name: 'enriched_at' })
  enrichedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
