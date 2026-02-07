---
title: Reading from Network
description:
  Learn how to read data from the Solana blockchain network. This guide covers
  fetching wallet accounts, program accounts, and token mint accounts using
  JavaScript/TypeScript, with practical examples using the Solana web3.js
  library.
---

Read data from the Solana network by fetching different accounts. This section
will help you understand the structure of Solana
[accounts](/docs/core/accounts). Each Solana account has a unique
[address](/docs/core/accounts#account-address) that is used to locate its
corresponding on-chain data. Accounts contain either
[state data or an executable program](/docs/core/accounts#types-of-accounts).

## Fetch a wallet account

<WithMentions>

A wallet is an account owned by the
[System Program](/docs/core/programs#the-system-program). Wallets are primarily
used to hold SOL and sign transactions. When SOL is sent to a new address for
the first time, a system account is automatically created.

The example below generates a [new keypair](mention:keypair),
[requests SOL](mention:airdrop) to fund the new public key address, and
[retrieves the account data](mention:info) for the newly funded wallet.

<CodeTabs flags="r">

```ts !! title="Fetch account"
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

// !mention keypair
const keypair = Keypair.generate();
console.log(`Public Key: ${keypair.publicKey}`);

const connection = new Connection("http://localhost:8899", "confirmed");

// Funding an address with SOL automatically creates an account
// !mention airdrop
const signature = await connection.requestAirdrop(
  keypair.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// !mention info
const accountInfo = await connection.getAccountInfo(keypair.publicKey);
console.log(JSON.stringify(accountInfo, null, 2));
```

</CodeTabs>
</WithMentions>

<ScrollyCoding>

## !!steps

When you fetch a wallet account, the response includes the fields shown in the
example output on the right.

<CodePlaceholder title="Example output" />

```json !! title="Example output"
{
  "data": {
    "type": "Buffer",
    "data": []
  },
  "executable": false,
  "lamports": 1000000000,
  "owner": "11111111111111111111111111111111",
  "rentEpoch": 0,
  "space": 0
}
```

## !!steps

The `data` field contains the account's data stored as bytes. For wallet
accounts, this field is empty (0 bytes).

<CodePlaceholder title="Example output" />

```json !! title="Example output"
{
  // !focus(1:4)
  "data": {
    "type": "Buffer",
    "data": []
  },
  "executable": false,
  "lamports": 1000000000,
  "owner": "11111111111111111111111111111111",
  "rentEpoch": 0,
  "space": 0
}
```

## !!steps

The `executable` field indicates whether the account's `data` field contains
executable program code. For wallet accounts this field is `false`.

<CodePlaceholder title="Example output" />

```json !! title="Example output"
{
  "data": {
    "type": "Buffer",
    "data": []
  },
  // !focus
  "executable": false,
  "lamports": 1000000000,
  "owner": "11111111111111111111111111111111",
  "rentEpoch": 0,
  "space": 0
}
```

## !!steps

The `lamports` field contains the account's SOL balance, in
[lamports](/docs/references/terminology#lamport).

<CodePlaceholder title="Example output" />

```json !! title="Example output"
{
  "data": {
    "type": "Buffer",
    "data": []
  },
  "executable": false,
  // !focus
  "lamports": 1000000000,
  "owner": "11111111111111111111111111111111",
  "rentEpoch": 0,
  "space": 0
}
```

## !!steps

The `owner` field shows the program that owns the account. For wallets, the
owner is always the System Program, with the address
`11111111111111111111111111111111`.

<CodePlaceholder title="Example output" />

```json !! title="Example output"
{
  "data": {
    "type": "Buffer",
    "data": []
  },
  "executable": false,
  "lamports": 1000000000,
  // !focus
  "owner": "11111111111111111111111111111111",
  "rentEpoch": 0,
  "space": 0
}
```

## !!steps

The `rentEpoch` field is a legacy field from a deprecated rent mechanism. (This
field is included for backward compatibility.)

<CodePlaceholder title="Example output" />

```json !! title="Example output"
{
  "data": {
    "type": "Buffer",
    "data": []
  },
  "executable": false,
  "lamports": 1000000000,
  "owner": "11111111111111111111111111111111",
  // !focus
  "rentEpoch": 0,
  "space": 0
}
```

## !!steps

The `space` field shows the number of bytes contained in the `data` field. This
is not a field in the [Account type](/docs/core/accounts#account-structure)
itself, but is included in the response.

In this example, the `space` field is 0 because the `data` field contains 0
bytes of data.

<CodePlaceholder title="Example output" />

```json !! title="Example output"
{
  "data": {
    "type": "Buffer",
    "data": []
  },
  "executable": false,
  "lamports": 1000000000,
  "owner": "11111111111111111111111111111111",
  "rentEpoch": 0,
  // !focus
  "space": 0
}
```

</ScrollyCoding>

## Fetch the Token Program

The example below fetches the Token Program to demonstrate the difference
between wallet and program accounts. The program account stores the compiled
bytecode for the Token Program's
[source code](https://github.com/solana-program/token/tree/main/program). You
can view this program account on the
[Solana Explorer](https://explorer.solana.com/address/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA).

<CodeTabs flags="r">

```ts !! title="Fetch program account"
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection(
  "https://api.mainnet.solana.com",
  "confirmed"
);
// !mark(1:2)
const address = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const accountInfo = await connection.getAccountInfo(address);

// !collapse(1:17) collapsed
console.log(
  JSON.stringify(
    accountInfo,
    (key, value) => {
      if (key === "data" && value && value.length > 1) {
        return [
          value[0],
          "...truncated, total bytes: " + value.length + "...",
          value[value.length - 1]
        ];
      }
      return value;
    },
    2
  )
);
```

</CodeTabs>

<ScrollyCoding>

## !!steps

The Token Program is an executable program account. Programs have the same
underlying fields as all [accounts](/docs/core/accounts#account-structure), but
with key differences.

<CodePlaceholder title="Token program account" />

```json !! title="Token program account"
{
  "data": {
    "type": "Buffer",
    "data": [127, "...truncated, total bytes: 134080...", 0]
  },
  "executable": true,
  "lamports": 4522329612,
  "owner": "BPFLoader2111111111111111111111111111111111",
  "rentEpoch": 18446744073709552000,
  "space": 134080
}
```

## !!steps

The `executable` field is set to `true`, which indicates that the account's
`data` field contains executable code.

<CodePlaceholder title="Token program account" />

```json !! title="Token program account"
{
  "data": {
    "type": "Buffer",
    "data": [127, "...truncated, total bytes: 134080...", 0]
  },
  // !focus
  "executable": true,
  "lamports": 4522329612,
  "owner": "BPFLoader2111111111111111111111111111111111",
  "rentEpoch": 18446744073709552000,
  "space": 134080
}
```

## !!steps

The `data` field stores the program's executable code.

<CodePlaceholder title="Token program account" />

```json !! title="Token program account"
{
  // !focus(1:4)
  "data": {
    "type": "Buffer",
    "data": [127, "...truncated, total bytes: 134080...", 0]
  },
  "executable": true,
  "lamports": 4522329612,
  "owner": "BPFLoader2111111111111111111111111111111111",
  "rentEpoch": 18446744073709552000,
  "space": 134080
}
```

## !!steps

Every program account is owned by its
[loader program](/docs/core/programs#loader-programs). In this example, the
`owner` is the BPFLoader2 program.

<CodePlaceholder title="Token program account" />

```json !! title="Token program account"
{
  "data": {
    "type": "Buffer",
    "data": [127, "...truncated, total bytes: 134080...", 0]
  },
  "executable": true,
  "lamports": 4522329612,
  // !focus
  "owner": "BPFLoader2111111111111111111111111111111111",
  "rentEpoch": 18446744073709552000,
  "space": 134080
}
```

</ScrollyCoding>

## Fetch a mint account

A
[mint account](https://github.com/solana-program/token/blob/program%40v8.0.0/program/src/state.rs#L16-L30)
is an account owned by the Token Program that stores global metadata for a
specific token. This includes the total supply, number of decimals, and the
accounts that are authorized to mint or freeze tokens. The mint account's
address uniquely identifies a token on the Solana network.

The example below fetches the USD Coin Mint account to demonstrate how a
program's state is stored in a separate account.

<CodeTabs flags="r">

```ts !! title="Fetch program account"
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection(
  "https://api.mainnet.solana.com",
  "confirmed"
);

// !mark(1:2)
const address = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const accountInfo = await connection.getAccountInfo(address);

// !collapse(1:17) collapsed
console.log(
  JSON.stringify(
    accountInfo,
    (key, value) => {
      if (key === "data" && value && value.length > 1) {
        return [
          value[0],
          "...truncated, total bytes: " + value.length + "...",
          value[value.length - 1]
        ];
      }
      return value;
    },
    2
  )
);
```

</CodeTabs>

<ScrollyCoding>

## !!steps

Mint accounts store state, not executable code. They are owned by the Token
Program, which includes instructions defining how to create and update mint
accounts.

<CodePlaceholder title="Mint account" />

```json !! title="Mint account"
{
  "data": {
    "type": "Buffer",
    "data": [1, "...truncated, total bytes: 82...", 103]
  },
  "executable": false,
  "lamports": 407438077149,
  "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "rentEpoch": 18446744073709552000,
  "space": 82
}
```

## !!steps

The mint account's `data` field stores state, not executable code, so the
`executable` field is `false`.

The Token Program defines the `Mint` data type, which is stored in the `data`
field.

<CodePlaceholder title="Mint account" />

```json !! title="Mint account"
{
  "data": {
    "type": "Buffer",
    "data": [1, "...truncated, total bytes: 82...", 103]
  },
  // !focus
  "executable": false,
  "lamports": 407438077149,
  "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "rentEpoch": 18446744073709552000,
  "space": 82
}
```

## !!steps

The `data` field contains the serialized `Mint` account state, such as the mint
authority, total supply, number of decimals.

To read from a Mint account, you must deserialize the `data` field into the
`Mint` data type, which is shown in the
[next example](#deserialize-mint-account).

<CodePlaceholder title="Mint account" />

```json !! title="Mint account"
{
  // !focus(1:4)
  "data": {
    "type": "Buffer",
    "data": [1, "...truncated, total bytes: 82...", 103]
  },
  "executable": false,
  "lamports": 407438077149,
  "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "rentEpoch": 18446744073709552000,
  "space": 82
}
```

## !!steps

The mint account is owned by the
[Token Program](/docs/references/terminology#token-program). This means that its
`data` field can only be modified by the Token Program' instructions.

<CodePlaceholder title="Mint Account" />

```json !! title="Mint Account"
{
  "data": {
    "type": "Buffer",
    "data": [1, "...truncated, total bytes: 82...", 103]
  },
  "executable": false,
  "lamports": 407438077149,
  // !focus
  "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "rentEpoch": 18446744073709552000,
  "space": 82
}
```

</ScrollyCoding>

## Deserialize mint account

Before the raw bytes in an account's `data` field can be interpreted
meaningfully they must be deserialized. The appropriate data type is defined by
the program that owns the account. Most Solana programs provide client libraries
with helper functions that abstract away the deserialization process. These
functions convert the raw account bytes into structured data types, making it
easier to work with the account data.

<WithMentions>

For example, the _shell`@solana/spl-token`_ library includes the
[_ts`getMint()`_](mention:one) function to help deserialize a mint account's
`data` field into the
[Mint](https://github.com/solana-program/token/blob/program%40v8.0.0/program/src/state.rs#L16-L30)
data type defined by the Token Program.

<CodeTabs flags="r">

```ts !! title="Deserialize mint account data"
import { PublicKey, Connection } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

const connection = new Connection(
  "https://api.mainnet.solana.com",
  "confirmed"
);

const address = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
// !mention one
const mintData = await getMint(connection, address, "confirmed");

// !collapse(1:17) collapsed
console.log(
  JSON.stringify(
    mintData,
    (key, value) => {
      // Convert BigInt to String
      if (typeof value === "bigint") {
        return value.toString();
      }
      // Handle Buffer objects
      if (Buffer.isBuffer(value)) {
        return `<Buffer ${value.toString("hex")}>`;
      }
      return value;
    },
    2
  )
);
```

</CodeTabs>

</WithMentions>

```rs title="Mint account type"
pub struct Mint {
    /// Optional authority used to mint new tokens. The mint authority may only
    /// be provided during mint creation. If no mint authority is present
    /// then the mint has a fixed supply and no further tokens may be
    /// minted.
    pub mint_authority: COption<Pubkey>,
    /// Total supply of tokens.
    pub supply: u64,
    /// Number of base 10 digits to the right of the decimal place.
    pub decimals: u8,
    /// Is `true` if this structure has been initialized
    pub is_initialized: bool,
    /// Optional authority to freeze token accounts.
    pub freeze_authority: COption<Pubkey>,
}
```

<ScrollyCoding>

## !!steps

The _ts`getMint()`_ function deserializes a mint account's `data` field into the
Mint account type.

```json title="Mint account"
{
  // !focus(1:4)
  "data": {
    "type": "Buffer",
    "data": [1, "...truncated, total bytes: 82...", 103]
  },
  "executable": false,
  "lamports": 407438077149,
  "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "rentEpoch": 18446744073709552000,
  "space": 82
}
```

You can view the fully deserialized
[mint account](https://explorer.solana.com/address/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v?cluster=mainnet-beta)
data on the Solana Explorer.

<CodePlaceholder title="Deserialized mint data" />

```json !! title="Deserialized mint data"
{
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  "supply": "8985397351591790",
  "decimals": 6,
  "isInitialized": true,
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  "tlvData": {
    "type": "Buffer",
    "data": []
  }
}
```

## !!steps

The `address` field contains the mint account's address.

<CodePlaceholder title="Deserialized mint data" />

```json !! title="Deserialized mint data"
{
  // !focus
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  "supply": "8985397351591790",
  "decimals": 6,
  "isInitialized": true,
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  "tlvData": {
    "type": "Buffer",
    "data": []
  }
}
```

## !!steps

The `mintAuthority` field shows the only account that can create new units of
the token.

<CodePlaceholder title="Deserialized mint data" />

```json !! title="Deserialized mint data"
{
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  // !focus
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  "supply": "8985397351591790",
  "decimals": 6,
  "isInitialized": true,
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  "tlvData": {
    "type": "Buffer",
    "data": []
  }
}
```

## !!steps

The `supply` field shows the total number of tokens that have been minted. This
value is measured in the smallest unit of the token. To get the total supply in
standard units, adjust the value of the `supply` field by the `decimals`.

<CodePlaceholder title="Deserialized mint data" />

```json !! title="Deserialized mint data"
{
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  // !focus
  "supply": "8985397351591790",
  "decimals": 6,
  "isInitialized": true,
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  "tlvData": {
    "type": "Buffer",
    "data": []
  }
}
```

## !!steps

The `decimals` field shows the number of decimal places for the token.

<CodePlaceholder title="Deserialized mint data" />

```json !! title="Deserialized mint data"
{
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  "supply": "8985397351591790",
  // !focus
  "decimals": 6,
  "isInitialized": true,
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  "tlvData": {
    "type": "Buffer",
    "data": []
  }
}
```

## !!steps

The `isInitialized` field indicates whether the mint account has been
initialized. This field is a security check used in the Token Program.

<CodePlaceholder title="Deserialized mint data" />

```json !! title="Deserialized mint data"
{
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  "supply": "8985397351591790",
  "decimals": 6,
  // !focus
  "isInitialized": true,
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  "tlvData": {
    "type": "Buffer",
    "data": []
  }
}
```

## !!steps

The `freezeAuthority` field shows the account with authority to freeze token
accounts. A frozen token account cannot transfer or burn the token it contains.

<CodePlaceholder title="Deserialized mint data" />

```json !! title="Deserialized mint data"
{
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  "supply": "8985397351591790",
  "decimals": 6,
  "isInitialized": true,
  // !focus
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  "tlvData": {
    "type": "Buffer",
    "data": []
  }
}
```

## !!steps

The `tlvData` field contains extra data for Token Extensions and requires
further deserialization. This field is only relevant to accounts created by the
[Token Extension Program](/docs/tokens/extensions) (Token2022).

<CodePlaceholder title="Deserialized mint data" />

```json !! title="Deserialized mint data"
{
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  "supply": "8985397351591790",
  "decimals": 6,
  "isInitialized": true,
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  // !focus(1:4)
  "tlvData": {
    "type": "Buffer",
    "data": []
  }
}
```

</ScrollyCoding>


---
title: Writing to the Network
description:
  Learn how to interact with the Solana network by sending transactions and
  instructions. Follow step-by-step examples to transfer SOL tokens and create
  new tokens using the System Program and Token Extensions Program.
---

In the previous section, you learned how to read data from the Solana network.
Now you'll learn how to write data to it. Writing to the Solana network involves
sending transactions that contain one or more instruction.

Programs define the business logic for what each
[instruction](/docs/core/instructions) does. When you submit a
[transaction](/docs/core/transactions), the Solana runtime executes each
instruction in sequence and atomically. The examples in this section show how to
build and send transactions to invoke Solana programs, they include:

1. Transferring SOL between accounts
2. Creating a new token

## Transfer SOL

The example below transfers SOL between two accounts. Each account has an owner
program, which is the only program that can deduct the account's SOL balance.

All wallet accounts are owned by the System Program. To transfer SOL, you must
invoke the System Program's
[transfer](https://github.com/anza-xyz/agave/blob/v2.1.11/programs/system/src/system_processor.rs#L183-L213)
instruction.

<WithNotes>

<CodeTabs flags="r">

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

// !tooltip[/connection/] connection
const connection = new Connection("http://localhost:8899", "confirmed");

// !tooltip[/sender/] sender
const sender = new Keypair();
// !tooltip[/receiver/] receiver
const receiver = new Keypair();

// !tooltip[/requestAirdrop/] airdrop
const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// !tooltip[/transferInstruction/] instruction
const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiver.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});

// !tooltip[/transaction/] transaction
const transaction = new Transaction().add(transferInstruction);

// !tooltip[/sendAndConfirmTransaction/] sendAndConfirmTransaction
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [sender]
);

console.log("Transaction Signature:", `${transactionSignature}`);

const senderBalance = await connection.getBalance(sender.publicKey);
const receiverBalance = await connection.getBalance(receiver.publicKey);

console.log("Sender Balance:", `${senderBalance}`);
console.log("Receiver Balance:", `${receiverBalance}`);
```

</CodeTabs>

### !connection

Create a connection to the a Solana cluster.

### !sender

Generate a new keypair to use as the `sender`.

### !receiver

Generate a new keypair to use as the `receiver`.

### !airdrop

Request an airdrop of SOL to fund the `sender`.

### !instruction

Build instruction to invoke the System Program's transfer instruction.

### !transaction

Create new transaction and add the transfer instruction.

### !sendAndConfirmTransaction

Send the transaction.

</WithNotes>

<ScrollyCoding>

## !!steps

Create a `Connection` to handle sending transactions and fetching account data.

In this example, we're connecting to the local test validator which runs on
`localhost:8899`.

```ts title="Connection"
const connection = new Connection("http://localhost:8899", "confirmed");
```

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

// !focus
const connection = new Connection("http://localhost:8899", "confirmed");
```

## !!steps

Generate new [keypairs](/docs/core/accounts#public-key) to use as the sender and
receiver accounts.

```ts title="Generate keypairs"
const sender = new Keypair();
const receiver = new Keypair();
```

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

// !focus(1:2)
const sender = new Keypair();
const receiver = new Keypair();
```

## !!steps

Add SOL to the sender account. On networks other than mainnet, you can use the
`requestAirdrop` method to get SOL for testing.

```ts title="Airdrop"
const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");
```

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

const sender = new Keypair();
const receiver = new Keypair();

// !focus(1:5)
const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");
```

## !!steps

<WithMentions>

The `SystemProgram.transfer()` method creates an instruction that transfers SOL
from the [`fromPubkey`](mention:from) account to the [`toPubkey`](mention:to)
account for the specified number of [`lamports`](mention:lamports).

```ts title="Transfer instruction"
const transferInstruction = SystemProgram.transfer({
  // !mention from
  fromPubkey: sender.publicKey,
  // !mention to
  toPubkey: receiver.publicKey,
  // !mention lamports
  lamports: 0.01 * LAMPORTS_PER_SOL
});
```

</WithMentions>

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

const sender = new Keypair();
const receiver = new Keypair();

const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// !focus(1:5)
const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiver.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});
```

## !!steps

Create a transaction and add the instruction to the transaction. In this
example, we're creating a transaction with a single instruction. However, you
can add multiple instructions to a transaction.

```ts title="Transaction"
const transaction = new Transaction().add(transferInstruction);
```

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

const sender = new Keypair();
const receiver = new Keypair();

const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiver.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});

// !focus
const transaction = new Transaction().add(transferInstruction);
```

## !!steps

<WithMentions>

Sign and send the [transaction](mention:transaction) to the network. The
[sender](mention:sender) keypair is required in the signers array to authorize
the transfer of SOL from their account.

```ts title="Send transaction"
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  // !mention transaction
  transaction,
  // !mention sender
  [sender]
);
```

</WithMentions>

The transaction signature is a unique identifier that can be used to look up the
transaction on Solana Explorer.

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

const sender = new Keypair();
const receiver = new Keypair();

const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiver.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});

const transaction = new Transaction().add(transferInstruction);

// !focus(1:6)
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [sender]
);

console.log("Transaction Signature:", `${transactionSignature}`);
```

</ScrollyCoding>

## Create a token

The example below creates a new token on Solana using the Token Extensions
Program. This requires two instructions:

1. Invoke the System Program to create a new account.
2. Invoke the Token Extensions Program to initialize that account as a Mint.

<WithNotes>

<CodeTabs flags="r">

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

// !tooltip[/wallet/] wallet
const wallet = new Keypair();
// Fund the wallet with SOL
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// Generate keypair to use as address of mint account
// !tooltip[/mint/] mint
const mint = new Keypair();

// Calculate lamports required for rent exemption
// !tooltip[/rentExemptionLamports/] rentExemptionLamports
const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

// Instruction to create new account with space for new mint account
// !tooltip[/createAccountInstruction/] createAccountInstruction
const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});

// Instruction to initialize mint account
// !tooltip[/initializeMintInstruction/] initializeMintInstruction
const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  2, // decimals
  wallet.publicKey, // mint authority
  wallet.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);

// Build transaction with instructions to create new account and initialize mint account
// !tooltip[/transaction/] transaction
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeMintInstruction
);

// !tooltip[/sendAndConfirmTransaction/] sendAndConfirmTransaction
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [
    wallet, // payer
    mint // mint address keypair
  ]
);

console.log("Transaction Signature:", `${transactionSignature}`);

const mintData = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
// !collapse(1:17) collapsed
console.log(
  "Mint Account:",
  JSON.stringify(
    mintData,
    (key, value) => {
      // Convert BigInt to String
      if (typeof value === "bigint") {
        return value.toString();
      }
      // Handle Buffer objects
      if (Buffer.isBuffer(value)) {
        return `<Buffer ${value.toString("hex")}>`;
      }
      return value;
    },
    2
  )
);
```

</CodeTabs>

### !wallet

Generate a new keypair to use as the wallet.

### !mint

Generate a new keypair to use as the address of the Mint account to create.

### !rentLamports

Calculate the lamports required for a Mint account.

### !rentExemptionLamports

Calculate the lamports required for rent exemption

### !createAccountInstruction

Build instruction to create a new account with space for the Mint account type
and owned by the Token Extensions Program.

### !initializeMintInstruction

Build instruction to initialize the data of the new account as a Mint account
type.

### !transaction

Create new transaction and add both instructions.

The order of instructions matters here. The `createAccountInstruction` must come
before the `initializeMintInstruction`.

### !sendAndConfirmTransaction

Send the transaction.

</WithNotes>

<ScrollyCoding>

## !!steps

Creating a token requires using both the `@solana/web3.js` and
`@solana/spl-token` libraries. The code in the example below will:

<WithMentions>

- [Create a connection](mention:connection)
- [Generate a keypair](mention:wallet) to pay for the transaction
- [Request an airdrop](mention:airdrop) to fund the keypair

```ts title="Connection & wallet setup"
// !mention connection
const connection = new Connection("http://localhost:8899", "confirmed");

// !mention wallet
const wallet = new Keypair();
// !mention(1:4) airdrop
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");
```

</WithMentions>

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

// !focus(1:8)
const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");
```

## !!steps

Generate a keypair for the mint account. The public key will be used as the mint
account's address.

```ts title="Mint keypair"
const mint = new Keypair();
```

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// !focus
const mint = new Keypair();
```

## !!steps

Calculate the minimum lamports required for a mint account. The
`getMinimumBalanceForRentExemptMint` function calculates how many lamport must
be allocated for the data on a mint account.

```ts title="Rent exemption"
const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);
```

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

// !focus(1:2)
const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);
```

## !!steps

<WithMentions>

The first instruction invokes the System Program's `createAccount` instruction
to:

1. Allocate the [number of bytes](mention:space) needed to store the mint data.
2. [Transfer lamports](mention:lamports) from the wallet to fund the new
   account.
3. [Assign ownership](mention:programId) of the account to the
   [Token Extensions program](/docs/tokens/extensions).

```ts title="Create account instruction"
const createAccountInstruction = SystemProgram.createAccount({
  // !mention(1:2) lamports
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  // !mention space
  space: MINT_SIZE,
  // !mention lamports
  lamports: rentExemptionLamports,
  // !mention programId
  programId: TOKEN_2022_PROGRAM_ID
});
```

</WithMentions>

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

// !focus(1:7)
const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});
```

## !!steps

<WithMentions>

The second instruction invokes the
[Token Extensions Program](mention:programId)'s
`createInitializeMint2Instruction` instruction to initialize the mint account
with the following data:

- [2 decimals](mention:decimals)
- [Wallet](mention:authority) as both mint authority and freeze authority

```ts title="Initialize mint instruction"
const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  // !mention decimals
  2,
  // !mention authority
  wallet.publicKey,
  // !mention authority
  wallet.publicKey,
  // !mention programId
  TOKEN_2022_PROGRAM_ID
);
```

</WithMentions>

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});

// !focus(1:6)
const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  2, // decimals
  wallet.publicKey, // mint authority
  wallet.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);
```

## !!steps

Add both instructions to a single transaction. This ensures that account
creation and initialization happen atomically. (Either both instructions
succeed, or neither does.)

This approach is common when building complex Solana transactions, as it
guarantees that all instructions execute together.

```ts title="Transaction"
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeMintInstruction
);
```

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});

const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  2, // decimals
  wallet.publicKey, // mint authority
  wallet.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);

// !focus(1:4)
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeMintInstruction
);
```

## !!steps

<WithMentions>

Sign and send the transaction. Two signatures are required:

- The [wallet](mention:wallet) account signs as the payer for
  [transaction fees](/docs/core/fees) and account creation
- The [mint](mention:mint) account signs to authorize the use of its address for
  the new account

```ts title="Send transaction"
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [
    // !mention wallet
    wallet,
    // !mention mint
    mint
  ]
);
```

The transaction signature returned can be used to inspect the transaction on
Solana Explorer.

</WithMentions>

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});

const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  2, // decimals
  wallet.publicKey, // mint authority
  wallet.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);

