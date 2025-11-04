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

# fontawesome.ts
### What it does
Exports a package of icons that we'll use often.

### Usage

To import, use:
```
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
```
- The first line imports the library
- The second line imports our icon package

Then, to use **icons in our package:**
```
<FontAwesomeIcon icon={icon.faPlus} />
```
> **Notice the usage of "icon."**

> To check the icons in our package, enter fontawesome.ts. You may add more.

To use **icons outside our package,** (not used often) import:
```
import { faPlus } from "@fortawesome/free-solid-svg-icons";
```
and use (without the "icons.")
```
<FontAwesomeIcon icon={faPlus} />
```

# popupStore.ts

### What it does
Has a Helper Function and Layout (components/Popup.tsx and /Toast.tsx) for Popup calling
- Popup is a simple full screen popup
- Toast is a quick top-right corner message

### Usage (Popup)

Add imports
```
import Popup from "@/components/Popup";
```

Add state management (under ```export default function```)
```
const [showPopup, setShowPopup] = useState(false);
```

Add the popup and button
```
<Popup open={showPopup} onClose={() => setShowPopup(false)}>
  Whatever
</Popup>

<button onClick={() => setShowPopup(true)} className="px-4 py-2 bg-green-600 text-white rounded-md">Botão</button>
```

### Usage (Toast)
Add imports
```
import Toast from "@/components/Toast";
```

Add state management (under ```export default function```)
```
const [showToast, setShowToast] = useState(false);
```

Add the button and toast
```
<button onClick={() => setShowToast(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md">Botão Toast</button>

{showToast && (<Toast message="Alterações salvas com sucesso!"  type="success" onClose={() => setShowToast(false)}/>)}
```

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
