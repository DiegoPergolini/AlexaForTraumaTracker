# Tabelle Database
In qesto documento verranno mostrate e spiegate le tabelle che compongono il database.
Trattandosi di un database NoSQL gli elementi sono storicizzati sotto forma di JSON; 
inoltre gli stessi elementi che si trovano nel database vengono utilizzati così come sono nell'interazione fra lambda AWS e microservizi.

Nelle varie tabelle vengono utilizzati i termini _deviceId_ e _skillId_ per indicare lo stesso ID. Esso si riferisce all'id della skill di un dispositivo, non del dispositivo stesso (il quale non viene messo a disposizione). Perciò ogni skill avrà id differente.

### TraumaVocalStorage
Questa tabella contiene i comandi relativi al trauma.

- __chiave di partizione__: roomId
- __chiave di ordinamento__: timestamp
- Esempio:
```json
{
  "deviceId": "amzn1.ask.device._",
  "dosaggio": {
    "misura": "ml",
    "quantità": "500"
  },
  "nome": "CRISTALLOIDI",
  "roomId": "traumaroom1",
  "tag": "TraumaTracking",
  "timestamp": 1560502599,
  "tipoComando": "farmaco",
  "tipoFarmaco": "Infusioni"
}
```

### GastroVocalStorage
Questa tabella contiene i comandi relativi alla gastroenterologia.

- __chiave di partizione__: roomId
- __chiave di ordinamento__: timestamp
- Esempio:
```json
{
  "deviceId": "amzn1.ask.device._",
  "roomId": "gastroenterologia1",
  "tag": "Gastroenterologia",
  "timestamp": 1558191348,
  "tipoComando": "inizioEsame"
}
```

### SmartScreenVocalStorage
Questa tabella contiene i comandi relativi alla visualizzazione su schermo.

- __chiave di partizione__: roomId
- __chiave di ordinamento__: timestamp
- Esempio:
```json
{
  "deviceId": "amzn1.ask.device._",
  "roomId": "gastroenterologia1",
  "tag": null,
  "timestamp": 1558192078,
  "tipoComando": "visualizzaInformazioni"
}
```

### VocalEventSource
Questa tabella contiene tutti i comandi provenienti da tutti gli altri micro-servizi.

- __chiave di partizione__: deviceId
- __chiave di ordinamento__: timestamp
- Esempio:
```json
{
  "deviceId": "amzn1.ask.device._",
  "event": {
    "deviceId": "amzn1.ask.device._",
    "roomId": "gastroenterologia1",
    "tag": "Gastroenterologia",
    "timestamp": 1558519756,
    "tipoComando": "inizioEsame"
  },
  "timestamp": 1558519756
}
```
### AlexaFunctionalities
Questa tabella permette di associare ad un deviceId la lista di funzionalità che è in grado di soddisfare.

- __chiave di partizione__: deviceId
- __chiave di ordinamento__: -
- Esempio:
```json
{
  "deviceId": "amzn1.ask.device._",
  "functionalities": [
    {
      "description": "Questa è una trauma room, puoi aprire la skill apposita  dicendo: Alexa apri trauma <break strength='strong'/>. In questa stanza potra registrare l'esecuzione di manovre, di diagnostiche o la somministrazione di farmaci.",
      "tag": "TraumaTracking"
    },
    {
      "description": "In questa stanza è presente uno smart screen, puoi aprire la skill per comandarlo tramite comandi vocali dicendo: Alexa apri comandi schermo",
      "tag": "SmartScreen"
    }
  ],
  "roomName": "Trauma Room 1"
}
```

### SkillMapping
Questa tabella contiene informazioni utili di ogni skill.

- __chiave di partizione__: skillId
- __chiave di ordinamento__: -
- Esempio:
```json
{
  "descrizione": "Echo Dot",
  "functionality": "Gastroenterologia",
  "roomName": "Gastroenterologia 1",
  "skillId": "amzn1.ask.device._"
}
```

### TraumaTrackerAdditionalSlots
Questa tabella contiene, per ogni tipologia di comando relativa al trauma, gli slot che possono essere aggiunti dinamicamente al sistema.

- __chiave di partizione__: name
- __chiave di ordinamento__: -
- Esempio:
```json
{
  "name": "DIAGNOSTICA",
  "values": [
    {
      "name": {
        "value": "RAGGI"
      }
    }
  ]
}
```

### DefaultFarmaci
Questa tabella contiene i parametri default dei farmaci, in modo tale che quando non vengono specificati si utilizzano tali valori.

- __chiave di partizione__: nome
- __chiave di ordinamento__: -
- Esempio:
```json
{
  "dosaggio": {
    "misura": "g",
    "quantità": "1"
  },
  "nome": "ACIDO TRANEXAMICO",
  "tipoFarmaco": "Farmaci Generici"
}
```
