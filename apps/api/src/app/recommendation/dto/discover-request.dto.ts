import {
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsObject,
  ValidateNested,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class TimeWindowDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;
}

class ProfileDto {
  @IsObject()
  interests!: Record<string, number>;

  @IsOptional()
  @IsEnum(['solo', 'couple', 'family', 'friends'])
  company?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMax?: number;
}

export class DiscoverRequestDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(50000)
  radiusM?: number;

  @ValidateNested()
  @Type(() => TimeWindowDto)
  timeWindow!: TimeWindowDto;

  @ValidateNested()
  @Type(() => ProfileDto)
  profile!: ProfileDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenIds?: string[];

  @IsEnum(['ru', 'en', 'ka'])
  locale!: string;
}
