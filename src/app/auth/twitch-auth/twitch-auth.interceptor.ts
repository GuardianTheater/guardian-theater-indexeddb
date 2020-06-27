import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { TwitchOAuthStorage } from './twitch-auth.storage';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TwitchAuthInterceptor implements HttpInterceptor {
  constructor(private authStorage: TwitchOAuthStorage) {}

  private checkUrl(url: string): boolean {
    const allowedUrls = ['https://www.twitch.tv', 'https://api.twitch.tv'];
    const found = allowedUrls.find((u) => url.startsWith(u));
    return !!found;
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = req.url.toLowerCase();

    if (!this.checkUrl(url)) {
      return next.handle(req);
    }

    let headers = req.headers.set('Client-ID', 'o8cuwhl23x5ways7456xhitdm0f4th0');

    if (this.authStorage.getItem('access_token')) {
      headers = headers.set('Authorization', `Bearer ${this.authStorage.getItem('access_token')}`);
    }

    req = req.clone({ headers });

    return next.handle(req);
  }
}
