import { Component } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { elementStart } from '@angular/core/src/render3';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [WebsocketService]
})
export class AppComponent {
  title = 'trauma-client';
  room = 'traumaroom1'
  elements = [];

  private feedStream;

  constructor(private webSocket: WebsocketService) {
     let observable = webSocket.create("https://reactive-trauma.herokuapp.com/trauma-events", this.room)
    
     this.feedStream = observable.subscribe(msg => {
      console.log("Response from websocket: " + msg);
      delete msg.body.deviceId;
      this.elements.push(JSON.stringify(msg.body, null, 4));
    });
  }

  public changeRoom() {
    this.feedStream.unsubscribe();
    this.room = this.room == 'traumaroom1' ? "tacps" : 'traumaroom1'; 
    console.log(this.room);
    let observable = this.webSocket.create("https://reactive-trauma.herokuapp.com/trauma-events", this.room);
    
    this.feedStream = observable.subscribe(msg => {
      console.log("Response from websocket: " + msg);
      delete msg.body.deviceId;
      this.elements.push(JSON.stringify(msg.body, null, 4));
    });
  }
}
