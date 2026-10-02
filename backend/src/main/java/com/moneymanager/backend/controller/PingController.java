package com.moneymanager.backend.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Tiny wake-up target for cron-job.org. Actuator health sometimes gets marked
 * "Failed (output too large)" on their side (chunked JSON / header quirks) even
 * though the body is tiny — repeated failures can auto-disable the job and stop
 * cold-start wake-ups. Plain "OK" with an explicit Content-Length avoids that.
 */
@RestController
public class PingController {

    private static final byte[] OK = "OK".getBytes(java.nio.charset.StandardCharsets.US_ASCII);

    @GetMapping(value = "/api/ping", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<byte[]> ping() {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(OK.length)
                .body(OK);
    }
}
