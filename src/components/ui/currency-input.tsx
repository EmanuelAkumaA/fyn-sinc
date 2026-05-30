import * as React from "react";
import { Input } from "@/components/ui/input";

const FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function digitsToMasked(digits: string): string {
  if (!digits) return "";
  const cents = Number(digits);
  if (!Number.isFinite(cents)) return "";
  return FORMATTER.format(cents / 100);
}

function valueToDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 100));
}

export type CurrencyInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type"
> & {
  value: string | number | null | undefined;
  onValueChange: (numericString: string) => void;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, placeholder = "R$ 0,00", ...rest }, ref) => {
    const display = React.useMemo(() => digitsToMasked(valueToDigits(value)), [value]);

    return (
      <Input
        {...rest}
        ref={ref}
        inputMode="decimal"
        type="text"
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const digits = (e.target.value || "").replace(/\D/g, "").replace(/^0+/, "");
          if (!digits) {
            onValueChange("");
            return;
          }
          const cents = Number(digits);
          onValueChange((cents / 100).toFixed(2));
        }}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
