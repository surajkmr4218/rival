import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authManager: AuthManager

    private let backgroundColor = Color(hex: "0a2f1f")
    private let accentColor = Color(hex: "00ff88")

    var body: some View {
        NavigationStack {
            ZStack {
                backgroundColor.ignoresSafeArea()

                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 32))
                            .foregroundColor(accentColor)

                        Text("COMMITMENT ARENA")
                            .font(.system(size: 18, weight: .black))
                            .foregroundColor(accentColor)
                            .italic()
                    }
                    .padding(.top)

                    // Active Challenges Section
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Circle()
                                .fill(accentColor)
                                .frame(width: 8, height: 8)
                            Text("ACTIVE CHALLENGES")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                        }

                        // Placeholder challenges
                        Text("No active challenges")
                            .foregroundColor(.gray)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                    }
                    .padding(.horizontal)

                    Spacer()

                    // Start New Challenge Button
                    Button(action: {}) {
                        Text("START NEW CHALLENGE")
                            .font(.headline)
                            .fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(accentColor)
                    .foregroundColor(.black)
                    .cornerRadius(8)
                    .padding(.horizontal)
                    .padding(.bottom, 24)
                }
            }
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(AuthManager())
}
