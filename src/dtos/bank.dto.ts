import { IsNotEmpty } from "class-validator";

export class CreateBankDto {
  @IsNotEmpty()
  bank_name: string;
  }
  
  export class BankDto {
    bank_id: number;
    @IsNotEmpty()
    bank_name: string;
  }
  