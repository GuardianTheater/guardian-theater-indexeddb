import { OAuthStorage } from 'angular-oauth2-oidc';
import { Injectable } from '@angular/core';

@Injectable()
export class TwitchOAuthStorage extends OAuthStorage {
  getItem(key: string) {
    return sessionStorage.getItem(`twitch-${key}`);
  }
  removeItem(key: string) {
    return sessionStorage.removeItem(`twitch-${key}`);
  }
  setItem(key: string, value: string) {
    return sessionStorage.setItem(`twitch-${key}`, value);
  }
}