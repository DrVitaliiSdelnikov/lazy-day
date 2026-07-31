import {
  Component, input, output, effect, ElementRef, viewChild, signal, AfterViewInit, OnDestroy,
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
  durationMin?: number;
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
    :host { display: block; height: 100%; }
    .map-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 180px;
      border-radius: 12px;
      overflow: hidden;
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
  markerTap = output<number>();

  fullscreen = signal(false);
  private mapContainer = viewChild<ElementRef>('mapContainer');
  private map: Map | null = null;
  private markers: Marker[] = [];
  private segmentLabels: Marker[] = [];
  private mapReady = false;
  private svgOverlay: HTMLElement | null = null;

  constructor() {
    // Re-render when inputs change (must be in constructor for injection context)
    effect(() => {
      const pts = this.points();
      const lns = this.lines();
      if (this.mapReady) this.renderRoute();
    });

    // Resize on fullscreen toggle
    effect(() => {
      const fs = this.fullscreen();
      if (this.map) setTimeout(() => this.map?.resize(), 50);
    });
  }

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
        layers: [
          { id: 'osm', type: 'raster', source: 'osm' },
        ],
      },
      center: [44.8015, 41.6934],
      zoom: 13,
    });

    // Raster-only style: 'load' may not fire. Use 'idle' + timeout.
    const onReady = () => {
      if (this.mapReady) return;
      this.mapReady = true;
      this.renderRoute();
    };
    this.map.on('load', onReady);
    this.map.once('idle', onReady);
    setTimeout(() => { if (!this.mapReady) onReady(); }, 1500);

    // Redraw SVG lines on map move/zoom
    this.map.on('move', () => this.drawSvgLines());
    this.map.on('zoom', () => this.drawSvgLines());
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

      el.addEventListener('click', () => this.markerTap.emit(pt.index));

      const marker = new Marker({ element: el })
        .setLngLat([pt.lng, pt.lat])
        .setPopup(new Popup({ offset: 20 }).setText(pt.name))
        .addTo(this.map!);

      this.markers.push(marker);
      bounds.extend([pt.lng, pt.lat]);
    }

    // Lines drawn via SVG overlay (raster-only style doesn't support GeoJSON layers)
    this.drawSvgLines();

    // Segment time labels
    this.segmentLabels.forEach(m => m.remove());
    this.segmentLabels = [];
    for (const ln of lns) {
      if (ln.durationMin) {
        const midLng = (ln.from[0] + ln.to[0]) / 2;
        const midLat = (ln.from[1] + ln.to[1]) / 2;
        const label = document.createElement('div');
        const icon = ln.type === 'taxi' ? '🚕' : '🚶';
        label.textContent = `${icon} ${ln.durationMin} мин`;
        label.style.cssText = `
          font-size:10px; font-weight:600; color:#555; background:rgba(255,255,255,0.9);
          padding:2px 6px; border-radius:8px; white-space:nowrap; font-family:inherit;
          box-shadow:0 1px 3px rgba(0,0,0,0.15); pointer-events:none;
        `;
        const m = new Marker({ element: label, anchor: 'center' })
          .setLngLat([midLng, midLat])
          .addTo(this.map!);
        this.segmentLabels.push(m);
      }
    }

    // Fit bounds
    this.map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
  }

  private drawSvgLines() {
    if (!this.map) return;
    const lns = this.lines();
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    // Remove old SVG
    if (this.svgOverlay) { this.svgOverlay.remove(); this.svgOverlay = null; }
    if (lns.length === 0) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;';

    for (const ln of lns) {
      const from = this.map.project(ln.from as [number, number]);
      const to = this.map.project(ln.to as [number, number]);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(from.x));
      line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
      line.setAttribute('stroke', ln.type === 'taxi' ? '#e67e22' : '#4a7c59');
      line.setAttribute('stroke-width', '4');
      line.setAttribute('stroke-linecap', 'round');
      if (ln.type === 'taxi') line.setAttribute('stroke-dasharray', '8,6');
      svg.appendChild(line);
    }

    // Append to map canvas container
    const canvasContainer = container.querySelector('.maplibregl-canvas-container');
    if (canvasContainer) {
      canvasContainer.appendChild(svg);
    } else {
      container.appendChild(svg);
    }
    this.svgOverlay = svg as unknown as HTMLElement;
  }

  scrollToPoint(index: number) {
    const pt = this.points()[index];
    if (pt && this.map) {
      this.map.flyTo({ center: [pt.lng, pt.lat], zoom: 16 });
      this.markers[index]?.togglePopup();
    }
  }
}
