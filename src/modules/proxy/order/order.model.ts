export interface PriceResponse {
  appliedDiscounts: any[]; // You can replace 'any' with a more specific type if known
  finalPrice: number;
  priceNoDiscounts: number;
  discount: number;
  unitPrice: number;
  unitPriceAfterDiscount: number;
  additionalAmount: number;
  additionalAmountAfterDiscount: number;
  paymentFee: number;
  subtotal: number;
  discountAmount: number;
  finalPriceInCurrency: number;
  currency: string;
}

export interface Isp {
  id: string;
  label: string;
}

export interface IspsByCountry {
  [countryCode: string]: Isp[];
}

export interface Periods {
  months: number[];
  days: number[];
}

export interface ServiceDetailsResponse {
  serviceId: string;
  countries: string[];
  isps: IspsByCountry;
  periods: Periods;
}

export interface PendingOptions {
  quantity?: number;
  period?: { unit: 'months' | 'days' | 'years'; value: number };
  autoExtend?: { isEnabled: boolean };
  traffic?: number;
  country?: string;
  ispId?: string;
  couponCode?: string;
}

export interface PendingData {
  userId: string;
  serviceId: string;
  planId: string;
  pricePaid: number;
  options: PendingOptions;
}

export interface TxDoc {
  finalized?: boolean;
}

export type FinalizeTxResult =
  | { status: 'no_pending' }
  | { status: 'no_tx' }
  | { status: 'already_finalized' }
  | { status: 'ok'; pending: PendingData; txData: TxDoc };
