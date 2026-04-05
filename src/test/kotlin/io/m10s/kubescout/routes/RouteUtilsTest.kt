package io.m10s.kubescout.routes

import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldHaveMaxLength

class RouteUtilsTest : FreeSpec({

    "validateParam" - {

        "should return the string for a valid K8s name" {
            validateParam("my-namespace") shouldBe "my-namespace"
        }

        "should return the string for a valid context with colon" {
            validateParam("my-context:123") shouldBe "my-context:123"
        }

        "should return null for a shell metacharacter semicolon" {
            validateParam("ns;rm -rf /") shouldBe null
        }

        "should return null for a backtick" {
            validateParam("ns`cmd`") shouldBe null
        }

        "should return null for a string over 200 chars" {
            val longString = "a".repeat(201)
            validateParam(longString) shouldBe null
        }

        "should return null for a blank string" {
            validateParam("   ") shouldBe null
        }

        "should return the string for exactly 200 valid chars" {
            val exactly200 = "a".repeat(200)
            validateParam(exactly200) shouldBe exactly200
        }

        "should return null for null input" {
            validateParam(null) shouldBe null
        }
    }

    "sanitizeErrorMessage" - {

        "should redact URLs" {
            val result = sanitizeErrorMessage("connect to https://internal-api:8080/path failed")
            result shouldBe "connect to <redacted-url> failed"
        }

        "should redact IP addresses" {
            val result = sanitizeErrorMessage("connection to 10.0.0.1:443 refused")
            result shouldBe "connection to <redacted-ip> refused"
        }

        "should truncate strings over 500 chars" {
            val longMessage = "x".repeat(600)
            val result = sanitizeErrorMessage(longMessage)
            result shouldHaveMaxLength 500
        }

        "should return 'An error occurred' for null input" {
            sanitizeErrorMessage(null) shouldBe "An error occurred"
        }

        "should return a normal string unchanged when no sensitive data" {
            sanitizeErrorMessage("service is healthy") shouldBe "service is healthy"
        }
    }

    "checkCsrfHeader" - {

        "should return true for value 'kubescout'" {
            checkCsrfHeader("kubescout") shouldBe true
        }

        "should return false for null" {
            checkCsrfHeader(null) shouldBe false
        }

        "should return false for empty string" {
            checkCsrfHeader("") shouldBe false
        }

        "should return false for wrong case 'KSS'" {
            checkCsrfHeader("KSS") shouldBe false
        }

        "should return false for 'kss ' with trailing space" {
            checkCsrfHeader("kss ") shouldBe false
        }
    }

    "isAwsSsoAuthError" - {

        "should return true when message contains 'expiredtoken' case-insensitively" {
            isAwsSsoAuthError(RuntimeException("ExpiredToken received")) shouldBe true
        }

        "should return true when message contains 'aws sso'" {
            isAwsSsoAuthError(RuntimeException("aws sso session expired")) shouldBe true
        }

        "should return true when message contains 'unable to load aws credentials'" {
            isAwsSsoAuthError(RuntimeException("unable to load aws credentials from provider")) shouldBe true
        }

        "should return false for an unrelated message" {
            isAwsSsoAuthError(RuntimeException("connection refused")) shouldBe false
        }
    }
})