const transaction = new Transaction().add(
  createAccountInstruction,
  initializeMintInstruction
);

// !focus(1:9)
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [
    wallet, // payer
    mint // mint address keypair
  ]
);

console.log("Transaction Signature:", `${transactionSignature}`);
```

</ScrollyCoding>

---
title: Writing to the Network
description:
  Learn how to interact with the Solana network by sending transactions and
  instructions. Follow step-by-step examples to transfer SOL tokens and create
  new tokens using the System Program and Token Extensions Program.
---

In the previous section, you learned how to read data from the Solana network.
Now you'll learn how to write data to it. Writing to the Solana network involves
sending transactions that contain one or more instruction.

Programs define the business logic for what each
[instruction](/docs/core/instructions) does. When you submit a
[transaction](/docs/core/transactions), the Solana runtime executes each
instruction in sequence and atomically. The examples in this section show how to
build and send transactions to invoke Solana programs, they include:

1. Transferring SOL between accounts
2. Creating a new token

## Transfer SOL

The example below transfers SOL between two accounts. Each account has an owner
program, which is the only program that can deduct the account's SOL balance.

All wallet accounts are owned by the System Program. To transfer SOL, you must
invoke the System Program's
[transfer](https://github.com/anza-xyz/agave/blob/v2.1.11/programs/system/src/system_processor.rs#L183-L213)
instruction.

<WithNotes>

<CodeTabs flags="r">

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

// !tooltip[/connection/] connection
const connection = new Connection("http://localhost:8899", "confirmed");

// !tooltip[/sender/] sender
const sender = new Keypair();
// !tooltip[/receiver/] receiver
const receiver = new Keypair();

// !tooltip[/requestAirdrop/] airdrop
const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// !tooltip[/transferInstruction/] instruction
const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiver.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});

// !tooltip[/transaction/] transaction
const transaction = new Transaction().add(transferInstruction);

// !tooltip[/sendAndConfirmTransaction/] sendAndConfirmTransaction
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [sender]
);

console.log("Transaction Signature:", `${transactionSignature}`);

const senderBalance = await connection.getBalance(sender.publicKey);
const receiverBalance = await connection.getBalance(receiver.publicKey);

console.log("Sender Balance:", `${senderBalance}`);
console.log("Receiver Balance:", `${receiverBalance}`);
```

