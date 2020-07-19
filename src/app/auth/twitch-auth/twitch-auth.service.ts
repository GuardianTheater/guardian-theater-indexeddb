import { Injectable, Inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { JwksValidationHandler } from 'angular-oauth2-oidc-jwks';
import { OAuthTwitchService } from './twitch-auth.module';
import { TwitchOAuthStorage } from './twitch-auth.storage';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TwitchAuthService {
  hasValidIdToken$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(@Inject(OAuthTwitchService) private oAuthService: OAuthService, private route: ActivatedRoute) {
    this.oAuthService.setStorage(new TwitchOAuthStorage());
    this.oAuthService.configure({
      issuer: 'https://id.twitch.tv/oauth2',
      loginUrl: 'https://id.twitch.tv/oauth2/authorize',
      tokenEndpoint: 'https://id.twitch.tv/oauth2/token',
      clientId: environment.twitch.clientId,
      redirectUri: environment.twitch.redirect,
      responseType: 'token id_token',
      scope: 'openid',
    });
    this.oAuthService.tokenValidationHandler = new JwksValidationHandler();
    this.tryLogin();
  }

  async tryLogin() {
    await this.oAuthService.loadDiscoveryDocumentAndTryLogin();
    if (this.oAuthService.hasValidIdToken()) {
      this.oAuthService.setupAutomaticSilentRefresh();
      this.hasValidIdToken$.next(true);
    }
  }

  async login() {
    await this.oAuthService.createAndSaveNonce();
    this.oAuthService.initLoginFlow();
  }

  logout() {
    this.oAuthService.logOut();
  }
}
