import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('source_refs')
export class SourceRef {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['place', 'event', 'venue'] })
  entityType!: string;

  @Column({ type: 'uuid' })
  entityId!: string;

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

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  lastSeenAt!: Date;
}