</CodeTabs>

### !connection

Create a connection to the a Solana cluster.

### !sender

Generate a new keypair to use as the `sender`.

### !receiver

Generate a new keypair to use as the `receiver`.

### !airdrop

Request an airdrop of SOL to fund the `sender`.

### !instruction

Build instruction to invoke the System Program's transfer instruction.

### !transaction

Create new transaction and add the transfer instruction.

### !sendAndConfirmTransaction

Send the transaction.

</WithNotes>

<ScrollyCoding>

## !!steps

Create a `Connection` to handle sending transactions and fetching account data.

In this example, we're connecting to the local test validator which runs on
`localhost:8899`.

```ts title="Connection"
const connection = new Connection("http://localhost:8899", "confirmed");
```

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

// !focus
const connection = new Connection("http://localhost:8899", "confirmed");
```

## !!steps

Generate new [keypairs](/docs/core/accounts#public-key) to use as the sender and
receiver accounts.

```ts title="Generate keypairs"
const sender = new Keypair();
const receiver = new Keypair();
```

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

// !focus(1:2)
const sender = new Keypair();
const receiver = new Keypair();
```

## !!steps

Add SOL to the sender account. On networks other than mainnet, you can use the
`requestAirdrop` method to get SOL for testing.

```ts title="Airdrop"
const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");
```

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

const sender = new Keypair();
const receiver = new Keypair();

// !focus(1:5)
const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");
```

## !!steps

<WithMentions>

The `SystemProgram.transfer()` method creates an instruction that transfers SOL
from the [`fromPubkey`](mention:from) account to the [`toPubkey`](mention:to)
account for the specified number of [`lamports`](mention:lamports).

```ts title="Transfer instruction"
const transferInstruction = SystemProgram.transfer({
  // !mention from
  fromPubkey: sender.publicKey,
  // !mention to
  toPubkey: receiver.publicKey,
  // !mention lamports
  lamports: 0.01 * LAMPORTS_PER_SOL
});
```

</WithMentions>

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

const sender = new Keypair();
const receiver = new Keypair();

const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// !focus(1:5)
const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiver.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});
```

## !!steps

Create a transaction and add the instruction to the transaction. In this
example, we're creating a transaction with a single instruction. However, you
can add multiple instructions to a transaction.

```ts title="Transaction"
const transaction = new Transaction().add(transferInstruction);
```

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

const sender = new Keypair();
const receiver = new Keypair();

const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiver.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});

// !focus
const transaction = new Transaction().add(transferInstruction);
```

## !!steps

<WithMentions>

Sign and send the [transaction](mention:transaction) to the network. The
[sender](mention:sender) keypair is required in the signers array to authorize
the transfer of SOL from their account.

```ts title="Send transaction"
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  // !mention transaction
  transaction,
  // !mention sender
  [sender]
);
```

</WithMentions>

The transaction signature is a unique identifier that can be used to look up the
transaction on Solana Explorer.

```ts !! title="Transfer SOL"
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection
} from "@solana/web3.js";

const connection = new Connection("http://localhost:8899", "confirmed");

const sender = new Keypair();
const receiver = new Keypair();

const signature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiver.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});

const transaction = new Transaction().add(transferInstruction);

// !focus(1:6)
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [sender]
);

console.log("Transaction Signature:", `${transactionSignature}`);
```

</ScrollyCoding>

## Create a token

The example below creates a new token on Solana using the Token Extensions
Program. This requires two instructions:

1. Invoke the System Program to create a new account.
2. Invoke the Token Extensions Program to initialize that account as a Mint.

<WithNotes>

<CodeTabs flags="r">

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

// !tooltip[/wallet/] wallet
const wallet = new Keypair();
// Fund the wallet with SOL
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// Generate keypair to use as address of mint account
// !tooltip[/mint/] mint
const mint = new Keypair();

// Calculate lamports required for rent exemption
// !tooltip[/rentExemptionLamports/] rentExemptionLamports
const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

// Instruction to create new account with space for new mint account
// !tooltip[/createAccountInstruction/] createAccountInstruction
const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});

// Instruction to initialize mint account
// !tooltip[/initializeMintInstruction/] initializeMintInstruction
const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  2, // decimals
  wallet.publicKey, // mint authority
  wallet.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);

// Build transaction with instructions to create new account and initialize mint account
// !tooltip[/transaction/] transaction
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeMintInstruction
);

// !tooltip[/sendAndConfirmTransaction/] sendAndConfirmTransaction
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [
    wallet, // payer
    mint // mint address keypair
  ]
);

console.log("Transaction Signature:", `${transactionSignature}`);

const mintData = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
// !collapse(1:17) collapsed
console.log(
  "Mint Account:",
  JSON.stringify(
    mintData,
    (key, value) => {
      // Convert BigInt to String
      if (typeof value === "bigint") {
        return value.toString();
      }
      // Handle Buffer objects
      if (Buffer.isBuffer(value)) {
        return `<Buffer ${value.toString("hex")}>`;
      }
      return value;
    },
    2
  )
);
```

