import { Injectable, Inject } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BungieOAuthStorage } from './bungie-auth.storage';

@Injectable({
  providedIn: 'root',
})
export class BungieAuthInterceptor implements HttpInterceptor {
  constructor(private authStorage: BungieOAuthStorage) {}

  private checkUrl(url: string): boolean {
    const allowedUrls = ['https://www.bungie.net', 'https://stats.bungie.net'];
    const found = allowedUrls.find((u) => url.startsWith(u));
    return !!found;
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = req.url.toLowerCase();

    if (!this.checkUrl(url)) {
      return next.handle(req);
    }
    let headers = req.headers;
    if (url.indexOf('common/destiny2_content') > 0) {
    } else {
      headers = headers.set('X-API-Key', '9b0fbe5ec42d4121b9e255528f9ad2d9');
      if (url === 'https://www.bungie.net/platform/app/oauth/token/' || url.indexOf('getmembershipsbyid') > 0) {
      } else {
        if (this.authStorage.getItem('access_token')) {
          headers = headers.set('Authorization', `Bearer ${this.authStorage.getItem('access_token')}`);
        }
      }
    }

    req = req.clone({ headers });

    return next.handle(req);
  }
}
