export default function NegociacoesLoading() {
    return (
        <div className="animate-pulse space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-muted" />
                    <div className="space-y-1.5">
                        <div className="h-5 w-52 rounded-lg bg-muted" />
                        <div className="h-3 w-36 rounded-md bg-muted/60" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="h-9 w-48 rounded-lg bg-muted" />
                    <div className="h-9 w-36 rounded-xl bg-muted" />
                    <div className="h-9 w-9 rounded-xl bg-muted" />
                    <div className="h-9 w-28 rounded-xl bg-muted" />
                </div>
            </div>

            {/* Kanban columns */}
            <div className="flex flex-col lg:flex-row gap-3">
                {[...Array(6)].map((_, col) => (
                    <div key={col} className="lg:flex-1 lg:min-w-[180px] bg-card/50 rounded-2xl">
                        <div className="flex items-center justify-between px-3 py-2.5">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-muted" />
                                <div className="h-3.5 w-24 rounded bg-muted" />
                            </div>
                            <div className="h-5 w-5 rounded-full bg-muted/40" />
                        </div>
                        <div className="px-2 pb-2 space-y-2">
                            {[...Array(col < 3 ? 3 : 1)].map((_, j) => (
                                <div key={j} className="bg-card border border-border rounded-xl p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-muted" />
                                        <div className="flex-1 space-y-1">
                                            <div className="h-3.5 w-3/4 rounded bg-muted" />
                                            <div className="h-2.5 w-1/3 rounded bg-muted/40" />
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="flex-1 h-9 rounded-lg bg-muted/30" />
                                        <div className="flex-1 h-9 rounded-lg bg-muted/30" />
                                        <div className="flex-1 h-9 rounded-lg bg-muted/30" />
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="h-3 w-16 rounded bg-muted/30" />
                                        <div className="h-5 w-16 rounded-full bg-muted/20" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
