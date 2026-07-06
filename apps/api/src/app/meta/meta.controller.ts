import { Controller, Get, Query } from '@nestjs/common';
import type { CategoryNode } from '@lazy-day/shared-models';

const CATEGORIES: CategoryNode[] = [
  {
    slug: 'food',
    label: 'food',
    children: [
      { slug: 'restaurant', label: 'restaurant' },
      { slug: 'cafe', label: 'cafe' },
      { slug: 'bar', label: 'bar' },
      { slug: 'bakery', label: 'bakery' },
    ],
  },
  {
    slug: 'culture',
    label: 'culture',
    children: [
      { slug: 'museum', label: 'museum' },
      { slug: 'gallery', label: 'gallery' },
      { slug: 'theater', label: 'theater' },
    ],
  },
  {
    slug: 'entertainment',
    label: 'entertainment',
    children: [
      { slug: 'concert', label: 'concert' },
      { slug: 'cinema', label: 'cinema' },
      { slug: 'club', label: 'club' },
    ],
  },
  {
    slug: 'outdoor',
    label: 'outdoor',
    children: [
      { slug: 'park', label: 'park' },
      { slug: 'hiking', label: 'hiking' },
      { slug: 'viewpoint', label: 'viewpoint' },
    ],
  },
  {
    slug: 'shopping',
    label: 'shopping',
    children: [
      { slug: 'market', label: 'market' },
      { slug: 'mall', label: 'mall' },
    ],
  },
  {
    slug: 'wellness',
    label: 'wellness',
    children: [
      { slug: 'spa', label: 'spa' },
      { slug: 'bath', label: 'bath' },
      { slug: 'gym', label: 'gym' },
    ],
  },
];

@Controller('meta')
export class MetaController {
  @Get('categories')
  getCategories(@Query('locale') locale?: string) {
    // TODO: localize labels based on locale
    return CATEGORIES;
  }
}
