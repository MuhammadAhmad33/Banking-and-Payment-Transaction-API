
export class CreateBankAccountTransactionDto {
    transaction_type: string;
    amount: number;
    currency:string;
    description?: string;
    account_id: number;
  }
  
  export class BankAccountTransactionDto {
    transaction_id: number;
    transaction_date: Date;
    transaction_type: string;
    amount: number;
    currency:string;
    description?: string;
    account_id: number;
  }