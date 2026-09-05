import ClerkKit
import SwiftUI

enum AccountDeletionVerificationError: LocalizedError {
    case identityChanged, unavailable, unsupported, busy

    var errorDescription: String? {
        switch self {
        case .identityChanged: "The sign-in identity changed. Restart deletion for the intended account."
        case .unavailable: "The original sign-in identity is unavailable. Sign in again before deleting the account."
        case .unsupported: "No supported identity verification method is available. Contact support before deleting account data."
        case .busy: "Identity verification is already in progress."
        }
    }
}

/// Injectable SDK boundary; tests use synthetic responses and never contact Clerk.
struct AccountDeletionVerificationClient {
    var start: @MainActor () async throws -> SessionVerification
    var prepare: @MainActor (Factor, Bool) async throws -> SessionVerification
    var attempt: @MainActor (Factor, Bool, String) async throws -> SessionVerification

    @MainActor
    static func clerk(session: Session, hasSecondFactor: Bool) -> Self {
        Self(
            start: { try await session.startVerification(level: hasSecondFactor ? .secondFactor : .firstFactor) },
            prepare: { factor, second in
                switch factor.strategy {
                case .emailCode where !second:
                    guard let id = factor.emailAddressId else { throw AccountDeletionVerificationError.unsupported }
                    return try await session.sendEmailCode(emailAddressId: id)
                case .phoneCode:
                    guard let id = factor.phoneNumberId else { throw AccountDeletionVerificationError.unsupported }
                    if second { return try await session.sendMfaPhoneCode(phoneNumberId: id) }
                    return try await session.sendPhoneCode(phoneNumberId: id)
                default: throw AccountDeletionVerificationError.unsupported
                }
            },
            attempt: { factor, second, value in
                switch factor.strategy {
                case .password where !second: return try await session.verifyWithPassword(value)
                case .emailCode where !second: return try await session.verifyWithEmailCode(code: value)
                case .phoneCode:
                    if second { return try await session.verifyWithMfaPhoneCode(code: value) }
                    return try await session.verifyWithPhoneCode(code: value)
                case .totp where second: return try await session.verifyWithTOTP(code: value)
                case .backupCode where second: return try await session.verifyWithBackupCode(code: value)
                default: throw AccountDeletionVerificationError.unsupported
                }
            }
        )
    }
}

@MainActor
final class AccountDeletionVerificationModel: ObservableObject {
    @Published private(set) var isPresented = false
    @Published private(set) var isBusy = false
    @Published private(set) var factors: [Factor] = []
    @Published private(set) var selectedFactor: Factor?
    @Published private(set) var message: String?
    private var secondFactor = false
    private var client: AccountDeletionVerificationClient?
    private var isCurrent: (() -> Bool)?
    private var requestID: UUID?
    private var completion: CheckedContinuation<Void, Error>?

