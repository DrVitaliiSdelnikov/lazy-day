import { Provider } from '@angular/core';
import { ApiService } from './services/api.service';
import { MockApiService } from './services/mock-api.service';
import { HttpApiService } from './services/http-api.service';

const USE_REAL_API = true; // flip to false to use mock data

export const apiProviders: Provider[] = [
  { provide: ApiService, useClass: USE_REAL_API ? HttpApiService : MockApiService },
];
