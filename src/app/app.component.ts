import { Component, OnInit } from '@angular/core';
import { BungieAuthService } from './auth/bungie-auth/bungie-auth.service';
import { TwitchAuthService } from './auth/twitch-auth/twitch-auth.service';
import { HttpClient } from '@angular/common/http';
import { getMembershipDataForCurrentUser } from 'bungie-api-ts/user';
import { BehaviorSubject, Observable } from 'rxjs';
import { DestinyPostGameCarnageReportData } from 'bungie-api-ts/destiny2';
import { StateService } from './state/state.service';
import { TwitchVideo, TwitchQueueService } from './queue/twitch-queue.service';
import { BungieQueueService } from './queue/bungie-queue.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'guardian-theater-indexeddb';
  pgcrs$ = new BehaviorSubject<{ instanceId: string; period: string; response: DestinyPostGameCarnageReportData }[]>([]);
  instancesWithClips$: Observable<any>;
  instanceSet: Set<DestinyPostGameCarnageReportData>;
  instances: DestinyPostGameCarnageReportData[];
  queueCount: {
    [queue: string]: {
      [action: string]: {
        queued: number;
        completed: number;
        errors: number;
      };
    };
  } = {};
  authState = {
    bungie: false,
    twitch: false,
  };

  constructor(
    private authBungie: BungieAuthService,
    private authTwitch: TwitchAuthService,
    private http: HttpClient,
    public state: StateService,
    private twitchQueue: TwitchQueueService,
    private bungieQueue: BungieQueueService
  ) {}

  ngOnInit() {
    this.instanceSet = new Set();
    this.queueCount.twitch = this.twitchQueue.queueCount;
    this.queueCount.bungie = this.bungieQueue.queueCount;
    this.authBungie.hasValidAccessToken$.subscribe((res) => (this.authState.bungie = res));
    this.authTwitch.hasValidIdToken$.subscribe((res) => (this.authState.twitch = res));
  }

  loginBungie() {
    this.authBungie.login();
  }

  async getProfile() {
    const res = await getMembershipDataForCurrentUser((config) => this.http.get(config.url).toPromise());
  }

  loginTwitch() {
    this.authTwitch.login();
  }

  logoutBungie() {
    this.authBungie.logout();
  }

  logoutTwitch() {
    this.authTwitch.logout();
  }
}
