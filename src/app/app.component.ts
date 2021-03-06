import { AfterViewInit, Component, OnInit } from '@angular/core'
import { BungieAuthService } from './auth/bungie-auth/bungie-auth.service'
import { TwitchAuthService } from './auth/twitch-auth/twitch-auth.service'
import { StateService } from './state/state.service'
import { TwitchQueueService } from './queue/twitch-queue.service'
import { BungieQueueService } from './queue/bungie-queue.service'
import { QueueCount, DestinyPostGameCarnageReportDataExtended, TwitchVideo, DestinyPostGameCarnageReportEntryExtended } from './types'
import { DestinyPlayer } from 'bungie-api-ts/destiny2'

declare var twttr: any
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'guardian-theater-indexeddb'
  instanceIdSet: Set<string>
  instances: DestinyPostGameCarnageReportDataExtended[]

  queueCount: {
    [queue: string]: {
      [action: string]: QueueCount
    }
  } = {}
  authState = {
    bungie: false,
    twitch: false,
  }

  constructor(
    private authBungie: BungieAuthService,
    private authTwitch: TwitchAuthService,
    public state: StateService,
    private twitchQueue: TwitchQueueService,
    private bungieQueue: BungieQueueService
  ) {}

  ngOnInit() {
    this.instanceIdSet = new Set()
    this.instances = []
    this.queueCount.twitch = this.twitchQueue.queueCount
    this.queueCount.bungie = this.bungieQueue.queueCount
    this.authBungie.hasValidAccessToken$.subscribe((res) => (this.authState.bungie = res))
    this.authTwitch.hasValidIdToken$.subscribe((res) => (this.authState.twitch = res))
    this.state.instancesWithClips$.subscribe((instances) => {
      for (const instance of instances) {
        if (!this.instanceIdSet.has(instance.activityDetails.instanceId)) {
          this.instanceIdSet.add(instance.activityDetails.instanceId)
          this.instances.push(instance)
          this.instances.sort((a, b) => parseInt(b.activityDetails.instanceId, 10) - parseInt(a.activityDetails.instanceId, 10))
        }
      }
    })
  }

  ngAfterViewInit(): void {
    twttr.widgets.load()
  }

  loginBungie() {
    this.authBungie.login()
  }

  loginTwitch() {
    this.authTwitch.login()
  }

  logoutBungie() {
    this.authBungie.logout()
    this.authState.bungie = false
  }

  logoutTwitch() {
    this.authTwitch.logout()
    this.authState.twitch = false
  }

  loadVideo(video: TwitchVideo, instance: DestinyPostGameCarnageReportDataExtended) {
    this.instances.forEach((inst) => (inst.watching = false))
    instance.watching = true
    video.play = true
  }

  refresh() {
    location.reload()
  }

  reset() {
    localStorage.clear()
    sessionStorage.clear()
    indexedDB.deleteDatabase('GtDb')
    indexedDB.deleteDatabase('keyval-store')
    location.reload()
  }

  linkToBungieProfile(player: DestinyPlayer) {
    window.open(
      `https://www.bungie.net/en/Profile/${player.destinyUserInfo.membershipType}/${player.destinyUserInfo.membershipId}/`,
      '_blank'
    )
  }

  linkToBungieActivity(instance: DestinyPostGameCarnageReportDataExtended, entry: DestinyPostGameCarnageReportEntryExtended) {
    window.open(`https://www.bungie.net/en/PGCR/${instance.activityDetails.instanceId}?character=${entry.characterId}`, '_blank')
  }

  linkToTwitchProfile(video: TwitchVideo) {
    window.open(`https://www.twitch.tv/${video.user_name}`)
  }

  linkToTwitchVideo(video: TwitchVideo) {
    window.open(`${video.url}?t=${video.offset}`, '_blank')
  }
}
