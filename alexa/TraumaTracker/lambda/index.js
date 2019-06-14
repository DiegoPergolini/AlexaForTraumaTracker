/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
var https = require("https");
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const skillTag = "TraumaTracking";
const persistenceAdapter = new DynamoDbPersistenceAdapter({
  tableName: 'Trauma_Tracker',
  createTable: true
});

function getPostOptions(path,hostname="reactive-trauma.herokuapp.com"){
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
const abilitationTimeout = 86400;
const fieldsTimeout = 1000;
function getAdditionalSlotsOptions() {
  return{
  "method": "GET",
  "hostname": "reactive-trauma.herokuapp.com",
  "port": 443,
  "path": "/api/additionalSlots"
  }
}
const checkFunctionalityOptions = getPostOptions("functionality","reactive-hospital.herokuapp.com")

const inizaCasoOptions=getPostOptions("inizioCaso");

const fineCasoOptions=getPostOptions("fineCaso");

const deleteOptions =  getPostOptions("ultimoComando");

const reportOverviewOptions = getPostOptions("richiestaReportOverview");

const manovraOptions = getPostOptions("manovra");

const infusioneContinuaOptions = getPostOptions("infusioneContinua");

const diagnosticaOptions =  getPostOptions("diagnostica");

const farmacoOptions =  getPostOptions("farmaco","reactive-trauma.herokuapp.com");

const welcomeOutput = "Benvenuto in trauma tracker";
const welcomeReprompt = "Se vuoi puoi chiedere maggiori informazioni, tramite il comando aiuto";
const helpOutput = 'Puoi iniziare la registrazione di un caso dicendo, ad esempio: apri caso.'+
    '<break strength="strong"/>'+
    'Puoi chiudere un caso dicendo,ad esempio: termina caso'+
    '<break strength="strong"/>'+
    'Puoi registrare una manovra dicendo,ad esempio, eseguita manovra crico tiro.'+
		'<break strength="strong"/>'+
		'Oppure puoi registrare la somministrazione di un farmaco dicendo, ad esempio, somministrato farmaco cristalloidi 500 ml.'+
		'<break strength="strong"/>'+
		'Puoi anche registare una diagnostica dicendo, ad esempio, diagnostica ecografia';
const mustOpenCaseOutput = "Non c'è nessun caso aperto, aprine uno";
const mustCloseCaseOutput = "C'è già un caso aperto, chiudilo se ne vuoi aprire un altro."
const mustOpenCaseReprompt = "Per aprire un caso puoi dire: inizia caso";
const mustCloseCaseReprompt = "Per chiudere un caso puoi dire: chiudi caso";
const errorOutput = 'Errore, prova a ripetere'
const startedCase = "Ok, inizio registrazione caso";
const endedCase = "Ok, termine registrazione caso"
const APP_ID = 'amzn1.ask.skill.85ee1fd5-0fe0-4040-8aea-8c729586668e';

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

const InizioCasoIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('IniziaCasoIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    var body = JSON.stringify(createBodyWithDeviceInfo(handlerInput));
    console.log(body);
    console.log(inizaCasoOptions);
		await callDirectiveService(handlerInput);
		const errorSpeech = responseBuilder
                  .speak(errorOutput)
                  .reprompt(helpOutput)
                  .getResponse();
    return postRequestWithPromise(handlerInput,inizaCasoOptions,body).then( async function(code){
      if(code===200){
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
      return checkIfCanHandle('FineCasoIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    var body = JSON.stringify(createBodyWithDeviceInfo(handlerInput));
    console.log(body);
		await callDirectiveService(handlerInput)
		const errorSpeech = responseBuilder
                  .speak(errorOutput)
                  .reprompt(helpOutput)
                  .getResponse();
    return postRequestWithPromise(handlerInput,fineCasoOptions,body).then( async function(code){
      if(code===200){
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

const FarmacoIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('FarmacoIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;
            console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);


    if(!checkSlotValue(handlerInput.requestEnvelope.request.intent.slots.farmaco)){
      return  notExistingElementSpeech("Questo farmaco non esiste");
    }
    
	  let farmaciSlot = request.intent.slots.farmaco.value;
		console.log(farmaciSlot)
		
		let quantitaSlot = request.intent.slots.quantita.value;
		console.log(quantitaSlot);
		// var dosaggio = farmaciDosaggioDefaultMap.get(farmaciSlot.toUpperCase());
		// let unitaSlot =  dosaggio.misura;
		var dosaggio = {};
		if(quantitaSlot !== undefined){
		  dosaggio = {
      "quantità": quantitaSlot,
      }
		}
		
		const farmacoObject = createFarmacoObject(farmaciSlot,dosaggio,handlerInput);
		const farmacoJson = JSON.stringify(farmacoObject);
		console.log(farmacoJson);
		await callDirectiveService(handlerInput)
    return requestFarmacoCompletation(handlerInput,farmacoOptions,farmacoJson);
  },
};


const ProcedureIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('ProcedureIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;
if(!checkSlotValue(handlerInput.requestEnvelope.request.intent.slots.procedure)){
      return  notExistingElementSpeech("Questa procedura farmatologica non esiste");
    }
		let procedureSlot = request.intent.slots.procedure.value;
		console.log(procedureSlot);
		//Your custom intent handling goes here
		const speechOutput = "Ok, inserito procedura farmatologica: "+procedureSlot;
		const dosaggio = {
		};
		const farmacoObject = createFarmacoObject(procedureSlot,dosaggio,handlerInput);
		const farmacoJson = JSON.stringify(farmacoObject);
		console.log(farmacoJson);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,farmacoOptions,farmacoJson,speechOutput);
  },
};

const IntubazioneOrotrachealeHandler = {
  async canHandle(handlerInput){
    return checkIfCanHandle('IntubazioneOrotracheale',handlerInput);
  },
  async handle(handlerInput){
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;
let vieaereeSlot = request.intent.slots.vieaeree.value;
		console.log(vieaereeSlot);
		let inalazioneSlot = request.intent.slots.inalazione.value;
		console.log(inalazioneSlot);
		let videolaringoSlot = request.intent.slots.videolaringo.value;
		console.log(videolaringoSlot);
		let frovaSlot = request.intent.slots.frova.value;
		console.log(frovaSlot);
		
		const speechOutput = "Ok, inserita Intubazione Orotracheale con vie aree: "+vieaereeSlot+
		", inalazione: "+inalazioneSlot+
		", videolaringo:"+videolaringoSlot+
		", frova: "+frovaSlot;
		
    const opzioni = {
    		viearee : vieaereeSlot,
    		inalazione: inalazioneSlot,
    		videolaringo : videolaringoSlot,
    		frova: frovaSlot
    	};
  	const nome = 'Intubazione Orotracheale';
		const manovraObject = createManovraObject(nome,EXECUTION_PHASE,opzioni,handlerInput);
    var manovraJson = JSON.stringify(manovraObject);
		console.log(manovraObject);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,manovraOptions,manovraJson,speechOutput);
  },
}

const DrenaggioToracicoHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DrenaggioToracico',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;

		let sinistroSlot = request.intent.slots.sinistro.value;
		console.log(sinistroSlot);
		let destroSlot = request.intent.slots.destro.value;
		console.log(destroSlot);
    const speechOutput = 'Ok, inserito Drenaggio Toracico con sinistro: '+sinistroSlot+'e destro: '+destroSlot
       	const opzioni = {
    		sinistro : sinistroSlot,
    		destro : destroSlot
    	};
    const nome = 'Drenaggio Toracico';
		const manovraObject = createManovraObject(nome,EXECUTION_PHASE,opzioni,handlerInput);
    var manovraJson = JSON.stringify(manovraObject);
		console.log(manovraObject);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,manovraOptions,manovraJson,speechOutput);
  },
};

const DecompressionePleuricaHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DecompressionePleurica',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;

		let sinistroSlot = request.intent.slots.sinistro.value;
		console.log(sinistroSlot);
		let destroSlot = request.intent.slots.destro.value;
		console.log(destroSlot);

		
    const speechOutput = 'Ok, inserito Decompressione Pleurica con sinistro: '+sinistroSlot+'e destro: '+destroSlot;
    	const opzioni = {
    		sinistro : sinistroSlot,
    		destro : destroSlot
    	};
    	const nome = 'Decompressione Pleurica';
		const manovraObject = createManovraObject(nome,EXECUTION_PHASE,opzioni,handlerInput);
    var manovraJson = JSON.stringify(manovraObject);
		console.log(manovraObject);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,manovraOptions,manovraJson,speechOutput);
  },
};

const ManovraTempoDipendenteIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('ManovraTempoDipendenteIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;

		let faseSlot = request.intent.slots.fase.value;
		console.log(faseSlot);
	  if(!checkSlotValue(handlerInput.requestEnvelope.request.intent.slots.manovraT)){
      return  notExistingElementSpeech("Questa manovra tempo-dipendente non esiste");
    }
		let manovraTSlot = request.intent.slots.manovraT.value;
		console.log(manovraTSlot);
		const speechOutput ="Ok, inserito "+faseSlot+" manovra "+manovraTSlot;
		const opzioni = {}
		const manovraObject = createManovraObject(manovraTSlot,faseSlot,opzioni,handlerInput);
    var manovraJson = JSON.stringify(manovraObject);
		console.log(manovraObject);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,manovraOptions,manovraJson,speechOutput);
  },
};
const InfusioneContinuaIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('InfusioniContinueIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;

		let faseSlot = request.intent.slots.fase.value;
		console.log(faseSlot);
    if(!checkSlotValue(handlerInput.requestEnvelope.request.intent.slots.farmaco)){
      return  notExistingElementSpeech("Questo farmaco non esiste");
    }
    
	  let farmaciSlot = request.intent.slots.farmaco.value;
		console.log(farmaciSlot)
		var dosaggio = {};
		
		var speechOutput ="Ok, termine infusione continua  di "+farmaciSlot;
		if(faseSlot !=="fine"){
			let quantitaSlot = request.intent.slots.dose.value;
		  dosaggio = {
        "quantità": quantitaSlot,
        "misura":"ml/h"
      }
      speechOutput =faseSlot==="modifica"?"Ok, modificato infusione continua  "+farmaciSlot+ "con quantità: "+dosaggio.quantità+" ml/h":
                                "Ok, inserito "+faseSlot+" infusione continua  "+farmaciSlot+ "con quantità: "+dosaggio.quantità+" ml/h";
		}
		console.log(dosaggio);
		
		const infusioneContinuaObject = createInfusioneContinuaObject(farmaciSlot,dosaggio,faseSlot,handlerInput);
		const infusioneContinuaJson = JSON.stringify(infusioneContinuaObject);
		console.log(infusioneContinuaJson);
		
		await callDirectiveService(handlerInput)
		let defaultCodeToMessageMap = new Map([[401, "Errore, questo farmaco non è somministrabile in infusione continua"]]);
    return doPost(handlerInput,infusioneContinuaOptions,infusioneContinuaJson,speechOutput,defaultCodeToMessageMap);
  },
};

