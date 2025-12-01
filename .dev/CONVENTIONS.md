# Naming Conventions

- **Database fields → identical variable names in zustand.**
  Ex.: user_id in DB → user_id in Zustand.

# Data Flow Conventions

- **Database → API → Zustand → Components.**
Components must never talk directly to the database.

# Zustand Conventions

- **One store file per subject.**
Ex.: useUserStore, useCartStore, useUIStore.

- **All types inside types.ts**

- **Persist only when needed (session-like or cart-like data).**
  Don’t persist UI state.



- **Always export a typed state + actions object:**

Example:

type.ts <- Universal types file
```ts

type CounterStore = {
  count: number;
  increase: () => void;
};

```

whatever-store.ts <- Store file
```ts

export const useCounter = create<CounterStore>((set) => ({
  count: 0,
  increase: () => set((s) => ({ count: s.count + 1 })),
}));

```

usage
```ts

const count = useCounter((s) => s.count);
const increase = useCounter((s) => s.increase);

```