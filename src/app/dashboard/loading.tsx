export default function DashboardLoading() {
    return (
        <div className="max-w-6xl mx-auto space-y-5 animate-pulse">
            {/* Welcome banner skeleton */}
            <div className="rounded-2xl p-5 bg-[#00A868]/80 h-20" />

            {/* KPI cards skeleton — 5 like the real dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-muted" />
                        </div>
                        <div className="h-7 w-20 rounded-lg bg-muted" />
                        <div className="h-2.5 w-24 rounded bg-muted/50" />
                    </div>
                ))}
            </div>

            {/* Goals skeleton */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-muted" />
                    <div className="h-4 w-32 rounded bg-muted" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-muted" />
                            <div className="space-y-1.5 flex-1">
                                <div className="h-3 w-20 rounded bg-muted/60" />
                                <div className="h-5 w-16 rounded bg-muted" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pipeline skeleton */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-muted" />
                    <div className="h-4 w-44 rounded bg-muted" />
                </div>
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="rounded-xl p-3 bg-muted/30 text-center space-y-2">
                            <div className="w-2 h-2 rounded-full bg-muted mx-auto" />
                            <div className="h-6 w-8 rounded bg-muted mx-auto" />
                            <div className="h-2 w-14 rounded bg-muted/50 mx-auto" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Content rows skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-muted" />
                            <div className="h-4 w-36 rounded bg-muted" />
                        </div>
                        <div className="space-y-2">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="h-10 rounded-lg bg-muted/30" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
