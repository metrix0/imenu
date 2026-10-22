# iMenu

**Cardápio digital, pedidos e gestão para restaurantes — em um só lugar.**

O iMenu permite que restaurantes vendam diretamente pelo próprio cardápio online, recebam pedidos e organizem a operação sem exigir que o cliente instale um aplicativo. O iMenu oferece seu sistema principal gratuitamente, sem taxas sobre pedidos ou limites de uso; funcionalidades complementares podem ter condições próprias.

**[Site oficial](https://www.imenuapp.com.br)** · **[Painel do restaurante](https://www.imenuapp.com.br/painel)** · **[Ambiente de preview](https://preview.imenuapp.com.br)**

## Funcionalidades

| Área | O que o projeto oferece |
| --- | --- |
| Cardápio digital | Categorias, produtos, imagens, personalização e acesso por link ou QR Code. |
| Pedidos | Carrinho, checkout, acompanhamento de status e gestão dos pedidos no painel. |
| Operação | Disponibilidade, horários, taxas de entrega, mesas, garçom e motoboy. |
| Impressão | Integração com o iMenu Impressora para receber e imprimir pedidos. |
| Gestão e crescimento | Indicadores, financeiro, promoções, fidelidade e recursos de WhatsApp. |
| Inteligência artificial | Assistente IA, Vendas IA e funcionalidades de IA Plus. |
| Integrações | Serviços de pagamento, autenticação, notificações e análise de uso. |

As funcionalidades disponíveis a cada restaurante dependem da configuração e das integrações habilitadas.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Aplicação web e API | Next.js 16 (App Router), React 19, TypeScript |
| Interface | Tailwind CSS 4 e componentes compartilhados em `components/ui/` |
| Estado no cliente | Zustand |
| Banco de dados | PostgreSQL 17 e Supabase self-hosted |
| Acesso a dados no servidor | `pg`, pool em `lib/database/db.ts` e utilitários em `lib/database/sql.ts` |
| Autenticação, arquivos e tempo real | Supabase Auth, Storage e Realtime |
| Pagamentos | Integrações com Mercado Pago, PayZu e Asaas |
| Observabilidade | Sentry e PostHog |
| Infraestrutura e entrega | Docker em VPS e GitHub Actions |
| Testes | Jest, TypeScript e build do Next.js |

O projeto utiliza tanto chamadas ao Supabase sujeitas às políticas de acesso quanto rotas de API e consultas PostgreSQL no servidor. Não presuma que todas as operações passam por um único desses caminhos.

## Começando

### Requisitos

- **Node.js 22**, versão utilizada no pipeline de CI, e npm.
- Acesso autorizado às variáveis de ambiente necessárias à aplicação, ao banco e às integrações utilizadas.
- Acesso aos serviços de desenvolvimento configurados para o projeto.

### Execução local

```bash
git clone https://github.com/metrix0/imenu.git
cd imenu
git switch preview
npm ci
npm run dev
```

A aplicação fica disponível em **http://localhost:3000**, desde que as variáveis e dependências externas exigidas pelas rotas estejam configuradas.

Crie seu `.env.local` com os valores obtidos pelos canais autorizados do projeto. **Não copie credenciais de produção, publique segredos no repositório ou presuma que integrações externas funcionam sem configuração.** Não há um arquivo de exemplo de ambiente na raiz; consulte a equipe responsável antes de configurar novos ambientes.

### Validação

```bash
npm test -- --runInBand
npx tsc --noEmit
npx next build
```

O workflow [Validate build](.github/workflows/validate-build.yml) executa `npm ci`, suítes Jest específicas, checagem TypeScript e build em pushes para `preview`. Pull requests para `main` passam por checagem TypeScript. Alguns comandos locais precisam de variáveis e serviços válidos para concluir.

## Estrutura do repositório

```text
app/
  [slug]/               Cardápio público
  painel/                Painel do restaurante
  restaurante/           Cadastro e configuração inicial
  api/                   Endpoints, webhooks e rotinas agendadas
components/
  ui/                    Componentes reutilizáveis
  restaurant-owner/      Componentes do painel
lib/
  database/              Acesso ao PostgreSQL e Supabase
  stores/                Estado da aplicação
  payments/              Integrações financeiras
  ia-vendas/             Lógica das ferramentas de vendas com IA
  printer/               Integração e utilitários de impressão
deployment/vps/          Infraestrutura e rotinas operacionais
docs/                    Documentação técnica especializada
.github/workflows/       CI, releases e implantação
```

A estrutura acima é apenas um mapa de navegação. Consulte os arquivos e imports da branch `preview` para localizar a implementação atual; pastas de rotas não precisam corresponder a tabelas do banco.

## Ambientes e implantação

| Ambiente | Referência |
| --- | --- |
| Produção | [www.imenuapp.com.br](https://www.imenuapp.com.br) · branch `main` |
| Desenvolvimento / preview | [preview.imenuapp.com.br](https://preview.imenuapp.com.br) · branch `preview` |

A aplicação e os serviços Supabase operam em infraestrutura de VPS com Docker. Os workflows do GitHub Actions coordenam validações e implantações. Para procedimentos operacionais, restrições de segurança, backups e rollback, consulte **[deployment/vps/README.md](deployment/vps/README.md)**; não execute procedimentos de infraestrutura com base apenas neste resumo.

## Desenvolvimento e contribuições

Antes de qualquer alteração, leia **[AGENTS.md](AGENTS.md)**. Esse arquivo é a fonte de verdade para escopo, acesso, branches, validação e commits. Alterações do iMenu devem ser feitas em `preview`; `main` é produção.

Para mudanças visuais, siga **[docs/ai-design-guidelines.md](docs/ai-design-guidelines.md)** e reutilize os componentes existentes. O **[design-system.html](design-system.html)** é a referência visual completa quando necessário.

Documentação complementar:

- [Operação e infraestrutura da VPS](deployment/vps/README.md)
- [Padrões e componentes de interface](components/ui/README.md)
- [Processamento em lote de Vendas IA](docs/ia-vendas-batch.md)
- [Workflows de CI e deployment](.github/workflows/)

## Licença

**Software proprietário.** Copyright © 2025–2026 iMenu. Todos os direitos reservados. Consulte [LICENSE](LICENSE) para as restrições de uso, cópia, modificação e distribuição.
