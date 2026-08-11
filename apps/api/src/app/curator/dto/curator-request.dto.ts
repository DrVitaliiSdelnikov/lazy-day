import { IsNumber, IsOptional, IsString, IsArray, IsEnum, IsBoolean, Min, Max } from 'class-validator';

export class CuratorRequestDto {
  @IsNumber() @Min(-90) @Max(90)
  lat!: number;

  @IsNumber() @Min(-180) @Max(180)
  lng!: number;

  @IsEnum(['today', 'tomorrow', 'weekend', 'custom'])
  dateType!: string;

  @IsOptional()
  @IsString()
  customDate?: string;

  @IsArray()
  @IsString({ each: true })
  moods!: string[];

  @IsEnum(['day', 'evening', 'all_day'])
  dayPart!: string;

  @IsOptional()
  @IsEnum(['solo', 'couple', 'friends', 'kids'])
  company?: string;

  @IsOptional()
  @IsBoolean()
  outOfTown?: boolean;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  deviceIdHash?: string;

  @IsOptional()
  @IsNumber()
  seed?: number;
}
