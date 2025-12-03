# app/api

```
All route folders must have the same name as the Supabase table they interact with.
Eg: /app/api/restaurants for the "restaurants" table.
```

# /components

```

/common <- common shared components
/costumer <- ex: /[slug]
/restaurant-owner <- ex: /painel and /restaurante
/ui <- shared UI small components

```

# /lib

```

/api <- API wrapper functions
/database <- database client and queries
/stores <- Zustand stores and types.ts
    /restaurant-owner
    /costumer
/types <- shared types (for now, only types.ts)
/utils <- utility functions

```

# /public

```

/images <- general images
/logos
/icons <- icons (small, .ico)
/placeholders <- placeholder images
/fonts

```