function notExistingElementSpeech(speechOutput,responseBuilder){
  return responseBuilder
            .speak(speechOutput)
            .reprompt(helpOutput)
            .getResponse();
}
const ManovraIntentHandler = {
  async canHandle(handlerInput){
    return checkIfCanHandle('ManovraIntent',handlerInput);
  },
  async handle(handlerInput){
    const request = handlerInput.requestEnvelope.request;
        console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);

    const responseBuilder = handlerInput.responseBuilder;

    // const slotSDValue = getStaticAndDynamicSlotValuesFromSlot(handlerInput.requestEnvelope.request.intent.slots.manovra);
    if(!checkSlotValue(handlerInput.requestEnvelope.request.intent.slots.manovra)){
      return  notExistingElementSpeech("Questa manovra non esiste",responseBuilder);
    }
    
  	let manovraSlot = request.intent.slots.manovra.value;
		const speechOutput = "Ok, inserita manovra: "+manovraSlot;
		const opzioni = {}
		var manovraObject = createManovraObject(manovraSlot,EXECUTION_PHASE,opzioni,handlerInput);
    var manovraJson = JSON.stringify(manovraObject);
		console.log(manovraObject);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,manovraOptions,manovraJson,speechOutput);
  },
}

const DiagnosticaIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DiagnosticaIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;

    if(!checkSlotValue(handlerInput.requestEnvelope.request.intent.slots.diagnostica)){
      return  notExistingElementSpeech("Questa diagnostica non esiste");
    }
		let diagnosticaSlot = request.intent.slots.diagnostica.value;
		console.log(diagnosticaSlot);

		const speechOutput = "Ok, inserita diagnostica: "+diagnosticaSlot;
		const tipoDiagnostica = 'Strumentale'
		const opzioni = {}
		const diagnosticaObject = createDiagnosticaObject(tipoDiagnostica,diagnosticaSlot,opzioni,handlerInput);
    var diagnosticaJson = JSON.stringify(diagnosticaObject);
		console.log(diagnosticaJson);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,diagnosticaOptions,diagnosticaJson,speechOutput);
  },
};

const DiagnosticaEGALattatiIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DiagnosticaEGALattati',handlerInput);
  },
  async handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;
    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
var lattati = request.intent.slots.intero.value;
    var lattatiDecimale =  parseFloat('0.'+request.intent.slots.decimale.value);
    lattatiDecimale = isNaN(lattatiDecimale)?0:lattatiDecimale;
    lattati = parseFloat(lattati)+lattatiDecimale;
    const speechOutput = "Ok, inserita diagnostica ega con lattati: "+lattati+
		" milli moli per litro. "
		const tipoDiagnostica = 'Laboratorio'
		const opzioni = {
			lattati : lattati
		}
		const nome = 'Diagnostica EGA';
		const diagnosticaObject = createDiagnosticaObject(tipoDiagnostica,nome,opzioni,handlerInput);
    var diagnosticaJson = JSON.stringify(diagnosticaObject);
		console.log(diagnosticaJson);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,diagnosticaOptions,diagnosticaJson,speechOutput);
  },
};
const DiagnosticaBELattatiIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DiagnosticaEgaBE',handlerInput);
  },
  async handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;
    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
    
    var be = request.intent.slots.intero.value;
    var beDecimale =  parseFloat('0.'+request.intent.slots.decimale.value);
    beDecimale = isNaN(beDecimale)?0:beDecimale;
    be = parseFloat(be)+beDecimale;
    const segno = request.intent.slots.segno.value;
    be = segno==='meno'?be*-1:be
    const speechOutput = "Ok, inserita diagnostica ega con be: "+be;
		const tipoDiagnostica = 'Laboratorio'
		const opzioni = {
			be : be
		}
		const nome = 'Diagnostica EGA';
		const diagnosticaObject = createDiagnosticaObject(tipoDiagnostica,nome,opzioni,handlerInput);
    var diagnosticaJson = JSON.stringify(diagnosticaObject);
		console.log(diagnosticaJson);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,diagnosticaOptions,diagnosticaJson,speechOutput);
  },
};

const DiagnosticaEGAPHIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DiagnosticaEgaPH',handlerInput);
  },
  async handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;
    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
