import SwiftUI

struct ActiveChallengesView: View {
    private let backgroundColor = Color(hex: "0a2f1f")
    private let accentColor = Color(hex: "00ff88")

    var body: some View {
        NavigationStack {
            ZStack {
                backgroundColor.ignoresSafeArea()

                VStack {
                    Text("No active challenges")
                        .foregroundColor(.gray)
                }
            }
            .navigationTitle("Active")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(backgroundColor, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}

#Preview {
    ActiveChallengesView()
}
