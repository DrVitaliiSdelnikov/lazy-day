import { Controller, Get, Query } from '@nestjs/common';

interface CategoryItem {
  slug: string;
  label: string;
  icon?: string;
}

const CATEGORIES_RU: CategoryItem[] = [
  { slug: 'restaurant', label: 'Рестораны' },
  { slug: 'cafe', label: 'Кафе' },
  { slug: 'bar', label: 'Бары' },
  { slug: 'bakery', label: 'Пекарни' },
  { slug: 'museum', label: 'Музеи' },
  { slug: 'gallery', label: 'Галереи' },
  { slug: 'theater', label: 'Театр' },
  { slug: 'cinema', label: 'Кино' },
  { slug: 'club', label: 'Клубы' },
  { slug: 'park', label: 'Парки' },
  { slug: 'viewpoint', label: 'Смотровые' },
  { slug: 'mall', label: 'Шоппинг' },
  { slug: 'gym', label: 'Спорт' },
  { slug: 'spa', label: 'Спа' },
  { slug: 'bath', label: 'Бани' },
  { slug: 'nightlife', label: 'Ночная жизнь' },
  { slug: 'nature', label: 'Природа' },
  { slug: 'wine', label: 'Вино' },
  { slug: 'kids', label: 'Для детей' },
  { slug: 'history', label: 'История' },
];

const CATEGORIES_EN: CategoryItem[] = [
  { slug: 'restaurant', label: 'Restaurants' },
  { slug: 'cafe', label: 'Cafes' },
  { slug: 'bar', label: 'Bars' },
  { slug: 'bakery', label: 'Bakeries' },
  { slug: 'museum', label: 'Museums' },
  { slug: 'gallery', label: 'Galleries' },
  { slug: 'theater', label: 'Theater' },
  { slug: 'cinema', label: 'Cinema' },
  { slug: 'club', label: 'Clubs' },
  { slug: 'park', label: 'Parks' },
  { slug: 'viewpoint', label: 'Viewpoints' },
  { slug: 'mall', label: 'Shopping' },
  { slug: 'gym', label: 'Sports' },
  { slug: 'spa', label: 'Spa' },
  { slug: 'bath', label: 'Baths' },
  { slug: 'nightlife', label: 'Nightlife' },
  { slug: 'nature', label: 'Nature' },
  { slug: 'wine', label: 'Wine' },
  { slug: 'kids', label: 'For kids' },
  { slug: 'history', label: 'History' },
];

@Controller('meta')
export class MetaController {
  @Get('categories')
  getCategories(@Query('locale') locale?: string) {
    return locale === 'en' ? CATEGORIES_EN : CATEGORIES_RU;
  }
}
