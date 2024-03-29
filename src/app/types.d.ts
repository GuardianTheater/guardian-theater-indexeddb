import { DestinyPostGameCarnageReportData, DestinyPostGameCarnageReportEntry } from 'bungie-api-ts/destiny2'
import { Observable } from 'rxjs'

export interface QueueCount {
  queued: number
  completed: number
  errors: number
  percentage: number
  color: 'primary' | 'accent' | 'warn'
  rateLimited?: boolean
}

export interface TwitchAccount {
  broadcaster_type: string
  description: string
  display_name: string
  id: string
  login: string
  offline_image_url: string
  profile_image_url: string
  type: string
  view_count: number
}

export interface TwitchVideo {
  id: string
  user_id: string
  user_name: string
  title: string
  description: string
  created_at: string
  published_at: string
  url: string
  thumbnail_url: string
  viewable: string
  view_count: number
  language: string
  type: string
  duration: string
  twitchProfileImage?: string
  offset?: string
  play?: boolean
  matchType?: Observable<NameMatchTypes>
}

export interface XboxVideo {
  gameClipId: string
  state: string
  datePublished: string
  dateRecorded: string
  lastModified: string
  userCaption: string
  type: string
  durationInSeconds: number
  scid: string
  titleId: number
  rating: number
  ratingCount: number
  views: number
  titleData: string
  systemProperties: string
  savedByUser: string
  achievementId: string
  greatestMomentId: string
  thumbnails: [
    {
      uri: string
      fileSize: number
      thumbnailType: string
    },
    {
      uri: string
      fileSize: number
      thumbnailType: string
    }
  ]
  gameClipUris: [
    {
      uri: string
      fileSize: number
      uriType: string
      expiration: string
    }
  ]
  xuid: string
  clipName: string
  titleName: string
  gameClipLocale: string
  clipContentAttributes: string
  deviceType: string
  commentCount: number
  likeCount: number
  shareCount: number
  partialViews: number
  play?: boolean
}

export type NameMatchTypes =
  | 'displayName'
  | 'fbDisplayName'
  | 'blizzardDisplayName'
  | 'psnDisplayName'
  | 'xboxDisplayName'
  | 'stadiaDisplayName'
  | 'steamDisplayName'
  | 'twitchDisplayName'

export interface DestinyPostGameCarnageReportDataExtended extends DestinyPostGameCarnageReportData {
  twitchVideos?: Observable<TwitchVideo[]>
  xboxVideos?: Observable<XboxVideo[]>
  entries: DestinyPostGameCarnageReportEntryExtended[]
  watching?: boolean
}
export interface DestinyPostGameCarnageReportEntryExtended extends DestinyPostGameCarnageReportEntry {
  twitchVideos?: Observable<TwitchVideo[]>
  xboxVideos?: Observable<XboxVideo[]>
  namesDbEntry?: Observable<NamesDbEntry>
}

export interface NamesDbEntry {
  membershipId: string
  nameArray: string[]
  nameObject: {
    displayName?: string
    fbDisplayName?: string
    blizzardDisplayName?: string
    psnDisplayName?: string
    xboxDisplayName?: string
    stadiaDisplayName?: string
    steamDisplayName?: string
    twitchDisplayName?: string
  }
}
