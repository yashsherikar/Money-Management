package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.WishRoomDtos.*;
import com.moneymanager.backend.dto.WishlistDtos.WishlistItemResponse;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.WishRoomService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wishroom")
public class WishRoomController {

    private final WishRoomService wishRoomService;

    public WishRoomController(WishRoomService wishRoomService) {
        this.wishRoomService = wishRoomService;
    }

    @GetMapping("/status")
    public ConnectionStatus status(@AuthenticationPrincipal User user) {
        return wishRoomService.status(user);
    }

    @PostMapping("/connect")
    public ConnectionStatus connect(@AuthenticationPrincipal User user, @Valid @RequestBody ConnectRequest request) {
        return wishRoomService.connect(user, request);
    }

    @DeleteMapping("/connect")
    public void disconnect(@AuthenticationPrincipal User user) {
        wishRoomService.disconnect(user);
    }

    @GetMapping("/rooms")
    public List<RoomSummary> rooms(@AuthenticationPrincipal User user) {
        return wishRoomService.listRooms(user);
    }

    @GetMapping("/rooms/{roomId}/items")
    public List<RoomItemSummary> items(@AuthenticationPrincipal User user, @PathVariable String roomId) {
        return wishRoomService.listItems(user, roomId);
    }

    @PostMapping("/import")
    public WishlistItemResponse importItem(@AuthenticationPrincipal User user, @Valid @RequestBody ImportItemRequest request) {
        return wishRoomService.importItem(user, request);
    }
}
