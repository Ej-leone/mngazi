# Mngazi USSD Service

This project provides a USSD gateway for wallet, deposit, staking, and withdrawal operations. It is built with Node.js, TypeScript, and Express.

## Features

- [x] Wallet generation
- [ ] Cardano native staking
- [ ] Stable coin staking
- [ ] Exporting private keys
- [ ] Off/Onramp integration

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later recommended)
- [Yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)

## Setup

1. **Clone the repository**

   ```sh
   git clone <your-repo-url>
   cd <project-directory>
   ```

2. **Install dependencies**

   ```sh
   cd ussdclient
   yarn install
   # or
   npm install
   ```

3. **Build the project**

   ```sh
   yarn build
   # or
   npm run build
   ```

   This will compile the TypeScript files into JavaScript in the `dist` folder.

4. **Run the server**

   ```sh
   yarn start
   # or
   npm start
   ```

   The server will start on port 3000 by default.

5. **Test the USSD endpoint**

   - Health check: [http://localhost:3000/health](http://localhost:3000/health)
   - USSD endpoint: [http://localhost:3000/ussd](http://localhost:3000/ussd)

   You can use tools like [Postman](https://www.postman.com/) or [curl](https://curl.se/) to simulate USSD requests.

## Project Structure

```
submission/
  core/
  Mngazi/
  ussdclient/
    database.ts
    index.ts
    offramp.ts
    staking.ts
    types.ts
    ussd.ts
    wallet.ts
    package.json
    tsconfig.json
    ...
  flow.html
  roadmap.html
```

## Development

- Source code is in the `ussdclient` directory.
- TypeScript configuration is in `ussdclient/tsconfig.json`.
- To add new USSD flows, edit `ussdclient/ussd.ts`.

## Testing

You can test the deployed USSD service using the Africa's Talking USSD Simulator:

1. Go to: [https://developers.africastalking.com/simulator](https://developers.africastalking.com/simulator)
2. Enter your phone number in the simulator.
3. Dial `*384*14589#` in the simulator to access the Mngazi USSD menu.

Additionally, users can acquire the `bruno.json` file located in the `Mngazi` folder. This file contains essential configuration details for the Mngazi project.

> **Disclaimer:**  
> The service is hosted on the free tier at Render. You may experience a wait period of up to a minute for the first request as the server may be waking up from sleep.

## Roadmap

For a detailed roadmap of the project, see:  
[ Roadmap](https://ej-leone.github.io/mngazi/roadmap.html)

## System Flow

For a visual overview of the USSD system flow, see:  
[ System Flow](https://ej-leone.github.io/mngazi/flow.html)


    