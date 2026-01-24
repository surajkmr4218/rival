import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var isRegistering = false

    private let backgroundColor = Color(hex: "0a2f1f")
    private let accentColor = Color(hex: "00ff88")

    var body: some View {
        ZStack {
            backgroundColor.ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Logo
                Image(systemName: "trophy.fill")
                    .font(.system(size: 48))
                    .foregroundColor(accentColor)
                    .padding()
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(accentColor, lineWidth: 2)
                    )

                // Title
                VStack(spacing: 8) {
                    Text("COMMITMENT")
                        .font(.system(size: 32, weight: .black))
                        .foregroundColor(.white)
                    Text("ARENA")
                        .font(.system(size: 32, weight: .black))
                        .foregroundColor(.white)
                    Text("HIGH STAKES PRODUCTIVITY")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.gray)
                        .tracking(2)
                }

                Spacer()

                // Form
                VStack(spacing: 16) {
                    if isRegistering {
                        InputField(
                            title: "USERNAME",
                            placeholder: "your_username",
                            text: $username,
                            accentColor: accentColor
                        )
                    }

                    InputField(
                        title: "EMAIL",
                        placeholder: "player@arena.com",
                        text: $email,
                        accentColor: accentColor,
                        keyboardType: .emailAddress
                    )

                    InputField(
                        title: "PASSWORD",
                        placeholder: "********",
                        text: $password,
                        accentColor: accentColor,
                        isSecure: true
                    )

                    if let error = authManager.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }

                    // Main Button
                    Button(action: handleSubmit) {
                        if authManager.isLoading {
                            ProgressView()
                                .tint(.black)
                        } else {
                            Text(isRegistering ? "CREATE ACCOUNT" : "LOGIN")
                                .font(.headline)
                                .fontWeight(.bold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(accentColor)
                    .foregroundColor(.black)
                    .cornerRadius(8)
                    .disabled(authManager.isLoading)

                    // Toggle Button
                    Button(action: { isRegistering.toggle() }) {
                        Text(isRegistering ? "Already have an account? Login" : "Create Account")
                            .font(.subheadline)
                            .foregroundColor(accentColor)
                    }
                }
                .padding(.horizontal, 24)

                Spacer()

                // Footer
                Text("WAGER RESPONSIBLY")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.gray)
                    .tracking(2)
                    .padding(.bottom, 32)
            }
        }
    }

    private func handleSubmit() {
        Task {
            if isRegistering {
                await authManager.register(email: email, username: username, password: password)
            } else {
                await authManager.login(email: email, password: password)
            }
        }
    }
}

struct InputField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    let accentColor: Color
    var keyboardType: UIKeyboardType = .default
    var isSecure: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(accentColor)

            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .padding()
            .background(Color.black.opacity(0.3))
            .foregroundColor(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(accentColor.opacity(0.5), lineWidth: 1)
            )
        }
    }
}

// Color extension for hex support
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthManager())
}
