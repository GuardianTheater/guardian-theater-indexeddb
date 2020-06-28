import { Component, OnInit } from '@angular/core';
import { BungieAuthService } from './auth/bungie-auth/bungie-auth.service';
import { TwitchAuthService } from './auth/twitch-auth/twitch-auth.service';
import { HttpClient } from '@angular/common/http';
import { getMembershipDataForCurrentUser } from 'bungie-api-ts/user';
import { BehaviorSubject, Observable } from 'rxjs';
import { DestinyPostGameCarnageReportData } from 'bungie-api-ts/destiny2';
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
    private state: StateService
  ) {}

  ngOnInit() {
    this.instanceSet = new Set();
    this.state.instancesWithClips$?.subscribe((instances: DestinyPostGameCarnageReportData[]) => {
      for (const instance of instances) {
        if (instance?.entries) {
          for (const entry of instance?.entries) {
            (entry as any).twitchClips.subscribe((clips: TwitchVideo[]) => {
              if (clips.length) {
                this.instanceSet.add(instance);
                this.instances = Array.from(this.instanceSet);
              }
            });
          }
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
