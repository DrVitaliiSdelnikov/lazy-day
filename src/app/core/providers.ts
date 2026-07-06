import { Provider } from '@angular/core';
import { ApiService } from './services/api.service';
import { MockApiService } from './services/mock-api.service';

export const apiProviders: Provider[] = [
  { provide: ApiService, useClass: MockApiService },
];
