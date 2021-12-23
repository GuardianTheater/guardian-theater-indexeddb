import { Injectable } from '@angular/core'
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http'
import { XboxOAuthStorage } from './xbox-auth.storage'
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root',
})
export class XboxAuthInterceptor implements HttpInterceptor {
  constructor(private authStorage: XboxOAuthStorage) {}

  private checkUrl(url: string): boolean {
    const allowedUrls = [
      'https://gameclipsmetadata.xboxlive.com',
      'https://profile.xboxlive.com',
      'https://xapi.dustinrue.com',
      'http://localhost:3000',
    ]
    const found = allowedUrls.find((u) => url.startsWith(u))
    return !!found
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = req.url.toLowerCase()

    if (!this.checkUrl(url)) {
      return next.handle(req)
    }

    let headers = req.headers

    if (this.authStorage.getItem('xbl3Token')) {
      headers = headers.set('Authorization', `${this.authStorage.getItem('xbl3Token')}`)
    }

    req = req.clone({ headers })

    return next.handle(req)
  }
}