</CodeTabs>

### !wallet

Generate a new keypair to use as the wallet.

### !mint

Generate a new keypair to use as the address of the Mint account to create.

### !rentLamports

Calculate the lamports required for a Mint account.

### !rentExemptionLamports

Calculate the lamports required for rent exemption

### !createAccountInstruction

Build instruction to create a new account with space for the Mint account type
and owned by the Token Extensions Program.

### !initializeMintInstruction

Build instruction to initialize the data of the new account as a Mint account
type.

### !transaction

Create new transaction and add both instructions.

The order of instructions matters here. The `createAccountInstruction` must come
before the `initializeMintInstruction`.

### !sendAndConfirmTransaction

Send the transaction.

</WithNotes>

<ScrollyCoding>

## !!steps

Creating a token requires using both the `@solana/web3.js` and
`@solana/spl-token` libraries. The code in the example below will:

<WithMentions>

- [Create a connection](mention:connection)
- [Generate a keypair](mention:wallet) to pay for the transaction
- [Request an airdrop](mention:airdrop) to fund the keypair

```ts title="Connection & wallet setup"
// !mention connection
const connection = new Connection("http://localhost:8899", "confirmed");

// !mention wallet
const wallet = new Keypair();
// !mention(1:4) airdrop
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");
```

</WithMentions>

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

// !focus(1:8)
const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");
```

## !!steps

Generate a keypair for the mint account. The public key will be used as the mint
account's address.

```ts title="Mint keypair"
const mint = new Keypair();
```

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

// !focus
const mint = new Keypair();
```

## !!steps

Calculate the minimum lamports required for a mint account. The
`getMinimumBalanceForRentExemptMint` function calculates how many lamport must
be allocated for the data on a mint account.

```ts title="Rent exemption"
const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);
```

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

// !focus(1:2)
const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);
```

## !!steps

<WithMentions>

The first instruction invokes the System Program's `createAccount` instruction
to:

1. Allocate the [number of bytes](mention:space) needed to store the mint data.
2. [Transfer lamports](mention:lamports) from the wallet to fund the new
   account.
3. [Assign ownership](mention:programId) of the account to the
   [Token Extensions program](/docs/tokens/extensions).

```ts title="Create account instruction"
const createAccountInstruction = SystemProgram.createAccount({
  // !mention(1:2) lamports
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  // !mention space
  space: MINT_SIZE,
  // !mention lamports
  lamports: rentExemptionLamports,
  // !mention programId
  programId: TOKEN_2022_PROGRAM_ID
});
```

</WithMentions>

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

// !focus(1:7)
const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});
```

## !!steps

<WithMentions>

The second instruction invokes the
[Token Extensions Program](mention:programId)'s
`createInitializeMint2Instruction` instruction to initialize the mint account
with the following data:

- [2 decimals](mention:decimals)
- [Wallet](mention:authority) as both mint authority and freeze authority

```ts title="Initialize mint instruction"
const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  // !mention decimals
  2,
  // !mention authority
  wallet.publicKey,
  // !mention authority
  wallet.publicKey,
  // !mention programId
  TOKEN_2022_PROGRAM_ID
);
```

</WithMentions>

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});

// !focus(1:6)
const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  2, // decimals
  wallet.publicKey, // mint authority
  wallet.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);
```

## !!steps

Add both instructions to a single transaction. This ensures that account
creation and initialization happen atomically. (Either both instructions
succeed, or neither does.)

This approach is common when building complex Solana transactions, as it
guarantees that all instructions execute together.

```ts title="Transaction"
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeMintInstruction
);
```

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});

const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  2, // decimals
  wallet.publicKey, // mint authority
  wallet.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);

// !focus(1:4)
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeMintInstruction
);
```

## !!steps

<WithMentions>

Sign and send the transaction. Two signatures are required:

- The [wallet](mention:wallet) account signs as the payer for
  [transaction fees](/docs/core/fees) and account creation
- The [mint](mention:mint) account signs to authorize the use of its address for
  the new account

```ts title="Send transaction"
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [
    // !mention wallet
    wallet,
    // !mention mint
    mint
  ]
);
```

The transaction signature returned can be used to inspect the transaction on
Solana Explorer.

</WithMentions>

```ts !! title="Create mint account"
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const wallet = new Keypair();
const signature = await connection.requestAirdrop(
  wallet.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(signature, "confirmed");

const mint = new Keypair();

const rentExemptionLamports =
  await getMinimumBalanceForRentExemptMint(connection);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: mint.publicKey,
  space: MINT_SIZE,
  lamports: rentExemptionLamports,
  programId: TOKEN_2022_PROGRAM_ID
});

const initializeMintInstruction = createInitializeMint2Instruction(
  mint.publicKey,
  2, // decimals
  wallet.publicKey, // mint authority
  wallet.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);

const transaction = new Transaction().add(
  createAccountInstruction,
  initializeMintInstruction
);

// !focus(1:9)
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [
    wallet, // payer
    mint // mint address keypair
  ]
);

console.log("Transaction Signature:", `${transactionSignature}`);
```

</ScrollyCoding>

---
title: Creating Deterministic Accounts
description:
  Learn how to build a CRUD (Create, Read, Update, Delete) Solana program using
  Program Derived Addresses (PDAs) and the Anchor framework. This step-by-step
  guide demonstrates how to create, update, and delete on-chain message accounts
  using PDAs, implement account validation, and write tests. Perfect for
  developers looking to understand how to use PDAs in Solana programs.
h1: Program Derived Address
---

In this section, you'll learn how to build a basic Create, Read, Update, Delete
(CRUD) program.

This guide demonstrates a simple program where users can create, update, and
delete a message. Each message exists in an account with a deterministic address
derived from the program itself (Program Derived Address or PDA).

This guide walks you through building and testing a Solana program using the
Anchor framework while demonstrating Program Derived Addresses (PDAs). For more
details, refer to the [Program Derived Addresses](/docs/core/pda) page.

