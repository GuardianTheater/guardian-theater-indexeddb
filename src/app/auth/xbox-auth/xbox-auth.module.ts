import { NgModule, InjectionToken } from '@angular/core'
import { CommonModule } from '@angular/common'
import { OAuthModule, OAuthService } from 'angular-oauth2-oidc'
import { HTTP_INTERCEPTORS } from '@angular/common/http'
import { XboxAuthInterceptor } from './xbox-auth.interceptor'
import { XboxOAuthStorage } from './xbox-auth.storage'

export const OAuthXboxService = new InjectionToken('xbox service')

@NgModule({
  declarations: [],
  imports: [CommonModule, OAuthModule.forRoot()],
  providers: [
    XboxOAuthStorage,
    {
      provide: OAuthXboxService,
      useClass: OAuthService,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: XboxAuthInterceptor,
      multi: true,
    },
  ],
})
export class XboxAuthModule {}
