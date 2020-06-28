import { Injectable } from '@angular/core';
import { BungieAuthService } from '../auth/bungie-auth/bungie-auth.service';
import { TwitchAuthService } from '../auth/twitch-auth/twitch-auth.service';
import { Observable, EMPTY, BehaviorSubject, combineLatest, of, from, forkJoin } from 'rxjs';
import { UserMembershipData, getMembershipDataForCurrentUser, ServerResponse } from 'bungie-api-ts/user';
import { switchMap, map, take, debounceTime } from 'rxjs/operators';
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
  private membershipNamesSet = new Set();

  private nameQueue$: BehaviorSubject<
    {
      membershipId: string;
      names: string[];
    }[]
  > = new BehaviorSubject([]);

  twitchVideosDbState: BehaviorSubject<{
    [twitchId: string]: {
      videos: TwitchVideo[];
      twitchId: string;
      updated: string;
    };
  }> = new BehaviorSubject({});
  twitchAccountsDbState: BehaviorSubject<{
    [membershipId: string]: {
      membershipId: string;
      accounts: TwitchAccount[];
    };
  }> = new BehaviorSubject({});
  pgcrsDbState: BehaviorSubject<{
    [instanceId: string]: {
      instanceId: string;
      period: string;
      response: string;
    };
  }> = new BehaviorSubject({});
  namesDbState: BehaviorSubject<{
    [membershipId: string]: {
      membershipId: string;
      names: string[];
    };
  }> = new BehaviorSubject({});
  lastEncounteredDbState: BehaviorSubject<{
    [membershipId: string]: {
      membershipId: string;
      period: string;
    };
  }> = new BehaviorSubject({});

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
    this.populateStateFromDb().subscribe((dbState) => {
      console.log(dbState);
      this.bungieCurrentUser$ = this.bungieAuth.hasValidAccessToken$.pipe(
        switchMap((valid) => {
          if (valid) {
            const action = getMembershipDataForCurrentUser;
            const behaviorSubject: BehaviorSubject<ServerResponse<UserMembershipData>> = new BehaviorSubject(undefined);
            this.bungieQueue.addToQueue('getMembershipDataForCurrentUser', action, behaviorSubject);
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
            //   this.bungieQueue.addToQueue('getProfile', action, behaviorSubject, params);
            // }
            const action = getProfile;
            const behaviorSubject: BehaviorSubject<ServerResponse<DestinyProfileResponse>> = new BehaviorSubject(undefined);
            destinyProfileResponses.push(behaviorSubject);
            const params: GetProfileParams = {
              destinyMembershipId: '4611686018438442802',
              membershipType: 1,
              components: [DestinyComponentType.Profiles, DestinyComponentType.Characters],
            };
            this.bungieQueue.addToQueue('getProfile', action, behaviorSubject, params);
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
                        this.bungieQueue.addToQueue('getActivityHistory', action, behaviorSubject, params);
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
                    const offset = new Date(new Date().setDate(new Date().getDate() - 45));
                    if (!this.instanceIdSet.has(instanceId) && period > offset) {
                      this.instanceIdSet.add(instanceId);
                      this.pgcrsDbState
                        .pipe(
                          take(1),
                          map((pgcrsDbState) => pgcrsDbState[instanceId] || {}),
                          switchMap((pgcrsDbEntry: { instanceId: string; period: string; response: string }) => {
                            if (pgcrsDbEntry?.response) {
                              return of(JSON.parse(pgcrsDbEntry.response));
                            } else {
                              const action = getPostGameCarnageReport;
                              const behaviorSubject: BehaviorSubject<ServerResponse<
                                DestinyPostGameCarnageReportData
                              >> = new BehaviorSubject(undefined);
                              const params: GetPostGameCarnageReportParams = { activityId: instanceId };
                              this.bungieQueue.addToQueue('getPostGameCarnageReport', action, behaviorSubject, params);
                              return behaviorSubject.pipe(
                                map((res) => {
                                  if (res?.Response?.activityDetails?.instanceId) {
                                    pgcrsDbEntry = {
                                      instanceId: res?.Response?.activityDetails?.instanceId,
                                      period: res?.Response?.period,
                                      response: JSON.stringify(res?.Response),
                                    };
                                    this.pgcrsDbState.pipe(take(1)).subscribe((pgcrsDbState) => {
                                      pgcrsDbState[instanceId] = pgcrsDbEntry;
                                      this.pgcrsDbState.next(pgcrsDbState);
                                    });
                                    this.dbService.update('pgcrs', pgcrsDbEntry);
                                    if (res?.Response) {
                                      return res?.Response;
                                    } else {
                                      return EMPTY;
                                    }
                                  }
                                })
                              );
                            }
                          })
                        )
                        .subscribe((pgcr: DestinyPostGameCarnageReportData) => {
                          this.instances.push(pgcr);
                          this.instances$.next(this.instances);

                          if (pgcr?.entries?.length) {
                            for (const entry of pgcr?.entries) {
                              const membershipId = entry?.player?.destinyUserInfo?.membershipId;

                              this.lastEncounteredDbState
                                .pipe(
                                  take(1),
                                  map((lastEncounteredDbState) => lastEncounteredDbState[membershipId]),
                                  map((lastEncounteredDbEntry: { membershipId: string; period: string }) => {
                                    if (
                                      !lastEncounteredDbEntry ||
                                      !lastEncounteredDbEntry.period ||
                                      new Date(pgcr?.period) > new Date(lastEncounteredDbEntry.period)
                                    ) {
                                      lastEncounteredDbEntry = {
                                        membershipId,
                                        period: new Date(pgcr?.period).toISOString(),
                                      };
                                      this.lastEncounteredDbState.pipe(take(1)).subscribe((lastEncounteredDbState) => {
                                        lastEncounteredDbState[membershipId] = lastEncounteredDbEntry;
                                        this.lastEncounteredDbState.next(lastEncounteredDbState);
                                      });
                                      this.dbService.update('lastEncountered', lastEncounteredDbEntry);
                                    }
                                  })
                                )
                                .subscribe();

                              if (!this.membershipNamesSet.has(membershipId)) {
                                this.membershipNamesSet.add(membershipId);
                                this.namesDbState
                                  .pipe(
                                    take(1),
                                    map((namesDbState) => namesDbState[membershipId] || {}),
                                    switchMap((namesDbEntry: { membershipId: string; names: string[] }) => {
                                      if (namesDbEntry?.names?.length) {
                                        if (namesDbEntry?.names.indexOf(entry?.player?.destinyUserInfo?.displayName) < 0) {
                                          namesDbEntry?.names.push(entry?.player?.destinyUserInfo?.displayName);
                                          this.namesDbState.pipe(take(1)).subscribe((namesDbState) => {
                                            namesDbState[membershipId] = namesDbEntry;
                                            this.namesDbState.next(namesDbState);
                                          });
                                          this.dbService.update('names', namesDbEntry);
                                        }
                                        return of(namesDbEntry?.names || []);
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
                                        this.bungieQueue.addToQueue('getLinkedProfiles', action, behaviorSubject, params);
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
                                              namesDbEntry = {
                                                membershipId,
                                                names,
                                              };
                                              this.namesDbState.pipe(take(1)).subscribe((namesDbState) => {
                                                namesDbState[membershipId] = namesDbEntry;
                                                this.namesDbState.next(namesDbState);
                                              });
                                              this.dbService.update('names', namesDbEntry);
                                              return names;
                                            } else {
                                              return [];
                                            }
                                          })
                                        );
                                      } else {
                                        return of([]);
                                      }
                                    }),
                                    map((names) => {
                                      this.nameQueue$.pipe(take(1)).subscribe((queue) =>
                                        this.nameQueue$.next([
                                          ...queue,
                                          {
                                            membershipId,
                                            names,
                                          },
                                        ])
                                      );
                                    })
                                  )
                                  .subscribe();

                                this.twitchAccountsDbState
                                  .pipe(
                                    map((twitchAccountsDbState) => twitchAccountsDbState[membershipId]),
                                    map((twitchAccountsDbEntry) => {
                                      if (twitchAccountsDbEntry?.accounts) {
                                        for (const account of twitchAccountsDbEntry?.accounts) {
                                          if (account?.id) {
                                            combineLatest([
                                              this.twitchVideosDbState.pipe(
                                                map((twitchVideosDbState) => {
                                                  if (account && account.id && twitchVideosDbState && twitchVideosDbState[account.id]) {
                                                    return twitchVideosDbState[account.id];
                                                  }
                                                  return {};
                                                })
                                              ),
                                              this.lastEncounteredDbState.pipe(
                                                map((lastEncounteredDbState) => {
                                                  if (lastEncounteredDbState && lastEncounteredDbState[membershipId]) {
                                                    return lastEncounteredDbState[membershipId];
                                                  }
                                                  return {};
                                                })
                                              ),
                                            ])
                                              .pipe(
                                                take(1),
                                                map(
                                                  ([twitchVideosDbEntry, lastEncounteredDbEntry]: [
                                                    { videos: TwitchVideo[]; twitchId: string; updated: string },
                                                    { membershipId: string; period: string }
                                                  ]) => {
                                                    const oneHourAgo = new Date(new Date().setHours(new Date().getHours() - 1));
                                                    const oneDayAgo = new Date(new Date().setDate(new Date().getDate() - 1));
                                                    if (
                                                      !twitchVideosDbEntry ||
                                                      !twitchVideosDbEntry.updated ||
                                                      !lastEncounteredDbEntry ||
                                                      !lastEncounteredDbEntry.period ||
                                                      new Date(lastEncounteredDbEntry.period) > new Date(twitchVideosDbEntry.updated) ||
                                                      (new Date(twitchVideosDbEntry.updated) > oneDayAgo &&
                                                        new Date(twitchVideosDbEntry.updated) < oneHourAgo)
                                                    ) {
                                                      const action = 'getVideos';
                                                      const behaviorSubject = new BehaviorSubject(undefined);
                                                      const payload = account;
                                                      this.twitchQueue.addToQueue(action, behaviorSubject, payload);
                                                      behaviorSubject.subscribe(
                                                        (res: { data: TwitchVideo[]; pagination: { cursor: string } }) => {
                                                          if (res?.data) {
                                                            const updated = new Date().toISOString();
                                                            twitchVideosDbEntry = {
                                                              videos: res.data,
                                                              twitchId: account.id,
                                                              updated,
                                                            };
                                                            this.twitchVideosDbState.pipe(take(1)).subscribe((twitchVideosDbState) => {
                                                              twitchVideosDbState[account.id] = twitchVideosDbEntry;
                                                              this.twitchVideosDbState.next(twitchVideosDbState);
                                                            });
                                                            this.dbService.update('twitchVideos', twitchVideosDbEntry);
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
                            this.twitchAccountsDbState
                              .pipe(
                                take(1),
                                map((twitchAccountsDbState) => twitchAccountsDbState[membershipId]),
                                map((twitchAccountsDbEntry) => {
                                  const loginSet = new Set();
                                  twitchAccountsDbEntry?.accounts?.map((account) => loginSet.add(account?.login));
                                  if (!loginSet.has(result.login)) {
                                    const accounts = twitchAccountsDbEntry?.accounts || [];
                                    accounts.push(result);
                                    twitchAccountsDbEntry = {
                                      membershipId,
                                      accounts,
                                    };
                                    this.twitchAccountsDbState.pipe(take(1)).subscribe((twitchAccountsDbState) => {
                                      twitchAccountsDbEntry[membershipId] = twitchAccountsDbEntry;
                                      this.twitchAccountsDbState.next(twitchAccountsDbState);
                                    });
                                    this.dbService.update('twitchAccounts', twitchAccountsDbEntry);
                                  }
                                })
                              )
                              .subscribe();
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
    });

    this.instancesWithClips$ = this.instances$.pipe(
      debounceTime(100),
      map((instances) => {
        console.log(instances);
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
                const twitchClips = this.twitchAccountsDbState.pipe(
                  map((twitchAccountsDbState) => twitchAccountsDbState[entry?.player?.destinyUserInfo?.membershipId] || {}),
                  switchMap((twitchAccountsDbEntry: { membershipId: string; accounts: TwitchAccount[] }) => {
                    const twitchVideosDbEntries = [];
                    if (twitchAccountsDbEntry?.accounts?.length) {
                      for (const account of twitchAccountsDbEntry?.accounts) {
                        twitchVideosDbEntries.push(
                          this.twitchVideosDbState.pipe((twitchVideosDbState) => {
                            if (twitchVideosDbState && twitchVideosDbState[account.id]) {
                              return twitchVideosDbState[account.id];
                            }
                            return {};
                          })
                        );
                      }
                      return combineLatest(twitchVideosDbEntries);
                    } else {
                      return of([]);
                    }
                  }),
                  map(
                    (
                      twitchVideosDbEntries: {
                        videos: TwitchVideo[];
                        twitchId: string;
                        updated: string;
                      }[]
                    ) => {
                      const videos: TwitchVideo[] = [];
                      for (const twitchVideosDbEntry of twitchVideosDbEntries) {
                        if (twitchVideosDbEntry?.videos) {
                          for (const video of twitchVideosDbEntry?.videos) {
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
                      }
                      return videos;
                    }
                  )
                );
                // (entry as any).twitchClips = twitchClips;
              }
            }
          }
        }
        return instances;
      })
    );
  }

  populateStateFromDb() {
    const lastEncountered = from(this.dbService.getAll('lastEncountered')).pipe(
      map(
        (
          entries: {
            membershipId: string;
            period: string;
          }[]
        ) => {
          const lastEncounteredDbState = {};
          for (const entry of entries) {
            lastEncounteredDbState[entry.membershipId] = entry;
          }
          this.lastEncounteredDbState.next(lastEncounteredDbState);
          return lastEncounteredDbState;
        }
      )
    );
    const names = from(this.dbService.getAll('names')).pipe(
      map(
        (
          entries: {
            membershipId: string;
            names: string[];
          }[]
        ) => {
          const namesDbState = {};
          for (const entry of entries) {
            namesDbState[entry.membershipId] = entry;
          }
          this.namesDbState.next(namesDbState);
          return namesDbState;
        }
      )
    );
    const pgcrs = from(this.dbService.getAll('pgcrs')).pipe(
      map(
        (
          entries: {
            instanceId: string;
            period: string;
            response: string;
          }[]
        ) => {
          const pgcrsDbState = {};
          for (const entry of entries) {
            pgcrsDbState[entry.instanceId] = entry;
          }
          this.pgcrsDbState.next(pgcrsDbState);
          return pgcrsDbState;
        }
      )
    );
    const twitchAccounts = from(this.dbService.getAll('twitchAccounts')).pipe(
      map(
        (
          entries: {
            membershipId: string;
            accounts: TwitchAccount[];
          }[]
        ) => {
          const twitchAccountsDbState = {};
          for (const entry of entries) {
            twitchAccountsDbState[entry.membershipId] = entry;
          }
          this.twitchAccountsDbState.next(twitchAccountsDbState);
          return twitchAccountsDbState;
        }
      )
    );
    const twitchVideos = from(this.dbService.getAll('twitchVideos')).pipe(
      map(
        (
          entries: {
            videos: TwitchVideo[];
            twitchId: string;
            updated: string;
          }[]
        ) => {
          const twitchVideosDbState = {};
          for (const entry of entries) {
            twitchVideosDbState[entry.twitchId] = entry;
          }
          this.twitchVideosDbState.next(twitchVideosDbState);
          return twitchVideosDbState;
        }
      )
    );

    return forkJoin([lastEncountered, names, pgcrs, twitchAccounts, twitchVideos]);
  }
}
