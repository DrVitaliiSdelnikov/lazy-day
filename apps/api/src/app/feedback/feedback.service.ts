import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Interaction } from '../database/entities/interaction.entity';
import { InteractionEvent } from '../database/entities/interaction-event.entity';
import { InteractionDto } from './dto/interaction.dto';
import { BatchEventsDto } from './dto/batch-events.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Interaction)
    private readonly interactionRepo: Repository<Interaction>,
    @InjectRepository(InteractionEvent)
    private readonly eventRepo: Repository<InteractionEvent>,
  ) {}

  async log(deviceId: string, dto: InteractionDto) {
    const interaction = this.interactionRepo.create({
      deviceId: deviceId || 'unknown',
      cardType: dto.cardType,
      cardId: dto.cardId,
      action: dto.action,
      sessionId: dto.sessionId,
      context: dto.context,
    });

    await this.interactionRepo.save(interaction);
    this.logger.log(`${dto.action} on ${dto.cardType}/${dto.cardId}`);

    return { ok: true };
  }

  async logBatch(headerDeviceId: string, dto: BatchEventsDto) {
    const rawId = dto.deviceId || headerDeviceId;
    const deviceHash = rawId
      ? createHash('sha256').update(rawId).digest('hex').slice(0, 16)
      : 'anonymous';

    const consentState = dto.consentState || 'pending';

    const entities = dto.events.map(e => this.eventRepo.create({
      deviceIdHash: consentState === 'declined' ? 'anonymous' : deviceHash,
      sessionId: dto.sessionId,
      eventType: e.eventType,
      targetType: e.targetType,
      targetId: e.targetId,
      cardPosition: e.cardPosition,
      context: e.context,
      consentState,
    }));

    await this.eventRepo.save(entities);
    this.logger.log(`Batch: ${entities.length} events from ${deviceHash}`);

    return { ok: true, count: entities.length };
  }
}
