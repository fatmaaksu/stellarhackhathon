# Stellar Wallet Projesi — Claude Code Bağlamı

## Proje Özeti
React + TypeScript frontend, Node.js backend ve Soroban (Rust) akıllı sözleşmesinden oluşan Stellar Testnet uygulaması.

## Teknoloji Yığını
- **Frontend:** React 18, TypeScript, Vite, CSS Modules
- **Backend:** Node.js, Express
- **Cüzdan:** Freighter (`@stellar/freighter-api` v4)
- **Stellar SDK:** `@stellar/stellar-sdk` v13
- **Akıllı Sözleşme:** Rust + `soroban-sdk` v25, Stellar CLI

## Ağ Yapılandırması
```
Horizon  : https://horizon-testnet.stellar.org
RPC      : https://soroban-testnet.stellar.org
Passphrase: "Test SDF Network ; September 2015"
Explorer : https://stellar.expert/explorer/testnet
```

## Klasör Yapısı
```
stellarproje/
├── contracts/counter/src/lib.rs    ← Soroban sözleşmesi (Rust)
├── frontend/src/
│   ├── hooks/useFreighter.ts       ← Cüzdan state yönetimi
│   ├── lib/stellar.ts              ← Horizon + RPC istemcileri
│   ├── lib/contract.ts             ← Sözleşme çağrı fonksiyonları
│   └── components/
│       ├── ConnectButton.tsx
│       ├── WalletInfo.tsx
│       └── CounterContract.tsx
└── backend/server.js               ← Express API
```

## Kritik Kurallar

### Freighter API v4 Dönüş Tipleri
```typescript
// DOĞRU — v4 nesne döner
const { isConnected }  = await isConnected();
const { isAllowed }    = await isAllowed();
const { address }      = await getAddress();
const { network }      = await getNetwork();
const { signedTxXdr, error } = await signTransaction(xdr, { networkPassphrase });

// YANLIŞ — v2/v3 boolean dönerdi
const connected = await isConnected(); // artık çalışmaz
```

### Soroban İşlem Akışı (her zaman bu sıra)
```typescript
// 1. Account al
const account = await rpc.getAccount(userAddress);
// 2. Transaction oluştur
let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
  .addOperation(contract.call("method", ...args))
  .setTimeout(180).build();
// 3. Simüle et (kaynak tahmini)
const sim = await rpc.simulateTransaction(tx);
if (StellarRpc.Api.isSimulationError(sim)) throw new Error(sim.error);
// 4. Assemble (resource limit ekle)
tx = StellarRpc.assembleTransaction(tx, sim).build();
// 5. İmzala (Freighter)
const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase });
// 6. Gönder
const resp = await rpc.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase));
// 7. Onayla (polling)
let result = await rpc.getTransaction(resp.hash);
while (result.status === "NOT_FOUND") {
  await new Promise(r => setTimeout(r, 1000));
  result = await rpc.getTransaction(resp.hash);
}
```

### Soroban Depolama TTL
```rust
// ZORUNLU: Archival'ı önlemek için extend_ttl her yazma sonrası
env.storage().instance().extend_ttl(100, 518400); // ~30 gün
```

### Sözleşme Depolama Seçimi
- `instance()` → global config, admin adresi, sayaç
- `persistent()` → kullanıcı bakiyeleri (büyük veri)
- `temporary()` → önbellek, oturum verileri

## Ortam Değişkenleri
```
frontend/.env:
  VITE_COUNTER_CONTRACT_ID=C...   (deploy sonrası elde edilir)
```

## Komutlar
```bash
# Frontend geliştirme
cd frontend && npm run dev        # localhost:5173

# Backend geliştirme
cd backend && npm run dev         # localhost:4000

# Sözleşme derleme
cd contracts/counter && stellar contract build

# Sözleşme deploy (testnet)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/counter.wasm \
  --source <kimlik> --network testnet \
  -- --admin <kimlik>

# Testnet kimlik + fonlama
stellar keys generate --global alice --network testnet --fund
```

## Bilinen Kısıtlamalar
- Sözleşme boyutu maksimum 64 KB
- `#![no_std]` zorunlu — standart kütüphane yok
- `Symbol` maksimum 32 karakter
- Simülasyon için bile geçerli bir on-chain hesap gerekir
- Freighter yalnızca Testnet veya Mainnet seçer; özel ağlar için farklı yapılandırma gerekir
