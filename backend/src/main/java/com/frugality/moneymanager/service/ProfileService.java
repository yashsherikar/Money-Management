package com.frugality.moneymanager.service;

import com.frugality.moneymanager.dto.ProfileDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class ProfileService {

    private final UserRepository userRepository;

    public ProfileService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public ProfileResponse get(User user) {
        return toResponse(user);
    }

    public ProfileResponse update(User user, UpdateProfileRequest request) {
        if (StringUtils.hasText(request.name())) {
            user.setName(request.name());
        }
        if (request.upiId() != null) {
            user.setUpiId(StringUtils.hasText(request.upiId()) ? request.upiId().trim() : null);
        }
        userRepository.save(user);
        return toResponse(user);
    }

    private ProfileResponse toResponse(User u) {
        return new ProfileResponse(u.getId(), u.getEmail(), u.getName(), u.getUpiId());
    }
}
