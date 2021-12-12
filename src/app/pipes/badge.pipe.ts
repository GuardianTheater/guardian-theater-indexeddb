import { Pipe, PipeTransform } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { StateService } from '../state/state.service'
import { DestinyPlayer } from 'bungie-api-ts/destiny2'

@Pipe({
  name: 'badge',
})
export class BadgePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer, private state: StateService) {}

  sponsors = new Set([
    '4611686018428421700',
    '4611686018428675156',
    '4611686018428939884',
    '4611686018429542374',
    '4611686018430279365',
    '4611686018431814094',
    '4611686018433587255',
    '4611686018433723819',
    '4611686018433857896',
    '4611686018436136301',
    '4611686018438951937',
    '4611686018439288866',
    '4611686018440031242',
    '4611686018443852891',
    '4611686018446208485',
    '4611686018450480197',
    '4611686018450642682',
    '4611686018458454589',
    '4611686018462155206',
    '4611686018465041447',
    '4611686018467183040',
    '4611686018467195277',
    '4611686018467242110',
    '4611686018467380134',
    '4611686018467471647',
    '4611686018467475302',
    '4611686018467475956',
    '4611686018467475956',
    '4611686018470981976',
    '4611686018475208326',
  ])

  transform(player: DestinyPlayer, type: string): any {
    switch (type) {
      case 'sponsor':
        if (this.sponsors.has(player.destinyUserInfo.membershipId)) {
          return true
        }
        return false
      default:
        return null
    }
  }
}
