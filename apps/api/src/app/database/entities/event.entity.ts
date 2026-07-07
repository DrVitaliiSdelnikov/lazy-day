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

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  venueId?: string;

  @ManyToOne(() => Venue, (venue) => venue.events)
  @JoinColumn()
  venue?: Venue;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  titleKa?: string;

  @Column({ type: 'text', nullable: true })
  titleEn?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  eventType?: string;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt?: Date;

  @Column({ type: 'text', default: 'Asia/Tbilisi' })
  timezone!: string;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  tags!: string[];

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  priceMin?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  priceMax?: number;

  @Column({ type: 'text', default: 'GEL' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  ticketUrl?: string;

  @Column({ type: 'text', nullable: true })
  ticketDomain?: string;

  @Column({ type: 'text', nullable: true })
  organizerName?: string;

  @Column({ type: 'text', nullable: true })
  posterUrl?: string;

  @Column({ type: 'text', nullable: true })
  posterHash?: string;

  @Column({
    type: 'enum',
    enum: ['scheduled', 'postponed', 'cancelled', 'past'],
    default: 'scheduled',
  })
  status!: string;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0.5 })
  qualityScore!: number;

  @Column({ type: 'text', nullable: true })
  source?: string;

  @Column({ type: 'text', nullable: true })
  sourceEventId?: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  lastVerifiedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
