import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import {
  Address,
  BASE_FEE,
  Contract,
  Horizon,
  Networks,
  rpc,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const app = express();
const PORT = process.env.PORT ?? 4000;
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org";
const FRIEND_BOT_URL = "https://friendbot.stellar.org";
const ESCROW_CONTRACT_ID = process.env.ESCROW_CONTRACT_ID ?? "CBVY4GD3R6PRGG4WAFH5Y5WL3LJL2EI6VWYUYHSHNN6EOTQPPT7VQXIH";
const NATIVE_TOKEN_CONTRACT_ID = process.env.NATIVE_TOKEN_CONTRACT_ID ?? "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const horizon = new Horizon.Server(HORIZON_URL);
const soroban = new rpc.Server(RPC_URL);
const escrowContract = new Contract(ESCROW_CONTRACT_ID);

const state = {
  parent: {
    name: "Demo Ebeveyn",
    walletAddress: null,
  },
  children: [],
  tasks: [],
  pendingTasks: [],
  payments: [],
};

app.use(cors({ origin: ["http://localhost:3000", "http://127.0.0.1:3000"] }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    network: "testnet",
    horizonUrl: HORIZON_URL,
    rpcUrl: RPC_URL,
    escrowContractId: ESCROW_CONTRACT_ID,
    nativeTokenContractId: NATIVE_TOKEN_CONTRACT_ID,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/dashboard", async (_req, res) => {
  const children = await Promise.all(
    state.children.map(async (child) => ({
      ...safeChild(child),
      balance: await getNativeBalance(child.walletAddress),
    })),
  );

  res.json({
    parent: state.parent,
    treasuryBalance: "0.0000000",
    contractId: ESCROW_CONTRACT_ID,
    children,
    tasks: state.tasks,
    payments: state.payments,
  });
});

app.post("/api/children", async (req, res) => {
  const name = sanitizeText(req.body.name);
  const walletAddress = sanitizeText(req.body.walletAddress).toUpperCase();

  if (!name) {
    return res.status(400).json({ error: "Çocuk adı gerekli" });
  }

  if (!isValidStellarAddress(walletAddress)) {
    return res.status(400).json({ error: "Geçerli bir Stellar public key gir" });
  }

  const existing = state.children.find((child) => child.walletAddress === walletAddress);
  if (existing) {
    return res.status(409).json({ error: "Bu cüzdan zaten aileye eklenmiş" });
  }

  const child = {
    id: randomUUID(),
    name,
    walletAddress,
    createdAt: new Date().toISOString(),
  };

  state.children.push(child);

  res.status(201).json({
    child: { ...safeChild(child), balance: await getNativeBalance(walletAddress) },
  });
});

app.post("/api/friendbot", async (req, res) => {
  const address = sanitizeText(req.body.address).toUpperCase();

  if (!isValidStellarAddress(address)) {
    return res.status(400).json({ error: "Geçerli bir Stellar public key gir" });
  }

  try {
    const response = await fetch(`${FRIEND_BOT_URL}?addr=${address}`);
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: body.detail || body.title || "Friendbot cüzdanı fonlayamadı",
      });
    }

    res.json({
      ok: true,
      address,
      hash: body.hash,
      balance: await getNativeBalance(address),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Friendbot bağlantı hatası" });
  }
});

app.post("/api/tasks", (_req, res) => {
  res.status(410).json({
    error: "Görev artık akıllı kontratla oluşturuluyor. escrow-xdr ve submit-escrow akışını kullan.",
  });
});

