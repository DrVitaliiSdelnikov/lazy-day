import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { createHash } from 'crypto';
import { RecommendationService } from './recommendation.service';
import { TasteProfileService } from './taste-profile.service';
import { DiscoverRequestDto } from './dto/discover-request.dto';

@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly service: RecommendationService,
    private readonly tasteProfile: TasteProfileService,
  ) {}

  @Post()
  discover(@Body() dto: DiscoverRequestDto) {
    return this.service.discover(dto);
  }

  /** Dev-only: score decomposition per venue. NOT for prod use. */
  @Post('explain')
  explain(@Body() dto: DiscoverRequestDto) {
    return this.service.discoverWithExplanation(dto);
  }

  @Get(':sessionId/more')
  more(@Param('sessionId') sessionId: string) {
    return this.service.more(sessionId);
  }

  private hashDeviceId(deviceId: string): string {
    return createHash('sha256').update(deviceId).digest('hex').slice(0, 16);
  }

  /** F3.2: Get user's taste profile for settings UI */
  @Get('taste-profile')
  async getTasteProfile(@Headers('x-device-id') deviceId: string) {
    const profile = await this.tasteProfile.loadProfile(this.hashDeviceId(deviceId));
    if (!profile) return { facets: {}, price: {}, signalCount: 0 };

    // Flatten weights for UI: [{type, value, weight}] sorted by weight desc
    const facets: Array<{ type: string; value: string; weight: number }> = [];
    for (const [type, vals] of Object.entries(profile.facet_weights)) {
      for (const [value, weight] of Object.entries(vals)) {
        facets.push({ type, value, weight: weight as number });
      }
    }
    facets.sort((a, b) => b.weight - a.weight);

    return {
      positives: facets.filter(f => f.weight > 0.3).slice(0, 8),
      negatives: facets.filter(f => f.weight < -0.2).slice(0, 4),
      price: profile.price_pref,
      signalCount: profile.signal_count,
    };
  }

  /** F3.2: Update taste profile from settings (user correction) */
  @Patch('taste-profile')
  async updateTasteProfile(
    @Headers('x-device-id') deviceId: string,
    @Body() body: { removeFacet?: { type: string; value: string }; removeNegative?: { type: string; value: string }; reset?: boolean },
  ) {
    if (!deviceId) return { error: 'device-id required' };
    const hash = this.hashDeviceId(deviceId);

    if (body.reset) {
      await this.tasteProfile.resetProfile(hash);
      return { status: 'reset' };
    }

    if (body.removeFacet) {
      await this.tasteProfile.removeFacetWeight(hash, body.removeFacet.type, body.removeFacet.value);
      return { status: 'removed' };
    }

    if (body.removeNegative) {
      await this.tasteProfile.removeNegative(hash, body.removeNegative.type, body.removeNegative.value);
      return { status: 'removed' };
    }

    return { status: 'no-op' };
  }
}
