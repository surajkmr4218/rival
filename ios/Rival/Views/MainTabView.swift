import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    private let backgroundColor = Color(hex: "0a2f1f")
    private let accentColor = Color(hex: "00ff88")

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Dashboard")
                }
                .tag(0)

            ActiveChallengesView()
                .tabItem {
                    Image(systemName: "flame.fill")
                    Text("Active")
                }
                .tag(1)

            LeaderboardView()
                .tabItem {
                    Image(systemName: "trophy.fill")
                    Text("Leaderboard")
                }
                .tag(2)

            ProfileView()
                .tabItem {
                    Image(systemName: "person.fill")
                    Text("Profile")
                }
                .tag(3)
        }
        .tint(accentColor)
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthManager())
}
