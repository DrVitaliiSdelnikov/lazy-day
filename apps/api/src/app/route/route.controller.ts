import { Controller, Post, Body } from '@nestjs/common';
import { RouteService } from './route.service';
import { GenerateRouteDto } from './dto/generate-route.dto';

@Controller('routes')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateRouteDto) {
    return this.routeService.generate(dto);
  }

  @Post('alternatives')
  async alternatives(@Body() dto: {
    lat: number; lng: number; role: string;
    excludeIds: string[]; prevLat?: number; prevLng?: number;
    nextLat?: number; nextLng?: number; moods?: string[];
  }) {
    return this.routeService.getAlternatives(dto);
  }
}
