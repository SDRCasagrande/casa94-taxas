export default function DashboardLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-muted" />
                    <div className="space-y-1.5">
                        <div className="h-5 w-48 rounded-lg bg-muted" />
                        <div className="h-3 w-32 rounded-md bg-muted/60" />
                    </div>
                </div>
                <div className="h-9 w-28 rounded-xl bg-muted" />
            </div>

            {/* Metric cards skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-muted" />
                            <div className="h-2.5 w-16 rounded bg-muted/60" />
                        </div>
                        <div className="h-7 w-24 rounded-lg bg-muted" />
                    </div>
                ))}
            </div>

            {/* Content area skeleton */}
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-3/5 rounded-md bg-muted" />
                            <div className="h-3 w-2/5 rounded-md bg-muted/50" />
                        </div>
                        <div className="h-6 w-20 rounded-full bg-muted/40 shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
}
