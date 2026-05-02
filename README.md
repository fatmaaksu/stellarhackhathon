# KidQuest Wallet

KidQuest Wallet, ebeveynlerin çocuklarına görev verebildiği ve görev tamamlandığında harçlığı Stellar Testnet üzerinde akıllı kontrat aracılığıyla güvenli şekilde gönderebildiği bir aile harçlığı uygulamasıdır.

Uygulamada ebeveyn Freighter cüzdanını bağlar, çocukların Stellar cüzdan adreslerini manuel olarak ekler, görev oluşturur ve ödülü akıllı kontratta kilitler. Çocuk görevi tamamladığını bildirdikten sonra ebeveyn onay verir; kontrat kilitli XLM ödülünü çocuğun cüzdanına gönderir.

## Proje Özeti

Geleneksel aile harçlığı modelinde ödeme tamamen ebeveynin sonradan para gönderme kararına bağlıdır. Bu projede ödül, görev oluşturulduğu anda akıllı kontratta kilitlenir. Böylece çocuk görevin ödülünün gerçekten ayrıldığını bilir, ebeveyn de ödeme koşulunu kontrollü şekilde yönetir.

Temel akış:

1. Ebeveyn Freighter ile Stellar Testnet cüzdanını bağlar.
2. Ebeveyn çocuk adı ve çocuğun Stellar public wallet adresini ekler.
3. Ebeveyn görev ve ödül miktarı belirler.
4. Görev oluşturulurken ödül XLM, Soroban akıllı kontratında kilitlenir.
5. Çocuk uygulamada görevi tamamladığını bildirir.
6. Ebeveyn görevi onaylar.
7. Akıllı kontrat kilitli ödülü çocuğun cüzdanına gönderir.

## Özellikler

- Ebeveyn ve çocuk için ayrı kullanım ekranları
- Freighter ile ebeveyn cüzdan bağlantısı
- Çocuk cüzdanını manuel Stellar adresiyle ekleme
- Birden fazla çocuk arasında seçim yapabilme
- Çocuğa görev verme ve ödül miktarı belirleme
- Görev ödülünü Soroban akıllı kontratında kilitleme
- Çocuk tarafından görev tamamlandı bildirimi
- Ebeveyn onayıyla kontrattan çocuğa XLM ödeme
- Stellar Testnet ve Friendbot desteği
- İşlem hashlerini Stellar Expert üzerinde görüntüleme

## Akıllı Kontrat Bilgileri

Kontrat adı: `reward_escrow`

Network: `Stellar Testnet`

Contract ID:

```text
CBVY4GD3R6PRGG4WAFH5Y5WL3LJL2EI6VWYUYHSHNN6EOTQPPT7VQXIH
```

Native XLM token contract:

```text
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

Deploy transaction:

```text
146992dd581528d00419818858f171d3c11f29aaad842257e0ac9d9cf60714cd
```

Kontrat dosyaları:

```text
contracts/reward_escrow/
├── Cargo.toml
├── README.md
└── src/lib.rs
```

Kontrat fonksiyonları:

| Fonksiyon | Açıklama |
|---|---|
| `create_task` | Görev kaydını zincirde oluşturur. |
| `fund_task` | Görev ödülünü kontrata kilitler. |
| `create_and_fund_task` | Görevi oluşturur ve ödülü aynı işlemde kontrata kilitler. |
| `approve_and_pay` | Ebeveyn onayı sonrası ödülü çocuğa gönderir. |
| `refund` | Gerekirse kilitli ödülü ebeveyne geri döndürür. |
| `get_task` | Zincirdeki görev bilgisini okur. |

## Teknoloji Stack

| Katman | Teknoloji |
|---|---|
| Frontend | React, TypeScript, Vite |
| Wallet | Freighter API |
| Backend | Node.js, Express |
| Blockchain SDK | Stellar JavaScript SDK |
| Smart Contract | Rust, Soroban SDK |
| Network | Stellar Testnet |
| Explorer | Stellar Expert Testnet |

## Mimari

```text
Kullanıcı
   |
   v
React Frontend
   |
   | Freighter imzası
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

Frontend kullanıcı arayüzünü ve Freighter imzalama akışını yönetir. Backend, görevleri ve çocuk bilgilerini in-memory olarak tutar, Stellar/Soroban transaction XDR verilerini hazırlar ve imzalanmış transactionları ağa gönderir. Akıllı kontrat ise ödül kilitleme ve ödeme kurallarını zincir üzerinde uygular.

## Proje Yapısı

```text
.
├── backend/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.module.css
│   │   ├── hooks/useFreighter.ts
│   │   └── lib/stellar.ts
│   ├── package.json
│   └── vite.config.ts
├── contracts/
│   ├── reward_escrow/
│   │   ├── src/lib.rs
│   │   ├── Cargo.toml
│   │   └── README.md
│   └── counter/
└── README.md
```

## Kurulum

Gereksinimler:

- Node.js 20 veya üzeri
- npm
- Freighter Wallet tarayıcı eklentisi
- Rust
- Stellar CLI

Backend bağımlılıkları:

```bash
cd backend
npm install
```

Frontend bağımlılıkları:

```bash
cd frontend
npm install
```