app.post("/api/tasks/escrow-xdr", async (req, res) => {
  const child = state.children.find((item) => item.id === req.body.childId);
  const title = sanitizeText(req.body.title);
  const rewardXlm = Number(req.body.rewardXlm);
  const dueDate = sanitizeText(req.body.dueDate);
  const sourceAddress = sanitizeText(req.body.sourceAddress).toUpperCase();

  if (!child) {
    return res.status(404).json({ error: "Çocuk bulunamadı" });
  }

  if (!isValidStellarAddress(sourceAddress)) {
    return res.status(400).json({ error: "Ebeveyn cüzdan adresi geçersiz" });
  }

  if (!title || !Number.isFinite(rewardXlm) || rewardXlm <= 0) {
    return res.status(400).json({ error: "Görev adı ve pozitif ödül gerekli" });
  }

  try {
    const source = await soroban.getAccount(sourceAddress);
    const amountStroops = xlmToStroops(rewardXlm);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        escrowContract.call(
          "create_and_fund_task",
          Address.fromString(sourceAddress).toScVal(),
          Address.fromString(child.walletAddress).toScVal(),
          Address.fromString(NATIVE_TOKEN_CONTRACT_ID).toScVal(),
          nativeToScVal(amountStroops, { type: "i128" }),
          nativeToScVal(title, { type: "string" }),
        ),
      )
      .setTimeout(180)
      .build();

    const prepared = await soroban.prepareTransaction(tx);
    const draftId = randomUUID();
    state.pendingTasks.push({
      id: draftId,
      childId: child.id,
      childName: child.name,
      parentAddress: sourceAddress,
      title,
      rewardXlm: rewardXlm.toFixed(2),
      dueDate,
      amountStroops,
      createdAt: new Date().toISOString(),
    });
    state.parent.walletAddress = sourceAddress;

    res.json({
      draftId,
      xdr: prepared.toXDR(),
      networkPassphrase: Networks.TESTNET,
      contractId: ESCROW_CONTRACT_ID,
      amount: rewardXlm.toFixed(2),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Kontrat görevi hazırlanamadı: ${getSorobanError(err)}` });
  }
});

app.post("/api/tasks/submit-escrow", async (req, res) => {
  const draftId = sanitizeText(req.body.draftId);
  const signedXdr = sanitizeText(req.body.signedXdr, 20000);
  const draft = state.pendingTasks.find((item) => item.id === draftId);

  if (!draft) {
    return res.status(404).json({ error: "Görev taslağı bulunamadı" });
  }

  if (!signedXdr) {
    return res.status(400).json({ error: "İmzalı kontrat transaction XDR gerekli" });
  }

  try {
    const txHash = await submitSorobanTransaction(signedXdr);
    const txResponse = await waitForSorobanTransaction(txHash);
    const onchainTaskId = scValToNative(txResponse.returnValue).toString();
    const task = {
      id: randomUUID(),
      childId: draft.childId,
      childName: draft.childName,
      title: draft.title,
      rewardXlm: draft.rewardXlm,
      dueDate: draft.dueDate,
      status: "assigned",
      proof: "",
      txHash: null,
      escrowTxHash: txHash,
      onchainTaskId,
      createdAt: new Date().toISOString(),
      submittedAt: null,
      approvedAt: null,
    };

    state.pendingTasks = state.pendingTasks.filter((item) => item.id !== draftId);
    state.tasks.unshift(task);

    res.status(201).json({ task, txHash, onchainTaskId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Kontrat görevi gönderilemedi: ${getSorobanError(err)}` });
  }
});

app.post("/api/tasks/:id/submit", (req, res) => {
  const task = state.tasks.find((item) => item.id === req.params.id);
  const proof = sanitizeText(req.body.proof);

  if (!task) {
    return res.status(404).json({ error: "Görev bulunamadı" });
  }

  if (task.status !== "assigned") {
    return res.status(409).json({ error: "Bu görev zaten gönderilmiş veya ödenmiş" });
  }

  task.status = "submitted";
  task.proof = proof || "Çocuk görevi tamamladığını bildirdi.";
  task.submittedAt = new Date().toISOString();

  res.json({ task });
});

