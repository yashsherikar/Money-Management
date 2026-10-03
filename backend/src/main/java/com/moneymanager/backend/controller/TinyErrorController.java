package com.moneymanager.backend.controller;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Replace Spring's default HTML error page with a tiny plain body.
 * cron-job.org fails with "output too large" when it gets a verbose HTML 404/502 page.
 */
@RestController
public class TinyErrorController implements ErrorController {

    private static final byte[] ERR = "ERR".getBytes(java.nio.charset.StandardCharsets.US_ASCII);

    @RequestMapping("/error")
    public ResponseEntity<byte[]> error(HttpServletRequest request) {
        Object statusAttr = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int status = 500;
        if (statusAttr instanceof Integer i) {
            status = i;
        } else if (statusAttr != null) {
            try {
                status = Integer.parseInt(statusAttr.toString());
            } catch (NumberFormatException ignored) {
                status = 500;
            }
        }
        return ResponseEntity.status(status)
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(ERR.length)
                .body(ERR);
    }
}
