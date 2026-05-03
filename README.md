# KidQuest Wallet

KidQuest Wallet is a Stellar Testnet family allowance app where parents assign tasks to children and lock the reward in a Soroban smart contract. When the child marks the task as completed, the parent approves it with Freighter and the locked XLM reward is released to the child wallet.

The goal of the project is to turn a simple family allowance flow into a transparent, blockchain-backed reward system. Instead of sending money manually after the task, the parent locks the reward when the task is created. This makes the reward visible, verifiable, and conditional.

## Live Blockchain Details

Network: `Stellar Testnet`

Reward Escrow Contract ID:

```text
CBVY4GD3R6PRGG4WAFH5Y5WL3LJL2EI6VWYUYHSHNN6EOTQPPT7VQXIH
```

Native XLM Token Contract:

```text
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

Example Transaction:

```text
f9bfa567104298c960df3d4b24bcafd64795a8d8baa8fb47e7f8ade7a830cddf
```

You can inspect Testnet transactions on Stellar Expert:

```text
https://stellar.expert/explorer/testnet
```

## Problem

In a traditional allowance system, a child completes a task and then waits for the parent to manually send the reward. This flow depends on trust and has no transparent proof that the reward was actually set aside.

KidQuest Wallet solves this by using a smart contract:

- The parent creates a task.
- The task reward is locked in the contract.
- The child submits completion.
- The parent approves the task.
- The contract releases the locked XLM reward to the child wallet.

## Key Features

- Parent and child role selection
- Parent wallet connection with Freighter
- Manual child wallet registration by Stellar public key
- Multiple child wallet support
- Task creation with XLM reward amount
- Reward locking through a Soroban smart contract
- Child task completion flow
- Parent approval and contract-based reward release
- Stellar Testnet Friendbot support
- Transaction links for Stellar Expert
- Warm, kid-friendly orange and white dashboard UI

## User Flow

```text
Parent connects Freighter
        |
        v
Parent adds child wallet
        |
        v
Parent creates task and reward
        |
        v
Reward is locked in the smart contract
        |
        v
Child marks task as completed
        |
        v
Parent approves the task
        |
        v
Smart contract sends reward to child wallet
```

## Demo Walkthrough

This walkthrough shows the full Ecem reward flow captured from the running app. The parent connects Freighter, registers Ecem's public Stellar address, assigns a task, locks the reward, approves the completed task, and confirms that the XLM reward reaches the child wallet.

### 1. Start From Role Selection

The app opens with a clean parent/child role selector. Parents manage wallets and rewards, while children only see their own tasks.

![Landing role selection](docs/screenshots/01-landing-role-selection.png)

### 2. Connect The Parent Wallet

The parent wallet is the only wallet connected to the app. Freighter handles signing, so the private key never touches the frontend or backend.

![Connect parent wallet](docs/screenshots/02-connect-parent-wallet.png)

After connection, the dashboard shows the parent wallet as connected on Stellar Testnet.

![Parent wallet connected](docs/screenshots/03-parent-wallet-connected.png)

### 3. Copy The Child Wallet Address

The child account is added by public Stellar address. In this demo, Ecem's wallet address is opened and copied from Freighter.

![Copy child wallet address](docs/screenshots/04-copy-child-address.png)

![Copy address button](docs/screenshots/05-copy-address-button.png)

### 4. Add Ecem As A Child Wallet

The parent enters Ecem's name and Stellar public key, then clicks **Add Wallet**. This stores the child wallet under the parent dashboard.

![Enter child wallet](docs/screenshots/06-enter-child-wallet.png)

![Add child wallet](docs/screenshots/07-add-child-wallet.png)

Ecem then appears in the child wallet list and can be selected for task assignment.

![Add Ecem wallet step](docs/screenshots/08-add-ecem-wallet.png)

![Ecem wallet added](docs/screenshots/09-ecem-wallet-added.png)

![Select Ecem wallet](docs/screenshots/10-select-ecem-wallet.png)

### 5. Create And Lock A Task Reward

The parent selects Ecem, writes the task, sets the reward to `10 XLM`, and chooses a due date.

![Create task for Ecem](docs/screenshots/11-create-task-for-ecem.png)

Freighter asks the parent to confirm the contract transaction. This step locks the task reward through the Soroban escrow contract.

![Parent signs task escrow](docs/screenshots/12-parent-sign-task-escrow.png)

After signing, the task appears as assigned to Ecem.

![Task assigned to Ecem](docs/screenshots/13-task-assigned-to-ecem.png)

### 6. Child Completes The Task

In child mode, Ecem can see the assigned task and mark it as completed.

![Child task view](docs/screenshots/14-child-task-view.png)

![Child completes task](docs/screenshots/15-child-completes-task.png)

The parent dashboard then shows that the task is waiting for approval.

![Parent sees pending approval](docs/screenshots/16-parent-sees-pending-approval.png)

### 7. Parent Approves And Sends The Reward

The parent approves the completed task. Freighter opens another transaction confirmation for the contract payment.

![Parent approves reward](docs/screenshots/17-parent-approves-reward.png)

Once the transaction is confirmed, the task status changes to paid.

![Reward paid parent view](docs/screenshots/18-reward-paid-parent-view.png)

The child view also shows the task as paid.

![Child paid status](docs/screenshots/19-child-paid-status.png)

### 8. Verify Balances And History

Ecem's Freighter balance increases by `+10 XLM`.

![Child balance increased](docs/screenshots/20-child-balance-increased.png)

The parent balance decreases by the same reward amount after the contract payment is approved.

![Parent balance decreased](docs/screenshots/21-parent-balance-decreased.png)

The parent wallet history shows the contract interaction and the `-10 XLM` reward payment.

![Parent Freighter history](docs/screenshots/22-parent-freighter-history.png)

The parent dashboard provides an overview of the family wallet state.

![Parent dashboard overview](docs/screenshots/23-parent-dashboard-overview.png)

The final dashboard shows two child wallets, the completed Ecem task, and the updated reward totals.

![Final dashboard state](docs/screenshots/24-final-dashboard-state.png)

## Smart Contract

The smart contract is located in:

```text
contracts/reward_escrow/src/lib.rs
```

It is written in Rust with the Soroban SDK.

### Contract Functions

| Function | Description |
|---|---|
| `create_task` | Creates an on-chain task record. |
| `fund_task` | Locks the task reward in the contract. |
| `create_and_fund_task` | Creates the task and locks the reward in one transaction. |
| `approve_and_pay` | Releases the locked reward to the child wallet after parent approval. |
| `refund` | Sends the locked reward back to the parent if needed. |
| `get_task` | Reads task data from contract storage. |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | CSS Modules |
| Wallet | Freighter API |
| Backend | Node.js, Express |
| Blockchain SDK | Stellar JavaScript SDK |
| Smart Contract | Rust, Soroban SDK |
| Network | Stellar Testnet |
| Explorer | Stellar Expert Testnet |

## Architecture

```text
User
  |
  v