var ph = request.intent.slots.intero.value;
    var phDecimale =  parseFloat('0.'+request.intent.slots.decimale.value);
    phDecimale = isNaN(phDecimale)?0:phDecimale;
    ph = parseFloat(ph)+phDecimale;
    const speechOutput = "Ok, inserita diagnostica ega con ph: "+ph;
		const tipoDiagnostica = 'Laboratorio'
		const opzioni = {
			ph : ph
		}
		const nome = 'Diagnostica EGA';
		const diagnosticaObject = createDiagnosticaObject(tipoDiagnostica,nome,opzioni,handlerInput);
    var diagnosticaJson = JSON.stringify(diagnosticaObject);
		console.log(diagnosticaJson);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,diagnosticaOptions,diagnosticaJson,speechOutput);
  },
};
const DiagnosticaEGAHBIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DiagnosticaEgaHB',handlerInput);
  },
  async handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;
    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
var hb = request.intent.slots.intero.value;
    var hbDecimale =  parseFloat('0.'+request.intent.slots.decimale.value);
    hbDecimale = isNaN(hbDecimale)?0:hbDecimale;
    hb = parseFloat(hb)+hbDecimale;
    const speechOutput = "Ok, inserita diagnostica ega con hb: "+hb+
		" g per decilitro. "
		const tipoDiagnostica = 'Laboratorio'
		const opzioni = {
			hb : hb
		}
		const nome = 'Diagnostica EGA';
		const diagnosticaObject = createDiagnosticaObject(tipoDiagnostica,nome,opzioni,handlerInput);
    var diagnosticaJson = JSON.stringify(diagnosticaObject);
		console.log(diagnosticaJson);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,diagnosticaOptions,diagnosticaJson,speechOutput);
  },
};

const DiagnosticaEGAIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DiagnosticaEGAIntent',handlerInput);
  },
  async handle(handlerInput) {

    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;
    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);
  var lattatiSlot = request.intent.slots.lattati.value;
		console.log(lattatiSlot);
		var beSlot = request.intent.slots.be.value;
		console.log(beSlot);
		var phSlot = request.intent.slots.ph.value;
		console.log(phSlot);
		var hbSlot = request.intent.slots.hb.value;
		console.log(hbSlot);
		
    var lattatiDecSlot =  parseFloat('0.'+request.intent.slots.lattatidecimale.value);
    lattatiDecSlot = isNaN(lattatiDecSlot)?0:lattatiDecSlot;
		console.log(lattatiDecSlot);
		var beDecSlot = parseFloat('0.'+request.intent.slots.bedecimale.value);
    beDecSlot = isNaN(beDecSlot)?0:beDecSlot;
		console.log(beDecSlot);
		var phDecSlot = parseFloat('0.'+request.intent.slots.phdecimale.value);
    phDecSlot = isNaN(phDecSlot)?0:phDecSlot;
		console.log(phDecSlot);
		var hbDecSlot = parseFloat('0.'+request.intent.slots.hbdecimale.value);
    hbDecSlot = isNaN(hbDecSlot)?0:hbDecSlot;
		console.log(hbDecSlot);
    
    lattatiSlot = parseFloat(lattatiSlot)+lattatiDecSlot;
    beSlot = parseFloat(beSlot)+beDecSlot;
    phSlot = parseFloat(phSlot)+phDecSlot;
    hbSlot = parseFloat(hbSlot)+hbDecSlot;

		const speechOutput = "Ok, inserita diagnostica ega con lattati: "+lattatiSlot+
		" milli moli per litro. "+
		'<break strength="strong"/>'+
		" Bi E"+beSlot+
		'<break strength="strong"/>'
		+" p H"+phSlot+
		'<break strength="strong"/>'+
		" ed Hb: "+hbSlot+" g per decilitro";
		const tipoDiagnostica = 'Laboratorio'
		const opzioni = {
			lattati : lattatiSlot,
			be: beSlot,
			ph: phSlot,
			hb: hbSlot
		}
		const nome = 'Diagnostica EGA';
		const diagnosticaObject = createDiagnosticaObject(tipoDiagnostica,nome,opzioni,handlerInput);
    var diagnosticaJson = JSON.stringify(diagnosticaObject);
		console.log(diagnosticaJson);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,diagnosticaOptions,diagnosticaJson,speechOutput);
  },
};

const DiagnosticaROTEMIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('DiagnosticaROTEMIntent',handlerInput);
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const request = handlerInput.requestEnvelope.request;

		let extemCTSlot = request.intent.slots.extemCT.value;
		console.log(extemCTSlot);
		let extemADieciSlot = request.intent.slots.extemADieci.value;
		console.log(extemADieciSlot);
		let extemAlphaSlot = request.intent.slots.extemAlpha.value;
		console.log(extemAlphaSlot);
		let fibtemACinqueSlot = request.intent.slots.fibtemACinque.value;
		console.log(fibtemACinqueSlot);
		let iperfibrinolisSlot = request.intent.slots.iperfibrinolis.value;
		console.log(iperfibrinolisSlot);
		//Your custom intent handling goes here
		const speechOutput = "Ok, inserita diagnostica ROTEM con extem ct: "+extemCTSlot+
		" secondi, extem a10: "+extemADieciSlot+
		" millimetri, extem alpha: "+extemAlphaSlot+
		" gradi, fibtem a5:  "+fibtemACinqueSlot+" millimetri, iperfibrinolis: "+iperfibrinolisSlot;
		const tipoDiagnostica = 'Laboratorio'
		const opzioni = {
			extemct : extemCTSlot,
			extema10: extemADieciSlot,
			extemalpha: extemAlphaSlot,
			fibtema5: fibtemACinqueSlot,
			iperfibrinolis: iperfibrinolisSlot
		}
		const nome = 'Diagnostica ROTEM';
		const diagnosticaObject = createDiagnosticaObject(tipoDiagnostica,nome,opzioni,handlerInput);
    var diagnosticaJson = JSON.stringify(diagnosticaObject);
		console.log(diagnosticaJson);
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,diagnosticaOptions,diagnosticaJson,speechOutput);
  },
};

function checkIfElapsedTimeIsValid(oldAbilitationTime,abilitationTime=abilitationTimeout){
    const timestamp = Math.floor(new Date().getTime()/1000.0);
    const elapsedTime = timestamp-oldAbilitationTime;
    console.log("Elapsed time: "+elapsedTime);
    return elapsedTime < abilitationTime;
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

const LaunchRequestHandler = {
  async canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    if(!(request.type === 'LaunchRequest')){
      return false;
    }
    const result = await checkFunctionality(handlerInput);
    return result
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
    const oldAbilitationTime = attributes.slotsAbilitation!==undefined? attributes.slotsAbilitation.timestamp:0;
    const isAbilitated = await checkIfElapsedTimeIsValid(oldAbilitationTime,fieldsTimeout);
    var types = attributes.additionalSlots;
    if(!isAbilitated ||types===undefined){
      console.log("Not abilitated, getting values");
      const options = getAdditionalSlotsOptions();
      const body = JSON.stringify({});
      const response = await getRequestWithPromise(handlerInput,options,body);
      types = JSON.parse(response).additionalSlots;
      // console.log("Responde: "+response);
      // console.log(types)
      attributes.additionalSlots = types;
      const timestamp = Math.floor(new Date().getTime()/1000.0);
      attributes.slotsAbilitation = { timestamp : timestamp};
      handlerInput.attributesManager.setPersistentAttributes(attributes);
      await handlerInput.attributesManager.savePersistentAttributes();
    }
     let replaceEntityDirective = {
      type: 'Dialog.UpdateDynamicEntities',
      updateBehavior: 'REPLACE',
      types: types
    };
    
    return responseBuilder
      .speak(welcomeOutput)
      .reprompt(welcomeReprompt)
      .addDirective(replaceEntityDirective)
      .getResponse();
  },
};

const AmazonHelpHandler = {
  async canHandle(handlerInput) {
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
const DeleteLastIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('AMAZON.CancelIntent',handlerInput);
  },
  async handle(handlerInput) {
    
    const responseBuilder = handlerInput.responseBuilder;
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        const request = handlerInput.requestEnvelope.request;

        console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);

    if(attributes.fase===ENDED){
      return mustOpenCaseSpeech(responseBuilder);
    }
    var body = JSON.stringify(createBodyWithDeviceInfo(handlerInput));
    console.log(body);
   	const speechOutput = "Ok, eliminato ultimo comando"
  	await callDirectiveService(handlerInput)
    return doPost(handlerInput,deleteOptions,body,speechOutput);
  },
};

