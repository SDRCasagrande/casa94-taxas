export default function PageLoading() {
    return (
        <div className="animate-pulse space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted" />
                <div className="space-y-1.5">
                    <div className="h-5 w-48 rounded-lg bg-muted" />
                    <div className="h-3 w-32 rounded-md bg-muted/60" />
                </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="h-4 w-24 rounded bg-muted/60 shrink-0" />
                        <div className="flex-1 h-10 rounded-xl bg-muted/30" />
                    </div>
                ))}
            </div>
            <div className="h-12 w-full rounded-xl bg-muted" />
        </div>
    );
}
