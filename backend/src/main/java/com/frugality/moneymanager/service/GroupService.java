package com.frugality.moneymanager.service;

import com.frugality.moneymanager.dto.GroupDtos.*;
import com.frugality.moneymanager.entity.Group;
import com.frugality.moneymanager.entity.GroupMember;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.repository.GroupMemberRepository;
import com.frugality.moneymanager.repository.GroupRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class GroupService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private final SecureRandom random = new SecureRandom();

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;

    public GroupService(GroupRepository groupRepository, GroupMemberRepository groupMemberRepository) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
    }

    public List<GroupResponse> myGroups(User user) {
        return groupMemberRepository.findByUserId(user.getId()).stream()
                .map(gm -> toResponse(gm.getGroup()))
                .toList();
    }

    @Transactional
    public GroupResponse create(User user, CreateGroupRequest request) {
        Group group = new Group();
        group.setName(request.name());
        group.setOwner(user);
        group.setInviteCode(generateUniqueCode());
        group = groupRepository.save(group);

        GroupMember membership = new GroupMember();
        membership.setGroup(group);
        membership.setUser(user);
        groupMemberRepository.save(membership);

        return toResponse(group);
    }

    @Transactional
    public GroupResponse join(User user, JoinGroupRequest request) {
        Group group = groupRepository.findByInviteCode(request.inviteCode().trim().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "invalid invite code"));
        if (!groupMemberRepository.existsByGroupIdAndUserId(group.getId(), user.getId())) {
            GroupMember membership = new GroupMember();
            membership.setGroup(group);
            membership.setUser(user);
            groupMemberRepository.save(membership);
        }
        return toResponse(group);
    }

    Group getIfMember(User user, Long groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "group not found"));
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "not a member of this group");
        }
        return group;
    }

    private String generateUniqueCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            code = sb.toString();
        } while (groupRepository.existsByInviteCode(code));
        return code;
    }

    private GroupResponse toResponse(Group group) {
        List<MemberSummary> members = groupMemberRepository.findByGroupId(group.getId()).stream()
                .map(gm -> new MemberSummary(gm.getUser().getId(), gm.getUser().getName(), gm.getUser().getEmail()))
                .collect(Collectors.toList());
        return new GroupResponse(group.getId(), group.getName(), group.getInviteCode(),
                group.getOwner().getId(), group.getCreatedAt(), members);
    }
}