const ReportOverviewIntentHandler = {
  async canHandle(handlerInput) {
    return checkIfCanHandle('ReportOverviewIntent',handlerInput);
  },
  async handle(handlerInput) {
    var body = JSON.stringify(createBodyWithDeviceInfo(handlerInput));
    console.log(body);
    const speechOutput = "Ok, visualizzo il report overview sullo schermo";
		await callDirectiveService(handlerInput)
    return doPost(handlerInput,reportOverviewOptions,body,speechOutput);
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
    const speechOutput = 'Okay, chiudo Trauma Tracker ';

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

function getDeviceId(handlerInput){
  return handlerInput.requestEnvelope.context.System.device.deviceId;
  // return 'amzn1.ask.device.AGYV66I26XAPEADYMZDR6EQWBAO6Z2EWKHG4POUVUV43GIQLJ3UII5XGYKQGFUVN7G2UCTSUCMWPFRZ6CYPEFGS5FRDJ5NR5K6ROBINE3Y3QYDKADXX2CMJVF6GCZRFIUMXOHGYCGUOO2XUOS5QLAY3CJEGSZYVQK46BVLVGR6BXRS7MYTCUO';
}

function createInfusioneContinuaObject(nome,dosaggio,fase,handlerInput){
 	const deviceId = getDeviceId(handlerInput)
	const timestamp = 	Math.floor(new Date().getTime()/1000.0) 
	return {
	  tag: skillTag,
		deviceId: deviceId,
		timestamp: timestamp,
		nome: nome.toUpperCase(),
		dosaggio: dosaggio,
		fase: fase
	}
}

function createFarmacoObject(nome,dosaggio,handlerInput){
 	const deviceId = getDeviceId(handlerInput)
	const timestamp = 	Math.floor(new Date().getTime()/1000.0) 
	return {
	  tag: skillTag,
		deviceId: deviceId,
		timestamp: timestamp,
		nome: nome.toUpperCase(),
		dosaggio: dosaggio
	}
}
function createManovraObject(nome,fase,opzioni,handlerInput){
 	const deviceId = getDeviceId(handlerInput)
	const timestamp = 	Math.floor(new Date().getTime()/1000.0) 
	return {
	  tag: skillTag,
		deviceId: deviceId,
		timestamp: timestamp,
		fase: fase,
		nome: nome,
		opzioni: opzioni
	}
}        
function createDiagnosticaObject(tipoDiagnostica,nome,opzioni,handlerInput){
 	const deviceId = getDeviceId(handlerInput)
	const timestamp = Math.floor(new Date().getTime()/1000.0) 
	return {
	  tag: skillTag,
		deviceId: deviceId,
		timestamp: timestamp,
		tipoDiagnostica: tipoDiagnostica,
		nome: nome,
		opzioni: opzioni
	}
}
function createBodyWithDeviceInfo(handlerInput){
 	const deviceId = getDeviceId(handlerInput)
	const timestamp = Math.floor(new Date().getTime()/1000.0) 
	return {
	  tag: skillTag,
		deviceId: deviceId,
		timestamp: timestamp
	}
}

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


function requestFarmacoCompletation(handlerInput,options,data){
   return new Promise((resolve, reject) => {
      var req = https.request(options, function(res) {
      console.log('Status: ' + res.statusCode);
      console.log('Headers: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      var response = handlerInput.responseBuilder
                        .speak(errorOutput)
                        .getResponse();
      if(res.statusCode !== 200){
        resolve(response)
      }
      res.on('data', function (responseBody) {
        const farmaco = JSON.parse(responseBody);
        const speechOutput = "Ok, inserito farmaco: "+farmaco.nome+
		    "con quantità: "+farmaco.dosaggio.quantità+" "+farmaco.dosaggio.misura;
        response = handlerInput.responseBuilder
                            .speak(speechOutput)
                            .reprompt(helpOutput)
                            .getResponse()
        console.log(`Body: ${JSON.stringify(farmaco, null, 2)}`);                    
        resolve(response);
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

function doPost(handlerInput,options,data,speechOutput,codeToMessageMap=new Map([[500,"Errore del server, prova a ripetere"]])){
   return new Promise((resolve, reject) => {
      var req = https.request(options, function(res) {
      console.log('Status: ' + res.statusCode);
      console.log('Headers: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
    
      var response = handlerInput.responseBuilder
                        .speak(errorOutput)
                        .getResponse();
      if(codeToMessageMap.get(res.statusCode)){
        response = handlerInput.responseBuilder
                        .speak(codeToMessageMap.get(res.statusCode))
                        .getResponse();
      }else if(res.statusCode === 200){
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

function doDelete(handlerInput,options,body,speechOutput){
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
                        .getResponse();
      }
      resolve(response)
      res.on('data', function (body) {
        console.log('Body: ' + body);
      });
    });
    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });
    req.write(body);
    req.end();
    });
}

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


function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve(), milliseconds));
 }
 
function checkSlotValue(slot){
    const slotSDValue = getStaticAndDynamicSlotValuesFromSlot(slot);
    console.log(`Original slotSDValue was: ${JSON.stringify(slotSDValue, null, 2)}`)
    if(slotSDValue.static.statusCode==="ER_SUCCESS_MATCH"){
      return true;
    }else{
      if(slotSDValue.dynamic){
        return slotSDValue.dynamic.statusCode === 'ER_SUCCESS_MATCH'
      }else{
        return false;
      }
    }
}

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
const getStaticAndDynamicSlotValues = function(slots) {
    const slotValues = {}
    for (let slot in slots) {
        slotValues[slot] = getStaticAndDynamicSlotValuesFromSlot(slots[slot]);
    }
    return slotValues;
}
 
const getStaticAndDynamicSlotValuesFromSlot = function(slot) {
    
    const result = {
        name: slot.name,
        value: slot.value
    };
    
    if (((slot.resolutions || {}).resolutionsPerAuthority || [])[0] || {}) {
        slot.resolutions.resolutionsPerAuthority.forEach((authority) => {
            const slotValue = {
                authority: authority.authority,
                statusCode: authority.status.code,
                synonym: slot.value || undefined,
                resolvedValues: slot.value
            };
            if (authority.values && authority.values.length > 0) {
                slotValue.resolvedValues = [];
                
                authority.values.forEach((value) => {
                    slotValue.resolvedValues.push(value);
                });
                
            }
            
            if (authority.authority.includes('amzn1.er-authority.echo-sdk.dynamic')) {
                result.dynamic = slotValue;
            } else {
                result.static = slotValue;
            }
        });
    }
    return result;
};
 
const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    InizioCasoIntentHandler,
    FineCasoIntentHandler,
    FarmacoIntentHandler,
    InfusioneContinuaIntentHandler,
    ProcedureIntentHandler,
    IntubazioneOrotrachealeHandler,
    DrenaggioToracicoHandler,
    DecompressionePleuricaHandler,
    ManovraTempoDipendenteIntentHandler,
    ManovraIntentHandler,
    DiagnosticaIntentHandler,
    DiagnosticaEGALattatiIntentHandler,
    DiagnosticaEGAHBIntentHandler,
    DiagnosticaEGAPHIntentHandler,
    DiagnosticaBELattatiIntentHandler,
    DiagnosticaEGAIntentHandler,
    DiagnosticaROTEMIntentHandler,
    ReportOverviewIntentHandler,
    LaunchRequestHandler,
    DeleteLastIntentHandler,
    AmazonCancelStopNoHandler,
    AmazonHelpHandler,
    SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .withPersistenceAdapter(persistenceAdapter)
  .lambda();
  