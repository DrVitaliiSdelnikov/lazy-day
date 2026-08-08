import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Place } from '../database/entities/place.entity';
import { Venue } from '../database/entities/venue.entity';

/**
 * Two-step Gemini voice enrichment for places.
 * Step 1: classify walk_tier + confidence (cheap, all 3168).
 * Step 2: generate hook/blurb/route_moment/best_time/outdoor (only must_see/worth_detour/nice_nearby).
 */

const GEMINI_MODEL_LITE = 'gemini-3.5-flash-lite';
const GEMINI_MODEL_SMART = 'gemini-3.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const ENRICH_VERSION = 2;

const STEP1_PROMPT = `You are a local Tbilisi resident who knows the city well.
For each place, decide: would you take a friend there on a city walk?

Return STRICTLY a JSON array, one object per place:
- id: as provided
- walk_tier: one of
    "must_see"      — iconic, you bring guests here (fortresses, views, city symbols)
    "worth_detour"  — good place, worth a detour
    "nice_nearby"   — pleasant if you're nearby
    "skip"          — utilitarian, duplicate (gas station, bank, pharmacy, parking, chain fast food, cell shop)
- confidence: "known" (I recognize this place) | "guessed" (judging by category) | "no_info"

Rules:
- Evaluate for WALKS and experience, not everyday needs.
- Utilitarian and chain places — always "skip".
- Don't make things up: if you don't recognize the place — "guessed" or "no_info", tier by category.
- Answer — JSON only, no explanations.

Places:`;

const STEP2_PROMPT = `You are a local friend in Tbilisi, showing a friend around.
Write warmly, honestly, briefly. No tourist pomposity, no advertising,
no Wikipedia retelling. Voice: friendly "you" address.

Each place in the input has: name, category, tags, atmosphere, occasion,
google_types, rating, rating_count, walk_tier, confidence.
USE THIS DATA to write accurate descriptions.

For each place return STRICTLY a JSON array with objects:
- id
- hook: up to 10 words — what makes the place special, as a friend would say.
    Base it on the provided data (atmosphere, tags, category, google_types).
    If you personally know this Tbilisi place — use your knowledge too.
    If you DON'T know it — describe ONLY what the data shows.
    Examples: "cozy wine bar with a quiet yard", "panoramic city view from the hill",
    "busy local market, cheap and real"
- blurb: 2-3 sentences — ONLY if confidence = "known" AND tier != "nice_nearby"
    AND you genuinely know real facts about this specific place.
    What's beautiful/interesting, what to notice. If unsure — strictly null.
    NEVER invent physical details (views, rooftops, interiors) you haven't seen.
- route_moment: "anchor" | "photo_spot" | "rest_stop" | "food_break" | "passage"
- best_time: "morning" | "day" | "sunset" | "evening" | "night" | "any"
- outdoor: "indoor" | "outdoor" | "mixed"

ANTI-HALLUCINATION RULES (critical):
- NEVER describe physical features you can't verify from the data or your knowledge.
- If a place is a monument/statue — don't guess what it looks like. Use category + location.
- If data says "cozy, quiet" — you can say "quiet spot". Don't add "with a rooftop view".
- When in doubt, keep hook generic based on category: "local café worth a stop".
- blurb = null is ALWAYS better than a made-up description.
- Answer — only valid JSON array, no markdown, no explanation.

Places:`;

const TRANSLATE_RU_PROMPT = `Переведи описания мест на русский язык. Ты — местный друг в Тбилиси, который рассказывает другу про места.

Правила:
- Переводи смысл, не дословно. Пиши как друг рассказывает — живо, тепло, но без панибратства.
- Не добавляй то, чего нет в оригинале. Не выдумывай деталей.
- Сохраняй длину — до 10 слов, коротко и ёмко.
- Не переводи названия заведений (оставь как есть).
- "cozy" = уютный/тёплый/приятный (ЧЕРЕДУЙ, не повторяй одно слово).
- "lively" = живой/оживлённый. "trendy" = модный/стильный. "quiet" = тихий/спокойный.
- "casual" = простой/неформальный. "scenic" = с видом/живописный.
- Если оригинал generic ("local cafe for a quick stop") — НЕ приукрашивай, переведи как есть.
- Ответ — ТОЛЬКО валидный JSON массив, без markdown, без пояснений.

Формат: [{id, hook_ru}]

Примеры:
- "Trendy wine bar perfect for date night" → "Стильный винный бар для вечера вдвоём"
- "Quiet park to clear your head" → "Тихий парк, чтобы прийти в себя"
- "Iconic puppet theater with the famous clock tower" → "Легендарный кукольный театр с башней-часами"
- "Casual spot for a quick bite" → "Простое место, чтобы быстро перекусить"
- "Lively bar with great music and drinks" → "Живой бар с отличной музыкой"

Места:`;

