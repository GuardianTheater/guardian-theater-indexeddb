import { BrowserModule } from '@angular/platform-browser'
import { NgModule } from '@angular/core'
import { FlexLayoutModule } from '@angular/flex-layout'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'

import { HttpClientModule } from '@angular/common/http'

import { BungieAuthModule } from './auth/bungie-auth/bungie-auth.module'
import { TwitchAuthModule } from './auth/twitch-auth/twitch-auth.module'

import { NgxIndexedDBModule } from 'ngx-indexed-db'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { ManifestPipe } from './manifest/manifest.pipe'
import { TwitchPipe } from './pipes/twitch.pipe'

@NgModule({
  declarations: [AppComponent, ManifestPipe, TwitchPipe],
  imports: [
    HttpClientModule,
    BrowserModule,
    AppRoutingModule,
    BungieAuthModule,
    TwitchAuthModule,
    FlexLayoutModule,
    NgxIndexedDBModule.forRoot({
      name: 'GtDb',
      version: 1,
      objectStoresMeta: [
        {
          store: 'pgcrs',
          storeConfig: {
            keyPath: 'instanceId',
            autoIncrement: false,
          },
          storeSchema: [
            {
              name: 'instanceId',
              keypath: 'instanceId',
              options: {
                unique: true,
              },
            },
            {
              name: 'period',
              keypath: 'period',
              options: {
                unique: false,
              },
            },
            {
              name: 'response',
              keypath: 'response',
              options: {
                unique: false,
              },
            },
          ],
        },
        {
          store: 'lastEncountered',
          storeConfig: {
            keyPath: 'membershipId',
            autoIncrement: false,
          },
          storeSchema: [
            {
              name: 'membershipId',
              keypath: 'membershipId',
              options: {
                unique: true,
              },
            },
            {
              name: 'period',
              keypath: 'period',
              options: {
                unique: false,
              },
            },
          ],
        },
        {
          store: 'names',
          storeConfig: {
            keyPath: 'membershipId',
            autoIncrement: false,
          },
          storeSchema: [
            {
              name: 'membershipId',
              keypath: 'membershipId',
              options: {
                unique: true,
              },
            },
            {
              name: 'nameArray',
              keypath: 'nameArray',
              options: {
                unique: false,
              },
            },
            {
              name: 'nameObject',
              keypath: 'nameObject',
              options: {
                unique: false,
              },
            },
          ],
        },
        {
          store: 'twitchAccounts',
          storeConfig: {
            keyPath: 'membershipId',
            autoIncrement: false,
          },
          storeSchema: [
            {
              name: 'membershipId',
              keypath: 'membershipId',
              options: {
                unique: true,
              },
            },
            {
              name: 'accounts',
              keypath: 'accounts',
              options: {
                unique: false,
              },
            },
          ],
        },
        {
          store: 'twitchVideos',
          storeConfig: {
            keyPath: 'twitchId',
            autoIncrement: false,
          },
          storeSchema: [
            {
              name: 'twitchId',
              keypath: 'twitchId',
              options: {
                unique: true,
              },
            },
            {
              name: 'lastUpdated',
              keypath: 'lastUpdated',
              options: {
                unique: false,
              },
            },
            {
              name: 'videos',
              keypath: 'videos',
              options: {
                unique: false,
              },
            },
          ],
        },
      ],
    }),
    BrowserAnimationsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
