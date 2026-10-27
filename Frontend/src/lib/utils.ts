import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "INR"): string {
  if (amount == null || isNaN(amount)) return "";
  if (currency === "USD") {
    return "$" + Number(amount).toLocaleString("en-US");
  }
  if (currency === "BDT") {
    return Number(amount).toLocaleString("en-IN") + " \u09F3";
  }
  return "\u20B9" + Number(amount).toLocaleString("en-IN");
}
