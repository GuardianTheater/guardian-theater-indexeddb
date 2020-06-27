import { Component, OnInit } from '@angular/core';
import { BungieAuthService } from './auth/bungie-auth/bungie-auth.service';
import { TwitchAuthService } from './auth/twitch-auth/twitch-auth.service';
import { HttpClient } from '@angular/common/http';
import { getMembershipDataForCurrentUser } from 'bungie-api-ts/user';
import { BehaviorSubject, Observable } from 'rxjs';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { DestinyPostGameCarnageReportData } from 'bungie-api-ts/destiny2';
import { debounceTime } from 'rxjs/operators';
import { StateService } from './state/state.service';
import { TwitchVideo } from './queue/twitch-queue.service';

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

  constructor(
    private authBungie: BungieAuthService,
    private authTwitch: TwitchAuthService,
    private http: HttpClient,
    private dbService: NgxIndexedDBService,
    private state: StateService
  ) {}

  ngOnInit() {
    this.instanceSet = new Set();
    this.state.instancesWithClips$.subscribe((instances: DestinyPostGameCarnageReportData[]) => {
      for (const instance of instances) {
        for (const entry of instance.entries) {
          (entry as any).twitchClips.subscribe((clips: TwitchVideo[]) => {
            if (clips.length) {
              this.instanceSet.add(instance);
              this.instances = Array.from(this.instanceSet);
            }
          });
        }
      }
    });
    // this.state.instancesWithClips$.pipe().subscribe((instances) => {
    //   for (const instance of instances) {
    //     for (const entry of instance.entries) {
    //       entry.twitchClips.subscribe((res) => console.log(entry, res));
    //     }
    //   }
    // });
    // this.loadPgcrs();
  }

  async loadPgcrs() {
    this.dbService.getAll('pgcrs').then((pgcrs: { instanceId: string; period: string; response: DestinyPostGameCarnageReportData }[]) => {
      this.pgcrs$.next(pgcrs.sort((a, b) => parseInt(b.instanceId, 0) - parseInt(a.instanceId, 0)));
      for (const pgcr of pgcrs) {
        for (const entry of pgcr.response.entries) {
          this.dbService.getByKey('twitchAccounts', entry.player.destinyUserInfo.membershipId).then((res) => {
            for (const account of res?.accounts) {
              this.dbService.getByKey('twitchVideos', account?.id).then((r) => console.log(r));
            }
          });
        }
      }
    });
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