React Frontend
  |
  | Freighter signature request
  v
Freighter Wallet
  |
  v
Express Backend
  |
  | Horizon API / Soroban RPC
  v
Stellar Testnet
  |
  v
Reward Escrow Smart Contract
```

The frontend handles the parent and child screens. The backend prepares Stellar/Soroban transaction XDRs and submits signed transactions. Freighter signs transactions without exposing the parent private key. The smart contract enforces the reward locking and payment rules.

## Project Structure

```text
.
├── backend/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── public/
│   │   └── assets/
│   │       ├── kidquest-family.png
│   │       └── kidquest-children.png
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.module.css
│   │   ├── index.css
│   │   ├── hooks/
│   │   │   └── useFreighter.ts
│   │   └── lib/
│   │       └── stellar.ts
│   ├── package.json
│   └── vite.config.ts
├── contracts/
│   ├── reward_escrow/
│   │   ├── Cargo.toml
│   │   ├── README.md
│   │   └── src/
│   │       └── lib.rs
│   └── counter/
├── .gitignore
└── README.md
```

## Setup

Requirements:

- Node.js 20+
- npm
- Rust
- Stellar CLI
- Freighter browser extension

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Run Locally

Start the backend:

```bash
cd backend
npm run dev
```

Backend URL:

```text
http://localhost:4000
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:3000
```

Health check:

```bash
curl http://localhost:4000/api/health
```

Example response:

```json
{
  "ok": true,
  "network": "testnet",
  "escrowContractId": "CBVY4GD3R6PRGG4WAFH5Y5WL3LJL2EI6VWYUYHSHNN6EOTQPPT7VQXIH",
  "nativeTokenContractId": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
}
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns backend and network status. |
| `GET` | `/api/dashboard` | Returns parent, child, task, and payment data. |
| `POST` | `/api/children` | Adds a child wallet by Stellar public key. |
| `POST` | `/api/friendbot` | Funds a Testnet wallet through Friendbot. |
| `POST` | `/api/tasks/escrow-xdr` | Prepares the contract transaction for creating and funding a task. |
| `POST` | `/api/tasks/submit-escrow` | Submits the signed task escrow transaction. |
| `POST` | `/api/tasks/:id/submit` | Marks a child task as completed. |
| `POST` | `/api/tasks/:id/payment-xdr` | Prepares the contract approval/payment transaction. |
| `POST` | `/api/tasks/:id/submit-payment` | Submits the signed contract payment transaction. |
| `GET` | `/api/account/:address` | Returns Stellar account balance information. |

## Smart Contract Build

The contract is under `contracts/reward_escrow`.

For recent Rust and Soroban versions, use `wasm32v1-none`:

```bash
rustup target add wasm32v1-none
cd contracts/reward_escrow
cargo build --target wasm32v1-none --release
```

During development on Windows, the contract was also built from an ASCII-only path to avoid path encoding issues:

```text
C:\stellar-build\reward_escrow
```

## Demo Checklist

1. Open the app.
2. Select the parent role.
3. Connect Freighter on Stellar Testnet.
4. Fund the parent wallet with Testnet XLM if needed.
5. Add a child name and Stellar public wallet address.
6. Create a task with a reward amount.
7. Approve the Freighter signature to lock the reward in the contract.
8. Switch to the child role.
9. Mark the task as completed.
10. Switch back to the parent panel.
11. Approve the task and sign the payment transaction.
12. Show the transaction on Stellar Expert Testnet.

## Security Notes

- The app never receives or stores the parent private key.
- All signing is handled by Freighter.
- Child accounts do not need to connect a wallet; only public wallet addresses are stored.
- Rewards are locked in the smart contract before completion.
- The project runs on Stellar Testnet and does not use real funds.
- The backend uses in-memory data for hackathon/demo purposes.
- A production version should add persistent storage, authentication, and role-based authorization.

## Future Improvements

- Persistent database integration
- Parent account based family records
- Task categories and recurring tasks
- Notification system
- Child profile customization
- Payment history page
- Smart contract event tracking in the frontend
- Production-ready deployment and monitoring

## Summary

KidQuest Wallet brings family tasks and allowance rewards to Stellar. Parents can lock rewards in a Soroban smart contract, children can submit completed tasks, and the contract releases the reward only after parent approval. This makes the allowance flow more transparent, verifiable, and engaging.
