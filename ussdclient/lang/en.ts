export const en = {
  // Welcome and Signup
  welcome: "Welcome to Mngazi",
  notRegistered: "You are not registered.",
  signupPrompt: "Press 1 to sign up, 2 to cancel.",
  signupSuccess: "Signup successful! Your wallet has been created.\nWelcome to Mngazi. Please dial again to access the main menu.",
  signupCancelled: "Signup cancelled.",
  signupError: "Error creating wallet",

  // Main Menu
  mainMenu: "MAIN MENU",
  aboutGuide: "About & Guide",
  deposit: "Deposit",
  stake: "Stake",
  checkBalance: "Check Balance & Profile",
  withdraw: "Withdraw",
  settings: "Settings",
  exit: "Exit",

  // About
  aboutText: "About US\n© Mngazi a foundational wealth-building platform that offers users an 8-12% APR yield earning, auto-compounding interest, and flexible deposit and withdrawal options, all designed to empower individual savers and promote financial growth.",

  // Deposit
  enterDepositAmount: "Enter deposit amount (KES):",
  depositReceived: "Deposit of ${{amount}} received. (Processing not implemented)",
  invalidAmount: "Invalid amount. Please enter a valid deposit amount (USD):",

  // Stake
  enterStakeAmount: "Enter amount to stake (USDA):",
  stakeReceived: "Stake of {{amount}} USDA received. (Processing not implemented)",
  invalidStakeAmount: "Invalid amount. Please enter a valid stake amount (USDA):",

  // Withdraw
  enterWithdrawAmount: "Enter withdrawal amount (KES):",
  withdrawalReceived: "Withdrawal of ${{amount}} received. (Processing not implemented)",
  invalidWithdrawAmount: "Invalid amount. Please enter a valid withdrawal amount (USD):",

  // Balance
  walletAddress: "Wallet Address",
  adaBalance: "Your Ada balance is {{ada}} KES.",
  walletBalance: "Your Wallet balance is {{balance}} KES.",
  stakeAmount: "Your Stake amount is {{balance}} KES.",
  totalRewards: "Your Total Rewards is {{balance}} USD.",

  // Settings Menu
  settingsMenu: "SETTINGS",
  changeLanguage: "Change Language",
  backToMainMenu: "Back to Main Menu",

  // Language Menu
  selectLanguage: "SELECT LANGUAGE",
  english: "English",
  french: "French (Français)",
  languageChanged: "Language changed to English.",

  // Common
  back: "Back to main menu",
  thankYou: "Thank you for using Mngazi!",
  error: "Error processing request. Please try again.",
  invalidRequest: "Error: Invalid request parameters",
  invalidInput: "Invalid input.",
};

export type TranslationKeys = typeof en;

