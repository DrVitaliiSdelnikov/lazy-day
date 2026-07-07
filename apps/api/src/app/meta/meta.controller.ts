import { Controller, Get, Query } from '@nestjs/common';

interface CategoryItem {
  slug: string;
  label: string;
  icon?: string;
}

const CATEGORIES_RU: CategoryItem[] = [
  { slug: 'food', label: 'Еда' },
  { slug: 'nature', label: 'Природа' },
  { slug: 'culture', label: 'Культура' },
  { slug: 'nightlife', label: 'Ночная жизнь' },
  { slug: 'active', label: 'Активный отдых' },
  { slug: 'entertainment', label: 'Развлечения' },
  { slug: 'gym', label: 'Фитнес' },
  { slug: 'sports', label: 'Спорт' },
  { slug: 'spa', label: 'Спа и бани' },
  { slug: 'shopping', label: 'Шоппинг' },
  { slug: 'family', label: 'Для семьи' },
];

const CATEGORIES_EN: CategoryItem[] = [
  { slug: 'food', label: 'Food & Drink' },
  { slug: 'nature', label: 'Nature' },
  { slug: 'culture', label: 'Culture' },
  { slug: 'nightlife', label: 'Nightlife' },
  { slug: 'active', label: 'Active Leisure' },
  { slug: 'entertainment', label: 'Entertainment' },
  { slug: 'gym', label: 'Fitness' },
  { slug: 'sports', label: 'Sports' },
  { slug: 'spa', label: 'Spa & Baths' },
  { slug: 'shopping', label: 'Shopping' },
  { slug: 'family', label: 'Family' },
];

@Controller('meta')
export class MetaController {
  @Get('categories')
  getCategories(@Query('locale') locale?: string) {
    return locale === 'en' ? CATEGORIES_EN : CATEGORIES_RU;
  }
}
