package main

import com.amazonaws.auth.BasicAWSCredentials
import com.amazonaws.regions.Region
import com.amazonaws.regions.Regions
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient
import com.amazonaws.services.dynamodbv2.document.*
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec
import com.amazonaws.services.dynamodbv2.document.spec.ScanSpec
import io.vertx.core.AbstractVerticle
import io.vertx.core.Future
import io.vertx.core.json.JsonObject
import io.vertx.ext.bridge.BridgeEventType
import io.vertx.ext.bridge.PermittedOptions
import io.vertx.ext.web.Router
import io.vertx.ext.web.RoutingContext
import io.vertx.ext.web.handler.BodyHandler
import io.vertx.ext.web.handler.ErrorHandler
import io.vertx.ext.web.handler.sockjs.BridgeOptions
import io.vertx.ext.web.handler.sockjs.SockJSHandler
import io.vertx.kafka.client.producer.KafkaProducer
import io.vertx.kafka.client.producer.KafkaProducerRecord
import main.Topics.TRAUMA_VOICE_TOPIC
import java.util.HashMap
import java.util.ArrayList





object Topics {
    const val TRAUMA_VOICE_TOPIC = "TRAUMA_VOICE_TOPIC"
}

class TraumaVocalService : AbstractVerticle() {


    private lateinit var dynamoClientId: String
    private lateinit var dynamoClientSecret: String

    private lateinit var kafkaUsername: String
    private lateinit var kafkaPassword: String
    private lateinit var kafkaBrokers: String

    private lateinit var dynamoDbClient: AmazonDynamoDBClient
    private lateinit var dynamoDb: DynamoDB
    private lateinit var kafkaProducer: KafkaProducer<String, String>

    private lateinit var router: Router

    override fun start(startFuture: Future<Void>?) {

        vertx.fileSystem().readFile("config.json") { r ->
            if (r.succeeded()) {
                val json = r.result().toJsonObject()

                val dynamoConfig = json.getJsonObject("dynamoDB")
                dynamoClientId = dynamoConfig.getString("client-id")
                dynamoClientSecret = dynamoConfig.getString("client-secret")

                val kafkaConfig = json.getJsonObject("kafka")
                kafkaUsername = kafkaConfig.getString("username")
                kafkaPassword = kafkaConfig.getString("password")
                kafkaBrokers = kafkaConfig.getString("brokers")


                vertx.executeBlocking<Unit>({ future ->
                    connectToDB()
                    connectToKafka()
                    createServer()
                    future.complete()
                }, {})

            } else {
                throw(r.cause())
            }
        }


    }

    private fun connectToDB() {
        dynamoDbClient = AmazonDynamoDBClient(BasicAWSCredentials(dynamoClientId, dynamoClientSecret))
        dynamoDbClient.setRegion(Region.getRegion(Regions.EU_WEST_1))
        dynamoDb = DynamoDB(dynamoDbClient)
    }

    private fun connectToKafka() {
        val jaasTemplate = "org.apache.kafka.common.security.scram.ScramLoginModule required username=\"%s\" password=\"%s\";"
        val jaasCfg = String.format(jaasTemplate, kafkaUsername, kafkaPassword)

        val config = HashMap<String, String>()
        config["bootstrap.servers"] = kafkaBrokers
        config["key.serializer"] = "org.apache.kafka.common.serialization.StringSerializer"
        config["value.serializer"] = "org.apache.kafka.common.serialization.StringSerializer"
        config["acks"] = "1"
        config["security.protocol"] = "SASL_SSL"
        config["sasl.mechanism"] = "SCRAM-SHA-256"
        config["sasl.jaas.config"] = jaasCfg

        kafkaProducer = KafkaProducer.create<String, String>(vertx, config)
    }

    private fun createServer() {

        router = Router.router(vertx)

        router.route("/trauma-events/*").handler(eventBusHandler())
        router.mountSubRouter("/api", apiRouter())
        router.route().failureHandler(errorHandler())

        val herokuPort: String = System.getenv("PORT") ?: "8080"

        vertx.createHttpServer()
                .requestHandler(router)
                .listen(herokuPort.toInt()) { res ->
                    if(res.succeeded()){
                        println("Server is running on port $herokuPort")
                    } else {
                        println("""Some problems occurred, ${res.cause()}""")
                    }

                }
    }

