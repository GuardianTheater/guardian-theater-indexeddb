import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { debounceTime, take } from 'rxjs/operators';
import { TwitchVideo, QueueCount, TwitchAccount } from '../types';

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

  queueCount: {
    [queue: string]: QueueCount;
  } = {
    getUsers: {
      queued: 0,
      completed: 0,
      errors: 0,
      percentage: 0,
      color: 'primary',
    },
    getVideos: {
      queued: 0,
      completed: 0,
      errors: 0,
      percentage: 0,
      color: 'primary',
    },
  };

  constructor(private http: HttpClient) {
    this.queue$.pipe(debounceTime(75)).subscribe((queueDict) => {
      for (const action of this.actionPriority) {
        const queue = queueDict[action];
        if (queue.length) {
          const nextAction = queue.shift();
          switch (action) {
            case 'getUsers':
              this.processGetUsers(nextAction.behaviorSubject, nextAction.payload);
              while (queue.length > 0 && nextAction.payload.length + queue[0].payload.length <= 100) {
                const next = queue.shift();
                this.queueCount.getUsers.queued--;
                this.updateQueue(this.queueCount.getUsers);
                nextAction.payload = [...nextAction.payload, next.payload];
              }
              this.queue$.next(queueDict);
              break;
            case 'getVideos':
              this.processGetVideos(nextAction.behaviorSubject, nextAction.payload);
              this.queue$.next(queueDict);
              break;
            default:
              console.error('invalid action');
              this.queue$.next(queueDict);
              break;
          }
          break;
        }
      }
    });
  }

  addToQueue(action: 'getUsers' | 'getVideos', behaviorSubject: BehaviorSubject<any>, payload?: any) {
    this.queue$.pipe(take(1)).subscribe((queue) => {
      let alreadyInQueue = false;
      let noNames = false;
      if (action === 'getVideos') {
        const queueSet = new Set(queue[action].map((act) => (act.payload as TwitchAccount).id));
        if (queueSet.has((payload as TwitchAccount).id)) {
          alreadyInQueue = true;
        }
      }
      if (action === 'getUsers') {
        if (!payload.length) {
          noNames = true;
        }
      }
      if (!alreadyInQueue && !noNames) {
        queue[action] = [...queue[action], { behaviorSubject, payload }];
        this.queue$.next(queue);
        this.queueCount[action].queued++;
        this.updateQueue(this.queueCount[action]);
      }
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
        this.queueCount.getUsers.completed++;
        this.updateQueue(this.queueCount.getUsers);
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
        this.queueCount.getVideos.completed++;
        this.updateQueue(this.queueCount.getVideos);
      });
  }

  updateQueue(queueCount: QueueCount) {
    queueCount.percentage = queueCount.queued ? ((queueCount.completed + queueCount.errors) / queueCount.queued) * 100 : 0;
    let activeFound = false;
    for (const action of this.actionPriority) {
      this.queueCount[action].color =
        activeFound || this.queueCount[action].queued === 0 || this.queueCount[action].percentage === 100 ? 'primary' : 'accent';
      if (this.queueCount[action].percentage > 0 && this.queueCount[action].percentage < 100) {
        activeFound = true;
      }
    }
  }
}
