# GitHub Copilot — Stellar Geliştirici Çalışma Alanı Talimatları

> Bu dosya `.github/copilot-instructions.md` olarak proje köküne kopyalanmalıdır.
> GitHub Copilot bu dosyayı otomatik olarak okur ve önerilerini buna göre ayarlar.

---

## Kurulum

```bash
# Bu dosyayı projenin .github/ klasörüne kopyala
mkdir -p .github
cp ai-skills/codex/copilot-instructions.md .github/copilot-instructions.md
```

---

## Talimat İçeriği
*(Aşağıdaki içerik `.github/copilot-instructions.md` dosyasına gider)*

---

Bu proje Stellar blockchain ekosisteminde geliştirilmektedir.

## Proje Stack'i

- **Akıllı Sözleşme:** Rust, soroban-sdk v25, #![no_std], wasm32-unknown-unknown hedefi
- **Frontend:** React 18, TypeScript (strict), Vite, CSS Modules
- **Cüzdan:** @stellar/freighter-api v4
- **Stellar SDK:** @stellar/stellar-sdk v13
- **Backend:** Node.js, Express (ESM modülleri)
- **Ağ:** Stellar Testnet

## TypeScript Kuralları

### Freighter API v4 — Nesne Dönüş Tipleri

```typescript
// Her fonksiyon bir nesne döner — destructuring kullan
import {
  isConnected, isAllowed, setAllowed,
  getAddress, getNetwork, signTransaction
} from "@stellar/freighter-api";

const { isConnected: connected } = await isConnected();
const { isAllowed: allowed }     = await isAllowed();
const { address }                = await getAddress();
const { network }                = await getNetwork();
const { signedTxXdr, error }     = await signTransaction(xdr, {
  networkPassphrase: "Test SDF Network ; September 2015",
});
```

### Soroban İşlem Akışı — Tam Şablon

```typescript
import {
  Contract, TransactionBuilder, BASE_FEE,
  rpc as StellarRpc, scValToNative, Transaction,
  Networks,
} from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
const PASSPHRASE = Networks.TESTNET; // "Test SDF Network ; September 2015"
const rpc = new StellarRpc.Server(RPC_URL);

async function invokeContract(
  contractId: string,
  method: string,
  userAddress: string,
): Promise<unknown> {
  // 1. Hesap bilgisini al
  const account = await rpc.getAccount(userAddress);

  // 2. İşlemi oluştur
  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method))
    .setTimeout(180)
    .build();

  // 3. Simüle et
  const sim = await rpc.simulateTransaction(tx);
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simülasyon hatası: ${sim.error}`);
  }

  // 4. Kaynak limitlerini ekle (assembleTransaction zorunlu)
  tx = StellarRpc.assembleTransaction(tx, sim).build();

  // 5. Freighter ile imzala
  const { signedTxXdr, error } = await signTransaction(tx.toXDR(), {
    networkPassphrase: PASSPHRASE,
  });
  if (error) throw new Error(error);

  // 6. Ağa gönder
  const signed = TransactionBuilder.fromXDR(signedTxXdr, PASSPHRASE) as Transaction;
  const response = await rpc.sendTransaction(signed);
  if (response.status === "ERROR") throw new Error("İşlem reddedildi");

  // 7. Onay bekle (polling)
  let result = await rpc.getTransaction(response.hash);
  while (result.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1000));
    result = await rpc.getTransaction(response.hash);
  }
  if (result.status !== "SUCCESS") throw new Error("İşlem başarısız");

  return result.returnValue ? scValToNative(result.returnValue) : null;
}
```

### Sadece Okuma (İmzasız Simülasyon)

```typescript
async function readContract(contractId: string, method: string, sourceAddress: string) {
  const account = await rpc.getAccount(sourceAddress);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method))
    .setTimeout(30)
    .build();
  const sim = await rpc.simulateTransaction(tx);
  if (StellarRpc.Api.isSimulationError(sim) || !sim.result) return null;
  return scValToNative(sim.result.retval);
}
```

### React Freighter Hook Şablonu

```typescript
import { useState, useEffect, useCallback } from "react";
import { isConnected, isAllowed, setAllowed, getAddress, getNetwork } from "@stellar/freighter-api";

