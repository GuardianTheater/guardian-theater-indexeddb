import { Injectable, Inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { JwksValidationHandler } from 'angular-oauth2-oidc-jwks';
import { OAuthBungieService } from './bungie-auth.module';
import { BungieOAuthStorage } from './bungie-auth.storage';
import { DOCUMENT } from '@angular/common';
import { BungieQueueService } from 'src/app/queue/bungie-queue.service';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BungieAuthService {
  hasValidAccessToken$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(@Inject(DOCUMENT) private document: Document, @Inject(OAuthBungieService) private oAuthService: OAuthService) {
    this.oAuthService.setStorage(new BungieOAuthStorage());
    this.oAuthService.configure({
      issuer: 'https://www.bungie.net/en/OAuth/Authorize',
      loginUrl: 'https://www.bungie.net/en/OAuth/Authorize',
      tokenEndpoint: 'https://www.bungie.net/Platform/App/OAuth/token/',
      redirectUri: 'https://localhost:4200',
      clientId: '24112',
      dummyClientSecret: 'LcobvJFpRLQA3L6hLnLssCWFlMCj-HlK7XM51WnqQ0M',
      responseType: 'code',
      scope: '',
    });
    this.oAuthService.tokenValidationHandler = new JwksValidationHandler();

    this.oAuthService.tryLoginCodeFlow({ disableOAuth2StateCheck: true }).then(() => {
      if (this.oAuthService.hasValidAccessToken()) {
        this.oAuthService.setupAutomaticSilentRefresh({ disableOAuth2StateCheck: true });
        this.hasValidAccessToken$.next(true);
      }
    });
  }

  async login() {
    await this.oAuthService.createAndSaveNonce();
    this.document.location.href = `https://www.bungie.net/en/OAuth/Authorize?response_type=code&client_id=${
      this.oAuthService.clientId
    }&state=${sessionStorage.getItem('bungie-nonce')}`;
  }

  logout() {
    this.oAuthService.logOut();
  }
}
