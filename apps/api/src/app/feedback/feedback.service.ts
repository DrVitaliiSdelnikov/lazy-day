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

  async logBatch(deviceId: string, dto: BatchEventsDto) {
    const deviceHash = deviceId
      ? createHash('sha256').update(deviceId).digest('hex').slice(0, 16)
      : 'anonymous';

    const entities = dto.events.map(e => this.eventRepo.create({
      deviceIdHash: deviceHash,
      sessionId: dto.sessionId,
      eventType: e.eventType,
      targetType: e.targetType,
      targetId: e.targetId,
      cardPosition: e.cardPosition,
      context: e.context,
    }));

    await this.eventRepo.save(entities);
    this.logger.log(`Batch: ${entities.length} events from ${deviceHash}`);

    return { ok: true, count: entities.length };
  }
}
