import { listCoupons } from "@/domain/coupons/admin";
import { CouponManager } from "@/components/admin/coupon-manager";

export default async function AdminCouponsPage() {
  const coupons = await listCoupons();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl">Coupons</h1>
      <CouponManager
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          amount: Number(c.amount),
          status: c.status,
          redemptionCount: c._count.redemptions,
          usageLimit: c.usageLimit,
        }))}
      />
    </div>
  );
}
