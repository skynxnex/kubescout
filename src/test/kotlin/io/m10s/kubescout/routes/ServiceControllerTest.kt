package io.m10s.kubescout.routes

import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.m10s.kubescout.config.AppConfig
import io.m10s.kubescout.k8s.K8sServiceReader
import io.m10s.kubescout.k8s.K8sServiceReaderFactory
import io.m10s.kubescout.model.ServiceSummary
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.http.HttpStatus

class ServiceControllerTest : FreeSpec({

    fun makeConfig(localMode: Boolean = true, localNamespace: String = "default") = AppConfig(
        localMode = localMode,
        localNamespace = localNamespace,
        localContext = "",
        devNamespace = "",
        devKubeContext = "",
        prodNamespace = "",
        prodKubeContext = "",
        restartRedThreshold = 3,
        maxReplicas = 50,
        humioBaseUrl = "",
        humioRepo = "",
        humioTimeZone = "UTC",
        humioStart = "7d",
        humioNamespace = "",
        inClusterNamespace = "",
    )

    fun makeSummary(name: String, ns: String = "default") = ServiceSummary(
        serviceName = name,
        namespace = ns,
        podCount = 1,
        readyCount = 1,
        restartCount = 0,
    )

    "ServiceController.servicesLocal" - {

        "should return 400 with missing namespace message when no namespace param" {
            val serviceReader = mockk<K8sServiceReader>()
            val localReader = mockk<K8sServiceReader>()
            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = serviceReader,
                localServiceReader = localReader,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(prefix = null, namespace = null, context = null)

            response.statusCode shouldBe HttpStatus.BAD_REQUEST
            val body = response.body.toString()
            body shouldContain "Missing required query param: namespace"
        }

        "should call reader with a single valid namespace and return 200" {
            val localReader = mockk<K8sServiceReader>()
            val namespacesSlot = slot<List<String>>()
            every { localReader.fetchServiceSummaries(any(), capture(namespacesSlot)) } returns listOf(
                makeSummary("app-vehicle-api", "my-namespace"),
            )

            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = mockk(),
                localServiceReader = localReader,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(
                prefix = null,
                namespace = listOf("my-namespace"),
                context = null,
            )

            response.statusCode shouldBe HttpStatus.OK
            namespacesSlot.captured shouldBe listOf("my-namespace")
        }

        "should call reader with two namespaces and return 200" {
            val localReader = mockk<K8sServiceReader>()
            val namespacesSlot = slot<List<String>>()
            every { localReader.fetchServiceSummaries(any(), capture(namespacesSlot)) } returns emptyList()

            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = mockk(),
                localServiceReader = localReader,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(
                prefix = null,
                namespace = listOf("ns-a", "ns-b"),
                context = null,
            )

            response.statusCode shouldBe HttpStatus.OK
            namespacesSlot.captured shouldBe listOf("ns-a", "ns-b")
        }

        "should return 400 when 11 namespaces are provided" {
            val localReader = mockk<K8sServiceReader>()
            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = mockk(),
                localServiceReader = localReader,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(
                prefix = null,
                namespace = (1..11).map { "ns-$it" },
                context = null,
            )

            response.statusCode shouldBe HttpStatus.BAD_REQUEST
            response.body.toString() shouldContain "Too many namespaces: max 10 allowed"
        }

        "should return 400 for namespace with invalid chars" {
            val localReader = mockk<K8sServiceReader>()
            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = mockk(),
                localServiceReader = localReader,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(
                prefix = null,
                namespace = listOf("ns;drop table"),
                context = null,
            )

            response.statusCode shouldBe HttpStatus.BAD_REQUEST
            response.body.toString() shouldContain "Invalid namespace parameter"
        }

        "should return 400 for prefix with invalid chars" {
            val localReader = mockk<K8sServiceReader>()
            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = mockk(),
                localServiceReader = localReader,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(
                prefix = listOf("bad`prefix"),
                namespace = listOf("my-namespace"),
                context = null,
            )

            response.statusCode shouldBe HttpStatus.BAD_REQUEST
            response.body.toString() shouldContain "Invalid prefix parameter"
        }

        "should default prefix to listOf('app-') when prefix param is absent" {
            val localReader = mockk<K8sServiceReader>()
            val prefixesSlot = slot<List<String>>()
            every { localReader.fetchServiceSummaries(capture(prefixesSlot), any()) } returns emptyList()

            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = mockk(),
                localServiceReader = localReader,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(
                prefix = null,
                namespace = listOf("my-namespace"),
                context = null,
            )

            response.statusCode shouldBe HttpStatus.OK
            prefixesSlot.captured shouldBe listOf("app-")
        }

        "should deduplicate namespaces before calling reader" {
            val localReader = mockk<K8sServiceReader>()
            val namespacesSlot = slot<List<String>>()
            every { localReader.fetchServiceSummaries(any(), capture(namespacesSlot)) } returns emptyList()

            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = mockk(),
                localServiceReader = localReader,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(
                prefix = null,
                namespace = listOf("ns-a", "ns-a", "ns-b"),
                context = null,
            )

            response.statusCode shouldBe HttpStatus.OK
            namespacesSlot.captured shouldBe listOf("ns-a", "ns-b")
        }

        "should return 404 with 'Local mode not enabled' when localServiceReader is null" {
            val controller = ServiceController(
                appConfig = makeConfig(localMode = false),
                serviceReader = mockk(),
                localServiceReader = null,
                localReaderFactory = null,
            )

            val response = controller.servicesLocal(
                prefix = null,
                namespace = listOf("my-namespace"),
                context = null,
            )

            response.statusCode shouldBe HttpStatus.NOT_FOUND
            response.body.toString() shouldContain "Local mode not enabled"
        }

        "should use context-specific reader from factory when context param is provided" {
            val defaultLocalReader = mockk<K8sServiceReader>()
            val contextReader = mockk<K8sServiceReader>()
            val factory = mockk<K8sServiceReaderFactory>()
            every { factory.forContext("my-ctx") } returns contextReader
            every { contextReader.fetchServiceSummaries(any(), any()) } returns emptyList()

            val controller = ServiceController(
                appConfig = makeConfig(),
                serviceReader = mockk(),
                localServiceReader = defaultLocalReader,
                localReaderFactory = factory,
            )

            val response = controller.servicesLocal(
                prefix = null,
                namespace = listOf("my-namespace"),
                context = "my-ctx",
            )

            response.statusCode shouldBe HttpStatus.OK
            verify { factory.forContext("my-ctx") }
            verify { contextReader.fetchServiceSummaries(any(), any()) }
        }
    }
})
