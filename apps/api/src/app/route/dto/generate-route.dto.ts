import {
  IsNumber, IsOptional, IsString, IsArray, IsEnum, Min, Max,
} from 'class-validator';

export class GenerateRouteDto {
  @IsNumber() @Min(-90) @Max(90)
  lat!: number;

  @IsNumber() @Min(-180) @Max(180)
  lng!: number;

  @IsOptional()
  @IsEnum(['1h', '2-3h', 'half-day', 'full-day'])
  duration?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moods?: string[];

  @IsOptional()
  @IsEnum(['gps', 'center'])
  startType?: string;

  @IsOptional()
  @IsEnum(['relaxed', 'intense'])
  pace?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companions?: string[];

  @IsOptional()
  @IsString()
  locale?: string;
}
