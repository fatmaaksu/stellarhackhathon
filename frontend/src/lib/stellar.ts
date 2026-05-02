import {
  Horizon,
  Networks,
  rpc as StellarRpc,
  TransactionBuilder,
  BASE_FEE,
  Asset,
  Transaction,
  Operation,
  Memo,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

export const NETWORK = "testnet";

export const config = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  explorerUrl: "https://stellar.expert/explorer/testnet",
};

export const horizon = new Horizon.Server(config.horizonUrl);
export const rpc = new StellarRpc.Server(config.rpcUrl);

export async function getAccountInfo(address: string) {
  try {
    const account = await horizon.loadAccount(address);
    const xlmBalance = account.balances.find((b) => b.asset_type === "native");
    return {
      address,
      balance: xlmBalance?.balance ?? "0",
      sequence: account.sequence,
      subentryCount: account.subentry_count,
    };
  } catch (err: unknown) {
    const e = err as { response?: { status: number } };
    if (e?.response?.status === 404) {
      return { address, balance: "0", sequence: "0", subentryCount: 0 };
    }
    throw err;
  }
}

export async function sendPaymentFromWallet(
  sourceAddress: string,
  destinationAddress: string,
  amount: string,
  memo?: string,
): Promise<string> {
  const sourceAccount = await horizon.loadAccount(sourceAddress);
  const paymentTx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAddress,
        asset: Asset.native(),
        amount: Number(amount).toFixed(7),
      }),
    )
    .addMemo(memo ? Memo.text(memo.slice(0, 28)) : Memo.none())
    .setTimeout(30)
    .build();

  const { signedTxXdr, error } = await signTransaction(paymentTx.toXDR(), {
    networkPassphrase: Networks.TESTNET,
  });

  if (error) {
    throw new Error(error);
  }

  const signed = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET) as Transaction;
  const result = await horizon.submitTransaction(signed);
  return result.hash;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function explorerLink(address: string): string {
  return `${config.explorerUrl}/account/${address}`;
}
