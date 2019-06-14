
const Alexa = require('ask-sdk');
var https = require("https");
const welcomeOutput = "Benvenuto in smart hospital";
const welcomeReprompt = "Se vuoi puoi chiedere maggiori informazioni, tramite il comando aiuto";
const helpOutput = "Puoi chiedere informazioni"
const noRoomInfoMsg = "Mi dispiace, non ho nessuna informazione su questa stanza";
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
function getFunctionalitiesOptions(deviceId) {
  return{
  "method": "GET",
  "hostname": "reactive-hospital.herokuapp.com",
  "port": 443,
  "path": "/api/functionalities?deviceId="+encodeURIComponent(deviceId)
  }
}

const persistenceAdapter = new DynamoDbPersistenceAdapter({
  tableName: 'Smart_Hospital',
  createTable: true
});

const RoomAbilitiesIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'RoomAbilitiesIntent';
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
    const options = getFunctionalitiesOptions(deviceId);
    const functionalitiesIncipit = " ed espone queste funzionalità: ";
    const noFunctionalitiesIncipit = "E non ha nessuna funzionalità attivabile tramite comandi vocali";
    const body = JSON.stringify({});
    console.log(options);
    return getRequestWithPromise(handlerInput,options,body).then( async function(alexaIdentity){
      const roomInfo = JSON.parse(alexaIdentity);
      console.log(roomInfo);
      var builder = []

      builder.push("Questa è la stanza ",roomInfo.roomName);
      const roomInfoIncipit = roomInfo.functionalities.length >0?functionalitiesIncipit:noFunctionalitiesIncipit;
      builder.push(roomInfoIncipit);
      roomInfo.functionalities.forEach(function(functionality){
          builder.push('<break strength="strong"/>',functionality.description);
      });
      const speechOutput = builder.join("");
      return responseBuilder
        .speak(speechOutput)
        .getResponse(); 
    }).catch(err=>{
      console.log(err);
      return responseBuilder
        .speak(noRoomInfoMsg)
        .getResponse(); 
    })
  },
}; 

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    return responseBuilder
      .speak(welcomeOutput)
      .reprompt(welcomeReprompt)
      .getResponse();
  },
};

const AmazonHelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    return responseBuilder
      .speak(helpOutput)
      .reprompt(helpOutput)
      .getResponse();
  },
};

const AmazonCancelStopNoHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' &&
      (request.intent.name === 'AMAZON.CancelIntent' ||
        request.intent.name === 'AMAZON.NoIntent' ||
        request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const speechOutput = 'Okay, chiudo Smart Hospital';

    return responseBuilder
      .speak(speechOutput)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const SessionEndedHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    request.save
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const request = handlerInput.requestEnvelope.request;

    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
    console.log(`Error handled: ${error}`);

    return handlerInput.responseBuilder
      .speak('Mi dispiace, non ho trovato informazioni su questa stanza?')
      .reprompt('Puoi chiedere informazioni con il comando: aiuto')
      .getResponse();
  },
};
function getRequestWithPromise(handlerInput,options,data){
   return new Promise((resolve, reject) => {
      var req = https.request(options, function(res) {
      console.log('Status: ' + res.statusCode);
      console.log('Headers: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      if(res.statusCode !== 200){
        reject(res.statusCode);
      }
      res.on('data', function (body) {
        console.log('Body: ' + body);
        resolve(body);
      });
    });
    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
      reject(e);
    });
    // console.log("Faccio richiesta");
    // write data to request body
    req.write(data);
    req.end();
    });
}
const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    RoomAbilitiesIntentHandler,
    LaunchRequestHandler,
    AmazonCancelStopNoHandler,
    AmazonHelpHandler,
    SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .withPersistenceAdapter(persistenceAdapter)
  .lambda();