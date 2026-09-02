import Foundation

struct UsagePublicationSource: OptionSet, Equatable {
    let rawValue: Int
    static let localQueue = UsagePublicationSource(rawValue: 1 << 0)
}

enum MenuBarSummarySlot: CaseIterable, Hashable {
    case today
    case rolling
    case total

    var selection: MenuBarSummarySelection {
        switch self {
        case .today: return .today
        case .rolling: return .rolling
        case .total: return .total
        }
    }
}

struct PendingUsagePublicationQueue {
    private(set) var sources = UsagePublicationSource()
    private(set) var summaries = MenuBarSummarySelection()

    var isEmpty: Bool { sources.isEmpty }

    mutating func enqueue(
        _ source: UsagePublicationSource,
        summaries nextSummaries: MenuBarSummarySelection
    ) {
        sources.formUnion(source)
        summaries.formUnion(nextSummaries)
    }

    mutating func removeAll() {
        sources = []
        summaries = []
    }

    mutating func takeIfReady(
        isLoading: Bool,
        syncInFlight: Bool,
        hiddenRefreshInFlight: Bool
    ) -> (sources: UsagePublicationSource, summaries: MenuBarSummarySelection)? {
        guard !isEmpty,
              !UsagePublicationPolicy.shouldQueueRefresh(
                  isLoading: isLoading,
                  syncInFlight: syncInFlight,
                  hiddenRefreshInFlight: hiddenRefreshInFlight
              ) else { return nil }
        let result = (sources, summaries)
        removeAll()
        return result
    }
}

enum UsagePublicationPolicy {
    static func shouldQueueRefresh(
        isLoading: Bool,
        syncInFlight: Bool,
        hiddenRefreshInFlight: Bool
    ) -> Bool {
        isLoading || syncInFlight || hiddenRefreshInFlight
    }

    static func summariesToRefresh(
        sources: UsagePublicationSource,
        requested: MenuBarSummarySelection
    ) -> MenuBarSummarySelection {
        sources.contains(.localQueue) ? requested : MenuBarSummarySelection()
    }
}
