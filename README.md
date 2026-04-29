# My Test App — Shopify Embedded App

A full-stack **embedded Shopify app** built with the official [Shopify App Template for React Router](https://github.com/Shopify/shopify-app-template-remix). It runs inside the Shopify Admin as an iframe, uses the **Admin GraphQL API** to manage store data, and persists sessions with **Prisma + SQLite**.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
  - [Authentication & Session Management](#authentication--session-management)
  - [Embedded App Rendering](#embedded-app-rendering)
  - [GraphQL API Integration](#graphql-api-integration)
  - [Webhooks](#webhooks)
  - [Database](#database)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone & Install](#1-clone--install)
  - [2. Configure the App](#2-configure-the-app)
  - [3. Start Development](#3-start-development)
- [Available Scripts](#available-scripts)
- [How to Develop a Shopify App (Step-by-Step)](#how-to-develop-a-shopify-app-step-by-step)
  - [Step 1 — Set Up a Shopify Partner Account](#step-1--set-up-a-shopify-partner-account)
  - [Step 2 — Create a Development Store](#step-2--create-a-development-store)
  - [Step 3 — Scaffold the App](#step-3--scaffold-the-app)
  - [Step 4 — Understand the Auth Flow](#step-4--understand-the-auth-flow)
  - [Step 5 — Add Pages & Navigation](#step-5--add-pages--navigation)
  - [Step 6 — Call the Shopify Admin API](#step-6--call-the-shopify-admin-api)
  - [Step 7 — Handle Webhooks](#step-7--handle-webhooks)
  - [Step 8 — Work with Metafields & Metaobjects](#step-8--work-with-metafields--metaobjects)
  - [Step 9 — Add Extensions](#step-9--add-extensions)
  - [Step 10 — Deploy](#step-10--deploy)
- [Shopify Integration Deep-Dive](#shopify-integration-deep-dive)
  - [App Bridge](#app-bridge)
  - [Scopes](#scopes)
  - [Environment Variables](#environment-variables)
- [Deployment](#deployment)
  - [Docker](#docker)
  - [Other Hosting Providers](#other-hosting-providers)
- [Useful Resources](#useful-resources)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [React Router v7](https://reactrouter.com/) (file-system routing) |
| **UI** | [Shopify Polaris Web Components](https://shopify.dev/docs/api/app-home/using-polaris-components) (`<s-page>`, `<s-button>`, etc.) |
| **API** | [Shopify Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql) |
| **Auth** | OAuth 2.0 via [`@shopify/shopify-app-react-router`](https://github.com/Shopify/shopify-app-js) |
| **Session Storage** | [Prisma](https://www.prisma.io/) + SQLite (dev) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **Language** | JavaScript / JSX (TypeScript-ready via `tsconfig.json`) |
| **Deployment** | Docker, or any Node.js hosting platform |

---

## Project Structure

```
my-test-app/
├── app/                            # Application source code
│   ├── db.server.js                # Prisma client singleton
│   ├── entry.server.jsx            # Server-side rendering entry point
│   ├── root.jsx                    # Root HTML layout component
│   ├── routes.js                   # File-system routing config
│   ├── shopify.server.js           # Shopify app configuration & auth helpers
│   └── routes/                     # All application routes
│       ├── _index/                 # Landing / splash page (non-embedded)
│       │   ├── route.jsx
│       │   └── styles.module.css
│       ├── app.jsx                 # Embedded app layout (nav + auth)
│       ├── app._index.jsx          # Main app page (product generator demo)
│       ├── app.additional.jsx      # Example additional page
│       ├── auth.$.jsx              # Auth catch-all route
│       ├── auth.login/             # Login page
│       │   ├── route.jsx
│       │   └── error.server.jsx
│       ├── webhooks.app.uninstalled.jsx   # Webhook: app/uninstalled
│       └── webhooks.app.scopes_update.jsx # Webhook: app/scopes_update
│
├── extensions/                     # Shopify app extensions (theme, UI, etc.)
├── prisma/                         # Database layer
│   ├── schema.prisma               # Prisma schema (Session model)
│   ├── dev.sqlite                  # SQLite database file (dev)
│   └── migrations/                 # Database migration history
│
├── public/                         # Static assets (favicon, etc.)
├── .react-router/                  # Auto-generated React Router types
├── .shopify/                       # Shopify CLI local state
│
├── shopify.app.toml                # Shopify app manifest (scopes, webhooks, metafields)
├── shopify.web.toml                # Web server roles & dev commands
├── vite.config.js                  # Vite config with HMR for Shopify tunnel
├── tsconfig.json                   # TypeScript configuration
├── .graphqlrc.js                   # GraphQL code generation config
├── Dockerfile                      # Production Docker image
├── package.json                    # Dependencies & scripts
└── README.md                       # This file
```

---

## How It Works

### Authentication & Session Management

The core authentication logic lives in **`app/shopify.server.js`**:

```js
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
});
```

**Flow:**
1. A merchant installs the app → Shopify redirects to `/auth`
2. The app completes the **OAuth 2.0 handshake** and receives an **access token**
3. The access token is stored in the **`Session`** table via Prisma
4. On every subsequent request, `authenticate.admin(request)` validates the session and provides an authenticated `admin` GraphQL client

### Embedded App Rendering

This app runs **embedded** inside the Shopify Admin (as an iframe).

- **`app/root.jsx`** — The HTML shell. Loads Shopify's Inter font and React Router scaffolding.
- **`app/routes/app.jsx`** — The layout for all `/app/*` routes. Wraps children in `<AppProvider>` which initializes **App Bridge** and renders the navigation sidebar (`<s-app-nav>`).
- **`app/entry.server.jsx`** — Handles SSR with `renderToPipeableStream`. Adds Shopify-required response headers and handles bot detection for SEO.

### GraphQL API Integration

The main demo page (`app/routes/app._index.jsx`) shows how to call the Shopify Admin GraphQL API:

```js
// Inside a route's action function:
const { admin } = await authenticate.admin(request);

const response = await admin.graphql(
  `#graphql
    mutation populateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { id title handle status }
      }
    }`,
  { variables: { product: { title: "Red Snowboard" } } }
);

const data = await response.json();
```

The demo performs three mutations:
1. **`productCreate`** — Creates a product with a random color name and a metafield
2. **`productVariantsBulkUpdate`** — Updates the variant price to `$100.00`
3. **`metaobjectUpsert`** — Creates/updates a demo metaobject entry

### Webhooks

Webhook handlers are defined as route files and registered in `shopify.app.toml`:

| Webhook Topic | Route File | Purpose |
|---|---|---|
| `app/uninstalled` | `webhooks.app.uninstalled.jsx` | Deletes all sessions for the shop when the app is uninstalled |
| `app/scopes_update` | `webhooks.app.scopes_update.jsx` | Updates the stored scope when access scopes change |

**How webhook routing works:**
- `shopify.app.toml` declares which topics to subscribe to and their URI paths
- React Router maps those URIs to the corresponding route files
- Each route exports an `action` function that receives the authenticated webhook payload

### Database

The app uses **Prisma ORM** with **SQLite** (for development):

```prisma
model Session {
  id            String    @id
  shop          String
  state         String
  isOnline      Boolean   @default(false)
  scope         String?
  expires       DateTime?
  accessToken   String
  userId        BigInt?
  firstName     String?
  lastName      String?
  email         String?
  accountOwner  Boolean   @default(false)
  locale        String?
  collaborator  Boolean?  @default(false)
  emailVerified Boolean?  @default(false)
  refreshToken        String?
  refreshTokenExpires DateTime?
}
```

This `Session` model is used by `@shopify/shopify-app-session-storage-prisma` to persist OAuth sessions. You can add your own models to `schema.prisma` for app-specific data.

---

## Prerequisites

- **Node.js** ≥ 20.19 (< 22) or ≥ 22.12
- **npm** (comes with Node.js)
- A [Shopify Partner](https://partners.shopify.com/) account
- A [Shopify development store](https://shopify.dev/docs/apps/tools/development-stores)

---

## Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd my-test-app
npm install
```

### 2. Configure the App

The app is already configured via `shopify.app.toml`. The key settings are:

```toml
client_id = "e020c880a2d21aa992903d7f09bda238"
name = "My test app"
embedded = true

[access_scopes]
scopes = "write_products,write_metaobjects,write_metaobject_definitions"
```

To link this project to your own Shopify app:

```bash
npm run config:link
```

### 3. Start Development

```bash
npm run dev
```

This command:
1. Generates the Prisma client
2. Runs pending database migrations
3. Starts the Vite dev server with HMR
4. Opens a Cloudflare tunnel so Shopify can reach your local server
5. Installs the app on your development store

You will see a URL in the terminal — open it to view your app inside the Shopify Admin.

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `shopify app dev` | Start the dev server with Shopify CLI tunnel |
| `build` | `react-router build` | Build for production |
| `start` | `react-router-serve ./build/server/index.js` | Serve the production build |
| `deploy` | `shopify app deploy` | Deploy the app to Shopify |
| `setup` | `prisma generate && prisma migrate deploy` | Generate Prisma client & run migrations |
| `lint` | `eslint ...` | Lint the codebase |
| `typecheck` | `react-router typegen && tsc --noEmit` | Run TypeScript type checking |
| `generate` | `shopify app generate` | Generate extensions, webhooks, etc. |
| `config:link` | `shopify app config link` | Link to a Shopify app |
| `config:use` | `shopify app config use` | Switch between app configs |
| `graphql-codegen` | `graphql-codegen` | Generate TypeScript types from GraphQL |
| `prisma` | `prisma` | Run Prisma CLI commands |

---

## How to Develop a Shopify App (Step-by-Step)

### Step 1 — Set Up a Shopify Partner Account

1. Go to [partners.shopify.com](https://partners.shopify.com/) and sign up
2. From the Partner Dashboard you can create apps, manage stores, and submit to the App Store

### Step 2 — Create a Development Store

1. In the Partner Dashboard, go to **Stores → Add store**
2. Choose **Development store**
3. Fill in the details and create it — this store is free and has all features enabled for testing

### Step 3 — Scaffold the App

If starting fresh (not using this repo), run:

```bash
npm init @shopify/app@latest
```

Choose the **React Router** template when prompted. This generates the same structure as this project.

If using this repo, just run `npm install` and `npm run dev`.

### Step 4 — Understand the Auth Flow

The authentication flow is handled automatically by `@shopify/shopify-app-react-router`:

```
Merchant clicks "Install"
  → Shopify redirects to /auth
  → App exchanges code for access token (OAuth 2.0)
  → Session saved to database via Prisma
  → Merchant redirected to /app (embedded in Shopify Admin)
```

Every route that needs store access calls:

```js
const { admin, session } = await authenticate.admin(request);
```

This validates the session, refreshes tokens if needed, and returns the authenticated client.

### Step 5 — Add Pages & Navigation

**To add a new page:**

1. Create a new file in `app/routes/`, e.g. `app.settings.jsx`:

```jsx
export default function SettingsPage() {
  return (
    <s-page heading="Settings">
      <s-section heading="App Settings">
        <s-paragraph>Your settings content here.</s-paragraph>
      </s-section>
    </s-page>
  );
}
```

2. Add a navigation link in `app/routes/app.jsx`:

```jsx
<s-app-nav>
  <s-link href="/app">Home</s-link>
  <s-link href="/app/additional">Additional page</s-link>
  <s-link href="/app/settings">Settings</s-link>  {/* NEW */}
</s-app-nav>
```

The file-system router automatically maps `app.settings.jsx` → `/app/settings`.

### Step 6 — Call the Shopify Admin API

Use `admin.graphql()` in **loader** (GET) or **action** (POST) functions:

```jsx
// Fetch data (loader = GET request)
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query {
        products(first: 10) {
          edges {
            node { id title status }
          }
        }
      }`
  );

  const { data } = await response.json();
  return { products: data.products.edges.map(e => e.node) };
};

// Mutate data (action = POST request)
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  // ... perform mutations
};
```

Browse the full API at [Shopify Admin GraphQL Reference](https://shopify.dev/docs/api/admin-graphql).

### Step 7 — Handle Webhooks

1. **Register** the webhook in `shopify.app.toml`:

```toml
[[webhooks.subscriptions]]
uri = "/webhooks/orders/create"
topics = [ "orders/create" ]
```

2. **Create** the route file `app/routes/webhooks.orders.create.jsx`:

```jsx
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} for ${shop}`);
  // Process the order payload...

  return new Response();
};
```

3. **Deploy** to register the webhook with Shopify:

```bash
npm run deploy
```

### Step 8 — Work with Metafields & Metaobjects

This app demonstrates both:

- **Metafields** — Custom data attached to existing resources (products, orders, etc.)
- **Metaobjects** — Standalone custom data types you define

They are declared in `shopify.app.toml`:

```toml
# Product metafield
[product.metafields.app.demo_info]
type = "single_line_text_field"
name = "Demo Source Info"

# Metaobject definition
[metaobjects.app.example]
name = "Example"
```

And created/updated via GraphQL mutations in your route actions (see `app._index.jsx` for the full example).

### Step 9 — Add Extensions

Shopify extensions let you extend the Shopify Admin UI, checkout, storefront, and more.

```bash
npm run generate extension
```

Choose the type (e.g., Admin UI extension, Theme extension, Checkout extension) and follow the prompts. Extensions are generated in the `extensions/` directory.

### Step 10 — Deploy

```bash
npm run deploy
```

This uploads your app configuration and extensions to Shopify. For hosting the web server, see the [Deployment](#deployment) section.

---

## Shopify Integration Deep-Dive

### App Bridge

[App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) is Shopify's client-side library for embedded apps. It provides:

- **Toast notifications**: `shopify.toast.show("Product created")`
- **Navigation intents**: `shopify.intents.invoke("edit:shopify/Product", { value: productId })`
- **Resource pickers**, **modals**, and more

Access it in any component via:

```jsx
import { useAppBridge } from "@shopify/app-bridge-react";

const shopify = useAppBridge();
```

### Scopes

Scopes define what data your app can access. They are set in `shopify.app.toml`:

```toml
[access_scopes]
scopes = "write_products,write_metaobjects,write_metaobject_definitions"
```

Common scopes:

| Scope | Access |
|---|---|
| `read_products` / `write_products` | Products, variants, collections |
| `read_orders` / `write_orders` | Orders, transactions |
| `read_customers` / `write_customers` | Customer data |
| `read_inventory` / `write_inventory` | Inventory levels and items |
| `write_metaobjects` | Metaobject definitions and entries |

Full list: [Shopify Access Scopes](https://shopify.dev/docs/api/usage/access-scopes)

### Environment Variables

These are automatically managed by the Shopify CLI during development:

| Variable | Description |
|---|---|
| `SHOPIFY_API_KEY` | Your app's API key (client ID) |
| `SHOPIFY_API_SECRET` | Your app's API secret key |
| `SHOPIFY_APP_URL` | The public URL of your app (tunnel URL in dev) |
| `SCOPES` | Comma-separated access scopes |
| `PORT` | Port the server listens on (default: `3000`) |
| `SHOP_CUSTOM_DOMAIN` | Custom shop domain (optional) |

---

## Deployment

### Docker

A `Dockerfile` is included for containerized deployment:

```bash
# Build the image
docker build -t my-test-app .

# Run the container
docker run -p 3000:3000 \
  -e SHOPIFY_API_KEY=your_key \
  -e SHOPIFY_API_SECRET=your_secret \
  -e SHOPIFY_APP_URL=https://your-app.example.com \
  -e SCOPES=write_products \
  my-test-app
```

The Dockerfile:
1. Uses `node:20-alpine` as the base image
2. Installs production dependencies
3. Builds the React Router app
4. Runs Prisma migrations and starts the server

### Other Hosting Providers

You can deploy to any Node.js hosting platform:

1. **Build**: `npm run build`
2. **Setup database**: `npm run setup`
3. **Start**: `npm run start`

Popular choices: [Fly.io](https://fly.io), [Railway](https://railway.app), [Render](https://render.com), [Heroku](https://heroku.com).

> **Note:** For production, switch from SQLite to PostgreSQL or MySQL by updating `prisma/schema.prisma` and the connection string.

---

## Useful Resources

| Resource | Link |
|---|---|
| Shopify App Development Docs | https://shopify.dev/docs/apps |
| Shopify CLI Reference | https://shopify.dev/docs/apps/tools/cli |
| Admin GraphQL API Reference | https://shopify.dev/docs/api/admin-graphql |
| App Bridge Documentation | https://shopify.dev/docs/apps/tools/app-bridge |
| Polaris Web Components | https://shopify.dev/docs/api/app-home/using-polaris-components |
| React Router Documentation | https://reactrouter.com/ |
| Prisma Documentation | https://www.prisma.io/docs |
| Shopify Partner Dashboard | https://partners.shopify.com/ |
| GraphiQL (API Explorer) | https://shopify.dev/docs/apps/tools/graphiql-admin-api |
| Shopify Community Forums | https://community.shopify.com/ |
