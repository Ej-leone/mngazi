import express, { Request, Response } from 'express';
import { WalletModule } from './wallet';
import { LanguageManager, Language } from './lang';
//import { OfframpModule } from './staking';
//import { StakingModule } from './staking';


interface USSDSession {
  sessionId: string;
  phoneNumber: string;
  currentMenu: string;
  userData: any;
  language: Language;
  langManager: LanguageManager;
  selectedChain: 'cardano' | 'bitcoin'; // New: track selected blockchain
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
        const langManager = new LanguageManager('en');
        res.json({ text: `CON ${langManager.t('invalidRequest')}` });
        return;
      }

      const session = await this.getOrCreateSession(sessionId, phoneNumber);


      
      const response = await this.processUSSDInput(session, text || '');
      
     
      res.contentType('text/plain');
      res.send(response);
    } catch (error) {

      console.log('USSD Error:', error);
      const langManager = new LanguageManager('en');
      res.json({ text: `END ${langManager.t('error')}` });
    }
  }

  private getOrCreateSession(sessionId: string, phoneNumber: string): USSDSession {
    if (!this.sessions.has(sessionId)) {
      const langManager = new LanguageManager('en');
      this.sessions.set(sessionId, {
        sessionId,
        phoneNumber,
        currentMenu: 'main',
        userData: {},
        language: 'en',
        langManager,
        selectedChain: 'cardano' // Default to Cardano
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
      
      case 'deposit_amount':
        return await this.handleDepositAmount(session, lastInput);
      
      case 'stake_amount':
        return await this.handleStakeAmount(session, lastInput);
      
      case 'withdraw_confirmation':
        return await this.handleWithdrawConfirmation(session, lastInput);
      
      case 'settings':
        return this.handleSettings(session, lastInput);
      
      case 'language_select':
        return this.handleLanguageSelect(session, lastInput);
      
      case 'chain_select':
        return this.handleChainSelect(session, lastInput);
      
      default:
        return this.showMainMenu(session);
    }
  }
    
  private async handleSignupFlow(session: USSDSession, input: string): Promise<string> {
    const t = session.langManager;
    
    // First step: show signup confirmation
    if (!input) {
      session.currentMenu = 'signup_confirm';
      return `CON ${t.t('welcome')}
${t.t('notRegistered')}
${t.t('signupPrompt')}`;
    }

    // Handle user response
    if (session.currentMenu === 'signup_confirm') {
      if (input === '1') {
        // User confirmed signup
        try {
          await this.walletModule.generateWallet(session.phoneNumber);
          session.currentMenu = 'main'; // Reset to main for next session
          return `END ${t.t('signupSuccess')}`;
        } catch (error) {
          return `END ${t.t('signupError')}: ${error}`;
        }
      } else {
        // User cancelled signup
        session.currentMenu = 'main';
        return `END ${t.t('signupCancelled')}`;
      }
    }

    // Fallback
    return `END ${t.t('invalidInput')}`;
  }
    
  private async handleMainMenu(session: USSDSession, input: string): Promise<string> {
    const t = session.langManager;
    
    switch (input) {
      case '1':
        return `CON ${t.t('aboutText')}`;
      case '2':
        session.currentMenu = 'deposit_amount';
        return `CON ${t.t('enterDepositAmount')}\n0. ${t.t('back')}`;
      case '3':
        session.currentMenu = 'stake_amount';
        return `CON ${t.t('enterStakeAmount')}\n0. ${t.t('back')}`;
      case '4':
        return this.handleCheckBalance(session);
      case '5':
        session.currentMenu = 'withdraw_confirmation';
        return `CON ${t.t('enterWithdrawAmount')}\n0. ${t.t('back')}`;
      case '6':
        session.currentMenu = 'settings';
        return this.handleSettings(session, '');
      case '7':
        return `END ${t.t('thankYou')}`;
      default:
        return this.showMainMenu(session);
    }
  }
    
  private async showMainMenu(session: USSDSession): Promise<string> {
    const t = session.langManager;
    const chainName = session.selectedChain === 'cardano' ? 'Cardano (ADA)' : 'Bitcoin Lightning (BTC)';
    
    return `CON ${t.t('welcome')}
Chain: ${chainName}

${t.t('mainMenu')}
1. ${t.t('aboutGuide')}
2. ${t.t('deposit')}
3. ${t.t('stake')}
4. ${t.t('checkBalance')}
5. ${t.t('withdraw')}
6. ${t.t('settings')}
7. ${t.t('exit')}`;
  }
    
  private async handleDepositAmount(session: USSDSession, input: string): Promise<string> {
    const t = session.langManager;
    
    // If no input, prompt for amount
    if (!input) {
      return `CON ${t.t('enterDepositAmount')}\n0. ${t.t('back')}`;
    }
    // If user wants to go back
    if (input === '0') {
      session.currentMenu = 'main';
      return this.showMainMenu(session);
    }
    // Validate amount (simple check)
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      return `CON ${t.t('invalidAmount')}\n0. ${t.t('back')}`;
    }
    // Here you would process the deposit (not implemented)
    session.currentMenu = 'main';
    return `END ${t.t('depositReceived', { amount: amount.toString() })}`;
  }

  private async handleWithdrawConfirmation(session: USSDSession, input: string): Promise<string> {
    const t = session.langManager;
    
    // If no input, prompt for amount
    if (!input) {
      return `CON ${t.t('enterWithdrawAmount')}\n0. ${t.t('back')}`;
    }
    // If user wants to go back
    if (input === '0') {
      session.currentMenu = 'main';
      return this.showMainMenu(session);
    }
    // Validate amount (simple check)
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      return `CON ${t.t('invalidWithdrawAmount')}\n0. ${t.t('back')}`;
    }
    // Here you would process the withdrawal (not implemented)
    await this.processWithdraw(session, amount); // currently empty
    session.currentMenu = 'main';
    return `END ${t.t('withdrawalReceived', { amount: amount.toString() })}`;
  }

      // Placeholder for withdrawal processing
      private async processWithdraw(session: USSDSession, amount: number): Promise<void> {
        // To be implemented later
      }

  private async handleStakeAmount(session: USSDSession, input: string): Promise<string> {
    const t = session.langManager;
    
    // If no input, prompt for amount
    if (!input) {
      return `CON ${t.t('enterStakeAmount')}\n0. ${t.t('back')}`;
    }
    // If user wants to go back
    if (input === '0') {
      session.currentMenu = 'main';
      return this.showMainMenu(session);
    }
    // Validate amount (simple check)
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      return `CON ${t.t('invalidStakeAmount')}\n0. ${t.t('back')}`;
    }
    // Here you would process the stake (not implemented)
    await this.processStake(session, amount); // currently empty
    session.currentMenu = 'main';
    return `END ${t.t('stakeReceived', { amount: amount.toString() })}`;
  }

      // Placeholder for stake processing
      private async processStake(session: USSDSession, amount: number): Promise<void> {
        // To be implemented later
      }
    

  private async handleCheckBalance(session: USSDSession): Promise<string> {
    const t = session.langManager;
    const chainType = session.selectedChain;
    
    try {
      // Check if user has wallet for selected chain
      const wallet = await this.walletModule.getWallet(session.phoneNumber);
      
      if (!wallet) {
        return `END No wallet found for ${chainType}. Please create one first.`;
      }

      const result = await this.walletModule.getBalance(session.phoneNumber);
      
      if (chainType === 'cardano') {
        return `CON Cardano (ADA) Balance
${t.t('walletAddress')}: ${result.wallet}
${t.t('adaBalance', { ada: result.ada })}
${t.t('walletBalance', { balance: result.balance.toString() })}
${t.t('stakeAmount', { balance: result.balance.toString() })}
${t.t('totalRewards', { balance: result.balance.toString() })}

0. Back`;
      } else {
        // Bitcoin Lightning balance
        // Note: This will need wallet module update to support Bitcoin
        return `CON Bitcoin Lightning Balance
Wallet: ${result.wallet}
On-chain: ${result.onchain || 0} BTC
Lightning: ${result.lightning || 0} sats

0. Back`;
      }
    } catch (error) {
      return `END Error checking balance: ${error}`;
    }
  }

  private handleSettings(session: USSDSession, input: string): string {
    const t = session.langManager;
    
    if (!input) {
      return `CON ${t.t('settingsMenu')}
1. ${t.t('changeLanguage')}
2. Switch Blockchain
0. ${t.t('backToMainMenu')}`;
    }

    switch (input) {
      case '1':
        session.currentMenu = 'language_select';
        return this.handleLanguageSelect(session, '');
      case '2':
        session.currentMenu = 'chain_select';
        return this.handleChainSelect(session, '');
      case '0':
        session.currentMenu = 'main';
        return this.showMainMenu(session);
      default:
        return `CON ${t.t('settingsMenu')}
1. ${t.t('changeLanguage')}
2. Switch Blockchain
0. ${t.t('backToMainMenu')}`;
    }
  }

  private handleLanguageSelect(session: USSDSession, input: string): string {
    const t = session.langManager;
    
    if (!input) {
      return `CON ${t.t('selectLanguage')}
1. ${t.t('english')}
2. ${t.t('french')}
0. ${t.t('back')}`;
    }

    switch (input) {
      case '1':
        session.language = 'en';
        session.langManager.setLanguage('en');
        session.currentMenu = 'main';
        return `END ${session.langManager.t('languageChanged')}`;
      case '2':
        session.language = 'fr';
        session.langManager.setLanguage('fr');
        session.currentMenu = 'main';
        return `END ${session.langManager.t('languageChanged')}`;
      case '0':
        session.currentMenu = 'settings';
        return this.handleSettings(session, '');
      default:
        return `CON ${t.t('selectLanguage')}
1. ${t.t('english')}
2. ${t.t('french')}
0. ${t.t('back')}`;
    }
  }

  private handleChainSelect(session: USSDSession, input: string): string {
    const t = session.langManager;
    const currentChain = session.selectedChain === 'cardano' ? 'Cardano (ADA)' : 'Bitcoin Lightning (BTC)';
    
    if (!input) {
      return `CON Select Blockchain
Current: ${currentChain}

1. Cardano (ADA)
2. Bitcoin Lightning (BTC)
0. ${t.t('back')}`;
    }

    switch (input) {
      case '1':
        if (session.selectedChain === 'cardano') {
          session.currentMenu = 'main';
          return `END Already using Cardano blockchain.`;
        }
        session.selectedChain = 'cardano';
        session.currentMenu = 'main';
        return `END Switched to Cardano (ADA) blockchain.
You can now use Cardano for transactions.`;
      case '2':
        if (session.selectedChain === 'bitcoin') {
          session.currentMenu = 'main';
          return `END Already using Bitcoin Lightning blockchain.`;
        }
        session.selectedChain = 'bitcoin';
        session.currentMenu = 'main';
        return `END Switched to Bitcoin Lightning (BTC) blockchain.
You can now use Lightning Network for fast, low-fee transactions.`;
      case '0':
        session.currentMenu = 'settings';
        return this.handleSettings(session, '');
      default:
        return `CON Select Blockchain
Current: ${currentChain}

1. Cardano (ADA)
2. Bitcoin Lightning (BTC)
0. ${t.t('back')}`;
    }
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
    