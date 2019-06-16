package main

import io.vertx.core.AbstractVerticle
import io.vertx.core.Future
import io.vertx.core.Vertx

class Launcher : AbstractVerticle() {

    override fun start(startFuture: Future<Void>?) {
        getVertx().deployVerticle(HospitalService())
        startFuture?.complete()
    }

    companion object {
        @JvmStatic fun main(args: Array<String>) {
            Vertx.vertx().deployVerticle(Launcher())
        }
    }
}