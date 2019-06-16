package main

import com.amazonaws.auth.BasicAWSCredentials
import com.amazonaws.regions.Region
import com.amazonaws.regions.Regions
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient
import com.amazonaws.services.dynamodbv2.document.*
import io.vertx.core.AbstractVerticle
import io.vertx.core.Future
import io.vertx.ext.bridge.PermittedOptions
import io.vertx.ext.web.Router
import io.vertx.ext.web.handler.ErrorHandler
import io.vertx.ext.web.handler.sockjs.BridgeOptions
import io.vertx.ext.web.handler.sockjs.SockJSHandler
import main.Topics.GENERIC_VOICE_TOPIC
import io.vertx.ext.bridge.BridgeEventType
import io.vertx.kafka.client.consumer.KafkaConsumer
import java.util.HashMap
import io.vertx.core.json.JsonObject
import io.vertx.kafka.client.consumer.KafkaConsumerRecord


object Topics {
    const val GENERIC_VOICE_TOPIC = "GENERIC_VOICE_TOPIC"
}

class VocalService : AbstractVerticle() {

    private lateinit var dynamoClientId: String
    private lateinit var dynamoClientSecret: String

    private lateinit var kafkaUsername: String
    private lateinit var kafkaPassword: String

    private lateinit var dynamoDbClient: AmazonDynamoDBClient
    private lateinit var table: Table
    private lateinit var kafkaConsumer: KafkaConsumer<String, String>

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
        val dynamoDb = DynamoDB(dynamoDbClient)
        table = dynamoDb.getTable("VocalEventSource")
    }

    private fun connectToKafka() {

        val brokers = "ark-01.srvs.cloudkafka.com:9094,ark-02.srvs.cloudkafka.com:9094,ark-03.srvs.cloudkafka.com:9094"
        val username = "zqzv20yd"
        val password = "v8niiCvnwHEMqv4fATTBdX_bK7DwyaVN"
        val jaasTemplate = "org.apache.kafka.common.security.scram.ScramLoginModule required username=\"%s\" password=\"%s\";"
        val jaasCfg = String.format(jaasTemplate, username, password)

        val config = HashMap<String, String>()
        config["bootstrap.servers"] = brokers
        config["key.deserializer"] = "org.apache.kafka.common.serialization.StringDeserializer"
        config["value.deserializer"] = "org.apache.kafka.common.serialization.StringDeserializer"
        config["group.id"] = "$username-consumer"
        config["auto.offset.reset"] = "earliest"
        config["enable.auto.commit"] = "false"
        config["security.protocol"] = "SASL_SSL"
        config["sasl.mechanism"] = "SCRAM-SHA-256"
        config["sasl.jaas.config"] = jaasCfg

        kafkaConsumer = KafkaConsumer.create<String, String>(vertx, config)
    }

    private fun createServer() {

        router = Router.router(vertx)

        router.route("/generic-vocal-events/*").handler(eventBusHandler())
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

    private fun setupConsumer() {
        kafkaConsumer.handler { record -> handleVocalEvent(record) }

        kafkaConsumer.subscribe("zqzv20yd-vocal") { ar ->
            if (ar.succeeded()) {
                println("Subscribed")
            } else {
                System.out.println("Could not subscribe " + ar.cause().message)
            }
        }
    }

    private fun handleVocalEvent(record: KafkaConsumerRecord<String, String>) {
        vertx.executeBlocking<Unit>({ future ->

            val json = JsonObject(record.value())

            val item = Item()
                    .with("deviceId", json.getString("deviceId"))
                    .withInt("timestamp", json.getInteger("timestamp"))
                    .withJSON("event", json.encode())

            table.putItem(item)
            publishEvent(json.getString("deviceId"), json)
            future.complete()

        }, {res ->
            if (res.succeeded()) {
                println("Vocal event stored")
            } else {
                println(res.cause())
            }
        })
    }

    private fun publishEvent(deviceId: String, json: JsonObject) {
        vertx.eventBus().publish(GENERIC_VOICE_TOPIC, json)
        vertx.eventBus().publish(deviceId, json)
    }

}