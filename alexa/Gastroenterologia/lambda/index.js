/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
var https = require("https");
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const persistenceAdapter = new DynamoDbPersistenceAdapter({
  tableName: 'Gastroenterologia',
  createTable: true
});

const skillTag = "Gastroenterologia";

function getPostOptions(path,hostname="reactive-gastro.herokuapp.com"){
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
const abilitationTimeout = 100;

const checkFunctionalityOptions = getPostOptions("functionality","reactive-hospital.herokuapp.com")

const welcomeOutput = "Benvenuto in gastroenterologia";
const welcomeReprompt = "Se vuoi puoi chiedere maggiori informazioni, tramite il comando aiuto";
const helpOutput = 'Puoi iniziare la registrazione di un esame dicendo, ad esempio: inizia registrazione esame.'+
    '<break strength="strong"/>'+
    'Puoi chiudere un caso dicendo,ad esempio: termina esame'+
    '<break strength="strong"/>';
const mustOpenCaseOutput = "Non c'è nessun esame aperto, aprine uno";
const mustOpenCaseReprompt = "Per iniziare la registrazione di un esame puoi dire: inizia registrazione esame";
const mustCloseCaseOutput = "C'è già un caso aperto, chiudilo se ne vuoi aprire un altro."
const mustCloseCaseReprompt = "Per chiudere un caso puoi dire: chiudi esame";
const errorOutput = 'Errore, prova a ripetere'
const startedCase = "Ok, inizio registrazione esame gastroenterologico";
const endedCase = "Ok, termino registrazione esame gastroenterologico"
const APP_ID = 'amzn1.ask.skill.a9baedfc-6a96-469f-a43a-4050e5d10c62';
const EXECUTION_PHASE = 'Esecuzione';
const STARTED = 'Iniziato'
const ENDED = 'Terminato'

function mustOpenCaseSpeech(responseBuilder){
  return  responseBuilder
      .speak(mustOpenCaseOutput)
      .reprompt(mustOpenCaseReprompt)
      .getResponse();
}
function mustCloseCaseSpeech(responseBuilder){
  return  responseBuilder
      .speak(mustCloseCaseOutput)
      .reprompt(mustCloseCaseReprompt)
      .getResponse();
}

async function checkIfCanHandle(intentName,handlerInput){
    const request = handlerInput.requestEnvelope.request;
    if(!(request.type === 'IntentRequest' && request.intent.name === intentName)){
      return false;
    }
    const result = await checkFunctionality(handlerInput);
    return result
}


const inizaCasoOptions=getPostOptions("inizioEsame");
const fineCasoOptions=getPostOptions("fineEsame");

const InizioCasoIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('IniziaEsameIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
    if(attributes.fase===STARTED){
      return mustCloseCaseSpeech(responseBuilder);
    }   

    var body = JSON.stringify(createBodyWithDeviceInfo(handlerInput));

		await callDirectiveService(handlerInput);
		const errorSpeech = responseBuilder
                  .speak(errorOutput)
                  .reprompt(helpOutput)
                  .getResponse();
    return postRequestWithPromise(handlerInput,inizaCasoOptions,body).then( async function(code){
      if(code===200){
        attributes.fase=STARTED;
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        return responseBuilder
                  .speak(startedCase)
                  .reprompt(helpOutput)
                  .getResponse();
      }else{
            return errorSpeech;
      }
    }).catch(err=>{
      console.log(err);
      return errorSpeech;
    })

  },
};


const FineCasoIntentHandler = {
  async canHandle(handlerInput) {
      return checkIfCanHandle('FineEsameIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
    if(attributes.fase===ENDED){
      return mustOpenCaseSpeech(responseBuilder);
    }    
    var body = JSON.stringify(createBodyWithDeviceInfo(handlerInput));
    // console.log(body);
		await callDirectiveService(handlerInput)
		const errorSpeech = responseBuilder
                  .speak(errorOutput)
                  .reprompt(helpOutput)
                  .getResponse();
    return postRequestWithPromise(handlerInput,fineCasoOptions,body).then( async function(code){
      if(code===200){
 		    attributes.fase=ENDED;
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        return responseBuilder
                  .speak(endedCase)
                  .reprompt(helpOutput)
                  .getResponse();
      }else{
            return errorSpeech;
      }
    }).catch(err=>{
      console.log(err);
      return errorSpeech;
    })
  },
};

function resolveCanonical(slot){
	//this function looks at the entity resolution part of request and returns the slot value if a synonyms is provided
	let canonical;
    try{
		canonical = slot.resolutions.resolutionsPerAuthority[0].values[0].value.name;
	}catch(err){
	    console.log(err.message);
	    canonical = slot.value;
	};
	return canonical;
};

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

const LaunchRequestHandler = {
  async canHandle(handlerInput) {
    const result = await checkFunctionality(handlerInput);
    return result;
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
    return checkIfCanHandle('AMAZON.HelpIntent',handlerInput);
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
    const speechOutput = 'Okay, chiudo Gastroenterologia ';

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
	  tag: skillTag,
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


const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    InizioCasoIntentHandler,
    FineCasoIntentHandler,
    LaunchRequestHandler,
    AmazonCancelStopNoHandler,
    AmazonHelpHandler,
    SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .withPersistenceAdapter(persistenceAdapter)
  .lambda();
  
