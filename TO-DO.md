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

