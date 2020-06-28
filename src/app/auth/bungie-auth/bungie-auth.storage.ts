import { OAuthStorage } from 'angular-oauth2-oidc';
import { Injectable } from '@angular/core';

@Injectable()
export class BungieOAuthStorage extends OAuthStorage {
  getItem(key: string) {
    return sessionStorage.getItem(`bungie-${key}`);
  }
  removeItem(key: string) {
    return sessionStorage.removeItem(`bungie-${key}`);
  }
  setItem(key: string, value: string) {
    return sessionStorage.setItem(`bungie-${key}`, value);
  }
}
