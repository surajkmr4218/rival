import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case serverError(String)
    case decodingError
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Unauthorized"
        case .serverError(let message):
            return message
        case .decodingError:
            return "Failed to decode response"
        case .networkError(let error):
            return error.localizedDescription
        }
    }
}

class APIClient {
    static let shared = APIClient()

    #if DEBUG
    private let baseURL = "http://localhost:8000"
    #else
    private let baseURL = "https://api.rival.app"
    #endif

    private init() {}

    // MARK: - Auth Endpoints

    func register(email: String, username: String, password: String) async throws -> User {
        let body = RegisterRequest(email: email, username: username, password: password)
        return try await post("/api/auth/register", body: body)
    }

    func login(email: String, password: String) async throws -> AuthToken {
        // OAuth2 form requires x-www-form-urlencoded
        let url = URL(string: baseURL + "/api/auth/login")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let formData = "username=\(email.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&password=\(password.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
        request.httpBody = formData.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }

        guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            if let errorResponse = try? JSONDecoder().decode(ServerError.self, from: data) {
                throw APIError.serverError(errorResponse.detail)
            }
            throw APIError.serverError("Request failed with status \(httpResponse.statusCode)")
        }

        let decoder = JSONDecoder()
        return try decoder.decode(AuthToken.self, from: data)
    }

    func getCurrentUser() async throws -> User {
        return try await get("/api/users/me")
    }

    // MARK: - Generic Request Methods

    private func get<T: Decodable>(_ path: String) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        addAuthHeader(to: &request)

        return try await performRequest(request)
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthHeader(to: &request)

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(body)

        return try await performRequest(request)
    }

    private func addAuthHeader(to request: inout URLRequest) {
        if let token = KeychainManager.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func performRequest<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }

        guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            if let errorResponse = try? JSONDecoder().decode(ServerError.self, from: data) {
                throw APIError.serverError(errorResponse.detail)
            }
            throw APIError.serverError("Request failed with status \(httpResponse.statusCode)")
        }

        let decoder = JSONDecoder()
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError
        }
    }
}
