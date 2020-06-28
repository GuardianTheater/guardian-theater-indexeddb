import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { debounceTime, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class TwitchQueueService {
  queue$ = new BehaviorSubject<{
    [action: string]: {
      behaviorSubject: BehaviorSubject<any>;
      payload: any;
    }[];
  }>({
    getVideos: [],
    getUsers: [],
  });
  actionPriority = ['getVideos', 'getUsers'];

  constructor(private http: HttpClient) {
    this.queue$.pipe(debounceTime(75)).subscribe((queueDict) => {
      for (const action of this.actionPriority) {
        const queue = queueDict[action];
        if (queue.length) {
          const nextAction = queue.shift();
          this.queue$.next(queueDict);
          switch (action) {
            case 'getUsers':
              this.processGetUsers(nextAction.behaviorSubject, nextAction.payload);
              break;
            case 'getVideos':
              this.processGetVideos(nextAction.behaviorSubject, nextAction.payload);
              break;
            default:
              console.error('invalid action');
              break;
          }
          break;
        }
      }
    });
  }

  addToQueue(action: 'getUsers' | 'getVideos', behaviorSubject: BehaviorSubject<any>, payload?: {}) {
    this.queue$.pipe(take(1)).subscribe((queue) => {
      queue[action] = [...queue[action], { behaviorSubject, payload }];
      this.queue$.next(queue);
    });
  }

  processGetUsers(behaviorSubject: BehaviorSubject<any>, names: string[]) {
    let url = 'https://api.twitch.tv/helix/users?';
    if (names.length) {
      for (const name of names) {
        url = `${url}login=${encodeURIComponent(name)}&`;
      }
      this.http.get(url).subscribe((res: { data: TwitchAccount[] }) => {
        behaviorSubject.next(res);
      });
    }
  }

  processGetVideos(behaviorSubject: BehaviorSubject<any>, account: TwitchAccount) {
    this.http
      .get('https://api.twitch.tv/helix/videos', {
        params: {
          user_id: account.id,
          first: '100',
        },
      })
      .subscribe((res: { data: TwitchVideo[]; pagination: { cursor: string } }) => {
        behaviorSubject.next(res);
      });
  }
}

export interface TwitchAccount {
  broadcaster_type: string;
  description: string;
  display_name: string;
  id: string;
  login: string;
  offline_image_url: string;
  profile_image_url: string;
  type: string;
  view_count: number;
}

export interface TwitchVideo {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: string;
  view_count: number;
  language: string;
  type: string;
  duration: string;
  offset?: string;
}