interface Step1Result {
  id: string;
  walk_tier: string;
  confidence: string;
}

interface Step2Result {
  id: string;
  hook: string;
  blurb: string | null;
  route_moment: string;
  best_time: string;
  outdoor: string;
}

@Injectable()
export class VoiceEnrichmentService {
  private readonly logger = new Logger(VoiceEnrichmentService.name);

  constructor(
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
  ) {}

  /**
   * Step 1: classify all places by walk_tier + confidence.
   * Processes places where walk_tier is null (not yet classified).
   */
  async enrichStep1(limit = 100): Promise<{ processed: number; errors: number }> {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) return { processed: 0, errors: 0 };

    const places = await this.placeRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.venue', 'v')
      .where('p.walk_tier IS NULL')
      .orderBy('p.createdAt', 'ASC')
      .take(limit)
      .getMany();

    this.logger.log(`Step 1: ${places.length} places to classify`);
    let processed = 0, errors = 0;

    // Batch by 40
    for (let i = 0; i < places.length; i += 40) {
      const batch = places.slice(i, i + 40);
      try {
        const input = batch.map(p => ({
          id: p.id,
          name: p.venue?.name ?? '',
          name_ka: p.venue?.nameKa ?? undefined,
          category: p.category,
          rating: p.googleRating ?? p.rating ?? undefined,
          reviews_count: p.googleRatingCount ?? p.ratingCount ?? undefined,
        }));

        const results = await this.callGemini<Step1Result[]>(
          apiKey, `${STEP1_PROMPT}\n${JSON.stringify(input)}`, GEMINI_MODEL_LITE
        );
        if (!results) { errors++; continue; }

        for (const r of results) {
          const place = batch.find(p => p.id === r.id);
          if (!place) continue;
          if (['must_see', 'worth_detour', 'nice_nearby', 'skip'].includes(r.walk_tier)) {
            place.walkTier = r.walk_tier;
          } else {
            place.walkTier = 'skip';
          }
          place.walkConfidence = ['known', 'guessed', 'no_info'].includes(r.confidence)
            ? r.confidence : 'guessed';
          place.enrichVersion = ENRICH_VERSION;
        }

        await this.placeRepo.save(batch);
        processed += batch.length;
        this.logger.log(`Step 1 batch ${Math.floor(i / 40) + 1}: ${batch.length} classified`);

        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        errors++;
        this.logger.warn(`Step 1 batch error: ${err?.message}`);
        if (err?.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 10000));
        }
      }
    }

    this.logger.log(`Step 1 done: ${processed} processed, ${errors} errors`);
    return { processed, errors };
  }

  /**
   * Step 2: generate hook/blurb/route_moment/best_time/outdoor.
   * Only for must_see, worth_detour, nice_nearby (skip is ignored).
   * Processes places where walk_tier is set but hook is null.
   */
  async enrichStep2(limit = 100): Promise<{ processed: number; errors: number }> {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) return { processed: 0, errors: 0 };

    const places = await this.placeRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.venue', 'v')
      .where('p.walk_tier IS NOT NULL')
      .andWhere("p.walk_tier != 'skip'")
      .andWhere('p.hook IS NULL')
      .orderBy('p.createdAt', 'ASC')
      .take(limit)
      .getMany();

    this.logger.log(`Step 2: ${places.length} places to describe`);
    let processed = 0, errors = 0;

    const STEP2_BATCH = 10;
    for (let i = 0; i < places.length; i += STEP2_BATCH) {
      const batch = places.slice(i, i + STEP2_BATCH);
      try {
        const input = batch.map(p => ({
          id: p.id,
          name: p.venue?.name ?? '',
          name_en: p.venue?.nameEn ?? undefined,
          category: p.category,
          tags: p.tags?.length ? p.tags : undefined,
          atmosphere: p.facetAtmosphere?.length ? p.facetAtmosphere : undefined,
          occasion: p.facetOccasion?.length ? p.facetOccasion : undefined,
          google_types: p.googleTypes?.length ? p.googleTypes : undefined,
          rating: p.googleRating ?? p.rating ?? undefined,
          rating_count: p.googleRatingCount ?? p.ratingCount ?? undefined,
          walk_tier: p.walkTier,
          confidence: p.walkConfidence,
        }));

        const results = await this.callGemini<Step2Result[]>(
          apiKey, `${STEP2_PROMPT}\n${JSON.stringify(input)}`, GEMINI_MODEL_SMART
        );
        if (!results) { errors++; continue; }

        for (const r of results) {
          const place = batch.find(p => p.id === r.id);
          if (!place) continue;

          // Hook — truncate if >60 chars
          place.hook = r.hook ? r.hook.slice(0, 60) : undefined;

          // Blurb — quality gate: only if confidence=known AND tier != nice_nearby
          if (r.blurb && place.walkConfidence === 'known' && place.walkTier !== 'nice_nearby') {
            place.blurb = r.blurb.slice(0, 400);
          } else {
            place.blurb = undefined;
          }

          if (r.route_moment) place.routeMoment = r.route_moment;
          if (r.best_time) place.bestTime = r.best_time;
          if (r.outdoor) place.outdoor = r.outdoor;
          place.enrichVersion = ENRICH_VERSION;
        }

        await this.placeRepo.save(batch);
        processed += batch.length;
        this.logger.log(`Step 2 batch ${Math.floor(i / STEP2_BATCH) + 1}: ${batch.length} described`);

        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        errors++;
        this.logger.warn(`Step 2 batch error: ${err?.message}`);
        if (err?.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 10000));
        }
      }
    }

    this.logger.log(`Step 2 done: ${processed} processed, ${errors} errors`);
    return { processed, errors };
  }

  /**
   * Translate EN hooks to Russian.
   * Uses Gemini to translate with "local friend" voice, not literal translation.
   */
  async translateHooksRu(limit = 100): Promise<{ processed: number; errors: number }> {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) return { processed: 0, errors: 0 };

    const places = await this.placeRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.venue', 'v')
      .where('p.hook IS NOT NULL')
      .andWhere("p.hook != ''")
      .andWhere('p.hook_ru IS NULL')
      .orderBy('p.googleRating', 'DESC', 'NULLS LAST')
      .take(limit)
      .getMany();

    this.logger.log(`Translate RU: ${places.length} hooks to translate`);
    let processed = 0, errors = 0;

    const BATCH = 30;
    for (let i = 0; i < places.length; i += BATCH) {
      const batch = places.slice(i, i + BATCH);
      try {
        const input = batch.map(p => ({
          id: p.id,
          hook: p.hook,
          category: p.category,
          name: p.venue?.nameEn ?? p.venue?.name ?? '',
        }));

        const results = await this.callGemini<{ id: string; hook_ru: string }[]>(
          apiKey, `${TRANSLATE_RU_PROMPT}\n${JSON.stringify(input)}`, GEMINI_MODEL_SMART
        );
        if (!results) { errors++; continue; }

        for (const r of results) {
          const place = batch.find(p => p.id === r.id);
          if (!place || !r.hook_ru) continue;
          place.hookRu = r.hook_ru.slice(0, 80);
        }

        await this.placeRepo.save(batch);
        processed += batch.length;
        this.logger.log(`Translate RU batch ${Math.floor(i / BATCH) + 1}: ${batch.length} translated`);

        await new Promise(r => setTimeout(r, 300));
      } catch (err: any) {
        errors++;
        this.logger.warn(`Translate RU batch error: ${err?.message}`);
        if (err?.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 10000));
        }
      }
    }

    this.logger.log(`Translate RU done: ${processed} processed, ${errors} errors`);
    return { processed, errors };
  }

  /** Reset step2 results (hook/blurb) to re-run with better prompt */
  async resetStep2(): Promise<{ reset: number }> {
    const result = await this.placeRepo
      .createQueryBuilder()
      .update(Place)
      .set({ hook: undefined, blurb: undefined, routeMoment: undefined, bestTime: undefined, outdoor: undefined })
      .where('hook IS NOT NULL')
      .execute();
    this.logger.log(`Reset step2: ${result.affected} places cleared`);
    return { reset: result.affected ?? 0 };
  }

  /** Spot-check: return walk_tier stats + sample of must_see places */
  async spotCheck(): Promise<{
    stats: Record<string, number>;
    mustSee: { name: string; walkTier: string; confidence: string; hook?: string }[];
  }> {
    const stats = await this.placeRepo
      .createQueryBuilder('p')
      .select('p.walk_tier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.walk_tier')
      .getRawMany();

    const mustSee = await this.placeRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.venue', 'v')
      .where("p.walk_tier = 'must_see'")
      .orderBy('p.googleRating', 'DESC', 'NULLS LAST')
      .take(20)
      .getMany();

    return {
      stats: Object.fromEntries(stats.map((s: any) => [s.tier ?? 'null', Number(s.count)])),
      mustSee: mustSee.map(p => ({
        name: p.venue?.name ?? p.id,
        walkTier: p.walkTier!,
        confidence: p.walkConfidence!,
        hook: p.hook ?? undefined,
      })),
    };
  }

  private async callGemini<T>(apiKey: string, prompt: string, model = GEMINI_MODEL_LITE): Promise<T | null> {
    const response = await fetch(
      `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      this.logger.debug(`Invalid JSON from Gemini: ${clean.slice(0, 200)}`);
      return null;
    }
  }
}
