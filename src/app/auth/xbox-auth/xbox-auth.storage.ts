import { OAuthStorage } from 'angular-oauth2-oidc'
import { Injectable } from '@angular/core'

@Injectable()
export class XboxOAuthStorage extends OAuthStorage {
  getItem(key: string) {
    return localStorage.getItem(`xbox-${key}`)
  }
  removeItem(key: string) {
    return localStorage.removeItem(`xbox-${key}`)
  }
  setItem(key: string, value: string) {
    return localStorage.setItem(`xbox-${key}`, value)
  }
}
