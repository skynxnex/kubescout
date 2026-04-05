package io.m10s.kss

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class KssApplication

fun main(args: Array<String>) {
    runApplication<KssApplication>(*args)
}
