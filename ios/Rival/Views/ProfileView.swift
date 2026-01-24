import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authManager: AuthManager

    private let backgroundColor = Color(hex: "0a2f1f")
    private let accentColor = Color(hex: "00ff88")

    var body: some View {
        NavigationStack {
            ZStack {
                backgroundColor.ignoresSafeArea()

                VStack(spacing: 24) {
                    if let user = authManager.currentUser {
                        // Profile Header
                        VStack(spacing: 16) {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 80))
                                .foregroundColor(accentColor)

                            Text("@\(user.username)")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)

                            Text(user.email)
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                        .padding(.top, 40)

                        // Balance Card
                        VStack(spacing: 8) {
                            Text("BALANCE")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.gray)

                            Text(user.balanceFormatted)
                                .font(.system(size: 36, weight: .bold))
                                .foregroundColor(accentColor)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                        .background(Color.black.opacity(0.3))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(accentColor.opacity(0.3), lineWidth: 1)
                        )
                        .padding(.horizontal)

                        Spacer()

                        // Logout Button
                        Button(action: { authManager.logout() }) {
                            Text("LOGOUT")
                                .font(.headline)
                                .fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.red.opacity(0.8))
                        .foregroundColor(.white)
                        .cornerRadius(8)
                        .padding(.horizontal)
                        .padding(.bottom, 24)
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(backgroundColor, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject(AuthManager())
}
