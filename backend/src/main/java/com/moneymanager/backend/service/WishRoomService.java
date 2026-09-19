package com.moneymanager.backend.service;

import com.moneymanager.backend.client.WishRoomClient;
import com.moneymanager.backend.dto.WishRoomDtos.*;
import com.moneymanager.backend.dto.WishlistDtos.WishlistItemRequest;
import com.moneymanager.backend.dto.WishlistDtos.WishlistItemResponse;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.entity.WishRoomConnection;
import com.moneymanager.backend.repository.WishRoomConnectionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
public class WishRoomService {

    private final WishRoomConnectionRepository connectionRepository;
    private final WishRoomClient wishRoomClient;
    private final WishlistService wishlistService;

    public WishRoomService(WishRoomConnectionRepository connectionRepository, WishRoomClient wishRoomClient,
                            WishlistService wishlistService) {
        this.connectionRepository = connectionRepository;
        this.wishRoomClient = wishRoomClient;
        this.wishlistService = wishlistService;
    }

    public ConnectionStatus status(User user) {
        return connectionRepository.findByUserId(user.getId())
                .map(c -> new ConnectionStatus(true, c.getWishroomEmail(), c.getWishroomName()))
                .orElse(new ConnectionStatus(false, null, null));
    }

    @Transactional
    public ConnectionStatus connect(User user, ConnectRequest request) {
        WishRoomClient.AuthResult auth = wishRoomClient.login(request.email(), request.password());
        WishRoomConnection connection = connectionRepository.findByUserId(user.getId()).orElseGet(WishRoomConnection::new);
        connection.setUser(user);
        connection.setToken(auth.token());
        connection.setWishroomUserId(auth.userId());
        connection.setWishroomEmail(auth.email());
        connection.setWishroomName(auth.name());
        connectionRepository.save(connection);
        return new ConnectionStatus(true, auth.email(), auth.name());
    }

    @Transactional
    public void disconnect(User user) {
        connectionRepository.findByUserId(user.getId()).ifPresent(connectionRepository::delete);
    }

    public List<RoomSummary> listRooms(User user) {
        String token = requireToken(user);
        return wishRoomClient.listRooms(token).stream()
                .map(r -> new RoomSummary(r.id(), r.name(), r.itemCount()))
                .toList();
    }

    public List<RoomItemSummary> listItems(User user, String roomId) {
        String token = requireToken(user);
        return wishRoomClient.listItems(token, roomId).stream()
                .map(i -> new RoomItemSummary(i.id(), i.title(), i.price(), i.currency(), i.url(), i.imageUrl(), i.status()))
                .toList();
    }

    @Transactional
    public WishlistItemResponse importItem(User user, ImportItemRequest request) {
        String token = requireToken(user);
        WishRoomClient.Item item = wishRoomClient.listItems(token, request.roomId()).stream()
                .filter(i -> i.id().equals(request.itemId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found in that WishRoom room"));

        if (item.price() == null || item.price() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "this item has no price set in WishRoom yet — add one there first");
        }

        WishlistItemRequest wishlistRequest = new WishlistItemRequest(
                item.title(), BigDecimal.valueOf(item.price()), item.url(), request.groupId());
        return wishlistService.create(user, wishlistRequest);
    }

    private String requireToken(User user) {
        return connectionRepository.findByUserId(user.getId())
                .map(WishRoomConnection::getToken)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "WishRoom not connected"));
    }
}
