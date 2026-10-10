package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.UpiHintDtos.UpiHintRequest;
import com.moneymanager.backend.dto.UpiHintDtos.UpiHintResponse;
import com.moneymanager.backend.entity.UpiPayeeHint;
import com.moneymanager.backend.repository.UpiPayeeHintRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UpiHintService {

    private final UpiPayeeHintRepository repository;

    public UpiHintService(UpiPayeeHintRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public UpiHintResponse find(String upiId) {
        String key = normalize(upiId);
        return repository.findByUpiId(key)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no hint for this UPI ID"));
    }

    /** Upsert shared UPI → category mapping so the next user who scans gets it prefilled. */
    @Transactional
    public UpiHintResponse save(UpiHintRequest request) {
        String key = normalize(request.upiId());
        if (key.isBlank() || !key.contains("@")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid UPI ID");
        }
        String categoryName = request.categoryName().trim();
        if (categoryName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "category name required");
        }

        // Person-to-person UPI IDs are private: never share a person's name/category with other
        // users. Also drop anything stored for this ID before.
        if (request.personal()) {
            repository.findByUpiId(key).ifPresent(repository::delete);
            return new UpiHintResponse(key, categoryName, true, null);
        }

        UpiPayeeHint hint = repository.findByUpiId(key).orElseGet(UpiPayeeHint::new);
        hint.setUpiId(key);
        hint.setCategoryName(categoryName);
        hint.setPersonal(request.personal());
        if (request.displayName() != null && !request.displayName().isBlank()) {
            hint.setDisplayName(request.displayName().trim());
        }
        return toResponse(repository.save(hint));
    }

    private static String normalize(String upiId) {
        return upiId == null ? "" : upiId.trim().toLowerCase();
    }

    private UpiHintResponse toResponse(UpiPayeeHint h) {
        return new UpiHintResponse(h.getUpiId(), h.getCategoryName(), h.isPersonal(), h.getDisplayName());
    }
}