app.post("/api/tasks/:id/payment-xdr", async (req, res) => {
  const task = state.tasks.find((item) => item.id === req.params.id);
  const sourceAddress = sanitizeText(req.body.sourceAddress).toUpperCase();

  if (!task) {
    return res.status(404).json({ error: "Görev bulunamadı" });
  }

  if (task.status !== "submitted") {
    return res.status(409).json({ error: "Ödeme için çocuk önce görevi tamamlamalı" });
  }

  if (!isValidStellarAddress(sourceAddress)) {
    return res.status(400).json({ error: "Ebeveyn cüzdan adresi geçersiz" });
  }

  if (!task.onchainTaskId) {
    return res.status(409).json({ error: "Bu görev kontratta kilitlenmemiş. Yeni görev oluşturup tekrar dene." });
  }

  const child = state.children.find((item) => item.id === task.childId);
  if (!child) {
    return res.status(404).json({ error: "Çocuk bulunamadı" });
  }

  try {
    const source = await soroban.getAccount(sourceAddress);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        escrowContract.call(
          "approve_and_pay",
          nativeToScVal(Number(task.onchainTaskId), { type: "u64" }),
        ),
      )
      .setTimeout(180)
      .build();
    const prepared = await soroban.prepareTransaction(tx);

    state.parent.walletAddress = sourceAddress;

    res.json({
      xdr: prepared.toXDR(),
      networkPassphrase: Networks.TESTNET,
      taskId: task.id,
      destination: child.walletAddress,
      amount: task.rewardXlm,
      contractId: ESCROW_CONTRACT_ID,
      onchainTaskId: task.onchainTaskId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Kontrat ödeme onayı hazırlanamadı: ${getSorobanError(err)}` });
  }
});

app.post("/api/tasks/:id/submit-payment", async (req, res) => {
  const task = state.tasks.find((item) => item.id === req.params.id);
  const signedXdr = sanitizeText(req.body.signedXdr, 20000);

  if (!task) {
    return res.status(404).json({ error: "Görev bulunamadı" });
  }

  if (task.status !== "submitted") {
    return res.status(409).json({ error: "Bu görev ödeme beklemiyor" });
  }

  if (!signedXdr) {
    return res.status(400).json({ error: "İmzalı transaction XDR gerekli" });
  }

  const child = state.children.find((item) => item.id === task.childId);
  if (!child) {
    return res.status(404).json({ error: "Çocuk bulunamadı" });
  }

  try {
    const txHash = await submitSorobanTransaction(signedXdr);
    await waitForSorobanTransaction(txHash);

    task.status = "paid";
    task.txHash = txHash;
    task.approvedAt = new Date().toISOString();

    const payment = {
      id: randomUUID(),
      taskId: task.id,
      childId: child.id,
      childName: child.name,
      amount: task.rewardXlm,
      txHash,
      createdAt: new Date().toISOString(),
    };

    state.payments.unshift(payment);

    res.json({
      task,
      payment,
      childBalance: await getNativeBalance(child.walletAddress),
      txHash,
    });
  } catch (err) {
    const details = getSorobanError(err);
    console.error(details, err?.response?.data ?? err);
    res.status(500).json({ error: `İmzalı kontrat ödemesi gönderilemedi: ${details}` });
  }
});

app.post("/api/tasks/:id/approve", (_req, res) => {
  res.status(410).json({
    error: "Bu endpoint kaldırıldı. Ödeme için payment-xdr ve submit-payment akışını kullan.",
  });
});

app.get("/api/account/:address", async (req, res) => {
  const { address } = req.params;

  if (!isValidStellarAddress(address)) {
    return res.status(400).json({ error: "Geçersiz Stellar adresi" });
  }

  try {
    const account = await horizon.loadAccount(address);
    const xlm = account.balances.find((balance) => balance.asset_type === "native");
    const tokens = account.balances.filter((balance) => balance.asset_type !== "native");

    return res.json({
      address,
      xlmBalance: xlm?.balance ?? "0",
      sequence: account.sequence,
      subentryCount: account.subentry_count,
      tokens: tokens.map((token) => ({
        asset: `${token.asset_code}:${token.asset_issuer}`,
        balance: token.balance,
      })),
      networkPassphrase: Networks.TESTNET,
    });
  } catch (err) {
    if (err?.response?.status === 404) {
      return res.status(404).json({ error: "Hesap bulunamadı veya fonlanmamış" });
    }
    console.error(err);
    return res.status(500).json({ error: "Horizon bağlantı hatası" });
  }
});

async function getNativeBalance(address) {
  try {
    const account = await horizon.loadAccount(address);
    const native = account.balances.find((balance) => balance.asset_type === "native");
    return native?.balance ?? "0.0000000";
  } catch (err) {
    if (err?.response?.status === 404) {
      return "0.0000000";
    }
    throw err;
  }
}

async function submitSorobanTransaction(signedXdr) {
  const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  const result = await soroban.sendTransaction(signed);

  if (result.status !== "PENDING") {
    throw new Error(result.errorResultXdr || result.status || "Soroban transaction kabul edilmedi");
  }

  return result.hash;
}

async function waitForSorobanTransaction(hash) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await soroban.getTransaction(hash);

    if (response.status === "SUCCESS") {
      return response;
    }

    if (response.status === "FAILED") {
      throw new Error(response.resultXdr || "Soroban transaction başarısız oldu");
    }
  }

  throw new Error("Soroban transaction sonucu zamanında alınamadı");
}

function safeChild(child) {
  return {
    id: child.id,
    name: child.name,
    walletAddress: child.walletAddress,
    createdAt: child.createdAt,
  };
}

function isValidStellarAddress(value) {
  return /^G[A-Z2-7]{55}$/.test(value);
}

function sanitizeText(value, maxLength = 140) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function xlmToStroops(value) {
  return Math.round(Number(value) * 10_000_000);
}

function getSorobanError(err) {
  return err?.message || err?.response?.data?.detail || "Bilinmeyen Soroban hatası";
}

app.listen(PORT, () => {
  console.log(`Backend: http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/api/health`);
});
