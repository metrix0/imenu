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
CREDENCIAIS


===
MERCADO PAGO
===

seller test user
id
1799722894
user
TESTUSER1997825101
password
FP3UcZior3

buyer test user
id
2953516982
user
TESTUSER3587879496492241235
password
mYYHQ8jCv8

*verificação de dois fatores normalmente é os ultimos 6 digitos do ID.


CARTOES DE TESTE

5031 4332 1540 6351
123
11/30

4235 6477 2802 5682
123
11/30


CUIDADO, se testar 10+ vezes vai dar timeout de horas.

public key
APP_USR-e39e610d-d02d-4170-8b09-5740164f295a

access token
APP_USR-1860591203554676-102819-74910af6b0a19168f250543b2b79c5e4-1799722894




===
IFOOD
===

joaovralmeida@hotmail.com
iMenu2025#
código chega no @unesp de vcs










