import { IsString, IsArray, IsOptional, IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EventItemDto {
  @IsString()
  eventType!: string;

  @IsString()
  targetType!: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsNumber()
  cardPosition?: number;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class BatchEventsDto {
  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventItemDto)
  events!: EventItemDto[];
}
