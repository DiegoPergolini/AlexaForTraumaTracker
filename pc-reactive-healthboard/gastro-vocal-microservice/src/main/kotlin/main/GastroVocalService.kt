package main

import com.amazonaws.auth.BasicAWSCredentials
import com.amazonaws.regions.Region
import com.amazonaws.regions.Regions
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient
import com.amazonaws.services.dynamodbv2.document.*
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec
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
import main.Topics.GASTRO_VOICE_TOPIC
import java.util.HashMap


object Topics {
    const val GASTRO_VOICE_TOPIC = "GASTRO_VOICE_TOPIC"
}

class GastroVocalService : AbstractVerticle() {


    private lateinit var dynamoClientId: String
    private lateinit var dynamoClientSecret: String

    private lateinit var kafkaUsername: String
    private lateinit var kafkaPassword: String

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

        val brokers = "ark-01.srvs.cloudkafka.com:9094,ark-02.srvs.cloudkafka.com:9094,ark-03.srvs.cloudkafka.com:9094"
        val username = "zqzv20yd"
        val password = "v8niiCvnwHEMqv4fATTBdX_bK7DwyaVN"
        val jaasTemplate = "org.apache.kafka.common.security.scram.ScramLoginModule required username=\"%s\" password=\"%s\";"
        val jaasCfg = String.format(jaasTemplate, username, password)

        val config = HashMap<String, String>()
        config["bootstrap.servers"] = brokers
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

        router.route("/gastro-events/*").handler(eventBusHandler())
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
        router.get("/").handler { req -> req.response().end("Welcome to the Reactive Gastro!")}
        router.post("/inizioEsame").handler(this::handleStartExam)
        router.post("/fineEsame").handler(this::handleEndExam)

        return router
    }

    private fun handleStartExam(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val gastroVocalTable = dynamoDb.getTable("GastroVocalStorage")

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "inizioEsame")

            val roomId = getRoomId(json.getString("deviceId"))

            val item = Item()
                    .with("roomId", roomId)
                    .with("deviceId", json.getString("deviceId"))
                    .with("timestamp", json.getInteger("timestamp"))
                    .with("tag", json.getString("tag"))
                    .with("tipoComando", json.getString("tipoComando"))

            gastroVocalTable.putItem(item)
            publishEvent(roomId, json)
            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Started exam")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun handleEndExam(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val gastroVocalTable = dynamoDb.getTable("GastroVocalStorage")

            val json = routingContext.bodyAsJson
                    .put("tipoComando", "fineEsame")

            val roomId = getRoomId(json.getString("deviceId"))

            val item = Item()
                    .with("roomId", roomId)
                    .with("deviceId", json.getString("deviceId"))
                    .withInt("timestamp", json.getInteger("timestamp"))
                    .with("tag", json.getString("tag"))
                    .with("tipoComando", json.getString("tipoComando"))

            gastroVocalTable.putItem(item)
            publishEvent(roomId, json)
            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Ended exam")
                routingContext.response().setStatusCode(200).end()
            } else {
                println(res.cause())
                routingContext.response().setStatusCode(500).end()
            }
        })
    }

    private fun publishEvent(roomId: String, json: JsonObject) {
        vertx.eventBus().publish(GASTRO_VOICE_TOPIC, json)
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

}