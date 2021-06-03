import { DestinyPostGameCarnageReportData, DestinyPostGameCarnageReportEntry } from 'bungie-api-ts/destiny2'
import { Observable } from 'rxjs'

export interface QueueCount {
  queued: number
  completed: number
  errors: number
  percentage: number
  color: 'primary' | 'accent' | 'warn'
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
  twitchClips?: Observable<TwitchVideo[]>
  entries: DestinyPostGameCarnageReportEntryExtended[]
  watching?: boolean
}
export interface DestinyPostGameCarnageReportEntryExtended extends DestinyPostGameCarnageReportEntry {
  twitchClips?: Observable<TwitchVideo[]>
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
