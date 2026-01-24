import Foundation
import SwiftUI

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let apiClient = APIClient.shared

    init() {
        // Check for existing token on launch
        if KeychainManager.getToken() != nil {
            Task {
                await loadCurrentUser()
            }
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let token = try await apiClient.login(email: email, password: password)
            KeychainManager.saveToken(token.accessToken)
            await loadCurrentUser()
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func register(email: String, username: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            _ = try await apiClient.register(email: email, username: username, password: password)
            // Auto-login after registration
            await login(email: email, password: password)
        } catch let error as APIError {
            errorMessage = error.errorDescription
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func logout() {
        KeychainManager.deleteToken()
        currentUser = nil
        isAuthenticated = false
    }

    private func loadCurrentUser() async {
        do {
            currentUser = try await apiClient.getCurrentUser()
            isAuthenticated = true
        } catch {
            // Token invalid, clear it
            KeychainManager.deleteToken()
            isAuthenticated = false
        }
    }
}
