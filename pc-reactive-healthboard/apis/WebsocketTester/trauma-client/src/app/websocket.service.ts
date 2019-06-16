import { Injectable } from "@angular/core";
import *  as Rx from 'rxjs'
import * as EventBus from 'vertx3-eventbus-client'

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  constructor() {}

  public create(url, topic): Rx.Observable<any> {

    let ws = new EventBus(url)

    let obs = new Rx.Observable<any>(observer => {
      ws.onopen = function () {
        ws.registerHandler(topic, {}, function (_, message) {
            console.log("Reactive trauma " + message)
            observer.next(message)
        })
      }
    })
    
    return obs;
  }
}