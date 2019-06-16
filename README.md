![Alexa For trauma Tracker Logo](https://github.com/DiegoPergolini/AlexaForTraumaTracker/blob/master/images/logo.png?raw=true)
# Alexa For Trauma Tracker
## Introduzione
I medici dell'Ospedale Bufalini di Cesena vorrebbero interagire vocalmente con i sistemi di ausilio alle loro attività, sopratutto in quelle situazioni critiche dove poter disporre di un interazione hands-free con le applicazioni è fondamentale. L'ambito più importante è infatti proprio quello della Trauma Room, dove è già presente l'applicazione Trauma Tracker, tramite la quale è possibile registrare tutti gli eventi legati al trattamento di un caso d'emergenza, utilizzando però l'interfaccia grafica di un tablet, rendendo necessaria un'interazione fisica.<br/>
Sebbene quello citato rappresenti il contesto dove, al momento, l'opportunità è più evidente ed immediata, in generale ogni stanza d'ospedale potrebbe offrire un'interazione vocale attraverso il cui utilizzare i suoi servizi peculiari. 
L'obbiettivo è quindi quello di realizzare un sistema che permetta di interagire tramite comandi vocali con i servizi presenti, al momento o in futuro, in ospedale utilizzando Amazon Alexa come tecnologia abilitante.<br/>
Al momento i servizi con cui è richiesta l'integrazione sono Trauma Tracker e l'applicazione per comandare gli Smart Screen, il sistema dovrà essere però realizzato in modo che sia facile aggiungere nuove funzionalità. Il sistema dovrà esser capace di fornire funzionalità vocali diverse in base alla stanza d'ospedale in cui viene utilizzato.
## Istruzioni
Di seguito le istruzioni da seguire se si vuole riprodurre il sistema da noi realizzato.
## Creare una Skill Alexa e relativa Lambda Function
I passi qui descritti sono riguardanti la Skill Trauma Tracker, ma lo stesso identico discorso vale per le altre Skill realizzate, cambiando solo i file da utilizzare.
- La creazione di una Skill Alexa è molto semplice, per farlo bisogna però dotarsi di un account Alexa Developer, facilmente ottenibile tramite apposita registrazione. Una volta ottenuto l'account per creare una Skill basta seguire i semplici passi illustrati in questa [Guida Creazione Skill](https://developer.amazon.com/docs/devconsole/create-a-skill-and-choose-the-interaction-model.html) fornita da Amazon. A titolo esemplificativo riportiamo uno [screenshot](https://github.com/DiegoPergolini/AlexaForTraumaTracker/tree/master/images/AlexaConsoleJsonEditor.png) della dashboard

- Una volta inizializzata la Skill essa dovrà essere fornita di un modello d'interazione, questo modello d'interazione è totalmente configurabile tramite l'Alexa Developer Console. Dato che il modello d'interazione è già stato definito da noi esso può essere copiato dal file [InteractionModel.json](https://github.com/DiegoPergolini/AlexaForTraumaTracker/tree/master/alexa/TraumaTracker/InteractionModel.json) nel caso si voglia ricreare la Skill per TraumaTracker. Il contenuto di questo file dovrà essere incollato nella sezione JSON Editor nella dashboard relativa alla propria skill. A questo punto cliccando sul pulsante Save Model verranno mostrati tutti gli Intent ideati nel modello d'interazione. Per informazioni sul funzionamento degli intent si rimanda alla [guida](https://developer.amazon.com/docs/custom-skills/create-the-interaction-model-for-your-skill.html) di Amazon.

- A questo punto è fondamentale creare una Lambda Function di AWS in modo da poter specificare l'endpoint a cui la Skill si deve rivolgere per gestire la logica applicativa. Per creare una Skill si dovrà accedere al pannello relativo alla Lambda Management Console e cliccare sul pulsante Create Function, una volta aperta la nuova schermata si dovrà selezione l'opzione __Browse serverless app repository__, cercare l'app _alexa-skills-kit-nodejs-factskill_ e selezionarla. A questo punto si può dare il nome che si preferisce e si può fare il deploy.<br/>Ora si potrà incollare il codice presente nel file [index.js](https://github.com/DiegoPergolini/AlexaForTraumaTracker/tree/master/alexa/TraumaTracker/lambda/index.js) sostituendo tutto il contenuto dell'omonimo file index.js (sempre nel caso Trauma Tracker) presente al momento nella Lambda Function appena creata. A questo punto si può salvare e fare il deploy. <br/> l'unica modifica da apportare rispetto al codice fornito riguarda l'indirizzo dei microservizi a cui si rivolge la lambda per svolgere il suo compito, che sarà ovviamente diverso da quelli da noi utilizzati.

- A questo punto, dopo aver copiato l'indirizzo ARN della lambda function creata, lo si potrà incollare nella sezione __Endpoint__ della Alexa Developer Console. Compiuto questo passo di potrà fare la build del modello e dopo pochi minuti il sistema segnalerà l'effettiva messa in funzione.

_Si ricorda che per utilizzare le skill nei propri dispositivi Alexa Abilitated bisogna utilizzare lo __stesso__ account sia per la creazione delle Skill che per la configurazione dei Device (ad esempio Echo Plus)._
## Riprodurre i microservizi
La logica del sistema è all'interno dei microservizi realizzati, che sono 5:
- __trauma-vocal-microservice__: microservizio adibito alla gestione dei comandi vocali inerenti alla trauma-room
- __gastro-vocal-microservice__: microservizio adibito alla gestione dei comandi vocali inerenti alla gastroenterologia
- __smartscreen-vocal-microservice__: microservizio adibito alla gestione dei comandi vocali inerenti alla visualizzazione su schermo
- __hospital-vocal-microservice__: microservizio che realizza una piccola forma di smart environment. Attualmente questo microservizio permette ad un Alexa di ottenere le proprie funzionalità
- __events-microservice__: microservizio che si occupa di collezionare tutti i comandi provenienti dagli altri microservizi

In seguito verranno mostrati i passi da seguire per poter riprodurre il sistema formato dai microservizi:

- Di per sè tali microservizi sono totalmente funzionanti in locale, tuttavia, se si vuole testare l'integrazione con Alexa occorre che siano raggiungibili su un'indirizzo pubblico. Nel nostro caso è stato utilizzato Heroku come PaaS.

- __Configurazione parametri__: per ogni microserizio, all'interno della cartella _"src/main/resources"_ è presente un file di configurazione, _config.json_, all'interno del quale è possibile specificare i parametri di accesso a servizi esterni. 
 
- __Configurazione database__: Per quanto riguarda la storicizzazione dei dati è stato utilizzato un database di tipo NoSQL, in particolare DynamoDB.
Per poterlo utilizzare è necessario specificare _client-id_ e _client-secret_ del proprio database.
Per poter replicare il database le istruzioni sono mostrate nel file [Tables](https://github.com/DiegoPergolini/AlexaForTraumaTracker/tree/master/Tables.md).

- __Configurazione Kafka__: i microservizi comunicano tra loro mediante una piattaforma, denominata Kafka.
Per poterla utilizzare è necessario specificare _username_ e _password_ del proprio account e la lista di _broker_.

## Aggiungere/modificare microservizi
Se si intende introdurre nuove funzionalità, esterne a ciò che è già presente, occorrerà aggiungere nuovi moduli che saranno quindi dei microservizi aggiuntivi che estenderanno il sistema esistente.
Altrimenti è possibile ampliare i microservizi esistenti, modificandone l'interfaccia. Infatti la comunicazione fra le _lambda_ AWS e i microservizi avviene mediante REST-API, perciò se si vogliono aggiungere funzioni è possibile intervenire direttamente su queste, aggiungendo un metodo REST al _router_ e associando l'handler desiderato.
Per dettagli aggiuntivi riguardo la REST-API dei servizi si rimana all'apposito file Swagger.

## Uso dei microservizi
I microservizi presenti espongono due principali modalità di interazione verso l'utilizzatore:
- __WebSocket__: Riguarda la modalità standard di interazione, in questo caso caso è possibile collegarsi all'event bus di un determinato microservizio, specificando l'id della stanza come topic. In questo modo verranno ricevuti in maniera totalmente asincrona tutti i comandi relativi a tale funzionalità.
Ad esempio, se si intende ottenere tutti i comandi relativi al trauma per la stanza _trauma-room1_ ci si rivolge al microserizio _trauma-vocal-microservice_ con topic _trauma-room1_.
Per potersi registrare agli eventi è possibile utilizzare una funzionalità di Vert.x, _SockJS Service Proxy_, la quale permette di creare client in applicazioni esterne (ad esempio Node.js) agganciandosi all'event-bus di Vert.x.
La semantica dei messaggi scambiati può essere dedotta dalle tabelle del DB mostrate in precedenza
In seguito è riportato un esempio in Node.js:
```javascript
var eventbus = new vertx.EventBus('host-address')
eventbus.onopen = function () {
    eventbus.registerHandler(topic, function (message, _) {
        console.log("Reactive trauma " + message)
    })
}
```
- __REST-API__: Ricopre tutti i casi in cui non siano sufficienti le WebSocket. Questa API offre principalmente due metodi pubblici:
 - __GET(commands)__: un metodo GET che permette di ottenere tutti i comandi, data una certa stanza, una data di inizio e di fine. Questo comando attualmente è presente solamente nel microservizio _trauma-vocal-microservice_, tuttavia è pensato per essere esposto da tutti e 5.

La struttura del metodo è quindi la seguente:
```
GET("/commands?roomId=_&fromDate=_&toDate=_")
```
 - __PUT(slot)__: un metodo PUT che permette di aggiungere uno slot dinamicamente ad una tipologia di comandi del trauma. Questo metodo riguarda esclusivamente il _trauma-vocal-microservice_. 
 
 Prevede di specificare nel _body_ del metodo la tipologia di comando e il nome del nuovo slot.
 
 La struttura del metodo è quindi la seguente:
```
PUT("/slot")
```

In seguito è riportato un esempio del _body_:
```json
{
  "slotName": "FARMACI", 
  "value": "aspirina"
}
```


## Uso delle Skill
Riguardo a come interagire vocalmente con le Skill Alexa si fa riferimento alla sezione 5 della nostra [relazione](https://github.com/DiegoPergolini/AlexaForTraumaTracker/tree/master/Alexa_For_Trauma_Tracker.pdf) di progetto.
