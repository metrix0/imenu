# cartStore.ts
### What it does
Manages shopping cart state on the client side.
- add, remove, update items before checkout.

### How
Defines a React State using Zustand.
Also uses localStorage to persist.

### Usage
**Front-end only**
```
import { useCartStore } from "@/lib/cartStore";

const cart = useCartStore();
cart.addItem(product);
```

# db.ts
### What it does
Set up **PostgreSQL connection pool using pg**

### How
- Uses pool from ```pg```
- Reads the .env.DATABASE_URL
- Creates a connection pool to avoid too many DB sessions
- Exports pool so DB can be queried using pool

# sql.ts
### What it does
Has a Helper Function for executing SQL queries when using the pool from db.ts

### How
- Imports the pool from db.ts
- Async query(text, params) function
  - Connects to pool
  - Executes SQL parameters
  - Return results
  - Release the connection

### Usage
**Back-end only**, example:
```
import { query } from "@/lib/sql";

await query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);
```
> All files uses pool via sql.ts **Helper Function**. Not by db.ts.


# supabaseClient.ts
### What it does
Helper functions to access **Realtime** and **Auth**.

### How
- Import createClient from supabase-js
- Uses .env.SUPABASE_URL and .env.SUPABASE_ANON_KEY 
- Exports supabase client ready for other files to use

### Usage
**Front-end only**

Realtime:
```
import { supabase } from "@/lib/supabaseClient";

supabase.channel("orders").on("postgres_changes", {...}).subscribe();
```

Auth:
```
// Log in
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password123",
});

// Sign out
await supabase.auth.signOut();

// Get current user session
const { data: { user } } = await supabase.auth.getUser();

```

# uploadMenuImage.ts
### What it does
Handles uploading images to Supabase.

### Usage
```
import { uploadMenuImage } from "@/lib/uploadMenuImage";

const url = await uploadMenuImage(file);
await query("UPDATE menu SET image_url = $1 WHERE id = $2", [url, id]);
```

# utils.ts
### What it does
Groups multiple simple helper functions.

### Usage
**Back and Front**
```
import { formatCurrency } from "@/lib/utils";

<p>{formatCurrency(order.total_cents)}</p>
```
