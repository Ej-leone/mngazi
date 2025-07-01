import 'dotenv/config';
import "reflect-metadata";
import { AppDataSource } from './database';
import { WalletModule } from './wallet';
import { OfframpModule } from './offramp';
import { StakingModule } from './staking';
import { USSDModule } from './ussd';



export async function initializeDatabase() {
    await AppDataSource.initialize();
  }
  

async function main() {
  try {
    console.log('🚀 Starting ...');
    
    // Initialize database
    initializeDatabase()
    //const database = dbManager.getDatabase();
    
    // Initialize modules
     const walletModule = new WalletModule();
    //const offrampModule = new OfframpModule(database);
    //const stakingModule = new StakingModule(database);
     const ussdModule = new USSDModule(walletModule) // (database,, offrampModule, stakingModule);
    
    // Start USSD server
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    ussdModule.startServer(port);
    
    console.log('✅ All modules initialized successfully');
    console.log('📱 USSD Service ready for connections');

    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down gracefully...');
      AppDataSource.destroy()
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main();
}

//