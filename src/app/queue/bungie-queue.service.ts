import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { take, debounceTime } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ServerResponse } from 'bungie-api-ts/user';
import { GetPostGameCarnageReportParams } from 'bungie-api-ts/destiny2';
import { QueueCount } from '../types';

@Injectable({
  providedIn: 'root',
})
export class BungieQueueService {
  queue$ = new BehaviorSubject<{
    [action: string]: {
      actionFunction: (config: any, params: any) => Promise<ServerResponse<any>>;
      behaviorSubject: BehaviorSubject<any>;
      params: {};
    }[];
  }>({
    getMembershipDataForCurrentUser: [],
    getMembershipDataById: [],
    getProfile: [],
    getActivityHistory: [],
    getPostGameCarnageReport: [],
  });
  actionPriority = [
    'getMembershipDataForCurrentUser',
    'getMembershipDataById',
    'getProfile',
    'getActivityHistory',
    'getPostGameCarnageReport',
  ];
  queueCount: {
    [queue: string]: QueueCount;
  } = {
    getMembershipDataForCurrentUser: {
      queued: 0,
      completed: 0,
      errors: 0,
      percentage: 0,
      color: 'primary',
    },
    getMembershipDataById: {
      queued: 0,
      completed: 0,
      errors: 0,
      percentage: 0,
      color: 'primary',
    },
    getProfile: {
      queued: 0,
      completed: 0,
      errors: 0,
      percentage: 0,
      color: 'primary',
    },
    getActivityHistory: {
      queued: 0,
      completed: 0,
      errors: 0,
      percentage: 0,
      color: 'primary',
    },
    getPostGameCarnageReport: {
      queued: 0,
      completed: 0,
      errors: 0,
      percentage: 0,
      color: 'primary',
    },
  };

  constructor(private http: HttpClient) {
    this.queue$.pipe(debounceTime(100)).subscribe((queueDict) => {
      for (const action of this.actionPriority) {
        const queue = queueDict[action];
        if (action === 'getPostGameCarnageReport') {
          queue.sort((a, b) => {
            return (
              parseInt((b.params as GetPostGameCarnageReportParams).activityId, 10) -
              parseInt((a.params as GetPostGameCarnageReportParams).activityId, 10)
            );
          });
        }
        if (queue.length) {
          const nextAction = queue.shift();
          this.queue$.next(queueDict);
          nextAction
            .actionFunction(
              (config: { url: string; method: 'GET' | 'POST'; params: any; body: any }) =>
                this.http
                  .request(config.method, config.url, {
                    params: config.params,
                    body: config.body,
                  })
                  .toPromise(),
              nextAction.params
            )
            .then((res) => {
              nextAction.behaviorSubject.next(res);
              this.queueCount[action].completed++;
              this.updateQueue(this.queueCount[action]);
            })
            .catch((e) => {
              nextAction.behaviorSubject.next(e);
              this.queueCount[action].errors++;
              this.updateQueue(this.queueCount[action]);
            });
          break;
        }
      }
    });
  }

  addToQueue(action: string, actionFunction: (http: any, params?: any) => any, behaviorSubject: BehaviorSubject<any>, params?: {}) {
    this.queue$.pipe(take(1)).subscribe((queue) => {
      queue[action] = [...queue[action], { actionFunction, behaviorSubject, params }];
      this.queue$.next(queue);
      this.queueCount[action].queued++;
      this.updateQueue(this.queueCount[action]);
    });
  }

  updateQueue(queueCount: QueueCount) {
    queueCount.percentage = queueCount.queued ? ((queueCount.completed + queueCount.errors) / queueCount.queued) * 100 : 100;
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
