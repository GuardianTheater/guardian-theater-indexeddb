import { OAuthStorage } from 'angular-oauth2-oidc';
import { Injectable } from '@angular/core';

@Injectable()
export class TwitchOAuthStorage extends OAuthStorage {
  getItem(key: string) {
    return localStorage.getItem(`twitch-${key}`);
  }
  removeItem(key: string) {
    return localStorage.removeItem(`twitch-${key}`);
  }
  setItem(key: string, value: string) {
    return localStorage.setItem(`twitch-${key}`, value);
  }
}
