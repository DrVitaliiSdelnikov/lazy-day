import {
  Component, input, effect, ElementRef, viewChild, signal, AfterViewInit, OnDestroy,
} from '@angular/core';
import { Map, Marker, LngLatBounds, Popup } from 'maplibre-gl';

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  index: number;
}

export interface MapLine {
  from: [number, number]; // [lng, lat]
  to: [number, number];
  type: 'walk' | 'taxi';
}

@Component({
  selector: 'app-route-map',
  standalone: true,
  template: `
    <div class="map-wrap" [class.map-wrap--fullscreen]="fullscreen()">
      <div #mapContainer class="map-container"></div>
      <button class="map-toggle" (click)="fullscreen.set(!fullscreen())">
        {{ fullscreen() ? '✕' : '⛶' }}
      </button>
    </div>
  `,
  styles: `
    .map-wrap {
      position: relative;
      width: 100%;
      height: 220px;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
      transition: height 0.3s ease;
    }
    .map-wrap--fullscreen {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      height: 100vh;
      border-radius: 0;
      z-index: 1000;
      margin: 0;
    }
    .map-container { width: 100%; height: 100%; }
    .map-toggle {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      background: var(--ld-surface, #fff);
      border: 1px solid var(--ld-border, #ddd);
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }
  `,
})
export class RouteMapComponent implements AfterViewInit, OnDestroy {
  points = input<MapPoint[]>([]);
  lines = input<MapLine[]>([]);

  fullscreen = signal(false);
  private mapContainer = viewChild<ElementRef>('mapContainer');
  private map: Map | null = null;
  private markers: Marker[] = [];

  ngAfterViewInit() {
    const el = this.mapContainer()?.nativeElement;
    if (!el) return;

    this.map = new Map({
      container: el,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap',
          },
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm',
        }],
      },
      center: [44.8015, 41.6934], // Tbilisi default
      zoom: 13,
    });

    this.map.on('load', () => this.renderRoute());

    // Re-render when inputs change
    effect(() => {
      const pts = this.points();
      const lns = this.lines();
      if (this.map?.loaded()) this.renderRoute();
    });

    // Resize on fullscreen toggle
    effect(() => {
      const fs = this.fullscreen();
      setTimeout(() => this.map?.resize(), 50);
    });
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private renderRoute() {
    if (!this.map) return;
    const pts = this.points();
    const lns = this.lines();

    // Clear old markers
    this.markers.forEach(m => m.remove());
    this.markers = [];

    // Remove old lines
    if (this.map.getSource('route-lines')) {
      this.map.removeLayer('route-walk');
      this.map.removeLayer('route-taxi');
      this.map.removeSource('route-lines');
    }

    if (pts.length === 0) return;

    // Add markers
    const bounds = new LngLatBounds();
    for (const pt of pts) {
      const el = document.createElement('div');
      el.className = 'route-marker';
      el.textContent = String(pt.index + 1);
      el.style.cssText = `
        width:28px; height:28px; border-radius:50%;
        background:var(--ld-primary, #4a7c59); color:#fff;
        display:flex; align-items:center; justify-content:center;
        font-weight:700; font-size:13px; font-family:inherit;
        border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,.3);
      `;

      const marker = new Marker({ element: el })
        .setLngLat([pt.lng, pt.lat])
        .setPopup(new Popup({ offset: 20 }).setText(pt.name))
        .addTo(this.map!);

      this.markers.push(marker);
      bounds.extend([pt.lng, pt.lat]);
    }

    // Add lines
    if (lns.length > 0) {
      const walkCoords: [number, number][][] = [];
      const taxiCoords: [number, number][][] = [];

      for (const ln of lns) {
        const segment: [number, number][] = [ln.from, ln.to];
        if (ln.type === 'taxi') taxiCoords.push(segment);
        else walkCoords.push(segment);
      }

      const features: any[] = [];
      for (const seg of walkCoords) {
        features.push({ type: 'Feature', properties: { type: 'walk' }, geometry: { type: 'LineString', coordinates: seg } });
      }
      for (const seg of taxiCoords) {
        features.push({ type: 'Feature', properties: { type: 'taxi' }, geometry: { type: 'LineString', coordinates: seg } });
      }

      this.map.addSource('route-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });

      this.map.addLayer({
        id: 'route-walk',
        type: 'line',
        source: 'route-lines',
        filter: ['==', ['get', 'type'], 'walk'],
        paint: {
          'line-color': '#4a7c59',
          'line-width': 3,
          'line-opacity': 0.8,
        },
      });

      this.map.addLayer({
        id: 'route-taxi',
        type: 'line',
        source: 'route-lines',
        filter: ['==', ['get', 'type'], 'taxi'],
        paint: {
          'line-color': '#e67e22',
          'line-width': 3,
          'line-dasharray': [4, 4],
          'line-opacity': 0.8,
        },
      });
    }

    // Fit bounds
    this.map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
  }

  scrollToPoint(index: number) {
    const pt = this.points()[index];
    if (pt && this.map) {
      this.map.flyTo({ center: [pt.lng, pt.lat], zoom: 16 });
      this.markers[index]?.togglePopup();
    }
  }
}
