var vertx = require('vertx-eventbus');

topic1 = 'TRAUMA_VOICE_TOPIC'
//topic1 = 'gastroenterologia1'
//topic2 = 'GENERIC_VOICE_TOPIC'
topic2 = 'amzn1.ask.device.AFY4IKREKQQLFH25X25UWRIJCJNW2CVB5WBJYC3C2W35F6V6JPODIFXXVWBG3KXTYS56EHMRQLWM7GQENXVK4IRPGZN7NQHDF5KSN4X5K7MP7D5KNJ3LUYD5F44G2ULTBWE6HPOEEAKCP7Y2O73WXS6WZ4MJ2N6HC5YBTCBLLBWXRDJT4Y3O4'


var eventbus = new vertx.EventBus('https://reactive-trauma.herokuapp.com/trauma-events')
eventbus.onopen = function () {
    eventbus.registerHandler(topic1, function (message, _) {
        console.log("Reactive trauma " + message)
    })
}

var eventbus2 = new vertx.EventBus('https://reactive-healthboard.herokuapp.com/generic-vocal-events')
eventbus2.onopen = function () {
    eventbus2.registerHandler(topic2, function (message, _) {
        console.log("Reactive healthboard " + message)
    })
}