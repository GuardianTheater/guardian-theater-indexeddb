import { Injectable, Inject } from '@angular/core'
import { OAuthService } from 'angular-oauth2-oidc'
import { JwksValidationHandler } from 'angular-oauth2-oidc-jwks'
import { OAuthXboxService } from './xbox-auth.module'
import { XboxOAuthStorage } from './xbox-auth.storage'
import { ActivatedRoute } from '@angular/router'
import { BehaviorSubject } from 'rxjs'
import { environment } from 'src/environments/environment'

@Injectable({
  providedIn: 'root',
})
export class XboxAuthService {
  hasValidIdToken$: BehaviorSubject<boolean> = new BehaviorSubject(false)

  constructor(@Inject(OAuthXboxService) private oAuthService: OAuthService, private route: ActivatedRoute) {
    this.oAuthService.setStorage(new XboxOAuthStorage())
    this.oAuthService.configure({
      issuer: 'https://login.microsoftonline.com/consumers/v2.0',
      loginUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
      tokenEndpoint: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      userinfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
      clientId: environment.xbox.clientId,
      redirectUri: environment.xbox.redirect,
      skipIssuerCheck: true,
      responseType: 'code',
      scope: 'openid profile email Xboxlive.signin Xboxlive.offline_access',
      strictDiscoveryDocumentValidation: false,
    })
    this.oAuthService.tokenValidationHandler = new JwksValidationHandler()
    this.tryLogin()
  }

  async tryLogin() {
    await this.oAuthService.loadDiscoveryDocumentAndTryLogin()
    if (this.oAuthService.hasValidIdToken()) {
      this.oAuthService.setupAutomaticSilentRefresh()
      this.hasValidIdToken$.next(true)
    }
  }

  async login() {
    await this.oAuthService.createAndSaveNonce()
    this.oAuthService.initLoginFlow()
  }

  logout() {
    this.oAuthService.logOut()
  }
}
