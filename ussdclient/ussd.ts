import express, { Request, Response } from 'express';
import { WalletModule } from './wallet';
//import { OfframpModule } from './staking';
//import { StakingModule } from './staking';


interface USSDSession {
  sessionId: string;
  phoneNumber: string;
  currentMenu: string;
  userData: any;
}

export class USSDModule {
  private app: express.Application;
  private walletModule: WalletModule;
 // private offrampModule: OfframpModule;
//  private stakingModule: StakingModule;
  private sessions: Map<string, USSDSession> = new Map();

  constructor(
    //database: Database,
    walletModule: WalletModule,
    //offrampModule: OfframpModule,
    //stakingModule: StakingModule
  ) {
    this.app = express();
    this.walletModule = walletModule;
  //  this.offrampModule = offrampModule;
  //  this.stakingModule = stakingModule;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    this.app.post('/ussd', this.handleUSSDRequest.bind(this));
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', message: 'USSD Gateway is running' });
    });
  }

  private async handleUSSDRequest(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, phoneNumber, text } = req.body;
      
      // Validate input
      if (!sessionId || !phoneNumber) {
        res.json({ text: 'CON Error: Invalid request parameters' });
        return;
      }

      const session = this.getOrCreateSession(sessionId, phoneNumber);
      const response = await this.processUSSDInput(session, text || '');
      
      res.json({ text: response });
    } catch (error) {
      console.error('USSD Error:', error);
      res.json({ text: 'END Error processing request. Please try again.' });
    }
  }

  private getOrCreateSession(sessionId: string, phoneNumber: string): USSDSession {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        phoneNumber,
        currentMenu: 'main',
        userData: {}
      });
    }
    return this.sessions.get(sessionId)!;
  }

  private async processUSSDInput(session: USSDSession, text: string): Promise<string> {
    const inputs = text.split('*').filter(input => input.length > 0);
    const lastInput = inputs[inputs.length - 1] || '';

    // Check if user has a wallet
    const existingWallet = await this.walletModule.getWallet(session.phoneNumber);

    // If not registered, handle signup flow
    if (!existingWallet) {
      return this.handleSignupFlow(session, lastInput);
    }

    // If registered, proceed with main menu
    switch (session.currentMenu) {
      case 'main':
        return this.handleMainMenu(session, lastInput);
      
      // case 'deposit_amount':
      //   return await this.handleDepositAmount(session, lastInput);
      
      //   case 'stake_amount':
      //       return await this.handleStakeAmount(session, lastInput);
          
      //     case 'withdraw_confirmation':
      //       return await this.handleWithdrawConfirmation(session, lastInput);
          
          default:
            return this.showMainMenu(session);
        }
      }
    
      private async handleSignupFlow(session: USSDSession, input: string): Promise<string> {
        // First step: show signup confirmation
        if (!input) {
          session.currentMenu = 'signup_confirm';
          return ` Welcome to Mngazi
You are not registered.
Press 1 to sign up, 2 to cancel.`;
        }

        // Handle user response
        if (session.currentMenu === 'signup_confirm') {
          if (input === '1') {
            // User confirmed signup
            try {
              await this.walletModule.generateWallet(session.phoneNumber);
              session.currentMenu = 'main'; // Reset to main for next session
              return `END Signup successful! Your wallet has been created.
Welcome to Mngazi. Please dial again to access the main menu.`;
            } catch (error) {
              return `END Error creating wallet: ${error}`;
            }
          } else {
            // User cancelled signup
            session.currentMenu = 'main';
            return `END Signup cancelled.`;
          }
        }

        // Fallback
        return `END Invalid input.`;
      }
    
      private async handleMainMenu(session: USSDSession, input: string): Promise<string> {
        switch (input) {
          case '1':
            return 'CON About & Guide...'; // Replace with your about/guide logic
          // case '2':
          //   session.currentMenu = 'deposit_amount';
          //   return 'CON Enter deposit amount (USD):\n0. Back to main menu';
          // case '3':
          //   session.currentMenu = 'stake_amount';
          //   return 'CON Enter amount to stake (USDA):\n0. Back to main menu';
          // case '4':
          //   return this.handleCheckBalance(session);
          // case '5':
          //   session.currentMenu = 'withdraw_confirmation';
          //   return this.handleWithdrawMenu(session);
          // case '6':
          //   return 'END Thank you for using !';
          default:
            return this.showMainMenu(session);
        }
      }
    
      private async showMainMenu(session: USSDSession): Promise<string> { 
        return ` Welcome to Mngazi
MAIN MENU
1. About & Guide
2. Deposit 
4. Check Balance & Profile
5. Withdraw
6. Exit`;
      }
    
      public startServer(port: number = 3000): void {
        this.app.listen(port, () => {
          console.log(`USSD Gateway running on port ${port}`);
          console.log(`Health check: http://localhost:${port}/health`);
          console.log(`USSD endpoint: http://localhost:${port}/ussd`);
        });
      }
    
      public getApp(): express.Application {
        return this.app;
      }
    }
    