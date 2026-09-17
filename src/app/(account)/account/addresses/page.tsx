import { listAddresses } from "@/domain/customers/addresses";
import { AddressManager } from "@/components/account/address-manager";

export default async function AccountAddressesPage() {
  const addresses = await listAddresses();

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl">Addresses</h1>
      <AddressManager
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          fullName: a.fullName,
          phone: a.phone,
          addressLine1: a.addressLine1,
          city: a.city,
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
