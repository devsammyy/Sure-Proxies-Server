export interface VirtualAccountResponse {
  customer: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone_number: string;
  };
  business: {
    business_name: string;
    business_email: string;
    business_phone_number: string;
    business_Id: string | null;
  };
  bankAccounts: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
    bankName: string;
    Reserved_Account_Id: string;
  }[];
}
