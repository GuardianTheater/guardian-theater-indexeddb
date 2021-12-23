import { Injectable } from '@angular/core'
import { BehaviorSubject, combineLatest, interval } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { switchMap, take, debounce, distinctUntilChanged } from 'rxjs/operators'
import { XboxVideo, QueueCount } from '../types'
import { XboxAuthService } from '../auth/xbox-auth/xbox-auth.service'

@Injectable({
  providedIn: 'root',
})
export class XboxQueueService {
  queue$ = new BehaviorSubject<{
    [action: string]: {
      behaviorSubject: BehaviorSubject<any>
      payload: any
    }[]
  }>({
    getVideos: [],
  })
  actionPriority = ['getVideos']

  queueCount: {
    [queue: string]: QueueCount
  } = {
    getVideos: {
      queued: 0,
      completed: 0,
      errors: 0,
      percentage: 0,
      color: 'primary',
      rateLimited: false,
    },
  }
  debounce = new BehaviorSubject(500)
  interval = this.debounce.pipe(
    distinctUntilChanged(),
    switchMap((i) => interval(i))
  )

  constructor(private http: HttpClient, private xboxAuth: XboxAuthService) {
    combineLatest([this.queue$, this.xboxAuth.hasValidIdToken$])
      .pipe(debounce(() => this.interval))
      .subscribe(([queueDict, hasValidIdToken]) => {
        if (hasValidIdToken) {
          for (const action of this.actionPriority) {
            const queue = queueDict[action]
            if (queue.length) {
              const nextAction = queue.splice(Math.floor(Math.random() * queue.length), 1)[0]
              switch (action) {
                case 'getVideos':
                  this.processGetVideos(nextAction.behaviorSubject, nextAction.payload)
                  this.queue$.next(queueDict)
                  break
                default:
                  console.error('invalid action')
                  this.queue$.next(queueDict)
                  break
              }
              break
            }
          }
        }
      })
  }

  addToQueue(action: 'getVideos', behaviorSubject: BehaviorSubject<any>, payload?: any) {
    this.queue$.pipe(take(1)).subscribe((queue) => {
      let alreadyInQueue = false
      if (action === 'getVideos') {
        const queueSet = new Set(queue[action].map((act) => act.payload))
        if (queueSet.has(payload)) {
          alreadyInQueue = true
        }
      }
      if (!alreadyInQueue) {
        queue[action] = [...queue[action], { behaviorSubject, payload }]
        this.queue$.next(queue)
        this.queueCount[action].queued++
        this.updateQueue(this.queueCount[action])
      }
    })
  }

  processGetVideos(behaviorSubject: BehaviorSubject<any>, gamertag: string) {
    if (this.queueCount.getVideos.rateLimited) {
      this.queueCount.getVideos.errors++
      this.updateQueue(this.queueCount.getVideos)
    } else {
      this.http.get(`https://xapi.dustinrue.com/destiny2/${gamertag}`).subscribe(
        (res: { clips: { gameClips: XboxVideo[]; status: string; numResults: number } }) => {
          behaviorSubject.next(res)
          this.queueCount.getVideos.completed++
          this.updateQueue(this.queueCount.getVideos)
        },
        (err) => {
          if (err.status === 500) {
            behaviorSubject.next(err)
            this.queueCount.getVideos.completed++
            this.updateQueue(this.queueCount.getVideos)
          } else {
            if (err.status === 429) {
              try {
                console.log((err.error.periodInSeconds / err.error.maxRequests) * 1000)
                this.debounce.next((err.error.periodInSeconds / err.error.maxRequests) * 1000 + 100)
                if ((err.error.periodInSeconds / err.error.maxRequests) * 1000 + 100 > 10000) {
                  this.queueCount.getVideos.rateLimited = true
                }
              } catch {
                this.queueCount.getVideos.rateLimited = true
              }
            }
            behaviorSubject.next(err)
            this.queueCount.getVideos.errors++
            this.updateQueue(this.queueCount.getVideos)
          }
        }
      )
    }
  }

  updateQueue(queueCount: QueueCount) {
    queueCount.percentage = queueCount.queued ? ((queueCount.completed + queueCount.errors) / queueCount.queued) * 100 : 0
    let activeFound = false
    for (const action of this.actionPriority) {
      this.queueCount[action].color =
        activeFound || this.queueCount[action].queued === 0 || this.queueCount[action].percentage === 100 ? 'primary' : 'accent'
      if (this.queueCount[action].percentage > 0 && this.queueCount[action].percentage < 100) {
        activeFound = true
      }
    }
  }
}
