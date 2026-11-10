"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  MapPin,
  Star,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

const addressSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .max(15, "Phone number too long"),
  line1: z.string().min(5, "Address is required"),
  line2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z
    .string()
    .min(4, "Enter a valid pincode")
    .max(10, "Enter a valid pincode"),
  isDefault: z.boolean().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface Address {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface AddressManagerProps {
  initialAddresses: Address[];
}

export function AddressManager({ initialAddresses }: AddressManagerProps) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
  });

  const openAdd = () => {
    setEditingId(null);
    reset({
      name: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      isDefault: addresses.length === 0,
    });
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    setEditingId(addr.id);
    reset({
      name: addr.name,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 ?? "",
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      isDefault: addr.isDefault,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    reset();
  };

  const onSubmit = async (data: AddressFormData) => {
    setIsSubmitting(true);
    const toastId = toast.loading(
      editingId ? "Updating address..." : "Adding address..."
    );

    try {
      const isFirst = addresses.length === 0;
      const payload = { ...data, isDefault: isFirst ? true : data.isDefault };

      let res: Response;
      if (editingId) {
        res = await fetch("/api/addresses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await fetch("/api/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Failed to save address", { id: toastId });
        setIsSubmitting(false);
        return;
      }

      // Refresh addresses list
      const listRes = await fetch("/api/addresses");
      const listJson = await listRes.json();
      setAddresses(listJson.addresses ?? []);

      toast.success(
        editingId ? "Address updated!" : "Address added!",
        { id: toastId }
      );
      closeForm();
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this address?")) return;

    const toastId = toast.loading("Deleting address...");
    try {
      const res = await fetch(`/api/addresses?id=${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Failed to delete", { id: toastId });
        return;
      }

      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success("Address deleted", { id: toastId });
      router.refresh();
    } catch {
      toast.error("Something went wrong.", { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif text-nate-grey-800">
            Saved Addresses
          </h2>
          <p className="text-sm text-nate-grey-500 mt-0.5">
            {addresses.length === 0
              ? "No addresses saved yet"
              : `${addresses.length} address${addresses.length === 1 ? "" : "es"} saved`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-nate-grey-800 text-white text-sm rounded-lg hover:bg-nate-grey-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Address
        </button>
      </div>

      {/* Address form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
              <h3 className="text-lg font-serif text-nate-grey-800">
                {editingId ? "Edit Address" : "Add New Address"}
              </h3>
              <button
                onClick={closeForm}
                className="p-1.5 rounded-lg hover:bg-nate-grey-100 transition-colors"
              >
                <X className="w-5 h-5 text-nate-grey-500" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="p-6 space-y-4"
            >
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">
                  Full Name
                </label>
                <input
                  {...register("name")}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                    errors.name ? "border-red-400" : "border-nate-grey-300"
                  }`}
                  placeholder="Priya Sharma"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  {...register("phone")}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                    errors.phone ? "border-red-400" : "border-nate-grey-300"
                  }`}
                  placeholder="+91 98765 43210"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
                )}
              </div>

              {/* Address Line 1 */}
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">
                  Address Line 1
                </label>
                <input
                  {...register("line1")}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                    errors.line1 ? "border-red-400" : "border-nate-grey-300"
                  }`}
                  placeholder="42 MG Road, Near City Mall"
                />
                {errors.line1 && (
                  <p className="mt-1 text-xs text-red-500">{errors.line1.message}</p>
                )}
              </div>

              {/* Address Line 2 */}
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">
                  Address Line 2{" "}
                  <span className="font-normal text-nate-grey-400">(optional)</span>
                </label>
                <input
                  {...register("line2")}
                  className="w-full px-4 py-2.5 border border-nate-grey-300 rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="Floor 3, Apartment 12"
                />
              </div>

              {/* City + State */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">
                    City
                  </label>
                  <input
                    {...register("city")}
                    className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                      errors.city ? "border-red-400" : "border-nate-grey-300"
                    }`}
                    placeholder="New Delhi"
                  />
                  {errors.city && (
                    <p className="mt-1 text-xs text-red-500">{errors.city.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">
                    State
                  </label>
                  <input
                    {...register("state")}
                    className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                      errors.state ? "border-red-400" : "border-nate-grey-300"
                    }`}
                    placeholder="Delhi"
                  />
                  {errors.state && (
                    <p className="mt-1 text-xs text-red-500">{errors.state.message}</p>
                  )}
                </div>
              </div>

              {/* Pincode */}
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">
                  Pincode
                </label>
                <input
                  {...register("pincode")}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                    errors.pincode ? "border-red-400" : "border-nate-grey-300"
                  }`}
                  placeholder="110001"
                />
                {errors.pincode && (
                  <p className="mt-1 text-xs text-red-500">{errors.pincode.message}</p>
                )}
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("isDefault")}
                  className="w-4 h-4 rounded border-nate-grey-300 text-accent focus:ring-accent"
                />
                <span className="text-sm text-nate-grey-700">
                  Set as default address
                </span>
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2.5 border border-nate-grey-300 text-nate-grey-700 rounded-lg text-sm font-medium hover:bg-nate-grey-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    (editingId ? "Update Address" : "Add Address")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-nate-grey-100 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-nate-grey-400" />
          </div>
          <h2 className="text-lg font-serif text-nate-grey-700 mb-2">
            No addresses saved
          </h2>
          <p className="text-sm text-nate-grey-400 mb-6">
            Add your delivery address to speed up checkout.
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-nate-grey-800 text-white text-sm rounded-lg hover:bg-nate-grey-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="bg-white rounded-xl p-6 shadow-sm border border-nate-grey-100 hover:border-nate-grey-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-nate-grey-500" />
                  <h3 className="font-medium text-nate-grey-800 text-sm">
                    {addr.name}
                  </h3>
                </div>
                {addr.isDefault && (
                  <span className="flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
                    <Star className="w-3 h-3 fill-accent" />
                    Default
                  </span>
                )}
              </div>

              <p className="text-xs text-nate-grey-500 mt-1.5">{addr.phone}</p>

              <p className="text-sm text-nate-grey-600 mt-2 leading-relaxed">
                {addr.line1}
                {addr.line2 && <>, {addr.line2}</>}
                <br />
                {addr.city}, {addr.state} — {addr.pincode}
              </p>

              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-nate-grey-100">
                <button
                  onClick={() => openEdit(addr)}
                  className="flex items-center gap-1.5 text-sm text-nate-grey-500 hover:text-nate-grey-800 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="flex items-center gap-1.5 text-sm text-nate-grey-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}