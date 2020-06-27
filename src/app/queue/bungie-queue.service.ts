import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { take, debounceTime, withLatestFrom } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { UserMembershipData, getMembershipDataForCurrentUser, ServerResponse, BungieMembershipType } from 'bungie-api-ts/user';
import {
  getProfile,
  DestinyProfileResponse,
  GetProfileParams,
  DestinyComponentType,
  DestinyCharacterComponent,
  getActivityHistory,
  DestinyActivityHistoryResults,
  GetActivityHistoryParams,
  DestinyActivityModeType,
  getPostGameCarnageReport,
  DestinyPostGameCarnageReportData,
  getLinkedProfiles,
  GetPostGameCarnageReportParams,
  DestinyLinkedProfilesResponse,
  GetLinkedProfilesParams,
} from 'bungie-api-ts/destiny2';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { TwitchQueueService } from './twitch-queue.service';

@Injectable({
  providedIn: 'root',
})
export class BungieQueueService {
  queue$ = new BehaviorSubject<
    { action: (config: any, params: any) => Promise<ServerResponse<any>>; behaviorSubject: BehaviorSubject<any>; params: {} }[]
  >([]);

  constructor(private http: HttpClient, private dbService: NgxIndexedDBService, private twitchQueue: TwitchQueueService) {
    this.queue$.pipe(debounceTime(100)).subscribe((queue) => {
      if (queue.length) {
        const nextAction = queue.shift();
        this.queue$.next(queue);
        nextAction
          .action(
            (config: { url: string; method: 'GET' | 'POST'; params: any; body: any }) =>
              this.http
                .request(config.method, config.url, {
                  params: config.params,
                  body: config.body,
                })
                .toPromise(),
            nextAction.params
          )
          .then((res) => nextAction.behaviorSubject.next(res))
          .catch((e) => nextAction.behaviorSubject.next(e));
      }
    });
  }

  addToQueue(action: (http: any, params?: any) => any, behaviorSubject: BehaviorSubject<any>, params?: {}) {
    this.queue$.pipe(take(1)).subscribe((queue) => this.queue$.next([...queue, { action, behaviorSubject, params }]));
  }
}
