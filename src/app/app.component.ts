import { AfterViewInit, Component, OnInit } from '@angular/core'
import { BungieAuthService } from './auth/bungie-auth/bungie-auth.service'
import { TwitchAuthService } from './auth/twitch-auth/twitch-auth.service'
import { XboxAuthService } from './auth/xbox-auth/xbox-auth.service'
import { StateService } from './state/state.service'
import { TwitchQueueService } from './queue/twitch-queue.service'
import { XboxQueueService } from './queue/xbox-queue.service'
import { BungieQueueService } from './queue/bungie-queue.service'
import {
  QueueCount,
  DestinyPostGameCarnageReportDataExtended,
  TwitchVideo,
  DestinyPostGameCarnageReportEntryExtended,
  XboxVideo,
} from './types'
import { DestinyPlayer } from 'bungie-api-ts/destiny2'
import { combineLatest } from 'rxjs'
import { switchMap, map } from 'rxjs/operators'

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
  clipCount = 0
  hiddenVids = new Set<string>()
  hiddenNames = {}

  queueCount: {
    [queue: string]: {
      [action: string]: QueueCount
    }
  } = {}
  authState = {
    bungie: false,
    twitch: false,
    xbox: false,
  }

  constructor(
    private authBungie: BungieAuthService,
    private authTwitch: TwitchAuthService,
    private authXbox: XboxAuthService,
    public state: StateService,
    private twitchQueue: TwitchQueueService,
    private xboxQueue: XboxQueueService,
    private bungieQueue: BungieQueueService
  ) {}

  ngOnInit() {
    this.instanceIdSet = new Set()
    this.instances = []
    this.queueCount.twitch = this.twitchQueue.queueCount
    this.queueCount.xbox = this.xboxQueue.queueCount
    this.queueCount.bungie = this.bungieQueue.queueCount
    this.authBungie.hasValidAccessToken$.subscribe((res) => (this.authState.bungie = res))
    this.authTwitch.hasValidIdToken$.subscribe((res) => (this.authState.twitch = res))
    this.authXbox.hasValidIdToken$.subscribe((res) => (this.authState.xbox = res))
    this.state.instancesWithVideos$
      .pipe(
        switchMap((instances) => {
          for (const instance of instances) {
            if (!this.instanceIdSet.has(instance.activityDetails.instanceId)) {
              this.instanceIdSet.add(instance.activityDetails.instanceId)
              this.instances.push(instance)
              this.instances.sort((a, b) => parseInt(b.activityDetails.instanceId, 10) - parseInt(a.activityDetails.instanceId, 10))
            }
          }
          return combineLatest([...instances.map((i) => i.twitchVideos), ...instances.map((i) => i.xboxVideos)])
        }),
        map((videos) => (this.clipCount = videos.reduce((acc, cur) => acc + cur.length, 0)))
      )
      .subscribe()
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

  loginXbox() {
    this.authXbox.login()
  }

  logoutBungie() {
    this.authBungie.logout()
    this.authState.bungie = false
  }

  logoutTwitch() {
    this.authTwitch.logout()
    this.authState.twitch = false
  }

  logoutXbox() {
    this.authXbox.logout()
    this.authState.xbox = false
  }

  loadVideo(video: TwitchVideo | XboxVideo, instance: DestinyPostGameCarnageReportDataExtended) {
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

  hideVideos(entry: DestinyPostGameCarnageReportEntryExtended, video: TwitchVideo | XboxVideo) {
    if ((video as TwitchVideo).user_id) {
      this.hiddenNames[entry.player.destinyUserInfo.membershipId + (video as TwitchVideo).user_id] = (video as TwitchVideo).user_name
      this.hiddenVids.add(entry.player.destinyUserInfo.membershipId + (video as TwitchVideo).user_id)
    }
    if ((video as XboxVideo).xuid) {
      this.hiddenNames[entry.player.destinyUserInfo.membershipId + (video as XboxVideo).xuid] = entry.player.destinyUserInfo.displayName
      this.hiddenVids.add(entry.player.destinyUserInfo.membershipId + (video as XboxVideo).xuid)
    }
  }

  showVideos(id: string) {
    this.hiddenVids.delete(id)
  }
}
