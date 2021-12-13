import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { debounceTime, take } from 'rxjs/operators'
import { XboxVideo, QueueCount } from '../types'

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
    },
  }

  constructor(private http: HttpClient) {
    this.queue$.pipe(debounceTime(75)).subscribe((queueDict) => {
      for (const action of this.actionPriority) {
        const queue = queueDict[action]
        if (queue.length) {
          const nextAction = queue.shift()
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
    })
  }

  addToQueue(action: 'getVideos', behaviorSubject: BehaviorSubject<any>, payload?: any) {
    this.queue$.pipe(take(1)).subscribe((queue) => {
      let alreadyInQueue = false
      let noNames = false
      if (action === 'getVideos') {
        const queueSet = new Set(queue[action].map((act) => act.payload))
        if (queueSet.has(payload)) {
          alreadyInQueue = true
        }
      }
      if (!alreadyInQueue && !noNames) {
        queue[action] = [...queue[action], { behaviorSubject, payload }]
        this.queue$.next(queue)
        this.queueCount[action].queued++
        this.updateQueue(this.queueCount[action])
      }
    })
  }

  processGetVideos(behaviorSubject: BehaviorSubject<any>, gamertag: string) {
    this.http
      .get(`https://xapi.dustinrue.com/gameclips/gamertag/${gamertag}/titleid/144389848`)
      .subscribe((res: { gameClips: XboxVideo[]; status: string; numResults: number }) => {
        behaviorSubject.next(res)
        this.queueCount.getVideos.completed++
        this.updateQueue(this.queueCount.getVideos)
      })
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