## Çalıştırma

Backend:

```bash
cd backend
npm run dev
```

Backend varsayılan olarak şu adreste çalışır:

```text
http://localhost:4000
```

Frontend:

```bash
cd frontend
npm run dev
```

Frontend Vite tarafından verilen adreste açılır. Bu projede geliştirme sırasında kullanılan adres:

```text
http://127.0.0.1:3000
```

Sağlık kontrolü:

```bash
curl http://localhost:4000/api/health
```

Örnek cevap:

```json
{
  "ok": true,
  "network": "testnet",
  "escrowContractId": "CBVY4GD3R6PRGG4WAFH5Y5WL3LJL2EI6VWYUYHSHNN6EOTQPPT7VQXIH"
}
```

## Kullanım Senaryosu

1. Uygulamayı aç.
2. `Ebeveyn` rolünü seç.
3. Freighter cüzdanını bağla.
4. Gerekirse `Testnet XLM al` butonuyla cüzdanı fonla.
5. Çocuğun adını ve Stellar public wallet adresini ekle.
6. Çocuğu seç, görev ve ödül miktarı gir.
7. `Görev ver` butonuna bas.
8. Freighter imzasını onayla; ödül kontratta kilitlenir.
9. `Çocuk` rolüne geç.
10. Çocuk kendini seçer ve görevi tamamladığını bildirir.
11. Ebeveyn paneline dön.
12. Görevi onayla ve Freighter imzasını ver.
13. Kontrat ödülü çocuğun cüzdanına gönderir.

## API Endpointleri

| Method | Endpoint | Açıklama |
|---|---|---|
| `GET` | `/api/health` | Backend ve ağ bilgilerini döndürür. |
| `GET` | `/api/dashboard` | Ebeveyn, çocuk, görev ve ödeme verilerini döndürür. |
| `POST` | `/api/children` | Yeni çocuk cüzdanı ekler. |
| `POST` | `/api/friendbot` | Testnet cüzdanını Friendbot ile fonlar. |
| `POST` | `/api/tasks/escrow-xdr` | Görev oluşturma ve ödül kilitleme transaction XDR hazırlar. |
| `POST` | `/api/tasks/submit-escrow` | İmzalı görev oluşturma transactionını Soroban RPC'ye gönderir. |
| `POST` | `/api/tasks/:id/submit` | Çocuğun görevi tamamladığını kaydeder. |
| `POST` | `/api/tasks/:id/payment-xdr` | Kontrattan ödeme onayı için transaction XDR hazırlar. |
| `POST` | `/api/tasks/:id/submit-payment` | İmzalı ödeme transactionını Soroban RPC'ye gönderir. |
| `GET` | `/api/account/:address` | Stellar hesabının XLM bakiyesini döndürür. |

## Akıllı Kontrat Build

Yeni Soroban/Rust sürümlerinde kontrat build hedefi olarak `wasm32v1-none` kullanılır.

```bash
rustup target add wasm32v1-none
cd contracts/reward_escrow
cargo build --target wasm32v1-none --release
```

Windows üzerinde Türkçe karakterli path sorunları yaşanabildiği için deploy build'i geliştirme sırasında geçici olarak şu dizinde üretilmiştir:

```text
C:\stellar-build\reward_escrow
```

## Neden Blockchain?

Bu projede blockchain sadece ödeme yapmak için değil, ödeme koşulunu güvenceye almak için kullanılır.

- Ödül görev oluşturulurken kontratta kilitlenir.
- Ödeme kuralı kontrat kodunda bellidir.
- Ebeveyn onayı olmadan ödeme çıkmaz.
- Onay sonrası ödeme doğrudan çocuğun cüzdanına gider.
- İşlem geçmişi Stellar Testnet üzerinde doğrulanabilir.

Bu yapı, klasik "sonradan manuel para gönderme" yaklaşımından daha güvenilir ve şeffaftır.

## Güvenlik Notları

- Uygulama ebeveynin private key bilgisini hiçbir zaman almaz.
- İmzalama işlemi Freighter içinde yapılır.
- Çocuk için cüzdan bağlantısı istenmez; sadece public wallet adresi kaydedilir.
- Bu proje Testnet üzerinde çalışır, gerçek para içermez.
- Backend şu an hackathon demosu için in-memory veri kullanır; production ortamında kalıcı veritabanı eklenmelidir.

## Demo İçin Kontrol Listesi

- Freighter kurulu ve Testnet ağı seçili olmalı.
- Ebeveyn cüzdanında Testnet XLM olmalı.
- Çocuk cüzdanı geçerli bir Stellar public key olmalı.
- Görev oluştururken Freighter imzası onaylanmalı.
- Ödeme onayında ikinci Freighter imzası onaylanmalı.
- İşlem hashleri Stellar Expert Testnet üzerinde kontrol edilebilir.

## Faydalı Linkler

- Stellar Developers: https://developers.stellar.org
- Soroban Docs: https://developers.stellar.org/docs/build/smart-contracts
- Stellar Expert Testnet: https://stellar.expert/explorer/testnet
- Freighter Wallet: https://www.freighter.app
- Friendbot: https://friendbot.stellar.org

#   s t e l l a r h a c k h a t h o n  
 