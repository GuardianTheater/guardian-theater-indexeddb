import { Injectable } from '@angular/core';
import { BungieAuthService } from '../auth/bungie-auth/bungie-auth.service';
import { TwitchAuthService } from '../auth/twitch-auth/twitch-auth.service';
import { Observable, EMPTY, BehaviorSubject, combineLatest, of, from } from 'rxjs';
import { UserMembershipData, getMembershipDataForCurrentUser, ServerResponse } from 'bungie-api-ts/user';
import { switchMap, map, take, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BungieQueueService } from '../queue/bungie-queue.service';
import {
  DestinyProfileResponse,
  getProfile,
  GetProfileParams,
  DestinyComponentType,
  DestinyActivityHistoryResults,
  getActivityHistory,
  GetActivityHistoryParams,
  DestinyActivityModeType,
  DestinyPostGameCarnageReportData,
  getPostGameCarnageReport,
  GetPostGameCarnageReportParams,
  getLinkedProfiles,
  DestinyLinkedProfilesResponse,
  GetLinkedProfilesParams,
} from 'bungie-api-ts/destiny2';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { TwitchQueueService, TwitchAccount, TwitchVideo } from '../queue/twitch-queue.service';

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private bungieCurrentUser$: Observable<ServerResponse<UserMembershipData>>;
  private bungieProfiles$: Observable<BehaviorSubject<ServerResponse<DestinyProfileResponse>>[]>;
  private bungieActivityHistories$: Observable<Observable<BehaviorSubject<ServerResponse<DestinyActivityHistoryResults>>[]>[]>;

  private instanceIdSet = new Set();
  private instanceObs: {
    [membershipId: string]: Observable<DestinyPostGameCarnageReportData>;
  } = {};

  private membershipNamesSet = new Set();
  private membershipNamesObs: {
    [membershipId: string]: Observable<string[]>;
  } = {};

  private nameQueue$: BehaviorSubject<
    {
      membershipId: string;
      names: string[];
    }[]
  > = new BehaviorSubject([]);
  private twitchAccountsObs: {
    [membershipId: string]: BehaviorSubject<TwitchAccount[]>;
  } = {};
  private twitchVideosObs: {
    [twitchId: string]: BehaviorSubject<TwitchVideo[]>;
  } = {};

  // bungieCurrentUser: UserMembershipData;
  // bungieProfiles: {
  //   [key: string]: DestinyProfileResponse;
  // } = {};
  instances: DestinyPostGameCarnageReportData[] = [];
  instances$: BehaviorSubject<DestinyPostGameCarnageReportData[]> = new BehaviorSubject([]);
  instancesWithClips$: Observable<any>;

  // membershipNames: {
  //   [key: string]: BehaviorSubject<string[]>;
  // } = {};

  constructor(
    private bungieAuth: BungieAuthService,
    private bungieQueue: BungieQueueService,
    private twitchAuth: TwitchAuthService,
    private twitchQueue: TwitchQueueService,
    private dbService: NgxIndexedDBService
  ) {
    this.bungieCurrentUser$ = this.bungieAuth.hasValidAccessToken$.pipe(
      switchMap((valid) => {
        if (valid) {
          const action = getMembershipDataForCurrentUser;
          const behaviorSubject: BehaviorSubject<ServerResponse<UserMembershipData>> = new BehaviorSubject(undefined);
          this.bungieQueue.addToQueue(action, behaviorSubject);
          return behaviorSubject;
        } else {
          return EMPTY;
        }
      })
    );

    this.bungieProfiles$ = this.bungieCurrentUser$.pipe(
      switchMap((user) => {
        if (user?.Response) {
          // this.bungieCurrentUser = user.Response;
          const destinyProfileResponses: BehaviorSubject<ServerResponse<DestinyProfileResponse>>[] = [];

          // for (const profile of user?.Response?.destinyMemberships) {
          //   const action = getProfile;
          //   const behaviorSubject: BehaviorSubject<ServerResponse<DestinyProfileResponse>> = new BehaviorSubject(undefined);
          //   destinyProfileResponses.push(behaviorSubject);
          //   const { membershipId, membershipType } = profile;
          //   const params: GetProfileParams = {
          //     destinyMembershipId: membershipId,
          //     membershipType,
          //     components: [DestinyComponentType.Profiles, DestinyComponentType.Characters],
          //   };
          //   this.bungieQueue.addToQueue(action, behaviorSubject, params);
          // }
          const action = getProfile;
          const behaviorSubject: BehaviorSubject<ServerResponse<DestinyProfileResponse>> = new BehaviorSubject(undefined);
          destinyProfileResponses.push(behaviorSubject);
          const params: GetProfileParams = {
            destinyMembershipId: '4611686018438442802',
            membershipType: 1,
            components: [DestinyComponentType.Profiles, DestinyComponentType.Characters],
          };
          this.bungieQueue.addToQueue(action, behaviorSubject, params);
          return of(destinyProfileResponses);
        } else {
          return EMPTY;
        }
      })
    );

    this.bungieActivityHistories$ = this.bungieProfiles$.pipe(
      switchMap((profiles) => {
        if (profiles.length) {
          const activityHistories: Observable<BehaviorSubject<ServerResponse<DestinyActivityHistoryResults>>[]>[] = [];
          for (const profile$ of profiles) {
            const activityHistory$ = profile$.pipe(
              switchMap((profile) => {
                if (profile?.Response) {
                  // this.bungieProfiles[profile?.Response?.profile?.data?.userInfo?.membershipId] = profile?.Response;
                  const destinyActivityHistoryResults: BehaviorSubject<ServerResponse<DestinyActivityHistoryResults>>[] = [];

                  const characters = profile?.Response?.characters?.data;
                  for (const characterId in characters) {
                    if (characters[characterId]) {
                      const action = getActivityHistory;
                      const behaviorSubject: BehaviorSubject<ServerResponse<DestinyActivityHistoryResults>> = new BehaviorSubject(
                        undefined
                      );
                      destinyActivityHistoryResults.push(behaviorSubject);
                      const params: GetActivityHistoryParams = {
                        characterId,
                        count: 250,
                        destinyMembershipId: profile?.Response?.profile?.data?.userInfo?.membershipId,
                        membershipType: profile?.Response?.profile?.data?.userInfo?.membershipType,
                        mode: DestinyActivityModeType.None,
                        page: 0,
                      };
                      this.bungieQueue.addToQueue(action, behaviorSubject, params);
                    }
                  }
                  return of(destinyActivityHistoryResults);
                } else {
                  return EMPTY;
                }
              })
            );
            activityHistories.push(activityHistory$);
          }
          return of(activityHistories);
        } else {
          return EMPTY;
        }
      })
    );

    this.bungieActivityHistories$.subscribe((profiles) => {
      for (const profile of profiles) {
        profile?.subscribe((characters) => {
          for (const character of characters) {
            character?.subscribe((history) => {
              if (history?.Response?.activities) {
                for (const activity of history?.Response?.activities) {
                  const instanceId = activity?.activityDetails?.instanceId;
                  const period = new Date(activity?.period);
                  const offset = new Date(new Date().setDate(new Date().getDate() - 10));
                  if (!this.instanceIdSet.has(instanceId) && period > offset) {
                    this.instanceIdSet.add(instanceId);
                    this.instanceObs[instanceId] = from(this.dbService.getByKey('pgcrs', instanceId)).pipe(
                      switchMap((dbEntry: { instanceId: string; period: string; response: string }) => {
                        if (dbEntry?.response) {
                          return of(JSON.parse(dbEntry.response));
                        } else {
                          const action = getPostGameCarnageReport;
                          const behaviorSubject: BehaviorSubject<ServerResponse<DestinyPostGameCarnageReportData>> = new BehaviorSubject(
                            undefined
                          );
                          const params: GetPostGameCarnageReportParams = { activityId: instanceId };
                          this.bungieQueue.addToQueue(action, behaviorSubject, params);
                          return behaviorSubject.pipe(
                            map((res) => {
                              if (res?.Response?.activityDetails?.instanceId) {
                                this.dbService.update('pgcrs', {
                                  instanceId: res?.Response?.activityDetails?.instanceId,
                                  period: res?.Response?.period,
                                  response: JSON.stringify(res?.Response),
                                });
                                return res?.Response;
                              }
                            })
                          );
                        }
                      })
                    );
                    this.instanceObs[instanceId].subscribe((pgcr: DestinyPostGameCarnageReportData) => {
                      this.instances.push(pgcr);
                      this.instances$.next(this.instances);

                      if (pgcr?.entries?.length) {
                        for (const entry of pgcr?.entries) {
                          const membershipId = entry?.player?.destinyUserInfo?.membershipId;
                          from(this.dbService.getByKey('lastEncountered', membershipId))
                            .pipe(
                              take(1),
                              map((dbEntry: { membershipId: string; period: string }) => {
                                if (!dbEntry || !dbEntry.period || new Date(pgcr?.period) > new Date(dbEntry.period)) {
                                  dbEntry = {
                                    membershipId,
                                    period: new Date(pgcr?.period).toISOString(),
                                  };
                                  this.dbService.update('lastEncountered', dbEntry);
                                }
                              })
                            )
                            .subscribe();
                          if (!this.membershipNamesSet.has(membershipId)) {
                            this.membershipNamesSet.add(membershipId);
                            this.membershipNamesObs[membershipId] = from(this.dbService.getByKey('names', membershipId)).pipe(
                              switchMap((dbEntry: { membershipId: string; names: string[] }) => {
                                if (dbEntry?.names?.length) {
                                  if (dbEntry?.names.indexOf(entry?.player?.destinyUserInfo?.displayName) < 0) {
                                    dbEntry?.names.push(entry?.player?.destinyUserInfo?.displayName);
                                    this.dbService.update('names', {
                                      membershipId,
                                      names: dbEntry?.names,
                                    });
                                  }
                                  return of(dbEntry?.names);
                                } else if (membershipId && entry?.player?.destinyUserInfo?.membershipType) {
                                  const action = getLinkedProfiles;
                                  const behaviorSubject: BehaviorSubject<ServerResponse<
                                    DestinyLinkedProfilesResponse
                                  >> = new BehaviorSubject(undefined);
                                  const params: GetLinkedProfilesParams = {
                                    getAllMemberships: true,
                                    membershipId,
                                    membershipType: entry?.player?.destinyUserInfo?.membershipType,
                                  };
                                  this.bungieQueue.addToQueue(action, behaviorSubject, params);
                                  return behaviorSubject.pipe(
                                    map((res) => {
                                      if (res?.Response) {
                                        const nameSet = new Set();
                                        nameSet.add(res?.Response?.bnetMembership?.displayName);
                                        if (res?.Response?.profiles) {
                                          for (const prof of res?.Response?.profiles) {
                                            nameSet.add(prof?.displayName);
                                          }
                                        }
                                        if (res?.Response?.profilesWithErrors) {
                                          for (const prof of res?.Response?.profilesWithErrors) {
                                            nameSet.add(prof?.infoCard?.displayName);
                                          }
                                        }
                                        const names = Array.from(nameSet) as string[];
                                        this.dbService.update('names', {
                                          membershipId,
                                          names,
                                        });
                                        return names;
                                      } else {
                                        return [];
                                      }
                                    })
                                  );
                                } else {
                                  return [];
                                }
                              })
                            );
                            combineLatest([
                              this.membershipNamesObs[membershipId],
                              from(this.dbService.getByKey('twitchAccounts', membershipId)),
                            ]).subscribe(([names, twitchAccounts]: [string[], { membershipId: string; accounts: TwitchAccount[] }]) => {
                              // if (!this.membershipNames[membershipId]) {
                              //   this.membershipNames[membershipId] = new BehaviorSubject([]);
                              // }
                              // this.membershipNames[membershipId].next(names);
                              if (twitchAccounts?.accounts) {
                                this.twitchAccountsObs[membershipId].next(twitchAccounts.accounts);
                              }
                              this.nameQueue$.pipe(take(1)).subscribe((queue) =>
                                this.nameQueue$.next([
                                  ...queue,
                                  {
                                    membershipId,
                                    names,
                                  },
                                ])
                              );
                            });

                            if (!this.twitchAccountsObs[membershipId]) {
                              this.twitchAccountsObs[membershipId] = new BehaviorSubject([]);
                            }
                            this.twitchAccountsObs[membershipId]
                              .pipe(
                                map((accounts) => {
                                  for (const account of accounts) {
                                    if (account?.id) {
                                      combineLatest([
                                        from(this.dbService.getByKey('twitchVideos', account?.id)),
                                        from(this.dbService.getByKey('lastEncountered', membershipId)).pipe(distinctUntilChanged()),
                                      ])
                                        .pipe(
                                          take(1),
                                          map(
                                            ([dbEntry, lastEncountered]: [
                                              { videos: TwitchVideo[]; twitchId: string; updated: string },
                                              { membershipId: string; period: string }
                                            ]) => {
                                              if (!this.twitchVideosObs[account.id]) {
                                                this.twitchVideosObs[account.id] = new BehaviorSubject([]);
                                              }
                                              if (dbEntry?.videos?.length) {
                                                this.twitchVideosObs[account.id].next(dbEntry.videos);
                                              }
                                              const oneHourAgo = new Date(new Date().setHours(new Date().getHours() - 1));
                                              const oneDayAgo = new Date(new Date().setDate(new Date().getDate() - 1));
                                              if (
                                                !dbEntry ||
                                                !dbEntry.updated ||
                                                !lastEncountered ||
                                                !lastEncountered.period ||
                                                new Date(lastEncountered.period) > new Date(dbEntry.updated) ||
                                                (new Date(dbEntry.updated) > oneDayAgo && new Date(dbEntry.updated) < oneHourAgo)
                                              ) {
                                                const action = 'getVideos';
                                                const behaviorSubject = new BehaviorSubject(undefined);
                                                const payload = account;
                                                this.twitchQueue.addToQueue(action, behaviorSubject, payload);
                                                behaviorSubject.subscribe(
                                                  (res: { data: TwitchVideo[]; pagination: { cursor: string } }) => {
                                                    if (res?.data) {
                                                      const updated = new Date().toISOString();
                                                      this.dbService.update('twitchVideos', {
                                                        videos: res.data,
                                                        twitchId: account.id,
                                                        updated,
                                                      });
                                                      this.twitchVideosObs[account.id].next(res.data);
                                                    }
                                                  }
                                                );
                                              }
                                            }
                                          )
                                        )
                                        .subscribe();
                                    }
                                  }
                                })
                              )
                              .subscribe();
                          }
                        }
                      }
                    });
                  }
                }
              }
            });
          }
        });
      }
    });

    this.nameQueue$
      .pipe(
        debounceTime(75),
        map((queue) => {
          if (queue.length) {
            const memberships: {
              membershipId: string;
              names: string[];
            }[] = [];
            const payload: string[] = [];
            const prefixes = ['twitch.tv/', 't.tv/', 'twitch/', '_twitch', 'twitch_', 'twitch', 'ttv/', '[ttv]', '_ttv', 'ttv_', 'ttv'];
            while (queue.length && payload.length < 101) {
              const membership = queue.shift();
              if (membership?.names?.length) {
                let names = [];
                for (const name of membership?.names) {
                  if (name) {
                    let currentName = name
                      .replace(/[^A-Za-z0-9_]+/gi, '')
                      .replace(/^_+|_+$/gi, '')
                      .toLowerCase();
                    if (currentName.length > 2 && currentName.length < 26) {
                      names.push(currentName);
                    }
                    for (const prefix of prefixes) {
                      if (currentName && currentName?.indexOf(prefix) > -1) {
                        currentName = currentName?.replace(prefix, '').replace(/^_+|_+$/gi, '');
                        if (currentName.length > 2 && currentName.length < 26) {
                          names.push(currentName);
                        }
                      }
                    }
                  }
                }
                names = Array.from(new Set(names));
                if (payload.length + names.length < 101) {
                  memberships.push({ names, membershipId: membership.membershipId });
                  for (const name of names) {
                    payload.push(name);
                  }
                } else {
                  queue.unshift(membership);
                  break;
                }
              }
            }
            this.nameQueue$.next(queue);
            const action = 'getUsers';
            const behaviorSubject = new BehaviorSubject(undefined);
            this.twitchQueue.addToQueue(action, behaviorSubject, payload);
            behaviorSubject
              .pipe(
                map((res: { data: TwitchAccount[] }) => {
                  if (res?.data) {
                    for (const result of res?.data) {
                      for (const membership of memberships) {
                        const { membershipId, names } = membership;
                        const nameSet = new Set(names);
                        if (nameSet.has(result.login)) {
                          if (!this.twitchAccountsObs[membershipId]) {
                            this.twitchAccountsObs[membershipId] = new BehaviorSubject([]);
                          }
                          this.twitchAccountsObs[membershipId].pipe(take(1)).subscribe((accounts) => {
                            const loginSet = new Set(accounts.map((account) => account.login));
                            if (!loginSet.has(result.login)) {
                              accounts.push(result);
                              this.dbService.update('twitchAccounts', {
                                membershipId,
                                accounts,
                              });
                              this.twitchAccountsObs[membershipId].next(accounts);
                            }
                          });
                        }
                      }
                    }
                  }
                })
              )
              .subscribe();
          }
        })
      )
      .subscribe();

    this.instancesWithClips$ = this.instances$.pipe(
      map((instances) => {
        for (const instance of instances) {
          if (instance) {
            if (instance?.entries?.length) {
              for (const entry of instance?.entries) {
                let entryStart = new Date(instance.period);
                if (entry?.values?.startSeconds?.basic?.value) {
                  entryStart = new Date(
                    new Date(instance.period).setSeconds(new Date(instance.period).getSeconds() + entry?.values?.startSeconds?.basic?.value)
                  );
                }
                let entryStop = new Date(instance.period);
                if (entry?.values?.activityDurationSeconds?.basic?.value) {
                  entryStop = new Date(
                    new Date(instance.period).setSeconds(
                      new Date(instance.period).getSeconds() + entry?.values?.activityDurationSeconds?.basic?.value
                    )
                  );
                }
                if (!this.twitchAccountsObs[entry?.player?.destinyUserInfo?.membershipId]) {
                  this.twitchAccountsObs[entry?.player?.destinyUserInfo?.membershipId] = new BehaviorSubject([]);
                }
                const twitchClips = this.twitchAccountsObs[entry?.player?.destinyUserInfo?.membershipId].pipe(
                  switchMap((accounts) => {
                    const accountsVids = [];
                    for (const account of accounts) {
                      if (!this.twitchVideosObs[account.id]) {
                        this.twitchVideosObs[account.id] = new BehaviorSubject([]);
                      }
                      accountsVids.push(this.twitchVideosObs[account.id]);
                    }
                    return combineLatest(accountsVids);
                  }),
                  map((accounts: TwitchVideo[][]) => {
                    const videos: TwitchVideo[] = [];
                    for (const account of accounts) {
                      for (const video of account) {
                        const videoStart = new Date(video.created_at);
                        let rawDuration = video.duration;
                        const hourSplit = rawDuration.split('h');
                        let hours = 0;
                        let minutes = 0;
                        let seconds = 0;
                        if (hourSplit.length > 1) {
                          hours = parseInt(hourSplit[0], 10);
                          rawDuration = hourSplit[1];
                        }
                        const minuteSplit = rawDuration.split('m');
                        if (minuteSplit.length > 1) {
                          minutes = parseInt(minuteSplit[0], 10);
                          rawDuration = minuteSplit[1];
                        }
                        const secondSplit = rawDuration.split('s');
                        if (secondSplit.length) {
                          seconds = parseInt(secondSplit[0], 10);
                        }
                        const duration = seconds + minutes * 60 + hours * 60 * 60;
                        const videoStop = new Date(
                          new Date(video.created_at).setSeconds(new Date(video.created_at).getSeconds() + duration)
                        );
                        if (videoStart < entryStop && videoStop > entryStart) {
                          const offset = Math.floor((entryStart.getTime() - videoStart.getTime()) / 1000);
                          let secondsOffset = offset;
                          const hoursOffset = Math.floor(secondsOffset / 60 / 60);
                          secondsOffset -= hoursOffset * 60 * 60;
                          const minutesOffset = Math.floor(secondsOffset / 60);
                          secondsOffset -= minutesOffset * 60;
                          let twitchOffset = '';
                          if (hoursOffset) {
                            twitchOffset += `${hoursOffset}h`;
                          }
                          if (minutesOffset) {
                            twitchOffset += `${minutesOffset}m`;
                          }
                          if (secondsOffset) {
                            twitchOffset += `${secondsOffset}s`;
                          }
                          const videoWithOffset = { ...video, offset: twitchOffset };
                          videos.push(videoWithOffset);
                        }
                      }
                    }
                    return videos;
                  })
                );
                (entry as any).twitchClips = twitchClips;
              }
            }
          }
        }
        return instances;
      })
    );
  }
}
