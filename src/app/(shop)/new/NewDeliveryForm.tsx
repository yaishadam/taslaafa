"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Label } from "@/ui/primitives";
import { ShareSheet, tryNativeShare } from "@/ui/ShareSheet";

const PROMISES = [15, 30, 45, 60] as const;

type Created = {
  id: string;
  url: string;
  message: string;
  phone: string;
  customerName: string;
};

type FieldErrors = Partial<Record<string, string>>;

export function NewDeliveryForm({
  drivers,
  defaultPromiseMinutes,
  defaultDriverId,
}: {
  drivers: { id: string; name: string }[];
  defaultPromiseMinutes: number;
  defaultDriverId: string | null;
}) {
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [promiseMinutes, setPromiseMinutes] = useState<number>(
    defaultPromiseMinutes,
  );
  const [orderRef, setOrderRef] = useState("");
  const [driverId, setDriverId] = useState(defaultDriverId ?? "");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFailure(null);

    const response = await fetch("/api/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        phone,
        address,
        promiseMinutes,
        orderRef,
        driverId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (result.field) setErrors({ [result.field]: result.error });
      else setFailure(result.error ?? "Something went wrong. Try again.");
      setBusy(false);
      return;
    }

    setCreated(result as Created);
    setBusy(false);

    // Straight into the share sheet, before anything else is rendered: the
    // staff member's thumb is still on the screen and the thread is what
    // they want next. If the browser refuses -- too long since the tap, or
    // no Web Share API -- the buttons below are already there.
    void tryNativeShare(result.message);
  }

  if (created) {
    return (
      <div className="space-y-5">
        <Card className="space-y-1 p-5">
          <p className="text-[13px] font-bold text-good-text">Sent out</p>
          <h2 className="text-xl">{created.customerName}</h2>
          <p className="text-sm text-ink-2">
            The code is on the link. Nobody at the shop can see it, including
            you.
          </p>
        </Card>

        <ShareSheet
          message={created.message}
          url={created.url}
          phone={created.phone}
          doneLabel="See the delivery"
          onDone={() => {
            router.push(`/delivery/${created.id}`);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card className="space-y-4 p-5">
        <Field
          label="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          error={errors.customerName}
          autoComplete="off"
          required
        />

        <Field
          label="Mobile number"
          prefix="+960"
          inputMode="numeric"
          placeholder="771 2233"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          hint="Seven digits."
          required
        />

        <Field
          label="Address"
          placeholder="Rihiveli, Majeedhee Magu"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          error={errors.address}
          autoComplete="off"
          required
        />
      </Card>

      <Card className="space-y-4 p-5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-bold text-ink-2">
            Promise time
          </legend>
          <div className="grid grid-cols-4 gap-2">
            {PROMISES.map((minutes) => {
              const active = minutes === promiseMinutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPromiseMinutes(minutes)}
                  className={`tabular h-12 rounded-field text-[15px] font-bold transition ${
                    active
                      ? "bg-brand text-ink"
                      : "border border-hairline bg-surface text-ink-2 hover:bg-muted"
                  }`}
                >
                  {minutes}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-3">Minutes to the door.</p>
        </fieldset>

        <Field
          label="Order reference"
          placeholder="A-1047"
          value={orderRef}
          onChange={(e) => setOrderRef(e.target.value)}
          hint="Optional. Whatever you write on the bill."
          autoComplete="off"
        />

        <div className="space-y-1.5">
          <Label>Who is taking it</Label>
          <div className="space-y-2">
            {drivers.length === 0 ? (
              <p className="text-sm text-bad-text">
                No riders at this shop yet.
              </p>
            ) : null}
            {drivers.map((driver) => {
              const active = driver.id === driverId;
              return (
                <button
                  key={driver.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDriverId(driver.id)}
                  className={`flex h-12 w-full items-center gap-3 rounded-field px-4 text-left font-bold transition ${
                    active
                      ? "bg-brand-tint text-brand-text ring-2 ring-brand"
                      : "border border-hairline bg-surface text-ink hover:bg-muted"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${
                      active
                        ? "bg-brand text-ink"
                        : "bg-muted text-ink-3"
                    }`}
                    aria-hidden="true"
                  >
                    {driver.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  {driver.name}
                </button>
              );
            })}
          </div>
          {errors.driverId ? (
            <p className="text-xs font-semibold text-bad-text">
              {errors.driverId}
            </p>
          ) : null}
        </div>
      </Card>

      {failure ? (
        <p
          role="alert"
          className="rounded-chip bg-bad-tint px-4 py-3 text-sm font-semibold text-bad-text"
        >
          {failure}
        </p>
      ) : null}

      <Button type="submit" size="lg" full disabled={busy}>
        {busy ? "Sending…" : "Send out & share the link"}
      </Button>
    </form>
  );
}