    private fun errorHandler(): ErrorHandler {
        return ErrorHandler.create()
    }

    private fun eventBusHandler(): SockJSHandler {
        val options = BridgeOptions()
                .addOutboundPermitted(PermittedOptions().setAddressRegex("(.*?)"))
        return SockJSHandler.create(vertx).bridge(options) { event ->
            if (event.type() == BridgeEventType.SOCKET_CREATED) {
                println("A socket was created")
            }
            event.complete(true)
        }
    }

    private fun apiRouter(): Router {
        val router = Router.router(vertx)
        router.route().handler(BodyHandler.create())
        router.get("/").handler { req -> req.response().end("Welcome to the Reactive Healthboard!")}
        router.get("/additionalSlots").handler(this::handleGetSlots)
        router.post("/inizioCaso").handler(this::handleStartCase)
        router.post("/fineCaso").handler(this::handleEndCase)
        router.post("/farmaco").handler(this::handleFarmaco)
        router.post("/manovra").handler(this::handleManovra)
        router.post("/diagnostica").handler(this::handleDiagnostica)
        router.post("/ultimoComando").handler(this::handleRemoveLastCommand)
        router.post("/infusioneContinua").handler(this::handleInfusioneContinua)
        router.put("/slot").handler(this::handlePutSlot)
        router.get("/commands").handler(this::handleGetCommands)

        return router
    }

