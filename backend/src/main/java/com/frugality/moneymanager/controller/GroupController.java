package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.GroupDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @GetMapping
    public List<GroupResponse> myGroups(@AuthenticationPrincipal User user) {
        return groupService.myGroups(user);
    }

    @PostMapping
    public GroupResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody CreateGroupRequest request) {
        return groupService.create(user, request);
    }

    @PostMapping("/join")
    public GroupResponse join(@AuthenticationPrincipal User user, @Valid @RequestBody JoinGroupRequest request) {
        return groupService.join(user, request);
    }
}
