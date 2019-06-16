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

  constructor(private webSocket: WebsocketService) {
    let observable = webSocket.create("https://reactive-smartscreen.herokuapp.com/smart-screen-events", this.room)
    
    observable.subscribe(msg => {
      console.log("Response from websocket: " + msg);

      if (msg.body.tipoComando == 'visualizzaInformazioni') {
        alert('Richiesta Visualizzazione Info Arrivata')
      }
    });
  }
}
