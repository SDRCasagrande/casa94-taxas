export default function ClientesLoading() {
    return (
        <div className="animate-pulse space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-muted" />
                    <div className="space-y-1.5">
                        <div className="h-5 w-44 rounded-lg bg-muted" />
                        <div className="h-3 w-56 rounded-md bg-muted/60" />
                    </div>
                </div>
                <div className="h-9 w-28 rounded-xl bg-muted" />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className={`rounded-xl p-4 space-y-2 ${i === 3 ? "bg-card border border-purple-500/10" : "bg-card border border-border"}`}>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-muted" />
                            <div className="h-2.5 w-20 rounded bg-muted/60" />
                        </div>
                        <div className="h-7 w-28 rounded-lg bg-muted" />
                    </div>
                ))}
            </div>

            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 h-10 rounded-xl bg-muted" />
                <div className="h-8 w-48 rounded-xl bg-muted/60" />
                <div className="h-8 w-36 rounded-xl bg-muted/60" />
            </div>

            {/* Client cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-4 w-3/5 rounded bg-muted" />
                                <div className="h-2.5 w-2/5 rounded bg-muted/40" />
                            </div>
                            <div className="space-y-1.5 shrink-0">
                                <div className="h-5 w-14 rounded-full bg-muted/40" />
                                <div className="h-4 w-12 rounded bg-muted/30" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="h-12 rounded-lg bg-muted/30" />
                            ))}
                        </div>
                        <div className="h-3 w-full rounded bg-muted/20" />
                    </div>
                ))}
            </div>
        </div>
    );
}
