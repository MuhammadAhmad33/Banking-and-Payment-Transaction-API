
export class CreateBankAccountDto {
    
    account_number: string;
    account_type?: string;
    currency:string;
    balance?: number;
    bank_id: number;
  }
  
  export class BankAccountDto {
    account_id: number;
    account_number: string;
    account_type?: string;
    balance: number;
    currency:string;
    bank_id: number;
  }
  