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

  @Column({ type: 'boolean', default: false })
  isChain!: boolean;

  @Column({ type: 'text', nullable: true })
  chainKey?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
