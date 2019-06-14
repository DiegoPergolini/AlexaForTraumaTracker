/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
var https = require("https");
const welcomeOutput = "Benvenuto in Smart Screen";
const welcomeReprompt = "Se vuoi puoi chiedere maggiori informazioni, tramite il comando aiuto";
const helpOutput = "Con questa skill puoi comandare vocalmente lo smart screen presente in questa stanza";
const errorOutput = 'Errore, prova a ripetere'

const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const persistenceAdapter = new DynamoDbPersistenceAdapter({
  tableName: 'Smart_Screen',
  createTable: true
});

const skillTag = "SmartScreen";

function getPostOptions(path,hostname="reactive-smartscreen.herokuapp.com"){
  return{
          "method": "POST",
          "hostname": hostname,
          "port": 443,
          "path": "/api/"+path,
          "headers": {
            "Content-Type": "application/json"
          }  
       }
}
const visualizzaInformazioniOptions=getPostOptions("visualizzaInformazioni");
const abilitationTimeout = 100;
const checkFunctionalityOptions = getPostOptions("functionality","reactive-hospital.herokuapp.com")
async function checkIfCanHandle(intentName,handlerInput){
    const request = handlerInput.requestEnvelope.request;
    if(!(request.type === 'IntentRequest' && request.intent.name === intentName)){
      return false;
    }
    const result = await checkFunctionality(handlerInput);
    return result
}
const VisualizzaInformazioniIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle("VisualizzaInformazioniIntent",handlerInput);
  },
  async handle(handlerInput) {
    
		const body = createBodyWithDeviceInfo(handlerInput);
		const bodyJson = JSON.stringify(body);
		await callDirectiveService(handlerInput)
		const speechOutput = "Ok, visualizzo";
    return doPost(handlerInput,visualizzaInformazioniOptions,bodyJson,speechOutput);
  },
};

const LaunchRequestHandler = {
  async canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    if(!(request.type === 'LaunchRequest')){
      return false;
    }
    const result = await checkFunctionality(handlerInput);
    return result
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
  async canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const result = await checkFunctionality(handlerInput);
    return result && request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
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
      ( request.intent.name === 'AMAZON.NoIntent' ||
        request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const speechOutput = 'Okay, chiudo Smart Screen';

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
    const unrecognizedCommandSpeech = 'Mi dispiace, non ho capito il comando, potresti ripeterlo?';
    const unavailableFunctionalitySpeech = "Questa stanza non espone la funzionalità da te richiesta";
    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
    console.log(`Error handled: ${error}`);
    if(request.type==="LaunchRequest"){
      return handlerInput.responseBuilder
        .speak(unavailableFunctionalitySpeech)
        .getResponse();
    }else return handlerInput.responseBuilder
      .speak(unrecognizedCommandSpeech)
      .reprompt('Puoi chiedere informazioni con il comando: aiuto')
      .getResponse();
  },
};

function createBodyWithDeviceInfo(handlerInput){
 	const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId
	const timestamp = Math.floor(new Date().getTime()/1000.0) 
	return {
		deviceId: deviceId,
		timestamp: timestamp
	}
}
async function checkIfElapsedTimeIsValid(oldAbilitationTime,abilitationTime=abilitationTimeout){
    const timestamp = Math.floor(new Date().getTime()/1000.0);
    const elapsedTime = timestamp-oldAbilitationTime;
    console.log("Elapsed time: "+elapsedTime);
    return elapsedTime < abilitationTime;
}
function getDeviceId(handlerInput){
  return handlerInput.requestEnvelope.context.System.device.deviceId;
  // return 'amzn1.ask.device.AGYV66I26XAPEADYMZDR6EQWBAO6Z2EWKHG4POUVUV43GIQLJ3UII5XGYKQGFUVN7G2UCTSUCMWPFRZ6CYPEFGS5FRDJ5NR5K6ROBINE3Y3QYDKADXX2CMJVF6GCZRFIUMXOHGYCGUOO2XUOS5QLAY3CJEGSZYVQK46BVLVGR6BXRS7MYTCUO';
}
function checkFunctionality(handlerInput) {
  return new Promise(async function(resolve, reject){
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
    var isAbilitated = false;
    const deviceId = getDeviceId(handlerInput);
    console.log(typeof attributes.abilitation);
    
    if(attributes.abilitation && attributes.abilitation[deviceId]){
      isAbilitated = checkIfElapsedTimeIsValid(attributes.abilitation[deviceId]);
    }
    if(isAbilitated){
      console.log("Already abilitated ");
      resolve(true);
    }else{
      const attributes = await handlerInput.attributesManager.getPersistentAttributes();
      console.log("To be enabled");
      var body = createBodyWithDeviceInfo(handlerInput);
      body.functionality = skillTag;
      body = JSON.stringify(body);
      console.log(body);
      return postRequestWithPromise(handlerInput,checkFunctionalityOptions,body).then( async function(code){
        if(code===200){

          const timestamp = Math.floor(new Date().getTime()/1000.0);
          if(!attributes.abilitation){
            attributes.abilitation ={};
          }
          attributes.abilitation[deviceId]=timestamp;
          handlerInput.attributesManager.setPersistentAttributes(attributes);
          await handlerInput.attributesManager.savePersistentAttributes();
          console.log("Ok, abilitated");
          resolve(true);
        }else{
          resolve(false);
        }
      }).catch(err=>{
        console.log(err);
        resolve(false);
      });
    }
  });
}
function postRequestWithPromise(handlerInput,options,data){
   return new Promise((resolve, reject) => {
      var req = https.request(options, function(res) {
      console.log('Status: ' + res.statusCode);
      console.log('Headers: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      if(res.statusCode === 200){
        resolve(200)
      }else{
        reject(res.statusCode);
      }
      res.on('data', function (body) {
        console.log('Body: ' + body);
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

function doPost(handlerInput,options,data,speechOutput){
   return new Promise((resolve, reject) => {
      var req = https.request(options, function(res) {
      console.log('Status: ' + res.statusCode);
      console.log('Headers: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      var response = handlerInput.responseBuilder
                        .speak(errorOutput)
                        .getResponse();
      if(res.statusCode === 200){
        response = handlerInput.responseBuilder
                        .speak(speechOutput)
                        .reprompt(helpOutput)
                        .getResponse();
      }
      resolve(response)
      res.on('data', function (body) {
        console.log('Body: ' + body);
      });
    });
    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
      resolve(handlerInput.responseBuilder
                        .speak(errorOutput)
                        .getResponse());
    });
    // console.log("Faccio richiesta");
    // write data to request body
    req.write(data);
    req.end();
    });
}
const skillBuilder = Alexa.SkillBuilders.custom();



function callDirectiveService(handlerInput) {
  // Call Alexa Directive Service.
  const requestEnvelope = handlerInput.requestEnvelope;
  const directiveServiceClient = handlerInput.serviceClientFactory.getDirectiveServiceClient();

  const requestId = requestEnvelope.request.requestId;

  // build the progressive response directive
  const directive = {
    header: {
      requestId,
    },
    directive: {
      type: 'VoicePlayer.Speak',
      speech: `Comando ricevuto`,
    },
  };

  // send directive
  return directiveServiceClient.enqueue(directive);
}

exports.handler = skillBuilder
  .addRequestHandlers(
    VisualizzaInformazioniIntentHandler,
    LaunchRequestHandler,
    AmazonCancelStopNoHandler,
    AmazonHelpHandler,
    SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .withPersistenceAdapter(persistenceAdapter)
  .lambda();
  
