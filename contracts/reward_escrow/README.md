# Reward Escrow Contract

Bu Soroban kontratı KidQuest Wallet için görev ödülünü güvenli şekilde kilitler.

- `create_and_fund_task`: Ebeveyn görevi oluşturur ve XLM ödülünü kontrata kilitler.
- `approve_and_pay`: Görev onaylanınca kilitli ödülü çocuğun cüzdanına gönderir.
- `refund`: Gerekirse kilitli ödülü ebeveyne geri döndürür.
- `get_task`: Zincirdeki görev bilgisini okur.

## Testnet Deploy

- Network: Stellar Testnet
- Contract ID: `CBVY4GD3R6PRGG4WAFH5Y5WL3LJL2EI6VWYUYHSHNN6EOTQPPT7VQXIH`
- Native XLM token contract: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Deploy transaction: `146992dd581528d00419818858f171d3c11f29aaad842257e0ac9d9cf60714cd`

## Build

Yeni Rust/Soroban sürümlerinde `wasm32-unknown-unknown` yerine `wasm32v1-none` kullanılmalı.

```powershell
rustup target add wasm32v1-none
cargo build --target wasm32v1-none --release
```

Bu projede Windows path sorunlarını önlemek için deploy build'i geçici olarak `C:\stellar-build\reward_escrow` altında üretildi.
