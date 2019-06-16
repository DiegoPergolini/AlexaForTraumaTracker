# Tabelle Database
In qesto documento verranno mostrate e spiegate le tabelle che compongono il database.
Trattandosi di un database NoSQL gli elementi sono storicizzati sotto forma di JSON; 
inoltre gli stessi elementi che si trovano nel database vengono utilizzati così come sono nell'interazione fra lambda AWS e microservizi.

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
