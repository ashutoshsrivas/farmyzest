"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    phone: z
      .string()
      .min(10, "Phone must be at least 10 digits")
      .max(15, "Phone must be at most 15 characters")
      .regex(/^[0-9+\s-]*$/, "Enter a valid phone number"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    const toastId = toast.loading("Creating your account...");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          password: data.password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Registration failed", { id: toastId });
        return;
      }

      toast.success("Account created! Redirecting...", { id: toastId });
      router.push("/account");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.", { id: toastId });
    }
  };

  return (
    <div className="min-h-screen bg-nate-grey-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-serif text-nate-grey-800 tracking-wide">
              Farmyzest
            </Link>
            <p className="text-sm text-nate-grey-500 mt-2">Create your customer account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-nate-grey-700 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                {...register("name")}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow ${
                  errors.name ? "border-red-400" : "border-nate-grey-300"
                }`}
                placeholder="Priya Sharma"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-nate-grey-700 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow ${
                  errors.email ? "border-red-400" : "border-nate-grey-300"
                }`}
                placeholder="priya@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-nate-grey-700 mb-1.5"
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                {...register("phone")}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow ${
                  errors.phone ? "border-red-400" : "border-nate-grey-300"
                }`}
                placeholder="+91 98765 43210"
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-nate-grey-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("password")}
                  className={`w-full px-4 py-2.5 pr-10 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow ${
                    errors.password ? "border-red-400" : "border-nate-grey-300"
                  }`}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-nate-grey-400 hover:text-nate-grey-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
              <p className="mt-1 text-xs text-nate-grey-400">
                At least 8 characters, one uppercase, one number
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-nate-grey-700 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                  className={`w-full px-4 py-2.5 pr-10 border rounded-lg text-sm text-nate-grey-700 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow ${
                    errors.confirmPassword ? "border-red-400" : "border-nate-grey-300"
                  }`}
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-nate-grey-400 hover:text-nate-grey-600"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-nate-grey-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-nate-grey-800 font-medium hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}