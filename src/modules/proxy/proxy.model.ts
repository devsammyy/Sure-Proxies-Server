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
