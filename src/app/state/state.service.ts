import { Injectable } from '@angular/core'
import { BungieAuthService } from '../auth/bungie-auth/bungie-auth.service'
import { TwitchAuthService } from '../auth/twitch-auth/twitch-auth.service'
import { Observable, EMPTY, BehaviorSubject, combineLatest, of, from, forkJoin } from 'rxjs'
import {
  UserMembershipData,
  getMembershipDataForCurrentUser,
  ServerResponse,
  getMembershipDataById,
  GetMembershipDataByIdParams,
} from 'bungie-api-ts/user'
import { switchMap, map, take, debounceTime, distinctUntilChanged, filter, withLatestFrom } from 'rxjs/operators'
import { BungieQueueService } from '../queue/bungie-queue.service'
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
} from 'bungie-api-ts/destiny2'
import { NgxIndexedDBService } from 'ngx-indexed-db'
import { TwitchQueueService } from '../queue/twitch-queue.service'
import { XboxQueueService } from '../queue/xbox-queue.service'
import { TwitchAccount, TwitchVideo, NamesDbEntry, DestinyPostGameCarnageReportDataExtended, NameMatchTypes, XboxVideo } from '../types'

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private bungieCurrentUser$: BehaviorSubject<ServerResponse<UserMembershipData>> = new BehaviorSubject(undefined)
  private bungieProfiles$: BehaviorSubject<Array<BehaviorSubject<ServerResponse<DestinyProfileResponse>>>> = new BehaviorSubject([])
  private bungieActivityHistories$: BehaviorSubject<
    Array<Observable<Array<BehaviorSubject<ServerResponse<DestinyActivityHistoryResults>>>>>
  > = new BehaviorSubject([])
  private characterIds$: BehaviorSubject<Array<string>> = new BehaviorSubject([])

  private instanceIdSet = new Set()
  private membershipNamesSet = new Set()

  private nameQueue$: BehaviorSubject<Array<NamesDbEntry>> = new BehaviorSubject([])

  xboxVideosDbState: {
    [twitchId: string]: BehaviorSubject<{
      videos: XboxVideo[]
      gamertag: string
      updated: string
    }>
  } = {}
  twitchVideosDbState: {
    [twitchId: string]: BehaviorSubject<{
      videos: TwitchVideo[]
      twitchId: string
      twitchProfileImage: string
      updated: string
    }>
  } = {}
  twitchAccountsDbState: {
    [membershipId: string]: BehaviorSubject<{
      membershipId: string
      accounts: TwitchAccount[]
    }>
  } = {}
  pgcrsDbState: BehaviorSubject<{
    [instanceId: string]: {
      instanceId: string
      period: string
      response: string
    }
  }> = new BehaviorSubject({})
  namesDbState: BehaviorSubject<{
    [membershipId: string]: NamesDbEntry
  }> = new BehaviorSubject({})
  lastEncounteredDbState: BehaviorSubject<{
    [membershipId: string]: {
      membershipId: string
      period: string
    }
  }> = new BehaviorSubject({})

  instancesWithVideos$: Observable<DestinyPostGameCarnageReportDataExtended[]>
  clipCount$: Observable<number>

  constructor(
    private bungieAuth: BungieAuthService,
    private bungieQueue: BungieQueueService,
    private twitchAuth: TwitchAuthService,
    private twitchQueue: TwitchQueueService,
    private xboxQueue: XboxQueueService,
    private dbService: NgxIndexedDBService
  ) {
    this.instancesWithVideos$ = combineLatest([this.characterIds$, this.pgcrsDbState]).pipe(
      map(([characterIds, pgcrsDbState]) => {
        const pgcrs: DestinyPostGameCarnageReportData[] = []
        const pgcrKeys = Object.keys(pgcrsDbState)
        for (const key of pgcrKeys) {
          if (pgcrsDbState[key]?.response) {
            const pgcr = JSON.parse(pgcrsDbState[key]?.response) as DestinyPostGameCarnageReportDataExtended
            if (pgcr && pgcr.entries.some((entry) => characterIds.includes(entry.characterId))) {
              if (pgcr?.entries?.length) {
                const twitchVideosArray: Array<Observable<Array<TwitchVideo>>> = []
                const xboxVideosArray: Array<Observable<Array<XboxVideo>>> = []
                for (const entry of pgcr?.entries) {
                  entry.namesDbEntry = this.namesDbState.pipe(
                    map((namesDbState) => namesDbState[entry.player.destinyUserInfo.membershipId])
                  )
                  let entryStart = new Date(pgcr.period)
                  if (entry?.values?.startSeconds?.basic?.value) {
                    entryStart = new Date(
                      new Date(pgcr.period).setSeconds(new Date(pgcr.period).getSeconds() + entry?.values?.startSeconds?.basic?.value)
                    )
                  }
                  let entryStop = new Date(pgcr.period)
                  if (entry?.values?.activityDurationSeconds?.basic?.value) {
                    entryStop = new Date(
                      new Date(pgcr.period).setSeconds(
                        new Date(pgcr.period).getSeconds() + entry?.values?.activityDurationSeconds?.basic?.value
                      )
                    )
                  }
                  if (entry?.player?.destinyUserInfo?.membershipId) {
                    if (!this.twitchAccountsDbState[entry?.player?.destinyUserInfo?.membershipId]) {
                      this.twitchAccountsDbState[entry?.player?.destinyUserInfo?.membershipId] = new BehaviorSubject({
                        membershipId: entry?.player?.destinyUserInfo?.membershipId,
                        accounts: [],
                      })
                    }

                    const twitchVideos = this.twitchAccountsDbState[entry?.player?.destinyUserInfo?.membershipId].pipe(
                      switchMap((twitchAccountsDbEntry: { membershipId: string; accounts: TwitchAccount[] }) => {
                        const twitchVideosDbEntries = []
                        if (twitchAccountsDbEntry?.accounts?.length) {
                          for (const account of twitchAccountsDbEntry?.accounts) {
                            if (!this.twitchVideosDbState[account.id]) {
                              this.twitchVideosDbState[account.id] = new BehaviorSubject({
                                videos: [],
                                twitchId: account.id,
                                twitchProfileImage: account.profile_image_url,
                                updated: undefined,
                              })
                            }
                            twitchVideosDbEntries.push(this.twitchVideosDbState[account.id])
                          }
                          return combineLatest(twitchVideosDbEntries)
                        } else {
                          return of([])
                        }
                      }),
                      map(
                        (
                          twitchVideosDbEntries: {
                            videos: TwitchVideo[]
                            twitchId: string
                            twitchProfileImage: string
                            updated: string
                          }[]
                        ) => {
                          const videos: TwitchVideo[] = []
                          for (const twitchVideosDbEntry of twitchVideosDbEntries) {
                            if (twitchVideosDbEntry?.videos) {
                              for (const video of twitchVideosDbEntry?.videos) {
                                const videoStart = new Date(video.created_at)
                                let rawDuration = video.duration
                                const hourSplit = rawDuration.split('h')
                                let hours = 0
                                let minutes = 0
                                let seconds = 0
                                if (hourSplit.length > 1) {
                                  hours = parseInt(hourSplit[0], 10)
                                  rawDuration = hourSplit[1]
                                }
                                const minuteSplit = rawDuration.split('m')
                                if (minuteSplit.length > 1) {
                                  minutes = parseInt(minuteSplit[0], 10)
                                  rawDuration = minuteSplit[1]
                                }
                                const secondSplit = rawDuration.split('s')
                                if (secondSplit.length) {
                                  seconds = parseInt(secondSplit[0], 10)
                                }
                                const duration = seconds + minutes * 60 + hours * 60 * 60
                                const videoStop = new Date(
                                  new Date(video.created_at).setSeconds(new Date(video.created_at).getSeconds() + duration)
                                )
                                if (videoStart < entryStop && videoStop > entryStart) {
                                  const offset = Math.floor((entryStart.getTime() - videoStart.getTime()) / 1000)
                                  let secondsOffset = offset
                                  const hoursOffset = Math.floor(secondsOffset / 60 / 60)
                                  secondsOffset -= hoursOffset * 60 * 60
                                  const minutesOffset = Math.floor(secondsOffset / 60)
                                  secondsOffset -= minutesOffset * 60
                                  let twitchOffset = ''
                                  if (hoursOffset) {
                                    twitchOffset += `${hoursOffset}h`
                                  }
                                  if (minutesOffset) {
                                    twitchOffset += `${minutesOffset}m`
                                  }
                                  if (secondsOffset) {
                                    twitchOffset += `${secondsOffset}s`
                                  }
                                  const matchType = entry.namesDbEntry.pipe(
                                    map((namesDbEntry) => {
                                      if (video.user_name === namesDbEntry?.nameObject?.twitchDisplayName) {
                                        return 'twitchDisplayName'
                                      }
                                      for (const k of Object.keys(namesDbEntry.nameObject)) {
                                        if (
                                          namesDbEntry?.nameObject &&
                                          namesDbEntry?.nameObject[k] &&
                                          video.user_name === namesDbEntry?.nameObject[k]
                                        ) {
                                          return k as NameMatchTypes
                                        }
                                      }
                                    })
                                  )
                                  const videoWithOffset = {
                                    ...video,
                                    offset: twitchOffset,
                                    matchType,
                                    twitchProfileImage: twitchVideosDbEntry.twitchProfileImage,
                                  }
                                  videos.push(videoWithOffset)
                                }
                              }
                            }
                          }
                          return videos
                        }
                      )
                    )
                    twitchVideosArray.push(twitchVideos)
                    entry.twitchVideos = twitchVideos

                    const xboxVideos = entry.namesDbEntry.pipe(
                      switchMap((namesDbEntry) => {
                        if (namesDbEntry?.nameObject?.xboxDisplayName) {
                          return this.xboxVideosDbState[namesDbEntry.nameObject.xboxDisplayName] || of([])
                        } else {
                          return of([])
                        }
                      }),
                      map((xboxVideosDbEntry: { videos: XboxVideo[]; gamertag: string; updated: string }) => {
                        const videos: XboxVideo[] = []
                        if (xboxVideosDbEntry?.videos) {
                          for (const video of xboxVideosDbEntry?.videos) {
                            const videoStop = new Date(video.dateRecorded)
                            const videoStart = new Date(
                              new Date(video.dateRecorded).setSeconds(new Date(video.dateRecorded).getSeconds() - video.durationInSeconds)
                            )

                            if (videoStart < entryStop && videoStop > entryStart) {
                              videos.push(video)

                              const oneHourAgo = new Date(new Date().setHours(new Date().getHours() - 1))
                              const lastUpdated = new Date(xboxVideosDbEntry.updated)
                              if (lastUpdated < oneHourAgo) {
                                const action = 'getVideos'
                                const behaviorSubject = new BehaviorSubject(undefined)
                                const payload = xboxVideosDbEntry.gamertag
                                this.xboxQueue.addToQueue(action, behaviorSubject, payload)
                                behaviorSubject.subscribe(
                                  (res: { clips: { gameClips: XboxVideo[]; status: string; numResults: number } }) => {
                                    if (res?.clips?.gameClips) {
                                      const updated = new Date().toISOString()
                                      const updatedXboxVideosDbEntry = {
                                        videos: res.clips.gameClips,
                                        gamertag: xboxVideosDbEntry.gamertag,
                                        updated,
                                      }
                                      this.xboxVideosDbState[xboxVideosDbEntry.gamertag].next(updatedXboxVideosDbEntry)
                                      this.dbService.update('xboxVideos', updatedXboxVideosDbEntry)
                                    }
                                  }
                                )
                              }
                            }
                          }
                        }
                        return videos
                      })
                    )
                    xboxVideosArray.push(xboxVideos)
                    entry.xboxVideos = xboxVideos
                  }
                }
                pgcr.twitchVideos = combineLatest(twitchVideosArray).pipe(
                  distinctUntilChanged(),
                  map((twitchVideos) => {
                    const videos: TwitchVideo[] = []
                    for (const c of twitchVideos) {
                      for (const twitchClip of c) {
                        videos.push(twitchClip)
                      }
                    }
                    return videos
                  })
                )
                pgcr.xboxVideos = combineLatest(xboxVideosArray).pipe(
                  distinctUntilChanged(),
                  map((xboxVideos) => {
                    const videos: XboxVideo[] = []
                    for (const c of xboxVideos) {
                      for (const xboxClip of c) {
                        videos.push(xboxClip)
                      }
                    }
                    return videos
                  })
                )
              }
              pgcrs.push(pgcr)
            }
          }
        }
        return pgcrs
      })
    )

    this.populateStateFromDb().subscribe(() => {
      this.bungieAuth.hasValidAccessToken$
        .pipe(
          distinctUntilChanged(),
          switchMap((valid) => {
            if (valid) {
              const action = getMembershipDataForCurrentUser
              const behaviorSubject: BehaviorSubject<ServerResponse<UserMembershipData>> = new BehaviorSubject(undefined)
              this.bungieQueue.addToQueue('getMembershipDataForCurrentUser', action, behaviorSubject)
              return behaviorSubject
            } else {
              return EMPTY
            }
          })
        )
        .subscribe((res) => this.bungieCurrentUser$.next(res))

      this.bungieCurrentUser$
        .pipe(
          switchMap((user) => {
            if (user?.Response) {
              // this.bungieCurrentUser = user.Response;
              const destinyProfileResponses: Array<BehaviorSubject<ServerResponse<DestinyProfileResponse>>> = []

              for (const profile of user?.Response?.destinyMemberships) {
                const action = getProfile
                const behaviorSubject: BehaviorSubject<ServerResponse<DestinyProfileResponse>> = new BehaviorSubject(undefined)
                destinyProfileResponses.push(behaviorSubject)
                const { membershipId, membershipType } = profile
                const params: GetProfileParams = {
                  destinyMembershipId: membershipId,
                  membershipType,
                  components: [DestinyComponentType.Profiles, DestinyComponentType.Characters],
                }
                this.bungieQueue.addToQueue('getProfile', action, behaviorSubject, params)
              }
              return of(destinyProfileResponses)
            } else {
              return EMPTY
            }
          })
        )
        .subscribe((res) => this.bungieProfiles$.next(res))

      this.bungieProfiles$
        .pipe(
          switchMap((profiles) => {
            if (profiles?.length) {
              const activityHistories: Array<Observable<Array<BehaviorSubject<ServerResponse<DestinyActivityHistoryResults>>>>> = []
              const characterIds: Array<string> = []
              for (const profile$ of profiles) {
                const activityHistory$ = profile$.pipe(
                  switchMap((profile) => {
                    if (profile?.Response) {
                      // this.bungieProfiles[profile?.Response?.profile?.data?.userInfo?.membershipId] = profile?.Response;
                      const destinyActivityHistoryResults: Array<BehaviorSubject<ServerResponse<DestinyActivityHistoryResults>>> = []

                      const characters = profile?.Response?.characters?.data
                      for (const characterId in characters) {
                        if (characters[characterId]) {
                          characterIds.push(characterId)
                          const action = getActivityHistory
                          for (let i = 0; i < 7; i++) {
                            const behaviorSubject: BehaviorSubject<ServerResponse<DestinyActivityHistoryResults>> = new BehaviorSubject(
                              undefined
                            )
                            destinyActivityHistoryResults.push(behaviorSubject)
                            const params: GetActivityHistoryParams = {
                              characterId,
                              count: 250,
                              destinyMembershipId: profile?.Response?.profile?.data?.userInfo?.membershipId,
                              membershipType: profile?.Response?.profile?.data?.userInfo?.membershipType,
                              mode: DestinyActivityModeType.None,
                              page: i,
                            }
                            this.bungieQueue.addToQueue('getActivityHistory', action, behaviorSubject, params)
                          }
                        }
                      }
                      return of(destinyActivityHistoryResults)
                    } else {
                      return EMPTY
                    }
                  })
                )
                activityHistories.push(activityHistory$)
              }
              return of(activityHistories)
            } else {
              return EMPTY
            }
          })
        )
        .subscribe((res) => this.bungieActivityHistories$.next(res))

      this.bungieProfiles$
        .pipe(
          switchMap((profiles) => {
            return combineLatest(profiles)
          }),
          map((profiles) => {
            const characterIds = []
            for (const profile of profiles) {
              const characters = profile?.Response?.characters?.data
              for (const character in characters) {
                if (characters[character]) {
                  characterIds.push(characters[character].characterId)
                }
              }
            }
            return characterIds
          })
        )
        .subscribe((res) => this.characterIds$.next(res))

      this.bungieActivityHistories$.subscribe((profiles) => {
        if (profiles) {
          for (const profile of profiles) {
            profile?.subscribe((characters) => {
              for (const character of characters) {
                character?.subscribe((history) => {
                  if (history?.Response?.activities) {
                    for (const activity of history?.Response?.activities) {
                      const instanceId = activity?.activityDetails?.instanceId
                      const period = new Date(activity?.period)
                      const offset = new Date(new Date().setDate(new Date().getDate() - 60))
                      if (!this.instanceIdSet.has(instanceId) && period > offset) {
                        this.instanceIdSet.add(instanceId)
                        this.pgcrsDbState
                          .pipe(
                            map((pgcrsDbState) => {
                              if (pgcrsDbState[instanceId]) {
                                return pgcrsDbState[instanceId]
                              } else {
                                return undefined
                              }
                            }),
                            distinctUntilChanged(),
                            switchMap((pgcrsDbEntry: { instanceId: string; period: string; response: string }) => {
                              if (pgcrsDbEntry?.response) {
                                return of(JSON.parse(pgcrsDbEntry.response))
                              } else {
                                const action = getPostGameCarnageReport
                                const behaviorSubject: BehaviorSubject<
                                  ServerResponse<DestinyPostGameCarnageReportData>
                                > = new BehaviorSubject(undefined)
                                const params: GetPostGameCarnageReportParams = { activityId: instanceId }
                                this.bungieQueue.addToQueue('getPostGameCarnageReport', action, behaviorSubject, params)
                                return behaviorSubject.pipe(
                                  map((res) => {
                                    if (res?.Response?.activityDetails?.instanceId) {
                                      pgcrsDbEntry = {
                                        instanceId: res?.Response?.activityDetails?.instanceId,
                                        period: res?.Response?.period,
                                        response: JSON.stringify(res?.Response),
                                      }
                                      this.pgcrsDbState.pipe(take(1)).subscribe((pgcrsDbState) => {
                                        pgcrsDbState[instanceId] = pgcrsDbEntry
                                        this.pgcrsDbState.next(pgcrsDbState)
                                      })
                                      this.dbService.update('pgcrs', pgcrsDbEntry)
                                      if (res?.Response) {
                                        return res?.Response
                                      } else {
                                        return EMPTY
                                      }
                                    }
                                  })
                                )
                              }
                            })
                          )
                          .subscribe((pgcr: DestinyPostGameCarnageReportData) => {
                            if (pgcr?.entries?.length) {
                              for (const entry of pgcr?.entries) {
                                const membershipId = entry?.player?.destinyUserInfo?.membershipId
                                this.lastEncounteredDbState
                                  .pipe(
                                    take(1),
                                    map((lastEncounteredDbState) => {
                                      if (lastEncounteredDbState[membershipId]) {
                                        return lastEncounteredDbState[membershipId]
                                      } else {
                                        return undefined
                                      }
                                    }),
                                    map((lastEncounteredDbEntry: { membershipId: string; period: string }) => {
                                      if (
                                        !lastEncounteredDbEntry ||
                                        !lastEncounteredDbEntry.period ||
                                        new Date(pgcr?.period) > new Date(lastEncounteredDbEntry.period)
                                      ) {
                                        lastEncounteredDbEntry = {
                                          membershipId,
                                          period: new Date(pgcr?.period).toISOString(),
                                        }
                                        this.lastEncounteredDbState.pipe(take(1)).subscribe((lastEncounteredDbState) => {
                                          lastEncounteredDbState[membershipId] = lastEncounteredDbEntry
                                          this.lastEncounteredDbState.next(lastEncounteredDbState)
                                        })
                                        this.dbService.update('lastEncountered', lastEncounteredDbEntry)
                                      }
                                    })
                                  )
                                  .subscribe()

                                if (!this.membershipNamesSet.has(membershipId)) {
                                  this.membershipNamesSet.add(membershipId)
                                  this.namesDbState
                                    .pipe(
                                      take(1),
                                      map((namesDbState) => namesDbState[membershipId] || {}),
                                      switchMap((namesDbEntry: NamesDbEntry) => {
                                        if (namesDbEntry?.nameArray) {
                                          // if (namesDbEntry?.nameArray.indexOf(entry?.player?.destinyUserInfo?.displayName) < 0) {
                                          //   namesDbEntry?.nameArray.push(entry?.player?.destinyUserInfo?.displayName)
                                          //   this.namesDbState.pipe(take(1)).subscribe((namesDbState) => {
                                          //     namesDbState[membershipId] = namesDbEntry
                                          //     this.namesDbState.next(namesDbState)
                                          //   })
                                          //   this.dbService.update('names', namesDbEntry)
                                          // }
                                          return of(namesDbEntry || { membershipId, nameArray: [], nameObject: {} })
                                        } else if (membershipId && entry?.player?.destinyUserInfo?.membershipType) {
                                          const action = getMembershipDataById
                                          const behaviorSubject: BehaviorSubject<ServerResponse<UserMembershipData>> = new BehaviorSubject(
                                            undefined
                                          )
                                          const params: GetMembershipDataByIdParams = {
                                            membershipId,
                                            membershipType: 0,
                                          }
                                          this.bungieQueue.addToQueue('getMembershipDataById', action, behaviorSubject, params)
                                          return behaviorSubject.pipe(
                                            map((res) => {
                                              if (res?.Response) {
                                                const nameSet = new Set()
                                                // nameSet.add(res?.Response?.bungieNetUser?.displayName)
                                                // nameSet.add(res?.Response?.bungieNetUser?.fbDisplayName)
                                                // nameSet.add(res?.Response?.bungieNetUser?.psnDisplayName)
                                                // nameSet.add(res?.Response?.bungieNetUser?.xboxDisplayName)
                                                // nameSet.add(res?.Response?.bungieNetUser?.stadiaDisplayName?.replace(/(#[0-9]*)/gi, ''))
                                                // nameSet.add(res?.Response?.bungieNetUser?.steamDisplayName)
                                                nameSet.add(res?.Response?.bungieNetUser?.twitchDisplayName)
                                                // if (res?.Response?.destinyMemberships) {
                                                //   for (const prof of res?.Response?.destinyMemberships) {
                                                //     nameSet.add(prof?.displayName)
                                                //   }
                                                // }
                                                nameSet.delete(undefined)
                                                const nameArray = Array.from(nameSet) as string[]
                                                namesDbEntry = {
                                                  membershipId,
                                                  nameArray,
                                                  nameObject: {
                                                    displayName: res?.Response?.bungieNetUser?.displayName,
                                                    fbDisplayName: res?.Response?.bungieNetUser?.fbDisplayName,
                                                    blizzardDisplayName: res?.Response?.bungieNetUser?.blizzardDisplayName,
                                                    psnDisplayName: res?.Response?.bungieNetUser?.psnDisplayName,
                                                    xboxDisplayName: res?.Response?.bungieNetUser?.xboxDisplayName,
                                                    stadiaDisplayName: res?.Response?.bungieNetUser?.xboxDisplayName,
                                                    steamDisplayName: res?.Response?.bungieNetUser?.steamDisplayName,
                                                    twitchDisplayName: res?.Response?.bungieNetUser?.twitchDisplayName,
                                                  },
                                                }
                                                this.namesDbState.pipe(take(1)).subscribe((namesDbState) => {
                                                  namesDbState[membershipId] = namesDbEntry
                                                  this.namesDbState.next(namesDbState)
                                                })
                                                this.dbService.update('names', namesDbEntry)
                                                return namesDbEntry
                                              } else {
                                                return { membershipId, nameArray: [], nameObject: {} }
                                              }
                                            })
                                          )
                                        } else {
                                          return of({ membershipId, nameArray: [], nameObject: {} })
                                        }
                                      }),
                                      map((namesDbEntry: NamesDbEntry) => {
                                        this.nameQueue$.pipe(take(1)).subscribe((queue) => this.nameQueue$.next([...queue, namesDbEntry]))

                                        if (namesDbEntry.nameObject.xboxDisplayName) {
                                          const gamertag = namesDbEntry.nameObject.xboxDisplayName
                                          if (!this.xboxVideosDbState[gamertag]) {
                                            this.xboxVideosDbState[gamertag] = new BehaviorSubject({
                                              videos: [],
                                              gamertag,
                                              updated: undefined,
                                            })
                                          }
                                          this.xboxVideosDbState[gamertag]
                                            .pipe(
                                              withLatestFrom(
                                                this.lastEncounteredDbState.pipe(
                                                  map((lastEncounteredDbState) => {
                                                    if (lastEncounteredDbState && lastEncounteredDbState[membershipId]) {
                                                      return lastEncounteredDbState[membershipId]
                                                    }
                                                    return undefined
                                                  })
                                                )
                                              ),
                                              map(([xboxVideosDbState, lastEncounteredDbEntry]) => {
                                                const oneHourAgo = new Date(new Date().setHours(new Date().getHours() - 1))
                                                const oneDayAgo = new Date(new Date().setHours(new Date().getHours() - 24))
                                                const lastEncountered = new Date(lastEncounteredDbEntry?.period)
                                                const lastUpdated = new Date(xboxVideosDbState?.updated)
                                                if (
                                                  !xboxVideosDbState ||
                                                  !xboxVideosDbState.updated ||
                                                  !lastEncounteredDbEntry ||
                                                  !lastEncounteredDbEntry.period ||
                                                  lastEncountered > lastUpdated ||
                                                  (lastUpdated < oneHourAgo && lastEncountered > oneDayAgo)
                                                ) {
                                                  const action = 'getVideos'
                                                  const behaviorSubject = new BehaviorSubject(undefined)
                                                  const payload = gamertag
                                                  this.xboxQueue.addToQueue(action, behaviorSubject, payload)
                                                  behaviorSubject.subscribe(
                                                    (res: {
                                                      clips: {
                                                        gameClips: XboxVideo[]
                                                        status: string
                                                        numResults: number
                                                        description: string
                                                      }
                                                    }) => {
                                                      if (res?.clips?.gameClips || res?.clips?.description === 'no clips returned') {
                                                        const updated = new Date().toISOString()
                                                        const xboxVideosDbEntry = {
                                                          videos: res.clips.gameClips || [],
                                                          gamertag,
                                                          updated,
                                                        }
                                                        this.xboxVideosDbState[gamertag].next(xboxVideosDbEntry)
                                                        this.dbService.update('xboxVideos', xboxVideosDbEntry)
                                                      }
                                                    }
                                                  )
                                                }
                                              })
                                            )
                                            .subscribe()
                                        }
                                      })
                                    )
                                    .subscribe()

                                  if (!this.twitchAccountsDbState[membershipId]) {
                                    this.twitchAccountsDbState[membershipId] = new BehaviorSubject({
                                      membershipId,
                                      accounts: [],
                                    })
                                  }

                                  this.twitchAccountsDbState[membershipId]
                                    .pipe(
                                      filter((twitchAccountsDbEntry) => twitchAccountsDbEntry !== undefined),
                                      distinctUntilChanged(),
                                      map((twitchAccountsDbEntry) => {
                                        if (twitchAccountsDbEntry?.accounts) {
                                          for (const account of twitchAccountsDbEntry?.accounts) {
                                            if (account?.id) {
                                              if (!this.twitchVideosDbState[account.id]) {
                                                this.twitchVideosDbState[account.id] = new BehaviorSubject({
                                                  videos: [],
                                                  twitchId: account.id,
                                                  twitchProfileImage: account.profile_image_url,
                                                  updated: undefined,
                                                })
                                              }
                                              this.twitchVideosDbState[account.id]
                                                .pipe(
                                                  withLatestFrom(
                                                    this.lastEncounteredDbState.pipe(
                                                      map((lastEncounteredDbState) => {
                                                        if (lastEncounteredDbState && lastEncounteredDbState[membershipId]) {
                                                          return lastEncounteredDbState[membershipId]
                                                        }
                                                        return undefined
                                                      })
                                                    )
                                                  ),
                                                  map(([twitchVideosDbEntry, lastEncounteredDbEntry]) => {
                                                    const oneHourAgo = new Date(new Date().setHours(new Date().getHours() - 1))
                                                    const oneDayAgo = new Date(new Date().setHours(new Date().getHours() - 24))
                                                    const lastEncountered = new Date(lastEncounteredDbEntry?.period)
                                                    const lastUpdated = new Date(twitchVideosDbEntry?.updated)
                                                    if (
                                                      !twitchVideosDbEntry ||
                                                      !twitchVideosDbEntry.updated ||
                                                      !lastEncounteredDbEntry ||
                                                      !lastEncounteredDbEntry.period ||
                                                      lastEncountered > lastUpdated ||
                                                      (lastUpdated < oneHourAgo &&
                                                        lastEncountered.getFullYear() === lastUpdated.getFullYear() &&
                                                        lastEncountered.getMonth() === lastUpdated.getMonth() &&
                                                        lastEncountered.getDate() === lastUpdated.getDate())
                                                    ) {
                                                      const action = 'getVideos'
                                                      const behaviorSubject = new BehaviorSubject(undefined)
                                                      const payload = account
                                                      this.twitchQueue.addToQueue(action, behaviorSubject, payload)
                                                      behaviorSubject.subscribe(
                                                        (res: { data: TwitchVideo[]; pagination: { cursor: string } }) => {
                                                          if (res?.data) {
                                                            const updated = new Date().toISOString()
                                                            twitchVideosDbEntry = {
                                                              videos: res.data,
                                                              twitchId: account.id,
                                                              twitchProfileImage: account.profile_image_url,
                                                              updated,
                                                            }
                                                            this.twitchVideosDbState[account.id].next(twitchVideosDbEntry)
                                                            this.dbService.update('twitchVideos', twitchVideosDbEntry)
                                                          }
                                                        }
                                                      )
                                                    }
                                                  })
                                                )
                                                .subscribe()
                                            }
                                          }
                                        }
                                      })
                                    )
                                    .subscribe()
                                }
                              }
                            }
                          })
                      }
                    }
                  }
                })
              }
            })
          }
        }
      })

      this.twitchAuth.hasValidIdToken$
        .pipe(
          distinctUntilChanged(),
          switchMap((valid) => {
            if (valid) {
              return this.nameQueue$
            } else {
              return EMPTY
            }
          }),
          debounceTime(75),
          map((queue) => {
            if (queue.length) {
              const memberships: NamesDbEntry[] = []
              const payload: string[] = []
              const prefixes = ['twitchtv', 'twitch', 'ttv', 'tv']
              while (queue.length && payload.length < 101) {
                const membership = queue.shift()
                if (membership.nameObject.twitchDisplayName) {
                  let nameArray = []
                  for (const name of membership?.nameArray) {
                    if (name) {
                      let currentName = membership.nameObject.twitchDisplayName
                        .replace(/[^A-Za-z0-9_]+/gi, '')
                        .replace(/^_+|_+$/gi, '')
                        .toLowerCase()
                      if (currentName.length > 2 && currentName.length < 26) {
                        nameArray.push(currentName)
                      }
                      for (const prefix of prefixes) {
                        if (currentName && currentName?.indexOf(prefix) > -1) {
                          currentName = currentName?.replace(prefix, '').replace(/^_+|_+$/gi, '')
                          if (currentName.length > 2 && currentName.length < 26) {
                            nameArray.push(currentName)
                          }
                        }
                      }
                    }
                  }
                  nameArray = Array.from(new Set(nameArray))
                  if (payload.length + nameArray.length < 101) {
                    memberships.push({
                      nameArray,
                      membershipId: membership.membershipId,
                      nameObject: membership.nameObject,
                    })
                    for (const name of nameArray) {
                      payload.push(name)
                    }
                  } else {
                    queue.unshift(membership)
                    break
                  }
                }
              }
              this.nameQueue$.next(queue)
              const action = 'getUsers'
              const behaviorSubject = new BehaviorSubject(undefined)
              this.twitchQueue.addToQueue(action, behaviorSubject, payload)
              behaviorSubject
                .pipe(
                  map((res: { data: TwitchAccount[] }) => {
                    if (res?.data) {
                      for (const result of res?.data) {
                        for (const membership of memberships) {
                          const { membershipId, nameArray } = membership
                          const nameSet = new Set(nameArray)
                          if (nameSet.has(result.login)) {
                            if (!this.twitchAccountsDbState[membershipId]) {
                              this.twitchAccountsDbState[membershipId] = new BehaviorSubject({
                                membershipId,
                                accounts: [],
                              })
                            }
                            this.twitchAccountsDbState[membershipId]
                              .pipe(
                                take(1),
                                map((twitchAccountsDbEntry) => {
                                  const loginSet = new Set()
                                  twitchAccountsDbEntry?.accounts?.map((account) => loginSet.add(account?.login))
                                  if (!loginSet.has(result.login)) {
                                    const accounts = twitchAccountsDbEntry?.accounts || []
                                    accounts.push(result)
                                    twitchAccountsDbEntry = {
                                      membershipId,
                                      accounts,
                                    }
                                    this.twitchAccountsDbState[membershipId].next(twitchAccountsDbEntry)
                                    this.dbService.update('twitchAccounts', twitchAccountsDbEntry)
                                  }
                                })
                              )
                              .subscribe()
                          }
                        }
                      }
                    }
                  })
                )
                .subscribe()
            }
          })
        )
        .subscribe()
    })
  }

  populateStateFromDb() {
    const lastEncountered = from(this.dbService.getAll('lastEncountered')).pipe(
      map(
        (
          entries: {
            membershipId: string
            period: string
          }[]
        ) => {
          const lastEncounteredDbState = {}
          for (const entry of entries) {
            lastEncounteredDbState[entry.membershipId] = entry
          }
          this.lastEncounteredDbState.next(lastEncounteredDbState)
          return lastEncounteredDbState
        }
      )
    )
    const names = from(this.dbService.getAll('names')).pipe(
      map(
        (
          entries: {
            membershipId: string
            names: string[]
          }[]
        ) => {
          const namesDbState = {}
          for (const entry of entries) {
            namesDbState[entry.membershipId] = entry
          }
          this.namesDbState.next(namesDbState)
          return namesDbState
        }
      )
    )
    const pgcrs = from(this.dbService.getAll('pgcrs')).pipe(
      map(
        (
          entries: {
            instanceId: string
            period: string
            response: string
          }[]
        ) => {
          const pgcrsDbState = {}
          const offset = new Date(new Date().setDate(new Date().getDate() - 60))
          for (const entry of entries) {
            if (new Date(entry.period) > offset) {
              pgcrsDbState[entry.instanceId] = entry
            }
          }
          this.pgcrsDbState.next(pgcrsDbState)
          return pgcrsDbState
        }
      )
    )
    const twitchAccounts = from(this.dbService.getAll('twitchAccounts')).pipe(
      map(
        (
          entries: {
            membershipId: string
            accounts: TwitchAccount[]
          }[]
        ) => {
          for (const entry of entries) {
            if (!this.twitchAccountsDbState[entry.membershipId]) {
              this.twitchAccountsDbState[entry.membershipId] = new BehaviorSubject(entry)
            } else {
              this.twitchAccountsDbState[entry.membershipId].next(entry)
            }
          }
          return entries
        }
      )
    )
    const twitchVideos = from(this.dbService.getAll('twitchVideos')).pipe(
      map(
        (
          entries: {
            videos: TwitchVideo[]
            twitchId: string
            twitchProfileImage: string
            updated: string
          }[]
        ) => {
          const twitchVideosDbState = {}

          for (const entry of entries) {
            if (!this.twitchVideosDbState[entry.twitchId]) {
              this.twitchVideosDbState[entry.twitchId] = new BehaviorSubject(entry)
            } else {
              this.twitchVideosDbState[entry.twitchId].next(entry)
            }
          }
          return twitchVideosDbState
        }
      )
    )
    const xboxVideos = from(this.dbService.getAll('xboxVideos')).pipe(
      map(
        (
          entries: {
            videos: XboxVideo[]
            gamertag: string
            updated: string
          }[]
        ) => {
          const xboxVideosDbState = {}

          for (const entry of entries) {
            if (!this.xboxVideosDbState[entry.gamertag]) {
              this.xboxVideosDbState[entry.gamertag] = new BehaviorSubject(entry)
            } else {
              this.xboxVideosDbState[entry.gamertag].next(entry)
            }
          }
          return xboxVideosDbState
        }
      )
    )

    return forkJoin([lastEncountered, names, pgcrs, twitchAccounts, twitchVideos, xboxVideos])
  }
}