    func verify(client: AccountDeletionVerificationClient, isCurrent: @escaping () -> Bool) async throws {
        guard completion == nil else { throw AccountDeletionVerificationError.busy }
        try Task.checkCancellation()
        guard isCurrent() else { throw AccountDeletionVerificationError.identityChanged }
        let id = UUID()
        requestID = id
        self.client = client
        self.isCurrent = isCurrent
        isPresented = true
        isBusy = true
        message = nil
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                completion = continuation
                Task { await begin(id: id) }
            }
        } onCancel: {
            Task { @MainActor in self.cancel(id: id) }
        }
    }

    func cancel(id: UUID? = nil) {
        guard id == nil || id == requestID else { return }
        finish(.failure(CancellationError()))
    }

    func invalidateIfNeeded() {
        if isPresented, isCurrent?() != true { finish(.failure(AccountDeletionVerificationError.identityChanged)) }
    }

    private func requireCurrent(_ id: UUID) throws {
        guard requestID == id, isCurrent?() == true, !Task.isCancelled else {
            throw AccountDeletionVerificationError.identityChanged
        }
    }

    private func begin(id: UUID) async {
        do {
            try requireCurrent(id)
            guard let client else { throw AccountDeletionVerificationError.unavailable }
            let result = try await client.start()
            try requireCurrent(id)
            try accept(result)
        } catch { handle(error, id: id) }
    }

    func select(_ factor: Factor) async {
        guard let id = requestID, !isBusy, factors.contains(factor), let client else { return }
        isBusy = true
        message = nil
        do {
            try requireCurrent(id)
            if factor.strategy == .emailCode || factor.strategy == .phoneCode {
                let result = try await client.prepare(factor, secondFactor)
                try requireCurrent(id)
                try accept(result)
                guard requestID == id else { return }
            }
            selectedFactor = factor
            isBusy = false
        } catch { handle(error, id: id) }
    }

    func submit(_ value: String) async {
        guard let id = requestID, !isBusy, let factor = selectedFactor, let client, !value.isEmpty else { return }
        isBusy = true
        message = nil
        do {
            try requireCurrent(id)
            let result = try await client.attempt(factor, secondFactor, value)
            try requireCurrent(id)
            try accept(result)
        } catch { handle(error, id: id) }
    }

    private func accept(_ result: SessionVerification) throws {
        if result.status == .complete { finish(.success(())); return }
        let wasSecond = secondFactor
        switch result.status {
        case .needsFirstFactor: secondFactor = false
        case .needsSecondFactor: secondFactor = true
        default: throw AccountDeletionVerificationError.unsupported
        }
        factors = (secondFactor ? result.supportedSecondFactors : result.supportedFirstFactors) ?? []
        factors = factors.filter { factor in
            switch factor.strategy {
            case .password: return !secondFactor
            case .emailCode: return !secondFactor && factor.emailAddressId != nil
            case .phoneCode: return factor.phoneNumberId != nil
            case .totp, .backupCode: return secondFactor
            default: return false
            }
        }
        guard !factors.isEmpty else { throw AccountDeletionVerificationError.unsupported }
        if wasSecond != secondFactor || !factors.contains(where: { $0 == selectedFactor }) { selectedFactor = nil }
        isBusy = false
    }

    private func handle(_ error: Error, id: UUID) {
        guard requestID == id else { return }
        if isCurrent?() != true || error is AccountDeletionVerificationError || error is CancellationError {
            finish(.failure(error))
        } else {
            message = error.localizedDescription
            isBusy = false
            // A failed initial request has no input to retry. Return to deletion
            // confirmation; invalid codes retain the selected method for retry.
            if factors.isEmpty { finish(.failure(error)) }
        }
    }

    private func finish(_ result: Result<Void, Error>) {
        let pending = completion
        completion = nil
        requestID = nil
        client = nil
        isCurrent = nil
        isPresented = false
        isBusy = false
        factors = []
        selectedFactor = nil
        secondFactor = false
        message = nil
        pending?.resume(with: result)
    }
}

struct AccountDeletionVerificationView: View {
    @ObservedObject var model: AccountDeletionVerificationModel
    @State private var value = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Verify your identity").font(.headline)
            Text("Confirm your sign-in identity to continue account deletion.")
                .font(.subheadline).foregroundStyle(.secondary)
            if model.isBusy { ProgressView("Verifying…") }
            if let factor = model.selectedFactor {
                Text(inputInstruction(factor)).font(.subheadline)
                if factor.strategy == .password {
                    SecureField("Password", text: $value).textContentType(.password)
                        .textFieldStyle(.roundedBorder)
                } else {
                    TextField("Verification code", text: $value)
                        .textContentType(.oneTimeCode).textInputAutocapitalization(.never)
                        .autocorrectionDisabled().textFieldStyle(.roundedBorder)
                }
                Button("Verify and continue") {
                    let entered = value
                    value = ""
                    Task { await model.submit(entered) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.isBusy || value.isEmpty)
            }
            ForEach(Array(model.factors.enumerated()), id: \.offset) { _, factor in
                if factor != model.selectedFactor || factor.strategy == .emailCode || factor.strategy == .phoneCode {
                    Button(factor == model.selectedFactor ? "Resend code" : methodName(factor)) {
                        value = ""
                        Task { await model.select(factor) }
                    }.disabled(model.isBusy)
                }
            }
            if let message = model.message {
                Text(message).font(.footnote).foregroundStyle(.red)
            }
            Button("Cancel verification", role: .cancel) { value = ""; model.cancel() }
                .buttonStyle(.bordered)
        }
        .onDisappear { value = "" }
    }

    private func methodName(_ factor: Factor) -> String {
        switch factor.strategy {
        case .password: "Use your password"
        case .emailCode: "Email a code\(factor.safeIdentifier.map { " to \($0)" } ?? "")"
        case .phoneCode: "Text a code\(factor.safeIdentifier.map { " to \($0)" } ?? "")"
        case .totp: "Use your authenticator app"
        case .backupCode: "Use a backup code"
        default: "Verify identity"
        }
    }

    private func inputInstruction(_ factor: Factor) -> String {
        switch factor.strategy {
        case .password: "Enter your password."
        case .emailCode, .phoneCode: "Enter the code sent\(factor.safeIdentifier.map { " to \($0)" } ?? " to your selected method")."
        case .totp: "Enter a code from your authenticator app."
        case .backupCode: "Enter an unused backup code."
        default: "Confirm your identity."
        }
    }
}
