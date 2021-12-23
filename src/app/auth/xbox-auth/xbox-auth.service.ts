import { Injectable, Inject } from '@angular/core'
import { OAuthService } from 'angular-oauth2-oidc'
import { OAuthXboxService } from './xbox-auth.module'
import { XboxOAuthStorage } from './xbox-auth.storage'
import { ActivatedRoute } from '@angular/router'
import { BehaviorSubject } from 'rxjs'
import { distinctUntilChanged } from 'rxjs/operators'

@Injectable({
  providedIn: 'root',
})
export class XboxAuthService {
  hasValidIdToken$: BehaviorSubject<boolean> = new BehaviorSubject(false)

  constructor(
    @Inject(OAuthXboxService) private oAuthService: OAuthService,
    private route: ActivatedRoute,
    private authStorage: XboxOAuthStorage
  ) {
    this.tryLogin()
  }

  async tryLogin() {
    this.route.queryParams.pipe(distinctUntilChanged()).subscribe(async (url) => {
      if (url.xbl3Token && url.notAfter) {
        this.authStorage.setItem('xbl3Token', url.xbl3Token)
        this.authStorage.setItem('notAfter', url.notAfter)
      }
      const xbl3Token = this.authStorage.getItem('xbl3Token')
      const notAfter = this.authStorage.getItem('notAfter')
      if (xbl3Token && notAfter) {
        const now = new Date()
        const notAfterDate = new Date(notAfter)
        if (now < notAfterDate) {
          this.hasValidIdToken$.next(true)
        } else {
          this.logout()
        }
      }
    })
  }

  async login() {
    window.location.href = 'https://xapi.dustinrue.com/login'
  }

  logout() {
    this.authStorage.removeItem('xbl3Token')
    this.authStorage.removeItem('notAfter')
  }
}
