# Brendo

Segunda-feira: Arrumar paths

---

Average Estimated Delivery Time
Periodicamente (1sem) calcula o tempo médio dos pedidos (os pedidos devem ter a data e hora em que foram pedidos, aceitos e em que foram entregues)
Alternativamente, pode-se deixar em manual, e colocar você mesmo o tempo que leva. <- talvez precise de cron job
Display: 40-60 minutos. (não um valor fixo)
Só aparece quando tiver.

---


METRICS
RODMAP.md > Core Funnel
1. Integrar o PostHog, e verificar que tá funfando
posthog.capture('event')
Ex:
finalizar_checkout_e_pagar(){
	CHAMAR A API PRA PAGAR

	posthog.capture('checkout-pagar')
}

2.  Adicionar capture events do 1 ao 4 (inclusive sub numeros)
3. testa
4. IMPPORTANTE: talvez você tenha que detalhar o capture(''): colocar se é um user ou um dono de restaurante, colocar o quanto foi gasto $ ou ganho, etc...

---

Menu pro usuário

---

Customize/CREATE Menu
tela pra criar o menu, e colocar os dados (nome, logo, banner) <- se possível puxar do ifood







---

# Rafa

Segunda-feira: Arrumar paths

---

withdraw $, show balance
Banco de dados: Nova tabela com o que devemos $ para o usuário cada semana, e o que pagamos para o usuário $ cada semana. 

- DIA 01 A DIA 08    |    30 pedidos  |     R$ 1234   |    PAGO   |   <-   /mestre pra quem precisa mandar o $ (toda segunda) <- talvez precise de cron job

---

User Registration/Checkout (vai usar bastante UX)
Depois do carrinho
colocar os detalhes, tipo endereço, pagamento(including Levar Maquininha), nome, telefone, etc (UX)
usar API do mercado pago pra gerar o pagamento através da rota api/webhooks/mercadopago/route.ts <- gera um link do MP, porém, se conseguir, fazer todo o pagamento DENTRO do nossos site.

bonus: credenciais.txt


---

(esperar o menu do cliente do brendo)
Menu para Carrinho
1. Vai ficar salvo nos dados do navegador.
1. Adicionar item -> adiciona item no carrinho
2. ao finalizar pedido, adiciona os items no pedido e gera o pedido na API (BD)

---

Delivery fee system
O dono pode adicionar o calculo de taxa de entrega (com regras) ver ifood, beefood e discernir qual o melhor jeito (UX)
< No banco de dados, a table Restaurantes tem um campo TAXA_DE_ENTREGA (ou algo assim) que é um json.
Passar a maneira como a taxa é calculada pelo JSON, para que possa ser usada no checkout.

ex: (o robo sabe mais sobre isso)
12383000
12314000 R$ 5

--

Basic Dashboard
mostrar vendas, n° de vendas, $
filtro de data
gráfico
Add a section with payouts:  semana 03/11/2025-10/11/2025 (segunda a segunda sempre)    R$ 250     ⏳ Pendendo (ou ✅ Pago)


---

Support (rápida)
Botão flutuante no canto inferior direito. No clique ele detecta o tipo de aparelho que ta abrindo, se for um celular, manda direito pro https://wa.me/${phone}?text=${message}, se for um PC, gera um QR code com https://wa.me/${phone}?text=${message}, mostrando o número de contato









---
OLD


























# BRENDO

## *Sync iFood*
* database já tem uma table de integrações*
  /painel/integrações <- colocar dados de integração no campo e apertar "atualizar" pra integrar


## *Menu Items*
*usaremos /cardápio e não /[id], pois o usuário vai estar logado, então não é necessário o id do cardápio.
/cardápio <- clicar no "Adicionar Item" dentro de cada categoria <- um item é adicionado (observar imagens no figma, como pode perceber, ao adicionar o item, os campos já são editáveis)
/cardápio <- clicar no "..." do item <- editar


## *Order Panel and Orders*
/painel <- pedidos aparecem <- botão confirmar pedido torna ele em "preparando" e posteriormente em "enviando"



# RAFA

- muda atualizando-email p/ novo-email e coloca na /configuracoes

## *Subscribe*
já mandei no PV


## *Add Restaurant*
(usuário logado)
/restaurante/criar <- cria o restaurante na database, ligada ao usuário (dar um jeito de pegar o user ID ou algo assim pelo Supabase Auth, pra coligar ao usuário)

/setup/perfil <- colocar o nome e salvar <- vai gerar um /(slug) pro restaurante, tipo batata-quente, o /batata-quente deve ser acessável agora. (obs: ainda deve ter um id pro restaurante)


## *Share Menu*
*o link do restaurante já foi gerado no Add Restaurant
/painel <- botão share gera um QR Code <- ve se isso fica mto lento, se sim, se vale a pena tentar guardar o QR Code na DB (usa a função de popup pro QR Code)


## *Cart*
/nome-do-restaurante/[id] <- gerar o id do pedido e tornar acessável, <- adicionar itens, aumentar, remover
*img n°1 do produto quer dizer a que esta na table do item, e não as que estão na table item_images

