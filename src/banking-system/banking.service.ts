
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankAccountTransaction } from '../entities/bank-account-transaction.entity';
import { CreateBankAccountTransactionDto } from '../dtos/bank-account-transaction.dto';
import { CreateBankDto } from 'src/dtos/bank.dto';
import { Bank } from 'src/entities/bank.entity';
import { BankAccount } from 'src/entities/bank-account.entity';
import { BankAccountDto, CreateBankAccountDto } from 'src/dtos/bank-account.dto';
import { OpenExchangeRates } from 'open-exchange-rates';
import axios from 'axios';

@Injectable()
export class BankingService {
    private readonly openExchangeRates: OpenExchangeRates;

    constructor(
        @InjectRepository(Bank)
        private bankRepository: Repository<Bank>,
        @InjectRepository(BankAccount)
        private bankAccountRepository: Repository<BankAccount>,
        @InjectRepository(BankAccountTransaction)
        private transactionsRepository: Repository<BankAccountTransaction>,
    ) {}

    async createBank(CreateBankDto: CreateBankDto): Promise<Bank> {
        const newBank = this.bankRepository.create(CreateBankDto);
        return await this.bankRepository.save(newBank);
    }

    async createBankAccount(CreateBankAccountDto: CreateBankAccountDto): Promise<BankAccount> {
        const newAccount = this.bankAccountRepository.create(CreateBankAccountDto);
        return await this.bankAccountRepository.save(newAccount);
    }


    // async createTransaction(
    //     createTransactionDto: CreateBankAccountTransactionDto,
    // ): Promise<BankAccountTransaction> {
    //     const transaction = this.transactionsRepository.create(createTransactionDto);
    //     return await this.transactionsRepository.save(transaction);
    // }

    async getTransactionById(account_id: number): Promise<BankAccountTransaction[]> {
        const transaction = await this.transactionsRepository.find({ where: { account: { account_id: account_id } } });
        if (!transaction) {
            throw new NotFoundException(`Transaction with ID ${account_id} not found`);
        }

        return transaction;
    }


    async createTransactionAndAdjustBalance(
        createTransactionDto: CreateBankAccountTransactionDto

    ): Promise<BankAccountTransaction> {
        // const Big = BigNumber.default;
        const accId = createTransactionDto.account_id;

        const account = await this.bankAccountRepository.findOne({ where: { account_id: accId } });
        console.log(account, 'acount found');

        if (!account) {
            throw new NotFoundException(`Account with ID ${createTransactionDto.account_id} not found`);
        }

        const transaction = new BankAccountTransaction();
        transaction.transaction_type = createTransactionDto.transaction_type;
        transaction.amount = createTransactionDto.amount;
        transaction.currency = createTransactionDto.currency;
        transaction.description = createTransactionDto.description;
        transaction.account = account;

        // console.log(typeof createTransactionDto.amount)

        if (account.currency === createTransactionDto.currency) {
            if (transaction.transaction_type === 'deposit') {
                account.balance += (transaction.amount);

            } else if (transaction.transaction_type === 'withdraw') {
                if (account.balance > 0 && account.balance >= transaction.amount)
                    account.balance -= (transaction.amount);
                else
                    throw new BadRequestException('Acount Balance not sufficient');
            }
        }

        else {
            console.log('converting');
            const toCurrency = account.currency;
            const fromCurrency = createTransactionDto.currency;
            const amount = createTransactionDto.amount;
            const rates = await this.getRates();
            if (!rates[fromCurrency] || !rates[toCurrency]) {
                throw new BadRequestException('Invalid currency codes');
            }
            // Perform currency conversion
            const convertedAmount = (amount / rates[fromCurrency].toFixed(2)) * (rates[toCurrency].toFixed(2));
            // convertedAmount.toFixed(2);

            console.log(convertedAmount, 'val')

            if (transaction.transaction_type === 'deposit') {
                account.balance += convertedAmount;

            } else if (transaction.transaction_type === 'withdraw') {
                if (account.balance > 0 && account.balance >= transaction.amount)
                    account.balance -= convertedAmount;
                else
                    throw new BadRequestException('Acount Balance not sufficient');
            }

        }

        await this.transactionsRepository.save(transaction);
        await this.bankAccountRepository.save(account);
        return transaction;
    }

    //oneAccountToOther
    async Transfer(
        id: number,
        createTransactionDto: CreateBankAccountTransactionDto

    ): Promise<BankAccountTransaction> {
        //from

        const fromId = id;

        const fromaccount = await this.bankAccountRepository.findOne({ where: { account_id: fromId } });
        console.log(fromaccount, 'acount found');

        if (!fromaccount) {
            throw new NotFoundException(`Account with ID ${id} not found`);
        }
        ///to
        const toId = createTransactionDto.account_id;

        const toaccount = await this.bankAccountRepository.findOne({ where: { account_id: toId } });
        console.log(toaccount, 'acount found');

        //error handling
        if (!toaccount) {
            throw new NotFoundException(`Account with ID ${id} not found`);
        }
        if (createTransactionDto.currency != fromaccount.currency) {
            throw new BadRequestException(`${fromaccount.currency}  account cannot transfer ${createTransactionDto.currency}`)
        }
        if (fromaccount.balance < createTransactionDto.amount) {
            throw new BadRequestException('Acount Balance not sufficient')
        }


        const transaction = new BankAccountTransaction();
        transaction.transaction_type = createTransactionDto.transaction_type;
        transaction.amount = createTransactionDto.amount;
        transaction.currency = createTransactionDto.currency;
        transaction.description = createTransactionDto.description;
        transaction.account = toaccount;

        if (createTransactionDto.currency === toaccount.currency) {
            if (transaction.transaction_type === 'transfer') {
                fromaccount.balance -= transaction.amount;
                toaccount.balance += transaction.amount;
            }
            else
                throw new BadRequestException('transaction type not defined')
        }
        else {
            console.log('converting');
            const toCurrency = toaccount.currency;
            const fromCurrency = createTransactionDto.currency;
            const amount = createTransactionDto.amount;
            
            const rates = await this.getRates();
            if (!rates[fromCurrency] || !rates[toCurrency]) {
                throw new BadRequestException('Invalid currency codes');
            }
            // Perform currency conversion
            const convertedAmount = (amount / rates[fromCurrency]) * (rates[toCurrency]);
            // convertedAmount.toFixed(2);

            console.log(convertedAmount, 'val')


            if (transaction.transaction_type === 'transfer') {
                fromaccount.balance -= transaction.amount;
                toaccount.balance += convertedAmount;
            }
            else
                throw new BadRequestException('transaction type not defined')
        }
        await this.transactionsRepository.save(transaction);
        await this.bankAccountRepository.save(toaccount);
        await this.bankAccountRepository.save(fromaccount);
        return transaction;
    }

    ///exchnage rates
    async getRates() {

        const rates = await axios.get('https://openexchangerates.org/api/latest.json?app_id=f9c7dde9fab04083a189b92f7bd91fb3')

        if (!rates) {
            throw new BadRequestException('Invalid currency codes');
        }
        console.log(rates.data.rates);
        return rates.data.rates;
    }

}
