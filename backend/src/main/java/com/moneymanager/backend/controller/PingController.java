package com.moneymanager.backend.controller;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Tiny wake-up target for cron-job.org.
 *
 * Writes a fixed-length plain body so proxies are less likely to switch to
 * {@code Transfer-Encoding: chunked} (which cron-job.org has historically
 * mishandled as "Failed (output too large)").
 *
 * Use: {@code GET https://moneymanager-backend-498b.onrender.com/api/ping}
 */
@RestController
public class PingController {

    private static final byte[] OK = "OK".getBytes(StandardCharsets.US_ASCII);

    @GetMapping({"/api/ping", "/ping"})
    public void ping(HttpServletResponse response) throws IOException {
        writeOk(response);
    }

    @RequestMapping(value = {"/api/ping", "/ping"}, method = RequestMethod.HEAD)
    public void pingHead(HttpServletResponse response) {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("text/plain;charset=US-ASCII");
        response.setContentLength(OK.length);
        response.setHeader("Cache-Control", "no-store");
    }

    private static void writeOk(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("text/plain;charset=US-ASCII");
        response.setContentLength(OK.length);
        response.setHeader("Cache-Control", "no-store");
        response.getOutputStream().write(OK);
        response.flushBuffer();
    }
}
