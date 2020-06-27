import { NgModule, InjectionToken } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OAuthModule, OAuthService } from 'angular-oauth2-oidc';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { TwitchAuthInterceptor } from './twitch-auth.interceptor';
import { TwitchOAuthStorage } from './twitch-auth.storage';

export const OAuthTwitchService = new InjectionToken('twitch service');

@NgModule({
  declarations: [],
  imports: [CommonModule, OAuthModule.forRoot()],
  providers: [
    TwitchOAuthStorage,
    {
      provide: OAuthTwitchService,
      useClass: OAuthService,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TwitchAuthInterceptor,
      multi: true,
    },
  ],
})
export class TwitchAuthModule {}