For reference, you can view the
[final code](https://beta.solpg.io/668304cfcffcf4b13384d20a) after completing
both the PDA and Cross-Program Invocation (CPI) sections.

<Steps>
<Step>

### Starter Code

Start by opening this
[Solana Playground link](https://beta.solpg.io/66734b7bcffcf4b13384d1ad) with
the starter code. Then click the "Import" button to add the program to your
Solana Playground projects.

![Import](/assets/docs/intro/quickstart/pg-import.png)

<WithMentions>

In the `lib.rs` file, you'll find a program with the [`create`](mention:one),
[`update`](mention:two), and [`delete`](mention:three) instructions to add in
the following steps.

```rs title="lib.rs"
use anchor_lang::prelude::*;

declare_id!("8KPzbM2Cwn4Yjak7QYAEH9wyoQh86NcBicaLuzPaejdw");

#[program]
pub mod pda {
    use super::*;

    // !mention one
    pub fn create(_ctx: Context<Create>) -> Result<()> {
        Ok(())
    }

    // !mention two
    pub fn update(_ctx: Context<Update>) -> Result<()> {
        Ok(())
    }

    // !mention three
    pub fn delete(_ctx: Context<Delete>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Create {}

#[derive(Accounts)]
pub struct Update {}

#[derive(Accounts)]
pub struct Delete {}

#[account]
pub struct MessageAccount {}
```

</WithMentions>

Before beginning, run _shell`build`_ in the Playground terminal to check the
starter program builds successfully.

```terminal
$ build
Building...
Build successful. Completed in 3.50s.
```

</Step>
<Step>

### Define Message Account Type

First, define the structure for the message account that the program creates.
This structure defines the data to store in the account created by the program.

<WithNotes>

In `lib.rs`, update the _rs`MessageAccount`_ struct with the following:

```rs title="lib.rs"
// !tooltip[/account/] account
#[account]
pub struct MessageAccount {
    // !tooltip[/user/] user
    pub user: Pubkey,
    // !tooltip[/message/] message
    pub message: String,
    // !tooltip[/bump/] bump
    pub bump: u8,
}
```

### !account

The _rs`#[account]`_ attribute in an Anchor program annotates structs that
represent account data (data type to store in the Account's data field).

### !user

The _rs`user`_ field contains a _rs`Pubkey`_ that identifies the user who
created the message account.

### !message

The _rs`message`_ field holds a _rs`String`_ containing the user's message.

### !bump

The _rs`bump`_ field stores a _rs`u8`_
["bump" seed](/docs/core/pda#canonical-bump) used to derive a program derived
address (PDA). Storing this value saves compute by eliminating the need to
recalculate it in later instructions.

</WithNotes>

<Accordions>
<Accordion title="Diff">

```diff
- #[account]
- pub struct MessageAccount {}

+ #[account]
+ pub struct MessageAccount {
+    pub user: Pubkey,
+    pub message: String,
+    pub bump: u8,
+ }
```

</Accordion>
<Accordion title="Explanation">

The _rs`#[account]`_ attribute in an Anchor program annotates structs that
represent account data (data type to store in the Account's data field).

In this example, the _rs`MessageAccount`_ struct stores a message created by
users that contains three fields:

- `user` - _rs`Pubkey`_ that identifies the user who created the message
  account.
- `message` - _rs`String`_ that contains the user's message.
- `bump` - _rs`u8`_ that stores the ["bump" seed](/docs/core/pda#canonical-bump)
  for deriving the program derived address (PDA). Storing this value saves
  compute by eliminating the need to recalculate it in later instructions.

When creating an account, the program serializes the _rs`MessageAccount`_ data
and stores it in the new account's data field.

Later, when reading from the account, the program deserializes this data back
into the _rs`MessageAccount`_ data type. The testing section demonstrates the
process of creating and reading account data.

</Accordion>
</Accordions>

Build the program again by running _shell`build`_ in the terminal.

```terminal
$ build
```

This code defines what data to store on the message account. Next, you'll add
the program instructions.

</Step>
<Step>

### Add Create Instruction

Now, add the _rs`create`_ instruction that creates and initializes the
_rs`MessageAccount`_.

Start by defining the accounts required for the instruction by updating the
_rs`Create`_ struct with the following:

<WithNotes>

```rs title="lib.rs"
#[derive(Accounts)]
// !tooltip[/instruction/] instruction
#[instruction(message: String)]
pub struct Create<'info> {
    // !tooltip[/mut/] mut
    #[account(mut)]
    // !tooltip[/Signer<'info>/] signer
    pub user: Signer<'info>,

    #[account(
        // !tooltip[/init/] init
        init,
        // !tooltip[/seeds/] seeds
        seeds = [b"message", user.key().as_ref()],
        // !tooltip[/bump/] bump
        bump,
        // !tooltip[/payer/] payer
        payer = user,
        // !tooltip[/space/] space
        space = 8 + 32 + 4 + message.len() + 1
    )]
    // !tooltip[/Account<'info, MessageAccount>/] account
    pub message_account: Account<'info, MessageAccount>,
    // !tooltip[/Program<'info, System>/] program
    pub system_program: Program<'info, System>,
}
```

### !mut

The _rs`mut`_ constraint declares the account as mutable.

### !init

The _rs`init`_ constraint creates a new account.

### !seeds

The _rs`seeds`_ constraint defines the optional inputs used to derive the PDA.

### !bump

The _rs`bump`_ constraint declares the bump seed for the PDA.

If you don't specify a value, Anchor automatically calculates it.

### !payer

The _rs`payer`_ constraint specifies which account pays for the new account
creation.

### !space

The _rs`space`_ constraint specifies the number of bytes to assign for the new
account's data field.

### !signer

The _rs`Signer<'info>`_ type requires that the account sign the transaction.

### !account

The _rs`Account<'info, T>`_ type requires that the account match the specified
type.

In this case, the account must match the custom _rs`MessageAccount`_ type.

### !program

The _rs`Program<'info, T>`_ type requires the account to match a program.

In this case, the account must match the _rs`System`_ type, which refers to the
System Program.

### !instruction

The _rs`#[instruction(message: String)]`_ annotation lets the _rs`Create`_
struct access the _rs`message`_ parameter from the `create` instruction.

</WithNotes>

<Accordions>
<Accordion title="Diff">

```diff
- #[derive(Accounts)]
- pub struct Create {}

+ #[derive(Accounts)]
+ #[instruction(message: String)]
+ pub struct Create<'info> {
+     #[account(mut)]
+     pub user: Signer<'info>,
+
+     #[account(
+         init,
+         seeds = [b"message", user.key().as_ref()],
+         bump,
+         payer = user,
+         space = 8 + 32 + 4 + message.len() + 1
+     )]
+     pub message_account: Account<'info, MessageAccount>,
+     pub system_program: Program<'info, System>,
+ }
```

</Accordion>
<Accordion title="Explanation">

The _rs`#[derive(Accounts)]`_ attribute in an Anchor program annotates structs
that define the accounts required by an instruction.

Each field in the struct represents an account validated in two ways:

1. The account type (like _rs`Signer<'info>`_ or _rs`Account<'info, T>`_) that
   specifies what kind of account the program expects
2. Optional constraints (like _rs`#[account(mut)]`_ or _rs`#[account(init)]`_)
   that define extra requirements

Together, these enable Anchor to automatically verify accounts passed to the
instruction and secure the program.

The field names in the struct provide access to the accounts in your program
code, but don't affect validation. You should use descriptive names for clarity.

In this example, the _rs`Create`_ struct defines the accounts required for the
_rs`create`_ instruction.

1. _rs`user: Signer<'info>`_
   - Represents the user creating the message account
   - Needs mutable status (_rs`#[account(mut)]`_) since it pays for the new
     account
   - Must sign the transaction to approve lamport deduction from this account

2. _rs`message_account: Account<'info, MessageAccount>`_
   - The new account that stores the user's message
   - `init` constraint creates the account during instruction execution
   - `seeds` and `bump` constraints derive the account address as a Program
     Derived Address (PDA)
   - `payer = user` identifies who pays for the creation of the new account
   - `space` allocates the required bytes for the account's data field

3. _rs`system_program: Program<'info, System>`_
   - Necessary for account creation
   - Behind the scenes, the `init` constraint calls the System Program to create
     a new account with the specified `space` and changes the owner to the
     current program.

---

The _rs`#[instruction(message: String)]`_ annotation lets the _rs`Create`_
struct access the _rs`message`_ parameter from the `create` instruction.

---

The `seeds` and `bump` constraints together define an account's address as a
Program Derived Address (PDA).

```rs title="lib.rs"
seeds = [b"message", user.key().as_ref()],
bump,
```

The `seeds` constraint defines the optional inputs used to derive the PDA.

- _rs`b"message"`_ - A fixed string as the first seed.
- _rs`user.key().as_ref()`_ - The public key of the _rs`user`_ account as the
  second seed.

The `bump` constraint tells Anchor to automatically find and use the correct
bump seed. Anchor uses the `seeds` and `bump` to derive the PDA.

---

The `space` calculation _rs`(8 + 32 + 4 + message.len() + 1)`_ allocates space
for `MessageAccount` data type:

- Anchor Account discriminator (identifier): 8 bytes
- User Address (_rs`Pubkey`_): 32 bytes
- User Message (_rs`String`_): 4 bytes for length + variable message length
- PDA Bump seed (_rs`u8`_): 1 byte

```rs title="lib.rs"
#[account]
pub struct MessageAccount {
    pub user: Pubkey,
    pub message: String,
    pub bump: u8,
}
```

All accounts created through an Anchor program need 8 bytes for an account
discriminator, which serves as an identifier for the account type that Anchor
automatically generates when creating the account.

A _rs`String`_ type needs 4 bytes to store the length of the string, and the
remaining length contains the actual data.

</Accordion>
</Accordions>

Next, add the business logic for the _rs`create`_ instruction by updating the
`create` function with the following:

```rs title="lib.rs"
pub fn create(ctx: Context<Create>, message: String) -> Result<()> {
    msg!("Create Message: {}", message);
    let account_data = &mut ctx.accounts.message_account;
    account_data.user = ctx.accounts.user.key();
    account_data.message = message;
    account_data.bump = ctx.bumps.message_account;
    Ok(())
}
```

<Accordions>
<Accordion title="Diff">

```diff
- pub fn create(_ctx: Context<Create>) -> Result<()> {
-     Ok(())
- }

+ pub fn create(ctx: Context<Create>, message: String) -> Result<()> {
+     msg!("Create Message: {}", message);
+     let account_data = &mut ctx.accounts.message_account;
+     account_data.user = ctx.accounts.user.key();
+     account_data.message = message;
+     account_data.bump = ctx.bumps.message_account;
+     Ok(())
+ }
```

</Accordion>
<Accordion title="Explanation">

The `create` function implements the logic for initializing a new message
account's data. It takes two parameters:

1. _rs`ctx: Context<Create>`_ - Provides access to the accounts specified in the
   _rs`Create`_ struct.
2. _rs`message: String`_ - The user's message for storage.

The body of the function then performs the following logic:

1. Print a message to program logs using the _rs`msg!()`_ macro.

   ```rs
   msg!("Create Message: {}", message);
   ```

2. Initializing Account Data:
   - Accesses the `message_account` from the context.

   ```rs
   let account_data = &mut ctx.accounts.message_account;
   ```

   - Sets the `user` field to the public key of the `user` account.

   ```rs
   account_data.user = ctx.accounts.user.key();
   ```

   - Sets the `message` field to the `message` from the function argument.

   ```rs
   account_data.message = message;
   ```

   - Sets the `bump` value used to derive the PDA, retrieved from
     `ctx.bumps.message_account`.

   ```rs
   account_data.bump = ctx.bumps.message_account;
   ```

</Accordion>
</Accordions>

Rebuild the program.

```terminal
$ build
```

</Step>
<Step>

### Add Update Instruction

Next, add the `update` instruction to change the `MessageAccount` with a new
message.

Like the previous step, first specify the accounts required by the `update`
instruction.

Update the `Update` struct with the following:

<WithNotes>

```rs title="lib.rs"
#[derive(Accounts)]
#[instruction(message: String)]
pub struct Update<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"message", user.key().as_ref()],
        bump = message_account.bump,
        // !tooltip[/realloc/] realloc
        realloc = 8 + 32 + 4 + message.len() + 1,
        // !tooltip[/realloc::payer/] realloc::payer
        realloc::payer = user,
        // !tooltip[/realloc::zero/] realloc::zero
        realloc::zero = true,
    )]
    pub message_account: Account<'info, MessageAccount>,
    pub system_program: Program<'info, System>,
}
```

### !realloc

The _rs`realloc`_ constraint reallocates the account's data.

### !realloc::payer

The _rs`realloc::payer`_ constraint specifies the account paying for the
reallocation.

### !realloc::zero

The _rs`realloc::zero`_ constraint zeros out the account's data.

</WithNotes>

<Accordions>
<Accordion title="Diff">

```diff
- #[derive(Accounts)]
- pub struct Update {}

+ #[derive(Accounts)]
+ #[instruction(message: String)]
+ pub struct Update<'info> {
+     #[account(mut)]
+     pub user: Signer<'info>,
+
+     #[account(
+         mut,
+         seeds = [b"message", user.key().as_ref()],
+         bump = message_account.bump,
+         realloc = 8 + 32 + 4 + message.len() + 1,
+         realloc::payer = user,
+         realloc::zero = true,
+     )]
+     pub message_account: Account<'info, MessageAccount>,
+     pub system_program: Program<'info, System>,
+ }
```

</Accordion>
<Accordion title="Explanation">

The _rs`Update`_ struct defines the accounts required for the _rs`update`_
instruction.

1. _rs`user: Signer<'info>`_
   - Represents the user updating the message account
   - Marked as mutable (_rs`#[account(mut)]`_) as it might pay for more space
     for the `message_account` when needed
   - Must sign the transaction

2. _rs`message_account: Account<'info, MessageAccount>`_
   - The existing account storing the user's message for updating
   - `mut` constraint indicates data modification for this account
   - `realloc` constraint allows resizing of the account's data
   - `seeds` and `bump` constraints verify the account as the correct PDA

3. _rs`system_program: Program<'info, System>`_
   - Required for potential reallocation of account space
   - The `realloc` constraint invokes the System Program to adjust the account's
     data size

Note that the _rs`bump = message_account.bump`_ constraint uses the bump seed
stored on the _rs`message_account`_, rather than having Anchor recalculate it.

The _rs`#[instruction(message: String)]`_ attribute enables the _rs`Update`_
struct to access the _rs`message`_ parameter from the _rs`update`_ instruction.

</Accordion>
</Accordions>

Next, add the logic for the `update` instruction.

```rs title="lib.rs"
pub fn update(ctx: Context<Update>, message: String) -> Result<()> {
    msg!("Update Message: {}", message);
    let account_data = &mut ctx.accounts.message_account;
    account_data.message = message;
    Ok(())
}
```

<Accordions>
<Accordion title="Diff">

```diff
- pub fn update(_ctx: Context<Update>) -> Result<()> {
-     Ok(())
- }

+ pub fn update(ctx: Context<Update>, message: String) -> Result<()> {
+     msg!("Update Message: {}", message);
+     let account_data = &mut ctx.accounts.message_account;
+     account_data.message = message;
+     Ok(())
+ }
```

</Accordion>
<Accordion title="Explanation">

The `update` function implements the logic for modifying an existing message
account. It takes two parameters:

1. _rs`ctx: Context<Update>`_ - Provides access to the accounts specified in the
   _rs`Update`_ struct.
2. _rs`message: String`_ - The new message to replace the existing one.

The body of the function then:

1. Print a message to program logs using the _rs`msg!()`_ macro.

2. Updates Account Data:
   - Accesses the `message_account` from the context.
   - Sets the `message` field to the new `message` from the function argument.

</Accordion>
</Accordions>

Rebuild the program

```terminal
$ build
```

</Step>
<Step>

### Add Delete Instruction

Next, add the _rs`delete`_ instruction to close the _rs`MessageAccount`_.

Update the _rs`Delete`_ struct with the following:

<WithNotes>

```rs title="lib.rs"
#[derive(Accounts)]
pub struct Delete<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        // !tooltip[/seeds/] seeds
        seeds = [b"message", user.key().as_ref()],
        // !tooltip[/bump/] bump
        bump = message_account.bump,
        // !tooltip[/close/] close
        close = user,
    )]
    pub message_account: Account<'info, MessageAccount>,
}
```

### !seeds

The _rs`seeds`_ constraint specifies the seeds used to derive the PDA.

### !bump

The _rs`bump`_ constraint specifies the bump seed for the PDA.

In this case, the program uses the existing bump seed stored on the
_rs`message_account`_.

### !close

The _rs`close`_ constraint closes the account.

In this case, the _rs`user`_ account receives the lamports from the closed
_rs`message_account`_.

</WithNotes>

<Accordions>
<Accordion title="Diff">

```diff
- #[derive(Accounts)]
- pub struct Delete {}

+ #[derive(Accounts)]
+ pub struct Delete<'info> {
+     #[account(mut)]
+     pub user: Signer<'info>,
+
+     #[account(
+         mut,
+         seeds = [b"message", user.key().as_ref()],
+         bump = message_account.bump,
+         close = user,
+     )]
+     pub message_account: Account<'info, MessageAccount>,
+ }
```

</Accordion>
<Accordion title="Explanation">

The _rs`Delete`_ struct defines the accounts required for the _rs`delete`_
instruction:

1. _rs`user: Signer<'info>`_
   - Represents the user closing the message account
   - Marked as mutable (_rs`#[account(mut)]`_) to receive the lamports from the
     closed account
   - Must sign to ensure only the correct user can close their message account

2. _rs`message_account: Account<'info, MessageAccount>`_
   - The account for closing
   - `mut` constraint indicates data modification
   - `seeds` and `bump` constraints verify the account as the correct PDA
   - `close = user` constraint marks this account for closing and transfers its
     lamports to the `user` account

</Accordion>
</Accordions>

Next, add the logic for the `delete` instruction.

```rs title="lib.rs"
pub fn delete(_ctx: Context<Delete>) -> Result<()> {
    msg!("Delete Message");
    Ok(())
}
```

<Accordions>
<Accordion title="Diff">

```diff
- pub fn delete(_ctx: Context<Delete>) -> Result<()> {
-     Ok(())
- }

+ pub fn delete(_ctx: Context<Delete>) -> Result<()> {
+     msg!("Delete Message");
+     Ok(())
+ }
```

</Accordion>
<Accordion title="Explanation">

The `delete` function takes one parameter:

1. _rs`_ctx: Context<Delete>`_ - Provides access to the accounts specified in
   the _rs`Delete`_ struct. The _rs`_ctx`_ syntax shows that the function
   doesn't use the Context in its body.

The function body just prints a message to program logs using the _rs`msg!()`_
macro. The function needs no extra logic because the _rs`close`_ constraint in
the _rs`Delete`_ struct handles the account closing.

</Accordion>
</Accordions>

Rebuild the program.

```terminal
$ build
```

</Step>
<Step>

### Deploy Program

You've now completed the basic CRUD program. Deploy the program by running
`deploy` in the Playground terminal.

<Callout type="info">
In this example, you'll deploy the program to the devnet, a Solana cluster
for development testing.

The Playground wallet connects to the devnet by default. Ensure your Playground
wallet has devnet SOL to pay for the program deployment. Get devnet SOL from the
[Solana Faucet](https://faucet.solana.com/).

</Callout>

```terminal
$ deploy
Deploying... This could take a while depending on the program size and network conditions.
Deployment successful. Completed in 17s.
```

</Step>
<Step>

### Set Up Test File

The starter code also includes a test file in `anchor.test.ts`.

```ts title="anchor.test.ts"
import { PublicKey } from "@solana/web3.js";

describe("pda", () => {
  it("Create Message Account", async () => {});

  it("Update Message Account", async () => {});

  it("Delete Message Account", async () => {});
});
```

Add the code below inside _ts`describe()`_, but before the _ts`it()`_ sections.

```ts title="anchor.test.ts"
const program = pg.program;
const wallet = pg.wallet;

const [messagePda, messageBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("message"), wallet.publicKey.toBuffer()],
  program.programId
);
```

<Accordions>
<Accordion title="Diff">

```diff
  import { PublicKey } from "@solana/web3.js";

  describe("pda", () => {
+    const program = pg.program;
+    const wallet = pg.wallet;
+
+    const [messagePda, messageBump] = PublicKey.findProgramAddressSync(
+      [Buffer.from("message"), wallet.publicKey.toBuffer()],
+      program.programId
+    );

    it("Create Message Account", async () => {});

    it("Update Message Account", async () => {});

    it("Delete Message Account", async () => {});
  });
```

</Accordion>
<Accordion title="Explanation">

In this section, this code simply sets up the test file.

<WithMentions>

Solana Playground removes some boilerplate setup where
[`pg.program`](mention:one) allows access to methods for interacting with the
program, while [`pg.wallet`](mention:two) gives access to your playground
wallet.

```ts title="anchor.test.ts"
// !mention one
const program = pg.program;
// !mention two
const wallet = pg.wallet;
```

</WithMentions>

As part of the setup, the test file derives the message account PDA. This
demonstrates how to derive the PDA in Javascript using the same seeds specified
in the program.

```ts title="anchor.test.ts"
const [messagePda, messageBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("message"), wallet.publicKey.toBuffer()],
  program.programId
);
```

</Accordion>
</Accordions>

Run the test file by running _shell`test`_ in the Playground terminal to check
that it runs as expected. The next steps add the actual tests.

```terminal
$ test
Running tests...
  anchor.test.ts:
  pda
    ✔ Create Message Account
    ✔ Update Message Account
    ✔ Delete Message Account
  3 passing (4ms)
```

</Step>
<Step>

### Invoke Create Instruction

<WithNotes>

Update the first test with the following:

```ts title="anchor.test.ts"
it("Create Message Account", async () => {
  const message = "Hello, World!";
  const transactionSignature = await program.methods
    // !tooltip[/create/] create
    .create(message)
    // !tooltip[/accounts/] accounts
    .accounts({
      messageAccount: messagePda
    })
    // !tooltip[/rpc/] rpc
    .rpc({ commitment: "confirmed" });

  // !tooltip[/fetch/] fetch
  const messageAccount = await program.account.messageAccount.fetch(
    messagePda,
    "confirmed"
  );

  console.log(JSON.stringify(messageAccount, null, 2));
  console.log(
    "Transaction Signature:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
  );
});
```

### !create

The _ts`create()`_ method invokes the `create` instruction.

### !accounts

The _ts`accounts()`_ method specifies the accounts required for the
_ts`create()`_ instruction.

### !rpc

The _ts`rpc()`_ method sends the transaction to the network.

### !fetch

The _ts`fetch()`_ method retrieves the account data from the network.

</WithNotes>

<Accordions>
<Accordion title="Diff">

```diff
- it("Create Message Account", async () => {});

+ it("Create Message Account", async () => {
+   const message = "Hello, World!";
+   const transactionSignature = await program.methods
+     .create(message)
+     .accounts({
+       messageAccount: messagePda,
+     })
+     .rpc({ commitment: "confirmed" });
+
+   const messageAccount = await program.account.messageAccount.fetch(
+     messagePda,
+     "confirmed"
+   );
+
+   console.log(JSON.stringify(messageAccount, null, 2));
+   console.log(
+     "Transaction Signature:",
+     `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
+   );
+ });
```

</Accordion>
<Accordion title="Explanation">

First, the test file sends a transaction that invokes the `create` instruction,
passing "Hello, World!" as the message.

```ts title="anchor.test.ts"
const message = "Hello, World!";
const transactionSignature = await program.methods
  .create(message)
  .accounts({
    messageAccount: messagePda
  })
  .rpc({ commitment: "confirmed" });
```

After sending the transaction and creating the account, the test file fetches
the account using its address (`messagePda`).

```ts title="anchor.test.ts"
const messageAccount = await program.account.messageAccount.fetch(
  messagePda,
  "confirmed"
);
```

Lastly, the test file logs the account data and a link to the transaction
details.

```ts title="anchor.test.ts"
console.log(JSON.stringify(messageAccount, null, 2));
console.log(
  "Transaction Signature:",
  `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
);
```

</Accordion>
</Accordions>

</Step>
<Step>

### Invoke Update Instruction

<WithNotes>
Update the second test with the following:

```ts title="anchor.test.ts"
it("Update Message Account", async () => {
  const message = "Hello, Solana!";
  const transactionSignature = await program.methods
    // !tooltip[/update/] update
    .update(message)
    // !tooltip[/accounts/] accounts
    .accounts({
      messageAccount: messagePda
    })
    // !tooltip[/rpc/] rpc
    .rpc({ commitment: "confirmed" });

  // !tooltip[/fetch/] fetch
  const messageAccount = await program.account.messageAccount.fetch(
    messagePda,
    "confirmed"
  );

  console.log(JSON.stringify(messageAccount, null, 2));
  console.log(
    "Transaction Signature:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
  );
});
```

### !update

The _ts`update()`_ method invokes the `update` instruction.

### !accounts

The _ts`accounts()`_ method specifies the accounts required for the
_ts`update()`_ instruction.

### !rpc

The _ts`rpc()`_ method sends the transaction to the network.

### !fetch

The _ts`fetch()`_ method retrieves the account data from the network.

</WithNotes>

<Accordions>
<Accordion title="Diff">

```diff
- it("Update Message Account", async () => {});

+ it("Update Message Account", async () => {
+   const message = "Hello, Solana!";
+   const transactionSignature = await program.methods
+     .update(message)
+     .accounts({
+       messageAccount: messagePda,
+     })
+     .rpc({ commitment: "confirmed" });
+
+   const messageAccount = await program.account.messageAccount.fetch(
+     messagePda,
+     "confirmed"
+   );
+
+   console.log(JSON.stringify(messageAccount, null, 2));
+   console.log(
+     "Transaction Signature:",
+     `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
+   );
+ });
```

</Accordion>
<Accordion title="Explanation">

First, test file sends a transaction invoking the `update` instruction, passing
"Hello, Solana!" as the new message.

```ts title="anchor.test.ts"
const message = "Hello, Solana!";
const transactionSignature = await program.methods
  .update(message)
  .accounts({
    messageAccount: messagePda
  })
  .rpc({ commitment: "confirmed" });
```

After sending the transaction and updating the account, the test file fetches
the account using its address (`messagePda`).

```ts title="anchor.test.ts"
const messageAccount = await program.account.messageAccount.fetch(
  messagePda,
  "confirmed"
);
```

Lastly, the test file logs the account data and a link to the transaction
details.

```ts title="anchor.test.ts"
console.log(JSON.stringify(messageAccount, null, 2));
console.log(
  "Transaction Signature:",
  `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
);
```

</Accordion>
</Accordions>

</Step>
<Step>

### Invoke Delete Instruction

<WithNotes>

Update the third test with the following:

```ts title="anchor.test.ts"
it("Delete Message Account", async () => {
  const transactionSignature = await program.methods
    // !tooltip[/delete/] delete
    .delete()
    // !tooltip[/accounts/] accounts
    .accounts({
      messageAccount: messagePda
    })
    // !tooltip[/rpc/] rpc
    .rpc({ commitment: "confirmed" });

  // !tooltip[/fetchNullable/] fetchNullable
  const messageAccount = await program.account.messageAccount.fetchNullable(
    messagePda,
    "confirmed"
  );

  console.log("Expect Null:", JSON.stringify(messageAccount, null, 2));
  console.log(
    "Transaction Signature:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
  );
});
```

### !delete

The _ts`delete()`_ method invokes the `delete` instruction.

### !accounts

The _ts`accounts()`_ method specifies the accounts required for the
_ts`delete()`_ instruction.

### !rpc

The _ts`rpc()`_ method sends the transaction to the network.

### !fetchNullable

The _ts`fetchNullable()`_ method retrieves account data from the network that
might not exist.

The test file uses this because the account closes and the data becomes
unavailable.

</WithNotes>

<Accordions>
<Accordion title="Diff">

```diff
- it("Delete Message Account", async () => {});

+ it("Delete Message Account", async () => {
+   const transactionSignature = await program.methods
+     .delete()
+     .accounts({
+       messageAccount: messagePda,
+     })
+     .rpc({ commitment: "confirmed" });
+
+   const messageAccount = await program.account.messageAccount.fetchNullable(
+     messagePda,
+     "confirmed"
+   );
+
+   console.log("Expect Null:", JSON.stringify(messageAccount, null, 2));
+   console.log(
+     "Transaction Signature:",
+     `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
+   );
+ });
```

</Accordion>
<Accordion title="Explanation">

First, this code sends a transaction invoking the `delete` instruction to close
the message account.

```ts title="anchor.test.ts"
const transactionSignature = await program.methods
  .delete()
  .accounts({
    messageAccount: messagePda
  })
  .rpc({ commitment: "confirmed" });
