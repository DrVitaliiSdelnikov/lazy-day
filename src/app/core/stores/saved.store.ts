import { Injectable, signal, computed } from '@angular/core';
import { RecommendationCard } from '../models';

const STORAGE_KEY = 'ld_saved';

interface SavedItem {
  id: string;
  type: string;
  title: string;
  category: string;
  categoryLabel?: string;
  priceLabel?: string;
  address?: string;
  savedAt: string;
}

function loadSaved(): SavedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class SavedStore {
  private items = signal<SavedItem[]>(loadSaved());

  readonly all = computed(() => this.items());
  readonly count = computed(() => this.items().length);
  readonly ids = computed(() => this.items().map((i) => i.id));

  isSaved(id: string): boolean {
    return this.items().some((i) => i.id === id);
  }

  toggle(card: RecommendationCard) {
    if (this.isSaved(card.id)) {
      this.items.update((items) => items.filter((i) => i.id !== card.id));
    } else {
      const snapshot: SavedItem = {
        id: card.id,
        type: card.type,
        title: card.title,
        category: card.category,
        categoryLabel: card.categoryLabel,
        priceLabel: card.priceLabel,
        address: card.address,
        savedAt: new Date().toISOString(),
      };
      this.items.update((items) => [snapshot, ...items]);
    }
    this.persist();
  }

  remove(id: string) {
    this.items.update((items) => items.filter((i) => i.id !== id));
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items()));
    } catch {
      // silent
    }
  }
}