    private fun handleGetSlots(routingContext: RoutingContext) {
        vertx.executeBlocking<String>({ future ->

            val traumaTrackerAdditionalSlotsTable = dynamoDb.getTable("TraumaTrackerAdditionalSlots")
            val items = traumaTrackerAdditionalSlotsTable.scan(ScanSpec())
            val res = JsonObject()
                    .put("additionalSlots",
                            items.map { x -> JsonObject().put("name", x.get("name")).put("values", x.get("values")) })

            future.complete(res.encode())

        }, {res ->
            if (res.succeeded()) {
                println("Retrieved slots")
                routingContext.response()
                        .setStatusCode(200)
                        .putHeader("content-type", "application/json; charset=utf-8")
                        .end(res.result())
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun handleGetCommands(routingContext: RoutingContext) {
        vertx.executeBlocking<String>({ future ->

            val traumaVocalStorageTable = dynamoDb.getTable("TraumaVocalStorage")
            val roomId = routingContext.queryParam("roomId").first()
            val startTime = routingContext.queryParam("fromDate").first().toInt()
            val endTime = routingContext.queryParam("toDate").first().toInt()

            println(roomId)
            println(startTime)
            println(endTime)

            val querySpec = QuerySpec()
                    .withHashKey(KeyAttribute("roomId", roomId))
                    .withRangeKeyCondition(RangeKeyCondition("timestamp")
                            .between(startTime, endTime))
//                    .withScanIndexForward(false)

            val items = traumaVocalStorageTable.query(querySpec)

            val res =  JsonObject()
                    .put("commands", items.map { x -> JsonObject(x.toJSON()) })

            future.complete(res.encode())

        }, {res ->
            if (res.succeeded()) {
                println("Retrieved commands ")
                routingContext.response()
                        .setStatusCode(200)
                        .putHeader("content-type", "application/json; charset=utf-8")
                        .end(res.result())
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun handleStartCase(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val traumaVocalTable = dynamoDb.getTable("TraumaVocalStorage")

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "inizioCaso")

            val roomId = getRoomId(json.getString("deviceId"))

            val item = Item()
                    .with("roomId", roomId)
                    .with("deviceId", json.getString("deviceId"))
                    .with("timestamp", json.getInteger("timestamp"))
                    .with("caseId", json.getInteger("timestamp"))
                    .with("tag", json.getString("tag"))
                    .with("tipoComando", json.getString("tipoComando"))

            traumaVocalTable.putItem(item)
            publishEvent(roomId, json)
            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Started case")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun handleEndCase(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val traumaVocalTable = dynamoDb.getTable("TraumaVocalStorage")

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "fineCaso")

            val roomId = getRoomId(json.getString("deviceId"))

            val item = Item()
                    .with("roomId", roomId)
                    .with("deviceId", json.getString("deviceId"))
                    .withInt("timestamp", json.getInteger("timestamp"))
                    .with("tag", json.getString("tag"))
                    .with("tipoComando", json.getString("tipoComando"))

            traumaVocalTable.putItem(item)
            publishEvent(roomId, json)
            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Ended case")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun handleFarmaco(routingContext: RoutingContext) {

        vertx.executeBlocking<String>({ future ->

            val traumaVocalTable = dynamoDb.getTable("TraumaVocalStorage")

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "farmaco")

            enrichDrug(json)

            val roomId = getRoomId(json.getString("deviceId"))

            val item = Item()
                    .with("roomId", roomId)
                    .with("deviceId", json.getString("deviceId"))
                    .withInt("timestamp", json.getInteger("timestamp"))
                    .with("tag", json.getString("tag"))
                    .with("tipoComando", json.getString("tipoComando"))
                    .with("tipoFarmaco", json.getString("tipoFarmaco"))
                    .with("nome", json.getString("nome"))
                    .withJSON("dosaggio", json.getJsonObject("dosaggio").toString())

            traumaVocalTable.putItem(item)
            publishEvent(roomId, json)
            future.complete(json.encode())

        }, {res ->
            if (res.succeeded()) {
                println("Stored farmaco")
                routingContext.response()
                        .setStatusCode(200)
                        .putHeader("content-type", "application/json; charset=utf-8")
                        .end(res.result())
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun handleManovra(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val traumaVocalTable = dynamoDb.getTable("TraumaVocalStorage")

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "manovra")

            val roomId = getRoomId(json.getString("deviceId"))

            val item = Item()
                    .with("roomId", roomId)
                    .with("deviceId", json.getString("deviceId"))
                    .withInt("timestamp", json.getInteger("timestamp"))
                    .with("tipoComando", json.getString("tipoComando"))
                    .with("tag", json.getString("tag"))
                    .with("nome", json.getString("nome"))
                    .with("fase", json.getString("fase"))
                    .withJSON("opzioni", json.getJsonObject("opzioni").toString())

            traumaVocalTable.putItem(item)
            publishEvent(roomId, json)
            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Stored manovra")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun handleDiagnostica(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val traumaVocalTable = dynamoDb.getTable("TraumaVocalStorage")

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "diagnostica")

            val roomId = getRoomId(json.getString("deviceId"))

            val item = Item()
                    .with("roomId", roomId)
                    .with("deviceId", json.getString("deviceId"))
                    .withInt("timestamp", json.getInteger("timestamp"))
                    .with("tag", json.getString("tag"))
                    .with("tipoComando", json.getString("tipoComando"))
                    .with("tipoDiagnostica", json.getString("tipoDiagnostica"))
                    .with("nome", json.getString("nome"))
                    .withJSON("opzioni", json.getJsonObject("opzioni").toString())

            traumaVocalTable.putItem(item)
            publishEvent(roomId, json)
            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Stored diagnostica")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }


    private fun handleRemoveLastCommand(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val traumaVocalTable = dynamoDb.getTable("TraumaVocalStorage")

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "cancellaUltimoComando")

            val deviceId = json.getString("deviceId")
            val roomId = getRoomId(deviceId)


            val item = Item()
                    .with("roomId", roomId)
                    .with("deviceId", deviceId)
                    .with("timestamp", json.getInteger("timestamp"))
                    .with("tag", json.getString("tag"))
                    .with("tipoComando", json.getString("tipoComando"))

            traumaVocalTable.putItem(item)
            publishEvent(roomId, json)
            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Removed last command")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun handleInfusioneContinua(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "infusioneContinua")

            val farmaciInfusioneTable = dynamoDb.getTable("FarmaciPerInfusione")

            val drugItem: Item? = farmaciInfusioneTable.getItem("nome", json.getString("nome"))

            drugItem?.let {

                val traumaVocalTable = dynamoDb.getTable("TraumaVocalStorage")

                val deviceId = json.getString("deviceId")
                val roomId = getRoomId(deviceId)

                val item = Item()
                        .with("roomId", roomId)
                        .with("deviceId", deviceId)
                        .withInt("timestamp", json.getInteger("timestamp"))
                        .with("tag", "TraumaTracking")
                        .with("nome", json.getString("nome"))
                        .with("fase", json.getString("fase"))
                        .withJSON("dosaggio", json.getJsonObject("dosaggio").encode())
                        .with("tipoComando", json.getString("tipoComando"))

                traumaVocalTable.putItem(item)
                publishEvent(roomId, json)
                future.complete()

            }

            future.fail("No matching drug found")

        }, {res ->
            if (res.succeeded()) {
                println("Inserted drug")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(401).end()
            }
        })
    }

    private fun handlePutSlot(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val json = routingContext.bodyAsJson

            val slotName = json.getString("slotName")
            val value = json.getString("value")

            val traumaTrackerAdditionalSlotsTable = dynamoDb.getTable("TraumaTrackerAdditionalSlots")
            val defaultFarmaciTable = dynamoDb.getTable("DefaultFarmaci")

            val item = traumaTrackerAdditionalSlotsTable.scan(ScanFilter("name").eq(slotName)).firstOrNull()

            val values: MutableList<HashMap<String, HashMap<String, String>>> = mutableListOf()
            if (item != null) {
                val list: ArrayList<*> = item.get("values") as ArrayList<*>

                list.forEach{ x ->
                    values.add(x as HashMap<String, HashMap<String, String>>)
                }
            }


            values.add(hashMapOf(Pair("name", hashMapOf(Pair("value", value)))))

            val slotItem = Item()
                    .with("name", slotName)
                    .withList("values", values)

            when (slotName) {
                "FARMACI" -> {
                    val tipoFarmaco = json.getString("tipoFarmaco")
                    val dosaggio = json.getJsonObject("dosaggio").toString()

                    val defaultFarmacoItem = Item()
                            .with("nome", value)
                            .withJSON("dosaggio", dosaggio)
                            .with("tipoFarmaco", tipoFarmaco)

                    defaultFarmaciTable.putItem(defaultFarmacoItem)
                }
            }

            traumaTrackerAdditionalSlotsTable.putItem(slotItem)

            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Slot added")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun publishEvent(roomId: String, json: JsonObject) {
        vertx.eventBus().publish(TRAUMA_VOICE_TOPIC, json)
        vertx.eventBus().publish(roomId, json)

        json.put("roomId", roomId)

        val record: KafkaProducerRecord<String, String> = KafkaProducerRecord.create("zqzv20yd-vocal", roomId, json.encode())
        kafkaProducer.write(record)
    }

    private fun getRoomId(skillId: String) : String {
        val table = dynamoDb.getTable("SkillMapping")

        val querySpec = QuerySpec()
                .withHashKey(KeyAttribute("skillId", skillId))
                .withScanIndexForward(false)

        val item = table.query(querySpec).first()

        return item.getString("roomName").replace("\\s".toRegex(), "").toLowerCase()
    }

    private fun enrichDrug(json: JsonObject) {

        val defaultFarmaciTable = dynamoDb.getTable("DefaultFarmaci")

        val item: Item = defaultFarmaciTable.getItem("nome", json.getString("nome"))

        json.put("tipoFarmaco", item.get("tipoFarmaco"))

        val dosaggio = json.getJsonObject("dosaggio")

        if (dosaggio.isEmpty) {
            json.put("dosaggio", item.get("dosaggio"))
        } else {
            val dosaggioItem = JsonObject(item.getJSON("dosaggio"))
            dosaggio.put("misura", dosaggioItem.getValue("misura"))
            json.put("dosaggio", dosaggio)
        }
    }
}

data class Name(val name: Value)

data class Value(val value: String)