```

After sending the transaction and closing the account, the example tries to
fetch the account using its address (`messagePda`) with `fetchNullable`. This
method returns null when the account no longer exists after closing.

```ts title="anchor.test.ts"
const messageAccount = await program.account.messageAccount.fetchNullable(
  messagePda,
  "confirmed"
);
```

Finally, the test file logs the account data and a link to the transaction
details. The account data shows as null since the account no longer exists.

```ts title="anchor.test.ts"
console.log(JSON.stringify(messageAccount, null, 2));
console.log(
  "Transaction Signature:",
  `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
);
```

</Accordion>
</Accordions>

</Step>
<Step>

### Run Test

After preparing your tests, run the test file with _shell`test`_ in the
Playground terminal. This command runs the tests against the program deployed on
the devnet and logs links to SolanaFM to view the transaction details.

```terminal
$ test
Running tests...
  anchor.test.ts:
  pda
    {
  "user": "3z9vL1zjN6qyAFHhHQdWYRTFAcy69pJydkZmSFBKHg1R",
  "message": "Hello, World!",
  "bump": 254
}
    Transaction Signature: https://solana.fm/tx/5oBT4jEdUR6CRYsFNGoqvyMBTRDvFqRWTAAmCGM9rEvYRBWy3B2bkb6GVFpVPKBnkr714UCFUurBSDKSa7nLHo8e?cluster=devnet-solana
    ✔ Create Message Account (1025ms)
    {
  "user": "3z9vL1zjN6qyAFHhHQdWYRTFAcy69pJydkZmSFBKHg1R",
  "message": "Hello, Solana!",
  "bump": 254
}
    Transaction Signature: https://solana.fm/tx/42veGAsQjHbJP1SxWBGcfYF7EdRN9X7bACNv23NSZNe4U7w2dmaYgSv8UUWXYzwgJPoNHejhtWdKZModHiMaTWYK?cluster=devnet-solana
    ✔ Update Message Account (713ms)
    Expect Null: null
    Transaction Signature: https://solana.fm/tx/Sseog2i2X7uDEn2DyDMMJKVHeZEzmuhnqUwicwGhnGhstZo8URNwUZgED8o6HANiojJkfQbhXVbGNLdhsFtWrd6?cluster=devnet-solana
    ✔ Delete Message Account (812ms)
  3 passing (3s)
```

Inspect the SolanaFM links to view the transaction details.

<Callout type="info">
  Note that in this example, if you run the test again, the `create` instruction
  fails because `messageAccount` already exists as an account. Only one account
  can exist for a given PDA.
</Callout>

</Step>
</Steps>

---
title: Composing Multiple Programs
description:
  Learn how to implement Cross Program Invocations (CPIs) in Solana programs
  using the Anchor framework. This tutorial demonstrates how to transfer SOL
  between accounts, interact with the System Program, and handle Program Derived
  Addresses (PDAs) in CPIs. Perfect for developers looking to build composable
  Solana programs.
h1: Cross Program Invocation
---

In this section, the CRUD program from the previous PDA section gets updated by
adding Cross Program Invocations (CPIs), a feature that enables Solana programs
to invoke each other.

This tutorial also shows how programs can "sign" for Program Derived Addresses
(PDAs) when making Cross Program Invocations.

The `update` and `delete` instructions need modification to handle SOL transfers
between accounts by invoking the System Program.

The purpose of this section includes walking through the process of implementing
CPIs in a Solana program using the Anchor framework, building upon the PDA
concepts explored in the previous section. For more details, refer to the
[Cross Program Invocation](/docs/core/cpi) page.

For reference, this link includes the
[final code](https://beta.solpg.io/668304cfcffcf4b13384d20a) after completing
both the PDA and CPI sections.

The [starter code](https://beta.solpg.io/679d75eecffcf4b13384d604) for this
section includes just the PDA section completed.

<Steps>
<Step>

### Update the Update Instruction

First, the program needs a simple "pay-to-update" mechanism by changing the
_rs`Update`_ struct and `update` function.

Begin by updating the `lib.rs` file to bring into scope items from the
`system_program` module.

```rs title="lib.rs"
use anchor_lang::system_program::{transfer, Transfer};
```

<Accordions>
<Accordion title="Diff">

```diff
  use anchor_lang::prelude::*;
+ use anchor_lang::system_program::{transfer, Transfer};
```

</Accordion>
</Accordions>

Next, update the _rs`Update`_ struct to include a new account called
`vault_account`. This account, controlled by the program, receives SOL from a
user when they update their message account.

```rs title="lib.rs"
#[account(
    mut,
    seeds = [b"vault", user.key().as_ref()],
    bump,
)]
pub vault_account: SystemAccount<'info>,
```

<Accordions>
<Accordion title="Diff">

```diff
#[derive(Accounts)]
#[instruction(message: String)]
pub struct Update<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

+   #[account(
+       mut,
+       seeds = [b"vault", user.key().as_ref()],
+       bump,
+   )]
+   pub vault_account: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"message", user.key().as_ref()],
        bump = message_account.bump,
        realloc = 8 + 32 + 4 + message.len() + 1,
        realloc::payer = user,
        realloc::zero = true,
    )]
    pub message_account: Account<'info, MessageAccount>,
    pub system_program: Program<'info, System>,
}
```

</Accordion>
<Accordion title="Explanation">

This section adds a new account called `vault_account` to the _rs`Update`_
struct. This account serves as a program-controlled "vault" that receives SOL
from users when they update their messages.

By using a PDA for the vault, the program creates a program-controlled account
unique to each user, enabling fund management within the program's logic.

---

Key aspects of the `vault_account`:

- The address of the account comes from a PDA derived using seeds
  _rs`[b"vault", user.key().as_ref()]`_
- As a PDA, it has no private key, so only the program can "sign" for the
  address when performing CPIs
- As a _rs`SystemAccount`_ type, the System Program owns it like regular wallet
  accounts

This setup allows the program to:

- Generate unique, deterministic addresses for each user's "vault"
- Control funds without needing a private key to sign for transactions.

In the `delete` instruction, you'll see how the program can "sign" for this PDA
in a CPI.

</Accordion>
</Accordions>

Next, add the CPI logic in the `update` instruction to transfer 0.001 SOL from
the user's account to the vault account.

<WithNotes>

```rs title="lib.rs"
// !tooltip[/transfer_accounts/] transfer_accounts
let transfer_accounts = Transfer {
    from: ctx.accounts.user.to_account_info(),
    to: ctx.accounts.vault_account.to_account_info(),
};

// !tooltip[/cpi_context/] cpi_context
let cpi_context = CpiContext::new(
    ctx.accounts.system_program.to_account_info(),
    transfer_accounts,
);

// !tooltip[/transfer/] transfer
transfer(cpi_context, 1_000_000)?;
```

### !transfer_accounts

The _rs`Transfer`_ struct specifies the required accounts for the System
Program's transfer instruction.

### !cpi_context

The _rs`CpiContext`_ struct specifies the program and accounts for a Cross
Program Invocation (CPI).

### !transfer

The _rs`transfer()`_ function invokes the System Program's transfer instruction.

</WithNotes>

<Accordions>
<Accordion title="Diff">

```diff
    pub fn update(ctx: Context<Update>, message: String) -> Result<()> {
        msg!("Update Message: {}", message);
        let account_data = &mut ctx.accounts.message_account;
        account_data.message = message;

+       let transfer_accounts = Transfer {
+           from: ctx.accounts.user.to_account_info(),
+           to: ctx.accounts.vault_account.to_account_info(),
+       };
+       let cpi_context = CpiContext::new(
+           ctx.accounts.system_program.to_account_info(),
+           transfer_accounts,
+       );
+       transfer(cpi_context, 1_000_000)?;
        Ok(())
    }
```

</Accordion>
<Accordion title="Explanation">

In the `update` instruction, the implementation includes a Cross Program
Invocation (CPI) to invoke the System Program's `transfer` instruction. This
demonstrates how to perform a CPI from within the program, enabling the
composability of Solana programs.

The _rs`Transfer`_ struct specifies the required accounts for the System
Program's transfer instruction:

- `from` - The user's account (source of funds)
- `to` - The vault account (destination of funds)

  ```rs title="lib.rs"
  let transfer_accounts = Transfer {
      from: ctx.accounts.user.to_account_info(),
      to: ctx.accounts.vault_account.to_account_info(),
  };
  ```

The _rs`CpiContext`_ specifies:

- The program to invoke (System Program)
- The accounts required in the CPI (defined in the _rs`Transfer`_ struct)

  ```rs title="lib.rs"
  let cpi_context = CpiContext::new(
      ctx.accounts.system_program.to_account_info(),
      transfer_accounts,
  );
  ```

The `transfer` function then invokes the transfer instruction on the System
Program, passing in the:

- The `cpi_context` (program and accounts)
- The `amount` to transfer (1,000,000 lamports, or 0.001 SOL)

  ```rs title="lib.rs"
  transfer(cpi_context, 1_000_000)?;
  ```

<Callout>

The setup for a CPI matches how client-side instructions get built, where you
specify the program, accounts, and instruction data for a particular instruction
to invoke. When the program's `update` instruction receives an invocation, it
internally invokes the System Program's transfer instruction.

</Callout>

</Accordion>
</Accordions>

Rebuild the program.

```terminal
$ build
```

</Step>
<Step>

### Update the Delete Instruction

Now add a "refund on delete" mechanism by changing the _rs`Delete`_ struct and
`delete` function.

First, update the _rs`Delete`_ struct to include the `vault_account`. This
allows the transfer of any SOL in the vault back to the user when they close
their message account.

```rs title="lib.rs"
#[account(
    mut,
    seeds = [b"vault", user.key().as_ref()],
    bump,
)]
pub vault_account: SystemAccount<'info>,
```

Also add the `system_program` as the CPI for the transfer requires invoking the
System Program.

```rs title="lib.rs"
pub system_program: Program<'info, System>,
```

<Accordions>
<Accordion title="Diff">

```diff
#[derive(Accounts)]
pub struct Delete<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

+   #[account(
+       mut,
+       seeds = [b"vault", user.key().as_ref()],
+       bump,
+   )]
+   pub vault_account: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"message", user.key().as_ref()],
        bump = message_account.bump,
        close= user,
    )]
    pub message_account: Account<'info, MessageAccount>,
+   pub system_program: Program<'info, System>,
}
```

</Accordion>
<Accordion title="Explanation">

The `vault_account` uses the same PDA derivation as in the Update struct.

Adding the `vault_account` to the Delete struct enables the program to access
the user's vault account during the delete instruction to transfer any
accumulated SOL back to the user.

</Accordion>
</Accordions>

<WithNotes>

Next, add the CPI logic in the `delete` instruction to transfer SOL from the
vault account back to the user's account.

```rs title="lib.rs"
let user_key = ctx.accounts.user.key();
// !tooltip[/signer_seeds/] signer_seeds
let signer_seeds: &[&[&[u8]]] =
    &[&[b"vault", user_key.as_ref(), &[ctx.bumps.vault_account]]];

let transfer_accounts = Transfer {
    from: ctx.accounts.vault_account.to_account_info(),
    to: ctx.accounts.user.to_account_info(),
};
let cpi_context = CpiContext::new(
    ctx.accounts.system_program.to_account_info(),
    transfer_accounts,
// !tooltip[/with_signer/] with_signer
).with_signer(signer_seeds);
transfer(cpi_context, ctx.accounts.vault_account.lamports())?;
```

### !signer_seeds

The _rs`signer_seeds`_ specify the optional seeds and bump seeds used to derive
the PDA.

### !with_signer

The _rs`with_signer()`_ method passes the signer seeds with the CPI.

This allows a program to "sign" for a PDA that derived from its program ID.

During instruction processing, the runtime verifies that the provided signer
seeds correctly derive to the PDA's address. If verified, the runtime treats
that PDA account as a signer for the duration of the CPI.

</WithNotes>

Note that _rs`_ctx: Context<Delete>`_ changes to _rs`ctx: Context<Delete>`_ to
use the context in the body of the function.

<Accordions>
<Accordion title="Diff">

```diff
-    pub fn delete(_ctx: Context<Delete>) -> Result<()> {
+    pub fn delete(ctx: Context<Delete>) -> Result<()> {
         msg!("Delete Message");

+        let user_key = ctx.accounts.user.key();
+        let signer_seeds: &[&[&[u8]]] =
+            &[&[b"vault", user_key.as_ref(), &[ctx.bumps.vault_account]]];
+
+        let transfer_accounts = Transfer {
+            from: ctx.accounts.vault_account.to_account_info(),
+            to: ctx.accounts.user.to_account_info(),
+        };
+        let cpi_context = CpiContext::new(
+            ctx.accounts.system_program.to_account_info(),
+            transfer_accounts,
+        ).with_signer(signer_seeds);
+        transfer(cpi_context, ctx.accounts.vault_account.lamports())?;
         Ok(())
     }

```

</Accordion>
<Accordion title="Explanation">

In the delete instruction, another Cross Program Invocation (CPI) implements the
System Program's transfer instruction. This CPI demonstrates how to make a
transfer that requires a Program Derived Address (PDA) signer.

First, define the signer seeds for the vault PDA:

```rs title="lib.rs"
let user_key = ctx.accounts.user.key();
let signer_seeds: &[&[&[u8]]] =
    &[&[b"vault", user_key.as_ref(), &[ctx.bumps.vault_account]]];
```

The _rs`Transfer`_ struct specifies the required accounts for the System
Program's transfer instruction:

- from: The vault account (source of funds)
- to: The user's account (destination of funds)

  ```rs title="lib.rs"
  let transfer_accounts = Transfer {
      from: ctx.accounts.vault_account.to_account_info(),
      to: ctx.accounts.user.to_account_info(),
  };
  ```

The _rs`CpiContext`_ specifies:

- The program to invoke (System Program)
- The accounts involved in the transfer (defined in the Transfer struct)
- The signer seeds for the PDA

  ```rs title="lib.rs"
  let cpi_context = CpiContext::new(
      ctx.accounts.system_program.to_account_info(),
      transfer_accounts,
  ).with_signer(signer_seeds);
  ```

The _rs`transfer()`_ function then invokes the transfer instruction on the
System Program, passing:

- The `cpi_context` (program, accounts, and PDA signer)
- The amount to transfer (the entire balance of the vault account)

  ```rs title="lib.rs"
  transfer(cpi_context, ctx.accounts.vault_account.lamports())?;
  ```

This CPI implementation shows how programs can use PDAs to manage funds. When
the program's delete instruction receives an invocation, it internally calls the
System Program's transfer instruction, signing for the PDA to allow the transfer
of all funds from the vault back to the user.

</Accordion>
</Accordions>

Rebuild the program.

```terminal
$ build
```

</Step>
<Step>

### Redeploy Program

After making these changes, redeploy the updated program. This ensures the
modified program becomes available for testing. On Solana, updating a program
simply requires deploying the program at the same program ID.

<Callout>

Ensure your Playground wallet has devnet SOL. Get devnet SOL from the
[Solana Faucet](https://faucet.solana.com/).

</Callout>

```terminal
$ deploy
Deploying... This could take a while depending on the program size and network conditions.
Deployment successful. Completed in 17s.
```

<Accordions>
<Accordion title="Explanation">

Only the upgrade authority of the program can update it. The developer sets the
upgrade authority during program deployment, and it remains the only account
with permission to change or close the program. If someone revokes the upgrade
authority, then the program becomes immutable.

When deploying programs on Solana Playground, your Playground wallet acts as the
upgrade authority for all your programs.

</Accordion>
</Accordions>

</Step>
<Step>

### Update Test File

Next, update the `anchor.test.ts` file to include the new vault account in the
instructions. This requires deriving the vault PDA and including it in the
update and delete instruction calls.

#### Derive Vault PDA

First, add the vault PDA derivation:

```ts title="anchor.test.ts"
const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), wallet.publicKey.toBuffer()],
  program.programId
);
```

<Accordions>
<Accordion title="Diff">

```diff
describe("pda", () => {
  const program = pg.program;
  const wallet = pg.wallet;

  const [messagePda, messageBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("message"), wallet.publicKey.toBuffer()],
    program.programId
  );

+  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
+    [Buffer.from("vault"), wallet.publicKey.toBuffer()],
+    program.programId
+  );

  // ...tests
  });
```

</Accordion>
</Accordions>

#### Change Update Test

<WithMentions>

Then, update the update instruction to include the [`vaultAccount`](mention:one)

```ts title="anchor.test.ts"  {5}
const transactionSignature = await program.methods
  .update(message)
  .accounts({
    messageAccount: messagePda,
    // !mention one
    vaultAccount: vaultPda
  })
  .rpc({ commitment: "confirmed" });
```

</WithMentions>

<Accordions>
<Accordion title="Diff">

```diff
    const transactionSignature = await program.methods
      .update(message)
      .accounts({
        messageAccount: messagePda,
+       vaultAccount: vaultPda,
      })
      .rpc({ commitment: "confirmed" });
```

</Accordion>
</Accordions>

#### Change Delete Test

<WithMentions>

Then, update the delete instruction to include the [`vaultAccount`](mention:one)

```ts title="anchor.test.ts"  {5}
const transactionSignature = await program.methods
  .delete()
  .accounts({
    messageAccount: messagePda,
    // !mention one
    vaultAccount: vaultPda
  })
  .rpc({ commitment: "confirmed" });
```

</WithMentions>

<Accordions>
<Accordion title="Diff">

```diff
    const transactionSignature = await program.methods
      .delete()
      .accounts({
        messageAccount: messagePda,
+       vaultAccount: vaultPda,
      })
      .rpc({ commitment: "confirmed" });
```

</Accordion>
</Accordions>

</Step>
<Step>

### Rerun Test

After making these changes, run the tests to ensure everything works as
expected:

```terminal
$ test
Running tests...
  anchor.test.ts:
  pda
    {
  "user": "3z9vL1zjN6qyAFHhHQdWYRTFAcy69pJydkZmSFBKHg1R",
  "message": "Hello, World!",
  "bump": 254
}
    Transaction Signature: https://solana.fm/tx/qGsYb87mUUjeyh7Ha7r9VXkACw32HxVBujo2NUxqHiUc8qxRMFB7kdH2D4JyYtPBx171ddS91VyVrFXypgYaKUr?cluster=devnet-solana
    ✔ Create Message Account (842ms)
    {
  "user": "3z9vL1zjN6qyAFHhHQdWYRTFAcy69pJydkZmSFBKHg1R",
  "message": "Hello, Solana!",
  "bump": 254
}
    Transaction Signature: https://solana.fm/tx/3KCDnNSfDDfmSy8kpiSrJsGGkzgxx2mt18KejuV2vmJjeyenkSoEfs2ghUQ6cMoYYgd9Qax9CbnYRcvF2zzumNt8?cluster=devnet-solana
    ✔ Update Message Account (946ms)
    Expect Null: null
    Transaction Signature: https://solana.fm/tx/3M7Z7Mea3TtQc6m9z386B9QuEgvLKxD999mt2RyVtJ26FgaAzV1QA5mxox3eXie3bpBkNpDQ4mEANr3trVHCWMC2?cluster=devnet-solana
    ✔ Delete Message Account (859ms)
  3 passing (3s)
```

You can then inspect the SolanaFM links to view the transaction details, where
you'll find the CPIs for the transfer instructions within the update and delete
instructions.

![Update CPI](/assets/docs/intro/quickstart/cpi-update.png)

![Delete CPI](/assets/docs/intro/quickstart/cpi-delete.png)

If you encounter any errors, you can reference the
[final code](https://beta.solpg.io/668304cfcffcf4b13384d20a).

</Step>
</Steps>

## Next Steps

Congratulations on completing the Solana Quickstart guide. You've gained
hands-on experience with key Solana concepts including:

- Fetching and reading data from accounts
- Building and sending transactions
- Deploying and updating Solana programs
- Working with Program Derived Addresses (PDAs)
- Making Cross-Program Invocations (CPIs)

To deepen your understanding of these concepts, check out the
[Core Concepts](/docs/core/accounts) documentation which provides detailed
explanations of the topics covered in this guide.

### Explore More Examples

If you prefer learning by example, check out the
[Program Examples Repository](https://github.com/solana-developers/program-examples)
for a variety of example programs.

Solana Playground offers a convenient feature allowing you to import or view
projects using their GitHub links. For example, open this
[Solana Playground link](https://beta.solpg.io/https://github.com/solana-developers/program-examples/tree/main/basics/hello-solana/anchor)
to view the Anchor project from this
[Github repo](https://github.com/solana-developers/program-examples/tree/main/basics/hello-solana/anchor).

Click the `Import` button and enter a project name to add it to your list of
projects in Solana Playground. Once a project gets imported, all changes receive
automatic saving and persistence.


read and understand this