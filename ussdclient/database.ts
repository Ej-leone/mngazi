import { DataSource , Entity, PrimaryColumn, Column, OneToMany, OneToOne, ManyToOne , CreateDateColumn , PrimaryGeneratedColumn } from "typeorm";
import env from 'env-var';

const mongoUrl = env.get('MONGO_URL').required().asString();


@Entity()
export class WalletEntity {
  @PrimaryColumn()
  phone!: string;

  @Column({ unique: true })
  wallet_id!: string;
  
  @Column()
  payment_addr!: string;

  @Column()
  stake_addr!: string;

  @Column()
  mnemonic!: string;

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => FiatTransactionEntity, transaction => transaction.wallet)
  transactions!: FiatTransactionEntity[];
}

@Entity()
export class FiatTransactionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  phone!: string;

  @Column()
  type!: string; // 'deposit', 'withdraw', 

  @Column({ type: "float" })
  amount!: number;

  @Column({ default: "pending" })
  status!: string;

  @CreateDateColumn()
  created_at!: Date;

  @Column()
  transactionhash!: string;

  
   @ManyToOne(() => WalletEntity, wallet => wallet.transactions)
   wallet!: WalletEntity;
}




export const AppDataSource = new DataSource({
  type: "mongodb",
  url: mongoUrl,
  synchronize: true, // set to false in production and use migrations
  logging: false,
  entities: [WalletEntity, FiatTransactionEntity],
});