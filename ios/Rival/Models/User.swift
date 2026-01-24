import Foundation

struct User: Codable, Identifiable {
    let id: Int
    let email: String
    let username: String
    let balanceCents: Int
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, email, username
        case balanceCents = "balance_cents"
        case createdAt = "created_at"
    }

    var balanceFormatted: String {
        let dollars = Double(balanceCents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

struct AuthToken: Codable {
    let accessToken: String
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
    }
}

struct RegisterRequest: Codable {
    let email: String
    let username: String
    let password: String
}

struct ServerError: Codable {
    let detail: String
}
