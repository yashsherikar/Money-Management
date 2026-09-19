package com.moneymanager.backend.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Thin HTTP client for the separate WishRoom (BucketList) app's public API. */
@Component
public class WishRoomClient {

    private final RestClient restClient;

    public WishRoomClient(@Value("${wishroom.api.base-url}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    public AuthResult login(String email, String password) {
        try {
            return restClient.post()
                    .uri("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("email", email, "password", password))
                    .retrieve()
                    .body(AuthResult.class);
        } catch (RestClientResponseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "WishRoom login failed — check the email and password");
        }
    }

    public List<Room> listRooms(String token) {
        return withExpiryHandling(() -> restClient.get()
                .uri("/api/rooms")
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(new ParameterizedTypeReference<List<Room>>() {}));
    }

    public List<Item> listItems(String token, String roomId) {
        return withExpiryHandling(() -> restClient.get()
                .uri("/api/rooms/{roomId}/items", roomId)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(new ParameterizedTypeReference<List<Item>>() {}));
    }

    private <T> T withExpiryHandling(java.util.function.Supplier<T> call) {
        try {
            return call.get();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED || e.getStatusCode() == HttpStatus.FORBIDDEN) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "WishRoom session expired — reconnect it in Wishlist");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "WishRoom request failed");
        }
    }

    public record AuthResult(String token, String userId, String name, String email) {}

    public record Room(String id, String name, String description, String inviteCode,
                        String ownerId, int memberCount, int itemCount, Instant createdAt) {}

    public record Item(String id, String roomId, String url, String title, String imageUrl, String notes,
                        String source, Double price, String currency, String status, String priority,
                        String addedByUserId, String addedByName, String reservedByUserId, String reservedByName,
                        String boughtByUserId, String boughtByName, Instant boughtAt, Instant createdAt, Instant updatedAt) {}
}
