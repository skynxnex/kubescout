package io.m10s.kubescout

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class KubescoutApplication

fun main(args: Array<String>) {
    runApplication<KubescoutApplication>(*args)
}
