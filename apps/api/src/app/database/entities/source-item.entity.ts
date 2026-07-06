import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('source_items')
export class SourceItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: [
      'google_places',
      'osm',
      'tkt_ge',
      'jsonld',
      'ics',
      'bandsintown',
      'manual',
    ],
  })
  source!: string;

  @Column({ type: 'text' })
  externalId!: string;

  @Column({ type: 'text', nullable: true })
  url?: string;

  @Column({ type: 'jsonb' })
  rawPayload!: Record<string, unknown>;

  @Column({ type: 'text' })
  contentHash!: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  fetchedAt!: Date;
}
