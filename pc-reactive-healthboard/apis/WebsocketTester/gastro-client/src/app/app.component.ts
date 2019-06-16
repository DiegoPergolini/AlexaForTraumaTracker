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
  room = 'gastroenterologia1'
  examState = '-'
  examStartTime = '-'
  examEndTime = '-'

  constructor(private webSocket: WebsocketService) {
    let observable = webSocket.create("https://reactive-gastro.herokuapp.com/gastro-events", this.room)
    
    observable.subscribe(msg => {
      console.log("Response from websocket: " + msg);

      if (msg.body.tipoComando == 'inizioEsame') {
        this.examState = 'IN CORSO'
        this.examStartTime = new Date().toLocaleTimeString()
        this.examEndTime = '-'
      }

      if (msg.body.tipoComando == 'fineEsame') {
        this.examState = 'CONCLUSO'
        this.examEndTime = new Date().toLocaleTimeString()
      }
    });
  }
}