export type WalletStatus = "idle" | "connecting" | "connected" | "error";

export function useFreighter() {
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      const { isConnected: ok } = await isConnected();
      if (!ok) throw new Error("Freighter yüklü değil");
      await setAllowed();
      const { address: addr } = await getAddress();
      const { network: net } = await getNetwork();
      setAddress(addr);
      setNetwork(net);
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bağlantı hatası");
      setStatus("error");
    }
  }, []);

  return { status, address, network, error, connect };
}
```

## Rust / Soroban Kuralları

### Sözleşme Şablonu

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    // Veri anahtarları buraya
}

#[contract]
pub struct BenimSozlesmem;

#[contractimpl]
impl BenimSozlesmem {
    pub fn __constructor(env: Env, admin: Address) {
        // Protocol 22+: constructor ile atomik başlatma
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().extend_ttl(100, 518400);
    }

    pub fn admin_islemi(env: Env, _param: u32) -> u32 {
        // Admin yetkisi gerektiren işlem
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        // ... işlem ...
        env.storage().instance().extend_ttl(100, 518400); // HER yazma sonrası
        0
    }
}
```

### Test Şablonu

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_temel() {
        let env = Env::default();
        env.mock_all_auths(); // tüm require_auth çağrılarını otomatik onayla

        let contract_id = env.register(BenimSozlesmem, ());
        let client = BenimSozlesmemClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        // ... test adımları ...
    }
}
```

## Dosya Adlandırma Kuralları

```
frontend/src/components/  → PascalCase.tsx   (ör: TokenList.tsx)
frontend/src/hooks/       → useKamelCase.ts  (ör: useTokenBalance.ts)
frontend/src/lib/         → kebab-case.ts    (ör: contract-helpers.ts)
frontend/src/components/  → PascalCase.module.css
contracts/*/src/          → lib.rs (giriş noktası)
```

## Hata Mesajları — Türkçe Kullan

```typescript
// Doğru
throw new Error("Freighter yüklü değil. Tarayıcı eklentisini kurun.");
throw new Error("Simülasyon hatası: " + sim.error);
throw new Error("İşlem başarısız oldu");

// Yanlış
throw new Error("Freighter not installed");
```

## Ağ Sabitleri

```typescript
export const TESTNET = {
  rpcUrl:           "https://soroban-testnet.stellar.org",
  horizonUrl:       "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  friendbotUrl:     "https://friendbot.stellar.org",
  explorerUrl:      "https://stellar.expert/explorer/testnet",
} as const;
```

## Yaygın Hatalar — Yapma

```typescript
// YANLIŞ: assembleTransaction olmadan gönderme
const response = await rpc.sendTransaction(tx); // kaynak yok → HATA

// DOĞRU
const tx2 = StellarRpc.assembleTransaction(tx, sim).build();
const response = await rpc.sendTransaction(tx2);

// YANLIŞ: Freighter v3 API
const connected = await isConnected(); // boolean değil, nesne döner

// DOĞRU: v4 API
const { isConnected: connected } = await isConnected();

// YANLIŞ: TTL yönetimi eksik
env.storage().instance().set(&key, &value); // TTL uzatılmadı → archival riski

// DOĞRU
env.storage().instance().set(&key, &value);
env.storage().instance().extend_ttl(100, 518400);
```

---

## VS Code Copilot Chat için Bağlam Komutları

VS Code'da Copilot Chat açıkken şu komutları kullan:

```
@workspace Soroban sayaç sözleşmesine yeni bir fonksiyon ekle
@workspace Freighter cüzdan bağlantısında hata var, düzelt
@workspace /explain contracts/counter/src/lib.rs
@workspace /fix frontend/src/lib/contract.ts
```
