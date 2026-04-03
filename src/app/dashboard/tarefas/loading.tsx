export default function TarefasLoading() {
    return (
        <div className="animate-pulse space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-muted" />
                    <div className="space-y-1.5">
                        <div className="h-5 w-40 rounded-lg bg-muted" />
                        <div className="h-3 w-28 rounded-md bg-muted/60" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="h-9 w-9 rounded-xl bg-muted" />
                    <div className="h-9 w-28 rounded-xl bg-muted" />
                </div>
            </div>

            {/* Filter strip */}
            <div className="flex gap-2 overflow-x-auto">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 w-20 rounded-lg bg-muted shrink-0" />
                ))}
            </div>

            {/* Task columns / calendar skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, col) => (
                    <div key={col} className="space-y-2">
                        <div className="flex items-center justify-between px-2 py-2">
                            <div className="h-4 w-24 rounded bg-muted" />
                            <div className="h-5 w-6 rounded-full bg-muted/50" />
                        </div>
                        {[...Array(col === 0 ? 4 : col === 1 ? 3 : 2)].map((_, j) => (
                            <div key={j} className="bg-card border border-border rounded-xl p-3 space-y-2">
                                <div className="h-4 w-4/5 rounded bg-muted" />
                                <div className="h-3 w-2/5 rounded bg-muted/40" />
                                <div className="flex gap-2">
                                    <div className="h-5 w-14 rounded-full bg-muted/30" />
                                    <div className="h-5 w-12 rounded-full bg-muted/30" />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
