package main

import com.amazonaws.auth.BasicAWSCredentials
import com.amazonaws.regions.Region
import com.amazonaws.regions.Regions
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient
import com.amazonaws.services.dynamodbv2.document.*
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec
import com.google.gson.Gson
import io.vertx.core.AbstractVerticle
import io.vertx.core.Future
import io.vertx.ext.web.Router
import io.vertx.ext.web.RoutingContext
import io.vertx.ext.web.handler.BodyHandler
import io.vertx.ext.web.handler.ErrorHandler
import main.models.AlexaIdentity
import main.models.Functionality

class HospitalService : AbstractVerticle() {

    private lateinit var dynamoClientId: String
    private lateinit var dynamoClientSecret: String

    private lateinit var dynamoDbClient: AmazonDynamoDBClient
    private lateinit var dynamoDb: DynamoDB

    private lateinit var gson: Gson
    private lateinit var router: Router

    override fun start(startFuture: Future<Void>?) {

        vertx.fileSystem().readFile("config.json") { r ->
            if (r.succeeded()) {
                val json = r.result().toJsonObject()

                val dynamoConfig = json.getJsonObject("dynamoDB")
                dynamoClientId = dynamoConfig.getString("client-id")
                dynamoClientSecret = dynamoConfig.getString("client-secret")

                vertx.executeBlocking<Unit>({ future ->
                    connectToDB()
                    createServer()
                    future.complete()
                }, {})

            } else {
                throw(r.cause())
            }
        }

        vertx.executeBlocking<Unit>({ future ->
            connectToDB()
            createServer()
            future.complete()
        }, {})

        gson = Gson()
    }

    private fun connectToDB() {
        dynamoDbClient = AmazonDynamoDBClient(BasicAWSCredentials(dynamoClientId, dynamoClientSecret))
        dynamoDbClient.setRegion(Region.getRegion(Regions.EU_WEST_1))
        dynamoDb = DynamoDB(dynamoDbClient)
    }

    private fun createServer() {

        router = Router.router(vertx)
        router.mountSubRouter("/api", apiRouter())
        router.route().failureHandler(errorHandler())

        val herokuPort: String = System.getenv("PORT") ?: "8080"

        vertx.createHttpServer()
                .requestHandler(router)
                .listen(herokuPort.toInt()) { res ->
                    if (res.succeeded()) {
                        println("Server is running on port $herokuPort")
                    } else {
                        println("""Some problems occurred, ${res.cause()}""")
                    }

                }
    }

    private fun errorHandler(): ErrorHandler {
        return ErrorHandler.create()
    }

    private fun apiRouter(): Router {
        val router = Router.router(vertx)
        router.route().handler(BodyHandler.create())
        router.get("/").handler { req -> req.response().end("Welcome to the Reactive Healthboard!") }
        router.post("/functionality").handler(this::handleFunctionality)
        router.get("/functionalities").handler(this::handleFunctionalities)
        return router
    }

    private fun handleFunctionality(routingContext: RoutingContext) {
        vertx.executeBlocking<Unit>({ future ->

            val json = routingContext.bodyAsJson
            val table = dynamoDb.getTable("SkillMapping")

            val querySpec = QuerySpec()
                    .withHashKey(KeyAttribute("skillId", json.getString("deviceId")))
                    .withScanIndexForward(false)

            val item = table.query(querySpec).firstOrNull()

            item?.let {
                    if (it.getString("functionality") == json.getString("functionality"))
                        future.complete()
                    else future.fail("No functionality")
            }

            future.fail("No data available")

        }, {res ->
            if (res.succeeded()) {
                routingContext.response().setStatusCode(200).end()
            } else {
                routingContext.response().setStatusCode(403).end()
            }
        })
    }

    private fun handleFunctionalities(routingContext: RoutingContext) {
        vertx.executeBlocking<String>({ future ->

            val deviceId = routingContext.queryParam("deviceId").first()

            val table = dynamoDb.getTable("AlexaFunctionalities")

            val querySpec = QuerySpec()
                    .withHashKey(KeyAttribute("deviceId", deviceId))
                    .withScanIndexForward(false)

            val item = table.query(querySpec).firstOrNull()

            item?.let {
                val response = AlexaIdentity(
                        it.getString("roomName"),
                        gson.fromJson(it.getJSON("functionalities"), Array<Functionality>::class.java)
                                .toList()
                )

                future.complete(gson.toJson(response))
            }

            future.fail("No data available")

        }, {res ->
            if (res.succeeded()) {
                routingContext.response()
                        .setStatusCode(200)
                        .putHeader("content-type", "application/json; charset=utf-8")
                        .end(res.result())
            } else {
                routingContext.response().setStatusCode(403).end()
            }
        })
    }
}