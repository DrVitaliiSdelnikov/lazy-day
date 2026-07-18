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
  @Column({ type: 'text', array: true, nullable: true })
  facetCuisine?: string[];

  @Column({ type: 'text', array: true, nullable: true })
  facetFormat?: string[];

  @Column({ type: 'smallint', nullable: true })
  facetPriceTier?: number;

  @Column({ type: 'real', nullable: true })
  facetPriceConf?: number;

  @Column({ type: 'text', array: true, nullable: true })
  facetAtmosphere?: string[];

  @Column({ type: 'text', array: true, nullable: true })
  facetOccasion?: string[];

  // "Спланируй день" schema (fill now, logic later)
  @Column({ type: 'smallint', nullable: true })
  typicalDurationMin?: number;

  @Column({ type: 'text', array: true, nullable: true })
  timeOfDayFit?: string[];

  @Column({ type: 'text', nullable: true })
  venueRole?: string;

  @Column({ type: 'text', nullable: true })
  anchorVsFiller?: string;

  // Enrichment freshness
  @Column({ type: 'timestamptz', nullable: true })
  enrichedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
