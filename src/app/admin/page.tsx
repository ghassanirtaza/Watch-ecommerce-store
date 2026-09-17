import { getDashboardSummary, getTopProducts, getRecentOrders } from "@/domain/analytics/dashboard";

export default async function AdminDashboardPage() {
  const [summary, topProducts, recentOrders] = await Promise.all([
    getDashboardSummary("7d"),
    getTopProducts("7d", 5),
    getRecentOrders(10),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl">Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Orders (7d)" value={summary.orderCount.toString()} />
        <StatCard label="Revenue (7d)" value={`Rs. ${summary.revenue.toLocaleString("en-PK")}`} />
        <StatCard label="Low Stock" value={summary.lowStockCount.toString()} warn={summary.lowStockCount > 0} />
        <StatCard label="Out of Stock" value={summary.outOfStockCount.toString()} warn={summary.outOfStockCount > 0} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Top Products (7d)
          </h2>
          <div className="rounded border border-[var(--color-border)]">
            {topProducts.length === 0 ? (
              <p className="p-4 text-sm text-[var(--color-text-muted)]">No sales yet in this period.</p>
            ) : (
              topProducts.map((p) => (
                <div key={p.sku} className="flex justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0">
                  <span>{p.productName}</span>
                  <span className="text-[var(--color-text-muted)]">{p.unitsSold} sold</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Recent Orders
          </h2>
          <div className="rounded border border-[var(--color-border)]">
            {recentOrders.length === 0 ? (
              <p className="p-4 text-sm text-[var(--color-text-muted)]">No orders yet.</p>
            ) : (
              recentOrders.map((o) => (
                <a
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0 hover:bg-[var(--color-bg-elevated)]"
                >
                  <span>
                    #{o.orderNumber} — {o.customer?.user.email ?? o.guestEmail}
                  </span>
                  <span className="text-[var(--color-text-muted)]">{o.status}</span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded border border-[var(--color-border)] p-4">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-xl ${warn ? "text-[var(--color-warning)]" : ""}`}>{value}</p>
    </div>
  );
}
