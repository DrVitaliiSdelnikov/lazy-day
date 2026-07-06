import { IsEnum, IsOptional, IsString, IsObject, IsUUID } from 'class-validator';

export class InteractionDto {
  @IsString()
  sessionId!: string;

  @IsEnum(['place', 'event'])
  cardType!: string;

  @IsUUID()
  cardId!: string;

  @IsEnum(['impression', 'click', 'save', 'hide', 'share', 'clickout'])
  action!: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
