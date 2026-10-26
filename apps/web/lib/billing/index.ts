import {
  FakePaymentProvider,
  paymentProviderName,
  type PaymentProvider,
} from "./provider";
import { PesapalPaymentProvider } from "./pesapal";

export * from "./provider";

export function getPaymentProvider(ipnId?: string | null): PaymentProvider {
  const name = paymentProviderName();
  if (name === "fake") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PAYMENT_PROVIDER=fake is not allowed in production.");
    }
    return new FakePaymentProvider();
  }
  return new PesapalPaymentProvider(ipnId);
}
