import { DataSource, Entity, ObjectIdColumn, ObjectId, Column, OneToMany, ManyToOne, CreateDateColumn } from "typeorm";
import env from 'env-var';

const mongoUrl = env.get('MONGO_URL').required().asString();

@Entity()
export class WalletEntity {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column({ unique: true })
  phone!: string;

  @Column({ unique: true ,  })
  wallet_id!: string;
  
  @Column()
  payment_addr!: string;

  @Column()
  mnemonic!: string;

  @Column()
  stake_addr!: string;


  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => FiatTransactionEntity, transaction => transaction.wallet)
  transactions!: FiatTransactionEntity[];
}

@Entity()
export class FiatTransactionEntity {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  phone!: string;

  @Column()
  type!: string; // 'deposit', 'withdraw'

  @Column({ type: "double" }) // Use 'double' instead of 'float' for MongoDB
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
  //useUnifiedTopology: true, // Add this for better MongoDB connection handling
});