
# globals.css
### What it does
Defines global styles.


# layout.tsx
### What it does
Defines the global/root layout used for all root pages.
Like, navbars and footers. It wraps all pages children inside this consistent layout.

### How

```export default function RootLayout({ children })``` → this function wraps every page.

> If you want to remove the layout, you can create another empty layout in the sub folder.


# /api
### What it does
Holds all **Back-end API routes**. There is no APIs outside from here.


# /dev
### What it does
Everything dev-related.

# [slug]
Is the consumer view Menu, where they can order. Mobile first.
## [slug]/[id] is the cart

# /painel
Is the main dashboard for the restaurant admin. Uses components from /components/restaurant/configuracoes

# /restaurante/criar
Is the step-by-step setup for the restaurant. Uses components from /components/restaurant/configuracoes


